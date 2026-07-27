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
import { getXrAccentTokens } from "../../xr";
import { prepareMmdVrModel } from "../prepareMmdVrModel";
import { getMmdVrControllerColliderMatrices } from "../mmdVrControllerColliders";

const STAGE_BG = "#0c1018";
const FLOOR = "#1a2230";

const LIGHT_PRESETS: Record<
  MmdVrLightPreset,
  {
    ambient: number;
    ambientColor: string;
    sun: number;
    sunColor: string;
    hemi: number;
    hemiSky: string;
    hemiGround: string;
    sunPos: [number, number, number];
    fogFar: number;
    envIntensity: number;
    skyZenith: string;
    skyHorizon: string;
  }
> = {
  stage: {
    ambient: 0.55,
    ambientColor: "#dce7ff",
    sun: 1.05,
    sunColor: "#fff4e8",
    hemi: 0.35,
    hemiSky: "#b8c8e0",
    hemiGround: "#1a2230",
    sunPos: [3.2, 6.5, 2.4],
    fogFar: 22,
    envIntensity: 0.35,
    skyZenith: "#1a2840",
    skyHorizon: "#0e1520",
  },
  soft: {
    ambient: 0.75,
    ambientColor: "#f4efff",
    sun: 0.55,
    sunColor: "#fff5f0",
    hemi: 0.55,
    hemiSky: "#cedcf2",
    hemiGround: "#26313f",
    sunPos: [1.5, 5.5, 3.5],
    fogFar: 26,
    envIntensity: 0.5,
    skyZenith: "#2a3a52",
    skyHorizon: "#141c28",
  },
  contrast: {
    ambient: 0.28,
    ambientColor: "#c8d5ef",
    sun: 1.45,
    sunColor: "#fff1df",
    hemi: 0.2,
    hemiSky: "#9eb4d5",
    hemiGround: "#090d14",
    sunPos: [4.5, 7, 1.2],
    fogFar: 18,
    envIntensity: 0.2,
    skyZenith: "#0a1018",
    skyHorizon: "#05080c",
  },
  daylight: {
    ambient: 0.62,
    ambientColor: "#e8f2ff",
    sun: 1.18,
    sunColor: "#fffdf4",
    hemi: 0.52,
    hemiSky: "#b9dcf5",
    hemiGround: "#40515a",
    sunPos: [-3.5, 7.5, 4.5],
    fogFar: 30,
    envIntensity: 0.48,
    skyZenith: "#447ca8",
    skyHorizon: "#a7c5d2",
  },
  warm: {
    ambient: 0.42,
    ambientColor: "#ffd8c2",
    sun: 1.22,
    sunColor: "#ffb782",
    hemi: 0.3,
    hemiSky: "#856f8f",
    hemiGround: "#342a32",
    sunPos: [4.8, 4.2, 3.6],
    fogFar: 23,
    envIntensity: 0.32,
    skyZenith: "#35344f",
    skyHorizon: "#8b5361",
  },
  rim: {
    ambient: 0.3,
    ambientColor: "#d9e5ff",
    sun: 1.35,
    sunColor: "#8fe9ff",
    hemi: 0.28,
    hemiSky: "#86bcd1",
    hemiGround: "#151a26",
    sunPos: [-1.8, 5.2, -4.5],
    fogFar: 25,
    envIntensity: 0.25,
    skyZenith: "#182b3d",
    skyHorizon: "#243047",
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
  themeColor,
}: {
  segments: number;
  shadows: boolean;
  placeMode: boolean;
  themeColor: string;
}) {
  const accent = getXrAccentTokens(themeColor);
  return (
    <group position={[0, -0.02, 0]}>
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
          <meshStandardMaterial color={FLOOR} roughness={0.92} metalness={0.05} depthWrite={false} polygonOffset polygonOffsetFactor={1} polygonOffsetUnits={1} />
        ) : (
          <meshBasicMaterial color={FLOOR} depthWrite={false} polygonOffset polygonOffsetFactor={1} polygonOffsetUnits={1} />
        )}
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
        <ringGeometry args={[3.2, 3.32, Math.max(16, Math.floor(segments / 2))]} />
        <meshBasicMaterial color={accent.gridMajor} transparent opacity={0.4} side={THREE.FrontSide} />
      </mesh>
      {placeMode ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]} raycast={() => null}>
          <ringGeometry args={[7.6, 7.95, 48]} />
          <meshBasicMaterial color={accent.marker} transparent opacity={0.35} side={THREE.DoubleSide} />
        </mesh>
      ) : null}
    </group>
  );
}

