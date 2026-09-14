# NekoVirtOS Agent Guide

## Project Shape

- This is a single-package pnpm project. Use Node.js `22.13.0` (`.node-version`) and pnpm `11.20.0`.
- Desktop entry: `index.html` -> `src/main.tsx` -> `src/App.tsx`.
- The product surface is the 2D desktop shell plus the MMD Studio app (`src/appModules/mmdStudio/`). The MMD VR showcase and the VR Desktop shell were removed; they live on as a separate standalone project and must not be reintroduced here.

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

- The runtime is pinned to `@yohawing/three-mmd-loader@0.8.3`.
- Keep the matching Bullet files in `public/mmd/0.8.3/mmd_bullet.js` and `public/mmd/0.8.3/mmd_bullet.wasm`, and keep the path in `src/appModules/mmdStudio/mmdPhysics.ts` synchronized.
- Keep the loader entry in `pnpm-workspace.yaml` and `patches/@yohawing__three-mmd-loader@0.8.3.patch`. The published package still lacks `debugPhysicsContactsForRigidBodyRange()`; the patch filters the native debug contact buffer by rigid-body range and is required for Studio controller contact diagnostics.
- When upgrading the loader, follow `docs/three-mmd-loader-maintenance.md`: verify upstream API coverage, update versioned assets and notices/docs, run `pnpm install`, then rerun focused physics tests, the full suite, TypeScript, and the build. Do not remove the patch merely because the upstream version changed.
- The loader clone at `E:\WebProjects\three-mmd-loader` uses npm and `package-lock.json`; do not use pnpm there.
- `mediabunny` is currently `^1.55.3`; WebCodecs export uses `Quality({ bitrate })`, not a top-level bitrate option.

## Studio Physics And Controller Invariants

- The controller collider wrapper lives in `src/appModules/mmdStudio/mmdPhysics.ts`: it appends controller rigid bodies to the physics context and distinguishes left/right controllers. Controller contact indexing starts at the original `sourceRigidBodyCount`; do not shift that offset.
- Preserve unit-scale physics: model display scale must not scale the PMX-native physics world (`mmdRuntime.ts` / `mmdRuntimeEntry.ts`).
- Preserve the controller matrix scale normalization and the independent collider-radius/model-scale conversion. These are needed for scaled models and cloth contact.
- Controller collider matrices come from WebXR controller input, so exercising controller collision in Studio requires a desktop browser with a WebXR-capable session; plain DOM checks do not cover it.

## Verification And Files

- Studio changes still need browser verification (rendering backends, physics, export). For physics/controller-collision changes, manually regress model scaling, cloth fall/contact, and controller contacts.
- Read `PRODUCT.md` and `DESIGN.md` before changing UI. Use `docs/README.md` for the documentation index.
- `sample/` is ignored and sample model files must not be committed. `.gitattributes` expects LF text and treats `*.wasm` as binary.
- Update `THIRD_PARTY_NOTICES.md` and `src/system/openSourceLicenses.ts` when changing bundled third-party versions.
