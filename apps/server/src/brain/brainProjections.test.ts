import { expect, it } from "@effect/vitest";
import { ProjectId, type OrchestrationProjectShell } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import * as ProjectionStore from "../orchestration-v2/ProjectionStore.ts";
import * as ProjectStore from "../orchestration-v2/ProjectStore.ts";
import * as ProjectEnrichmentService from "../project/ProjectEnrichmentService.ts";
import { makeBrainProjections } from "./brainProjections.ts";

const project = {
  id: ProjectId.make("example-project"),
  workspaceRoot: "/projects/example",
  repositoryIdentity: null,
} as unknown as OrchestrationProjectShell;
const identity = { canonicalKey: "git.example.com/team/example" };

// Brain bindings are keyed by repository, which the v2 project store leaves empty.
it.effect("gives the Brain each project's repository", () =>
  Effect.gen(function* () {
    const projections = yield* makeBrainProjections;
    const single = yield* projections.getProjectShellById(project.id);
    const listed = yield* projections.listProjectShells;
    expect(Option.getOrThrow(single).repositoryIdentity).toEqual(identity);
    expect(listed.map((project) => project.repositoryIdentity)).toEqual([identity]);
  }).pipe(
    Effect.provideService(
      ProjectionStore.ProjectionStoreV2,
      {} as unknown as ProjectionStore.ProjectionStoreV2["Service"],
    ),
    Effect.provideService(ProjectStore.ProjectStoreV2, {
      getShell: () => Effect.succeedSome(project),
      listShells: () => Effect.succeed([project]),
    } as unknown as ProjectStore.ProjectStoreV2["Service"]),
    Effect.provideService(ProjectEnrichmentService.ProjectEnrichmentService, {
      readRepositoryIdentity: (workspaceRoot: string) =>
        Effect.succeed(workspaceRoot === project.workspaceRoot ? identity : null),
    } as unknown as ProjectEnrichmentService.ProjectEnrichmentService["Service"]),
  ),
);
