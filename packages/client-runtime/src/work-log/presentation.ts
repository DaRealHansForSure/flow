import {
  isOrchestrationV2WorkActive,
  isToolLifecycleItemType,
  type AssetResource,
  type RuntimeItemStatus,
  type ToolActivitySource,
  type ToolActivitySurface,
  type ToolActivityIcon,
  type OrchestrationV2TurnItem,
  type ThreadId,
} from "@t3tools/contracts";
import {
  resolveT3McpSummaryAction,
  resolveT3McpToolDefinition,
  type T3McpToolDefinition,
  type T3McpToolSummaryAction,
} from "@t3tools/shared/t3McpToolPresentation";
import {
  flowBrainMcpToolNameFromData,
  flowBrainMcpToolNameFromLabel,
} from "@t3tools/shared/flowBrainMcp";
import { classifyMarkdownImageSource } from "@t3tools/client-runtime/markdown-images";
import { resolveMediaSource } from "@t3tools/client-runtime/media-source";
import { sourceControlClients } from "@t3tools/client-runtime/source-control-clients";
import { isWorkspaceImagePreviewPath } from "@t3tools/shared/mediaPreview";
import { formatTokens } from "@t3tools/shared/usageFormat";
import { classifyToolActivity } from "@t3tools/shared/toolActivity";
import { toolOutputIndicatesFailure } from "@t3tools/shared/toolOutput";

import {
  summarizeT3ToolCalls,
  t3ToolResultIndicatesFailure,
  type T3ToolSummaryCall,
} from "@t3tools/client-runtime/t3ToolSummary";

export type WorkLogToolLifecycleStatus = RuntimeItemStatus | "stopped" | "idle";

export function toolItemForDisplay(item: OrchestrationV2TurnItem): OrchestrationV2TurnItem {
  switch (item.type) {
    case "command_execution":
    case "dynamic_tool": {
      const { output: _output, ...displayItem } = item;
      return displayItem;
    }
    case "file_change": {
      const { diffStr, oldStr: _oldStr, newStr: _newStr, ...displayItem } = item;
      // A failed edit's diffStr holds the provider's error, not a diff.
      return item.status === "failed" && diffStr?.trim()
        ? { ...displayItem, diffStr }
        : displayItem;
    }
    default:
      return item;
  }
}

type CompactionLabelItem = Pick<
  Extract<OrchestrationV2TurnItem, { type: "compaction" }>,
  "status" | "beforeTokenCount" | "afterTokenCount"
>;

export function contextCompactionTokenCounts(
  item: CompactionLabelItem,
): { readonly before: string; readonly after: string } | null {
  if (
    item.status === "running" ||
    item.beforeTokenCount === undefined ||
    item.afterTokenCount === undefined
  ) {
    return null;
  }
  return { before: formatTokens(item.beforeTokenCount), after: formatTokens(item.afterTokenCount) };
}

export function contextCompactionLabel(item: CompactionLabelItem): string {
  if (item.status === "failed") return "Context compaction failed";
  if (item.status === "cancelled" || item.status === "interrupted")
    return "Context compaction stopped";
  if (isOrchestrationV2WorkActive(item.status)) return "Compacting context";
  const tokens = contextCompactionTokenCounts(item);
  return tokens
    ? `Context compacted ${tokens.before} → ${tokens.after} tokens`
    : "Context compacted";
}

export interface WorkLogPresentationEntry {
  readonly questionAnswer?: import("@t3tools/contracts").UserInputAttachmentAnswerPayload;
  readonly id: string;
  readonly createdAt: string;
  readonly label: string;
  readonly tone: "thinking" | "tool" | "info" | "error";
  readonly command?: string;
  readonly rawCommand?: string;
  readonly detail?: string;
  readonly viewedImagePath?: string;
  readonly changedFiles?: ReadonlyArray<string>;
  readonly toolTitle?: string;
  readonly toolData?: unknown;
  readonly requestKind?: string;
  readonly itemType?: OrchestrationV2TurnItem["type"];
  readonly toolLifecycleStatus?: WorkLogToolLifecycleStatus;
  readonly structuredPayload?: OrchestrationV2TurnItem;
  readonly toolSource?: ToolActivitySource;
  readonly toolSurface?: ToolActivitySurface;
  readonly toolIcon?: ToolActivityIcon;
}

export type ToolGroupAction =
  | "link-pr"
  | "unlink-pr"
  | "list-prs"
  | "watch-pr"
  | "unwatch-pr"
  | "read"
  | "edit"
  | "command"
  | "brain"
  | "thread-create"
  | "browser"
  | "device"
  | "code-search"
  | "search"
  | "other"
  | "update";

export type ToolGroupSummaryKind =
  | "pull-request"
  | ToolGroupAction
  | "dynamic-tool"
  | "reasoning"
  | "agent-tool"
  | "tone-tool"
  | "mixed";

export function normalizeCompactToolLabel(value: string): string {
  return value.replace(/\s+(?:complete|completed)\s*$/i, "").trim();
}

function workEntryToolName(
  entry: Pick<WorkLogPresentationEntry, "label" | "toolTitle" | "toolData" | "structuredPayload">,
): string | undefined {
  const item = entry.structuredPayload;
  if (item?.type === "dynamic_tool" && item.toolName) return item.toolName;
  const data = asRecord(entry.toolData);
  if (typeof data?.server === "string" && typeof data.tool === "string") {
    return `${data.server}.${data.tool}`;
  }
  if (typeof data?.toolName === "string") return data.toolName;
  return resolveT3McpToolDefinition(entry.toolTitle) ? entry.toolTitle : entry.label;
}

function workEntryToolInput(
  entry: Pick<WorkLogPresentationEntry, "toolData" | "structuredPayload">,
): unknown {
  const item = entry.structuredPayload;
  const data = asRecord(entry.toolData);
  return item?.type === "dynamic_tool"
    ? item.input
    : (data?.arguments ?? data?.input ?? data?.rawInput);
}

