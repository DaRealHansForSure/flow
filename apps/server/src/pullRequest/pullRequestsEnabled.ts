// Fork-only: the one read of the `pullRequestsEnabled` setting that every server
// gate shares, so they all agree on what an unreadable settings file means.

import * as Effect from "effect/Effect";

import type * as ServerSettings from "../serverSettings.ts";

/**
 * Whether pull/merge request features are on. A settings read that fails keeps
 * them on: that is the behavior before the setting existed, and a broken
 * settings file should not silently remove features.
 */
export const readPullRequestsEnabled = (
  settingsService: ServerSettings.ServerSettingsService["Service"],
): Effect.Effect<boolean> =>
  settingsService.getSettings.pipe(
    Effect.map((settings) => settings.pullRequestsEnabled),
    Effect.orElseSucceed(() => true),
  );
