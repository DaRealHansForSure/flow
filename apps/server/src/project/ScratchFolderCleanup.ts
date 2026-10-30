import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Path from "effect/Path";

import * as ThreadManagementService from "../orchestration-v2/ThreadManagementService.ts";
import * as ManagedProjectFolders from "./ManagedProjectFolders.ts";

/**
 * A folder younger than this is left alone: a new No project chat creates its folder just before
 * the chat itself exists, so an unreferenced young folder may be a chat still starting.
 */
const MIN_ORPHAN_AGE_MS = 60 * 60 * 1000;

export interface ScratchFolderRemoval {
  readonly path: string;
  readonly outcome: "removed" | "kept" | "failed";
  readonly reason: string;
  readonly bytes: number | null;
}

/**
 * Flow: No project chats each get a folder under `<home>/scratch`. Nothing removed those folders,
 * so deleting a chat now removes its folder, and storage cleanup removes folders left behind.
 * A reference with a no-op default, like ResourceCleanupService, so runtimes without it still build.
 */
export interface ScratchFolderCleanupShape {
  /** After a chat is deleted: removes its folder unless another chat still works there. */
  readonly removeThreadFolder: (worktreePath: string) => Effect.Effect<void>;
  /** Removes every scratch folder that no chat, active or archived, works in any more. */
  readonly removeOrphans: (nowMs: number) => Effect.Effect<ReadonlyArray<ScratchFolderRemoval>>;
}

export class ScratchFolderCleanup extends Context.Reference<ScratchFolderCleanupShape>(
  "t3/project/ScratchFolderCleanup",
  {
    defaultValue: () => ({
      removeThreadFolder: () => Effect.void,
      removeOrphans: () => Effect.succeed([]),
    }),
  },
) {}

const make = Effect.gen(function* () {
  const managedFolders = yield* ManagedProjectFolders.ManagedProjectFolders;
  const threads = yield* ThreadManagementService.ThreadManagementService;
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  /** Only a direct child of the scratch root is a chat's own folder. */
  const scratchFolderOf = (worktreePath: string) =>
    managedFolders.scratchRoot.pipe(
      Effect.map((root) =>
        Option.isSome(root) && path.dirname(path.resolve(worktreePath)) === path.resolve(root.value)
          ? Option.some(path.resolve(worktreePath))
          : Option.none<string>(),
      ),
    );

  const isInUse = (folder: string) =>
    Effect.flatten(threads.readShellSnapshot({ worktreePath: folder })).pipe(
      Effect.map((snapshot) => snapshot.threads.length + snapshot.archivedThreads.length > 0),
      // When the chats cannot be read, keep the folder.
      Effect.orElseSucceed(() => true),
    );

  const folderBytes = Effect.fn("ScratchFolderCleanup.folderBytes")(
    function* (folder: string) {
      const entries = yield* fileSystem.readDirectory(folder, { recursive: true });
      let total = 0;
      for (const entry of entries) {
        const info = yield* fileSystem.stat(path.join(folder, entry));
        if (info.type === "File") {
          total += Number(info.size);
        }
      }
      return total;
    },
    Effect.orElseSucceed((): number | null => null),
  );

  const removeFolder = (folder: string) =>
    fileSystem.remove(folder, { recursive: true, force: true });

  const removeThreadFolder: ScratchFolderCleanupShape["removeThreadFolder"] = Effect.fn(
    "ScratchFolderCleanup.removeThreadFolder",
  )(function* (worktreePath) {
    const folder = yield* scratchFolderOf(worktreePath);
    if (Option.isNone(folder) || (yield* isInUse(folder.value))) {
      return;
    }
    yield* removeFolder(folder.value).pipe(
      Effect.catch((error) =>
        Effect.logWarning("Could not remove a deleted chat's folder", {
          folder: folder.value,
          error,
        }),
      ),
    );
  });

  const removeOrphans: ScratchFolderCleanupShape["removeOrphans"] = Effect.fn(
    "ScratchFolderCleanup.removeOrphans",
  )(function* (nowMs) {
    const root = yield* managedFolders.scratchRoot;
    if (Option.isNone(root)) {
      return [];
    }
    const names = yield* fileSystem
      .readDirectory(root.value)
      .pipe(Effect.orElseSucceed((): ReadonlyArray<string> => []));
    const removals: ScratchFolderRemoval[] = [];
    for (const name of names) {
      const folder = path.join(root.value, name);
      const info = yield* fileSystem.stat(folder).pipe(Effect.option);
      if (Option.isNone(info) || info.value.type !== "Directory") {
        continue;
      }
      const modifiedMs = Option.match(info.value.mtime, {
        onNone: () => nowMs,
        onSome: (date) => date.getTime(),
      });
      if (nowMs - modifiedMs < MIN_ORPHAN_AGE_MS || (yield* isInUse(folder))) {
        continue;
      }
      const bytes = yield* folderBytes(folder);
      const removal = yield* removeFolder(folder).pipe(
        Effect.as<ScratchFolderRemoval>({
          path: folder,
          outcome: "removed",
          reason: "No chat uses this folder any more",
          bytes,
        }),
        Effect.catch((error) =>
          Effect.succeed<ScratchFolderRemoval>({
            path: folder,
            outcome: "failed",
            reason: `Could not remove the folder: ${error.message}`,
            bytes,
          }),
        ),
      );
      removals.push(removal);
    }
    return removals;
  });

  return { removeThreadFolder, removeOrphans } satisfies ScratchFolderCleanupShape;
});

export const layer = Layer.effect(ScratchFolderCleanup, make);