function workEntryToolOutput(
  entry: Pick<WorkLogPresentationEntry, "toolData" | "structuredPayload">,
): unknown {
  const item = entry.structuredPayload;
  const data = asRecord(entry.toolData);
  return item?.type === "dynamic_tool"
    ? item.output
    : (data?.output ?? data?.result ?? data?.rawOutput ?? data?.content);
}

export interface FlowBrainToolCallDetails {
  readonly tool: string;
  readonly toolLabel: string;
  readonly request: unknown;
  readonly response: unknown;
}

export interface FlowBrainDisplayField {
  readonly label: string;
  readonly value: string | ReadonlyArray<string>;
  readonly code?: boolean;
}

export interface FlowBrainDisplayItem {
  readonly title: string;
  readonly eyebrow?: string;
  readonly id?: string;
  readonly description?: string;
  readonly fields?: ReadonlyArray<FlowBrainDisplayField>;
  readonly tags?: ReadonlyArray<string>;
  readonly tone?: "default" | "muted" | "warning" | "danger";
}

export interface FlowBrainDisplaySection {
  readonly title: string;
  readonly subtitle?: string;
  readonly items?: ReadonlyArray<FlowBrainDisplayItem>;
  readonly fields?: ReadonlyArray<FlowBrainDisplayField>;
  readonly tags?: ReadonlyArray<string>;
  readonly text?: string;
  readonly code?: boolean;
  readonly tone?: "default" | "muted" | "warning" | "danger";
}

export interface FlowBrainConsultationDisplay {
  readonly tool: string;
  readonly toolLabel: string;
  readonly requestFields: ReadonlyArray<FlowBrainDisplayField>;
  readonly responseSummary: string;
  readonly responseSections: ReadonlyArray<FlowBrainDisplaySection>;
}

function flowBrainToolLabel(tool: string): string {
  const words = tool.replace(/[-_]+/g, " ").trim();
  return words.length > 0 ? `${words.charAt(0).toUpperCase()}${words.slice(1)}` : "Brain query";
}

function resolveFlowBrainMcpToolPresentation(tool: string, status: string | undefined) {
  const verb =
    status === undefined || status === "inProgress"
      ? "Consulting the brain"
      : status === "failed"
        ? "Couldn't consult the brain"
        : status === "declined"
          ? "Declined to consult the brain"
          : status === "stopped"
            ? "Stopped consulting the brain"
            : "Consulted the brain";
  return {
    displayName: `${verb} · ${flowBrainToolLabel(tool)}`,
    icon: "brain" as const,
    // Matches the T3 presentation's shape so callers can read `action` on either.
    action: undefined,
  };
}

function resolveT3McpToolPresentation(
  definition: T3McpToolDefinition | null,
  status: string | undefined,
  data?: unknown,
) {
  if (!definition) return null;
  const [action, running, completed, detail] = definition.labels;
  const verb =
    status === "inProgress"
      ? running
      : status === "completed"
        ? completed
        : status === "failed"
          ? `Failed to ${action.toLowerCase()}`
          : status === "declined"
            ? `Declined to ${action.toLowerCase()}`
            : status === "stopped"
              ? `Stopped ${running.toLowerCase()}`
              : running;

  const actionKind =
    definition.summaryAction === "link-pr" ||
    definition.summaryAction === "unlink-pr" ||
    definition.summaryAction === "list-prs" ||
    definition.summaryAction === "watch-pr" ||
    definition.summaryAction === "unwatch-pr"
      ? definition.summaryAction
      : undefined;
  const payload = asRecord(data);
  const input =
    asRecord(payload?.arguments) ?? asRecord(payload?.input) ?? asRecord(payload?.rawInput);
  const urlTarget =
    typeof input?.url === "string" ? sourceControlClients.parseChangeRequestUrl(input.url) : null;
  const number = urlTarget?.link.number ?? input?.number;
  const { shortLabel } = (urlTarget?.definition ?? sourceControlClients.get(undefined))
    .changeRequest;
  const target =
    actionKind !== undefined &&
    actionKind !== "list-prs" &&
    typeof number === "number" &&
    Number.isSafeInteger(number) &&
    number > 0
      ? `${shortLabel} #${number}`
      : detail;
  return {
    displayName: `${verb} ${target}`,
    icon: definition.icon,
    ...(actionKind === undefined ? {} : { action: actionKind }),
  };
}

export function liveActivityToolStatus(status: string | undefined, presentTense: boolean) {
  if (status === "failed" || status === "declined" || status === "stopped" || status === "idle") {
    return status;
  }
  if (presentTense || status === "inProgress") return "inProgress";
  return "completed";
}

