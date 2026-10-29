import type { BrainCommand, BrainResponse } from "@t3tools/contracts";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as SubscriptionRef from "effect/SubscriptionRef";
import * as Option from "effect/Option";
import { EnvironmentSupervisor } from "../connection/supervisor.ts";
import { ManagedRelayDpopSigner } from "../relay/managedRelay.ts";
import { RemoteEnvironmentAuthorization } from "../authorization/service.ts";
import { executeAuthenticatedEnvironmentHttpRequest } from "./environmentHttpAuth.ts";

/** @public Required to name the error in consumers' inferred brain request results. */
export class BrainConnectionUnavailableError extends Data.TaggedError(
  "BrainConnectionUnavailableError",
)<{ readonly message: string }> {}

/** Apply a readChat reply within one thread's controller. */
export function retainChatContextOnError(
  previous: BrainResponse | null,
  next: BrainResponse,
): BrainResponse {
  if (
    !next.error ||
    next.chatMemories ||
    !previous?.chatMemories ||
    previous.state.workspaces.length !== 1 ||
    next.state.workspaces.length !== 1 ||
    previous.state.workspaces[0]?.id !== next.state.workspaces[0]?.id
  )
    return next;
  return { ...next, chatMemories: previous.chatMemories };
}

export const requestBrain = Effect.fn("clientRuntime.brain.request")(function* (
  command: BrainCommand,
) {
  const supervisor = yield* EnvironmentSupervisor;
  const prepared = yield* SubscriptionRef.get(supervisor.prepared);
  if (Option.isNone(prepared)) {
    return yield* new BrainConnectionUnavailableError({
      message: "Connect to a computer before opening its brain.",
    });
  }
  const signer = yield* Effect.serviceOption(ManagedRelayDpopSigner);
  const remoteAuthorization = yield* Effect.serviceOption(RemoteEnvironmentAuthorization);
  return yield* executeAuthenticatedEnvironmentHttpRequest({
    prepared: prepared.value,
    signer,
    remoteAuthorization,
    group: "brain",
    method: "POST",
    timeoutMs: 60_000,
    url: (urls) => urls.request(),
    request: ({ client, headers }) => client.request({ payload: { command }, headers }),
  });
});
