import { Grid, OrbitControls, TransformControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from "react";
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
  getModelRoot: (id: string | null) => THREE.Object3D | null;
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
  resetPhysics: (seconds?: number) => void;
  getCanvas: () => HTMLCanvasElement | null;
  /** Sync timeline into the render loop immediately (store + timeRef). */
  seekTime: (seconds: number) => void;
  setRecordingCanvasSize: (width: number, height: number) => void;
  restoreRecordingCanvasSize: () => void;
  startRecording: (options: {
    fps: number;
    audio: HTMLAudioElement | null;
    includeAudio?: boolean;
    videoBitsPerSecond?: number;
    audioBitsPerSecond?: number;
    mimeType?: string;
  }) => MediaRecorder | null;
  stopRecording: () => Promise<Blob | null>;
  captureStillPng: () => Promise<Blob | null>;
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

function ModelTransformGizmo({
  runtime,
  selectedModelId,
  mode,
  enabled,
  orbitRef,
}: {
  runtime: ReturnType<typeof createMmdRuntimeHandle>;
  selectedModelId: string | null;
  mode: "translate" | "rotate" | "scale";
  enabled: boolean;
  orbitRef: React.MutableRefObject<any>;
}) {
  const controlsRef = useRef<any>(null);
  const setSelectedModelId = useMmdStudioStore((state) => state.setSelectedModelId);
  const models = useMmdStudioStore((state) => state.models);
  const effectiveId = selectedModelId && models.some((model) => model.id === selectedModelId)
    ? selectedModelId
    : models.find((model) => model.visible)?.id ?? models[0]?.id ?? null;
  const root = effectiveId ? runtime.getModelRoot(effectiveId) : null;
  const selectedModel = models.find((item) => item.id === effectiveId) ?? null;

  // Ensure store selection exists when gizmo is on (otherwise nothing attaches).
  useEffect(() => {
    if (!enabled || !effectiveId) return;
    if (selectedModelId !== effectiveId) {
      runtime.selectModel(effectiveId);
      setSelectedModelId(effectiveId);
    }
  }, [effectiveId, enabled, runtime, selectedModelId, setSelectedModelId]);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const onDraggingChanged = (event: { value: boolean }) => {
      if (orbitRef.current) {
        // Keep orbit usable in free camera; disable only while dragging gizmo.
        const free = useMmdStudioStore.getState().cameraMode === "free";
        orbitRef.current.enabled = free && !event.value;
      }
    };
    controls.addEventListener("dragging-changed", onDraggingChanged);
    return () => {
      controls.removeEventListener("dragging-changed", onDraggingChanged);
      if (orbitRef.current) {
        orbitRef.current.enabled = useMmdStudioStore.getState().cameraMode === "free";
      }
    };
  }, [orbitRef, root, mode, effectiveId]);

  function commitFromObject() {
    if (!root || !effectiveId) return;
    const euler = new THREE.Euler().setFromQuaternion(root.quaternion, "XYZ");
    const scale = (root.scale.x + root.scale.y + root.scale.z) / 3;
    const patch = {
      positionX: root.position.x,
      positionY: root.position.y,
      positionZ: root.position.z,
      rotationX: THREE.MathUtils.radToDeg(euler.x),
      rotationY: THREE.MathUtils.radToDeg(euler.y),
      rotationZ: THREE.MathUtils.radToDeg(euler.z),
      scale: Math.min(10, Math.max(0.01, scale)),
    };
    runtime.setModelTransform(effectiveId, patch);
    const state = useMmdStudioStore.getState();
    const model = state.models.find((item) => item.id === effectiveId);
    if (!model) return;
    state.patchModel(effectiveId, { transform: { ...model.transform, ...patch } });
  }

  if (!enabled || !root || !selectedModel?.visible) return null;

  // size ~1.5 reads better on MMD-scale characters; remount when model/mode changes.
  return (
    <TransformControls
      key={`${effectiveId}-${mode}`}
      ref={controlsRef}
      object={root}
      mode={mode}
      size={1.5}
      space="world"
      onObjectChange={() => commitFromObject()}
    />
  );
}

function DirectionalLightDebugHelper({ lightRef, enabled }: { lightRef: React.RefObject<THREE.DirectionalLight | null>; enabled: boolean }) {
  const { scene } = useThree();
  const helperRef = useRef<THREE.DirectionalLightHelper | null>(null);

  useLayoutEffect(() => {
    const light = lightRef.current;
    if (!enabled || !light) {
      if (helperRef.current) {
        scene.remove(helperRef.current);
        helperRef.current.dispose();
        helperRef.current = null;
      }
      return;
    }
    const helper = new THREE.DirectionalLightHelper(light, 4, 0xffcc66);
    helperRef.current = helper;
    scene.add(helper);
    return () => {
      scene.remove(helper);
      helper.dispose();
      if (helperRef.current === helper) helperRef.current = null;
    };
  }, [enabled, lightRef, scene]);

  useFrame(() => {
    helperRef.current?.update();
  });

  return null;
}