export function resolveWorkEntryToolPresentation(
  entry: Pick<
    WorkLogPresentationEntry,
    "label" | "toolTitle" | "toolData" | "toolLifecycleStatus" | "structuredPayload"
  >,
  fallbackStatus?: "inProgress" | "completed",
) {
  const status = entry.toolLifecycleStatus ?? fallbackStatus;
  // Fork: Flow Brain MCP calls present as brain consultations before T3's own tools.
  const brainTool =
    flowBrainMcpToolNameFromData(entry.toolData) ??
    flowBrainMcpToolNameFromLabel(entry.toolTitle) ??
    flowBrainMcpToolNameFromLabel(entry.label);
  if (brainTool) {
    return resolveFlowBrainMcpToolPresentation(brainTool, status);
  }
  const definition = resolveT3McpToolDefinition(
    workEntryToolName(entry),
    workEntryToolInput(entry),
  );
  return resolveT3McpToolPresentation(
    definition,
    definition && t3ToolResultIndicatesFailure(workEntryToolOutput(entry)) ? "failed" : status,
    entry.toolData,
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function parseJsonValue(value: string): unknown {
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function unwrapMcpResult(value: unknown): unknown {
  let current = value;
  for (let depth = 0; depth < 4; depth += 1) {
    if (typeof current === "string") {
      const parsed = parseJsonValue(current);
      if (parsed === current) return current;
      current = parsed;
      continue;
    }
    if (Array.isArray(current)) {
      // A document catalog can also contain `text` fields; only unwrap actual
      // MCP text blocks, not arbitrary arrays of saved documents.
      if (!current.every((entry) => asRecord(entry)?.type === "text")) return current;
      const text = current
        .map((entry) => nonEmptyString(asRecord(entry)?.text))
        .filter((entry): entry is string => entry !== null);
      if (text.length !== current.length || text.length === 0) return current;
      current = text.join("\n");
      continue;
    }
    const record = asRecord(current);
    if (!record) return current;
    if (record.structuredContent !== undefined && record.structuredContent !== null) {
      current = record.structuredContent;
      continue;
    }
    const keys = Object.keys(record);
    const looksLikeMcpResult = keys.every((key) =>
      ["content", "isError", "_meta", "structuredContent"].includes(key),
    );
    if (looksLikeMcpResult && record.content !== undefined) {
      current = record.content;
      continue;
    }
    return current;
  }
  return current;
}

/** Extracts the user-relevant request/response from provider-specific Flow MCP payloads. */
export function resolveFlowBrainToolCallDetails(
  entry: Pick<WorkLogPresentationEntry, "label" | "toolTitle" | "toolData" | "detail">,
): FlowBrainToolCallDetails | null {
  const data = asRecord(entry.toolData);
  const item = asRecord(data?.item) ?? data;
  const tool =
    flowBrainMcpToolNameFromData(entry.toolData) ??
    flowBrainMcpToolNameFromLabel(entry.toolTitle) ??
    flowBrainMcpToolNameFromLabel(entry.label);
  if (!tool) return null;

  const request = item?.arguments ?? item?.input ?? data?.input;
  // Turn items carry the tool's answer as `output`; older provider payloads as `result`.
  const result = item?.result ?? data?.result ?? data?.output;
  const error = item?.error ?? data?.error;
  return {
    tool,
    toolLabel: flowBrainToolLabel(tool),
    request,
    response: unwrapMcpResult(result ?? error ?? entry.detail),
  };
}

/** Pretty-prints structured MCP values while leaving prose responses readable. */
export function formatFlowBrainToolCallValue(value: unknown, emptyLabel: string): string {
  if (value === undefined || value === null) return emptyLabel;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return emptyLabel;
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        return JSON.stringify(JSON.parse(trimmed), null, 2);
      } catch {
        return trimmed;
      }
    }
    return trimmed;
  }
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
}

const FLOW_BRAIN_FIELD_LABELS: Readonly<Record<string, string>> = {
  q: "Query",
  qs: "Queries",
  query: "Query",
  queries: "Queries",
  id: "Entity",
  ids: "Entities",
  type: "Entity type",
  graph: "Graph",
  repo: "Repository",
  branch: "Branch",
  path: "File",
  revision: "Revision",
  start_line: "Start line",
  end_line: "End line",
  limit: "Result limit",
  cypher: "Graph query",
  text: "Memory",
  target_ids: "Entities",
  reason: "Reason",
  evidence: "Evidence",
};

function titleCase(value: string): string {
  const words = value.replace(/[-_]+/g, " ").trim();
  return words ? `${words.charAt(0).toUpperCase()}${words.slice(1)}` : value;
}

function displayField(key: string, value: unknown): FlowBrainDisplayField | null {
  if (value === undefined || value === null || value === "") return null;
  const label = FLOW_BRAIN_FIELD_LABELS[key] ?? titleCase(key);
  if (
    Array.isArray(value) &&
    value.every((entry) => ["string", "number", "boolean"].includes(typeof entry))
  ) {
    return { label, value: value.map(String) };
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return {
      label,
      value: String(value),
      ...(key === "cypher" || key === "path" || key === "revision" || key === "evidence"
        ? { code: true }
        : {}),
    };
  }
  return { label, value: formatFlowBrainToolCallValue(value, ""), code: true };
}

function displayFields(value: unknown, excluded = new Set<string>()): FlowBrainDisplayField[] {
  const record = asRecord(value);
  if (!record) return value === undefined ? [] : [{ label: "Value", value: String(value) }];
  return Object.entries(record).flatMap(([key, entry]) => {
    if (excluded.has(key)) return [];
    const field = displayField(key, entry);
    return field ? [field] : [];
  });
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.flatMap((entry) => (nonEmptyString(entry) ? [String(entry)] : []))
    : [];
}

function records(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.flatMap((entry) => {
        const record = asRecord(entry);
        return record ? [record] : [];
      })
    : [];
}

function compactCount(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function memoryLineItem(line: string): FlowBrainDisplayItem {
  const findEntity = line.match(
    /^\[Memory:([^\]]+)\]\s+([\s\S]*?)\s+\(([^)]+)\)\s+\[mem:([^\]]+)\]$/i,
  );
  if (findEntity) {
    return {
      eyebrow: `Memory · ${titleCase(findEntity[1]!)} · ${titleCase(findEntity[3]!)}`,
      title: findEntity[2]!,
      id: `mem:${findEntity[4]}`,
    };
  }
  const searchMemory = line.match(
    /^[-•]\s+([\s\S]*?)\s+\[([^/\]]+)\/([^\]]+)\]\s+\((?:memory|ticket|thread)\s+([^)]+)\)$/i,
  );
  if (searchMemory) {
    return {
      eyebrow: `Memory · ${titleCase(searchMemory[2]!)} · ${titleCase(searchMemory[3]!)}`,
      title: searchMemory[1]!,
      id: searchMemory[4]!,
    };
  }
  return { eyebrow: "Memory", title: line.replace(/^[-•]\s+/, "") };
}

