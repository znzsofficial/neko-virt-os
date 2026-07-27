# NekoVirtOS

NekoVirtOS is a browser-native virtual desktop and MMD workspace built with React, Vite, Three.js, Zustand, Dexie, and Cloudflare Pages. Alongside its local-first desktop tools, it includes an MMD Studio and a standalone WebXR showcase intended for devices such as Meta Quest.

## Features

- Desktop shell with draggable, resizable, minimizable, maximizable, snapping, tiling, and cascading windows.
- Multi-instance Notes windows with unsaved-change close confirmation.
- Virtual file system backed by IndexedDB through Dexie.
- Files app with search, sorting, inline rename, direct-name creation, details preview, and Trash restore/delete flows.
- Browser app with an embedded iframe mode and external-tab fallback.
- Common utilities: Calculator, Calendar, Terminal, Settings, Task Manager, and About.
- Theme system with light/dark modes, accent colors, density settings, notifications, and boot animation.
- Alt/Meta + Tab window switcher.
- MMD Studio for loading user-provided PMX/PMD models and VMD motion data, with animation, camera, lighting, post-processing, and Bullet physics controls.
- Standalone WebXR MMD showcase with Quest-oriented quality presets, in-headset controls, snap turning, controller collision, haptics, and model adjustment tools.

## Tech Stack

- React
- TypeScript
- Vite
- Zustand
- Dexie / IndexedDB
- Three.js / React Three Fiber / React Three XR
- three-mmd-loader / Bullet WASM
- Iconify
- react-rnd
- Cloudflare Pages

## Development

This project uses **pnpm** (`packageManager` in `package.json`). Do not mix with npm/yarn lockfiles.

Install dependencies:

```sh
pnpm install
```

Start the local dev server:

```sh
pnpm dev
```

Build for production:

```sh
pnpm build
```

Run tests:

```sh
pnpm test
```

The full check used by CI is:

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm build
```

Preview the production build locally:

```sh
pnpm preview
```

## Deployment

The project builds to `dist` and can be deployed to Cloudflare Pages:

```sh
pnpm deploy
```

Or manually:

```sh
pnpm build
pnpm exec wrangler pages deploy ./dist --project-name=neko-virt-os --branch=main
```

Current Pages project:

- Project name: `neko-virt-os`
- Pages URL: `https://neko-virt-os.pages.dev`
- Custom domain target: `os.nekolaska.vip`

## Local Data

NekoVirtOS stores user files and UI state locally in the browser using IndexedDB and `localStorage`. Clearing site data will reset the virtual file system, window layout, desktop icon positions, and theme settings.

## MMD And WebXR Notes

- MMD models, motions, textures, audio, and other imported media remain local to the browser. No character or motion assets are included as sample content.
- Use only assets you are authorized to use and redistribute. MMD model and motion terms vary by creator and are separate from this repository.
- Immersive VR requires a browser and device with WebXR `immersive-vr` support. Production use requires a secure HTTPS origin; `localhost` is suitable for local development where supported.
- Quest behavior and performance should be validated on the target headset because desktop browser tests cannot reproduce device tracking, controller haptics, or mobile GPU limits.

## Third-Party Notices

The Bullet JavaScript/WASM runtime under `public/mmd` is distributed from `@yohawing/three-mmd-loader`. Its required MIT notice is preserved in [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md). Runtime package licenses are also listed in the application's About view.

## License

NekoVirtOS is licensed under the [Apache License 2.0](./LICENSE). Third-party components remain subject to their respective licenses and notices.
