// Fork-only: connects a chat turn to the project's Brain. The run executor asks
// for a turn before it starts the provider; the turn carries the Brain briefing
// in the message when one is due and records the conversation as it streams.

import type * as ProviderAdapter from "@t3tools/provider-core/server/ProviderAdapter";
import type { OrchestrationV2TurnItem, ProviderThreadId, ThreadId } from "@t3tools/contracts";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Random from "effect/Random";

import {
  formatBrainUserPrompt,
  makeBrainChatCapture,
  makeBrainChatContextLoader,
  type BrainCaptureInput,
} from "./chat-context.ts";

export interface BrainTurnStart {
  readonly threadId: ThreadId;
  readonly providerThreadId: ProviderThreadId;
  readonly message: ProviderAdapter.ProviderAdapterV2TurnMessage;
  /** Restart continuations repeat an earlier request; they are neither briefed nor captured. */
  readonly continuation: boolean;
}

export interface BrainTurn {
  /** The message text for the provider, with the Brain briefing in front when one is due. */
  readonly text: string;
  readonly observe: (event: ProviderAdapter.ProviderAdapterV2Event) => Effect.Effect<void>;
  /** Call once the provider accepted the turn; a rejected send briefs again next time. */
  readonly accepted: Effect.Effect<void>;
}

export class BrainChatTurns extends Context.Reference<{
  readonly begin: (input: BrainTurnStart) => Effect.Effect<BrainTurn, string>;
}>("t3/brain/BrainChatTurns", {
  defaultValue: () => ({
    begin: (input) =>
      Effect.succeed({
        text: input.message.text,
        observe: () => Effect.void,
        accepted: Effect.void,
      }),
  }),
}) {}

const TOOL_ITEM_TYPES = new Set<OrchestrationV2TurnItem["type"]>([
  "command_execution",
  "file_change",
  "file_search",
  "web_search",
  "dynamic_tool",
]);
const FINISHED_ITEM_STATUSES = new Set(["completed", "failed", "cancelled", "interrupted"]);

/** The shapes the Brain's transcript reader understands (curation/transcript.ts). */
function toolEvidence(item: OrchestrationV2TurnItem): Record<string, unknown> {
  switch (item.type) {
    case "command_execution": {
      return {
        type: "commandExecution",
        command: item.input,
        aggregatedOutput: item.output,
        exitCode: item.exitCode,
      };
    }
    case "file_change": {
      return { type: "fileChange", changes: [{ path: item.fileName, diff: item.diffStr ?? "" }] };
    }
    case "dynamic_tool": {
      return { toolName: item.toolName, input: item.input, output: item.output };
    }
    default: {
      return item;
    }
  }
}

/** Turns one run's provider events into Brain captures; streamed messages become text deltas. */
export function makeRunCapture(threadId: ThreadId, providerThreadId: ProviderThreadId) {
  const capturedLengths = new Map<string, number>();
  const capturedStatuses = new Map<string, string>();
  return (
    event: ProviderAdapter.ProviderAdapterV2Event,
    occurredAt: number,
  ): ReadonlyArray<BrainCaptureInput> => {
    if (event.type === "message.updated") {
      const message = event.message;
      if (message.threadId !== threadId || message.role !== "assistant") {
        return [];
      }
      const offset = capturedLengths.get(message.id) ?? 0;
      if (message.text.length <= offset) {
        return [];
      }
      capturedLengths.set(message.id, message.text.length);
      return [
        {
          receipt: `${message.id}:${offset}`,
          occurredAt,
          kind: "update",
          data: {
            sessionUpdate: "agent_message_chunk",
            content: { type: "text", text: message.text.slice(offset) },
          },
        },
      ];
    }
    if (event.type === "turn_item.updated") {
      const item = event.turnItem;
      if (item.threadId !== threadId || !TOOL_ITEM_TYPES.has(item.type)) {
        return [];
      }
      const finished = FINISHED_ITEM_STATUSES.has(item.status);
      const phase = finished ? "tool_call_update" : "tool_call";
      const previous = capturedStatuses.get(item.id);
      if (previous === phase || previous === "tool_call_update") {
        return [];
      }
      capturedStatuses.set(item.id, phase);
      return [
        {
          receipt: `${item.id}:${phase}`,
          occurredAt,
          kind: "update",
          data: {
            sessionUpdate: phase,
            toolCallId: item.id,
            title: item.title,
            status: item.status,
            rawInput: { item: toolEvidence(item) },
          },
        },
      ];
    }
    if (event.type === "turn.terminal" && event.providerThreadId === providerThreadId) {
      return [
        {
          receipt: `terminal:${event.providerTurnId}`,
          occurredAt,
          kind: "update",
          data: {
            sessionUpdate: "turn_completed",
            state: event.status,
            ...(event.failure === null ? {} : { errorMessage: event.failure }),
          },
          closed: true,
        },
      ];
    }
    return [];
  };
}

interface DeliveredBriefing {
  readonly bindingKey: string;
  readonly providerThreadId: ProviderThreadId;
}

export const layer = Layer.effect(
  BrainChatTurns,
  Effect.gen(function* () {
    const loadContext = yield* makeBrainChatContextLoader();
    const capture = yield* makeBrainChatCapture();
    // Only a new native thread, a compaction or a changed binding receives a briefing.
    const delivered = new Map<ThreadId, DeliveredBriefing>();
    const captureBindings = new Map<ThreadId, string>();

    const record = (threadId: ThreadId, input: BrainCaptureInput) =>
      capture(threadId, input, captureBindings.get(threadId)).pipe(
        Effect.catch((error) => Effect.logWarning(error)),
      );

    const begin = Effect.fn("BrainChatTurns.begin")(function* (input: BrainTurnStart) {
      const { threadId, providerThreadId, message } = input;
      const briefable = !input.continuation && !message.text.trimStart().startsWith("/");
      const previous = delivered.get(threadId);
      const previousBinding =
        previous?.providerThreadId === providerThreadId ? previous.bindingKey : undefined;
      const brain = briefable ? yield* loadContext(threadId, previousBinding) : undefined;
      if (brain) {
        captureBindings.set(threadId, brain.bindingKey);
      }
      const prompt = input.continuation ? undefined : formatBrainUserPrompt(message);
      if (prompt) {
        const receipt = [
          yield* Random.nextInt,
          yield* Random.nextInt,
          yield* Random.nextInt,
          yield* Random.nextInt,
        ].join("-");
        yield* record(threadId, {
          receipt: `prompt:${receipt}`,
          kind: "user_prompt",
          data: { text: prompt },
        });
      }
      const runCapture = makeRunCapture(threadId, providerThreadId);
      return {
        text: brain?.context ? `${brain.context}\n\n${message.text}` : message.text,
        observe: Effect.fn("BrainChatTurns.observe")(function* (
          event: ProviderAdapter.ProviderAdapterV2Event,
        ) {
          if (
            event.type === "turn_item.updated" &&
            event.turnItem.type === "compaction" &&
            event.turnItem.threadId === threadId
          ) {
            delivered.delete(threadId);
          }
          if (!captureBindings.has(threadId)) {
            return;
          }
          const now = yield* Clock.currentTimeMillis;
          for (const entry of runCapture(event, now)) {
            yield* record(threadId, entry);
          }
        }),
        accepted: Effect.sync(() => {
          if (brain) {
            delivered.set(threadId, { bindingKey: brain.bindingKey, providerThreadId });
          }
        }),
      } satisfies BrainTurn;
    });

    return { begin };
  }),
);
