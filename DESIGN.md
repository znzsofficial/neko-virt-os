---
name: NekoVirtOS
description: A Windows-first local browser workstation with quiet Neko details.
colors:
  os-bg: "oklch(0.90 0.035 35)"
  os-surface: "oklch(0.945 0.028 35 / 0.92)"
  os-panel: "oklch(0.975 0.018 35 / 0.96)"
  os-elevated: "oklch(0.99 0.016 35 / 0.98)"
  os-overlay: "oklch(0.985 0.020 35 / 0.96)"
  os-ink: "oklch(0.20 0.035 35)"
  os-muted: "oklch(0.43 0.035 35)"
  os-subtle: "oklch(0.57 0.025 35)"
  os-primary: "oklch(0.52 0.22 35)"
  os-primary-strong: "oklch(0.45 0.22 35)"
  os-primary-soft: "oklch(0.88 0.075 35 / 0.78)"
  os-primary-contrast: "oklch(0.985 0.010 35)"
  os-accent: "oklch(0.68 0.22 35)"
  os-accent-soft: "oklch(0.88 0.075 35 / 0.78)"
  os-success: "oklch(0.62 0.18 145)"
  os-warning: "oklch(0.70 0.18 75)"
  os-danger: "oklch(0.58 0.21 25)"
  os-info: "oklch(0.62 0.18 245)"
  os-border: "oklch(0.78 0.030 35)"
  os-border-strong: "oklch(0.64 0.055 35)"
  os-focus: "oklch(0.68 0.22 35)"
  os-focus-ring: "oklch(0.68 0.22 35 / 0.30)"
typography:
  display:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: "2rem"
    fontWeight: 650
    lineHeight: 1.08
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: "1.375rem"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "-0.018em"
  title:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 620
    lineHeight: 1.3
    letterSpacing: "normal"
  body:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
  label:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "0.01em"
rounded:
  xs: "4px"
  sm: "7px"
  md: "9px"
  window: "10px"
  lg: "12px"
  xl: "14px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  xxl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.os-primary}"
    textColor: "{colors.os-primary-contrast}"
    rounded: "{rounded.sm}"
    padding: "0 12px"
    height: "32px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.os-muted}"
    rounded: "{rounded.sm}"
    padding: "0 10px"
    height: "32px"
  window-surface:
    backgroundColor: "{colors.os-panel}"
    textColor: "{colors.os-ink}"
    rounded: "{rounded.window}"
  input-default:
    backgroundColor: "{colors.os-surface}"
    textColor: "{colors.os-ink}"
    rounded: "{rounded.sm}"
    padding: "0 10px"
    height: "32px"
---

# Design System: NekoVirtOS

## Overview

**Creative North Star: "Quiet Windows Workstation"**

NekoVirtOS is a browser-based local workstation. Its desktop grammar is Windows-first: desktop icons, a cat-shaped Start button, a bottom taskbar, system tray, movable windows, maximize and snap actions, context menus, and keyboard window switching. Neko personality is deliberately concentrated in the cat mark, app icons, wallpaper choices, calm empty states, and small feedback details.

The current visual system is an operational 2D shell, not a marketing page. It uses a cool near-neutral architectural base, a user-selectable system accent, compact controls, and restrained layering. Solid tonal surfaces carry application work; translucency and blur are reserved for shell flyouts, the taskbar, the launcher, and other surfaces whose relationship to the desktop matters.

The first version supports responsive browser layouts, but it remains a desktop interaction model. A separate MMD VR preparation page and WebGL/WebXR session are intentionally outside this system and must not inherit the 2D desktop material layer.

### Current Scope

- The shell token pass, wallpaper pipeline, opaque Settings surface, taskbar, launcher, window frame, desktop selection, and context-menu styling are implemented.
- The taskbar defaults to icons only for new users; labels remain available as a persisted setting.
- Desktop widgets are optional and default to collapsed; they can be enabled from Settings.
- Desktop layout switching is available from the desktop context menu and Settings, not as permanent desktop chrome.
- The control center exposes immediate notification state, workspaces, notifications, Settings, VR entry, MMD VR entry, and lock actions. Theme and density remain in Settings.

