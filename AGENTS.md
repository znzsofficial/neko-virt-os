# NekoVirtOS Agent Guide

## Project Shape

- This is a single-package pnpm project. Use Node.js `22.13.0` (`.node-version`) and pnpm `11.20.0`.
- Desktop entry: `index.html` -> `src/main.tsx` -> `src/App.tsx`.
- MMD VR entry: `mmd-vr.html` -> `src/mmdVrPrepMain.tsx` -> `src/mmdVrShowcase/`.
- `src/mmdVrShowcase/` is a separate WebGL/WebXR session. Do not move it into the Studio WebGPU/DOM UI or share its XR session with the desktop surface.
- `src/xr/` owns XR detection, session creation, and pending-session attachment. Desktop VR and MMD VR each create their own product session.

## Commands

```bash
pnpm install
pnpm exec tsc -b --pretty false
pnpm test
pnpm build
git diff --check
pnpm deploy
```

- `pnpm test` runs Vitest in the Node environment; run a focused file with `pnpm exec vitest run <path>`.
- CI runs `pnpm install --frozen-lockfile`, `pnpm test`, and `pnpm build` on Node from `.node-version`.
- There is no repository lint or formatter script. Do not assume `pnpm lint` exists.
- `pnpm deploy` builds and deploys to Cloudflare Pages; do not run it as a validation substitute.

## MMD Loader And Assets

- The runtime is pinned to `@yohawing/three-mmd-loader@0.8.2`.
- Keep the matching Bullet files in `public/mmd/0.8.2/mmd_bullet.js` and `public/mmd/0.8.2/mmd_bullet.wasm`, and keep the path in `src/appModules/mmdStudio/mmdPhysics.ts` synchronized.
- Keep the loader entry in `pnpm-workspace.yaml` and `patches/@yohawing__three-mmd-loader@0.8.2.patch`. The published package still lacks `debugPhysicsContactsForRigidBodyRange()`; the patch filters the native debug contact buffer by rigid-body range and is required for controller/hand contact diagnostics and haptics.
- When upgrading the loader, follow `docs/three-mmd-loader-maintenance.md`: verify upstream API coverage, update versioned assets and notices/docs, run `pnpm install`, then rerun focused physics/haptics tests, the full suite, TypeScript, and the build. Do not remove the patch merely because the upstream version changed.
- The loader clone at `E:\WebProjects\three-mmd-loader` uses npm and `package-lock.json`; do not use pnpm there.
- `mediabunny` is currently `^1.55.3`; WebCodecs export uses `Quality({ bitrate })`, not a top-level bitrate option.

## XR And Physics Invariants

- MMD XR must request the optional `hand-tracking` feature when the session is created. This allows hand tracking to be enabled after entering XR; preserve `beginFromClick(init?)` initialization passthrough.
- `handTracking` is the persisted preference name and defaults to `true`. Do not reintroduce `handDetail`.
- Hand colliders use 12 fixed slots: each hand has a wrist and five fingertip colliders. Keep their provider mapping in `src/mmdVrShowcase/mmdVrHandColliders.ts` and `components/MmdVrHandColliders.tsx`.
- Physics wrapper order is `[model, controller colliders (2), hand colliders (12)]`: the controller wrapper is outermost and added first, with the hand wrapper inside it. Controller contact indexing starts at the original `sourceRigidBodyCount`; do not add the 12 hand slots to that offset. Forward contact diagnostics through every wrapper.
- Controller and hand providers must use the shared model visual-space mapping and WebXR-to-MMD coordinate conversion in `mmdRuntime.ts`.
- Preserve the controller matrix scale normalization and the independent collider-radius/model-scale conversion. These are needed for scaled models and cloth contact.

## Verification And Files

- Browser checks do not replace Quest hardware validation. For XR/physics changes, manually regress model scaling, cloth fall/contact, panel persistence, controller and hand collisions, controller contact counts, and haptics.
- Read `PRODUCT.md` and `DESIGN.md` before changing UI. Use `docs/README.md` for the documentation index.
- `sample/` is ignored and sample model files must not be committed. `.gitattributes` expects LF text and treats `*.wasm` as binary.
- Update `THIRD_PARTY_NOTICES.md` and `src/system/openSourceLicenses.ts` when changing bundled third-party versions.
