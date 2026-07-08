<!-- SEED: re-run $impeccable document once there's code to capture the actual tokens and components. -->
---
name: NekoVirtOS
description: A quiet, precise, cute browser-based virtual desktop system for local-first work.
colors:
  os-bg: "oklch(0.095 0 0)"
  os-surface: "oklch(0.145 0.008 20)"
  os-panel: "oklch(0.190 0.010 20)"
  os-elevated: "oklch(0.235 0.012 20)"
  os-ink: "oklch(0.940 0.006 20)"
  os-muted: "oklch(0.690 0.010 20)"
  os-subtle: "oklch(0.500 0.010 20)"
  os-primary: "oklch(0.520 0.155 20)"
  os-primary-strong: "oklch(0.450 0.150 20)"
  os-primary-soft: "oklch(0.260 0.055 20)"
  os-accent: "oklch(0.760 0.115 330)"
  os-accent-soft: "oklch(0.300 0.050 330)"
  os-success: "oklch(0.680 0.120 150)"
  os-warning: "oklch(0.760 0.125 75)"
  os-danger: "oklch(0.620 0.160 25)"
  os-info: "oklch(0.700 0.105 245)"
  os-border: "oklch(0.300 0.010 20)"
  os-border-strong: "oklch(0.420 0.020 20)"
  os-focus: "oklch(0.760 0.115 330)"
typography:
  display:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "2rem"
    fontWeight: 650
    lineHeight: 1.08
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "1.5rem"
    fontWeight: 620
    lineHeight: 1.15
    letterSpacing: "-0.018em"
  title:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "0.75rem"
    fontWeight: 560
    lineHeight: 1.25
    letterSpacing: "0.01em"
rounded:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "14px"
  xl: "16px"
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
    textColor: "{colors.os-ink}"
    rounded: "{rounded.sm}"
    padding: "0 14px"
    height: "32px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.os-muted}"
    rounded: "{rounded.sm}"
    padding: "0 10px"
    height: "30px"
  window-surface:
    backgroundColor: "{colors.os-panel}"
    textColor: "{colors.os-ink}"
    rounded: "{rounded.lg}"
  input-default:
    backgroundColor: "{colors.os-surface}"
    textColor: "{colors.os-ink}"
    rounded: "{rounded.sm}"
    padding: "0 10px"
    height: "32px"
---

# Design System: NekoVirtOS

## 1. Overview

**Creative North Star: "Quiet Neko Workstation"**

NekoVirtOS is a desktop system for late-night local work: calm enough to keep open for hours, precise enough to trust with files and windows, and cute only where the detail helps the user remember the system. The atmosphere is a dark, low-luminance workstation with oxblood identity marks and soft rose-violet focus accents. The desktop should feel owned and personal, not themed like a toy.

This is product UI. The design serves window management, text editing, file actions, and repeated app use. Visual personality appears through app icons, state dots, empty states, microcopy, and motion details; it must never interrupt standard desktop behaviors.

NekoVirtOS explicitly rejects generic SaaS dashboard language, low-fidelity retro toy OS tropes, and overly anime-themed interfaces where characters or decoration dominate the workflow. It also rejects cheap glassmorphism: blur may be used only when it clarifies depth or a modal relationship.

**Key Characteristics:**
- Dark, near-neutral architectural background with warm crimson identity marks.
- Compact desktop density: toolbars, titlebars, menus, and inputs are small but readable.
- Cute through precision: tiny Neko cues, calm empty states, and soft status details instead of large decorative mascots.
- Clear layering: window focus, active apps, selection, and file persistence must be visually obvious.
- Desktop-native behavior: predictable titlebars, taskbar states, context menus, focus rings, and reversible actions.

## 2. Colors

The palette is restrained: near-black neutral surfaces carry the workload, while oxblood crimson and rose-violet appear in small, deliberate system states.

### Primary
- **Oxblood Kernel** (`os-primary`, `os-primary-strong`): The identity color for primary actions, active app markers, selected system states, and sparse brand moments. Use it on no more than 10% of a typical screen.
- **Soft Kernel Wash** (`os-primary-soft`): Low-luminance fill for selected rows, active tabs, and subtle app identity surfaces where saturated crimson would be too loud.

### Secondary
- **Neko Focus Rose** (`os-accent`, `os-accent-soft`): The focus and assistive accent. Use it for focus rings, command palette highlights, text cursor accents, and one-off Neko personality moments.

### Tertiary
- **System Semantic Set** (`os-success`, `os-warning`, `os-danger`, `os-info`): Status colors for filesystem actions, validation, destructive operations, and notifications. These colors are functional, not decorative.

