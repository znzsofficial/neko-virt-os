import type { TranslationKey } from "./languageStore";
import type { FileMutationErrorCode } from "./types";

const fileErrorKeyMap: Record<FileMutationErrorCode, TranslationKey> = {
  empty_name: "fileNameEmptyError",
  invalid_characters: "fileNameInvalidCharsError",
  duplicate_name: "fileNameConflictError",
  not_found: "fileNotFoundError",
  move_into_self: "moveIntoSelfError",
  move_into_descendant: "moveIntoDescendantError",
  invalid_target_path: "invalidTargetPath",
};

export function translateFileError(error: FileMutationErrorCode, t: (key: TranslationKey) => string) {
  return t(fileErrorKeyMap[error]);
}
