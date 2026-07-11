import type { MmdAnimation } from "@yohawing/three-mmd-loader";

export function getMmdAnimationDurationSeconds(animation: MmdAnimation) {
  let maxFrame = 0;
  for (const track of Object.values(animation.boneTracks)) {
    if (track.frames.length) maxFrame = Math.max(maxFrame, track.frames[track.frames.length - 1] ?? 0);
  }
  for (const track of Object.values(animation.morphTracks)) {
    if (track.frames.length) maxFrame = Math.max(maxFrame, track.frames[track.frames.length - 1] ?? 0);
  }
  for (const frame of animation.cameraFrames) maxFrame = Math.max(maxFrame, frame.frame);
  for (const frame of animation.lightFrames) maxFrame = Math.max(maxFrame, frame.frame);
  return Math.max(1 / 30, maxFrame / 30);
}

/** Merge body VMD (bones/camera) with face VMD (morphs). Body bones win; face morphs win. */
export function mergeBodyFaceAnimations(body: MmdAnimation, face: MmdAnimation): MmdAnimation {
  const boneTracks = { ...face.boneTracks, ...body.boneTracks };
  const morphTracks = { ...body.morphTracks, ...face.morphTracks };
  const cameraFrames = body.cameraFrames.length ? body.cameraFrames : face.cameraFrames;
  const lightFrames = body.lightFrames.length ? body.lightFrames : face.lightFrames;
  const selfShadowFrames = body.selfShadowFrames.length ? body.selfShadowFrames : face.selfShadowFrames;
  const propertyFrames = body.propertyFrames.length ? body.propertyFrames : face.propertyFrames;
  const maxFrame = Math.max(body.metadata.maxFrame, face.metadata.maxFrame, 0);

  return {
    kind: "vmd",
    bytes: body.bytes.byteLength >= face.bytes.byteLength ? body.bytes : face.bytes,
    metadata: {
      modelName: body.metadata.modelName || face.metadata.modelName,
      counts: {
        bones: Object.keys(boneTracks).length,
        morphs: Object.keys(morphTracks).length,
        cameras: cameraFrames.length,
        lights: lightFrames.length,
        selfShadows: selfShadowFrames.length,
        properties: propertyFrames.length,
      },
      maxFrame,
    },
    boneTracks,
    morphTracks,
    cameraFrames,
    lightFrames,
    selfShadowFrames,
    propertyFrames,
  };
}

export function buildTextureMap(files: File[]) {
  const map: Record<string, Blob> = {};
  for (const file of files) {
    const relative = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
    const normalized = relative.replaceAll("\\", "/");
    map[normalized] = file;
    map[file.name] = file;
    const base = normalized.split("/").pop();
    if (base) map[base] = file;
  }
  return map;
}

export function isModelFile(file: File) {
  const name = file.name.toLowerCase();
  return name.endsWith(".pmx") || name.endsWith(".pmd");
}

export function isMotionFile(file: File) {
  const name = file.name.toLowerCase();
  return name.endsWith(".vmd") || name.endsWith(".vpd");
}

export function isAudioFile(file: File) {
  return file.type.startsWith("audio/") || /\.(mp3|wav|ogg|m4a|flac)$/i.test(file.name);
}

export function classifyMotionSlot(file: File): "body" | "face" {
  const name = file.name.toLowerCase();
  if (/(face|facial|表情|顔|morph|mouth|eye)/i.test(name)) return "face";
  return "body";
}