### Planned Phases

- A true coarse-pointer touch workspace with full-screen applications, an app switcher, and split or Stage Manager-style multitasking is not implemented yet.
- Snap behavior exists, but a visual snap preview and a Windows 11 Snap Layout flyout are not implemented yet.
- Full command-bar/list-row convergence across every built-in app is not complete; existing app-specific behavior and content remain authoritative.
- Taskbar grouping for multiple windows of the same application and a complete shell icon-family migration remain follow-up work.

## Colors

The working palette is low-chroma neutral surfaces plus one active system accent. The default accent is coral; users can select other accent families, and the theme module recomputes both the primary state tokens and the neutral surface hue for light or dark mode.

The MMD VR preparation page uses this same system accent as its source of truth. Its preparation swatches update the shared accent setting, while the WebGL/WebXR HUD and stage derive a Quest-safe palette from that setting. The XR session, layout, lighting presets, and performance controls remain independent of the 2D desktop shell.

### Primary

- **Kernel Coral** (`os-primary`, `oklch(0.52 0.22 35)`): Default primary action, active marker, selected system state, and small Neko identity moments.
- **Kernel Coral Strong** (`os-primary-strong`, `oklch(0.45 0.22 35)`): Pressed and hover state for primary actions.
- **Kernel Wash** (`os-primary-soft`, `oklch(0.88 0.075 35 / 0.78)`): Selection fills, active rows, and quiet state surfaces.

### Secondary

- **Focus Accent** (`os-accent`, `oklch(0.68 0.22 35)`): Focus rings, app marks, and concise assistive emphasis. It is not a decorative page-wide glow.
- **Focus Wash** (`os-accent-soft`, `oklch(0.88 0.075 35 / 0.78)`): Low-intensity focus and notification state fill.

### Tertiary

- **Semantic Set** (`os-success`, `os-warning`, `os-danger`, `os-info`): Functional colors for successful file operations, warnings, destructive actions, and informational notifications. They should not become decorative panel backgrounds.

### Neutral

- **Desktop Ground** (`os-bg`, low-chroma accent hue): Base light desktop tone and fallback behind the wallpaper.
- **Quiet Surface** (`os-surface`, low-chroma accent hue): Toolbars, taskbar, navigation, and secondary shell surfaces.
- **Working Panel** (`os-panel`, low-chroma accent hue): Application windows and Settings content.
- **Elevated Surface** (`os-elevated`, low-chroma accent hue): Launcher, menus, flyouts, and frontmost contextual UI.
- **Ink** (`os-ink`, low-chroma accent hue): Primary text and essential control labels.
- **Muted Ink** (`os-muted`, low-chroma accent hue): Secondary labels, metadata, and inactive controls.
- **Subtle Ink** (`os-subtle`, low-chroma accent hue): Tertiary metadata, placeholders, and quiet indicators.
- **Structural Borders** (`os-border`, `os-border-strong`): One-pixel dividers, field strokes, window edges, and context-menu boundaries.

### Dark Mode

Dark mode keeps the same hierarchy with the selected accent's hue carried through low-chroma surfaces. The default coral primary lifts to `oklch(0.70 0.22 35)` for contrast.

### Named Rules

**The One Kernel Rule.** The selected system accent belongs on actions, focus, selection, and small identity marks. Its hue may gently tint low-chroma system surfaces, but application colors must not tint every window surface.

**The Surface Before Blur Rule.** Use a solid tonal layer first. Blur is limited to shell surfaces where it clarifies a floating relationship, and a solid fallback is provided for reduced-transparency preferences.

## Typography

**Display and Body Font:** The system UI stack: `ui-sans-serif`, system-ui, Segoe UI, PingFang SC, and Microsoft YaHei fallbacks.

**Label/Mono Font:** The same UI stack for shell labels. Monospace is reserved for code, terminal, and measured technical output.

**Character:** Compact, familiar, and quiet. The type system favors scanability in a dense desktop over a branded display voice.

