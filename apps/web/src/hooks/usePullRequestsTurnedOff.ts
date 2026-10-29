// Fork-only: whether the user turned pull requests off for an environment
// (Settings > Source Control). Most surfaces follow the `pullRequests` capability,
// which client-runtime already folds this setting into; this hook covers the ones
// that act on pull request data stored on threads, such as sidebar badges.

import type { EnvironmentId } from "@t3tools/contracts";

import { useEnvironment } from "../state/environments";

/** True only when the environment's settings say off; unknown counts as on. */
export function usePullRequestsTurnedOff(environmentId: EnvironmentId | null): boolean {
  const environment = useEnvironment(environmentId);
  return environment?.serverConfig?.settings.pullRequestsEnabled === false;
}
