/** Warm the scene chunk after requestSession starts (do not await before requestSession). */
export function preloadVrDesktopScene() {
  return import("./VrDesktopScene");
}
