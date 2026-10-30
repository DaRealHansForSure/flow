import * as Schema from "effect/Schema";

import { IsoDateTime, ThreadId } from "./baseSchemas.ts";
import { ProviderInstanceId } from "./providerInstance.ts";

export const ProviderMcpServerStatus = Schema.Literals([
  "connected",
  "pending",
  "needs-auth",
  "failed",
  "disabled",
]);
export type ProviderMcpServerStatus = typeof ProviderMcpServerStatus.Type;

/** `flow` is T3's own bridge, `flow-brain` the machine-level Brain entry. */
export const ProviderMcpServerOrigin = Schema.Literals(["flow", "flow-brain", "provider"]);
export type ProviderMcpServerOrigin = typeof ProviderMcpServerOrigin.Type;

export const ProviderMcpTool = Schema.Struct({
  name: Schema.String,
  description: Schema.optional(Schema.String),
  readOnly: Schema.optional(Schema.Boolean),
});
export type ProviderMcpTool = typeof ProviderMcpTool.Type;

/** Never carries a server's command, args, env, headers or URL: they can hold credentials. */
export const ProviderMcpServer = Schema.Struct({
  name: Schema.String,
  status: ProviderMcpServerStatus,
  origin: ProviderMcpServerOrigin,
  /** The provider's own label for where the server is configured, such as `user` or `plugin`. */
  scope: Schema.optional(Schema.String),
  error: Schema.optional(Schema.String),
  version: Schema.optional(Schema.String),
  tools: Schema.optional(Schema.Array(ProviderMcpTool)),
});
export type ProviderMcpServer = typeof ProviderMcpServer.Type;

/** A thread for the chat tab, or a provider instance for Settings. */
export const ProviderMcpListInput = Schema.Union([
  Schema.Struct({ threadId: ThreadId }),
  Schema.Struct({ instanceId: ProviderInstanceId }),
]);
export type ProviderMcpListInput = typeof ProviderMcpListInput.Type;

export const ProviderMcpListing = Schema.Union([
  Schema.TaggedStruct("servers", {
    instanceId: ProviderInstanceId,
    threadId: ThreadId,
    threadTitle: Schema.String,
    /** The config folder the session runs with, such as Claude's `CLAUDE_CONFIG_DIR`. */
    profile: Schema.optional(Schema.String),
    checkedAt: IsoDateTime,
    servers: Schema.Array(ProviderMcpServer),
  }),
  Schema.TaggedStruct("no-session", {
    instanceId: Schema.optional(ProviderInstanceId),
  }),
  Schema.TaggedStruct("unsupported", {
    instanceId: ProviderInstanceId,
  }),
]);
export type ProviderMcpListing = typeof ProviderMcpListing.Type;

export const ProviderMcpListErrorReason = Schema.Literals(["thread-not-found", "request-failed"]);
export type ProviderMcpListErrorReason = typeof ProviderMcpListErrorReason.Type;

export class ProviderMcpListError extends Schema.TaggedError<ProviderMcpListError>()(
  "ProviderMcpListError",
  {
    reason: ProviderMcpListErrorReason,
    cause: Schema.optional(Schema.Defect()),
  },
) {
  override get message(): string {
    switch (this.reason) {
      case "thread-not-found":
        return "The chat could not be found.";
      case "request-failed":
        return "The agent did not answer the MCP status request.";
    }
  }
}
