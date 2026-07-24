import type { TranslationKey } from "../../languageStore";

/** Morph name heuristics (no React — keep out of panel UI modules for Fast Refresh). */

export function classifyMorph(name: string) {
  const n = name.toLowerCase();
  if (/(eye|目|瞳|まばたき|blink)/i.test(name) || n.includes("eye")) return "eye";
  if (/(mouth|口|lip|あ|い|う|え|お)/i.test(name) || n.includes("mouth")) return "mouth";
  if (/(brow|眉|まゆ|eyebrow)/i.test(name) || n.includes("brow")) return "brow";
  if (/(face|顔|head)/i.test(name)) return "face";
  return "other";
}

export function morphGroupLabel(group: string, t: (key: TranslationKey) => string) {
  switch (group) {
    case "eye":
      return t("mmdMorphGroupEye");
    case "mouth":
      return t("mmdMorphGroupMouth");
    case "brow":
      return t("mmdMorphGroupBrow");
    case "face":
      return t("mmdMorphGroupFace");
    default:
      return t("mmdMorphGroupOther");
  }
}
