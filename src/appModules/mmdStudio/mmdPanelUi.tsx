import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useLanguageStore } from "../../languageStore";
import { DEFAULT_MATERIAL_OVERRIDE, type MmdMaterialOverride } from "./mmdStudioStore";

export type MmdSelectOption<T extends string = string> = {
  value: T;
  label: string;
  disabled?: boolean;
};

export function MmdSelect<T extends string = string>({
  value,
  options,
  disabled = false,
  onChange,
  ariaLabel,
  className,
}: {
  value: T;
  options: readonly MmdSelectOption<T>[];
  disabled?: boolean;
  onChange: (value: T) => void;
  ariaLabel?: string;
  className?: string;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | undefined>();
  const [highlight, setHighlight] = useState(() =>
    Math.max(0, options.findIndex((item) => item.value === value)),
  );

  const selected = useMemo(
    () => options.find((item) => item.value === value) ?? options[0] ?? null,
    [options, value],
  );

  const enabledIndexes = useMemo(
    () => options.map((item, index) => (item.disabled ? -1 : index)).filter((index) => index >= 0),
    [options],
  );

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close();
    };
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [close, open]);

  useEffect(() => {
    if (!open) return;
    const index = options.findIndex((item) => item.value === value);
    setHighlight(index >= 0 ? index : enabledIndexes[0] ?? 0);
  }, [enabledIndexes, open, options, value]);

  useLayoutEffect(() => {
    if (!open || !rootRef.current) {
      setMenuStyle(undefined);
      return;
    }
    const rect = rootRef.current.getBoundingClientRect();
    const maxH = Math.min(240, window.innerHeight * 0.42);
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const openUp = spaceBelow < 120 && rect.top > spaceBelow;
    setMenuStyle({
      position: "fixed",
      left: rect.left,
      width: Math.max(rect.width, 120),
      zIndex: 200,
      maxHeight: maxH,
      ...(openUp
        ? { bottom: window.innerHeight - rect.top + 4, top: "auto" }
        : { top: rect.bottom + 4, bottom: "auto" }),
    });
  }, [open, options.length, value]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-index="${highlight}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [highlight, open]);

  function moveHighlight(delta: number) {
    if (!enabledIndexes.length) return;
    const currentPos = enabledIndexes.indexOf(highlight);
    const start = currentPos >= 0 ? currentPos : 0;
    const nextPos = (start + delta + enabledIndexes.length) % enabledIndexes.length;
    setHighlight(enabledIndexes[nextPos] ?? 0);
  }

  function commit(index: number) {
    const option = options[index];
    if (!option || option.disabled) return;
    onChange(option.value);
    close();
  }

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      if (event.key === "Enter" || event.key === " ") commit(highlight);
      if (event.key === "ArrowDown") moveHighlight(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) setOpen(true);
      else moveHighlight(-1);
    } else if (event.key === "Home") {
      event.preventDefault();
      if (enabledIndexes.length) setHighlight(enabledIndexes[0]!);
    } else if (event.key === "End") {
      event.preventDefault();
      if (enabledIndexes.length) setHighlight(enabledIndexes[enabledIndexes.length - 1]!);
    }
  }

  return (
    <div
      ref={rootRef}
      className={["mmd-select", open ? "is-open" : "", disabled ? "is-disabled" : "", className ?? ""].filter(Boolean).join(" ")}
    >
      <button
        type="button"
        className="mmd-select-trigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        onClick={() => {
          if (!disabled) setOpen((prev) => !prev);
        }}
        onKeyDown={onTriggerKeyDown}
      >
        <span className="mmd-select-value">{selected?.label ?? "—"}</span>
        <span className="mmd-select-chevron" aria-hidden>▾</span>
      </button>
      {open ? (
        <div
          ref={listRef}
          id={listId}
          className="mmd-select-menu"
          style={menuStyle}
          role="listbox"
          aria-activedescendant={`${listId}-opt-${highlight}`}
        >
          {options.map((option, index) => {
            const isSelected = option.value === value;
            const isActive = index === highlight;
            return (
              <button
                key={option.value}
                type="button"
                id={`${listId}-opt-${index}`}
                data-index={index}
                role="option"
                aria-selected={isSelected}
                disabled={option.disabled}
                className={[
                  "mmd-select-option",
                  isSelected ? "is-selected" : "",
                  isActive ? "is-active" : "",
                ].filter(Boolean).join(" ")}
                onMouseEnter={() => {
                  if (!option.disabled) setHighlight(index);
                }}
                onClick={() => commit(index)}
              >
                <span>{option.label}</span>
                {isSelected ? <span className="mmd-select-check" aria-hidden>✓</span> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function PanelSection({
  title,
  children,
  actions,
  collapsible = false,
  defaultOpen = true,
}: {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  const t = useLanguageStore((state) => state.t);
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="mmd-panel">
      <header className="mmd-panel-head">
        <h3>{title}</h3>
        <div className="mmd-panel-actions">
          {actions}
          {collapsible ? (
            <button type="button" className="button-ghost mmd-mini-btn" onClick={() => setOpen((value) => !value)}>
              {open ? t("mmdCollapse") : t("mmdExpand")}
            </button>
          ) : null}
        </div>
      </header>
      {open ? <div className="mmd-panel-body">{children}</div> : null}
    </section>
  );
}

/** Lightweight collapsible block for nesting inside PanelSection (no second panel chrome). */
export function NestedPanel({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`mmd-nested-panel${open ? " is-open" : ""}`}>
      <button
        type="button"
        className="mmd-nested-panel-summary"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {title}
      </button>
      {open ? <div className="mmd-nested-panel-body">{children}</div> : null}
    </div>
  );
}

export function AssetRow({
  label,
  value,
  onPick,
  pickLabel,
}: {
  label: string;
  value: string | null;
  onPick: () => void;
  pickLabel: string;
}) {
  return (
    <div className="mmd-asset-row">
      <div className="mmd-asset-meta">
        <span className="mmd-asset-label">{label}</span>
        <strong className={value ? undefined : "is-empty"} title={value ?? undefined}>{value ?? "—"}</strong>
      </div>
      <button type="button" className="button-ghost mmd-mini-btn" onClick={onPick}>{pickLabel}</button>
    </div>
  );
}

export function SliderField({
  label,
  value,
  min,
  max,
  step,
  display,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  const span = max - min;
  const progress = span > 0 ? Math.min(100, Math.max(0, ((value - min) / span) * 100)) : 0;
  return (
    <label className={disabled ? "mmd-slider is-disabled" : "mmd-slider"}>
      <span className="mmd-slider-top">
        <span>{label}</span>
        <span className="mmd-slider-value">{display}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        style={{ ["--os-range-progress" as string]: `${progress}%` }}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

export function NumberField({
  label,
  value,
  step = 0.1,
  min,
  max,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  step?: number;
  min?: number;
  max?: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label className={disabled ? "mmd-field is-disabled" : "mmd-field"}>
      <span>{label}</span>
      <input
        type="number"
        className="mmd-number-input"
        value={Number.isFinite(value) ? value : 0}
        step={step}
        min={min}
        max={max}
        disabled={disabled}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (!Number.isFinite(next)) return;
          let clamped = next;
          if (min != null) clamped = Math.max(min, clamped);
          if (max != null) clamped = Math.min(max, clamped);
          onChange(clamped);
        }}
      />
    </label>
  );
}

const MAT_PRESETS = [
  {
    id: "toon" as const,
    labelKey: "mmdMatPresetToon" as const,
    hintKey: "mmdMatPresetToonHint" as const,
    patch: {
      lightingModel: "toon" as const,
      specularMode: "mmd" as const,
      envInfluence: 0,
      metallic: 0,
      roughness: 0.55,
    },
  },
  {
    id: "hybrid" as const,
    labelKey: "mmdMatPresetHybrid" as const,
    hintKey: "mmdMatPresetHybridHint" as const,
    patch: {
      lightingModel: "pbr" as const,
      specularMode: "mmd+env" as const,
      envInfluence: 1,
      metallic: 0.05,
      roughness: 0.45,
    },
  },
  {
    id: "metal" as const,
    labelKey: "mmdMatPresetMetal" as const,
    hintKey: "mmdMatPresetMetalHint" as const,
    patch: {
      lightingModel: "pbr" as const,
      specularMode: "env" as const,
      envInfluence: 1.4,
      metallic: 0.85,
      roughness: 0.22,
    },
  },
  {
    id: "gloss" as const,
    labelKey: "mmdMatPresetGloss" as const,
    hintKey: "mmdMatPresetGlossHint" as const,
    patch: {
      lightingModel: "pbr" as const,
      specularMode: "mmd+env" as const,
      envInfluence: 1.1,
      metallic: 0.02,
      roughness: 0.12,
    },
  },
];

function matchMatPreset(value: MmdMaterialOverride): (typeof MAT_PRESETS)[number]["id"] | "custom" {
  for (const preset of MAT_PRESETS) {
    const p = preset.patch;
    if (
      value.lightingModel === p.lightingModel
      && value.specularMode === p.specularMode
      && Math.abs(value.envInfluence - p.envInfluence) < 0.06
      && Math.abs(value.metallic - p.metallic) < 0.06
      && Math.abs(value.roughness - p.roughness) < 0.06
    ) {
      return preset.id;
    }
  }
  return "custom";
}

function matPresetSummaryLabel(
  presetId: ReturnType<typeof matchMatPreset>,
  t: ReturnType<typeof useLanguageStore.getState>["t"],
) {
  if (presetId === "custom") return t("mmdMatPresetCustom");
  const hit = MAT_PRESETS.find((item) => item.id === presetId);
  return hit ? t(hit.labelKey) : t("mmdMatPresetCustom");
}

/** Presets first; advanced (maps / lighting model) collapsed. */
export function MaterialOverrideEditor({
  name,
  value,
  onChange,
}: {
  modelId: string;
  name: string;
  value: MmdMaterialOverride;
  onChange: (patch: Partial<MmdMaterialOverride>) => void;
}) {
  const t = useLanguageStore((state) => state.t);
  const activePreset = matchMatPreset(value);
  const showReflectSliders = value.specularMode !== "mmd";

  return (
    <details className="mmd-material-card">
      <summary>
        <span title={name}>{name}</span>
        <span className="mmd-mono mmd-mat-summary-meta">
          {matPresetSummaryLabel(activePreset, t)}
          <span className="mmd-mat-summary-sep">·</span>
          {value.opacity.toFixed(2)}
        </span>
      </summary>
      <div className="mmd-fx-grid">
        <div className="mmd-preset-chips" role="group" aria-label={t("mmdMatPresets")}>
          {MAT_PRESETS.map((preset) => {
            const active = activePreset === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                className={active ? "mmd-chip is-active" : "mmd-chip"}
                title={t(preset.hintKey)}
                aria-pressed={active}
                onClick={() => onChange(preset.patch)}
              >
                {t(preset.labelKey)}
              </button>
            );
          })}
          {activePreset === "custom" ? (
            <span className="mmd-chip is-muted" aria-current="true">
              {t("mmdMatPresetCustom")}
            </span>
          ) : null}
        </div>
        <SliderField label={t("mmdMatOpacity")} value={value.opacity} min={0} max={1} step={0.01} display={value.opacity.toFixed(2)} onChange={(opacity) => onChange({ opacity })} />
        {showReflectSliders ? (
          <>
            <SliderField label={t("mmdMatRoughness")} value={value.roughness} min={0} max={1} step={0.01} display={value.roughness.toFixed(2)} onChange={(roughness) => onChange({ roughness })} />
            <SliderField label={t("mmdMatMetallic")} value={value.metallic} min={0} max={1} step={0.01} display={value.metallic.toFixed(2)} onChange={(metallic) => onChange({ metallic })} />
            <SliderField label={t("mmdMatEnv")} value={value.envInfluence} min={0} max={3} step={0.01} display={value.envInfluence.toFixed(2)} onChange={(envInfluence) => onChange({ envInfluence })} />
          </>
        ) : null}
        <details className="mmd-nested-advanced">
          <summary>{t("mmdMatAdvanced")}</summary>
          <div className="mmd-fx-grid">
            <label className="mmd-field">
              <span>{t("mmdMatLightingModel")}</span>
              <MmdSelect
                value={value.lightingModel}
                ariaLabel={t("mmdMatLightingModel")}
                onChange={(next) => {
                  const lightingModel = next as MmdMaterialOverride["lightingModel"];
                  // Keep combinations coherent when switching models.
                  if (lightingModel === "toon" && value.specularMode === "env") {
                    onChange({ lightingModel, specularMode: "mmd+env", envInfluence: Math.max(value.envInfluence, 1) });
                  } else if (lightingModel === "pbr" && value.specularMode === "mmd") {
                    onChange({ lightingModel, specularMode: "mmd+env", envInfluence: Math.max(value.envInfluence, 0.8) });
                  } else {
                    onChange({ lightingModel });
                  }
                }}
                options={[
                  { value: "toon", label: t("mmdMatLightingToon") },
                  { value: "pbr", label: t("mmdMatLightingPbr") },
                ]}
              />
            </label>
            <label className="mmd-field">
              <span>{t("mmdMatSpecularMode")}</span>
              <MmdSelect
                value={value.specularMode}
                ariaLabel={t("mmdMatSpecularMode")}
                onChange={(next) => {
                  const mode = next as MmdMaterialOverride["specularMode"];
                  if (mode === "mmd") {
                    onChange({ specularMode: "mmd", lightingModel: "toon" });
                    return;
                  }
                  const envInfluence = value.envInfluence < 0.05 ? 1 : value.envInfluence;
                  if (mode === "env") {
                    onChange({ specularMode: "env", lightingModel: "pbr", envInfluence });
                    return;
                  }
                  onChange({ specularMode: "mmd+env", envInfluence });
                }}
                options={[
                  { value: "mmd", label: t("mmdMatSpecularMmd") },
                  { value: "mmd+env", label: t("mmdMatSpecularHybrid") },
                  { value: "env", label: t("mmdMatSpecularEnv") },
                ]}
              />
            </label>
            <SliderField label={t("mmdMatEmission")} value={value.emission} min={0} max={5} step={0.01} display={value.emission.toFixed(2)} onChange={(emission) => onChange({ emission })} />
            <SliderField label={t("mmdMatOcclusion")} value={value.occlusion} min={0} max={1} step={0.01} display={value.occlusion.toFixed(2)} onChange={(occlusion) => onChange({ occlusion })} />
            <label className="mmd-field">
              <span>{t("mmdMatEmissionColor")}</span>
              <input type="color" className="mmd-color-input" value={value.emissionColor} onChange={(event) => onChange({ emissionColor: event.target.value })} />
            </label>
            <label className="mmd-field">
              <span>{t("mmdMatAoMap")}</span>
              <div className="mmd-file-row">
                <input type="file" accept="image/*" onChange={(event) => onChange({ aoMapFile: event.target.files?.[0] ?? null })} />
                <button type="button" className="button-ghost mmd-mini-btn" onClick={() => onChange({ aoMapFile: null })}>
                  {t("mmdClear")}
                </button>
              </div>
              <small className="mmd-note">{value.aoMapFile?.name ?? "—"}</small>
            </label>
            <label className="mmd-field">
              <span>{t("mmdMatEmissionMap")}</span>
              <div className="mmd-file-row">
                <input type="file" accept="image/*" onChange={(event) => onChange({ emissionMapFile: event.target.files?.[0] ?? null })} />
                <button type="button" className="button-ghost mmd-mini-btn" onClick={() => onChange({ emissionMapFile: null })}>
                  {t("mmdClear")}
                </button>
              </div>
              <small className="mmd-note">{value.emissionMapFile?.name ?? "—"}</small>
            </label>
            <label className="mmd-field">
              <span>{t("mmdMatMaskMap")}</span>
              <div className="mmd-file-row">
                <input type="file" accept="image/*" onChange={(event) => onChange({ maskMapFile: event.target.files?.[0] ?? null })} />
                <button type="button" className="button-ghost mmd-mini-btn" onClick={() => onChange({ maskMapFile: null })}>
                  {t("mmdClear")}
                </button>
              </div>
              <small className="mmd-note">{value.maskMapFile?.name ?? "—"}</small>
            </label>
            <button type="button" className="button-ghost mmd-mini-btn" onClick={() => onChange({ ...DEFAULT_MATERIAL_OVERRIDE })}>
              {t("mmdMatReset")}
            </button>
          </div>
        </details>
      </div>
    </details>
  );
}
