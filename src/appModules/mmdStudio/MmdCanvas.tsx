import { ContactShadows, Grid, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import {
  createMmdRuntimeHandle,
  type MmdLoadReport,
  type MmdMotionSlot,
  type RuntimeModelSnapshot,
} from "./mmdRuntime";
import { MmdPostFx } from "./MmdPostFx";
import { MmdSky } from "./MmdSky";
import { useMmdStudioStore, type MmdPostFxPreset, type MmdRendererBackend, type MmdSceneModel } from "./mmdStudioStore";
import { sunPositionFromAngles } from "./mmdProjectDb";
import type { MmdProjectModelAssets } from "./mmdRuntime";

export type MmdSceneApi = {
  addModel: (modelFile: File, companionFiles?: File[], options?: { physics?: boolean; offsetX?: number; preferredId?: string }) => Promise<MmdLoadReport>;
  removeModel: (id: string) => void;
  selectModel: (id: string | null) => void;
  setModelVisible: (id: string, visible: boolean) => void;
  loadMotion: (file: File, slot?: MmdMotionSlot, modelId?: string | null) => Promise<void>;
  setMorphWeight: (modelId: string, morphName: string, weight: number) => void;
  setMaterialVisible: (modelId: string, materialName: string, visible: boolean) => void;
  listModels: () => RuntimeModelSnapshot[];
  exportProjectModels: () => MmdProjectModelAssets[];
  clearScene: () => void;
  setPhysicsEnabled: (enabled: boolean) => Promise<void>;
  getCanvas: () => HTMLCanvasElement | null;
  startRecording: (options: {
    fps: number;
    audio: HTMLAudioElement | null;
    includeAudio?: boolean;
    videoBitsPerSecond?: number;
    mimeType?: string;
  }) => MediaRecorder | null;
  stopRecording: () => Promise<Blob | null>;
};

type Props = {
  backend: MmdRendererBackend;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  apiRef: React.MutableRefObject<MmdSceneApi | null>;
};

const DEFAULT_CAM_POS = new THREE.Vector3(0, 12, 28);
const DEFAULT_CAM_TARGET = new THREE.Vector3(0, 9, 0);
const ROTATE_SPEED = 1.6;

type KeyMap = {
  w: boolean;
  a: boolean;
  s: boolean;
  d: boolean;
  f: boolean;
  c: boolean;
  q: boolean;
  e: boolean;
};

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

function snapshotToStore(models: RuntimeModelSnapshot[]): MmdSceneModel[] {
  return models.map((item) => ({
    id: item.id,
    name: item.name,
    visible: item.visible,
    morphNames: item.morphNames,
    materialNames: item.materialNames,
    bodyMotionName: item.bodyMotionName,
    faceMotionName: item.faceMotionName,
    morphWeights: item.morphWeights,
    materialVisible: item.materialVisible,
  }));
}

function StudioScene({ audioRef, apiRef }: Omit<Props, "backend">) {
  const { scene, camera, gl, size } = useThree();
  const runtime = useMemo(() => createMmdRuntimeHandle(scene), [scene]);
  const controls = useRef<any>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const audioDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const captureStreamRef = useRef<MediaStream | null>(null);
  const keysRef = useRef<KeyMap>({ w: false, a: false, s: false, d: false, f: false, c: false, q: false, e: false });
  const forward = useMemo(() => new THREE.Vector3(), []);
  const right = useMemo(() => new THREE.Vector3(), []);
  const move = useMemo(() => new THREE.Vector3(), []);
  const offset = useMemo(() => new THREE.Vector3(), []);
  const playing = useMmdStudioStore((state) => state.playing);
  const speed = useMmdStudioStore((state) => state.speed);
  const cameraMoveSpeed = useMmdStudioStore((state) => state.cameraMoveSpeed);
  const loop = useMmdStudioStore((state) => state.loop);
  const physicsEnabled = useMmdStudioStore((state) => state.physicsEnabled);
  const cameraMode = useMmdStudioStore((state) => state.cameraMode);
  const duration = useMmdStudioStore((state) => state.duration);
  const recording = useMmdStudioStore((state) => state.recording);
  const backend = useMmdStudioStore((state) => state.backend);
  const postFxRaw = useMmdStudioStore((state) => state.postFx);
  const postFx: MmdPostFxPreset = backend === "webgl" ? postFxRaw : "off";
  const showGrid = useMmdStudioStore((state) => state.showGrid);
  const skyMode = useMmdStudioStore((state) => state.skyMode);
  const skyAsBackground = useMmdStudioStore((state) => state.skyAsBackground);
  const lights = useMmdStudioStore((state) => state.lights);
  const setCurrentTime = useMmdStudioStore((state) => state.setCurrentTime);
  const setPlaying = useMmdStudioStore((state) => state.setPlaying);
  const setDuration = useMmdStudioStore((state) => state.setDuration);
  const setCameraMode = useMmdStudioStore((state) => state.setCameraMode);
  const setStatus = useMmdStudioStore((state) => state.setStatus);
  const setPhysicsReady = useMmdStudioStore((state) => state.setPhysicsReady);
  const setModels = useMmdStudioStore((state) => state.setModels);
  const setSelectedModelId = useMmdStudioStore((state) => state.setSelectedModelId);
  const timeRef = useRef(0);
  const lastUiTimeRef = useRef(-1);

  function syncModels(selectedId?: string | null) {
    const list = runtime.listModels();
    setModels(snapshotToStore(list), selectedId !== undefined ? selectedId : runtime.selectedId);
    setDuration(runtime.duration);
  }

  useEffect(() => {
    apiRef.current = {
      addModel: async (modelFile, companionFiles = [], options = {}) => {
        setStatus("loading");
        try {
          const report = await runtime.addModel(
            modelFile,
            companionFiles.length ? companionFiles : [modelFile],
            { physics: options.physics ?? useMmdStudioStore.getState().physicsEnabled },
          );
          setPhysicsReady(Boolean(options.physics ?? useMmdStudioStore.getState().physicsEnabled));
          syncModels(report.modelId);
          setStatus("ready");
          return report;
        } catch (error) {
          setStatus("error", error instanceof Error ? error.message : String(error));
          throw error;
        }
      },
      removeModel: (id) => {
        runtime.removeModel(id);
        syncModels(runtime.selectedId);
        if (!runtime.listModels().length) setStatus("idle");
      },
      selectModel: (id) => {
        runtime.selectModel(id);
        setSelectedModelId(id);
      },
      setModelVisible: (id, visible) => {
        runtime.setModelVisible(id, visible);
        syncModels();
      },
      loadMotion: async (file, slot = "body", modelId = null) => {
        setStatus("loading");
        try {
          await runtime.loadMotion(file, slot, modelId);
          setDuration(runtime.duration);
          if (runtime.hasCameraTrack) setCameraMode("motion");
          timeRef.current = 0;
          lastUiTimeRef.current = 0;
          setCurrentTime(0);
          syncModels();
          setStatus("ready");
        } catch (error) {
          setStatus("error", error instanceof Error ? error.message : String(error));
          throw error;
        }
      },
      setMorphWeight: (modelId, morphName, weight) => {
        runtime.setMorphWeight(modelId, morphName, weight);
        const state = useMmdStudioStore.getState();
        const model = state.models.find((item) => item.id === modelId);
        if (!model) return;
        const morphWeights = { ...model.morphWeights };
        if (weight <= 0.001) delete morphWeights[morphName];
        else morphWeights[morphName] = weight;
        state.patchModel(modelId, { morphWeights });
      },
      setMaterialVisible: (modelId, materialName, visible) => {
        runtime.setMaterialVisible(modelId, materialName, visible);
        const state = useMmdStudioStore.getState();
        const model = state.models.find((item) => item.id === modelId);
        if (!model) return;
        state.patchModel(modelId, {
          materialVisible: { ...model.materialVisible, [materialName]: visible },
        });
      },
      listModels: () => runtime.listModels(),
      exportProjectModels: () => runtime.exportProjectModels(),
      clearScene: () => {
        runtime.clearAll();
        syncModels(null);
        setStatus("idle");
      },
      setPhysicsEnabled: async (enabled) => {
        setStatus("loading");
        try {
          await runtime.setPhysicsEnabled(enabled);
          setPhysicsReady(enabled);
          syncModels(runtime.selectedId);
          setStatus("ready");
        } catch (error) {
          setPhysicsReady(false);
          setStatus("error", error instanceof Error ? error.message : String(error));
          throw error;
        }
      },
      getCanvas: () => gl.domElement,
      startRecording: ({ fps, audio, includeAudio = true, videoBitsPerSecond = 8_000_000, mimeType }) => {
        try {
          const stream = gl.domElement.captureStream(fps);
          captureStreamRef.current = stream;
          if (includeAudio && audio) {
            try {
              if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
                audioCtxRef.current = new AudioContext();
                audioSourceRef.current = null;
                audioDestRef.current = null;
              }
              const ctx = audioCtxRef.current;
              if (ctx.state === "suspended") void ctx.resume();
              if (!audioSourceRef.current) {
                audioSourceRef.current = ctx.createMediaElementSource(audio);
                audioDestRef.current = ctx.createMediaStreamDestination();
                audioSourceRef.current.connect(audioDestRef.current);
                audioSourceRef.current.connect(ctx.destination);
              }
              const dest = audioDestRef.current;
              if (dest) dest.stream.getAudioTracks().forEach((track) => stream.addTrack(track));
            } catch {
              // video only
            }
          }
          const resolvedMime =
            mimeType
            || (MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
              ? "video/webm;codecs=vp9"
              : MediaRecorder.isTypeSupported("video/webm;codecs=vp8")
                ? "video/webm;codecs=vp8"
                : "video/webm");
          const recorder = new MediaRecorder(stream, {
            mimeType: resolvedMime,
            videoBitsPerSecond,
          });
          chunksRef.current = [];
          recorder.ondataavailable = (event) => {
            if (event.data.size) chunksRef.current.push(event.data);
          };
          recorder.start(200);
          recorderRef.current = recorder;
          return recorder;
        } catch {
          captureStreamRef.current?.getTracks().forEach((track) => {
            if (track.kind === "video") track.stop();
          });
          captureStreamRef.current = null;
          return null;
        }
      },
      stopRecording: () => new Promise((resolve) => {
        const recorder = recorderRef.current;
        if (!recorder) {
          resolve(null);
          return;
        }
        const finish = () => {
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "video/webm" });
          chunksRef.current = [];
          recorderRef.current = null;
          const stream = captureStreamRef.current;
          if (stream) {
            stream.getTracks().forEach((track) => {
              if (track.kind === "video") track.stop();
            });
            captureStreamRef.current = null;
          }
          resolve(blob);
        };
        recorder.onstop = finish;
        if (recorder.state !== "inactive") recorder.stop();
        else finish();
      }),
    };

    return () => {
      apiRef.current = null;
      try {
        if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
      } catch {
        // ignore
      }
      captureStreamRef.current?.getTracks().forEach((track) => {
        if (track.kind === "video") track.stop();
      });
      captureStreamRef.current = null;
      runtime.dispose();
      setModels([], null);
    };
  }, [apiRef, gl, runtime, setCameraMode, setCurrentTime, setDuration, setModels, setPhysicsReady, setSelectedModelId, setStatus]);

  useEffect(() => {
    const canvas = gl.domElement;
    canvas.tabIndex = 0;
    canvas.style.outline = "none";

    function setKey(code: string, pressed: boolean) {
      const keys = keysRef.current;
      if (code === "KeyW") keys.w = pressed;
      else if (code === "KeyA") keys.a = pressed;
      else if (code === "KeyS") keys.s = pressed;
      else if (code === "KeyD") keys.d = pressed;
      else if (code === "KeyF") keys.f = pressed;
      else if (code === "KeyC") keys.c = pressed;
      else if (code === "KeyQ") keys.q = pressed;
      else if (code === "KeyE") keys.e = pressed;
    }

    function resetCamera() {
      const perspective = camera as THREE.PerspectiveCamera;
      perspective.position.copy(DEFAULT_CAM_POS);
      perspective.up.set(0, 1, 0);
      perspective.lookAt(DEFAULT_CAM_TARGET);
      if (controls.current) {
        controls.current.target.copy(DEFAULT_CAM_TARGET);
        controls.current.update();
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (isTypingTarget(event.target)) return;
      if (useMmdStudioStore.getState().cameraMode !== "free") return;
      if (event.code === "KeyR" && !event.repeat) {
        event.preventDefault();
        resetCamera();
        return;
      }
      if (["KeyW", "KeyA", "KeyS", "KeyD", "KeyF", "KeyC", "KeyQ", "KeyE"].includes(event.code)) {
        event.preventDefault();
        setKey(event.code, true);
      }
    }

    function onKeyUp(event: KeyboardEvent) {
      setKey(event.code, false);
    }

    function onBlur() {
      keysRef.current = { w: false, a: false, s: false, d: false, f: false, c: false, q: false, e: false };
    }

    function onPointerDown() {
      canvas.focus({ preventScroll: true });
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    canvas.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      canvas.removeEventListener("pointerdown", onPointerDown);
    };
  }, [camera, gl]);

  useFrame((_, delta) => {
    const state = useMmdStudioStore.getState();
    const rangeEnd = state.exportOut > 0 ? Math.min(state.exportOut, duration || state.exportOut) : duration;
    const perspective = camera as THREE.PerspectiveCamera;
    const useMotionCamera = cameraMode === "motion" && runtime.hasCameraTrack;

    if (cameraMode === "free" && !useMotionCamera) {
      const keys = keysRef.current;
      const orbit = controls.current;
      const target: THREE.Vector3 = orbit?.target ?? DEFAULT_CAM_TARGET;

      perspective.getWorldDirection(forward);
      forward.y = 0;
      if (forward.lengthSq() < 1e-6) forward.set(0, 0, -1);
      else forward.normalize();
      right.crossVectors(forward, perspective.up).normalize();

      move.set(0, 0, 0);
      if (keys.w) move.add(forward);
      if (keys.s) move.sub(forward);
      if (keys.d) move.add(right);
      if (keys.a) move.sub(right);
      if (keys.f) move.y += 1;
      if (keys.c) move.y -= 1;
      if (move.lengthSq() > 0) {
        move.normalize().multiplyScalar(cameraMoveSpeed * delta);
        perspective.position.add(move);
        target.add(move);
      }

      const yaw = (Number(keys.q) - Number(keys.e)) * ROTATE_SPEED * delta;
      if (Math.abs(yaw) > 0) {
        offset.copy(target).sub(perspective.position);
        offset.applyAxisAngle(perspective.up, yaw);
        target.copy(perspective.position).add(offset);
      }

      if (orbit) orbit.update();
    }

    if (playing) {
      const audio = audioRef.current;
      if (audio && !audio.paused && Number.isFinite(audio.currentTime)) {
        timeRef.current = audio.currentTime;
      } else {
        timeRef.current += delta * speed;
      }

      const endLimit = recording && rangeEnd > 0 ? rangeEnd : duration;
      if (endLimit > 0 && timeRef.current >= endLimit) {
        if (recording) {
          timeRef.current = endLimit;
          setPlaying(false);
          if (audio) audio.pause();
        } else if (loop) {
          timeRef.current = 0;
          if (audio) audio.currentTime = 0;
        } else {
          timeRef.current = endLimit;
          setPlaying(false);
          if (audio) audio.pause();
        }
      }
      if (Math.abs(timeRef.current - lastUiTimeRef.current) >= 0.05) {
        lastUiTimeRef.current = timeRef.current;
        setCurrentTime(timeRef.current);
      }
    } else {
      timeRef.current = state.currentTime;
    }

    if (controls.current) controls.current.enabled = !useMotionCamera;
    runtime.update(timeRef.current, physicsEnabled, perspective, size.width / Math.max(1, size.height), useMotionCamera);
  });

  useEffect(() => {
    const unsub = useMmdStudioStore.subscribe((state, prev) => {
      if (state.currentTime !== prev.currentTime && !state.playing) {
        timeRef.current = state.currentTime;
        lastUiTimeRef.current = state.currentTime;
      }
    });
    return unsub;
  }, []);

  const sunPos = useMemo(
    () => sunPositionFromAngles(lights.sunAzimuth, lights.sunElevation),
    [lights.sunAzimuth, lights.sunElevation],
  );

  return (
    <>
      {skyMode === "solid" || !skyAsBackground ? <color attach="background" args={["#0e1118"]} /> : null}
      <MmdSky />
      <ambientLight intensity={lights.ambientIntensity} />
      <directionalLight
        position={sunPos}
        intensity={lights.sunIntensity}
        castShadow={lights.sunCastShadow}
      />
      {showGrid ? (
        <Grid infiniteGrid fadeDistance={80} sectionColor="#3a4254" cellColor="#2a3140" position={[0, 0, 0]} />
      ) : null}
      <ContactShadows opacity={0.35} scale={40} blur={2.5} far={20} resolution={256} color="#000000" />
      <OrbitControls
        ref={controls}
        makeDefault
        target={[0, 9, 0]}
        minDistance={2}
        maxDistance={120}
        maxPolarAngle={Math.PI * 0.49}
      />
      {backend === "webgl" && postFx !== "off" ? (
        <Suspense fallback={null}>
          <MmdPostFx preset={postFx} />
        </Suspense>
      ) : null}
    </>
  );
}

