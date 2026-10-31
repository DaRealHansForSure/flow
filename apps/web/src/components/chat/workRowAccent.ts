import type { OrchestrationV2TurnItem } from "@t3tools/contracts";

/** Flow: each kind of work row has its own colour, so thinking, commands and tools tell apart. */
export type WorkRowAccent = "thinking" | "command" | "tool" | "edit" | "search";

export function resolveWorkRowAccent(
  itemType: OrchestrationV2TurnItem["type"] | undefined,
): WorkRowAccent | null {
  switch (itemType) {
    case "reasoning":
      return "thinking";
    case "command_execution":
      return "command";
    case "dynamic_tool":
      return "tool";
    case "file_change":
      return "edit";
    case "file_search":
    case "web_search":
      return "search";
    default:
      return null;
  }
}

export const WORK_ROW_ACCENT_ICON_CLASS: Record<WorkRowAccent, string> = {
  thinking: "text-sky-600/80 dark:text-sky-400/80",
  command: "text-emerald-600 dark:text-emerald-400",
  tool: "text-violet-600 dark:text-violet-400",
  edit: "text-amber-600 dark:text-amber-400",
  search: "text-cyan-600 dark:text-cyan-400",
};
