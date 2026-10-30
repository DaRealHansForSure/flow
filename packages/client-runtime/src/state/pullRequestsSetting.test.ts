import {
  DEFAULT_SERVER_SETTINGS,
  EnvironmentId,
  type ServerConfig,
  type ServerConfigStreamEvent,
} from "@t3tools/contracts";
import { describe, expect, it } from "@effect/vitest";
import * as Option from "effect/Option";

import {
  applyServerConfigProjection,
  type ServerConfigProjection,
} from "./serverConfigProjection.ts";

const CONFIG: ServerConfig = {
  environment: {
    environmentId: EnvironmentId.make("environment-test"),
    label: "Test",
    platform: { os: "linux", arch: "x64" },
    serverVersion: "0.0.0-test",
    capabilities: {
      repositoryIdentity: true,
      connectionProbe: true,
      pullRequests: true,
      threadPullRequestLinking: true,
    },
  },
  auth: {
    policy: "loopback-browser",
    bootstrapMethods: ["one-time-token"],
    sessionMethods: ["browser-session-cookie", "bearer-access-token"],
    sessionCookieName: "t3_session",
  },
  cwd: "/tmp/workspace",
  keybindingsConfigPath: "/tmp/workspace/keybindings.json",
  keybindings: [],
  issues: [],
  providers: [],
  availableEditors: [],
  observability: {
    logsDirectoryPath: "/tmp/logs",
    localTracingEnabled: false,
    otlpTracesEnabled: false,
    otlpMetricsEnabled: false,
    otlpLogsEnabled: false,
  },
  settings: DEFAULT_SERVER_SETTINGS,
};

const settingsEvent = (pullRequestsEnabled: boolean): ServerConfigStreamEvent => ({
  version: 1,
  type: "settingsUpdated",
  payload: { settings: { ...DEFAULT_SERVER_SETTINGS, pullRequestsEnabled } },
});

const pullRequestCapabilities = (projection: Option.Option<ServerConfigProjection>) => {
  const capabilities = Option.getOrThrow(projection).config.environment.capabilities;
  return [capabilities.pullRequests, capabilities.threadPullRequestLinking];
};

describe("pullRequestsEnabled in the server config projection", () => {
  it("turns the capabilities off and restores them through unrelated events", () => {
    const events: ServerConfigStreamEvent[] = [
      { version: 1, type: "snapshot", config: CONFIG },
      settingsEvent(false),
      { version: 1, type: "keybindingsUpdated", payload: { keybindings: [], issues: [] } },
      settingsEvent(true),
    ];
    const seen: Array<Array<boolean | undefined>> = [];
    let projection = Option.none<ServerConfigProjection>();
    for (const event of events) {
      projection = applyServerConfigProjection(projection, event);
      seen.push(pullRequestCapabilities(projection));
    }
    expect(seen).toEqual([
      [true, true],
      [false, false],
      [false, false],
      [true, true],
    ]);
  });

  it("never turns on what the server does not advertise", () => {
    const withoutPullRequests: ServerConfig = {
      ...CONFIG,
      environment: {
        ...CONFIG.environment,
        capabilities: { repositoryIdentity: true, connectionProbe: true },
      },
    };
    const projection = applyServerConfigProjection(
      applyServerConfigProjection(Option.none(), {
        version: 1,
        type: "snapshot",
        config: withoutPullRequests,
      }),
      settingsEvent(true),
    );
    expect(pullRequestCapabilities(projection)).toEqual([false, false]);
  });
});
