import { Grid, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import {
  createMmdRuntimeHandle,
  type MmdAddModelOptions,
  type MmdLoadReport,
  type MmdModelTransform,
  type MmdMotionSlot,
  type MmdProjectModelAssets,
  type MaterialOverride,
  type RuntimeModelSnapshot,
} from "./mmdRuntime";
import { hydrateMmdModels, projectAssetsToHydrateInput } from "./mmdSceneHydrate";
import { MmdPostFx } from "./MmdPostFx";
import { MmdSky } from "./MmdSky";
import { useMmdStudioStore, type MmdPostFxPreset, type MmdRendererBackend, type MmdSceneModel } from "./mmdStudioStore";
import { sunPositionFromAngles } from "./mmdProjectDb";

export type MmdSceneApi = {
  addModel: (modelFile: File, companionFiles?: File[], options?: MmdAddModelOptions) => Promise<MmdLoadReport>;
  removeModel: (id: string) => void;
  selectModel: (id: string | null) => void;
  setModelVisible: (id: string, visible: boolean) => void;
  setModelTransform: (id: string, patch: Partial<MmdModelTransform>) => void;
  loadMotion: (file: File, slot?: MmdMotionSlot, modelId?: string | null) => Promise<void>;
  setMorphWeight: (modelId: string, morphName: string, weight: number) => void;
  setMaterialVisible: (modelId: string, materialName: string, visible: boolean) => void;
  setMaterialOverride: (modelId: string, materialName: string, patch: Partial<MaterialOverride>) => void;
  listModels: () => RuntimeModelSnapshot[];
  exportProjectModels: () => MmdProjectModelAssets[];
  clearScene: () => void;
  /** Rebuild models into a fresh runtime (e.g. after WebGL/WebGPU canvas remount). */
  restoreScene: (models: MmdProjectModelAssets[], options?: { physics?: boolean; selectedId?: string | null }) => Promise<void>;
  setPhysicsEnabled: (enabled: boolean) => Promise<void>;
  getCanvas: () => HTMLCanvasElement | null;
  setRecordingCanvasSize: (width: number, height: number) => void;
  restoreRecordingCanvasSize: () => void;
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
  /** When true, unmount keeps store models (backend remount + restore). */
  preserveModelsOnUnmount?: boolean;
};

const DEFAULT_CAM_POS = new THREE.Vector3(0, 16, 62);
const DEFAULT_CAM_TARGET = new THREE.Vector3(0, 9, 0);
const KEYBOARD_YAW_SPEED = 1.6;

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
    morphFavorites: item.morphFavorites,
    materialVisible: item.materialVisible,
    materialOverrides: item.materialOverrides,
    transform: item.transform,
  }));
}

