import type { ProviderMcpServer, ProviderMcpServerStatus } from "@t3tools/contracts";
import {
  mcpServerError,
  mcpServerOrigin,
  mcpToolDescription,
} from "@t3tools/provider-core/server/mcpServers";
import type * as CodexSchema from "effect-codex-app-server/schema";
import * as Predicate from "effect/Predicate";

type CodexMcpServerStatus = CodexSchema.V2ListMcpServerStatusResponse__McpServerStatus;

function codexStatus(server: CodexMcpServerStatus): ProviderMcpServerStatus {
  switch (server.runtimeStatus) {
    case "connected":
      return "connected";
    case "notStarted":
    case "starting":
      return "pending";
    case "authenticationRequired":
      return "needs-auth";
    case "failed":
    case "cancelled":
      return "failed";
    case "disabled":
      return "disabled";
    default:
      // No runtime state for this thread yet: fall back to what the listing itself shows.
      if (server.authStatus === "notLoggedIn") {
        return "needs-auth";
      }
      return Object.keys(server.tools).length > 0 ? "connected" : "pending";
  }
}

const readOnlyHint = (annotations: unknown) =>
  Predicate.isObject(annotations) && annotations.readOnlyHint === true;

export function mapCodexMcpServers(
  servers: ReadonlyArray<CodexMcpServerStatus>,
): ReadonlyArray<ProviderMcpServer> {
  return servers.map((server) => {
    const origin = mcpServerOrigin(server.name);
    const error = mcpServerError(server.toolsError);
    return {
      name: server.name,
      status: codexStatus(server),
      origin,
      ...(server.pluginId ? { scope: "plugin" } : {}),
      ...(error === undefined ? {} : { error }),
      ...(server.serverInfo?.version ? { version: server.serverInfo.version } : {}),
      tools: Object.values(server.tools).map((tool) => {
        const description = mcpToolDescription(tool.description ?? tool.title);
        return {
          name: tool.name,
          ...(description === undefined ? {} : { description }),
          ...(readOnlyHint(tool.annotations) ? { readOnly: true } : {}),
        };
      }),
    };
  });
}