function entityItem(value: unknown): FlowBrainDisplayItem {
  const record = asRecord(value) ?? {};
  const props = asRecord(record.props) ?? record;
  const id = nonEmptyString(record.id) ?? nonEmptyString(props.id) ?? undefined;
  const name = nonEmptyString(record.name) ?? nonEmptyString(props.name);
  const type = nonEmptyString(record.type) ?? nonEmptyString(props.type);
  const note = nonEmptyString(record.note);
  const anchor = nonEmptyString(record.anchor) ?? nonEmptyString(props.anchor);
  const evidence = nonEmptyString(props.evidence);
  const via = nonEmptyString(record.via);
  return {
    title: name ?? id ?? "Unnamed entity",
    ...(type ? { eyebrow: titleCase(type) } : {}),
    ...(name && id ? { id } : {}),
    ...((nonEmptyString(record.description) ?? nonEmptyString(props.description) ?? note)
      ? {
          description:
            nonEmptyString(record.description) ?? nonEmptyString(props.description) ?? note!,
        }
      : {}),
    ...(anchor || evidence
      ? {
          fields: [
            ...(anchor ? [{ label: "Code", value: anchor, code: true as const }] : []),
            ...(evidence ? [{ label: "Evidence", value: evidence, code: true as const }] : []),
          ],
        }
      : {}),
    ...(via ? { tags: [via === "vector" ? "Semantic match" : "Exact text match"] } : {}),
    ...(note ? { tone: "muted" as const } : {}),
  };
}

function findEntityDisplay(
  response: Record<string, unknown>,
  request: Record<string, unknown> | null,
): Pick<FlowBrainConsultationDisplay, "responseSummary" | "responseSections"> {
  const groups = response.status === "batch" ? records(response.groups) : [response];
  let entityCount = 0;
  let memoryCount = 0;
  const sections = groups.map((group, index): FlowBrainDisplaySection => {
    const matches = Array.isArray(group.matches) ? group.matches : [];
    const memoryHits = strings(group.memory_hits);
    entityCount += matches.length;
    memoryCount += memoryHits.length;
    const requestQueries = strings(request?.qs);
    const query =
      nonEmptyString(group.query) ??
      nonEmptyString(request?.q) ??
      requestQueries[index] ??
      "Entity lookup";
    const status = nonEmptyString(group.status);
    const error = nonEmptyString(group.error);
    const warning = nonEmptyString(group.warning);
    return {
      title: query,
      ...(status ? { subtitle: titleCase(status) } : {}),
      items: [...matches.map(entityItem), ...memoryHits.map(memoryLineItem)],
      ...(error || warning ? { text: error ?? warning!, tone: error ? "danger" : "warning" } : {}),
    };
  });
  const counts = [
    compactCount(entityCount, "entity", "entities"),
    ...(memoryCount > 0 ? [compactCount(memoryCount, "memory", "memories")] : []),
    ...(groups.length > 1 ? [compactCount(groups.length, "query", "queries")] : []),
  ];
  return { responseSummary: counts.join(" · "), responseSections: sections };
}

function parseKnowledgeSearch(text: string): FlowBrainDisplaySection[] {
  const sections: Array<{ title: string; items: FlowBrainDisplayItem[]; lines: string[] }> = [];
  let current = { title: "Matches", items: [] as FlowBrainDisplayItem[], lines: [] as string[] };
  let category = "Memory";
  const flush = () => {
    if (current.items.length > 0 || current.lines.length > 0) sections.push(current);
  };
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    const queryHeading = line.match(/^===\s+q\d+:\s*([\s\S]*?)\s*===$/i);
    if (queryHeading) {
      flush();
      current = { title: queryHeading[1]!, items: [], lines: [] };
      category = "Memory";
      continue;
    }
    if (/^[A-Z][A-Z /_-]+:$/.test(line)) {
      category = titleCase(line.slice(0, -1).toLowerCase());
      continue;
    }
    if (/^[-•]\s+/.test(line)) {
      const item = memoryLineItem(line);
      current.items.push({
        ...item,
        ...(item.eyebrow ? { eyebrow: item.eyebrow.replace(/^Memory/, category) } : {}),
      });
    } else if (line) {
      current.lines.push(line);
    }
  }
  flush();
  return sections.map((section) => ({
    title: section.title,
    ...(section.items.length > 0 ? { items: section.items } : {}),
    ...(section.lines.length > 0 ? { text: section.lines.join("\n") } : {}),
  }));
}

function getEntityResultItem(value: unknown): FlowBrainDisplayItem {
  const result = asRecord(value) ?? {};
  if (result.status === "not_found") {
    return {
      eyebrow: "Not found",
      title: nonEmptyString(result.id) ?? "Unknown entity",
      tone: "warning",
    };
  }
  if (result.status === "error") {
    const error = nonEmptyString(result.error);
    return {
      eyebrow: "Error",
      title: nonEmptyString(result.id) ?? "Entity lookup failed",
      ...(error ? { description: error } : {}),
      tone: "danger",
    };
  }
  const document = asRecord(result.document);
  if (document) {
    const kind = nonEmptyString(document.kind) ?? "memory";
    const text = nonEmptyString(document.text);
    return {
      ...entityItem(document),
      eyebrow: kind === "skill" ? "SKILL.md" : titleCase(kind),
      ...(text
        ? {
            description:
              kind === "skill" ? text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "") : text,
          }
        : {}),
      tags: typeof document.revision === "number" ? [`Revision ${document.revision}`] : [],
    };
  }
  const card = asRecord(result.card);
  if (card) {
    const kind = nonEmptyString(card.kind) ?? nonEmptyString(result.card_type) ?? "context";
    const title =
      nonEmptyString(card.claim) ??
      nonEmptyString(card.title) ??
      nonEmptyString(card.text) ??
      nonEmptyString(card.root_text) ??
      nonEmptyString(card.identifier) ??
      nonEmptyString(result.id) ??
      "Brain context";
    const description = nonEmptyString(card.description);
    const strength = asRecord(card.strength);
    const tags = [
      nonEmptyString(card.memory_kind),
      nonEmptyString(strength?.tier),
      ...strings(card.anchors),
      ...strings(card.anchored_nodes),
    ].filter((entry): entry is string => entry !== null);
    return {
      eyebrow: titleCase(kind),
      title,
      ...(nonEmptyString(result.id) ? { id: nonEmptyString(result.id)! } : {}),
      ...(description ? { description } : {}),
      ...(tags.length > 0 ? { tags } : {}),
      fields: displayFields(
        card,
        new Set([
          "kind",
          "claim",
          "title",
          "text",
          "root_text",
          "identifier",
          "description",
          "strength",
          "memory_kind",
          "anchors",
          "anchored_nodes",
          "evidence",
          "messages",
        ]),
      ).slice(0, 6),
    };
  }
  const node = asRecord(result.node);
  if (node) {
    const item = entityItem(node);
    const outgoing = records(result.outgoing);
    const incoming = records(result.incoming);
    const connections = [...outgoing, ...incoming].slice(0, 10).map((relation) => {
      const rel = nonEmptyString(relation.rel) ?? "RELATED";
      const target = nonEmptyString(relation.name) ?? nonEmptyString(relation.id) ?? "entity";
      return `${titleCase(rel)} · ${target}`;
    });
    return {
      ...item,
      tags: [
        ...(item.tags ?? []),
        ...connections,
        ...(outgoing.length + incoming.length > connections.length
          ? [`+${outgoing.length + incoming.length - connections.length} connections`]
          : []),
      ],
    };
  }
  return entityItem(result);
}

