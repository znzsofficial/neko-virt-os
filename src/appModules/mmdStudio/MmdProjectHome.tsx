import { Icon } from "@iconify-icon/react";
import { useMemo, useRef, useState } from "react";
import { useLanguageStore, type TranslationKey } from "../../languageStore";
import type { MmdProjectRecord } from "./mmdProjectDb";
import { MmdSelect } from "./mmdPanelUi";
import type { MmdProjectLoadProgress } from "./useMmdProjectController";

export type MmdProjectHomeProps = {
  projectList: MmdProjectRecord[];
  projectBusy: boolean;
  loadProgress?: MmdProjectLoadProgress | null;
  lastProjectId: string | null;
  hasAutosave: boolean;
  projectFolderLabel: string;
  projectFolderId: string | null;
  folderOptions: { id: string; name: string }[];
  onNewProject: () => void;
  onOpenProject: (record: MmdProjectRecord) => void;
  onDelete: (id: string) => void;
  onExport: (id: string) => void;
  onImportFile: (file: File) => void;
  onRestoreAutosave: () => void;
  onChooseFolder: (id: string | null) => void;
  onEnsureDefaultFolder: () => void;
  onRefresh: () => void;
};

function stageLabel(progress: MmdProjectLoadProgress, t: (key: TranslationKey) => string) {
  if (progress.phase === "prepare") return t("mmdProjectLoadStagePrepare");
  if (progress.phase === "assets") {
    return t("mmdProjectLoadStageAssets")
      .replace("{current}", String(progress.current))
      .replace("{total}", String(Math.max(1, progress.total)));
  }
  if (progress.phase === "hydrate") return t("mmdProjectLoadStageHydrate");
  if (progress.phase === "media") return t("mmdProjectLoadStageMedia");
  return t("mmdProjectLoadStageDone");
}

function progressRatio(progress: MmdProjectLoadProgress) {
  if (progress.phase === "prepare") return 0.08;
  if (progress.phase === "assets") {
    const total = Math.max(1, progress.total);
    return 0.1 + 0.55 * (progress.current / total);
  }
  if (progress.phase === "hydrate") return 0.78;
  if (progress.phase === "media") return 0.9;
  return 0.98;
}

