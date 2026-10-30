// @effect-diagnostics nodeBuiltinImport:off - Pure path comparison.
// Flow: chats started with No project live in the scratch project. They may read a Brain but
// never write to one, and the scratch folder is never a Brain source.
import * as NodePath from "node:path";

/** The scratch project's folder, as ManagedProjectFolders creates it under the T3 home. */
export function isScratchWorkspace(baseDir: string, workspaceRoot: string | undefined): boolean {
  return (
    workspaceRoot !== undefined &&
    NodePath.resolve(workspaceRoot) === NodePath.resolve(baseDir, "scratch")
  );
}
