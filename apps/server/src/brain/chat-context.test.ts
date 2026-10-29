// @effect-diagnostics nodeBuiltinImport:off - Read the external agents' routing table from its source file.
import * as NodeFS from "node:fs";
import { GRAPH_PREAMBLE } from "../../../../flow-t3/shared/orchestrator/src/agents/graph-preamble.ts";
import { expect, it } from "@effect/vitest";
import {
  ProjectId,
  ProviderDriverKind,
  ProviderThreadId,
  ProviderTurnId,
  ThreadId,
  type OrchestrationProjectShell,
  type OrchestrationV2ConversationMessage,
  type OrchestrationV2TurnItem,
} from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import { ServerSettingsService } from "../serverSettings.ts";
import { BrainService } from "./BrainService.ts";
import type { BrainRuntime } from "./BrainRuntime.ts";
import type { BrainCapture } from "./session-worker.ts";
import { makeRunCapture } from "./chatTurns.ts";
import * as ProjectionStore from "../orchestration-v2/ProjectionStore.ts";
import * as ProjectStore from "../orchestration-v2/ProjectStore.ts";
import { makeBrainChatContextLoader, makeBrainChatCapture } from "./chat-context.ts";

const driver = ProviderDriverKind.make("codex");
const chat = ThreadId.make("chat");
const providerThreadId = ProviderThreadId.make("provider-thread");

it("captures a streamed reply once, as the text each update added", () => {
  const capture = makeRunCapture(chat, providerThreadId);
  const message = (text: string) => ({
    type: "message.updated" as const,
    driver,
    message: {
      id: "reply",
      threadId: chat,
      role: "assistant",
      text,
    } as OrchestrationV2ConversationMessage,
  });
  const texts = [
    message("The focused"),
    message("The focused"),
    message("The focused check passed."),
  ]
    .flatMap((event) => capture(event, 1000))
    .map((entry) => (entry.data as { content: { text: string } }).content.text);
  expect(texts).toEqual(["The focused", " check passed."]);
  const subagent = {
    ...message("Child output"),
    message: {
      id: "child",
      threadId: ThreadId.make("child"),
      role: "assistant",
      text: "Child output",
    },
  } as ReturnType<typeof message>;
  expect(capture(subagent, 1000)).toEqual([]);
});

it("captures a tool call when it starts and once more when it finishes", () => {
  const capture = makeRunCapture(chat, providerThreadId);
  const command = (status: OrchestrationV2TurnItem["status"]) => ({
    type: "turn_item.updated" as const,
    driver,
    turnItem: {
      id: "command",
      threadId: chat,
      type: "command_execution",
      status,
      title: "Run tests",
      input: "vp test run",
      output: status === "completed" ? "1 passed" : undefined,
      exitCode: status === "completed" ? 0 : undefined,
    } as OrchestrationV2TurnItem,
  });
  const captured = [
    command("running"),
    command("running"),
    command("completed"),
    command("completed"),
  ]
    .flatMap((event) => capture(event, 1000))
    .map((entry) => entry.data as { sessionUpdate: string; rawInput: { item: unknown } });
  expect(captured.map((entry) => entry.sessionUpdate)).toEqual(["tool_call", "tool_call_update"]);
  expect(captured[1]?.rawInput.item).toMatchObject({
    type: "commandExecution",
    command: "vp test run",
    aggregatedOutput: "1 passed",
    exitCode: 0,
  });
});

it("closes the capture when the run's own provider turn ends", () => {
  const capture = makeRunCapture(chat, providerThreadId);
  const terminal = (thread: string) => ({
    type: "turn.terminal" as const,
    driver,
    providerThreadId: ProviderThreadId.make(thread),
    providerTurnId: ProviderTurnId.make("turn"),
    runOrdinal: 1,
    status: "interrupted" as const,
    failure: null,
    threadDisposition: "reusable" as const,
  });
  expect(capture(terminal("child-provider-thread"), 1000)).toEqual([]);
  const [closed] = capture(terminal("provider-thread"), 1000);
  expect(closed?.closed).toBe(true);
  expect(closed?.data).toMatchObject({ sessionUpdate: "turn_completed", state: "interrupted" });
});

