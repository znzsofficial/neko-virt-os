export type { FsFile } from "./virtualFs";
export {
  listFiles,
  createTextFile,
  createFolder,
  updateFileContent,
  renameFile,
  moveFile,
  deleteFile,
  restoreFile,
  permanentlyDeleteFile,
  emptyTrash,
  resetVirtualFiles,
  touchFile,
} from "./virtualFs";

export { useFsStore } from "./fsStore";

export {
  findFileByName,
  findEntryByNameInFolder,
  splitFsPath,
  resolveFolderPath,
  resolveEntryPath,
  isFolderDescendant,
  getFileNameError,
  getMoveError,
  sortFiles,
  formatFileSize,
  formatFileTime,
} from "./fileUtils";

export { translateFileError } from "./fileErrorUtils";

export {
  getFileOpenApp,
  getFileOpenLabelKey,
  queueBrowserOpenUrl,
  consumeBrowserOpenUrl,
} from "./fileOpen";