export function MmdCanvas({ backend, audioRef, apiRef }: Props) {
  const webgpuAvailable = useMmdStudioStore((state) => state.webgpuAvailable);
  const setBackend = useMmdStudioStore((state) => state.setBackend);
  const setWebgpuAvailable = useMmdStudioStore((state) => state.setWebgpuAvailable);

  useEffect(() => {
    let cancelled = false;
    async function probe() {
      const nav = navigator as Navigator & { gpu?: { requestAdapter: () => Promise<unknown> } };
      if (!nav.gpu) {
        setWebgpuAvailable(false);
        if (backend === "webgpu") setBackend("webgl");
        return;
      }
      try {
        const adapter = await nav.gpu.requestAdapter();
        if (cancelled) return;
        setWebgpuAvailable(Boolean(adapter));
        if (!adapter && backend === "webgpu") setBackend("webgl");
      } catch {
        if (!cancelled) {
          setWebgpuAvailable(false);
          if (backend === "webgpu") setBackend("webgl");
        }
      }
    }
    void probe();
    return () => {
      cancelled = true;
    };
  }, [backend, setBackend, setWebgpuAvailable]);

  const gl = useMemo(() => {
    if (backend !== "webgpu") {
      return {
        antialias: true,
        powerPreference: "high-performance" as const,
        preserveDrawingBuffer: true,
      };
    }
    return async (props: ConstructorParameters<typeof THREE.WebGLRenderer>[0]) => {
      const mod = await import("three/webgpu");
      const renderer = new mod.WebGPURenderer({
        ...(props as object),
        antialias: true,
        powerPreference: "high-performance",
      } as ConstructorParameters<typeof mod.WebGPURenderer>[0]);
      await renderer.init();
      return renderer;
    };
  }, [backend]);

  if (backend === "webgpu" && !webgpuAvailable) {
    return <div className="mmd-canvas-fallback">WebGPU unavailable</div>;
  }

  return (
    <Canvas
      key={backend}
      className="mmd-canvas"
      shadows="percentage"
      dpr={[1, 1.75]}
      camera={{ position: [0, 12, 28], fov: 40, near: 0.1, far: 500 }}
      gl={gl as any}
      onCreated={({ gl: renderer }) => {
        renderer.setClearColor("#0e1118");
      }}
    >
      <StudioScene audioRef={audioRef} apiRef={apiRef} />
    </Canvas>
  );
}