### Hierarchy

- **Display** (650, `2rem`, `1.08`, `-0.025em`): Boot, About, and unusually large empty-state headings only.
- **Headline** (650, approximately `1.375rem`, `1.2`): Settings section headings and app-level empty states.
- **Title** (620, `0.8125rem`, `1.3`): Window titles, list headings, and compact panel titles.
- **Body** (400, `0.8125rem`, `1.55`): File content, settings explanations, notes, and ordinary application text.
- **Label** (600, `0.6875rem`, `1.25`): Toolbars, metadata, menu labels, status text, and short section labels.

### Named Rules

**The Product Type Rule.** Do not use display treatment in buttons, fields, menus, titlebars, or data rows. Desktop work should remain immediately legible.

## Layout

The desktop is a full-viewport workspace with a bottom system taskbar. On wide screens the taskbar is 52px high, flush to the bottom edge, with the Start control and running-window group centered and the system tray aligned to the right. New users see icon-only running applications; labels can be enabled in General Settings. The taskbar may be auto-hidden through the existing system preference.

Desktop icons occupy a left-side absolute work area and support selection, rectangle selection, drag, file drops, grid snapping, and free placement. Grid or free mode is exposed through the desktop context menu and Settings rather than persistent top-right controls. The desktop brand strap is intentionally absent; the wallpaper and icons are the primary desktop content. Optional widgets live in one compact right-side shell and start collapsed.

Windows use a 10px shell frame on the 2D desktop, a 40px titlebar, and a single window layer above the desktop. Maximized and immersive windows remove the frame radius. The existing window store remains responsible for focus, z-order, minimize, maximize, snap, tiling, cascading, workspaces, and persistence.

The main responsive breakpoint is 720px. Narrow layouts reduce desktop padding, make application windows nearly full-width, stack Settings navigation above content, collapse application sidebars, and keep the taskbar usable. This is responsive desktop behavior, not the future touch workspace.

Spacing follows the 4px base rhythm: 4, 8, 12, 16, 24, and 32px. Dense controls use 8-12px groups; shell panels use 12-16px internal spacing; large empty states may use 24-32px.

## Elevation & Depth

Depth is communicated by tonal layers and structural borders before shadows. Floating windows use the restrained system shadow `0 18px 44px oklch(0.20 0.035 258 / 0.20)` in light mode and `0 18px 44px oklch(0.02 0.02 258 / 0.48)` in dark mode. Menus, launchers, notifications, and shell flyouts use the same vocabulary with a small inner highlight. Idle application panels stay flat.

The taskbar, launcher, control center, notification center, clock panel, and command palette may use backdrop blur because they float over the desktop and need separation from the wallpaper. Settings and ordinary application content use opaque working panels. `prefers-reduced-transparency: reduce` switches floating shell surfaces to solid `os-elevated` backgrounds.

### Shadow Vocabulary

- **Window Float** (`0 18px 44px ...`): Movable application windows and dialogs over the desktop.
- **Menu Lift** (`var(--os-shadow)`): Context menus, launcher, command palette, notifications, and tray panels.
- **Inner Highlight** (`inset 0 1px 0 var(--os-inner-highlight)`): A quiet edge cue on elevated shell surfaces, never a substitute for contrast.

### Motion

Window entry uses a short 180ms translate-and-scale transition from an already visible frame. It does not begin at `opacity: 0`. Wallpaper changes preload remote images and cross-fade the incoming image; generation guards prevent stale asynchronous selections from winning. Minimize has its own exit animation. Reduced-motion settings and the platform preference collapse these transitions.

## Shapes

The 2D shell uses controlled soft rectangles rather than a floating-card vocabulary. Standard controls use 7-9px radii, shell windows use 10px, flyouts use 12px, and the launcher may use 14px. Maximized and immersive windows are square against the work area. Full pills are reserved for small status chips and legacy compact tags, not primary buttons or entire panels.

Borders are one pixel and neutral by default. Active state is communicated with a primary marker, selection wash, or stronger neutral border. Application colors remain available for app icons and small status points. Desktop labels receive a small contrast backing when the wallpaper needs it, rather than a permanent opaque desktop card.

