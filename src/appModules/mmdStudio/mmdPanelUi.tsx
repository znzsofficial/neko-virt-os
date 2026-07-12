import { useState, type ReactNode } from "react";
import { useLanguageStore } from "../../languageStore";
import { DEFAULT_MATERIAL_OVERRIDE, type MmdMaterialOverride } from "./mmdStudioStore";

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

export function classifyMorph(name: string) {
  const n = name.toLowerCase();
  if (/(eye|目|瞳|まばたき|blink)/i.test(name) || n.includes("eye")) return "eye";
  if (/(mouth|口|lip|あ|い|う|え|お)/i.test(name) || n.includes("mouth")) return "mouth";
  if (/(brow|眉|まゆ|eyebrow)/i.test(name) || n.includes("brow")) return "brow";
  if (/(face|顔|head)/i.test(name)) return "face";
  return "other";
}

export function morphGroupLabel(group: string, t: ReturnType<typeof useLanguageStore.getState>["t"]) {
  switch (group) {
    case "eye": return t("mmdMorphGroupEye");
    case "mouth": return t("mmdMorphGroupMouth");
    case "brow": return t("mmdMorphGroupBrow");
    case "face": return t("mmdMorphGroupFace");
    default: return t("mmdMorphGroupOther");
  }
}

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
  return (
    <details className="mmd-material-card">
      <summary>
        <span title={name}>{name}</span>
        <span className="mmd-mono">{value.opacity.toFixed(2)}</span>
      </summary>
      <div className="mmd-fx-grid">
        <SliderField label={t("mmdMatOpacity")} value={value.opacity} min={0} max={1} step={0.01} display={value.opacity.toFixed(2)} onChange={(opacity) => onChange({ opacity })} />
        <SliderField label={t("mmdMatEmission")} value={value.emission} min={0} max={5} step={0.01} display={value.emission.toFixed(2)} onChange={(emission) => onChange({ emission })} />
        <SliderField label={t("mmdMatEnv")} value={value.envInfluence} min={0} max={3} step={0.01} display={value.envInfluence.toFixed(2)} onChange={(envInfluence) => onChange({ envInfluence })} />
        <SliderField label={t("mmdMatOcclusion")} value={value.occlusion} min={0} max={1} step={0.01} display={value.occlusion.toFixed(2)} onChange={(occlusion) => onChange({ occlusion })} />
        <SliderField label={t("mmdMatMetallic")} value={value.metallic} min={0} max={1} step={0.01} display={value.metallic.toFixed(2)} onChange={(metallic) => onChange({ metallic })} />
        <SliderField label={t("mmdMatRoughness")} value={value.roughness} min={0} max={1} step={0.01} display={value.roughness.toFixed(2)} onChange={(roughness) => onChange({ roughness })} />
        <label className="mmd-field">
          <span>{t("mmdMatLightingModel")}</span>
          <select value={value.lightingModel} onChange={(event) => onChange({ lightingModel: event.target.value as MmdMaterialOverride["lightingModel"] })}>
            <option value="toon">{t("mmdMatLightingToon")}</option>
            <option value="pbr">{t("mmdMatLightingPbr")}</option>
          </select>
        </label>
        <label className="mmd-field">
          <span>{t("mmdMatSpecularMode")}</span>
          <select value={value.specularMode} onChange={(event) => onChange({ specularMode: event.target.value as MmdMaterialOverride["specularMode"] })}>
            <option value="mmd">{t("mmdMatSpecularMmd")}</option>
            <option value="mmd+env">{t("mmdMatSpecularHybrid")}</option>
            <option value="env">{t("mmdMatSpecularEnv")}</option>
          </select>
        </label>
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
  );
}