### Neutral
- **Midnight Desktop** (`os-bg`): The full desktop background. Keep it almost pure black with no warm cream, sand, paper, or decorative grid treatment.
- **Quiet Surface** (`os-surface`): Toolbars, docks, menus, and secondary panels.
- **Working Panel** (`os-panel`): Standard application windows and main panels.
- **Lifted Panel** (`os-elevated`): Popovers, command palette, active floating panels, and frontmost contextual UI.
- **Milk Ink** (`os-ink`): Primary text. Body copy and controls should prefer this over weak gray.
- **Muted Ink** (`os-muted`): Secondary text, timestamps, metadata, and inactive labels. Do not use it for critical actions or body text on low-contrast surfaces.
- **Subtle Ink** (`os-subtle`): Dividers, placeholder-adjacent hints, disabled labels, and tertiary metadata only.
- **Quiet Border** (`os-border`, `os-border-strong`): Structural borders for windows, fields, menus, and separators.

### Named Rules

**The Ten Percent Kernel Rule.** Crimson is the system identity, not decoration. If `os-primary` covers more than 10% of a normal workspace, the interface has become a theme instead of a tool.

**The No Cheap Glass Rule.** Blur is forbidden as a default surface treatment. Use solid tonal layers first; use backdrop filtering only for modal context or a deliberate focus effect.

## 3. Typography

**Display Font:** Inter with system sans fallbacks.
**Body Font:** Inter with system sans fallbacks.
**Label/Mono Font:** Use the same sans for MVP; introduce a mono face only for terminal/code surfaces.

**Character:** The type system is compact, technical, and quiet. It should feel like a careful desktop UI rather than a landing page. One well-tuned sans family is correct here; display pairings would add noise.

### Hierarchy
- **Display** (650, `2rem`, `1.08`, `-0.025em`): Used sparingly in onboarding, About System, and empty-state headlines. Never use massive hero typography inside the OS.
- **Headline** (620, `1.5rem`, `1.15`, `-0.018em`): App-level headings such as Settings sections, file manager landing states, and first-run panels.
- **Title** (600, `1rem`, `1.3`, `-0.01em`): Window titles, dialog titles, sidebar group headings, and prominent list headers.
- **Body** (400, `0.875rem`, `1.55`): Standard content, file previews, settings descriptions, and notes. Long prose should cap at 65-75ch.
- **Label** (560, `0.75rem`, `1.25`, `0.01em`): Toolbar labels, metadata, menu labels, chips, field labels, and status text. Avoid all-caps except for very short technical tags.

### Named Rules

**The Product Type Rule.** No display fonts in buttons, fields, menus, tables, or titlebars. If the user is doing a task, typography must stay familiar and compact.

## 4. Elevation

NekoVirtOS uses tonal layering first and shadows second. Depth should be readable from surface color, border strength, and focus treatment before any shadow appears. Windows can cast a restrained structural shadow when floating over the desktop, but idle panels and controls should remain flat.

### Shadow Vocabulary
- **Window Float** (`0 18px 48px oklch(0 0 0 / 0.34)`): Frontmost windows and dialogs only. Do not pair with a decorative wide glow.
- **Menu Lift** (`0 10px 28px oklch(0 0 0 / 0.30)`): Context menus, command palette, select popovers, and notification trays.
- **Focus Halo** (`0 0 0 3px oklch(0.760 0.115 330 / 0.28)`): Keyboard focus and precise interaction targets. This is state feedback, not decoration.

### Named Rules

**The Layer Before Shadow Rule.** If a surface cannot be understood without a large shadow, fix its tonal layer, border, or placement first.

## 5. Components

### Buttons
- **Shape:** Compact rounded rectangle with controlled softness (`8px`). Pills are reserved for chips and status tags, not standard buttons.
- **Primary:** Oxblood fill with near-white text, `32px` height, horizontal padding of `14px`. Use for the main action in a dialog, save/apply actions, or selected launch commands.
- **Hover / Focus:** Hover slightly raises luminance or shifts to `os-primary-strong`; focus uses `os-focus` halo. Transition duration should sit between `120ms` and `180ms`.
- **Secondary / Ghost:** Transparent or quiet-surface buttons with muted text. On hover, use `os-elevated` background and `os-ink` text. Ghost buttons must not look disabled.