function getEntityDisplay(
  response: Record<string, unknown>,
): Pick<FlowBrainConsultationDisplay, "responseSummary" | "responseSections"> {
  const results = response.status === "batch" ? records(response.results) : [response];
  const found =
    typeof response.found === "number"
      ? response.found
      : results.filter((result) => result.status !== "not_found" && result.status !== "error")
          .length;
  const missing = results.length - found;
  return {
    responseSummary: [
      compactCount(found, "result"),
      ...(missing > 0 ? [`${missing} missing`] : []),
    ].join(" · "),
    responseSections: [{ title: "Retrieved context", items: results.map(getEntityResultItem) }],
  };
}

function genericObjectDisplay(
  response: Record<string, unknown>,
): Pick<FlowBrainConsultationDisplay, "responseSummary" | "responseSections"> {
  const status = nonEmptyString(response.status);
  const error = nonEmptyString(response.error);
  const fields = displayFields(response, new Set(["status", "error"]));
  return {
    responseSummary: error
      ? "The consultation failed"
      : status
        ? titleCase(status)
        : "Response received",
    responseSections: [
      {
        title: error ? "Error" : "Response",
        ...(error ? { text: error, tone: "danger" as const } : {}),
        ...(fields.length > 0 ? { fields } : {}),
      },
    ],
  };
}

function responseDisplay(
  tool: string,
  request: unknown,
  responseValue: unknown,
  waiting: boolean,
): Pick<FlowBrainConsultationDisplay, "responseSummary" | "responseSections"> {
  if (responseValue === undefined || responseValue === null) {
    return {
      responseSummary: waiting ? "Waiting for the brain…" : "No response body",
      responseSections: [],
    };
  }
  const response = asRecord(responseValue);
  const requestRecord = asRecord(request);
  if (tool === "list_skills" && Array.isArray(responseValue)) {
    const skills = records(responseValue);
    return {
      responseSummary: compactCount(skills.length, "skill"),
      responseSections: [
        {
          title: "Reusable skills",
          items: skills.map((skill) => ({
            ...entityItem(skill),
            eyebrow: "SKILL.md",
            tags: typeof skill.revision === "number" ? [`Revision ${skill.revision}`] : [],
          })),
        },
      ],
    };
  }
  if (
    (tool === "read_skill" || tool === "read_document" || tool === "get_entity") &&
    response &&
    typeof response.text === "string" &&
    typeof response.kind === "string"
  ) {
    const skill = response.kind === "skill";
    return {
      responseSummary: `${nonEmptyString(response.name) ?? (skill ? "Skill" : "Memory")} · revision ${String(response.revision ?? "?")}`,
      responseSections: [
        {
          title: skill ? "SKILL.md" : response.kind === "notes" ? "Conversation notes" : "Memory",
          ...(nonEmptyString(response.description)
            ? { subtitle: String(response.description) }
            : {}),
          text: skill
            ? response.text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "")
            : response.text,
        },
      ],
    };
  }
  if (tool === "find_entity" && response) return findEntityDisplay(response, requestRecord);
  if (tool === "get_entity" && response) return getEntityDisplay(response);
  if (tool === "search_knowledge" && response) {
    const text = nonEmptyString(response.results) ?? nonEmptyString(response.lines);
    if (text) {
      const sections = parseKnowledgeSearch(text);
      const resultCount = sections.reduce(
        (count, section) => count + (section.items?.length ?? 0),
        0,
      );
      return {
        responseSummary:
          resultCount > 0 ? compactCount(resultCount, "memory", "memories") : "Search complete",
        responseSections: sections,
      };
    }
  }
  if (tool === "list_schema" && response) {
    const nodeTypes = strings(response.nodeTypes);
    const edgeTypes = strings(response.edgeTypes);
    return {
      responseSummary: `${compactCount(nodeTypes.length, "node type")} · ${compactCount(edgeTypes.length, "relationship")}`,
      responseSections: [
        { title: "Node types", tags: nodeTypes },
        { title: "Relationships", tags: edgeTypes.map(titleCase) },
      ],
    };
  }
  if (tool === "read_query" && response && Array.isArray(response.rows)) {
    const rows = records(response.rows);
    return {
      responseSummary: compactCount(rows.length, "row"),
      responseSections: [
        {
          title: "Query results",
          items: rows.map((row, index) => ({
            title: `Row ${index + 1}`,
            fields: displayFields(row),
          })),
        },
      ],
    };
  }
  if (tool === "source_search" && response && Array.isArray(response.matches)) {
    const matches = records(response.matches);
    return {
      responseSummary: compactCount(matches.length, "source match"),
      responseSections: [
        {
          title: "Source matches",
          items: matches.map((match) => {
            const description = nonEmptyString(match.text);
            return {
              eyebrow: nonEmptyString(response.repo) ?? "Repository",
              title: `${nonEmptyString(match.path) ?? "Unknown file"}:${String(match.line ?? "?")}`,
              ...(description ? { description } : {}),
            };
          }),
        },
      ],
    };
  }
  if (tool === "source_read" && response && nonEmptyString(response.content)) {
    const subtitle = nonEmptyString(response.repo);
    return {
      responseSummary: `${nonEmptyString(response.path) ?? "Source file"} · lines ${String(response.start_line ?? "?")}–${String(response.end_line ?? "?")}`,
      responseSections: [
        {
          title: nonEmptyString(response.path) ?? "Source",
          ...(subtitle ? { subtitle } : {}),
          text: nonEmptyString(response.content)!,
          code: true,
        },
      ],
    };
  }
  if (tool === "orient" && typeof responseValue === "string") {
    const blocks = responseValue
      .split(/\n\s*\n/)
      .map((block) => block.trim())
      .filter(Boolean);
    return {
      responseSummary: "Project context loaded",
      responseSections: blocks.map((block, index) => {
        const [first, ...rest] = block.split("\n");
        const heading = first?.match(/^([A-Z][A-Z ]+):\s*(.*)$/);
        return heading
          ? {
              title: titleCase(heading[1]!.toLowerCase()),
              text: [heading[2], ...rest].filter(Boolean).join("\n"),
            }
          : { title: index === 0 ? "Project" : "Context", text: block };
      }),
    };
  }
  if (response) return genericObjectDisplay(response);
  return {
    responseSummary: "Response received",
    responseSections: [{ title: "Response", text: String(responseValue) }],
  };
}

