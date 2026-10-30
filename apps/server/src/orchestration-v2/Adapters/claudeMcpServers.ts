import type { McpServerStatus } from "@anthropic-ai/claude-agent-sdk";
import type { ProviderMcpServer } from "@t3tools/contracts";
import {
  isFlowMcpServerName,
  mcpServerError,
  mcpServerOrigin,
  mcpToolDescription,
} from "@t3tools/provider-core/server/mcpServers";

// T3 registers its bridge through setMcpServers; a user server named t3-code is not ours.
const FLOW_REGISTERED_SOURCES = new Set(["dynamic", "sdk"]);

/** `config` can hold URLs, headers and env, so it never leaves this mapper. */
export function mapClaudeMcpServers(
  statuses: ReadonlyArray<McpServerStatus>,
): ReadonlyArray<ProviderMcpServer> {
  return statuses.map((status) => {
    const scope = status.source ?? status.scope;
    const registeredByFlow =
      isFlowMcpServerName(status.name) &&
      (scope === undefined || FLOW_REGISTERED_SOURCES.has(scope));
    const origin = registeredByFlow
      ? "flow"
      : mcpServerOrigin(status.name) === "flow-brain"
        ? "flow-brain"
        : "provider";
    const error = mcpServerError(status.error);
    return {
      name: status.name,
      status: status.status,
      origin,
      ...(scope === undefined || origin === "flow" ? {} : { scope }),
      ...(error === undefined ? {} : { error }),
      ...(status.serverInfo?.version ? { version: status.serverInfo.version } : {}),
      tools: (status.tools ?? []).map((tool) => {
        const description = mcpToolDescription(tool.description);
        return {
          name: tool.name,
          ...(description === undefined ? {} : { description }),
          ...(tool.annotations?.readOnly === true ? { readOnly: true } : {}),
        };
      }),
    };
  });
}