function SelectedSkeletonHelper({
  runtime,
  selectedModelId,
  enabled,
}: {
  runtime: ReturnType<typeof createMmdRuntimeHandle>;
  selectedModelId: string | null;
  enabled: boolean;
}) {
  const { scene } = useThree();
  const helperRef = useRef<THREE.SkeletonHelper | null>(null);
  const root = selectedModelId ? runtime.getModelRoot(selectedModelId) : null;

  useLayoutEffect(() => {
    if (helperRef.current) {
      scene.remove(helperRef.current);
      helperRef.current = null;
    }
    if (!enabled || !root) return;
    let skinned: THREE.Object3D | null = null;
    root.traverse((obj) => {
      if (!skinned && (obj as THREE.SkinnedMesh).isSkinnedMesh) {
        skinned = obj;
      }
    });
    if (!skinned) return;
    const helper = new THREE.SkeletonHelper(skinned);
    const mat = helper.material as THREE.LineBasicMaterial;
    mat.depthTest = false;
    mat.transparent = true;
    mat.opacity = 0.85;
    helper.frustumCulled = false;
    helperRef.current = helper;
    scene.add(helper);
    return () => {
      scene.remove(helper);
      if (helperRef.current === helper) helperRef.current = null;
    };
  }, [enabled, root, scene]);

  return null;
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
    cameraMotionName: item.cameraMotionName,
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
  /** Element currently wired into createMediaElementSource (one source per element). */
  const audioBoundElRef = useRef<HTMLAudioElement | null>(null);
  const captureStreamRef = useRef<MediaStream | null>(null);
  /** Logical renderer size (getSize), not drawing-buffer pixels. */
  const recordingCanvasStateRef = useRef<{ width: number; height: number; pixelRatio: number } | null>(null);
  /** Preview camera.aspect before export; restored with drawing buffer. */
  const recordingCameraAspectRef = useRef<number | null>(null);
  const sizeScratch = useMemo(() => new THREE.Vector2(), []);
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
  const showGizmo = useMmdStudioStore((state) => state.showGizmo);
  const gizmoMode = useMmdStudioStore((state) => state.gizmoMode);
  const showLightHelper = useMmdStudioStore((state) => state.showLightHelper);
  const showSkeletonHelper = useMmdStudioStore((state) => state.showSkeletonHelper);
  const selectedModelId = useMmdStudioStore((state) => state.selectedModelId);
  const models = useMmdStudioStore((state) => state.models);
  const exportingOffline = useMmdStudioStore((state) => state.exportingOffline);
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
      getModelRoot: (id) => runtime.getModelRoot(id),
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
      resetPhysics: (seconds) => {
        const t = seconds ?? useMmdStudioStore.getState().currentTime;
        runtime.resetPhysics(t);
      },
      getCanvas: () => gl.domElement,
      seekTime: (seconds) => {
        const t = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
        timeRef.current = t;
        lastUiTimeRef.current = t;
        setCurrentTime(t);
      },
      setRecordingCanvasSize: (width, height) => {
        if (!recordingCanvasStateRef.current) {
          // Must save logical size (getSize), not domElement.width (drawing buffer).
          // Restoring drawing-buffer dims with pixelRatio>1 multiplies past max texture size.
          gl.getSize(sizeScratch);
          recordingCanvasStateRef.current = {
            width: Math.max(2, Math.round(sizeScratch.x)),
            height: Math.max(2, Math.round(sizeScratch.y)),
            pixelRatio: gl.getPixelRatio(),
          };
        }
        // H.264 and many encoders require even dimensions.
        const even = (n: number) => {
          const v = Math.max(2, Math.round(n));
          return v % 2 === 0 ? v : v - 1;
        };
        const w = even(width);
        const h = even(height);
        // Export at 1:1 logical=buffer so encoder pixels match requested resolution.
        gl.setPixelRatio(1);
        // false = do not change CSS size; export buffer ≠ viewport box.
        gl.setSize(w, h, false);
        // R3F `size` stays CSS viewport; force projection to export aspect or
        // the frame is stretched (typically narrower/taller characters).
        const perspective = camera as THREE.PerspectiveCamera;
        if (perspective.isPerspectiveCamera) {
          if (recordingCameraAspectRef.current == null) {
            recordingCameraAspectRef.current = perspective.aspect;
          }
          perspective.aspect = w / Math.max(1, h);
          perspective.updateProjectionMatrix();
        }
      },
      restoreRecordingCanvasSize: () => {
        const previous = recordingCanvasStateRef.current;
        if (!previous) return;
        gl.setPixelRatio(previous.pixelRatio);
        gl.setSize(previous.width, previous.height, false);
        recordingCanvasStateRef.current = null;
        const perspective = camera as THREE.PerspectiveCamera;
        if (perspective.isPerspectiveCamera && recordingCameraAspectRef.current != null) {
          perspective.aspect = recordingCameraAspectRef.current;
          perspective.updateProjectionMatrix();
          recordingCameraAspectRef.current = null;
        }
      },
      startRecording: ({
        fps,
        audio,
        includeAudio = true,
        videoBitsPerSecond = 8_000_000,
        audioBitsPerSecond,
        mimeType,
      }) => {
        try {
          const stream = gl.domElement.captureStream(fps);
          captureStreamRef.current = stream;
          if (includeAudio && audio) {
            try {
              if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
                audioCtxRef.current = new AudioContext();
                audioSourceRef.current = null;
                audioDestRef.current = null;
                audioBoundElRef.current = null;
              }
              const ctx = audioCtxRef.current;
              if (ctx.state === "suspended") void ctx.resume();
              // createMediaElementSource may only be called once per element.
              if (!audioSourceRef.current || audioBoundElRef.current !== audio) {
                try {
                  audioSourceRef.current?.disconnect();
                } catch {
                  // ignore
                }
                try {
                  audioDestRef.current?.disconnect();
                } catch {
                  // ignore
                }
                audioSourceRef.current = ctx.createMediaElementSource(audio);
                audioDestRef.current = ctx.createMediaStreamDestination();
                audioSourceRef.current.connect(audioDestRef.current);
                audioSourceRef.current.connect(ctx.destination);
                audioBoundElRef.current = audio;
              }
              const dest = audioDestRef.current;
              if (dest) dest.stream.getAudioTracks().forEach((track) => stream.addTrack(track));
            } catch {
              // video only
            }
          }
          const candidates = [
            mimeType,
            "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
            "video/mp4;codecs=avc1.42E01E",
            "video/mp4",
            "video/webm;codecs=vp9,opus",
            "video/webm;codecs=vp9",
            "video/webm;codecs=vp8,opus",
            "video/webm;codecs=vp8",
            "video/webm",
          ].filter(Boolean) as string[];
          let resolvedMime = "video/webm";
          for (const type of candidates) {
            try {
              if (MediaRecorder.isTypeSupported(type)) {
                resolvedMime = type;
                break;
              }
            } catch {
              // ignore
            }
          }
          const recorderOptions: MediaRecorderOptions = {
            mimeType: resolvedMime,
            videoBitsPerSecond,
          };
          if (audioBitsPerSecond && audioBitsPerSecond > 0) {
            recorderOptions.audioBitsPerSecond = audioBitsPerSecond;
          }
          let recorder: MediaRecorder;
          try {
            recorder = new MediaRecorder(stream, recorderOptions);
          } catch {
            // Some browsers reject audio codec combos; retry without codec string extras.
            const fallback = resolvedMime.startsWith("video/mp4") ? "video/mp4" : "video/webm";
            recorder = new MediaRecorder(stream, {
              mimeType: MediaRecorder.isTypeSupported(fallback) ? fallback : undefined,
              videoBitsPerSecond,
              ...(audioBitsPerSecond && audioBitsPerSecond > 0
                ? { audioBitsPerSecond }
                : {}),
            });
            resolvedMime = recorder.mimeType || fallback;
          }
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
          const mime = recorder.mimeType || "video/webm";
          const blob = new Blob(chunksRef.current, { type: mime });
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
      captureStillPng: () => new Promise((resolve) => {
        try {
          // Capture the last presented canvas (includes post FX when active).
          gl.domElement.toBlob((blob) => resolve(blob), "image/png");
        } catch {
          resolve(null);
        }
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
      // Realtime capture only — offline WebCodecs seeks frames without playing.
      const forceOneX = recording && !state.exportingOffline && state.exportForceOneX;
      const playSpeed = forceOneX ? 1 : speed;
      // Cap timeline advance so physics never sees multi-second jumps on lag spikes.
      const step = Math.min(1 / 20, Math.max(0, delta)) * playSpeed;
      if (audio && !audio.paused && Number.isFinite(audio.currentTime)) {
        timeRef.current = audio.currentTime;
      } else {
        timeRef.current += step;
      }

      const endLimit = recording && !state.exportingOffline && rangeEnd > 0 ? rangeEnd : duration;
      if (endLimit > 0 && timeRef.current >= endLimit) {
        if (recording && !state.exportingOffline) {
          timeRef.current = endLimit;
          setPlaying(false);
          if (audio) audio.pause();
        } else if (loop) {
          // Exact loop restart — runtime will treat as seek for physics reset.
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
    // While exporting, drawing buffer aspect ≠ R3F CSS size — keep FOV correct.
    const exportBuf = recordingCanvasStateRef.current != null;
    const viewAspect = exportBuf
      ? gl.domElement.width / Math.max(1, gl.domElement.height)
      : size.width / Math.max(1, size.height);
    if (perspective.isPerspectiveCamera && Math.abs(perspective.aspect - viewAspect) > 1e-5) {
      perspective.aspect = viewAspect;
      perspective.updateProjectionMatrix();
    }
    runtime.update(timeRef.current, physicsEnabled, perspective, viewAspect, useMotionCamera);
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
  // Slightly larger near reduces depth precision waste and acne shimmer.
  const shadowNear = 0.5;
  const shadowFar = Math.max(80, lights.sunDistance + shadowCam * 2);
  // Receiver matches the ortho footprint (±shadowCam on XZ).
  const groundSize = Math.max(20, shadowCam * 2);
  // Keep ground slightly under y=0 so it does not z-fight the grid / foot soles
  // when the view camera moves (classic shadow-plane shimmer).
  const groundY = -0.015;
  const dirLightRef = useRef<THREE.DirectionalLight>(null);
  const shadowMapSizeRef = useRef(lights.shadowMapSize);
  const webGpuGrid = useMemo(() => {
    const helper = new THREE.GridHelper(80, 40, "#3a4254", "#2a3140");
    helper.position.y = 0.001;
    helper.frustumCulled = false;
    return helper;
  }, []);

  useEffect(() => {
    if (!gl.shadowMap) return;
    gl.shadowMap.enabled = shadowsActive;
    gl.shadowMap.type = THREE.PCFShadowMap;
    gl.shadowMap.autoUpdate = true;
  }, [gl, shadowsActive]);

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
    // Clamp extreme user bias that causes view-dependent swimming.
    light.shadow.bias = Math.min(-0.00005, Math.max(-0.002, lights.shadowBias));
    light.shadow.normalBias = Math.min(0.12, Math.max(0.01, lights.shadowNormalBias));
    light.shadow.radius = Math.min(8, Math.max(0, lights.shadowRadius));

    const cam = light.shadow.camera;
    cam.near = shadowNear;
    cam.far = shadowFar;
    cam.left = -shadowCam;
    cam.right = shadowCam;
    cam.top = shadowCam;
    cam.bottom = -shadowCam;
    cam.updateProjectionMatrix();
    light.shadow.updateMatrices(light);

    // Only rebuild the shadow RT when resolution changes (avoids flicker thrash).
    if (prevMapSize !== lights.shadowMapSize && light.shadow.map) {
      light.shadow.map.dispose();
      light.shadow.map = null as unknown as THREE.WebGLRenderTarget;
      light.shadow.needsUpdate = true;
    }
    shadowMapSizeRef.current = lights.shadowMapSize;

    runtime.setLighting({
      envIntensity: skyAsEnvironment && skyMode === "hdr" ? envIntensity : 0,
      ambientIntensity: lights.ambientIntensity,
      directionalLight: light,
    });
  }, [
    envIntensity,
    lights.ambientIntensity,
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
          position={[0, groundY, 0]}
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
            // Separate from grid / coplanar geometry when orbiting the camera.
            polygonOffset
            polygonOffsetFactor={-1}
            polygonOffsetUnits={-2}
            toneMapped={false}
          />
        </mesh>
      ) : null}
      {showGrid ? (
        isWebGpu ? (
          <primitive object={webGpuGrid} />
        ) : (
          <Grid infiniteGrid fadeDistance={80} sectionColor="#3a4254" cellColor="#2a3140" position={[0, 0.001, 0]} />
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
      {!exportingOffline && !recording && showGizmo && models.length > 0 ? (
        <ModelTransformGizmo
          runtime={runtime}
          selectedModelId={selectedModelId}
          mode={gizmoMode}
          enabled
          orbitRef={controls}
        />
      ) : null}
      {!exportingOffline && !recording && showLightHelper && sunEnabled ? (
        <DirectionalLightDebugHelper lightRef={dirLightRef} enabled />
      ) : null}
      {!exportingOffline && !recording && showSkeletonHelper ? (
        <SelectedSkeletonHelper runtime={runtime} selectedModelId={selectedModelId} enabled />
      ) : null}
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