/** Projects known Flow graph schemas into a compact UI model shared by all clients. */
export function resolveFlowBrainConsultationDisplay(
  entry: Pick<
    WorkLogPresentationEntry,
    "label" | "toolTitle" | "toolData" | "detail" | "toolLifecycleStatus"
  >,
): FlowBrainConsultationDisplay | null {
  const details = resolveFlowBrainToolCallDetails(entry);
  if (!details) return null;
  const documentTool = details.tool === "read_skill" || details.tool === "read_document";
  const requestFields = displayFields(details.request).map((field) =>
    documentTool && field.label === "Entity"
      ? { ...field, label: details.tool === "read_skill" ? "Skill" : "Document" }
      : field,
  );
  const response = responseDisplay(
    details.tool,
    details.request,
    details.response,
    entry.toolLifecycleStatus === "inProgress",
  );
  return { ...details, requestFields, ...response };
}

function workLogEntryIsToolLike(entry: WorkLogPresentationEntry): boolean {
  if (entry.tone === "tool" || entry.tone === "thinking" || entry.tone === "error") return true;
  if (entry.command !== undefined && entry.command.trim().length > 0) return true;
  if (entry.requestKind !== undefined) return true;
  return entry.itemType !== undefined && isToolLifecycleItemType(entry.itemType);
}

function workEntryIndicatesToolFailureFromOutput(
  entry: WorkLogPresentationEntry,
  includeCommand: boolean,
): boolean {
  if (
    entry.tone === "error" ||
    entry.toolLifecycleStatus === "failed" ||
    entry.toolLifecycleStatus === "declined"
  ) {
    return true;
  }
  // Reasoning detail is the model's own prose (often tens of KB), not tool
  // output: scanning it is slow on long threads and misreads phrases like
  // "that exit code 2 is expected" as a failed tool.
  if (!workLogEntryIsToolLike(entry) || entry.itemType === "reasoning") return false;
  if (
    resolveT3McpToolDefinition(workEntryToolName(entry)) &&
    t3ToolResultIndicatesFailure(workEntryToolOutput(entry))
  ) {
    return true;
  }
  const item = entry.structuredPayload;
  if (item?.type === "command_execution") {
    if (item.outputIndicatesFailure || (item.exitCode !== undefined && item.exitCode !== 0)) {
      return true;
    }
    if (item.output && toolOutputIndicatesFailure(item.output.slice(0, 32_768))) {
      return true;
    }
  }
  const output = includeCommand
    ? [entry.detail, entry.command].filter(Boolean).join("\n")
    : (entry.detail ?? "");
  return output.length > 0 && toolOutputIndicatesFailure(output);
}

export function workEntryIndicatesToolFailure(entry: WorkLogPresentationEntry): boolean {
  return workEntryIndicatesToolFailureFromOutput(entry, true);
}

export function workEntryDisplayIndicatesToolFailure(entry: WorkLogPresentationEntry): boolean {
  return workEntryIndicatesToolFailureFromOutput(entry, false);
}

function workLogEntryIsLocalCodeSearch(entry: WorkLogPresentationEntry): boolean {
  return (
    entry.itemType === "file_search" ||
    (entry.itemType === "web_search" &&
      /\bgrep\b/i.test(normalizeCompactToolLabel(entry.toolTitle ?? entry.label)))
  );
}

export function toolGroupAction(entry: WorkLogPresentationEntry): ToolGroupAction {
  if (entry.itemType === "thread_created") return "thread-create";
  const presentation = resolveWorkEntryToolPresentation(entry);
  if (presentation?.action !== undefined) return presentation.action;
  if (presentation?.icon === "brain") return "brain";
  if (presentation?.icon === "browser") return "browser";
  if (presentation?.icon === "device") return "device";
  if (entry.requestKind === "file-read" || entry.viewedImagePath !== undefined) return "read";
  if (entry.itemType === "approval_request" || entry.itemType === "user_input_request") {
    return workLogEntryIsToolLike(entry) ? "other" : "update";
  }
  const data = asRecord(entry.toolData) ?? {};
  const toolName =
    entry.structuredPayload?.type === "dynamic_tool"
      ? entry.structuredPayload.toolName
      : typeof data.toolName === "string"
        ? data.toolName
        : entry.toolTitle;
  const classified = classifyToolActivity({
    itemType:
      entry.itemType === "command_execution" ||
      entry.itemType === "file_change" ||
      entry.itemType === "web_search"
        ? entry.itemType
        : entry.itemType === "dynamic_tool"
          ? "dynamic_tool_call"
          : undefined,
    title: entry.toolTitle ?? entry.label,
    data: {
      ...data,
      ...(toolName ? { toolName } : {}),
    },
  });
  if (classified === "read") return "read";
  if (classified === "file_change" || entry.itemType === "file_change") return "edit";
  if (classified === "command" || entry.itemType === "command_execution" || entry.command) {
    return "command";
  }
  if (classified === "search") {
    return entry.itemType === "web_search" && !workLogEntryIsLocalCodeSearch(entry)
      ? "search"
      : "code-search";
  }
  if (workLogEntryIsLocalCodeSearch(entry)) return "code-search";
  if (entry.itemType === "web_search") return "search";
  if ((entry.changedFiles?.length ?? 0) > 0) return "edit";
  return workLogEntryIsToolLike(entry) ? "other" : "update";
}