it.effect(
  "uses real orient output, preserves it uncapped, and respects changing/disconnected bindings",
  () =>
    Effect.gen(function* () {
      const threadId = ThreadId.make("worktree-chat");
      const projectId = ProjectId.make("project");
      let binding: string | undefined;
      let reads = 0;
      let race = false;
      let fail = false;
      let captures = 0;
      let lastCapture: BrainCapture | undefined;
      let chatNotesAgent: boolean | undefined;
      const orientText = "Original curated orientation\n" + "x".repeat(30000);
      const runtime = {
        projectBindings: { register: () => {}, threadNotesAgent: () => chatNotesAgent },
        projectBrainId: () => binding,
        threadBrainId: () => binding,
        callProjectTool: async (
          project: ProjectId,
          name: string,
          _args: unknown,
          context: unknown,
        ) => {
          expect(project).toBe(projectId);
          expect(name).toBe("orient");
          expect(context).toMatchObject({
            session: threadId,
            workspaceRoot: "/project",
            branch: "feature",
          });
          reads++;
          if (race) binding = "other";
          return { isError: fail, content: [{ type: "text", text: orientText }] };
        },
        captureProjectEvent: async (_project: ProjectId, input: BrainCapture) => {
          captures++;
          lastCapture = input;
        },
      } as unknown as BrainRuntime;
      const threads = {
        getThreadShell: () => Effect.succeed({ projectId, branch: "feature" }),
      } as unknown as ProjectionStore.ProjectionStoreV2["Service"];
      const projects = {
        getShell: () =>
          Effect.succeedSome({ workspaceRoot: "/project" } as OrchestrationProjectShell),
      } as unknown as ProjectStore.ProjectStoreV2["Service"];
      const [load, capture] = yield* Effect.all([
        makeBrainChatContextLoader(),
        makeBrainChatCapture(),
      ]).pipe(
        Effect.provideService(BrainService, { ready: Effect.succeed(runtime) }),
        Effect.provideService(ProjectionStore.ProjectionStoreV2, threads),
        Effect.provideService(ProjectStore.ProjectStoreV2, projects),
        Effect.provide(
          ServerSettingsService.layerTest({
            brainNotesAgent: false,
            brainAutoDocs: false,
            projectSettingsOverrides: {
              [projectId]: { brainAutoDocs: true, brainAutoSkills: false },
            },
          }),
        ),
      );
      expect(yield* load(threadId)).toEqual({ bindingKey: "" });
      yield* capture(threadId, {
        receipt: "unconnected",
        kind: "user_prompt",
        data: { text: "hello" },
      });
      expect(reads).toBe(0);
      expect(captures).toBe(0);
      binding = "team";
      const initialContext = (yield* load(threadId, "")).context;
      expect(initialContext).toContain(orientText);
      expect(initialContext).toContain(GRAPH_PREAMBLE);
      // Hosted agents and external coding agents must read the same routing table.
      const routing = /FLOW_ROUTING = `([^`]+)`/.exec(
        NodeFS.readFileSync(
          new URL("../../../../flow-t3/shared/bin/harness/routing.mjs", import.meta.url),
          "utf8",
        ),
      )?.[1];
      expect(routing).toBeDefined();
      expect(GRAPH_PREAMBLE).toContain(routing);
      expect(yield* load(threadId, "team")).toEqual({ bindingKey: "team" });
      expect(reads).toBe(1);
      yield* capture(
        threadId,
        { receipt: "event-1", kind: "user_prompt", data: { text: "user" } },
        "team",
      );
      expect(captures).toBe(1);
      expect(lastCapture?.outputs).toEqual({ docs: true, skills: false, notesAgent: false });
      // The chat's own choice beats the global switch, which it otherwise follows.
      chatNotesAgent = true;
      yield* capture(
        threadId,
        { receipt: "event-1b", kind: "update", data: { sessionUpdate: "turn_complete" } },
        "team",
      );
      expect(lastCapture?.outputs).toEqual({ docs: true, skills: false, notesAgent: true });
      chatNotesAgent = undefined;
      binding = undefined;
      expect((yield* load(threadId, "team")).context).toContain("disconnected");
      yield* capture(threadId, { receipt: "event-2", kind: "user_prompt", data: {} }, "team");
      expect(captures).toBe(2);
      binding = "team";
      fail = true;
      expect(yield* load(threadId).pipe(Effect.flip)).toContain("orient failed");
      fail = false;
      race = true;
      expect(yield* load(threadId).pipe(Effect.flip)).toContain("brain changed");
    }),
);
