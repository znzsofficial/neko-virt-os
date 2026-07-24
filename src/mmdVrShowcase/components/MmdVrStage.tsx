import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import {
  createMmdRuntimeHandle,
  type MmdRuntimeHandle,
} from "../../appModules/mmdStudio/mmdRuntime";
import { useLanguageStore } from "../../languageStore";
import { getMmdVrSessionAssets } from "../mmdVrAssets";
import {
  resetMmdVrClock,
  setMmdVrClockDuration,
  setMmdVrClockTime,
} from "../mmdVrClock";
import { getMmdVrRenderProfile } from "../mmdVrQuality";
import { useMmdVrStore, type MmdVrLightPreset } from "../mmdVrStore";

const STAGE_BG = "#0c1018";
const FLOOR = "#1a2230";
const FLOOR_RING = "#3d5a80";

const LIGHT_PRESETS: Record<
  MmdVrLightPreset,
  {
    ambient: number;
    sun: number;
    hemi: number;
    sunPos: [number, number, number];
    fogFar: number;
    envIntensity: number;
    skyZenith: string;
    skyHorizon: string;
  }
> = {
  stage: {
    ambient: 0.55,
    sun: 1.05,
    hemi: 0.35,
    sunPos: [3.2, 6.5, 2.4],
    fogFar: 22,
    envIntensity: 0.35,
    skyZenith: "#1a2840",
    skyHorizon: "#0e1520",
  },
  soft: {
    ambient: 0.75,
    sun: 0.55,
    hemi: 0.55,
    sunPos: [1.5, 5.5, 3.5],
    fogFar: 26,
    envIntensity: 0.5,
    skyZenith: "#2a3a52",
    skyHorizon: "#141c28",
  },
  contrast: {
    ambient: 0.28,
    sun: 1.45,
    hemi: 0.2,
    sunPos: [4.5, 7, 1.2],
    fogFar: 18,
    envIntensity: 0.2,
    skyZenith: "#0a1018",
    skyHorizon: "#05080c",
  },
};

/** Inward-facing gradient dome (cheap sky, no HDR). */
function StageSky({ zenith, horizon }: { zenith: string; horizon: string }) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 4;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const g = ctx.createLinearGradient(0, 0, 0, 64);
      g.addColorStop(0, zenith);
      g.addColorStop(0.55, horizon);
      g.addColorStop(1, STAGE_BG);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 4, 64);
    }
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.needsUpdate = true;
    return map;
  }, [zenith, horizon]);

  useEffect(
    () => () => {
      texture.dispose();
    },
    [texture],
  );

  return (
    <mesh scale={[-1, 1, 1]} renderOrder={-10}>
      <sphereGeometry args={[28, 24, 16]} />
      <meshBasicMaterial map={texture} side={THREE.BackSide} depthWrite={false} fog={false} />
    </mesh>
  );
}

function StageFloor({
  segments,
  shadows,
  placeMode,
}: {
  segments: number;
  shadows: boolean;
  placeMode: boolean;
}) {
  return (
    <group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        receiveShadow={shadows}
        onPointerDown={(e) => {
          if (!placeMode) return;
          e.stopPropagation();
          const p = e.point;
          useMmdVrStore.getState().requestGroundPlace(p.x, p.z);
        }}
      >
        <circleGeometry args={[8, segments]} />
        {shadows ? (
          <meshStandardMaterial color={FLOOR} roughness={0.92} metalness={0.05} />
        ) : (
          <meshBasicMaterial color={FLOOR} />
        )}
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
        <ringGeometry args={[3.2, 3.32, Math.max(16, Math.floor(segments / 2))]} />
        <meshBasicMaterial color={FLOOR_RING} transparent opacity={0.4} side={THREE.FrontSide} />
      </mesh>
      {placeMode ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]} raycast={() => null}>
          <ringGeometry args={[7.6, 7.95, 48]} />
          <meshBasicMaterial color="#6bb8ea" transparent opacity={0.35} side={THREE.DoubleSide} />
        </mesh>
      ) : null}
    </group>
  );
}

/**
 * Owns MMD runtime (WebGL only), loads session assets once, advances timeline.
 */
