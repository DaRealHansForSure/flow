// Fork-only: folds the server's `pullRequestsEnabled` setting into the
// capabilities clients already check (`pullRequests`, `threadPullRequestLinking`),
// so every surface that hides pull requests on a server without them also hides
// them when the user turned them off, on web and mobile alike.

import type { ServerConfig } from "@t3tools/contracts";

/** What the server itself advertised, before the setting is applied. */
export interface AdvertisedPullRequestCapabilities {
  readonly pullRequests: boolean;
  readonly threadPullRequestLinking: boolean;
}

export function readAdvertisedPullRequestCapabilities(
  config: ServerConfig,
): AdvertisedPullRequestCapabilities {
  const capabilities = config.environment.capabilities;
  return {
    pullRequests: capabilities.pullRequests === true,
    threadPullRequestLinking: capabilities.threadPullRequestLinking === true,
  };
}

/**
 * The config with pull request capabilities switched off while the setting is
 * off. Always derived from the advertised values, so turning the setting back
 * on restores exactly what the server supports.
 */
export function applyPullRequestsSetting(
  config: ServerConfig,
  advertised: AdvertisedPullRequestCapabilities,
): ServerConfig {
  // Servers that predate the setting send no value, which means "on".
  const enabled = config.settings.pullRequestsEnabled !== false;
  return {
    ...config,
    environment: {
      ...config.environment,
      capabilities: {
        ...config.environment.capabilities,
        pullRequests: advertised.pullRequests && enabled,
        threadPullRequestLinking: advertised.threadPullRequestLinking && enabled,
      },
    },
  };
}
