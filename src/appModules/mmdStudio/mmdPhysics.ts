import type { MmdPhysicsBackend } from "@yohawing/three-mmd-loader/physics";

let modulePromise: Promise<unknown> | null = null;

async function loadBulletModule() {
  if (!modulePromise) {
    modulePromise = (async () => {
      const { loadCustomBulletMmdModule } = await import("@yohawing/three-mmd-loader/physics");
      const base = import.meta.env.BASE_URL || "/";
      // Same layout as three-mmd-loader viewer: js + wasm side-by-side under /mmd/.
      const scriptUrl = new URL("mmd/mmd_bullet.js", window.location.origin + base).href;
      return loadCustomBulletMmdModule({ scriptUrl, timeoutMs: 30_000 });
    })().catch((error) => {
      modulePromise = null;
      throw error;
    });
  }
  return modulePromise;
}

/**
 * One Bullet world per call. Prefer one backend per model — a single world only
 * keeps the last uploaded rigid-body set (identity swap on each step).
 *
 * Tuning matches the official three-mmd-loader viewer defaults. Do not force
 * collisionMargin (default -1); a positive margin can kill body↔cloth contact.
 */
export async function createBulletPhysicsBackend(): Promise<MmdPhysicsBackend> {
  const { createCustomBulletMmdPhysicsBackend } = await import("@yohawing/three-mmd-loader/physics");
  const module = await loadBulletModule();
  return createCustomBulletMmdPhysicsBackend(
    module as Parameters<typeof createCustomBulletMmdPhysicsBackend>[0],
    {
      fixedTimeStep: 1 / 60,
      maxSubSteps: 5,
      resetCatchUpSteps: 0,
      dynamicWithBoneRotationFeedbackScale: 1,
      solverIterations: 20,
      splitImpulse: true,
      splitImpulsePenetrationThreshold: -0.04,
    },
  );
}
