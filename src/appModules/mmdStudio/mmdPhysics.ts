import type { MmdPhysicsBackend } from "@yohawing/three-mmd-loader/physics";

let modulePromise: Promise<unknown> | null = null;

async function loadBulletModule() {
  if (!modulePromise) {
    modulePromise = (async () => {
      const { loadCustomBulletMmdModule } = await import("@yohawing/three-mmd-loader/physics");
      const base = import.meta.env.BASE_URL || "/";
      const scriptUrl = new URL("mmd/mmd_bullet.js", window.location.origin + base).href;
      return loadCustomBulletMmdModule({ scriptUrl, timeoutMs: 30_000 });
    })().catch((error) => {
      modulePromise = null;
      throw error;
    });
  }
  return modulePromise;
}

/** Shared WASM module; each call creates a fresh physics world backend. */
export async function createBulletPhysicsBackend(): Promise<MmdPhysicsBackend> {
  const { createCustomBulletMmdPhysicsBackend } = await import("@yohawing/three-mmd-loader/physics");
  const module = await loadBulletModule();
  return createCustomBulletMmdPhysicsBackend(module as Parameters<typeof createCustomBulletMmdPhysicsBackend>[0]);
}