## Components

### Buttons

- **Primary:** 32px high, 7px radius, `os-primary` fill, and `os-primary-contrast` text.
- **Ghost:** Transparent or quiet-surface background, muted text, 32px target, and an elevated tonal hover state.
- **Focus:** All interactive controls use the shared visible focus ring. Large-target accessibility settings raise relevant shell controls to at least 44px.
- **State:** Disabled controls reduce opacity and retain readable text; destructive actions use the semantic danger color and explicit confirmation.

### Navigation

The taskbar is a flush system strip, not a rounded dock card. Running applications use compact icons and a small bottom marker; the active application gets a primary marker rather than a colored block. The cat Start button is the one expressive shell mark. The system tray contains notifications, control center, Do Not Disturb, and clock actions; the old Local status capsule and layout-reset tray action are intentionally absent.

### Launcher

The launcher is a compact Start-menu surface with a search field, pinned applications, recent applications, and an all-apps icon grid. Application descriptions are available through the item tooltip but are hidden from the default grid so the launcher reads as a system menu rather than a catalogue. Pin controls appear on hover or keyboard focus instead of occupying every item at rest.

### Window

The window frame is neutral and reliable: 10px radius, one-pixel border, opaque `os-panel` content, compact titlebar, app icon, title, and predictable controls. Active windows get a small primary title marker. The titlebar remains draggable, and existing maximize, minimize, close, fullscreen, snap, workspace, and context-menu actions remain intact.

### Desktop

The desktop contains wallpaper, left-aligned icons, optional files, selection feedback, and contextual actions. Brand explanation is not permanent desktop content. Grid/free layout, hidden-app restoration, file creation, window arrangement, and reset actions are discoverable from the desktop context menu or command palette.

### Control Center

The control center is a single neutral flyout. Immediate state is limited to Do Not Disturb and workspace selection. Theme and density are Settings concerns. Secondary rows link to notification history, Settings, optional VR Desktop, the independent MMD VR page, and session lock.

### Settings

Settings is a continuous working surface with a compact navigation rail, search, and grouped rows/cards. Theme mode, accent, density, wallpaper slots, wallpaper fit, and wallpaper overlay are edited here. Wallpaper selection preloads remote images, applies the selection immediately, preserves independent light/dark slots, and falls back to the built-in system wallpaper when offline or unavailable. Settings content is explicitly opaque so the desktop wallpaper cannot show through.

## Do's and Don'ts

### Do:

- **Do** use Windows desktop syntax for the default 2D shell: Start, taskbar, tray, titlebar controls, snap actions, and context menus.
- **Do** keep shell surfaces neutral and use the selected accent for actions, focus, selection, and small markers.
- **Do** let the MMD VR preparation swatches edit the shared system accent; the MMD WebGL HUD and stage should follow it without importing desktop window, taskbar, or launcher chrome.
- **Do** preserve visible focus, keyboard window switching, reduced-motion behavior, and large-target accessibility settings.
- **Do** keep wallpaper asynchronous work generation-safe and make the currently displayed wallpaper explicit in persisted settings.
- **Do** keep the MMD VR page and WebXR session isolated from desktop shell CSS and state.
- **Do** expose optional widgets and taskbar labels as user preferences instead of forcing dashboard content into the default desktop.

### Don't:

- **Don't** reintroduce macOS Dock magnification, neighbor lift, or a floating rounded taskbar card.
- **Don't** put permanent brand copy, layout controls, or reset controls in the desktop chrome when a context menu or Settings surface can own them.
- **Don't** use multi-color gradient cards as the default control-center or application-surface language.
- **Don't** let wallpaper or translucent shell material bleed into Settings or ordinary working panels.
- **Don't** present the responsive desktop adaptation as an iPadOS/touch mode until the interaction model changes to full-screen apps and touch-first multitasking.
- **Don't** move application logic, filesystem behavior, MMD Studio, or the independent MMD VR entry into the desktop material layer merely to achieve visual consistency.