### Chips
- **Style:** Pill radius only (`999px`), small height (`22-26px`), compact padding, and either soft crimson/rose fills or neutral surface fills.
- **State:** Selected chips use `os-primary-soft` with `os-ink`; unselected chips use `os-surface` and `os-muted`. Never use fully saturated inactive chips.

### Cards / Containers
- **Corner Style:** Standard panels use `12px`; windows use `14px`; large dialogs may use `16px`. Cards and panels must never exceed `16px` radius.
- **Background:** Use `os-panel` for application windows, `os-surface` for toolbars and docks, and `os-elevated` for floating context UI.
- **Shadow Strategy:** Follow the Layer Before Shadow Rule. Shadows belong to floating windows, menus, dialogs, and overlays only.
- **Border:** Use `1px` borders with `os-border`; active windows may use `os-border-strong` plus a small identity marker.
- **Internal Padding:** Dense system components use `8-12px`; panels and dialogs use `16-24px`; large empty states can use `32px`.

### Inputs / Fields
- **Style:** `32px` height for standard fields, `8px` radius, `os-surface` background, `1px` `os-border` stroke, `os-ink` text.
- **Focus:** Border shifts to `os-focus` with the Focus Halo. Placeholder text must be readable enough; do not default to barely visible gray.
- **Error / Disabled:** Errors use `os-danger` border and concise inline text. Disabled fields reduce contrast but must remain legible and visibly non-interactive.

### Navigation
- **Style:** Taskbar, dock, launcher, and app sidebars use solid quiet surfaces with compact labels and consistent icon stroke. Active items use small crimson markers, not large filled blocks.
- **Hover / Active:** Hover reveals a tonal lift; active state adds a persistent marker or soft fill. Focus state must be visible even when the pointer is not used.
- **Desktop Treatment:** First version is desktop-only. Design for precise pointer use, keyboard focus, and fixed work areas rather than touch-first mobile behavior.

### Window

The window is the signature component. It should feel precise, reliable, and desktop-native.

- **Frame:** `14px` radius, `1px` quiet border, `os-panel` background.
- **Titlebar:** `34-40px` height, compact app icon, title text, and predictable control placement.
- **Active State:** Active window gets a stronger border, clearer titlebar text, and optional small crimson focus marker. Inactive windows reduce titlebar contrast but remain readable.
- **Resize / Drag:** Handles must be discoverable without visual clutter. The cursor and active edge state are part of the design vocabulary.
- **Motion:** Opening windows may use `120-180ms` opacity plus subtle scale from `0.985` to `1`. Reduced motion disables scale.

### File Item

File rows and desktop icons must make persistence feel trustworthy.

- **Rows:** Dense list rows use `30-34px` height with clear selection and hover states.
- **Desktop Icons:** Labels must remain readable on the desktop background. Use a subtle text backing only when needed for contrast.
- **Selection:** Use `os-primary-soft` or rose focus treatment, not bright saturated fills.
- **Destructive State:** Delete and overwrite actions must use `os-danger` and explicit confirmation language.

## 6. Do's and Don'ts

### Do:
- **Do** keep Neko personality small and functional: app icons, state dots, empty-state copy, and subtle motion are the right places.
- **Do** use dark tonal layers to separate desktop, windows, toolbars, menus, and popovers before adding shadows.
- **Do** keep standard controls compact: buttons around `30-34px`, titlebars around `34-40px`, inputs around `32px`.
- **Do** use visible focus states on every interactive control, especially window chrome, app launcher items, file rows, and text editor controls.
- **Do** treat saved local state as a visible product concern: file changes, window state, and settings persistence should have clear feedback.
- **Do** include reduced-motion alternatives for window, menu, and launcher transitions.

### Don't:
- **Don't** make NekoVirtOS look like a generic SaaS dashboard. No hero-metric layouts, marketing card grids, pricing-page rhythm, or template landing-page sections inside the OS.
- **Don't** make it a low-fidelity retro toy OS. Avoid fake pixel nostalgia, chunky novelty controls, and intentionally awkward desktop behaviors.
- **Don't** make it overly anime-themed. Characters, mascots, and decorative art must never dominate file management, text editing, settings, or window work.
- **Don't** use cheap glassmorphism as the default. Solid panels are the baseline; blur only earns a place when it clarifies modal depth.
- **Don't** use gradient text, colored side-stripe borders, decorative grid backgrounds, or repeated identical icon cards.
- **Don't** over-round panels. Cards, windows, inputs, and sections top out at `16px`; only chips and tiny status pills may be full pill.
- **Don't** pair a decorative `1px` border with a wide soft shadow on cards or controls. Choose structure or lift, not both as decoration.
