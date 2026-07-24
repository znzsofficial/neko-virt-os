/** Sky / environment panorama formats we can load as equirectangular maps. */

export type MmdSkyFormat = "hdr" | "exr" | "ldr";

const HDR_EXR_EXT = /\.(hdr|exr)$/i;
const LDR_EXT = /\.(png|jpe?g|webp|avif)$/i;
/** Name hints: only use LDR as sky when filename looks like a panorama, not a model tex. */
const SKY_NAME_HINT =
  /(^|[^a-z0-9])(sky|hdr|ibl|env|equirect|panorama|pano|hdri|environment|背景|全景)([^a-z0-9]|$)/i;
/** Common MMD / PBR map suffixes that must never become sky on bulk import. */
const TEX_MAP_HINT =
  /(toon|spa|sph|norm(al)?|bump|disp|rough|metal|ao|orm|emiss|spec|base.?color|albedo|diffuse|shadow|mask|alpha|_s\d)/i;

export function isHdrExrSkyFile(file: File): boolean {
  if (HDR_EXR_EXT.test(file.name)) return true;
  const type = (file.type || "").toLowerCase();
  return type === "image/vnd.radiance" || type === "image/x-exr" || type === "image/exr";
}

/** True for files the dedicated sky file picker may load (including plain LDR images). */
export function isSkyPanoramaFile(file: File): boolean {
  if (isHdrExrSkyFile(file)) return true;
  if (LDR_EXT.test(file.name)) return true;
  const type = (file.type || "").toLowerCase();
  return type.startsWith("image/");
}

/**
 * Auto-detect sky from a multi-file drop (folder / model pack).
 * Never treat random model textures (.png/.jpg) as sky — that was overwriting the env map.
 * - With models in the drop: only .hdr / .exr (LDR via side-panel picker only)
 * - Without models: LDR only if name looks like a panorama and not a material map
 */
export function isAutoSkyCandidate(file: File, options?: { hasModels?: boolean }): boolean {
  if (isHdrExrSkyFile(file)) return true;
  if (options?.hasModels) return false;
  if (!LDR_EXT.test(file.name) && !(file.type || "").toLowerCase().startsWith("image/")) return false;
  const base = file.name.replace(/\.[^.]+$/, "");
  if (TEX_MAP_HINT.test(base)) return false;
  return SKY_NAME_HINT.test(file.name) || SKY_NAME_HINT.test(base);
}

export function detectSkyFormat(fileName: string, mime = ""): MmdSkyFormat {
  const name = fileName.toLowerCase();
  const type = mime.toLowerCase();
  if (name.endsWith(".hdr") || type === "image/vnd.radiance") return "hdr";
  if (name.endsWith(".exr") || type === "image/x-exr" || type === "image/exr") return "exr";
  return "ldr";
}

export function pickSkyPanoramaFile(files: File[], options?: { hasModels?: boolean }): File | null {
  const hasModels = options?.hasModels ?? false;
  const ranked = [...files].filter((file) => isAutoSkyCandidate(file, { hasModels }));
  if (!ranked.length) return null;
  ranked.sort((a, b) => {
    const score = (f: File) => {
      const fmt = detectSkyFormat(f.name, f.type);
      if (fmt === "hdr") return 0;
      if (fmt === "exr") return 1;
      return 2;
    };
    return score(a) - score(b);
  });
  return ranked[0] ?? null;
}

/** File picker accept list for sky panoramas. */
export const SKY_FILE_ACCEPT =
  ".hdr,.exr,.png,.jpg,.jpeg,.webp,.avif,image/vnd.radiance,image/x-exr,image/exr,image/png,image/jpeg,image/webp,image/avif";