export function workEntryViewedImagePath(entry: WorkLogPresentationEntry): string | null {
  const viewedImagePath = entry.viewedImagePath?.trim();
  if (
    viewedImagePath !== undefined &&
    !/[\r\n]/.test(viewedImagePath) &&
    isWorkspaceImagePreviewPath(viewedImagePath)
  ) {
    return viewedImagePath;
  }
  const detail = entry.detail?.trim();
  return toolGroupAction(entry) === "read" &&
    detail !== undefined &&
    !/[\r\n]/.test(detail) &&
    isWorkspaceImagePreviewPath(detail)
    ? detail
    : null;
}

export interface ViewedImageAsset {
  readonly resource: Extract<AssetResource, { readonly _tag: "media-file" }>;
  readonly alt: string;
  readonly srcFragment: string;
}

export function resolveViewedImageAsset(
  source: string,
  input: {
    readonly threadId: ThreadId;
    readonly workspaceRoot?: string | null | undefined;
  },
): ViewedImageAsset | null {
  const imageSource = classifyMarkdownImageSource(source, input.workspaceRoot ?? ".");
  if (imageSource._tag !== "WorkspaceFile") return null;
  const resolvedFilePath =
    input.workspaceRoot == null && imageSource.path.startsWith("./")
      ? imageSource.path.slice(2)
      : imageSource.path;

  const media = resolveMediaSource(source, {
    threadId: input.threadId,
    workspaceRoot: input.workspaceRoot,
    resolvedFilePath,
  });
  if (media === null || media.access !== "environment") return null;
  return { resource: media.resource, alt: media.name, srcFragment: media.srcFragment };
}

function toolGroupActionCount(
  action: ToolGroupAction,
  entries: ReadonlyArray<WorkLogPresentationEntry>,
): number {
  if (action !== "edit") return entries.length;
  const changedFiles = new Set<string>();
  let editsWithoutFileDetails = 0;
  for (const entry of entries) {
    if (!entry.changedFiles || entry.changedFiles.length === 0) {
      editsWithoutFileDetails += 1;
    } else {
      for (const file of entry.changedFiles) changedFiles.add(file);
    }
  }
  return changedFiles.size + editsWithoutFileDetails;
}

function toolGroupActionLabel(action: ToolGroupAction, count: number): string {
  switch (action) {
    case "link-pr":
      return `Linked ${count} ${count === 1 ? "pull request" : "pull requests"}`;
    case "unlink-pr":
      return `Unlinked ${count} ${count === 1 ? "pull request" : "pull requests"}`;
    case "watch-pr":
      return `Watching ${count} ${count === 1 ? "pull request" : "pull requests"}`;
    case "unwatch-pr":
      return `Stopped watching ${count} ${count === 1 ? "pull request" : "pull requests"}`;
    case "list-prs":
      return count === 1
        ? "Checked linked pull requests"
        : `Checked linked pull requests ${count} times`;
    case "read":
      return `Read ${count} ${count === 1 ? "file" : "files"}`;
    case "edit":
      return `Changed ${count} ${count === 1 ? "file" : "files"}`;
    case "command":
      return `Ran ${count} ${count === 1 ? "command" : "commands"}`;
    case "brain":
      return count === 1 ? "Consulted the brain" : `Consulted the brain ${count} times`;
    case "thread-create":
      return `Created ${count} ${count === 1 ? "thread" : "threads"}`;
    case "device":
      return `Used device controls ${count} ${count === 1 ? "time" : "times"}`;
    case "browser":
      return `Used browser ${count} ${count === 1 ? "time" : "times"}`;
    case "search":
      return `Searched the web ${count} ${count === 1 ? "time" : "times"}`;
    case "code-search":
      return `Searched code ${count} ${count === 1 ? "time" : "times"}`;
    case "other":
      return `Used ${count} ${count === 1 ? "tool" : "tools"}`;
    case "update":
      return `Received ${count} ${count === 1 ? "update" : "updates"}`;
  }
}

function t3ToolSummaryCall(entry: WorkLogPresentationEntry): T3ToolSummaryCall {
  return {
    input: workEntryToolInput(entry),
    output: workEntryToolOutput(entry),
    outcome:
      entry.toolLifecycleStatus === "failed" ||
      entry.toolLifecycleStatus === "declined" ||
      entry.tone === "error"
        ? "failed"
        : entry.toolLifecycleStatus === "completed"
          ? "completed"
          : "unfinished",
  };
}

function summaryActionPriority(action: ToolGroupAction | T3McpToolSummaryAction): number {
  switch (action) {
    case "command":
    case "edit":
    case "delegate":
    case "task-cancel":
    case "thread-create":
    case "thread-send":
    case "thread-interrupt":
    case "workflow-stop":
    case "background-wait":
    case "schedule-create":
    case "schedule-update":
    case "schedule-delete":
    case "schedule-run":
    case "thread-configure":
    case "thread-fork":
    case "thread-merge":
    case "thread-organize":
    case "thread-update":
    case "queue-edit":
    case "queue-cancel":
    case "queue-reorder":
    case "queue-steer":
    case "question-respond":
    case "worktree-handoff":
    case "project-create":
    case "project-update":
    case "project-delete":
    case "project-clone":
    case "environment-update":
    case "attachment-prepare":
    case "attachment-discard":
    case "attachment-send":
      return 0;
    case "other":
    case "update":
      return 2;
    default:
      return 1;
  }
}

