import type { ProviderMcpServer, ProviderMcpServerStatus } from "@t3tools/contracts";
import { mcpServerError, mcpServerOrigin } from "@t3tools/provider-core/server/mcpServers";

/** The status object both OpenCode 1.x (`mcp.status`) and 2.x (`mcp.list`) report per server. */
export interface OpenCodeMcpStatus {
  readonly status: string;
  readonly error?: string;
}

function openCodeStatus(status: string): ProviderMcpServerStatus {
  switch (status) {
    case "connected":
      return "connected";
    case "disabled":
      return "disabled";
    case "needs_auth":
    case "needs_client_registration":
      return "needs-auth";
    case "pending":
      return "pending";
    default:
      return "failed";
  }
}

/**
 * OpenCode 2.x serves every thread in a directory from one server, so each thread registers its
 * own `t3-code-<thread>` entry. Only `ownFlowEntry` belongs to the thread being listed.
 */
export function mapOpenCodeMcpServers(
  servers: ReadonlyArray<{ readonly name: string; readonly status: OpenCodeMcpStatus }>,
  ownFlowEntry?: string,
): ReadonlyArray<ProviderMcpServer> {
  return servers
    .filter(
      (server) =>
        ownFlowEntry === undefined ||
        mcpServerOrigin(server.name) !== "flow" ||
        server.name === ownFlowEntry,
    )
    .map((server) => {
      const error = mcpServerError(server.status.error);
      return {
        name: server.name,
        status: openCodeStatus(server.status.status),
        origin: mcpServerOrigin(server.name),
        ...(error === undefined ? {} : { error }),
      };
    });
}
