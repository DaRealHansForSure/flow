import { describe, expect, it } from "vite-plus/test";

import { ThreadId, TurnItemId, type OrchestrationV2TurnItem } from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";

import {
  formatFlowBrainToolCallValue,
  resolveFlowBrainConsultationDisplay,
  resolveFlowBrainToolCallDetails,
  resolveWorkEntryToolPresentation,
  summarizeToolGroup,
  toolGroupAction,
  toolGroupSummaryKind,
  toolItemForDisplay,
  type WorkLogPresentationEntry,
  workEntryIndicatesToolFailure,
  workEntryDisplayIndicatesToolFailure,
} from "./presentation.js";

function commandItem(
  fields: Partial<Extract<OrchestrationV2TurnItem, { type: "command_execution" }>> = {},
): OrchestrationV2TurnItem {
  return {
    id: TurnItemId.make("command"),
    threadId: ThreadId.make("thread"),
    runId: null,
    nodeId: null,
    providerThreadId: null,
    providerTurnId: null,
    nativeItemRef: null,
    parentItemId: null,
    ordinal: 1,
    status: "completed",
    title: null,
    startedAt: null,
    completedAt: null,
    updatedAt: DateTime.makeUnsafe("2026-09-08T00:00:00.000Z"),
    type: "command_execution",
    input: 'rg "command not found"',
    ...fields,
  };
}

describe("workEntryIndicatesToolFailure", () => {
  const base = {
    id: "w1",
    createdAt: "2026-01-01T00:00:00.000Z",
    label: "Read",
  };

  it.each([
    [{ exitCode: 2 }, true],
    [{ output: "sh: missing-command: command not found" }, true],
    [{ output: `${"x".repeat(32_768)} command not found` }, false],
  ] as const)(
    "preserves command failure state after removing displayed output: %j",
    (fields, failed) => {
      const structuredPayload = commandItem(fields);
      const entry: WorkLogPresentationEntry = {
        ...base,
        tone: "tool",
        itemType: "command_execution",
        toolLifecycleStatus: "completed",
        structuredPayload,
      };
      expect(workEntryDisplayIndicatesToolFailure(entry)).toBe(failed);
      expect(JSON.stringify(toolItemForDisplay(structuredPayload))).not.toContain('"output":');
    },
  );

  it.each([
    "logs/app.log:12: Error: ENOENT: no such file or directory",
    "fixtures/ci.txt:3: Process exited with exit code 2",
  ])("trusts a zero exit code over failure text in the output and command: %s", (output) => {
    const entry: WorkLogPresentationEntry = {
      ...base,
      tone: "tool",
      itemType: "command_execution",
      toolLifecycleStatus: "completed",
      command: 'rg -n "ENOENT|exit code" logs fixtures',
      structuredPayload: commandItem({ output, exitCode: 0, outputIndicatesFailure: true }),
    };
    expect(workEntryIndicatesToolFailure(entry)).toBe(false);
    expect(workEntryDisplayIndicatesToolFailure(entry)).toBe(false);
  });

  it("ignores failure phrases in reasoning text", () => {
    const entry: WorkLogPresentationEntry = {
      ...base,
      label: "Thinking",
      tone: "thinking",
      itemType: "reasoning",
      toolLifecycleStatus: "completed",
      detail: "That exit code 2 is just from listing the deleted directory, which is expected.",
    };
    expect(workEntryIndicatesToolFailure(entry)).toBe(false);
    expect(workEntryDisplayIndicatesToolFailure(entry)).toBe(false);
  });

  it("does not treat error text in a command as rendered failure", () => {
    const entry = {
      ...base,
      label: "Ran command",
      tone: "tool",
      toolLifecycleStatus: "completed",
      command: 'rg "file not found"',
      detail: "Found 3 matches",
    } satisfies WorkLogPresentationEntry;

    expect(workEntryDisplayIndicatesToolFailure(entry)).toBe(false);

    expect(workEntryIndicatesToolFailure(entry)).toBe(true);
    expect(workEntryDisplayIndicatesToolFailure({ ...entry, detail: "File not found" })).toBe(true);
  });
});