export function summarizeToolGroup(entries: ReadonlyArray<WorkLogPresentationEntry>): {
  summary: string;
  hasFailure: boolean;
} {
  const toolEntries = entries.filter((entry) => entry.itemType !== "reasoning");
  if (entries.length > 0 && toolEntries.length === 0) {
    return {
      summary: entries.length === 1 ? "Thought" : `Thought (×${entries.length})`,
      hasFailure: false,
    };
  }
  entries = toolEntries;
  const groups = new Map<
    ToolGroupAction | T3McpToolSummaryAction,
    {
      action: ToolGroupAction;
      t3Action: T3McpToolSummaryAction | null;
      entries: WorkLogPresentationEntry[];
    }
  >();
  const sources = new Map<string, ToolActivitySource>();
  for (const entry of entries) {
    const t3Action = resolveT3McpSummaryAction(
      workEntryToolName(entry),
      t3ToolSummaryCall(entry).input,
    );
    const action = toolGroupAction(entry);
    // Fork: brain consultations keep their own summary instead of the integration's name.
    if (entry.toolSource && t3Action === null && action !== "brain") {
      sources.set(entry.toolSource.key, entry.toolSource);
      continue;
    }
    const key = t3Action ?? action;
    const group = groups.get(key);
    if (group) group.entries.push(entry);
    else groups.set(key, { action, t3Action, entries: [entry] });
  }
  const summaries = [...groups].map(([action, group], index) => ({
    index,
    count: group.entries.length,
    priority: summaryActionPriority(action),
    ...(group.t3Action
      ? summarizeT3ToolCalls(group.t3Action, group.entries.map(t3ToolSummaryCall))
      : {
          label: toolGroupActionLabel(
            group.action,
            toolGroupActionCount(group.action, group.entries),
          ),
          failedCount: group.entries.filter(workEntryDisplayIndicatesToolFailure).length,
        }),
  }));
  const selected = [...summaries]
    .sort((a, b) => a.priority - b.priority || a.index - b.index)
    .slice(0, 2)
    .sort((a, b) => a.index - b.index);
  const labels = selected.map(({ label }) => label);
  if (sources.size > 0) {
    const sourceValues = [...sources.values()];
    const sourceNames = [...new Set(sourceValues.map((source) => source.name))];
    const formattedNames =
      sourceNames.length < 2
        ? sourceNames[0]!
        : sourceNames.length === 2
          ? sourceNames.join(" and ")
          : `${sourceNames.slice(0, -1).join(", ")}, and ${sourceNames.at(-1)}`;
    const allIntegrations = sourceValues.every((source) => source.kind === "integration");
    labels.unshift(
      `Used ${formattedNames}${allIntegrations ? ` ${sourceNames.length === 1 ? "integration" : "integrations"}` : ""}`,
    );
  }
  const sourcedCount = entries.filter(
    (entry) =>
      entry.toolSource !== undefined &&
      resolveT3McpToolDefinition(workEntryToolName(entry)) === null &&
      toolGroupAction(entry) !== "brain",
  ).length;
  const remainingCount =
    entries.length - sourcedCount - selected.reduce((count, group) => count + group.count, 0);
  if (remainingCount > 0) {
    labels.push(`Performed ${remainingCount} other ${remainingCount === 1 ? "action" : "actions"}`);
  }
  const sentenceLabels = labels.map((label, index) =>
    index === 0 ? label : label.charAt(0).toLowerCase() + label.slice(1),
  );
  const summary =
    sentenceLabels.length < 3
      ? sentenceLabels.join(" and ")
      : `${sentenceLabels.slice(0, -1).join(", ")}, and ${sentenceLabels.at(-1)}`;
  return { summary, hasFailure: summaries.some((group) => group.failedCount > 0) };
}

export function toolGroupSummaryKind(
  entries: ReadonlyArray<WorkLogPresentationEntry>,
): ToolGroupSummaryKind {
  const toolEntries = entries.filter((entry) => entry.itemType !== "reasoning");
  if (entries.length > 0 && toolEntries.length === 0) return "reasoning";
  entries = toolEntries;
  if (
    entries.length > 0 &&
    entries.every((entry) => resolveWorkEntryToolPresentation(entry)?.icon === "pull-request")
  )
    return "pull-request";
  const actions = new Set(entries.map(toolGroupAction));
  if (actions.size !== 1) return "mixed";
  const action = actions.values().next().value!;
  if (action !== "other") return action;
  const fallbackKinds = new Set(
    entries.map((entry): ToolGroupSummaryKind => {
      if (entry.itemType === "dynamic_tool") return "dynamic-tool";
      if (entry.itemType === "subagent") return "agent-tool";
      if (entry.tone === "thinking") return "agent-tool";
      if (entry.tone === "tool") return "tone-tool";
      return "other";
    }),
  );
  return fallbackKinds.size === 1 ? fallbackKinds.values().next().value! : "mixed";
}

export function liveThoughtLine(markdown: string): string {
  const heading = /^\s*\*\*([^*\r\n]+)\*\*[ \t]*\r?(?:\n|$)/.exec(markdown)?.[1];
  const text = (heading ?? markdown)
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^[ \t]*(?:#{1,6}|[-*+]|\d+\.)[ \t]+/gm, "")
    .replace(/`+|\*\*|~~/g, "")
    .replace(/(^|[^\w*])[*_]([^*_\n]+)[*_](?![\w*])/g, "$1$2")
    .replace(/\s+/g, " ")
    .trim();
  if (heading !== undefined) return text;
  const end = /[.?!]["'”’)]?(?=\s)/.exec(text);
  return end ? text.slice(0, end.index + end[0].length) : text;
}
