// Flow: the service update in progress, shared by the backend pool, which
// parks the attached primary while it runs, and DesktopServiceSync, which runs
// it. A file of its own so neither imports the other.

import type { DesktopFlowServiceUpdate } from "@t3tools/contracts";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";

export class DesktopServiceSyncState extends Context.Service<
  DesktopServiceSyncState,
  { readonly update: Ref.Ref<Option.Option<DesktopFlowServiceUpdate>> }
>()("@t3tools/desktop/backend/DesktopServiceSyncState") {}

export const layer = Layer.effect(
  DesktopServiceSyncState,
  Effect.map(Ref.make(Option.none<DesktopFlowServiceUpdate>()), (update) =>
    DesktopServiceSyncState.of({ update }),
  ),
);

/** Parked while an update runs or has failed; released once it succeeded or was skipped. */
export const isParked = (state: DesktopServiceSyncState["Service"]): Effect.Effect<boolean> =>
  Ref.get(state.update).pipe(Effect.map(Option.exists((update) => update.outcome !== "updated")));
