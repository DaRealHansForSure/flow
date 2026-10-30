import { RegistryContext, useAtomValue } from "@effect/atom-react";
import type { EnvironmentId } from "@t3tools/contracts";
import { AsyncResult, Atom } from "effect/reactivity";
import { useContext } from "react";

import { agentSessionScan } from "../state/agentSessions";
import { formatEnvironmentQueryError } from "../state/query";

type ScanTarget = readonly [environmentId: EnvironmentId, roots: readonly string[]];

const scanAtom = (environmentId: EnvironmentId, roots: readonly string[]) =>
  agentSessionScan({ environmentId, input: { roots } });

// Fork: keyed by each computer's chosen folders as well, so changing them starts a new scan.
const projectScansAtom = Atom.family((key: string) => {
  const targets = JSON.parse(key) as ReadonlyArray<ScanTarget>;
  return Atom.make((get) =>
    targets.map(([environmentId, roots]) => get(scanAtom(environmentId, roots))),
  ).pipe(Atom.withLabel(`web-project-scans:${key}`));
});

/** Subscribe to each selected computer, scanning the folders chosen for it. */
export function useProjectScans(
  environmentIds: readonly EnvironmentId[],
  roots: ReadonlyMap<EnvironmentId, readonly string[]>,
) {
  const registry = useContext(RegistryContext);
  const targets = environmentIds.map((environmentId): ScanTarget => [
    environmentId,
    roots.get(environmentId) ?? [],
  ]);
  const results = useAtomValue(projectScansAtom(JSON.stringify(targets)));
  return targets.map(([environmentId, environmentRoots], index) => {
    const result = results[index]!;
    return {
      environmentId,
      data: AsyncResult.getOrElse(result, () => null),
      error: result._tag === "Failure" ? formatEnvironmentQueryError(result.cause) : null,
      isPending: result.waiting || result._tag === "Initial",
      refresh: () => registry.refresh(scanAtom(environmentId, environmentRoots)),
    };
  });
}
