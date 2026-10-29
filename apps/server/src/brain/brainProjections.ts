// Fork-only: the reads the Brain needs about chats and projects, on top of T3's
// orchestration-v2 stores. T3 replaced the old ProjectionSnapshotQuery with these
// stores; keeping the Brain behind this one module means the next T3 change to
// them is followed here instead of in every Brain file.

import type { OrchestrationProjectShell, ProjectId, ThreadId } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import * as ProjectionStore from "../orchestration-v2/ProjectionStore.ts";
import * as ProjectStore from "../orchestration-v2/ProjectStore.ts";

type ThreadShell = NonNullable<
  Effect.Success<ReturnType<ProjectionStore.ProjectionStoreV2Shape["getThreadShell"]>>
>;

export interface BrainProjections {
  readonly getThreadShellById: (
    threadId: ThreadId,
  ) => Effect.Effect<Option.Option<ThreadShell>, Error>;
  readonly getProjectShellById: (
    projectId: ProjectId,
  ) => Effect.Effect<Option.Option<OrchestrationProjectShell>, Error>;
  readonly listProjectShells: Effect.Effect<ReadonlyArray<OrchestrationProjectShell>, Error>;
}

/** Builds the Brain's read view from the stores the running server provides. */
export const makeBrainProjections = Effect.gen(function* () {
  const threads = yield* ProjectionStore.ProjectionStoreV2;
  const projects = yield* ProjectStore.ProjectStoreV2;
  return {
    getThreadShellById: (threadId) =>
      threads.getThreadShell(threadId).pipe(Effect.map(Option.fromNullishOr)),
    getProjectShellById: (projectId) => projects.getShell(projectId),
    listProjectShells: Effect.suspend(() => projects.listShells()),
  } satisfies BrainProjections;
});