describe("resolveWorkEntryToolPresentation", () => {
  it("shows returned MCP errors as failures even in the live activity row", () => {
    const entry: WorkLogPresentationEntry = {
      id: "clone",
      createdAt: "2026-09-19T00:00:00.000Z",
      tone: "tool",
      label: "T3-code.t3_project_clone",
      toolLifecycleStatus: "inProgress",
      itemType: "dynamic_tool",
      toolData: { output: { isError: true } },
    };
    expect(resolveWorkEntryToolPresentation(entry)?.displayName).toBe(
      "Failed to clone a repository",
    );
    expect(workEntryDisplayIndicatesToolFailure(entry)).toBe(true);
    const childFailure = {
      ...entry,
      label: "T3-code.task_status",
      toolLifecycleStatus: "completed" as const,
      toolData: { output: { taskId: "child", status: "failed", summary: "command not found" } },
    };
    expect(workEntryDisplayIndicatesToolFailure(childFailure)).toBe(false);
  });
  it.each([
    "mcp__t3-code__preview_click",
    "mcp__t3_code__preview_click",
    "mcp__t3code__preview_click",
    "T3-code.preview_click",
    "t3-code · preview_click completed",
    "t3_code/preview_click",
    "preview_click",
  ])("recognizes browser tool names across providers: %s", (label) => {
    expect(resolveWorkEntryToolPresentation({ label })).toEqual({
      displayName: "Clicking in the preview browser",
      icon: "browser",
    });
  });

  it("uses structured MCP identity when the provider supplies a custom title", () => {
    expect(
      resolveWorkEntryToolPresentation({
        label: "Tool call complete",
        toolTitle: "Inspect the current page",
        toolData: { server: "t3-code", tool: "preview_snapshot", result: { title: "Example" } },
      }),
    ).toEqual({ displayName: "Taking a snapshot of the preview page", icon: "browser" });
  });

  it("uses the summary's state only when the provider omitted a lifecycle status", () => {
    const entry = { label: "T3-code.preview_click" };
    expect(resolveWorkEntryToolPresentation(entry, "inProgress")?.displayName).toBe(
      "Clicking in the preview browser",
    );
    expect(resolveWorkEntryToolPresentation(entry, "completed")?.displayName).toBe(
      "Clicked in the preview browser",
    );
    expect(
      resolveWorkEntryToolPresentation({ ...entry, toolLifecycleStatus: "completed" }, "inProgress")
        ?.displayName,
    ).toBe("Clicked in the preview browser");
    expect(
      resolveWorkEntryToolPresentation({ ...entry, toolLifecycleStatus: "failed" }, "completed")
        ?.displayName,
    ).toBe("Failed to click in the preview browser");
  });

  it.each([
    ["https://github.com/acme/web/pull/7", "PR #7"],
    ["https://gitlab.com/acme/web/-/merge_requests/7", "MR #7"],
  ])("names a linked change request with its host's term (%s)", (url, target) => {
    expect(
      resolveWorkEntryToolPresentation({
        label: "T3-code.link_pull_request",
        toolLifecycleStatus: "completed",
        toolData: { arguments: { url } },
      })?.displayName,
    ).toMatch(new RegExp(` ${target}$`));
  });

  it("does not brand unknown tools or another server's matching tool name", () => {
    for (const label of [
      "mcp__github__preview_click",
      "t3-code.unknown_tool",
      "t3-code.toString",
      "Search files",
    ]) {
      expect(resolveWorkEntryToolPresentation({ label })).toBeNull();
    }
    expect(
      resolveWorkEntryToolPresentation({
        label: "preview_click",
        toolData: { server: "another-server", tool: "preview_click" },
      }),
    ).toBeNull();
  });
});

