import { useRef, useState, type MutableRefObject, type RefObject } from "react";
import { useLanguageStore } from "../../languageStore";
import type { MmdSceneApi } from "./MmdCanvas";
import type { MmdProjectRecord } from "./mmdProjectDb";
import {
  AssetRow,
  classifyMorph,
  MaterialOverrideEditor,
  morphGroupLabel,
  MmdSelect,
  NumberField,
  PanelSection,
  SliderField,
} from "./mmdPanelUi";
import {
  DEFAULT_MATERIAL_OVERRIDE,
  DEFAULT_MODEL_TRANSFORM,
  formatMmdTime,
  getExportAudioBits,
  getExportSize,
  getExportVideoBits,
  isExportMp4Supported,
  resolveExportMimeType,
  useMmdStudioStore,
  type MmdExportAudioBitrate,
  type MmdExportBitrate,
  type MmdExportCodec,
  type MmdExportMode,
  type MmdExportResolution,
  type MmdLutLook,
  type MmdMsaaSamples,
  type MmdPostFxPreset,
  type MmdShadowMapSize,
  type MmdShadowMode,
  type MmdShadowQuality,
  type MmdSmaaQuality,
} from "./mmdStudioStore";

export type MmdSidePanelProps = {
  apiRef: MutableRefObject<MmdSceneApi | null>;
  audioRef: RefObject<HTMLAudioElement | null>;
  modelInputRef: RefObject<HTMLInputElement | null>;
  folderInputRef: RefObject<HTMLInputElement | null>;
  bodyMotionInputRef: RefObject<HTMLInputElement | null>;
  faceMotionInputRef: RefObject<HTMLInputElement | null>;
  cameraMotionInputRef: RefObject<HTMLInputElement | null>;
  audioInputRef: RefObject<HTMLInputElement | null>;
  hdrInputRef: RefObject<HTMLInputElement | null>;
  textureInfo: string;
  recording: boolean;
  onCaptureStill?: () => void | Promise<void>;
  onExportSequence?: () => void | Promise<void>;
  projectList: MmdProjectRecord[];
  projectBusy: boolean;
  projectName: string;
  setProjectName: (name: string) => void;
  lastProjectId: string | null;
  refreshProjectList: () => Promise<void> | void;
  saveProjectWithFeedback: (options?: { name?: string; clearLastId?: boolean }) => Promise<void> | void;
  loadProjectRecord: (project: MmdProjectRecord) => Promise<void> | void;
  deleteProject: (id: string) => Promise<void> | void;
  restoreAutosave: () => Promise<void> | void;
  exportProject?: (id: string) => Promise<void> | void;
  importProject?: (file: File) => Promise<MmdProjectRecord | null> | MmdProjectRecord | null;
  onBackToProjects?: () => void;
  onPhysicsToggle: (enabled: boolean) => Promise<void> | void;
  onPhysicsReset?: () => void;
};

function postFxLabel(option: MmdPostFxPreset, t: ReturnType<typeof useLanguageStore.getState>["t"]) {
  if (option === "off") return t("mmdPostFxOff");
  if (option === "clean") return t("mmdPostFxClean");
  if (option === "soft") return t("mmdPostFxSoft");
  if (option === "cinema") return t("mmdPostFxCinema");
  if (option === "dreamy") return t("mmdPostFxDreamy");
  if (option === "film") return t("mmdPostFxFilm");
  if (option === "anime") return t("mmdPostFxAnime");
  return t("mmdPostFxCustom");
}

function lutLabel(look: MmdLutLook, t: ReturnType<typeof useLanguageStore.getState>["t"]) {
  if (look === "warm") return t("mmdLutWarm");
  if (look === "cool") return t("mmdLutCool");
  if (look === "film") return t("mmdLutFilm");
  return t("mmdLutNone");
}

function bitrateLabel(value: MmdExportBitrate | MmdExportAudioBitrate, t: ReturnType<typeof useLanguageStore.getState>["t"]) {
  if (value === "low") return t("mmdBitrateLow");
  if (value === "medium") return t("mmdBitrateMedium");
  if (value === "ultra") return t("mmdBitrateUltra");
  if (value === "custom") return t("mmdBitrateCustom");
  return t("mmdBitrateHigh");
}

function codecLabel(value: MmdExportCodec, t: ReturnType<typeof useLanguageStore.getState>["t"]) {
  if (value === "h264") return t("mmdCodecH264");
  if (value === "vp8") return "VP8 (WebM)";
  if (value === "vp9") return "VP9 (WebM)";
  return t("mmdCodecAuto");
}

