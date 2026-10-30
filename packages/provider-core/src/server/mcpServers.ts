import type { ProviderMcpServerOrigin } from "@t3tools/contracts";
import { normalizeMcpServerName } from "@t3tools/shared/flowBrainMcp";

const MAX_TOOL_DESCRIPTION_LENGTH = 200;

/** T3's bridge is `t3-code`, or `t3-code-<thread>` where one server is shared by many threads. */
export function isFlowMcpServerName(name: string): boolean {
  return normalizeMcpServerName(name).startsWith("t3code");
}

export function mcpServerOrigin(name: string): ProviderMcpServerOrigin {
  if (isFlowMcpServerName(name)) {
    return "flow";
  }
  return normalizeMcpServerName(name) === "flowgraph" ? "flow-brain" : "provider";
}

export function mcpToolDescription(description: unknown): string | undefined {
  if (typeof description !== "string") {
    return undefined;
  }
  const firstLine = description.split("\n", 1)[0]?.trim() ?? "";
  if (firstLine.length === 0) {
    return undefined;
  }
  return firstLine.length > MAX_TOOL_DESCRIPTION_LENGTH
    ? `${firstLine.slice(0, MAX_TOOL_DESCRIPTION_LENGTH - 1)}…`
    : firstLine;
}

/** The first line of a provider error, without the stack or command output that can follow it. */
export function mcpServerError(error: unknown): string | undefined {
  return mcpToolDescription(error);
}