/**
 * Owns MMD runtime (WebGL only), loads session assets once, advances timeline.
 */
export function MmdVrStageContent() {
  const { scene, camera, size, gl } = useThree();
  const mmdPrefs = useMmdVrStore((s) => s.prefs);
  const profile = getMmdVrRenderProfile(mmdPrefs);
  const lightPreset = mmdPrefs.lightPreset;
  const lightCfg = LIGHT_PRESETS[lightPreset] ?? LIGHT_PRESETS.stage;
  const viewDistance = mmdPrefs.viewDistance;
  const setPlaying = useMmdVrStore((s) => s.setPlaying);
  const setModels = useMmdVrStore((s) => s.setModels);
  const setDuration = useMmdVrStore((s) => s.setDuration);
  const setStatusLine = useMmdVrStore((s) => s.setStatusLine);
  const seekEpoch = useMmdVrStore((s) => s.seekEpoch);
  const seekSeconds = useMmdVrStore((s) => s.seekSeconds);
  const language = useLanguageStore((s) => s.language);

  const runtimeRef = useRef<MmdRuntimeHandle | null>(null);
  const timeRef = useRef(0);
  const physicsOnlyTimeRef = useRef(0);
  const physicsContactPollRef = useRef(0);
  const lastPhysicsResetEpochRef = useRef(0);
  const playingRef = useRef(false);
  const loopRef = useRef(false);
  const loadGenRef = useRef(0);
  const loadedKeyRef = useRef<string | null>(null);
  const sunRef = useRef<THREE.DirectionalLight>(null);
  const stopPlayingQueuedRef = useRef(false);
  const lastSeekEpochRef = useRef(0);
  const lightingKeyRef = useRef("");
  const lifecycleGenerationRef = useRef(0);
  const labelsRef = useRef({
    loading: "Loading…",
    failed: "Load failed",
    empty: "No model",
  });
  const placeMode = useMmdVrStore((s) => s.placeMode);
  const physicsEnabled = useMmdVrStore((s) => s.physicsEnabled);
  const physicsBusy = useMmdVrStore((s) => s.physicsBusy);
  const setPhysicsBusy = useMmdVrStore((s) => s.setPhysicsBusy);

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
    const handle = createMmdRuntimeHandle(scene, {
      webGpu: false,
      controllerColliders: getMmdVrControllerColliderMatrices,
      controllerCollidersEnabled: () => useMmdVrStore.getState().physicsControllerCollisions,
      controllerColliderRadius: () => useMmdVrStore.getState().physicsColliderRadius,
      physicsQuality: () => useMmdVrStore.getState().physicsQuality,
      prepareModel: prepareMmdVrModel,
    });
    runtimeRef.current = handle;
    return handle;
  }, [scene]);

  useEffect(() => {
    let cancelled = false;
    setPhysicsBusy(true);
    void runtime.setPhysicsEnabled(physicsEnabled).then(() => {
      if (!cancelled) {
        syncModelList();
      }
    }).catch((error) => {
      console.error("[mmdVr] physics toggle failed", error);
      if (!cancelled) useMmdVrStore.getState().setPhysicsEnabled(false);
    }).finally(() => {
      if (!cancelled) setPhysicsBusy(false);
    });
    return () => {
      cancelled = true;
    };
  }, [physicsEnabled, runtime, setPhysicsBusy]);

  useEffect(() => {
    const generation = ++lifecycleGenerationRef.current;
    return () => {
      queueMicrotask(() => {
        if (lifecycleGenerationRef.current !== generation) return;
        try {
          runtime.dispose();
        } catch {
          // ignore
        }
        if (runtimeRef.current === runtime) runtimeRef.current = null;
        loadedKeyRef.current = null;
      });
    };
  }, [runtime]);

  function applyLighting() {
    const sun = sunRef.current;
    if (!sun) return;
    const key = `${lightPreset}|${profile.shadows}|${sun.uuid}`;
    if (lightingKeyRef.current === key) return;
    lightingKeyRef.current = key;
    const cfg = LIGHT_PRESETS[useMmdVrStore.getState().prefs.lightPreset] ?? LIGHT_PRESETS.stage;
    sun.position.set(...cfg.sunPos);
    sun.intensity = cfg.sun;
    sun.color.set(cfg.sunColor);
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

  useLayoutEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;
    camera.far = viewDistance;
    camera.updateProjectionMatrix();
  }, [camera, viewDistance]);

  useLayoutEffect(() => {
    gl.toneMapping = THREE.LinearToneMapping;
    gl.toneMappingExposure = mmdPrefs.exposure;
  }, [gl, mmdPrefs.exposure]);

  function syncModelList() {
    const list = runtime.listModels().map((m) => ({
      id: m.id,
      name: m.name,
      visible: m.visible,
      scale: m.transform.scale,
      rotationY: m.transform.rotationY,
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
    queueMicrotask(() => void (async () => {
      if (cancelled || gen !== loadGenRef.current) return;
      try {
        let index = 0;
        const failures: string[] = [];
        for (const slot of slots) {
          if (cancelled || gen !== loadGenRef.current) return;
          const offsetX = (index - (slots.length - 1) / 2) * 1.1;
          try {
            const report = await runtime.addModel(slot.modelFile, slot.companionFiles, {
              physics: false,
              transform: { positionX: offsetX },
            });
            if (slot.bodyMotionFile) {
              try {
                await runtime.loadMotion(slot.bodyMotionFile, "body", report.modelId);
              } catch (error) {
                console.warn(`[mmdVr] body motion failed for ${slot.modelFile.name}`, error);
              }
            }
            if (slot.faceMotionFile) {
              try {
                await runtime.loadMotion(slot.faceMotionFile, "face", report.modelId);
              } catch (error) {
                console.warn(`[mmdVr] face motion failed for ${slot.modelFile.name}`, error);
              }
            }
          } catch (error) {
            failures.push(slot.modelFile.name);
            console.error(`[mmdVr] model load failed: ${slot.modelFile.name}`, error);
          }
          index += 1;
        }
        if (cancelled || gen !== loadGenRef.current) return;
        loadedKeyRef.current = loadKey;
        timeRef.current = 0;
        syncModelList();
        setStatusLine(failures.length ? `${labelsRef.current.failed}: ${failures.join(", ").slice(0, 36)}` : null);
        setMmdVrClockTime(0, true);
        if (runtime.duration > 0) setPlaying(true);
      } catch (err) {
        if (cancelled || gen !== loadGenRef.current) return;
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[mmdVr] load failed", err);
        setStatusLine(`${labelsRef.current.failed}: ${msg.slice(0, 28)}`);
        syncModelList();
      }
    })());

    return () => {
      cancelled = true;
    };
  }, [runtime, setDuration, setModels, setPlaying, setStatusLine]);

  useFrame((_, delta) => {
    applyLighting();

    const store = useMmdVrStore.getState();
    let modelTransformChanged = false;
    const removals = store.takeModelRemovals();
    if (removals.length) {
      for (const id of removals) runtime.removeModel(id);
      syncModelList();
    }
    const toggles = store.takeVisibilityToggles();
    if (toggles.length) {
      for (const id of toggles) {
        const entry = runtime.listModels().find((m) => m.id === id);
        if (entry) runtime.setModelVisible(id, !entry.visible);
      }
      syncModelList();
    }

    const place = store.physicsBusy ? null : store.takeGroundPlace();
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
        modelTransformChanged = true;
        if (store.placeModelId !== targetId) {
          store.setPlaceModelId(targetId);
        }
      }
    }

    const transformRequests = store.physicsBusy ? [] : store.takeModelTransformRequests();
    if (transformRequests.length) {
      const models = runtime.listModels();
      for (const request of transformRequests) {
        if (request.reset) {
          const index = models.findIndex((model) => model.id === request.id);
          const positionX = index >= 0 ? (index - (models.length - 1) / 2) * 1.1 : 0;
          runtime.setModelTransform(request.id, {
            positionX,
            positionY: 0,
            positionZ: 0,
            rotationX: 0,
            rotationY: 0,
            rotationZ: 0,
            scale: 1,
          });
          continue;
        }
        runtime.setModelTransform(request.id, {
          ...(request.scale == null ? {} : { scale: request.scale }),
          ...(request.rotationY == null ? {} : { rotationY: request.rotationY }),
        });
      }
      syncModelList();
      modelTransformChanged = true;
    }

    if (modelTransformChanged && store.physicsEnabled && !store.physicsBusy) {
      runtime.resetPhysics(timeRef.current);
    }
    if (store.physicsResetEpoch !== lastPhysicsResetEpochRef.current) {
      lastPhysicsResetEpochRef.current = store.physicsResetEpoch;
      if (store.physicsEnabled && !store.physicsBusy) runtime.resetPhysics(timeRef.current);
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
    if (store.physicsEnabled && !store.physicsBusy && duration <= 0) {
      physicsOnlyTimeRef.current += delta;
    } else if (!store.physicsEnabled) {
      physicsOnlyTimeRef.current = 0;
    }
    setMmdVrClockTime(timeRef.current);

    const perspective = camera as THREE.PerspectiveCamera;
    const aspect = size.width / Math.max(1, size.height);
    if (perspective.isPerspectiveCamera && Math.abs(perspective.aspect - aspect) > 1e-5) {
      perspective.aspect = aspect;
      perspective.updateProjectionMatrix();
    }
    const evaluationTime = duration > 0 ? timeRef.current : physicsOnlyTimeRef.current;
    rt.update(evaluationTime, physicsEnabled && !physicsBusy, perspective, aspect, false);
    physicsContactPollRef.current += delta;
    if (physicsContactPollRef.current >= 0.1) {
      physicsContactPollRef.current = 0;
      if (!store.physicsDebugEnabled && !store.physicsHapticsEnabled) return;
      const contactCount = store.physicsEnabled && !store.physicsBusy ? rt.getControllerContactCount() : 0;
      if (contactCount !== store.physicsContactCount) store.setPhysicsContactCount(contactCount);
      if (store.physicsHapticsEnabled) {
        const controllerCounts: [number, number] = store.physicsEnabled && !store.physicsBusy
          ? [rt.getControllerContactCount(0), rt.getControllerContactCount(1)]
          : [0, 0];
        if (controllerCounts[0] !== store.physicsControllerContactCounts[0]
          || controllerCounts[1] !== store.physicsControllerContactCounts[1]) {
          store.setPhysicsControllerContactCounts(controllerCounts);
        }
      }
      if (!store.physicsDebugEnabled) return;
      const dynamicBodyCount = store.physicsEnabled && !store.physicsBusy ? rt.getDynamicRigidBodyCount() : 0;
      if (dynamicBodyCount !== store.physicsDynamicBodyCount) store.setPhysicsDynamicBodyCount(dynamicBodyCount);
      const rigidBodyCount = store.physicsEnabled && !store.physicsBusy ? rt.getRigidBodyCount() : 0;
      const stepCount = store.physicsEnabled && !store.physicsBusy ? rt.getPhysicsStepCount() : 0;
      if (rigidBodyCount !== store.physicsRigidBodyCount || stepCount !== store.physicsStepCount) {
        store.setPhysicsRuntimeStats(rigidBodyCount, stepCount);
      }
    }
  });

  return (
    <>
      <color attach="background" args={[STAGE_BG]} />
      <fog attach="fog" args={[STAGE_BG, Math.min(10, viewDistance * 0.45), viewDistance]} />
      <StageSky zenith={lightCfg.skyZenith} horizon={lightCfg.skyHorizon} />
      <ambientLight color={lightCfg.ambientColor} intensity={lightCfg.ambient} />
      <directionalLight
        ref={sunRef}
        position={lightCfg.sunPos}
        color={lightCfg.sunColor}
        intensity={lightCfg.sun}
        castShadow={profile.shadows}
        shadow-mapSize-width={profile.shadows ? profile.shadowMapSize : 256}
        shadow-mapSize-height={profile.shadows ? profile.shadowMapSize : 256}
        shadow-camera-near={0.5}
        shadow-camera-far={24}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
      />
      <hemisphereLight args={[lightCfg.hemiSky, lightCfg.hemiGround, lightCfg.hemi]} />
      <StageFloor
        segments={profile.floorSegments}
        shadows={profile.shadows}
        placeMode={placeMode}
        themeColor={mmdPrefs.themeColor}
      />
      {profile.showGrid ? (
        <gridHelper
          args={[12, 12, getXrAccentTokens(mmdPrefs.themeColor).gridMajor, getXrAccentTokens(mmdPrefs.themeColor).gridMinor]}
          position={[0, 0.01, 0]}
        />
      ) : null}
    </>
  );
}
