// Fork-only: the pull request service as clients reach it, refusing every
// operation while Settings has pull requests turned off. Wrapping the service
// once, instead of each RPC handler in ws.ts, keeps the fork's footprint in
// upstream code to the line that picks the service up, and gates operations a
// later upstream sync adds without anyone remembering to.

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
    // Every function member is an operation returning Effect<_, PullRequestError>,
    // and PullRequestOperationError is one of those errors, so the wrapper keeps
    // each signature. All arguments pass through: some operations take options or
    // an inner effect (withRoutingCredential) after their input. The non-function members (refresh and merge streams,
    // refreshAfterTurn) only signal clients to re-read, which these gates refuse.
    if (typeof member === "function") {
      gated[name] = (...args: ReadonlyArray<unknown>) =>
        requireEnabled(name).pipe(
          Effect.andThen(Effect.suspend(() => (member as PullRequestOperation)(...args))),
        );
    }
  }
  return PullRequestService.PullRequestService.of(gated as Service);
};
