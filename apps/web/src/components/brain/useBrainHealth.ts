// Fork-only: whether the primary environment's Brain is up, starting or failing, for
// the sidebar's Brain entry. Polls slowly; a chat's own Brain status lives in useChatBrain.

import { useEffect, useState } from "react";

import type { EnvironmentId } from "@t3tools/contracts";

import { brainCommand } from "../../state/brain";
import { usePrimaryEnvironmentId } from "../../state/environments";
import { useAtomCommand } from "../../state/use-atom-command";

export type BrainHealth =
  | { readonly kind: "unknown" }
  | { readonly kind: "loading" }
  | { readonly kind: "ready" }
  | { readonly kind: "failed"; readonly reason: string };

const STARTING_POLL_MS = 15_000;
const READY_POLL_MS = 60_000;
const UNKNOWN: BrainHealth = { kind: "unknown" };

// The phone sidebar mounts on every open; without the last answer it would flash "loading" each time.
const lastHealthByEnvironment = new Map<EnvironmentId, BrainHealth>();

export function useBrainHealth(): BrainHealth {
  const environmentId = usePrimaryEnvironmentId();
  const execute = useAtomCommand(brainCommand, { reportFailure: false });
  const [health, setHealth] = useState<BrainHealth>(
    () =>
      (environmentId === null ? undefined : lastHealthByEnvironment.get(environmentId)) ?? UNKNOWN,
  );

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- polls the Brain server for its health
  useEffect(() => {
    if (environmentId === null) {
      return;
    }
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const check = async () => {
      clearTimeout(timer);
      const result = await execute({
        environmentId,
        input: { action: "read", metadataOnly: true },
      });
      if (disposed) {
        return;
      }
      let next: BrainHealth;
      if (result._tag !== "Success") {
        next = { kind: "failed", reason: "The Brain did not answer. It retries on its own." };
      } else if (result.value.error) {
        next = { kind: "failed", reason: result.value.error };
      } else if (result.value.state.database.status === "error") {
        next = { kind: "failed", reason: result.value.state.database.message };
      } else if (
        result.value.state.database.status === "stopped" &&
        result.value.state.workspaces.length > 0
      ) {
        next = { kind: "loading" };
      } else {
        next = { kind: "ready" };
      }
      lastHealthByEnvironment.set(environmentId, next);
      setHealth((previous) =>
        JSON.stringify(previous) === JSON.stringify(next) ? previous : next,
      );
      timer = setTimeout(
        () => void check(),
        next.kind === "ready" ? READY_POLL_MS : STARTING_POLL_MS,
      );
    };
    const checkWhenVisible = () => {
      if (document.visibilityState === "visible") {
        void check();
      }
    };
    void check();
    document.addEventListener("visibilitychange", checkWhenVisible);
    return () => {
      disposed = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", checkWhenVisible);
    };
  }, [environmentId, execute]);

  return health;
}