function StudioScene({ audioRef, apiRef, preserveModelsOnUnmount = false, backend }: Props) {
  const { scene, camera, gl, size } = useThree();
  const runtime = useMemo(
    () => createMmdRuntimeHandle(scene, { webGpu: backend === "webgpu" }),
    [backend, scene],
  );
  const preserveModelsRef = useRef(preserveModelsOnUnmount);
  preserveModelsRef.current = preserveModelsOnUnmount;
  const controls = useRef<any>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const audioDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const captureStreamRef = useRef<MediaStream | null>(null);
  const recordingCanvasStateRef = useRef<{ width: number; height: number; pixelRatio: number } | null>(null);
  const keysRef = useRef<KeyMap>({ w: false, a: false, s: false, d: false, f: false, c: false, q: false, e: false });
  const forward = useMemo(() => new THREE.Vector3(), []);
  const right = useMemo(() => new THREE.Vector3(), []);
  const move = useMemo(() => new THREE.Vector3(), []);
  const offset = useMemo(() => new THREE.Vector3(), []);
  const playing = useMmdStudioStore((state) => state.playing);
  const speed = useMmdStudioStore((state) => state.speed);
  const cameraMoveSpeed = useMmdStudioStore((state) => state.cameraMoveSpeed);
  const cameraRotateSpeed = useMmdStudioStore((state) => state.cameraRotateSpeed);
  const loop = useMmdStudioStore((state) => state.loop);
  const physicsEnabled = useMmdStudioStore((state) => state.physicsEnabled);
  const cameraMode = useMmdStudioStore((state) => state.cameraMode);
  const duration = useMmdStudioStore((state) => state.duration);
  const recording = useMmdStudioStore((state) => state.recording);
  const postFxRaw = useMmdStudioStore((state) => state.postFx);
  const postFx: MmdPostFxPreset = backend === "webgl" ? postFxRaw : "off";
  const showGrid = useMmdStudioStore((state) => state.showGrid);
  const skyMode = useMmdStudioStore((state) => state.skyMode);
  const skyAsBackground = useMmdStudioStore((state) => state.skyAsBackground);
  const skyAsEnvironment = useMmdStudioStore((state) => state.skyAsEnvironment);
  const envIntensity = useMmdStudioStore((state) => state.envIntensity);
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
            {
              physics: options.physics ?? useMmdStudioStore.getState().physicsEnabled,
              preferredId: options.preferredId,
              transform: options.transform,
              offsetX: options.offsetX,
            },
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
      setModelTransform: (id, patch) => {
        runtime.setModelTransform(id, patch);
        const state = useMmdStudioStore.getState();
        const model = state.models.find((item) => item.id === id);
        if (!model) return;
        state.patchModel(id, {
          transform: { ...model.transform, ...patch },
        });
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
      setMaterialOverride: (modelId, materialName, patch) => {
        runtime.setMaterialOverride(modelId, materialName, patch);
        const state = useMmdStudioStore.getState();
        const model = state.models.find((item) => item.id === modelId);
        if (!model) return;
        state.patchModel(modelId, {
          materialOverrides: {
            ...model.materialOverrides,
            [materialName]: { ...model.materialOverrides[materialName], ...patch },
          },
        });
      },
      listModels: () => runtime.listModels(),
      exportProjectModels: () => runtime.exportProjectModels(),
      clearScene: () => {
        runtime.clearAll();
        syncModels(null);
        setStatus("idle");
      },
      restoreScene: async (models, options = {}) => {
        setStatus("loading");
        try {
          const physics = options.physics ?? useMmdStudioStore.getState().physicsEnabled;
          const selected = await hydrateMmdModels(
            {
              clearScene: () => {
                runtime.clearAll();
              },
              addModel: (modelFile, companionFiles = [], addOptions = {}) =>
                runtime.addModel(modelFile, companionFiles, addOptions),
              setModelVisible: (id, visible) => runtime.setModelVisible(id, visible),
              setModelTransform: (id, patch) => runtime.setModelTransform(id, patch),
              loadMotion: (file, slot, modelId) => runtime.loadMotion(file, slot, modelId),
              setMorphWeight: (modelId, morphName, weight) => runtime.setMorphWeight(modelId, morphName, weight),
              setMaterialVisible: (modelId, materialName, visible) =>
                runtime.setMaterialVisible(modelId, materialName, visible),
              setMaterialOverride: (modelId, materialName, patch) =>
                runtime.setMaterialOverride(modelId, materialName, patch),
              selectModel: (id) => runtime.selectModel(id),
              listModels: () => runtime.listModels(),
            },
            projectAssetsToHydrateInput(models),
            { physics, selectedId: options.selectedId, clearFirst: true },
          );
          setPhysicsReady(physics);
          syncModels(selected);
          setStatus(models.length ? "ready" : "idle");
        } catch (error) {
          setStatus("error", error instanceof Error ? error.message : String(error));
          throw error;
        }
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
      setRecordingCanvasSize: (width, height) => {
        if (!recordingCanvasStateRef.current) {
          recordingCanvasStateRef.current = {
            width: gl.domElement.width,
            height: gl.domElement.height,
            pixelRatio: gl.getPixelRatio(),
          };
        }
        gl.setPixelRatio(1);
        gl.setSize(width, height, false);
      },
      restoreRecordingCanvasSize: () => {
        const previous = recordingCanvasStateRef.current;
        if (!previous) return;
        gl.setPixelRatio(previous.pixelRatio);
        gl.setSize(previous.width, previous.height, false);
        recordingCanvasStateRef.current = null;
      },
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
      // Explicitly release GPU resources before remounting another backend.
      try {
        (gl as THREE.WebGLRenderer).forceContextLoss?.();
      } catch {
        // ignore
      }
      try {
        gl.dispose?.();
      } catch {
        // ignore
      }
      if (!preserveModelsRef.current) setModels([], null);
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

      const yaw = (Number(keys.q) - Number(keys.e)) * KEYBOARD_YAW_SPEED * cameraRotateSpeed * delta;
      if (Math.abs(yaw) > 0) {
        offset.copy(target).sub(perspective.position);
        offset.applyAxisAngle(perspective.up, yaw);
        target.copy(perspective.position).add(offset);
      }

      if (orbit) {
        orbit.rotateSpeed = cameraRotateSpeed;
        orbit.update();
      }
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
    () => sunPositionFromAngles(lights.sunAzimuth, lights.sunElevation, lights.sunDistance),
    [lights.sunAzimuth, lights.sunDistance, lights.sunElevation],
  );
  // WebGPU NodeBuilder rejects MeshDepthMaterial / ShaderMaterial used by
  // drei Grid and classic shadow-map depth passes.
  const isWebGpu = backend === "webgpu";
  const mapShadows = !isWebGpu && lights.shadowMode !== "off";
  const sunEnabled = lights.sunIntensity > 0.0001;
  const shadowsActive = mapShadows && sunEnabled;
  const shadowCam = lights.shadowCameraSize;
  // Ortho volume centered on stage origin; far must contain the light distance.
  const shadowNear = 1;
  const shadowFar = Math.max(80, lights.sunDistance + shadowCam * 2);
  // Receiver matches the ortho footprint (±shadowCam on XZ).
  const groundSize = Math.max(20, shadowCam * 2);
  const dirLightRef = useRef<THREE.DirectionalLight>(null);
  const shadowMapSizeRef = useRef(lights.shadowMapSize);
  const webGpuGrid = useMemo(() => {
    const helper = new THREE.GridHelper(80, 40, "#3a4254", "#2a3140");
    helper.position.y = 0;
    helper.frustumCulled = false;
    return helper;
  }, []);

  useEffect(() => {
    if (!gl.shadowMap) return;
    gl.shadowMap.enabled = shadowsActive;
    gl.shadowMap.type = THREE.PCFShadowMap;
    gl.shadowMap.autoUpdate = true;
    gl.shadowMap.needsUpdate = true;
  }, [gl, lights.shadowMapSize, shadowsActive]);

  useEffect(() => {
    const light = dirLightRef.current;
    if (!light) return;

    // Target must be in the scene graph so shadow matrices stay correct.
    if (light.target.parent !== scene) {
      scene.add(light.target);
    }
    light.target.position.set(0, 0, 0);
    light.target.updateMatrixWorld(true);

    light.visible = sunEnabled;
    light.intensity = lights.sunIntensity;
    light.castShadow = shadowsActive;
    light.position.set(sunPos[0], sunPos[1], sunPos[2]);

    const prevMapSize = shadowMapSizeRef.current;
    light.shadow.mapSize.set(lights.shadowMapSize, lights.shadowMapSize);
    light.shadow.bias = lights.shadowBias;
    light.shadow.normalBias = lights.shadowNormalBias;
    light.shadow.radius = lights.shadowRadius;

    const cam = light.shadow.camera;
    cam.near = shadowNear;
    cam.far = shadowFar;
    cam.left = -shadowCam;
    cam.right = shadowCam;
    cam.top = shadowCam;
    cam.bottom = -shadowCam;
    cam.updateProjectionMatrix();

    // Only rebuild the shadow RT when resolution changes (avoids flicker thrash).
    if (prevMapSize !== lights.shadowMapSize && light.shadow.map) {
      light.shadow.map.dispose();
      light.shadow.map = null as unknown as THREE.WebGLRenderTarget;
    }
    shadowMapSizeRef.current = lights.shadowMapSize;
    light.shadow.needsUpdate = true;

    runtime.setLighting({
      envIntensity: skyAsEnvironment && skyMode === "hdr" ? envIntensity : 0,
      directionalLight: light,
    });
  }, [
    envIntensity,
    lights.shadowBias,
    lights.shadowCameraSize,
    lights.shadowMapSize,
    lights.shadowNormalBias,
    lights.shadowRadius,
    lights.sunIntensity,
    runtime,
    scene,
    shadowCam,
    shadowFar,
    shadowNear,
    shadowsActive,
    skyAsEnvironment,
    skyMode,
    sunEnabled,
    sunPos,
  ]);

  return (
    <>
      {skyMode === "solid" || !skyAsBackground ? <color attach="background" args={["#0e1118"]} /> : null}
      <MmdSky />
      <ambientLight intensity={lights.ambientIntensity} />
      <directionalLight
        ref={dirLightRef}
        position={sunPos}
        intensity={lights.sunIntensity}
        visible={sunEnabled}
        castShadow={shadowsActive}
        shadow-mapSize={[lights.shadowMapSize, lights.shadowMapSize]}
        shadow-bias={lights.shadowBias}
        shadow-normalBias={lights.shadowNormalBias}
        shadow-radius={lights.shadowRadius}
        shadow-camera-near={shadowNear}
        shadow-camera-far={shadowFar}
        shadow-camera-left={-shadowCam}
        shadow-camera-right={shadowCam}
        shadow-camera-top={shadowCam}
        shadow-camera-bottom={-shadowCam}
      />
      {/* Ground is the only shadow receiver. Models cast only. */}
      {shadowsActive && lights.groundShadowOpacity > 0.001 ? (
        <mesh
          key={`shadow-ground-${groundSize}`}
          name="mmd-shadow-ground"
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0, 0]}
          receiveShadow
          castShadow={false}
          renderOrder={-20}
          frustumCulled={false}
        >
          <planeGeometry args={[groundSize, groundSize]} />
          <shadowMaterial
            transparent
            opacity={Math.min(0.7, Math.max(0, lights.groundShadowOpacity))}
            depthWrite={false}
            depthTest
            toneMapped={false}
          />
        </mesh>
      ) : null}
      {showGrid ? (
        isWebGpu ? (
          <primitive object={webGpuGrid} />
        ) : (
          <Grid infiniteGrid fadeDistance={80} sectionColor="#3a4254" cellColor="#2a3140" position={[0, 0, 0]} />
        )
      ) : null}
      <OrbitControls
        ref={controls}
        makeDefault
        target={[DEFAULT_CAM_TARGET.x, DEFAULT_CAM_TARGET.y, DEFAULT_CAM_TARGET.z]}
        minDistance={2}
        maxDistance={200}
        minPolarAngle={0.02}
        maxPolarAngle={Math.PI - 0.02}
        rotateSpeed={cameraRotateSpeed}
      />
      {backend === "webgl" && postFx !== "off" ? (
        <Suspense fallback={null}>
          <MmdPostFx preset={postFx} />
        </Suspense>
      ) : null}
    </>
  );
}

