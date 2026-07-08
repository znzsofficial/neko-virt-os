# NekoVirtOS

NekoVirtOS is a browser-native virtual desktop built with React, Vite, Zustand, Dexie, and Cloudflare Pages. It provides a lightweight local-first workspace with draggable windows, virtual files, notes, browser, calculator, calendar, settings, task manager, and terminal tools.

## Features

- Desktop shell with draggable, resizable, minimizable, maximizable, snapping, tiling, and cascading windows.
- Multi-instance Notes windows with unsaved-change close confirmation.
- Virtual file system backed by IndexedDB through Dexie.
- Files app with search, sorting, inline rename, direct-name creation, details preview, and Trash restore/delete flows.
- Browser app with an embedded iframe mode and external-tab fallback.
- Common utilities: Calculator, Calendar, Terminal, Settings, Task Manager, and About.
- Theme system with light/dark modes, accent colors, density settings, notifications, and boot animation.
- Alt/Meta + Tab window switcher.

## Tech Stack

- React
- TypeScript
- Vite
- Zustand
- Dexie / IndexedDB
- Iconify
- react-rnd
- Cloudflare Pages

## Development

Install dependencies:

```sh
npm install
```

Start the local dev server:

```sh
npm run dev
```

Build for production:

```sh
npm run build
```

Preview the production build locally:

```sh
npm run preview
```

## Deployment

The project builds to `dist` and can be deployed to Cloudflare Pages:

```sh
npm run build
wrangler pages deploy ./dist --project-name=neko-virt-os --branch=main
```

Current Pages project:

- Project name: `neko-virt-os`
- Pages URL: `https://neko-virt-os.pages.dev`
- Custom domain target: `os.nekolaska.vip`

## Local Data

NekoVirtOS stores user files and UI state locally in the browser using IndexedDB and `localStorage`. Clearing site data will reset the virtual file system, window layout, desktop icon positions, and theme settings.
