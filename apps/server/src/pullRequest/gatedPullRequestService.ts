// Fork-only: the pull request service as clients reach it, refusing every
// operation while Settings has pull requests turned off. Wrapping the service
// once, not each ws.ts handler, keeps the fork's upstream footprint to one line
// and also gates operations a later upstream sync adds.

import { PullRequestOperationError } from "@t3tools/contracts";
import * as Effect from "effect/Effect";

import type * as ServerSettings from "../serverSettings.ts";
import * as PullRequestService from "./PullRequestService.ts";
import { readPullRequestsEnabled } from "./pullRequestsEnabled.ts";

type Service = PullRequestService.PullRequestService["Service"];
type PullRequestOperation = (
  ...args: ReadonlyArray<unknown>
) => Effect.Effect<unknown, PullRequestService.PullRequestError>;

const TURNED_OFF_DETAIL = "Pull requests are turned off in Settings > Source Control.";

/** The service with every operation refused while pull requests are off. */
export const gatePullRequestService = (
  service: Service,
  settingsService: ServerSettings.ServerSettingsService["Service"],
): Service => {
  const requireEnabled = (operation: string) =>
    readPullRequestsEnabled(settingsService).pipe(
      Effect.flatMap((enabled) => {
        if (enabled) {
          return Effect.void;
        }
        return Effect.fail(new PullRequestOperationError({ operation, detail: TURNED_OFF_DETAIL }));
      }),
    );

  const gated: Record<string, unknown> = { ...service };
  for (const [name, member] of Object.entries(service)) {
    // Every function member returns Effect<_, PullRequestError> and
    // PullRequestOperationError is one of those, so each signature is kept. All
    // arguments pass through (withRoutingCredential takes an inner effect). The
    // non-function members only signal clients to re-read, which the gates refuse.
    if (typeof member === "function") {
      gated[name] = (...args: ReadonlyArray<unknown>) =>
        requireEnabled(name).pipe(
          Effect.andThen(Effect.suspend(() => (member as PullRequestOperation)(...args))),
        );
    }
  }
  return PullRequestService.PullRequestService.of(gated as Service);
};
