/** Sky / environment panorama formats we can load as equirectangular maps. */

export type MmdSkyFormat = "hdr" | "exr" | "ldr";

const SKY_EXT = /\.(hdr|exr|png|jpe?g|webp|avif)$/i;

export function isSkyPanoramaFile(file: File): boolean {
  if (SKY_EXT.test(file.name)) return true;
  const type = (file.type || "").toLowerCase();
  return (
    type === "image/vnd.radiance"
    || type === "image/x-exr"
    || type === "image/exr"
    || type.startsWith("image/")
  );
}

export function detectSkyFormat(fileName: string, mime = ""): MmdSkyFormat {
  const name = fileName.toLowerCase();
  const type = mime.toLowerCase();
  if (name.endsWith(".hdr") || type === "image/vnd.radiance") return "hdr";
  if (name.endsWith(".exr") || type === "image/x-exr" || type === "image/exr") return "exr";
  return "ldr";
}

export function pickSkyPanoramaFile(files: File[]): File | null {
  // Prefer true HDR formats when multiple are dropped.
  const ranked = [...files].filter(isSkyPanoramaFile);
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