export function MmdSidePanel({
  apiRef,
  audioRef,
  modelInputRef,
  folderInputRef,
  bodyMotionInputRef,
  faceMotionInputRef,
  cameraMotionInputRef,
  audioInputRef,
  hdrInputRef,
  textureInfo,
  recording,
  onCaptureStill,
  onExportSequence,
  projectList,
  projectBusy,
  projectName,
  setProjectName,
  lastProjectId,
  refreshProjectList,
  saveProjectWithFeedback,
  loadProjectRecord,
  deleteProject,
  restoreAutosave,
  exportProject,
  importProject,
  onBackToProjects,
  onPhysicsToggle,
  onPhysicsReset,
}: MmdSidePanelProps) {
  const t = useLanguageStore((state) => state.t);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const backend = useMmdStudioStore((state) => state.backend);
  const postFx = useMmdStudioStore((state) => state.postFx);
  const setPostFx = useMmdStudioStore((state) => state.setPostFx);
  const postFxTune = useMmdStudioStore((state) => state.postFxTune);
  const setPostFxTune = useMmdStudioStore((state) => state.setPostFxTune);
  const resetPostFxTune = useMmdStudioStore((state) => state.resetPostFxTune);
  const cameraMode = useMmdStudioStore((state) => state.cameraMode);
  const setCameraMode = useMmdStudioStore((state) => state.setCameraMode);
  const physicsEnabled = useMmdStudioStore((state) => state.physicsEnabled);
  const physicsReady = useMmdStudioStore((state) => state.physicsReady);
  const loop = useMmdStudioStore((state) => state.loop);
  const setLoop = useMmdStudioStore((state) => state.setLoop);
  const speed = useMmdStudioStore((state) => state.speed);
  const setSpeed = useMmdStudioStore((state) => state.setSpeed);
  const cameraMoveSpeed = useMmdStudioStore((state) => state.cameraMoveSpeed);
  const setCameraMoveSpeed = useMmdStudioStore((state) => state.setCameraMoveSpeed);
  const cameraRotateSpeed = useMmdStudioStore((state) => state.cameraRotateSpeed);
  const setCameraRotateSpeed = useMmdStudioStore((state) => state.setCameraRotateSpeed);
  const currentTime = useMmdStudioStore((state) => state.currentTime);
  const duration = useMmdStudioStore((state) => state.duration);
  const models = useMmdStudioStore((state) => state.models);
  const selectedModelId = useMmdStudioStore((state) => state.selectedModelId);
  const setSelectedModelId = useMmdStudioStore((state) => state.setSelectedModelId);
  const morphSearch = useMmdStudioStore((state) => state.morphSearch);
  const setMorphSearch = useMmdStudioStore((state) => state.setMorphSearch);
  const setMorphFavorites = useMmdStudioStore((state) => state.setMorphFavorites);
  const audioName = useMmdStudioStore((state) => state.audioName);
  const skyHdrName = useMmdStudioStore((state) => state.skyHdrName);
  const setSkyHdr = useMmdStudioStore((state) => state.setSkyHdr);
  const skyAsBackground = useMmdStudioStore((state) => state.skyAsBackground);
  const setSkyAsBackground = useMmdStudioStore((state) => state.setSkyAsBackground);
  const skyAsEnvironment = useMmdStudioStore((state) => state.skyAsEnvironment);
  const setSkyAsEnvironment = useMmdStudioStore((state) => state.setSkyAsEnvironment);
  const envIntensity = useMmdStudioStore((state) => state.envIntensity);
  const setEnvIntensity = useMmdStudioStore((state) => state.setEnvIntensity);
  const showGrid = useMmdStudioStore((state) => state.showGrid);
  const setShowGrid = useMmdStudioStore((state) => state.setShowGrid);
  const lights = useMmdStudioStore((state) => state.lights);
  const setLights = useMmdStudioStore((state) => state.setLights);
  const applyShadowQuality = useMmdStudioStore((state) => state.applyShadowQuality);
  const resetLights = useMmdStudioStore((state) => state.resetLights);
  const selectedModel = models.find((item) => item.id === selectedModelId) ?? null;
  const status = useMmdStudioStore((state) => state.status);
  const exportResolution = useMmdStudioStore((state) => state.exportResolution);
  const setExportResolution = useMmdStudioStore((state) => state.setExportResolution);
  const exportCustomWidth = useMmdStudioStore((state) => state.exportCustomWidth);
  const exportCustomHeight = useMmdStudioStore((state) => state.exportCustomHeight);
  const setExportCustomSize = useMmdStudioStore((state) => state.setExportCustomSize);
  const exportFps = useMmdStudioStore((state) => state.exportFps);
  const setExportFps = useMmdStudioStore((state) => state.setExportFps);
  const exportCodec = useMmdStudioStore((state) => state.exportCodec);
  const setExportCodec = useMmdStudioStore((state) => state.setExportCodec);
  const exportBitrate = useMmdStudioStore((state) => state.exportBitrate);
  const setExportBitrate = useMmdStudioStore((state) => state.setExportBitrate);
  const exportCustomVideoMbps = useMmdStudioStore((state) => state.exportCustomVideoMbps);
  const setExportCustomVideoMbps = useMmdStudioStore((state) => state.setExportCustomVideoMbps);
  const exportAudioBitrate = useMmdStudioStore((state) => state.exportAudioBitrate);
  const setExportAudioBitrate = useMmdStudioStore((state) => state.setExportAudioBitrate);
  const exportCustomAudioKbps = useMmdStudioStore((state) => state.exportCustomAudioKbps);
  const setExportCustomAudioKbps = useMmdStudioStore((state) => state.setExportCustomAudioKbps);
  const exportMode = useMmdStudioStore((state) => state.exportMode);
  const setExportMode = useMmdStudioStore((state) => state.setExportMode);
  const exportProgress = useMmdStudioStore((state) => state.exportProgress);
  const exportIncludeAudio = useMmdStudioStore((state) => state.exportIncludeAudio);
  const setExportIncludeAudio = useMmdStudioStore((state) => state.setExportIncludeAudio);
  const exportHideGrid = useMmdStudioStore((state) => state.exportHideGrid);
  const setExportHideGrid = useMmdStudioStore((state) => state.setExportHideGrid);
  const exportForceOneX = useMmdStudioStore((state) => state.exportForceOneX);
  const setExportForceOneX = useMmdStudioStore((state) => state.setExportForceOneX);
  const exportFilePrefix = useMmdStudioStore((state) => state.exportFilePrefix);
  const setExportFilePrefix = useMmdStudioStore((state) => state.setExportFilePrefix);
  const exportIn = useMmdStudioStore((state) => state.exportIn);
  const exportOut = useMmdStudioStore((state) => state.exportOut);
  const setExportIn = useMmdStudioStore((state) => state.setExportIn);
  const setExportOut = useMmdStudioStore((state) => state.setExportOut);

  const [sideTab, setSideTab] = useState<"assets" | "model" | "look" | "export" | "project">("assets");

  const postFxOptions: MmdPostFxPreset[] = ["off", "clean", "soft", "cinema", "dreamy", "film", "anime", "custom"];
  const backendDisabledPostFx = backend === "webgpu";
  const fxDisabled = backendDisabledPostFx || postFx === "off" || recording;
  const rangeEnd = exportOut > 0 ? exportOut : duration;
  const rangeLabel = duration > 0
    ? `${formatMmdTime(exportIn)} – ${formatMmdTime(rangeEnd || duration)}`
    : "—";
  const exportBitsMbps = (
    getExportVideoBits(
      exportResolution,
      exportBitrate,
      exportCustomWidth,
      exportCustomHeight,
      exportCustomVideoMbps,
    ) / 1_000_000
  ).toFixed(1);
  const exportAudioKbps = Math.round(
    getExportAudioBits(exportAudioBitrate, exportCustomAudioKbps) / 1000,
  );
  const exportSize = getExportSize(exportResolution, exportCustomWidth, exportCustomHeight);

  return (
      <aside className="mmd-side">
        <nav className="mmd-side-tabs" aria-label={t("mmdSectionScene")}>
          {(
            [
              ["assets", "mmdTabAssets"],
              ["model", "mmdTabModel"],
              ["look", "mmdTabLook"],
              ["export", "mmdTabExport"],
              ["project", "mmdTabProject"],
            ] as const
          ).map(([id, labelKey]) => (
            <button
              key={id}
              type="button"
              className={sideTab === id ? "mmd-side-tab is-active" : "mmd-side-tab"}
              onClick={() => setSideTab(id)}
            >
              {t(labelKey)}
            </button>
          ))}
        </nav>
        <div className="mmd-side-page">
        {sideTab === "assets" ? (
          <>
        <PanelSection title={t("mmdSectionScene")}>
          <div className="mmd-model-list">
            {models.length ? models.map((model) => (
              <div
                key={model.id}
                className={model.id === selectedModelId ? "mmd-model-item is-selected" : "mmd-model-item"}
                onClick={() => {
                  setSelectedModelId(model.id);
                  apiRef.current?.selectModel(model.id);
                }}
              >
                <span className="mmd-model-item-name" title={model.name}>{model.name}</span>
                <span className="mmd-model-item-actions">
                  <button
                    type="button"
                    className="button-ghost mmd-mini-btn"
                    onClick={(event) => {
                      event.stopPropagation();
                      apiRef.current?.setModelVisible(model.id, !model.visible);
                    }}
                  >
                    {model.visible ? t("mmdHide") : t("mmdShow")}
                  </button>
                  <button
                    type="button"
                    className="button-ghost mmd-mini-btn"
                    onClick={(event) => {
                      event.stopPropagation();
                      apiRef.current?.removeModel(model.id);
                    }}
                  >
                    {t("mmdRemoveModel")}
                  </button>
                </span>
              </div>
            )) : <p className="mmd-note">{t("mmdNoModels")}</p>}
          </div>
          <div className="mmd-range-actions">
            <button type="button" className="button-primary mmd-mini-btn" onClick={() => folderInputRef.current?.click()}>{t("mmdAddModel")}</button>
            <button type="button" className="button-ghost mmd-mini-btn" onClick={() => modelInputRef.current?.click()}>{t("mmdLoadModel")}</button>
          </div>
          <AssetRow label={t("mmdBodyMotion")} value={selectedModel?.bodyMotionName ?? null} onPick={() => bodyMotionInputRef.current?.click()} pickLabel={t("mmdLoadBodyMotion")} />
          <AssetRow label={t("mmdFaceMotion")} value={selectedModel?.faceMotionName ?? null} onPick={() => faceMotionInputRef.current?.click()} pickLabel={t("mmdLoadFaceMotion")} />
          <AssetRow label={t("mmdCameraMotionFile")} value={selectedModel?.cameraMotionName ?? null} onPick={() => cameraMotionInputRef.current?.click()} pickLabel={t("mmdLoadCameraMotion")} />
          <AssetRow label={t("mmdAudio")} value={audioName} onPick={() => audioInputRef.current?.click()} pickLabel={t("mmdLoadAudio")} />
          <div className="mmd-meta-line">
            <span>{t("mmdTextures")}</span>
            <span>{textureInfo || "—"}</span>
          </div>
        </PanelSection>

        <PanelSection title={t("mmdSectionPlayback")}>
          <div className="mmd-toggle-grid">
            <label className="mmd-check">
              <input
                type="checkbox"
                checked={physicsEnabled}
                disabled={status === "loading" || recording}
                onChange={(event) => void onPhysicsToggle(event.target.checked)}
              />
              <span>{t("mmdPhysics")}</span>
              {physicsEnabled && physicsReady ? <span className="mmd-pill">{t("mmdPhysicsOn")}</span> : null}
            </label>
            <label className="mmd-check">
              <input type="checkbox" checked={loop} onChange={(event) => setLoop(event.target.checked)} />
              <span>{t("mmdLoop")}</span>
            </label>
          </div>
          {physicsEnabled ? (
            <button
              type="button"
              className="button-ghost mmd-mini-btn"
              disabled={!physicsReady || status === "loading" || recording || !onPhysicsReset}
              onClick={() => onPhysicsReset?.()}
            >
              {t("mmdPhysicsReset")}
            </button>
          ) : null}
          <label className="mmd-field">
            <span>{t("mmdCamera")}</span>
            <MmdSelect
              value={cameraMode}
              ariaLabel={t("mmdCamera")}
              onChange={(next) => setCameraMode(next as "free" | "motion")}
              options={[
                { value: "free", label: t("mmdCameraFree") },
                { value: "motion", label: t("mmdCameraMotion") },
              ]}
            />
          </label>
          {cameraMode === "free" ? <p className="mmd-note">{t("mmdCameraKeys")}</p> : null}
          {cameraMode === "free" ? (
            <>
              <SliderField
                label={t("mmdCameraMoveSpeed")}
                value={cameraMoveSpeed}
                min={1}
                max={40}
                step={0.5}
                display={cameraMoveSpeed.toFixed(1)}
                onChange={(next) => setCameraMoveSpeed(next)}
              />
              <SliderField
                label={t("mmdCameraRotateSpeed")}
                value={cameraRotateSpeed}
                min={0.1}
                max={4}
                step={0.05}
                display={cameraRotateSpeed.toFixed(2)}
                onChange={(next) => setCameraRotateSpeed(next)}
              />
            </>
          ) : null}
          <SliderField
            label={t("mmdSpeed")}
            value={speed}
            min={0.5}
            max={1.5}
            step={0.05}
            display={`${speed.toFixed(2)}x`}
            onChange={(next) => {
              setSpeed(next);
              if (audioRef.current) audioRef.current.playbackRate = next;
            }}
          />
        </PanelSection>
          </>
        ) : null}

        {sideTab === "model" ? (
          <>
        <PanelSection title={t("mmdSectionTransform")} collapsible defaultOpen>
          {selectedModel ? (
            <>
              <p className="mmd-note">{t("mmdTransformPos")}</p>
              <div className="mmd-field-row mmd-field-row-3">
                <NumberField
                  label="X"
                  value={selectedModel.transform.positionX}
                  step={0.05}
                  onChange={(positionX) => apiRef.current?.setModelTransform(selectedModel.id, { positionX })}
                />
                <NumberField
                  label="Y"
                  value={selectedModel.transform.positionY}
                  step={0.05}
                  onChange={(positionY) => apiRef.current?.setModelTransform(selectedModel.id, { positionY })}
                />
                <NumberField
                  label="Z"
                  value={selectedModel.transform.positionZ}
                  step={0.05}
                  onChange={(positionZ) => apiRef.current?.setModelTransform(selectedModel.id, { positionZ })}
                />
              </div>
              <p className="mmd-note">{t("mmdTransformRot")}</p>
              <div className="mmd-field-row mmd-field-row-3">
                <NumberField
                  label="X°"
                  value={selectedModel.transform.rotationX}
                  step={1}
                  min={-360}
                  max={360}
                  onChange={(rotationX) => apiRef.current?.setModelTransform(selectedModel.id, { rotationX })}
                />
                <NumberField
                  label="Y°"
                  value={selectedModel.transform.rotationY}
                  step={1}
                  min={-360}
                  max={360}
                  onChange={(rotationY) => apiRef.current?.setModelTransform(selectedModel.id, { rotationY })}
                />
                <NumberField
                  label="Z°"
                  value={selectedModel.transform.rotationZ}
                  step={1}
                  min={-360}
                  max={360}
                  onChange={(rotationZ) => apiRef.current?.setModelTransform(selectedModel.id, { rotationZ })}
                />
              </div>
              <SliderField
                label={t("mmdTransformScale")}
                value={selectedModel.transform.scale}
                min={0.1}
                max={3}
                step={0.01}
                display={selectedModel.transform.scale.toFixed(2)}
                onChange={(scale) => apiRef.current?.setModelTransform(selectedModel.id, { scale })}
              />
              <NumberField
                label={t("mmdTransformScaleExact")}
                value={selectedModel.transform.scale}
                step={0.01}
                min={0.01}
                max={10}
                onChange={(scale) => apiRef.current?.setModelTransform(selectedModel.id, { scale })}
              />
              <button
                type="button"
                className="button-ghost mmd-reset-fx"
                onClick={() => apiRef.current?.setModelTransform(selectedModel.id, { ...DEFAULT_MODEL_TRANSFORM })}
              >
                {t("mmdTransformReset")}
              </button>
            </>
          ) : (
            <p className="mmd-note">{t("mmdTransformEmpty")}</p>
          )}
        </PanelSection>

        <PanelSection title={t("mmdSectionMorph")} collapsible defaultOpen={false}>
          {selectedModel?.morphNames.length ? (
            <>
              <label className="mmd-field">
                <span>{t("mmdMorphSearch")}</span>
                <input type="search" className="mmd-text-input" value={morphSearch} onChange={(event) => setMorphSearch(event.target.value)} spellCheck={false} />
              </label>
              {(() => {
                const needle = morphSearch.trim().toLowerCase();
                const morphFavorites = selectedModel.morphFavorites ?? [];
                const favorites = new Set(morphFavorites);
                const filtered = selectedModel.morphNames.filter((name) => !needle || name.toLowerCase().includes(needle));
                const ordered = [...filtered].sort((a, b) => {
                  const af = favorites.has(a) ? 0 : 1;
                  const bf = favorites.has(b) ? 0 : 1;
                  if (af !== bf) return af - bf;
                  return a.localeCompare(b, "zh");
                });
                const groups = ordered.reduce<Record<string, string[]>>((acc, name) => {
                  const key = classifyMorph(name);
                  (acc[key] ??= []).push(name);
                  return acc;
                }, {});
                const order = ["eye", "mouth", "brow", "face", "other"];
                return (
                  <div className="mmd-morph-groups">
                    {order.filter((key) => (groups[key] ?? []).length > 0).map((group) => (
                      <details key={group} className="mmd-morph-group" open={group !== "other"}>
                        <summary>
                          <span>{morphGroupLabel(group, t)}</span>
                          <span className="mmd-mono">{groups[group].length}</span>
                        </summary>
                        <div className="mmd-fx-grid">
                          {groups[group].map((name) => {
                            const weight = selectedModel.morphWeights[name] ?? 0;
                            return (
                              <div key={name} className="mmd-morph-row">
                                <div className="mmd-morph-row-head">
                                  <span title={name}>{name}</span>
                                  <button
                                    type="button"
                                    className={favorites.has(name) ? "button-primary mmd-mini-btn" : "button-ghost mmd-mini-btn"}
                                    onClick={() => {
                                      const next = favorites.has(name)
                                        ? morphFavorites.filter((item) => item !== name)
                                        : [...morphFavorites, name];
                                      setMorphFavorites(selectedModel.id, next);
                                    }}
                                  >
                                    {favorites.has(name) ? t("mmdMorphBookmarked") : t("mmdMorphFavorites")}
                                  </button>
                                </div>
                                <SliderField
                                  label={name}
                                  value={weight}
                                  min={0}
                                  max={1}
                                  step={0.01}
                                  display={weight.toFixed(2)}
                                  onChange={(next) => apiRef.current?.setMorphWeight(selectedModel.id, name, next)}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </details>
                    ))}
                  </div>
                );
              })()}
            </>
          ) : <p className="mmd-note">{t("mmdMorphEmpty")}</p>}
        </PanelSection>

        <PanelSection title={t("mmdSectionParts")} collapsible defaultOpen={false}>
          {selectedModel?.materialNames.length ? (
            <div className="mmd-material-list">
              {selectedModel.materialNames.map((name) => {
                const override = selectedModel.materialOverrides[name] ?? DEFAULT_MATERIAL_OVERRIDE;
                return (
                  <div key={name} className="mmd-material-row">
                    <label className="mmd-check mmd-material-visibility">
                      <input
                        type="checkbox"
                        checked={selectedModel.materialVisible[name] !== false}
                        onChange={(event) => apiRef.current?.setMaterialVisible(selectedModel.id, name, event.target.checked)}
                      />
                      <span title={name}>{name}</span>
                    </label>
                    <MaterialOverrideEditor
                      modelId={selectedModel.id}
                      name={name}
                      value={override}
                      onChange={(patch) => apiRef.current?.setMaterialOverride(selectedModel.id, name, patch)}
                    />
                  </div>
                );
              })}
            </div>
          ) : <p className="mmd-note">{t("mmdPartsEmpty")}</p>}
        </PanelSection>
          </>
        ) : null}

        {sideTab === "look" ? (
          <>
        <PanelSection title={t("mmdSectionEnvironment")}>
          <AssetRow
            label={t("mmdSkyHdr")}
            value={skyHdrName}
            onPick={() => hdrInputRef.current?.click()}
            pickLabel={skyHdrName ? t("mmdSkyReplace") : t("mmdSkyLoad")}
          />
          {skyHdrName ? (
            <div className="mmd-range-actions">
              <button type="button" className="button-ghost mmd-mini-btn" onClick={() => setSkyHdr(null)}>
                {t("mmdSkyClear")}
              </button>
            </div>
          ) : (
            <p className="mmd-note">{t("mmdSkyHint")}</p>
          )}
          <label className="mmd-check">
            <input type="checkbox" checked={skyAsBackground} disabled={!skyHdrName} onChange={(event) => setSkyAsBackground(event.target.checked)} />
            <span>{t("mmdSkyAsBackground")}</span>
          </label>
          <label className="mmd-check">
            <input type="checkbox" checked={skyAsEnvironment} disabled={!skyHdrName} onChange={(event) => setSkyAsEnvironment(event.target.checked)} />
            <span>{t("mmdSkyAsEnvironment")}</span>
          </label>
          <SliderField
            label={t("mmdEnvIntensity")}
            value={envIntensity}
            min={0}
            max={3}
            step={0.05}
            display={envIntensity.toFixed(2)}
            disabled={!skyHdrName || !skyAsEnvironment}
            onChange={(next) => setEnvIntensity(next)}
          />
          <label className="mmd-check">
            <input type="checkbox" checked={showGrid} onChange={(event) => setShowGrid(event.target.checked)} />
            <span>{t("mmdShowGrid")}</span>
          </label>
        </PanelSection>

        <PanelSection title={t("mmdSectionLights")}>
          <SliderField
            label={t("mmdAmbientIntensity")}
            value={lights.ambientIntensity}
            min={0}
            max={2}
            step={0.01}
            display={lights.ambientIntensity.toFixed(2)}
            onChange={(ambientIntensity) => setLights({ ambientIntensity })}
          />
          <SliderField
            label={t("mmdSunIntensity")}
            value={lights.sunIntensity}
            min={0}
            max={4}
            step={0.01}
            display={lights.sunIntensity.toFixed(2)}
            onChange={(sunIntensity) => setLights({ sunIntensity })}
          />
          <SliderField
            label={t("mmdSunAzimuth")}
            value={lights.sunAzimuth}
            min={-180}
            max={180}
            step={1}
            display={`${lights.sunAzimuth.toFixed(0)}°`}
            onChange={(sunAzimuth) => setLights({ sunAzimuth })}
          />
          <SliderField
            label={t("mmdSunElevation")}
            value={lights.sunElevation}
            min={5}
            max={89}
            step={1}
            display={`${lights.sunElevation.toFixed(0)}°`}
            onChange={(sunElevation) => setLights({ sunElevation })}
          />
          <button type="button" className="button-ghost mmd-reset-fx" onClick={() => resetLights()}>
            {t("mmdLightsReset")}
          </button>
        </PanelSection>

        <PanelSection title={t("mmdSectionShadows")} collapsible defaultOpen>
          <label className="mmd-field">
            <span>{t("mmdShadowQuality")}</span>
            <MmdSelect
              value={lights.shadowQuality}
              ariaLabel={t("mmdShadowQuality")}
              onChange={(next) => {
                const quality = next as MmdShadowQuality;
                if (quality === "custom") {
                  setLights({ shadowQuality: "custom" });
                  return;
                }
                applyShadowQuality(quality);
              }}
              options={[
                { value: "performance", label: t("mmdShadowQualityPerformance") },
                { value: "balanced", label: t("mmdShadowQualityBalanced") },
                { value: "quality", label: t("mmdShadowQualityQuality") },
                { value: "ultra", label: t("mmdShadowQualityUltra") },
                { value: "custom", label: t("mmdShadowQualityCustom") },
              ]}
            />
          </label>
          <label className="mmd-field">
            <span>{t("mmdShadowMode")}</span>
            <MmdSelect
              value={lights.shadowMode === "off" ? "off" : "map"}
              ariaLabel={t("mmdShadowMode")}
              onChange={(next) => setLights({ shadowMode: next as MmdShadowMode })}
              options={[
                { value: "off", label: t("mmdShadowOff") },
                { value: "map", label: t("mmdShadowMap") },
              ]}
            />
          </label>
          {lights.shadowMode !== "off" ? (
            <SliderField
              label={t("mmdGroundShadowOpacity")}
              value={lights.groundShadowOpacity}
              min={0}
              max={1}
              step={0.01}
              display={lights.groundShadowOpacity.toFixed(2)}
              onChange={(groundShadowOpacity) => setLights({ groundShadowOpacity })}
            />
          ) : null}
          <p className="mmd-note">{t("mmdShadowHint")}</p>
          {lights.shadowMode !== "off" ? (
            <PanelSection title={t("mmdSectionShadowAdvanced")} collapsible defaultOpen={false}>
              <SliderField
                label={t("mmdSunDistance")}
                value={lights.sunDistance}
                min={12}
                max={90}
                step={1}
                display={lights.sunDistance.toFixed(0)}
                onChange={(sunDistance) => setLights({ sunDistance })}
              />
              <label className="mmd-field">
                <span>{t("mmdShadowMapSize")}</span>
                <MmdSelect
                  value={String(lights.shadowMapSize)}
                  ariaLabel={t("mmdShadowMapSize")}
                  onChange={(next) => setLights({ shadowMapSize: Number(next) as MmdShadowMapSize })}
                  options={[
                    { value: "512", label: "512" },
                    { value: "1024", label: "1024" },
                    { value: "2048", label: "2048" },
                    { value: "4096", label: "4096" },
                  ]}
                />
              </label>
              <SliderField
                label={t("mmdShadowBias")}
                value={lights.shadowBias}
                min={-0.005}
                max={0.002}
                step={0.0001}
                display={lights.shadowBias.toFixed(4)}
                onChange={(shadowBias) => setLights({ shadowBias })}
              />
              <SliderField
                label={t("mmdShadowNormalBias")}
                value={lights.shadowNormalBias}
                min={0}
                max={0.12}
                step={0.001}
                display={lights.shadowNormalBias.toFixed(3)}
                onChange={(shadowNormalBias) => setLights({ shadowNormalBias })}
              />
              <SliderField
                label={t("mmdShadowRadius")}
                value={lights.shadowRadius}
                min={0}
                max={8}
                step={0.1}
                display={lights.shadowRadius.toFixed(1)}
                onChange={(shadowRadius) => setLights({ shadowRadius })}
              />
              <SliderField
                label={t("mmdShadowCameraSize")}
                value={lights.shadowCameraSize}
                min={10}
                max={70}
                step={1}
                display={lights.shadowCameraSize.toFixed(0)}
                onChange={(shadowCameraSize) => setLights({ shadowCameraSize })}
              />
            </PanelSection>
          ) : null}
        </PanelSection>

        <PanelSection title={t("mmdSectionLook")}>
          <label className="mmd-field">
            <span>{t("mmdPostFx")}</span>
            <MmdSelect
              value={backendDisabledPostFx ? "off" : postFx}
              disabled={backendDisabledPostFx || recording}
              ariaLabel={t("mmdPostFx")}
              onChange={(next) => setPostFx(next as MmdPostFxPreset)}
              options={postFxOptions.map((option) => ({
                value: option,
                label: postFxLabel(option, t),
              }))}
            />
          </label>
          {backendDisabledPostFx ? <p className="mmd-note">{t("mmdPostFxWebgpuDisabled")}</p> : null}
          {!backendDisabledPostFx && postFx !== "off" ? (
            <>
              <p className="mmd-note">{t("mmdLookPresetHint")}</p>
              <SliderField label={t("mmdFxBloom")} value={postFxTune.bloom} min={0} max={1.5} step={0.01} display={postFxTune.bloom.toFixed(2)} disabled={fxDisabled} onChange={(bloom) => setPostFxTune({ bloom })} />
              <label className="mmd-check">
                <input
                  type="checkbox"
                  checked={postFxTune.bloomSelective}
                  disabled={fxDisabled || postFxTune.bloom < 0.001}
                  onChange={(event) => setPostFxTune({ bloomSelective: event.target.checked })}
                />
                <span>{t("mmdFxBloomSelective")}</span>
              </label>
              <SliderField label={t("mmdFxVignette")} value={postFxTune.vignette} min={0} max={0.8} step={0.01} display={postFxTune.vignette.toFixed(2)} disabled={fxDisabled} onChange={(vignette) => setPostFxTune({ vignette })} />
              <label className="mmd-field">
                <span>{t("mmdFxLut")}</span>
                <MmdSelect
                  value={postFxTune.lut}
                  disabled={fxDisabled}
                  ariaLabel={t("mmdFxLut")}
                  onChange={(next) => setPostFxTune({ lut: next as MmdLutLook })}
                  options={(["none", "warm", "cool", "film"] as MmdLutLook[]).map((look) => ({
                    value: look,
                    label: lutLabel(look, t),
                  }))}
                />
              </label>
              <label className="mmd-check">
                <input
                  type="checkbox"
                  checked={postFxTune.toneMapping}
                  disabled={fxDisabled}
                  onChange={(event) => setPostFxTune({ toneMapping: event.target.checked })}
                />
                <span>{t("mmdFxToneMapping")}</span>
              </label>
              <button type="button" className="button-ghost mmd-reset-fx" disabled={fxDisabled} onClick={() => resetPostFxTune()}>
                {t("mmdFxReset")}
              </button>
            </>
          ) : null}
        </PanelSection>

        {!backendDisabledPostFx && postFx !== "off" ? (
          <>
            <PanelSection title={t("mmdSectionFxAtmosphere")} collapsible defaultOpen={false}>
              <SliderField label={t("mmdFxGodRays")} value={postFxTune.godRays} min={0} max={1} step={0.01} display={postFxTune.godRays.toFixed(2)} disabled={fxDisabled} onChange={(godRays) => setPostFxTune({ godRays })} />
              <SliderField label={t("mmdFxSparkle")} value={postFxTune.sparkle} min={0} max={1} step={0.01} display={postFxTune.sparkle.toFixed(2)} disabled={fxDisabled} onChange={(sparkle) => setPostFxTune({ sparkle })} />
              <SliderField label={t("mmdFxSparkleIntensity")} value={postFxTune.sparkleIntensity} min={0} max={1.5} step={0.01} display={postFxTune.sparkleIntensity.toFixed(2)} disabled={fxDisabled || postFxTune.sparkle < 0.001} onChange={(sparkleIntensity) => setPostFxTune({ sparkleIntensity })} />
              <SliderField label={t("mmdFxDof")} value={postFxTune.dof} min={0} max={1} step={0.01} display={postFxTune.dof.toFixed(2)} disabled={fxDisabled} onChange={(dof) => setPostFxTune({ dof })} />
              {postFxTune.dof >= 0.001 ? (
                <>
                  <SliderField label={t("mmdFxDofAperture")} value={postFxTune.dofAperture} min={0.05} max={1.5} step={0.01} display={postFxTune.dofAperture.toFixed(2)} disabled={fxDisabled} onChange={(dofAperture) => setPostFxTune({ dofAperture })} />
                  <SliderField label={t("mmdFxDofFocus")} value={postFxTune.dofFocus} min={1} max={80} step={0.5} display={postFxTune.dofFocus.toFixed(1)} disabled={fxDisabled || postFxTune.dofLockModel} onChange={(dofFocus) => setPostFxTune({ dofFocus })} />
                  <SliderField label={t("mmdFxDofRange")} value={postFxTune.dofRange} min={0.5} max={40} step={0.5} display={postFxTune.dofRange.toFixed(1)} disabled={fxDisabled} onChange={(dofRange) => setPostFxTune({ dofRange })} />
                  <label className="mmd-check">
                    <input
                      type="checkbox"
                      checked={postFxTune.dofLockModel}
                      disabled={fxDisabled}
                      onChange={(event) => setPostFxTune({ dofLockModel: event.target.checked })}
                    />
                    <span>{t("mmdFxDofLockModel")}</span>
                  </label>
                  {postFxTune.dofLockModel ? <p className="mmd-note">{t("mmdFxDofLockModelHint")}</p> : null}
                </>
              ) : null}
              <SliderField label={t("mmdFxTiltShift")} value={postFxTune.tiltShift} min={0} max={1} step={0.01} display={postFxTune.tiltShift.toFixed(2)} disabled={fxDisabled} onChange={(tiltShift) => setPostFxTune({ tiltShift })} />
              <p className="mmd-note">{t("mmdFxAdvancedNote")}</p>
            </PanelSection>

            <PanelSection title={t("mmdSectionFxGrade")} collapsible defaultOpen={false}>
              <SliderField label={t("mmdFxBloomThreshold")} value={postFxTune.bloomThreshold} min={0.2} max={1} step={0.01} display={postFxTune.bloomThreshold.toFixed(2)} disabled={fxDisabled || postFxTune.bloom < 0.001} onChange={(bloomThreshold) => setPostFxTune({ bloomThreshold })} />
              <SliderField label={t("mmdFxBloomRadius")} value={postFxTune.bloomRadius} min={0.05} max={1.2} step={0.01} display={postFxTune.bloomRadius.toFixed(2)} disabled={fxDisabled || postFxTune.bloom < 0.001} onChange={(bloomRadius) => setPostFxTune({ bloomRadius })} />
              <SliderField label={t("mmdFxBrightness")} value={postFxTune.brightness} min={-0.3} max={0.3} step={0.01} display={postFxTune.brightness.toFixed(2)} disabled={fxDisabled} onChange={(brightness) => setPostFxTune({ brightness })} />
              <SliderField label={t("mmdFxContrast")} value={postFxTune.contrast} min={-0.4} max={0.4} step={0.01} display={postFxTune.contrast.toFixed(2)} disabled={fxDisabled} onChange={(contrast) => setPostFxTune({ contrast })} />
              <SliderField label={t("mmdFxSaturation")} value={postFxTune.saturation} min={-0.5} max={0.5} step={0.01} display={postFxTune.saturation.toFixed(2)} disabled={fxDisabled} onChange={(saturation) => setPostFxTune({ saturation })} />
              <SliderField label={t("mmdFxChroma")} value={postFxTune.chroma} min={0} max={1} step={0.01} display={postFxTune.chroma.toFixed(2)} disabled={fxDisabled} onChange={(chroma) => setPostFxTune({ chroma })} />
              <SliderField label={t("mmdFxLensDistortion")} value={postFxTune.lensDistortion} min={0} max={1} step={0.01} display={postFxTune.lensDistortion.toFixed(2)} disabled={fxDisabled} onChange={(lensDistortion) => setPostFxTune({ lensDistortion })} />
              <SliderField label={t("mmdFxGrain")} value={postFxTune.grain} min={0} max={1} step={0.01} display={postFxTune.grain.toFixed(2)} disabled={fxDisabled} onChange={(grain) => setPostFxTune({ grain })} />
              <SliderField label={t("mmdFxSsao")} value={postFxTune.ssao} min={0} max={1} step={0.01} display={postFxTune.ssao.toFixed(2)} disabled={fxDisabled} onChange={(ssao) => setPostFxTune({ ssao })} />
              <SliderField label={t("mmdFxOutline")} value={postFxTune.outline} min={0} max={1} step={0.01} display={postFxTune.outline.toFixed(2)} disabled={fxDisabled} onChange={(outline) => setPostFxTune({ outline })} />
            </PanelSection>

            <PanelSection title={t("mmdSectionFxAa")} collapsible defaultOpen={false}>
              <div className="mmd-field-row">
                <label className="mmd-field">
                  <span>SMAA</span>
                  <MmdSelect
                    value={postFxTune.smaa}
                    disabled={fxDisabled}
                    ariaLabel="SMAA"
                    onChange={(next) => setPostFxTune({ smaa: next as MmdSmaaQuality })}
                    options={[
                      { value: "low", label: t("mmdSmaaLow") },
                      { value: "medium", label: t("mmdSmaaMedium") },
                      { value: "high", label: t("mmdSmaaHigh") },
                      { value: "ultra", label: t("mmdSmaaUltra") },
                    ]}
                  />
                </label>
                <label className="mmd-field">
                  <span>MSAA</span>
                  <MmdSelect
                    value={String(postFxTune.msaa)}
                    disabled={fxDisabled}
                    ariaLabel="MSAA"
                    onChange={(next) => setPostFxTune({ msaa: Number(next) as MmdMsaaSamples })}
                    options={[
                      { value: "0", label: t("mmdMsaaOff") },
                      { value: "2", label: "2x" },
                      { value: "4", label: "4x" },
                      { value: "8", label: "8x" },
                    ]}
                  />
                </label>
              </div>
            </PanelSection>
          </>
        ) : null}
          </>
        ) : null}

        {sideTab === "export" ? (
          <>
        <PanelSection title={t("mmdSectionExport")}>
          <div className="mmd-field-row">
            <label className="mmd-field">
              <span>{t("mmdResolution")}</span>
              <MmdSelect
                value={exportResolution}
                disabled={recording}
                ariaLabel={t("mmdResolution")}
                onChange={(next) => setExportResolution(next as MmdExportResolution)}
                options={[
                  { value: "480p", label: "480p" },
                  { value: "720p", label: "720p" },
                  { value: "1080p", label: "1080p" },
                  { value: "1440p", label: "1440p" },
                  { value: "2160p", label: "2160p" },
                  { value: "1080x1920", label: t("mmdExportRes1080v") },
                  { value: "720x1280", label: t("mmdExportRes720v") },
                  { value: "1080x1080", label: t("mmdExportResSquare") },
                  { value: "custom", label: t("mmdExportResCustom") },
                ]}
              />
            </label>
            <label className="mmd-field">
              <span>{t("mmdFps")}</span>
              <MmdSelect
                value={String(exportFps)}
                disabled={recording}
                ariaLabel={t("mmdFps")}
                onChange={(next) => setExportFps(Number(next) as 24 | 30 | 60 | 120)}
                options={[
                  { value: "24", label: "24" },
                  { value: "30", label: "30" },
                  { value: "60", label: "60" },
                  { value: "120", label: "120" },
                ]}
              />
            </label>
          </div>
          {exportResolution === "custom" ? (
            <div className="mmd-field-row">
              <NumberField
                label={t("mmdExportWidth")}
                value={exportCustomWidth}
                min={64}
                max={4096}
                step={2}
                disabled={recording}
                onChange={(width) => setExportCustomSize(width, exportCustomHeight, true)}
              />
              <NumberField
                label={t("mmdExportHeight")}
                value={exportCustomHeight}
                min={64}
                max={4096}
                step={2}
                disabled={recording}
                onChange={(height) => setExportCustomSize(exportCustomWidth, height, true)}
              />
            </div>
          ) : null}
          <label className="mmd-field">
            <span>{t("mmdExportMode")}</span>
            <MmdSelect
              value={exportMode}
              disabled={recording}
              ariaLabel={t("mmdExportMode")}
              onChange={(next) => setExportMode(next as MmdExportMode)}
              options={[
                { value: "offline", label: t("mmdExportModeOffline") },
                { value: "realtime", label: t("mmdExportModeRealtime") },
              ]}
            />
          </label>
          <div className="mmd-field-row">
            <label className="mmd-field">
              <span>{t("mmdExportCodec")}</span>
              <MmdSelect
                value={exportCodec}
                disabled={recording}
                ariaLabel={t("mmdExportCodec")}
                onChange={(next) => setExportCodec(next as MmdExportCodec)}
                options={(
                  [
                    "auto",
                    "h264",
                    "vp9",
                    "vp8",
                  ] as MmdExportCodec[]
                ).map((codec) => ({
                  value: codec,
                  label: codecLabel(codec, t),
                  disabled: exportMode === "realtime" && codec === "h264" && !isExportMp4Supported(),
                }))}
              />
            </label>
            <label className="mmd-field">
              <span>{t("mmdExportBitrate")}</span>
              <MmdSelect
                value={exportBitrate}
                disabled={recording}
                ariaLabel={t("mmdExportBitrate")}
                onChange={(next) => setExportBitrate(next as MmdExportBitrate)}
                options={(["low", "medium", "high", "ultra", "custom"] as MmdExportBitrate[]).map((rate) => ({
                  value: rate,
                  label: bitrateLabel(rate, t),
                }))}
              />
            </label>
          </div>
          {exportBitrate === "custom" ? (
            <NumberField
              label={t("mmdExportCustomVideoMbps")}
              value={exportCustomVideoMbps}
              min={0.5}
              max={200}
              step={0.5}
              disabled={recording}
              onChange={setExportCustomVideoMbps}
            />
          ) : null}
          <label className="mmd-field">
            <span>{t("mmdExportAudioBitrate")}</span>
            <MmdSelect
              value={exportAudioBitrate}
              disabled={recording || !exportIncludeAudio}
              ariaLabel={t("mmdExportAudioBitrate")}
              onChange={(next) => setExportAudioBitrate(next as MmdExportAudioBitrate)}
              options={(["low", "medium", "high", "custom"] as MmdExportAudioBitrate[]).map((rate) => ({
                value: rate,
                label: bitrateLabel(rate, t),
              }))}
            />
          </label>
          {exportAudioBitrate === "custom" ? (
            <NumberField
              label={t("mmdExportCustomAudioKbps")}
              value={exportCustomAudioKbps}
              min={32}
              max={512}
              step={16}
              disabled={recording || !exportIncludeAudio}
              onChange={setExportCustomAudioKbps}
            />
          ) : null}
          <label className="mmd-field">
            <span>{t("mmdExportFilePrefix")}</span>
            <input
              type="text"
              className="mmd-text-input"
              value={exportFilePrefix}
              disabled={recording}
              maxLength={48}
              onChange={(event) => setExportFilePrefix(event.target.value)}
              onBlur={(event) => setExportFilePrefix(event.target.value)}
            />
          </label>
          <label className="mmd-check">
            <input type="checkbox" checked={exportIncludeAudio} disabled={recording} onChange={(event) => setExportIncludeAudio(event.target.checked)} />
            <span>{t("mmdExportIncludeAudio")}</span>
          </label>
          <label className="mmd-check">
            <input type="checkbox" checked={exportHideGrid} disabled={recording} onChange={(event) => setExportHideGrid(event.target.checked)} />
            <span>{t("mmdExportHideGrid")}</span>
          </label>
          <label className="mmd-check">
            <input type="checkbox" checked={exportForceOneX} disabled={recording} onChange={(event) => setExportForceOneX(event.target.checked)} />
            <span>{t("mmdExportForceOneX")}</span>
          </label>
          <div className="mmd-range-actions">
            <button type="button" className="button-ghost mmd-mini-btn" disabled={recording || !onCaptureStill} onClick={() => void onCaptureStill?.()}>
              {t("mmdExportStill")}
            </button>
            <button type="button" className="button-ghost mmd-mini-btn" disabled={recording || !onExportSequence} onClick={() => void onExportSequence?.()}>
              {t("mmdExportSequence")}
            </button>
          </div>
          <p className="mmd-note">
            {exportSize.width}×{exportSize.height} · {exportBitsMbps} Mbps
            {exportIncludeAudio ? ` · ${exportAudioKbps} kbps audio` : ""}
            {exportMode === "realtime" ? ` · ${resolveExportMimeType(exportCodec)}` : " · WebCodecs"}
            {exportFps >= 120 ? ` · ${t("mmdExportFpsNote")}` : ""}
          </p>
          {exportProgress != null ? (
            <p className="mmd-note">
              {t("mmdExportProgress")}: {Math.round(exportProgress * 100)}%
            </p>
          ) : null}
          <p className="mmd-note">{t("mmdExportMp4Hint")}</p>
          <div className="mmd-range-row">
            <div className="mmd-meta-line">
              <span>{t("mmdExportRange")}</span>
              <span className="mmd-mono">{rangeLabel}</span>
            </div>
            <div className="mmd-range-actions">
              <button type="button" className="button-ghost mmd-mini-btn" disabled={recording} onClick={() => setExportIn(currentTime)}>{t("mmdMarkIn")}</button>
              <button type="button" className="button-ghost mmd-mini-btn" disabled={recording} onClick={() => setExportOut(currentTime)}>{t("mmdMarkOut")}</button>
              <button
                type="button"
                className="button-ghost mmd-mini-btn"
                disabled={recording || duration <= 0}
                onClick={() => {
                  setExportIn(0);
                  setExportOut(duration);
                }}
              >
                {t("mmdClearRange")}
              </button>
            </div>
          </div>
        </PanelSection>
          </>
        ) : null}

        {sideTab === "project" ? (
          <>
        <PanelSection title={t("mmdSectionProject")} collapsible defaultOpen>
          <label className="mmd-field">
            <span>{t("mmdProjectName")}</span>
            <input
              type="text"
              className="mmd-text-input"
              value={projectName}
              disabled={recording || projectBusy}
              maxLength={64}
              onChange={(event) => setProjectName(event.target.value)}
            />
          </label>
          <div className="mmd-range-actions">
            <button
              type="button"
              className="button-primary mmd-mini-btn"
              disabled={recording || projectBusy}
              onClick={() => void saveProjectWithFeedback()}
            >
              {t("mmdProjectSave")}
            </button>
            <button
              type="button"
              className="button-ghost mmd-mini-btn"
              disabled={recording || projectBusy}
              onClick={() => void saveProjectWithFeedback({ name: `${projectName} copy`, clearLastId: true })}
            >
              {t("mmdProjectSaveAs")}
            </button>
            <button
              type="button"
              className="button-ghost mmd-mini-btn"
              disabled={recording || projectBusy}
              onClick={() => void refreshProjectList()}
            >
              {t("mmdProjectRefresh")}
            </button>
          </div>
          <div className="mmd-range-actions">
            {onBackToProjects ? (
              <button
                type="button"
                className="button-ghost mmd-mini-btn"
                disabled={recording || projectBusy}
                onClick={onBackToProjects}
              >
                {t("mmdProjectBack")}
              </button>
            ) : null}
            {exportProject && lastProjectId ? (
              <button
                type="button"
                className="button-ghost mmd-mini-btn"
                disabled={recording || projectBusy}
                onClick={() => void exportProject(lastProjectId)}
              >
                {t("mmdProjectExport")}
              </button>
            ) : null}
            {importProject ? (
              <button
                type="button"
                className="button-ghost mmd-mini-btn"
                disabled={recording || projectBusy}
                onClick={() => importInputRef.current?.click()}
              >
                {t("mmdProjectImport")}
              </button>
            ) : null}
          </div>
          <p className="mmd-note">{t("mmdProjectHint")}</p>
          <div className="mmd-model-list">
            {projectList.length ? projectList.map((project) => (
              <div key={project.id} className={project.id === lastProjectId ? "mmd-model-item is-selected" : "mmd-model-item"}>
                <span className="mmd-model-item-name" title={project.name}>
                  {project.name}
                  <br />
                  <small className="mmd-note">{new Date(project.updatedAt).toLocaleString()}</small>
                </span>
                <span className="mmd-model-item-actions">
                  <button
                    type="button"
                    className="button-ghost mmd-mini-btn"
                    disabled={recording || projectBusy}
                    onClick={() => void loadProjectRecord(project)}
                  >
                    {t("mmdProjectLoad")}
                  </button>
                  {exportProject ? (
                    <button
                      type="button"
                      className="button-ghost mmd-mini-btn"
                      disabled={recording || projectBusy}
                      onClick={() => void exportProject(project.id)}
                    >
                      {t("mmdProjectExport")}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="button-ghost mmd-mini-btn"
                    disabled={recording || projectBusy}
                    onClick={() => void deleteProject(project.id)}
                  >
                    {t("mmdProjectDelete")}
                  </button>
                </span>
              </div>
            )) : <p className="mmd-note">{t("mmdProjectEmpty")}</p>}
          </div>
          <button
            type="button"
            className="button-ghost mmd-mini-btn"
            disabled={recording || projectBusy}
            onClick={() => void restoreAutosave()}
          >
            {t("mmdProjectRestoreAutosave")}
          </button>
          {importProject ? (
            <input
              ref={importInputRef}
              hidden
              type="file"
              accept=".json,.mmdstudio.json,application/json"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void importProject(file);
                event.target.value = "";
              }}
            />
          ) : null}
        </PanelSection>
          </>
        ) : null}
        </div>
      </aside>
  );
}
