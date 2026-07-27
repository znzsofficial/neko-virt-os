<div align="center">

# NekoVirtOS

**A local-first browser desktop, MMD studio, and standalone WebXR showcase.**

[![React 19](https://img.shields.io/badge/React-19-087ea4?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript 7](https://img.shields.io/badge/TypeScript-7-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Three.js](https://img.shields.io/badge/Three.js-WebGL-111111?logo=threedotjs&logoColor=white)](https://threejs.org/)
[![WebXR](https://img.shields.io/badge/WebXR-Quest-5b4bdb?logo=meta&logoColor=white)](https://immersiveweb.dev/)
[![Local First](https://img.shields.io/badge/Data-local--first-168363?logo=indexeddb&logoColor=white)](#local-data)
[![Apache 2.0](https://img.shields.io/badge/License-Apache--2.0-d22128?logo=apache&logoColor=white)](./LICENSE)

[Live site](https://os.nekolaska.vip) · [MMD Studio guide](./docs/mmd-studio.md) · [VR roadmap](./docs/mmd-vr-showcase-roadmap.md) · [Documentation](./docs/README.md)

</div>

NekoVirtOS combines a desktop-style local workspace with MMD production tools and an independent VR viewer. Models, motions, media, files, and UI state stay in the browser; no backend account is required.

## What It Includes

### Desktop Workspace

- Draggable, resizable, snapping, tiling, cascading, and multi-instance windows.
- IndexedDB-backed virtual files with search, sorting, rename, preview, Trash, restore, and permanent deletion.
- Notes, Browser, Calculator, Calendar, Terminal, Settings, Task Manager, media tools, and system utilities.
- Light and dark themes, accent and density controls, notifications, boot animation, and `Alt/Meta + Tab` switching.

### MMD Studio

- User-provided PMX/PMD models, VMD/VPD motion data, textures, audio, and project files.
- Animation, camera, lighting, environment maps, post-processing, gizmos, capture, and Bullet physics.
- WebGL production path plus the experimental WebGPU/TSL rendering path documented in the studio guide.

### MMD VR Showcase

- Standalone WebGL + WebXR entry designed around Meta Quest constraints.
- In-headset HUD, quality presets, model transform controls, height adjustment, snap turning, and exposure/lighting looks.
- Optional controller collision, contact haptics, physics quality controls, and session-safe model disposal.
- Independent renderer and XR session: the showcase does not load the desktop or Studio UI into VR.

## Stack

| Area | Technology |
| --- | --- |
| Application | React 19, TypeScript, Vite |
| State and data | Zustand, Dexie, IndexedDB, localStorage |
| 3D and XR | Three.js, React Three Fiber, React Three XR |
| MMD | `@yohawing/three-mmd-loader`, Bullet WASM |
| UI | Iconify, react-rnd, Noto Sans SC Variable |
| Hosting | Cloudflare Pages |

## Quick Start

Requirements:

- Node.js `20.19.0`
- pnpm `11.17.0`

```sh
pnpm install --frozen-lockfile
pnpm dev
```

The development server exposes the desktop at `/` and the standalone showcase at `/mmd-vr.html`.

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the Vite development server |
| `pnpm test` | Run the Vitest suite once |
| `pnpm test:watch` | Run tests in watch mode |
| `pnpm build` | Type-check and create the production build |
| `pnpm preview` | Preview the production build locally |
| `pnpm deploy` | Build and deploy `dist` to Cloudflare Pages |

CI runs a frozen install, the complete test suite, and the production build on pushes and pull requests.

## WebXR Requirements

- Immersive VR requires a browser and device supporting WebXR `immersive-vr`.
- Production XR must run from a secure HTTPS origin; supported browsers generally allow `localhost` during development.
- Quest behavior, controller haptics, tracking, thermals, and mobile GPU limits require validation on the target headset.
- Desktop browser tests cannot replace headset testing. Current validation items are tracked in the [MMD VR roadmap](./docs/mmd-vr-showcase-roadmap.md).

## Local Data

User files and application state are stored locally through IndexedDB and `localStorage`. Clearing site data resets the virtual file system, window layout, desktop positions, preferences, and cached project state.

Imported MMD models, motions, textures, audio, and media remain local to the browser. This repository does not include sample character or motion assets. Use only assets whose creator terms permit your intended use.

## Deployment

The production build is written to `dist` and deployed to the `neko-virt-os` Cloudflare Pages project:

```sh
pnpm deploy
```

- Pages URL: <https://neko-virt-os.pages.dev>
- Custom domain: <https://os.nekolaska.vip>

## Licensing

NekoVirtOS is licensed under the [Apache License 2.0](./LICENSE).

Bundled third-party code and fonts retain their own licenses. Bullet runtime attribution is recorded in [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md), and the Noto Sans SC license is included at [licenses/Noto-Sans-SC-OFL-1.1.txt](./licenses/Noto-Sans-SC-OFL-1.1.txt). Runtime package licenses are also available in the application's About view.