describe("Flow brain MCP presentation", () => {
  const brainEntry = {
    id: "brain-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    label: "MCP tool call",
    tone: "tool",
    itemType: "dynamic_tool",
    toolLifecycleStatus: "completed",
    toolData: {
      type: "mcpToolCall",
      server: "flow-graph",
      tool: "find_entity",
      arguments: { qs: ["tool activity rendering"] },
      result: { content: '{"status":"batch","count":1}' },
    },
  } satisfies WorkLogPresentationEntry;

  it("presents Flow MCP calls as brain consultations", () => {
    expect(resolveWorkEntryToolPresentation(brainEntry)).toEqual({
      displayName: "Consulted the brain · Find entity",
      icon: "brain",
    });
    expect(
      resolveWorkEntryToolPresentation({ ...brainEntry, toolLifecycleStatus: "inProgress" }),
    ).toEqual({
      displayName: "Consulting the brain · Find entity",
      icon: "brain",
    });
    expect(toolGroupAction(brainEntry)).toBe("brain");
    expect(toolGroupSummaryKind([brainEntry])).toBe("brain");
  });

  it("recognizes Flow verbs exposed through the t3-code MCP server", () => {
    expect(
      resolveWorkEntryToolPresentation({
        label: "MCP tool call",
        toolData: { toolName: "mcp__t3_code__orient", input: { repo: "flow" } },
      }),
    ).toEqual({
      displayName: "Consulting the brain · Orient",
      icon: "brain",
    });
    expect(
      resolveWorkEntryToolPresentation({
        label: "MCP tool call",
        toolData: { server: "github", tool: "find_entity" },
      }),
    ).toBeNull();
  });

  it("shows discovered skills and their complete procedure as Brain consultations", () => {
    const skill = {
      id: "skill-1",
      kind: "skill",
      name: "Verify name normalization",
      description: "Run the focused whitespace regression.",
      revision: 2,
      text: "---\nname: verify-name\ndescription: Focused regression\n---\n\nRun `node --test normalize-name.test.mjs`. Expect one passing test.",
    };
    const entry = {
      ...brainEntry,
      toolData: {
        server: "t3-code",
        tool: "read_skill",
        arguments: { id: skill.id },
        result: { content: [{ type: "text", text: JSON.stringify(skill) }] },
      },
    };
    expect(resolveWorkEntryToolPresentation(entry)?.displayName).toBe(
      "Consulted the brain · Read skill",
    );
    const display = resolveFlowBrainConsultationDisplay(entry);
    expect(display?.requestFields).toEqual([{ label: "Skill", value: skill.id }]);
    expect(display?.responseSections[0]?.text).toContain("node --test normalize-name.test.mjs");
    expect(display?.responseSections[0]?.text).not.toContain("description:");
    const listed = resolveFlowBrainConsultationDisplay({
      ...entry,
      toolData: {
        ...entry.toolData,
        tool: "list_skills",
        arguments: {},
        result: { content: [{ type: "text", text: JSON.stringify([skill]) }] },
      },
    });
    const batch = resolveFlowBrainConsultationDisplay({
      ...entry,
      toolData: {
        ...entry.toolData,
        tool: "get_entity",
        arguments: { ids: [skill.id, "missing"] },
        result: {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                status: "batch",
                found: 1,
                results: [
                  { id: skill.id, status: "found", document: skill },
                  { id: "missing", status: "not_found" },
                ],
              }),
            },
          ],
        },
      },
    });
    expect(batch?.responseSections[0]?.items?.[0]).toMatchObject({
      title: skill.name,
      eyebrow: "SKILL.md",
      tags: ["Revision 2"],
    });
    expect(batch?.responseSections[0]?.items?.[0]?.description).toContain(
      "node --test normalize-name.test.mjs",
    );
    expect(batch?.responseSections[0]?.items?.[1]?.tone).toBe("warning");
    expect(listed?.responseSummary).toBe("1 skill");
    expect(listed?.responseSections[0]?.items?.[0]).toMatchObject({
      id: skill.id,
      title: skill.name,
      eyebrow: "SKILL.md",
    });
    expect(
      resolveWorkEntryToolPresentation({
        ...entry,
        toolData: { ...entry.toolData, server: "unrelated" },
      }),
    ).toBeNull();
  });

  it("extracts and formats the request and response without provider metadata", () => {
    const details = resolveFlowBrainToolCallDetails(brainEntry);
    expect(details).toEqual({
      tool: "find_entity",
      toolLabel: "Find entity",
      request: { qs: ["tool activity rendering"] },
      response: { status: "batch", count: 1 },
    });
    expect(formatFlowBrainToolCallValue(details?.request, "No parameters")).toBe(
      '{\n  "qs": [\n    "tool activity rendering"\n  ]\n}',
    );
    expect(formatFlowBrainToolCallValue(details?.response, "No response body")).toBe(
      '{\n  "status": "batch",\n  "count": 1\n}',
    );
  });

  it("falls back to text content when MCP structured content is null", () => {
    const details = resolveFlowBrainToolCallDetails({
      ...brainEntry,
      toolData: {
        type: "mcpToolCall",
        server: "flow-graph",
        tool: "orient",
        arguments: { repo: "flow" },
        result: {
          _meta: null,
          content: [
            {
              type: "text",
              text: 'CONNECTED PROJECT: "Flow"\n[flow orient — repo "flow" @ main-v2]',
            },
          ],
          structuredContent: null,
        },
      },
    });

    expect(details?.response).toBe(
      'CONNECTED PROJECT: "Flow"\n[flow orient — repo "flow" @ main-v2]',
    );
  });

  it("projects batched entity searches into query groups and readable result cards", () => {
    const display = resolveFlowBrainConsultationDisplay({
      ...brainEntry,
      toolData: {
        ...brainEntry.toolData,
        arguments: { qs: ["auth middleware", "personal access tokens"], limit: 5 },
        result: {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                status: "batch",
                count: 2,
                groups: [
                  {
                    query: "auth middleware",
                    status: "similar",
                    matches: [
                      {
                        type: "Handler",
                        id: "handler:auth",
                        name: "Authentication middleware",
                        description: "Checks the session before routing.",
                        anchor: "apps/server/src/auth.ts:12",
                        via: "vector",
                      },
                    ],
                    memory_hits: [
                      "[Memory:decision] Sessions are checked on every request. (strong) [mem:abc]",
                    ],
                  },
                  {
                    query: "personal access tokens",
                    status: "none",
                    matches: [],
                  },
                ],
              }),
            },
          ],
        },
      },
    });

    expect(display).toMatchObject({
      toolLabel: "Find entity",
      requestFields: [
        { label: "Queries", value: ["auth middleware", "personal access tokens"] },
        { label: "Result limit", value: "5" },
      ],
      responseSummary: "1 entity · 1 memory · 2 queries",
      responseSections: [
        {
          title: "auth middleware",
          subtitle: "Similar",
          items: [
            {
              eyebrow: "Handler",
              title: "Authentication middleware",
              id: "handler:auth",
              description: "Checks the session before routing.",
              fields: [{ label: "Code", value: "apps/server/src/auth.ts:12", code: true }],
              tags: ["Semantic match"],
            },
            {
              eyebrow: "Memory · Decision · Strong",
              title: "Sessions are checked on every request.",
              id: "mem:abc",
            },
          ],
        },
        { title: "personal access tokens", subtitle: "None", items: [] },
      ],
    });
  });

  it("turns knowledge-search prose into one card per memory", () => {
    const display = resolveFlowBrainConsultationDisplay({
      ...brainEntry,
      toolData: {
        server: "flow-graph",
        tool: "search_knowledge",
        arguments: { query: "auth sessions" },
        result: {
          content: JSON.stringify({
            status: "ok",
            results:
              "MEMORY:\n- Auth uses signed cookies. [decision/strong] (memory 123)\n- Local mode is open. [gotcha/medium] (memory 456)",
          }),
        },
      },
    });

    expect(display).toMatchObject({
      requestFields: [{ label: "Query", value: "auth sessions" }],
      responseSummary: "2 memories",
      responseSections: [
        {
          title: "Matches",
          items: [
            {
              eyebrow: "Memory · Decision · Strong",
              title: "Auth uses signed cookies.",
              id: "123",
            },
            { eyebrow: "Memory · Gotcha · Medium", title: "Local mode is open.", id: "456" },
          ],
        },
      ],
    });
  });

  it("reads the request and response of a dynamic tool turn item", () => {
    const details = resolveFlowBrainToolCallDetails({
      label: "mcp__flow-graph__find_entity",
      toolTitle: "mcp__flow-graph__find_entity",
      toolData: {
        input: { q: "auth middleware" },
        output: { content: [{ type: "text", text: '{"status":"none","matches":[]}' }] },
      },
    });
    expect(details).toEqual({
      tool: "find_entity",
      toolLabel: "Find entity",
      request: { q: "auth middleware" },
      response: { status: "none", matches: [] },
    });
  });

  it("counts brain consultations separately from commands and generic tools", () => {
    expect(
      summarizeToolGroup([
        brainEntry,
        { ...brainEntry, id: "brain-2" },
        {
          id: "command-1",
          createdAt: "2026-01-01T00:00:00.000Z",
          label: "Ran command",
          tone: "tool",
          itemType: "command_execution",
          command: "git status",
        },
      ]),
    ).toMatchObject({ summary: "Consulted the brain 2 times and ran 1 command" });
  });
});