export function MmdProjectHome({
  projectList,
  projectBusy,
  loadProgress = null,
  lastProjectId,
  hasAutosave,
  projectFolderLabel,
  projectFolderId,
  folderOptions,
  onNewProject,
  onOpenProject,
  onDelete,
  onExport,
  onImportFile,
  onRestoreAutosave,
  onChooseFolder,
  onEnsureDefaultFolder,
  onRefresh,
}: MmdProjectHomeProps) {
  const t = useLanguageStore((state) => state.t);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return projectList;
    return projectList.filter((project) => project.name.toLowerCase().includes(needle));
  }, [projectList, query]);

  const ratio = loadProgress ? progressRatio(loadProgress) : 0;

  return (
    <div className="mmd-project-home">
      <header className="mmd-project-home-head">
        <div>
          <h2>{t("mmdProjectHomeTitle")}</h2>
          <p className="mmd-note">{t("mmdProjectHomeHint")}</p>
          <p className="mmd-note mmd-project-open-hint">{t("mmdProjectOpenHint")}</p>
        </div>
        <div className="mmd-project-home-actions">
          <button type="button" className="button-primary" disabled={projectBusy} onClick={onNewProject}>
            <Icon icon="solar:add-circle-bold-duotone" width={15} height={15} />
            {t("mmdProjectNew")}
          </button>
          <button
            type="button"
            className="button-ghost"
            disabled={projectBusy}
            onClick={() => importInputRef.current?.click()}
          >
            <Icon icon="solar:import-bold-duotone" width={15} height={15} />
            {t("mmdProjectImport")}
          </button>
          <button type="button" className="button-ghost" disabled={projectBusy} onClick={onRefresh}>
            {t("mmdProjectRefresh")}
          </button>
          {hasAutosave ? (
            <button type="button" className="button-ghost" disabled={projectBusy} onClick={onRestoreAutosave}>
              {t("mmdProjectContinueAutosave")}
            </button>
          ) : null}
        </div>
      </header>

      <section className="mmd-project-home-folder">
        <label className="mmd-field mmd-project-home-folder-field">
          <span>{t("mmdProjectFolder")}</span>
          <MmdSelect
            value={projectFolderId ?? ""}
            disabled={projectBusy}
            ariaLabel={t("mmdProjectFolder")}
            onChange={(next) => onChooseFolder(next || null)}
            options={[
              { value: "", label: projectFolderLabel || t("mmdProjectFolderHint") },
              ...folderOptions.map((folder) => ({ value: folder.id, label: folder.name })),
            ]}
          />
        </label>
        <button type="button" className="button-ghost mmd-mini-btn" disabled={projectBusy} onClick={onEnsureDefaultFolder}>
          {t("mmdProjectFolderDefault")}
        </button>
      </section>

      {projectList.length > 4 ? (
        <label className="mmd-project-search">
          <Icon icon="solar:magnifer-bold-duotone" width={15} height={15} />
          <input
            value={query}
            disabled={projectBusy}
            placeholder={t("mmdProjectSearch")}
            spellCheck={false}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      ) : null}

      <section className="mmd-project-home-list" aria-busy={projectBusy}>
        {filtered.length ? (
          filtered.map((project) => {
            const active = project.id === lastProjectId;
            return (
              <article
                key={project.id}
                className={active ? "mmd-project-row is-active" : "mmd-project-row"}
                onDoubleClick={() => {
                  if (!projectBusy) onOpenProject(project);
                }}
              >
                <div className="mmd-project-row-main">
                  <strong className="mmd-project-row-name" title={project.name}>
                    {project.name}
                    {active ? <span className="mmd-project-row-badge">{t("mmdProjectLastOpened")}</span> : null}
                  </strong>
                  <span className="mmd-project-row-meta">
                    {new Date(project.updatedAt).toLocaleString()}
                    {" · "}
                    {t("mmdProjectModelsCount").replace("{n}", String(project.models?.length ?? 0))}
                  </span>
                </div>
                <div className="mmd-project-row-actions">
                  <button
                    type="button"
                    className="button-primary mmd-mini-btn"
                    disabled={projectBusy}
                    onClick={() => onOpenProject(project)}
                  >
                    {t("mmdProjectOpen")}
                  </button>
                  <button
                    type="button"
                    className="button-ghost mmd-mini-btn"
                    disabled={projectBusy}
                    onClick={() => onExport(project.id)}
                  >
                    {t("mmdProjectExport")}
                  </button>
                  <button
                    type="button"
                    className="button-ghost mmd-mini-btn"
                    disabled={projectBusy}
                    onClick={() => onDelete(project.id)}
                  >
                    {t("mmdProjectDelete")}
                  </button>
                </div>
              </article>
            );
          })
        ) : (
          <div className="mmd-project-home-empty">
            <Icon icon="solar:folder-open-bold-duotone" width={28} height={28} />
            <strong>{query.trim() ? t("mmdPickModelsEmpty") : t("mmdProjectEmpty")}</strong>
            <span className="mmd-note">{t("mmdProjectHint")}</span>
          </div>
        )}
      </section>

      {loadProgress ? (
        <div className="mmd-project-loading" role="status" aria-live="polite">
          <div className="mmd-project-loading-card">
            <strong>
              {t("mmdProjectOpenLoading").replace("{name}", loadProgress.projectName)}
            </strong>
            <p className="mmd-note">{stageLabel(loadProgress, t)}</p>
            <div className="mmd-import-progress-track">
              <div className="mmd-import-progress-fill" style={{ width: `${Math.round(ratio * 100)}%` }} />
            </div>
          </div>
        </div>
      ) : null}

      <input
        ref={importInputRef}
        hidden
        type="file"
        accept=".json,.mmdstudio.json,application/json"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onImportFile(file);
          event.target.value = "";
        }}
      />
    </div>
  );
}
