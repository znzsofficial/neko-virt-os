import { Icon } from "@iconify-icon/react";
import { useRef } from "react";
import { useLanguageStore } from "../../languageStore";
import type { MmdProjectRecord } from "./mmdProjectDb";
import { MmdSelect } from "./mmdPanelUi";

export type MmdProjectHomeProps = {
  projectList: MmdProjectRecord[];
  projectBusy: boolean;
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

export function MmdProjectHome({
  projectList,
  projectBusy,
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

  return (
    <div className="mmd-project-home">
      <header className="mmd-project-home-head">
        <div>
          <h2>{t("mmdProjectHomeTitle")}</h2>
          <p className="mmd-note">{t("mmdProjectHomeHint")}</p>
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

      <section className="mmd-project-home-list" aria-busy={projectBusy}>
        {projectList.length ? (
          projectList.map((project) => {
            const active = project.id === lastProjectId;
            return (
              <article key={project.id} className={active ? "mmd-project-row is-active" : "mmd-project-row"}>
                <div className="mmd-project-row-main">
                  <strong className="mmd-project-row-name" title={project.name}>
                    {project.name}
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
            <strong>{t("mmdProjectEmpty")}</strong>
            <span className="mmd-note">{t("mmdProjectHint")}</span>
          </div>
        )}
      </section>

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
