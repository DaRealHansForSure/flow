import type { ServerConfig, ServerConfigStreamEvent } from "@t3tools/contracts";
import * as Option from "effect/Option";

import {
  applyPullRequestsSetting,
  readAdvertisedPullRequestCapabilities,
  type AdvertisedPullRequestCapabilities,
} from "./pullRequestsSetting.ts";

export interface ServerConfigProjection {
  readonly config: ServerConfig;
  readonly latestEvent: ServerConfigStreamEvent;
  readonly source: "cache" | "live";
  /** Pull request capabilities as the server advertised them, before the
      `pullRequestsEnabled` setting folds into `config` (fork). */
  readonly advertisedPullRequests?: AdvertisedPullRequestCapabilities;
}

/**
 * Cached config keeps the provider and model catalog available across reconnects.
 * Published themes and usage-limit sources are current machine state, so a
 * cache could restore a set the machine no longer reports. Replay sends both
 * as separate events.
 */
export function withoutEnvironmentThemes(config: ServerConfig): ServerConfig {
  if (config.environmentThemes === undefined && config.usageLimitSources === undefined) {
    return config;
  }
  const { environmentThemes: _themes, usageLimitSources: _sources, ...rest } = config;
  return rest;
}

export function applyServerConfigProjection(
  current: Option.Option<ServerConfigProjection>,
  event: ServerConfigStreamEvent,
): Option.Option<ServerConfigProjection> {
  const next = applyServerConfigEvent(current, event);
  // Only snapshots and settings updates set the advertised pull request
  // capabilities; every other event keeps the ones it was built on (fork).
  if (Option.isNone(next) || next.value.advertisedPullRequests !== undefined) {
    return next;
  }
  if (Option.isNone(current) || current.value.advertisedPullRequests === undefined) {
    return next;
  }
  return Option.some({
    ...next.value,
    advertisedPullRequests: current.value.advertisedPullRequests,
  });
}

function applyServerConfigEvent(
  current: Option.Option<ServerConfigProjection>,
  event: ServerConfigStreamEvent,
): Option.Option<ServerConfigProjection> {
  switch (event.type) {
    case "snapshot": {
      // Wire snapshots never contain published themes. Keep the previous set
      // until a capable server sends its authoritative theme event. A legacy
      // server cannot send a later removal, so a downgrade must clear the set.
      const capabilities = event.config.environment.capabilities;
      const carriedThemes =
        capabilities.environmentThemes === true && Option.isSome(current)
          ? current.value.config.environmentThemes
          : undefined;
      const carriedSources =
        capabilities.usageLimitSources === true && Option.isSome(current)
          ? current.value.config.usageLimitSources
          : undefined;
      const advertisedPullRequests = readAdvertisedPullRequestCapabilities(event.config);
      return Option.some({
        config: applyPullRequestsSetting(
          {
            ...event.config,
            ...(carriedThemes === undefined ? {} : { environmentThemes: carriedThemes }),
            ...(carriedSources === undefined ? {} : { usageLimitSources: carriedSources }),
          },
          advertisedPullRequests,
        ),
        latestEvent: event,
        source: "live" as const,
        advertisedPullRequests,
      });
    }
    case "keybindingsUpdated":
      return Option.map(current, (projection) => ({
        config: {
          ...projection.config,
          keybindings: event.payload.keybindings,
          issues: event.payload.issues,
        },
        latestEvent: event,
        source: "live",
      }));
    case "providerStatuses":
      return Option.map(current, (projection) => ({
        config: {
          ...projection.config,
          providers: event.payload.providers,
        },
        latestEvent: event,
        source: "live",
      }));
    case "settingsUpdated":
      return Option.map(current, (projection) => {
        const advertisedPullRequests =
          projection.advertisedPullRequests ??
          readAdvertisedPullRequestCapabilities(projection.config);
        return {
          config: applyPullRequestsSetting(
            { ...projection.config, settings: event.payload.settings },
            advertisedPullRequests,
          ),
          latestEvent: event,
          source: "live",
          advertisedPullRequests,
        };
      });
    case "environmentThemesUpdated":
      return Option.map(current, (projection) => ({
        config: {
          ...projection.config,
          environmentThemes: event.payload.themes.length > 0 ? event.payload.themes : undefined,
        },
        latestEvent: event,
        source: "live",
      }));
    case "usageLimitSourcesUpdated":
      return Option.map(current, (projection) => ({
        config: {
          ...projection.config,
          usageLimitSources: event.payload.sources.length > 0 ? event.payload.sources : undefined,
        },
        latestEvent: event,
        source: "live",
      }));
  }
}