export function MmdCanvas({ backend, audioRef, apiRef, preserveModelsOnUnmount = false }: Props) {
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
    // Must keep R3F's canvas so WebGPU draws into the visible DOM element.
    // Only drop WebGL-only options that cause Context Lost / Chrome noise.
    return async (props: ConstructorParameters<typeof THREE.WebGLRenderer>[0]) => {
      const mod = await import("three/webgpu");
      const raw = { ...(props as object) } as Record<string, unknown>;
      delete raw.powerPreference;
      delete raw.context;
      delete raw.alpha;
      delete raw.premultipliedAlpha;
      delete raw.preserveDrawingBuffer;
      delete raw.stencil;
      delete raw.depth;
      delete raw.failIfMajorPerformanceCaveat;
      const renderer = new mod.WebGPURenderer({
        ...raw,
        antialias: true,
        forceWebGL: false,
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
      key={`mmd-canvas-${backend}`}
      className="mmd-canvas"
      shadows={backend === "webgl" ? { type: THREE.PCFShadowMap, enabled: true } : false}
      dpr={backend === "webgpu" ? 1 : [1, 1.75]}
      camera={{ position: [DEFAULT_CAM_POS.x, DEFAULT_CAM_POS.y, DEFAULT_CAM_POS.z], fov: 40, near: 0.1, far: 1000 }}
      gl={gl as any}
      frameloop="always"
      onCreated={({ gl: renderer }) => {
        renderer.setClearColor("#0e1118");
        if (renderer.shadowMap) {
          renderer.shadowMap.enabled = backend === "webgl";
          renderer.shadowMap.type = THREE.PCFShadowMap;
          renderer.shadowMap.autoUpdate = backend === "webgl";
        }
      }}
    >
      <StudioScene
        backend={backend}
        audioRef={audioRef}
        apiRef={apiRef}
        preserveModelsOnUnmount={preserveModelsOnUnmount}
      />
    </Canvas>
  );
}