export function MmdVrStageContent() {
  const { scene, camera, size } = useThree();
  const mmdPrefs = useMmdVrStore((s) => s.prefs);
  const profile = getMmdVrRenderProfile(mmdPrefs);
  const lightPreset = mmdPrefs.lightPreset;
  const lightCfg = LIGHT_PRESETS[lightPreset] ?? LIGHT_PRESETS.stage;
  const setPlaying = useMmdVrStore((s) => s.setPlaying);
  const setModels = useMmdVrStore((s) => s.setModels);
  const setDuration = useMmdVrStore((s) => s.setDuration);
  const setStatusLine = useMmdVrStore((s) => s.setStatusLine);
  const seekEpoch = useMmdVrStore((s) => s.seekEpoch);
  const seekSeconds = useMmdVrStore((s) => s.seekSeconds);
  const language = useLanguageStore((s) => s.language);

  const runtimeRef = useRef<MmdRuntimeHandle | null>(null);
  const timeRef = useRef(0);
  const playingRef = useRef(false);
  const loopRef = useRef(false);
  const loadGenRef = useRef(0);
  const loadedKeyRef = useRef<string | null>(null);
  const sunRef = useRef<THREE.DirectionalLight>(null);
  const stopPlayingQueuedRef = useRef(false);
  const lastSeekEpochRef = useRef(0);
  const lightingKeyRef = useRef("");
  const labelsRef = useRef({
    loading: "Loading…",
    failed: "Load failed",
    empty: "No model",
  });
  const placeMode = useMmdVrStore((s) => s.placeMode);

  // Keep labels current without re-running the load effect on language change.
  useEffect(() => {
    const t = useLanguageStore.getState().t;
    labelsRef.current = {
      loading: t("settingsMmdVrLoading"),
      failed: t("settingsMmdVrLoadFailed"),
      empty: t("settingsMmdVrEmptyNoAssets"),
    };
  }, [language]);

  useEffect(() => {
    playingRef.current = useMmdVrStore.getState().playing;
    loopRef.current = useMmdVrStore.getState().loop;
    return useMmdVrStore.subscribe((state) => {
      playingRef.current = state.playing;
      loopRef.current = state.loop;
    });
  }, []);

  const runtime = useMemo(() => {
    const handle = createMmdRuntimeHandle(scene, { webGpu: false });
    runtimeRef.current = handle;
    return handle;
  }, [scene]);

  useEffect(
    () => () => {
      try {
        runtime.dispose();
      } catch {
        // ignore
      }
      if (runtimeRef.current === runtime) runtimeRef.current = null;
      loadedKeyRef.current = null;
    },
    [runtime],
  );

  function applyLighting() {
    const sun = sunRef.current;
    if (!sun) return;
    const key = `${lightPreset}|${profile.shadows}|${sun.uuid}`;
    if (lightingKeyRef.current === key) return;
    lightingKeyRef.current = key;
    const cfg = LIGHT_PRESETS[useMmdVrStore.getState().prefs.lightPreset] ?? LIGHT_PRESETS.stage;
    sun.position.set(...cfg.sunPos);
    sun.intensity = cfg.sun;
    sun.castShadow = getMmdVrRenderProfile(useMmdVrStore.getState().prefs).shadows;
    runtime.setLighting({
      envIntensity: cfg.envIntensity,
      ambientIntensity: cfg.ambient,
      directionalLight: sun,
      envMap: null,
    });
  }

  useLayoutEffect(() => {
    lightingKeyRef.current = "";
    applyLighting();
  }, [runtime, lightPreset, profile.shadows]);

  function syncModelList() {
    const list = runtime.listModels().map((m) => ({
      id: m.id,
      name: m.name,
      visible: m.visible,
    }));
    setModels(list);
    setDuration(runtime.duration);
    setMmdVrClockDuration(runtime.duration);
  }

  useEffect(() => {
    if (seekEpoch === lastSeekEpochRef.current) return;
    lastSeekEpochRef.current = seekEpoch;
    const dur = runtime.duration;
    timeRef.current = dur > 0 ? Math.min(Math.max(0, seekSeconds), dur) : 0;
    setMmdVrClockTime(timeRef.current, true);
  }, [seekEpoch, seekSeconds, runtime]);

  // Load once per runtime + session asset key (not on i18n change).
  useEffect(() => {
    const slots = getMmdVrSessionAssets();
    const loadKey = slots
      .map((s) => `${s.modelFile.name}:${s.modelFile.size}:${s.bodyMotionFile?.name ?? ""}`)
      .join("|");

    if (!slots.length) {
      setStatusLine(labelsRef.current.empty);
      setModels([]);
      setDuration(0);
      resetMmdVrClock();
      return;
    }

    if (loadedKeyRef.current === loadKey && runtime.listModels().length > 0) {
      syncModelList();
      return;
    }

    const gen = ++loadGenRef.current;
    let cancelled = false;
    setStatusLine(labelsRef.current.loading);
    void (async () => {
      try {
        let index = 0;
        for (const slot of slots) {
          if (cancelled || gen !== loadGenRef.current) return;
          const offsetX = (index - (slots.length - 1) / 2) * 1.1;
          await runtime.addModel(slot.modelFile, slot.companionFiles, {
            physics: false,
            transform: { positionX: offsetX },
          });
          if (slot.bodyMotionFile) {
            await runtime.loadMotion(slot.bodyMotionFile, "body", runtime.selectedId);
          }
          if (slot.faceMotionFile) {
            await runtime.loadMotion(slot.faceMotionFile, "face", runtime.selectedId);
          }
          index += 1;
        }
        if (cancelled || gen !== loadGenRef.current) return;
        loadedKeyRef.current = loadKey;
        timeRef.current = 0;
        syncModelList();
        setStatusLine(null);
        setMmdVrClockTime(0, true);
        if (runtime.duration > 0) setPlaying(true);
      } catch (err) {
        if (cancelled || gen !== loadGenRef.current) return;
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[mmdVr] load failed", err);
        setStatusLine(`${labelsRef.current.failed}: ${msg.slice(0, 28)}`);
        syncModelList();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [runtime, setDuration, setModels, setPlaying, setStatusLine]);

  useFrame((_, delta) => {
    applyLighting();

    const store = useMmdVrStore.getState();
    const toggles = store.takeVisibilityToggles();
    if (toggles.length) {
      for (const id of toggles) {
        const entry = runtime.listModels().find((m) => m.id === id);
        if (entry) runtime.setModelVisible(id, !entry.visible);
      }
      syncModelList();
    }

    const place = store.takeGroundPlace();
    if (place) {
      const models = runtime.listModels();
      const targetId =
        (store.placeModelId && models.some((m) => m.id === store.placeModelId)
          ? store.placeModelId
          : models.find((m) => m.visible)?.id) ?? models[0]?.id;
      if (targetId) {
        runtime.setModelTransform(targetId, {
          positionX: place.x,
          positionY: 0,
          positionZ: place.z,
        });
        if (store.placeModelId !== targetId) {
          store.setPlaceModelId(targetId);
        }
      }
    }

    const rt = runtimeRef.current;
    if (!rt) return;
    const duration = rt.duration;
    if (playingRef.current && duration > 0) {
      timeRef.current += delta;
      if (timeRef.current >= duration) {
        if (loopRef.current) {
          timeRef.current = 0;
        } else {
          timeRef.current = duration;
          playingRef.current = false;
          if (!stopPlayingQueuedRef.current) {
            stopPlayingQueuedRef.current = true;
            queueMicrotask(() => {
              stopPlayingQueuedRef.current = false;
              useMmdVrStore.getState().setPlaying(false);
            });
          }
        }
      }
    }
    setMmdVrClockTime(timeRef.current);

    const perspective = camera as THREE.PerspectiveCamera;
    const aspect = size.width / Math.max(1, size.height);
    if (perspective.isPerspectiveCamera && Math.abs(perspective.aspect - aspect) > 1e-5) {
      perspective.aspect = aspect;
      perspective.updateProjectionMatrix();
    }
    rt.update(timeRef.current, false, perspective, aspect, false);
  });

  return (
    <>
      <color attach="background" args={[STAGE_BG]} />
      <fog attach="fog" args={[STAGE_BG, 10, lightCfg.fogFar]} />
      <StageSky zenith={lightCfg.skyZenith} horizon={lightCfg.skyHorizon} />
      <ambientLight intensity={lightCfg.ambient} />
      <directionalLight
        ref={sunRef}
        position={lightCfg.sunPos}
        intensity={lightCfg.sun}
        castShadow={profile.shadows}
        shadow-mapSize-width={profile.shadows ? 1024 : 256}
        shadow-mapSize-height={profile.shadows ? 1024 : 256}
        shadow-camera-near={0.5}
        shadow-camera-far={24}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
      />
      <hemisphereLight args={["#b8c8e0", "#1a2230", lightCfg.hemi]} />
      <StageFloor
        segments={profile.floorSegments}
        shadows={profile.shadows}
        placeMode={placeMode}
      />
      {profile.showGrid ? (
        <gridHelper args={[12, 12, "#2a3548", "#1e2838"]} position={[0, 0.01, 0]} />
      ) : null}
    </>
  );
}
