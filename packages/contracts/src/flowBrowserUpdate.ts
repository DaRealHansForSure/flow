import * as Schema from "effect/Schema";

export const FLOW_BROWSER_UPDATE_PATH = "/api/flow/browser-update";
export const FlowBrowserUpdateState = Schema.Struct({
  supported: Schema.Boolean,
  currentVersion: Schema.NullOr(Schema.String),
  readyVersion: Schema.NullOr(Schema.String),
  restarting: Schema.Boolean,
});
export type FlowBrowserUpdateState = typeof FlowBrowserUpdateState.Type;

/** Lets one browser read and apply a staged Flow update on every connected environment. */
export const FlowBrowserUpdateInput = Schema.Struct({});
export type FlowBrowserUpdateInput = typeof FlowBrowserUpdateInput.Type;

export class FlowBrowserUpdateRpcError extends Schema.TaggedError<FlowBrowserUpdateRpcError>()(
  "FlowBrowserUpdateRpcError",
  { reason: Schema.String },
) {
  override get message(): string {
    return this.reason;
  }
}
