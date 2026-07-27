import { Icon } from "@iconify-icon/react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { useLanguageStore } from "../languageStore";
import {
  collectFilesFromDataTransfer,
  companionsForModel,
  listMmdModels,
  listMmdMotions,
  relativePath,
} from "../mmdImport/folderFiles";
import { useNotificationStore } from "../notificationStore";
import { MmdVrOverlay } from "./MmdVrOverlay";
import { MMD_VR_MAX_MODELS, type MmdVrAssetSlot } from "./mmdVrAssets";
import { formatMmdVrProfileSummary, getMmdVrRenderProfile } from "./mmdVrQuality";
import { requestMmdVrEnter } from "./requestMmdVrEnter";
import { useMmdVrStore } from "./mmdVrStore";
import { XR_THEME_COLORS, getXrAccentTokens } from "../xr";

function OptionGroup<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: readonly { id: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="mmd-vr-prep-options">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          className={value === option.id ? "is-active" : ""}
          aria-pressed={value === option.id}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

type QuestPreset = "safe" | "balanced" | "clarity" | "custom";

function getQuestPreset(prefs: ReturnType<typeof useMmdVrStore.getState>["prefs"]): QuestPreset {
  if (!prefs.advancedRenderOverrides) return "custom";
  if (prefs.dprPref !== "auto" || prefs.antialiasPref !== "auto") return "custom";
  if (prefs.renderQuality === "low" && prefs.frameRatePref === "72" && prefs.framebufferScalePref === "0.7" && prefs.foveationPref === "high" && prefs.shadowsPref === "off") return "safe";
  if (prefs.renderQuality === "balanced" && prefs.frameRatePref === "90" && prefs.framebufferScalePref === "0.85" && prefs.foveationPref === "medium" && prefs.shadowsPref === "off") return "balanced";
  if (prefs.renderQuality === "high" && prefs.frameRatePref === "90" && prefs.framebufferScalePref === "1" && prefs.foveationPref === "medium" && prefs.shadowsPref === "off") return "clarity";
  return "custom";
}

export function MmdVrPrepApp() {
  const t = useLanguageStore((state) => state.t);
  const language = useLanguageStore((state) => state.language);
  const addNotification = useNotificationStore((state) => state.addNotification);
  const phase = useMmdVrStore((state) => state.phase);
  const errorMessage = useMmdVrStore((state) => state.errorMessage);
  const prefs = useMmdVrStore((state) => state.prefs);
  const setPrefs = useMmdVrStore((state) => state.setPrefs);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const importGenerationRef = useRef(0);
  const [files, setFiles] = useState<File[]>([]);
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [bodyMotionPath, setBodyMotionPath] = useState("");
  const [faceMotionPath, setFaceMotionPath] = useState("");
  const [dragging, setDragging] = useState(false);
  const questPreset = getQuestPreset(prefs);
  const highLoadConfig = prefs.frameRatePref === "120"
    || (prefs.advancedRenderOverrides && prefs.framebufferScalePref === "1" && prefs.foveationPref === "off");

  function applyQuestPreset(preset: Exclude<QuestPreset, "custom">) {
    if (preset === "safe") {
      setPrefs({ renderQuality: "low", dprPref: "auto", frameRatePref: "72", antialiasPref: "auto", framebufferScalePref: "0.7", foveationPref: "high", shadowsPref: "off", advancedRenderOverrides: true });
      return;
    }
    if (preset === "balanced") {
      setPrefs({ renderQuality: "balanced", dprPref: "auto", frameRatePref: "90", antialiasPref: "auto", framebufferScalePref: "0.85", foveationPref: "medium", shadowsPref: "off", advancedRenderOverrides: true });
      return;
    }
    setPrefs({ renderQuality: "high", dprPref: "auto", frameRatePref: "90", antialiasPref: "auto", framebufferScalePref: "1", foveationPref: "medium", shadowsPref: "off", advancedRenderOverrides: true });
  }

  const models = useMemo(() => listMmdModels(files), [files]);
  const motions = useMemo(() => listMmdMotions(files), [files]);
  const selectedModels = useMemo(
    () => models.filter((model) => selectedPaths.includes(relativePath(model))).slice(0, MMD_VR_MAX_MODELS),
    [models, selectedPaths],
  );

  useEffect(() => {
    const input = folderInputRef.current;
    if (!input) return;
    input.setAttribute("webkitdirectory", "");
    input.setAttribute("directory", "");
  }, []);

  function ingest(nextFiles: File[]) {
    const nextModels = listMmdModels(nextFiles);
    setFiles(nextFiles);
    setSelectedPaths(nextModels.slice(0, MMD_VR_MAX_MODELS).map(relativePath));
    setBodyMotionPath("");
    setFaceMotionPath("");
  }

  function onFilesChange(event: ChangeEvent<HTMLInputElement>) {
    importGenerationRef.current += 1;
    ingest(Array.from(event.target.files ?? []));
    event.target.value = "";
  }

  async function onDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setDragging(false);
    const generation = ++importGenerationRef.current;
    const nextFiles = await collectFilesFromDataTransfer(event.dataTransfer);
    if (generation === importGenerationRef.current) ingest(nextFiles);
  }

  function toggleModel(path: string) {
    setSelectedPaths((current) => {
      if (current.includes(path)) return current.filter((item) => item !== path);
      if (current.length >= MMD_VR_MAX_MODELS) return current;
      return [...current, path];
    });
  }

  function enterVr() {
    const bodyMotion = motions.find((file) => relativePath(file) === bodyMotionPath) ?? null;
    const faceMotion = motions.find((file) => relativePath(file) === faceMotionPath) ?? null;
    const assets: MmdVrAssetSlot[] = selectedModels.map((modelFile) => ({
      modelFile,
      companionFiles: companionsForModel(modelFile, files),
      bodyMotionFile: bodyMotion,
      faceMotionFile: faceMotion,
    }));
    void requestMmdVrEnter({ t, addNotification, assets });
  }

  return (
    <main className="mmd-vr-prep-shell">
      <header className="mmd-vr-prep-nav">
        <a className="mmd-vr-prep-back" href="./">
          <Icon icon="solar:arrow-left-linear" width={18} height={18} />
          {t("mmdVrPrepBack")}
        </a>
        <span className="mmd-vr-prep-mark">NekoVirtOS / XR</span>
      </header>

      <section className="mmd-vr-prep-layout">
        <div className="mmd-vr-prep-intro">
          <span className="mmd-vr-prep-kicker">MMD VR</span>
          <h1>{t("mmdVrPrepTitle")}</h1>
          <p>{t("mmdVrPrepLead")}</p>
          <div className="mmd-vr-prep-signal">
            <span />
            {phase === "entering" ? t("settingsMmdVrEntering") : t("mmdVrPrepReady")}
          </div>
        </div>

        <div className="mmd-vr-prep-workbench">
          <section
            className={`mmd-vr-prep-drop${dragging ? " is-dragging" : ""}`}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => void onDrop(event)}
          >
            <div className="mmd-vr-prep-drop-icon">
              <Icon icon="solar:folder-with-files-bold-duotone" width={30} height={30} />
            </div>
            <div>
              <strong>{t("mmdVrPrepImport")}</strong>
              <p>{t("mmdVrPrepImportHint")}</p>
            </div>
            <button type="button" className="button-primary" onClick={() => folderInputRef.current?.click()}>
              {t("mmdVrPrepChooseFolder")}
            </button>
            <input ref={folderInputRef} hidden type="file" multiple onChange={onFilesChange} />
          </section>

          <section className="mmd-vr-prep-section">
            <div className="mmd-vr-prep-section-head">
              <div>
                <strong>{t("mmdVrPrepModels")}</strong>
                <span>{t("mmdVrPrepModelLimit").replace("{count}", String(MMD_VR_MAX_MODELS))}</span>
              </div>
              <b>{selectedModels.length}/{MMD_VR_MAX_MODELS}</b>
            </div>
            {models.length ? (
              <div className="mmd-vr-prep-models">
                {models.map((model, index) => {
                  const path = relativePath(model);
                  const selected = selectedPaths.includes(path);
                  return (
                    <button
                      key={path}
                      type="button"
                      className={selected ? "mmd-vr-prep-model is-selected" : "mmd-vr-prep-model"}
                      onClick={() => toggleModel(path)}
                    >
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <div><strong>{model.name}</strong><small>{path}</small></div>
                      <Icon icon={selected ? "solar:check-circle-bold" : "solar:add-circle-linear"} width={20} height={20} />
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="mmd-vr-prep-empty">{files.length ? t("mmdVrPrepNoModels") : t("mmdVrPrepAwaiting")}</div>
            )}
          </section>

          <section className="mmd-vr-prep-motion-grid">
            <label>
              <span>{t("mmdVrPrepBodyMotion")}</span>
              <select value={bodyMotionPath} onChange={(event) => setBodyMotionPath(event.target.value)}>
                <option value="">{t("mmdVrPrepNoMotion")}</option>
                {motions.map((motion) => <option key={relativePath(motion)} value={relativePath(motion)}>{motion.name}</option>)}
              </select>
            </label>
            <label>
              <span>{t("mmdVrPrepFaceMotion")}</span>
              <select value={faceMotionPath} onChange={(event) => setFaceMotionPath(event.target.value)}>
                <option value="">{t("mmdVrPrepNoMotion")}</option>
                {motions.map((motion) => <option key={relativePath(motion)} value={relativePath(motion)}>{motion.name}</option>)}
              </select>
            </label>
          </section>

          <details className="mmd-vr-prep-config" open>
            <summary>
              <div>
                <strong>{t("mmdVrPrepRuntimeConfig")}</strong>
                <span>{formatMmdVrProfileSummary(getMmdVrRenderProfile(prefs), language)}</span>
              </div>
              <Icon icon="solar:alt-arrow-down-linear" width={18} height={18} />
            </summary>
            <div className="mmd-vr-prep-config-body">
              <div className="mmd-vr-prep-config-row">
                <span>{t("settingsMmdVrQuestPreset")}</span>
                <OptionGroup
                  value={questPreset}
                  options={[
                    { id: "safe", label: t("settingsMmdVrPresetSafe") },
                    { id: "balanced", label: t("settingsMmdVrPresetBalanced") },
                    { id: "clarity", label: t("settingsMmdVrPresetClarity") },
                    { id: "custom", label: t("settingsMmdVrPresetCustom") },
                  ]}
                  onChange={(preset) => {
                    if (preset === "custom") setPrefs({ advancedRenderOverrides: false });
                    else applyQuestPreset(preset);
                  }}
                />
              </div>
              <div className="mmd-vr-prep-config-row">
                <span>{t("settingsVrThemeColor")}</span>
                <div className="mmd-vr-theme-swatches" role="group" aria-label={t("settingsVrThemeColor")}>
                  {XR_THEME_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={prefs.themeColor === color ? "is-active" : ""}
                      style={{ background: getXrAccentTokens(color).primary }}
                      aria-label={`${t("settingsVrThemeColor")}: ${color}`}
                      aria-pressed={prefs.themeColor === color}
                      title={color}
                      onClick={() => setPrefs({ themeColor: color })}
                    />
                  ))}
                </div>
              </div>
              <div className="mmd-vr-prep-config-row">
                <span>{t("settingsVrDesktopQuality")}</span>
                <OptionGroup
                  value={prefs.renderQuality}
                  options={[
                    { id: "high", label: t("settingsVrDesktopQualityHigh") },
                    { id: "balanced", label: t("settingsVrDesktopQualityBalanced") },
                    { id: "low", label: t("settingsVrDesktopQualityLow") },
                  ]}
                  onChange={(renderQuality) => setPrefs({ renderQuality })}
                />
              </div>
              <div className="mmd-vr-prep-config-row">
                <span>{t("settingsVrDesktopDpr")}</span>
                <OptionGroup
                  value={prefs.dprPref}
                  options={[
                    { id: "auto", label: t("settingsVrDesktopQualityAuto") },
                    { id: "1", label: "1×" },
                    { id: "1.25", label: "1.25×" },
                    { id: "1.5", label: "1.5×" },
                  ]}
                  onChange={(dprPref) => setPrefs({ dprPref })}
                />
              </div>
              <div className="mmd-vr-prep-config-row">
                <span>{t("settingsVrDesktopFrameRate")}</span>
                <OptionGroup
                  value={prefs.frameRatePref}
                  options={[
                    { id: "auto", label: t("settingsVrDesktopQualityAuto") },
                    { id: "72", label: "72 Hz" },
                    { id: "80", label: "80 Hz" },
                    { id: "90", label: "90 Hz" },
                    { id: "120", label: "120 Hz" },
                  ]}
                  onChange={(frameRatePref) => setPrefs({ frameRatePref })}
                />
              </div>
              <details className="mmd-vr-prep-advanced">
                <summary>{t("settingsMmdVrExperimentalRendering")}</summary>
                <label className="mmd-vr-prep-toggle">
                  <span>{t("settingsMmdVrEnableRenderOverrides")}</span>
                  <input type="checkbox" checked={prefs.advancedRenderOverrides} onChange={(event) => setPrefs({ advancedRenderOverrides: event.target.checked })} />
                </label>
                <div className="mmd-vr-prep-config-row">
                  <span>{t("settingsVrDesktopFramebufferScale")}</span>
                  <OptionGroup
                    value={prefs.framebufferScalePref}
                    options={[{ id: "auto", label: t("settingsVrDesktopQualityAuto") }, { id: "0.7", label: "70%" }, { id: "0.85", label: "85%" }, { id: "1", label: "100%" }]}
                    onChange={(framebufferScalePref) => setPrefs({ framebufferScalePref, advancedRenderOverrides: true })}
                  />
                </div>
                <div className="mmd-vr-prep-config-row">
                  <span>{t("settingsVrDesktopFoveation")}</span>
                  <OptionGroup
                    value={prefs.foveationPref}
                    options={[
                      { id: "high", label: t("settingsMmdVrFoveationPerformance") },
                      { id: "medium", label: t("settingsMmdVrFoveationBalanced") },
                      { id: "off", label: t("settingsMmdVrFoveationOff") },
                    ]}
                    onChange={(foveationPref) => setPrefs({ foveationPref, advancedRenderOverrides: true })}
                  />
                </div>
              </details>
              <div className="mmd-vr-prep-config-row">
                <span>{t("settingsVrDesktopAntialias")}</span>
                <OptionGroup
                  value={prefs.antialiasPref}
                  options={[
                    { id: "auto", label: t("settingsVrDesktopQualityAuto") },
                    { id: "on", label: t("settingsVrDesktopAaOn") },
                    { id: "off", label: t("settingsVrDesktopAaOff") },
                  ]}
                  onChange={(antialiasPref) => setPrefs({ antialiasPref })}
                />
              </div>
              <div className="mmd-vr-prep-config-row">
                <span>{t("settingsMmdVrShadows")}</span>
                <OptionGroup
                  value={prefs.shadowsPref}
                  options={[
                    { id: "auto", label: t("settingsVrDesktopQualityAuto") },
                    { id: "on", label: t("settingsVrDesktopAaOn") },
                    { id: "off", label: t("settingsVrDesktopAaOff") },
                  ]}
                  onChange={(shadowsPref) => setPrefs({ shadowsPref })}
                />
              </div>
              <div className="mmd-vr-prep-config-row">
                <span>{t("settingsMmdVrShadowResolution")}</span>
                <OptionGroup
                  value={prefs.shadowResolutionPref}
                  options={[
                    { id: "auto", label: t("settingsVrDesktopQualityAuto") },
                    { id: "low", label: "512" },
                    { id: "medium", label: "1024" },
                    { id: "high", label: "2048" },
                  ]}
                  onChange={(shadowResolutionPref) => setPrefs({ shadowResolutionPref })}
                />
              </div>
              <div className="mmd-vr-prep-config-row">
                <span>{t("settingsMmdVrGrid")}</span>
                <OptionGroup
                  value={prefs.gridPref}
                  options={[
                    { id: "auto", label: t("settingsVrDesktopQualityAuto") },
                    { id: "on", label: t("settingsVrDesktopAaOn") },
                    { id: "off", label: t("settingsVrDesktopAaOff") },
                  ]}
                  onChange={(gridPref) => setPrefs({ gridPref })}
                />
              </div>
              <div className="mmd-vr-prep-config-row">
                <span>{t("settingsMmdVrWalkSpeed")}</span>
                <OptionGroup
                  value={prefs.walkSpeedPref}
                  options={[
                    { id: "auto", label: t("settingsVrDesktopQualityAuto") },
                    { id: "slow", label: t("settingsMmdVrWalkSlow") },
                    { id: "normal", label: t("settingsMmdVrWalkNormal") },
                    { id: "fast", label: t("settingsMmdVrWalkFast") },
                  ]}
                  onChange={(walkSpeedPref) => setPrefs({ walkSpeedPref })}
                />
              </div>
              <label className="mmd-vr-prep-toggle">
                <span>{t("settingsVrDesktopShowFps")}</span>
                <input
                  type="checkbox"
                  checked={prefs.showFps}
                  onChange={(event) => setPrefs({ showFps: event.target.checked })}
                />
              </label>
              <label className="mmd-vr-prep-toggle">
                <span>{t("settingsMmdVrDetailedPhysicsDiagnostics")}</span>
                <input type="checkbox" checked={prefs.detailedPhysicsDiagnostics} onChange={(event) => setPrefs({ detailedPhysicsDiagnostics: event.target.checked })} />
              </label>
              {highLoadConfig ? <p className="mmd-vr-prep-warning">{t("settingsMmdVrHighLoadWarning")}</p> : null}
              <p>{t("settingsVrDesktopQualityHint")}</p>
            </div>
          </details>

          {errorMessage ? <p className="mmd-vr-prep-error">{errorMessage}</p> : null}
          <button
            type="button"
            className="mmd-vr-prep-enter"
            disabled={!selectedModels.length || phase === "entering" || phase === "active"}
            onClick={enterVr}
          >
            <Icon icon="solar:glasses-bold-duotone" width={22} height={22} />
            <span>{phase === "entering" ? t("settingsMmdVrEntering") : t("settingsMmdVrEnter")}</span>
            <Icon icon="solar:arrow-right-linear" width={20} height={20} />
          </button>
        </div>
      </section>
      <MmdVrOverlay />
    </main>
  );
}
