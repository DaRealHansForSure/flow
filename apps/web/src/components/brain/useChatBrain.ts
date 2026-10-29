// Fork-only: keeps one chat's Brain context (graph, notes, Auto-Docs, extraction status)
// fresh while the chat is open, whether or not its Brain tab is showing. The chat view owns
// it, hands it to the Brain tab, and publishes the chat's Brain status for the header button.

import type {
  BrainResponse,
  BrainWorkspace,
  EnvironmentId,
  ProjectId,
  ScopedThreadRef,
  ThreadId,
} from "@t3tools/contracts";
import { scopedThreadKey } from "@t3tools/client-runtime/environment";
import { retainChatContextOnError } from "@t3tools/client-runtime/state/brain";
import { useEffect, useState } from "react";

import { useRightPanelStore } from "../../rightPanelStore";
import { brainCommand } from "../../state/brain";
import { useAtomCommand } from "../../state/use-atom-command";
import { toastManager } from "../ui/toast";
import { useChatBrainStatusStore } from "./chatBrainStatusStore";

const UNANSWERED_FAILURE = "The Brain did not answer. It retries on its own.";

const LONG_POLL_DELAY_MS = 100;
const RETRY_DELAY_MS = 5000;
const CHANGE_HIGHLIGHT_MS = 8000;

export interface ChatBrain {
  readonly response: BrainResponse | null;
  /** The chat's Brain; undefined until loaded or when the chat has none. */
  readonly brain: BrainWorkspace | undefined;
  readonly error: boolean;
  /** Notes and documents that changed in the last few seconds, for a short highlight. */
  readonly changedIds: readonly string[];
  readonly savedNow: boolean;
}

/**
 * Polls the Brain context of the open chat. A draft (threadId null) has no chat on the
 * server yet, so it reads its project's Brain instead.
 */
export function useChatBrain(input: {
  readonly threadRef: ScopedThreadRef | null;
  readonly environmentId: EnvironmentId | null;
  readonly threadId: ThreadId | null;
  readonly projectId: ProjectId | null;
  /** False where the right panel is a sheet that would cover the chat. */
  readonly revealPanelByDefault: boolean;
}): ChatBrain {
  const { threadRef, environmentId, threadId, projectId, revealPanelByDefault } = input;
  const execute = useAtomCommand(brainCommand, { reportFailure: false });
  const sourceKey = `${environmentId}:${projectId}:${threadId ?? "draft"}`;
  const [loadedKey, setLoadedKey] = useState(sourceKey);
  const [response, setResponse] = useState<BrainResponse | null>(null);
  const [error, setError] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [changedIds, setChangedIds] = useState<readonly string[]>([]);
  const [savedNow, setSavedNow] = useState(false);
  if (loadedKey !== sourceKey) {
    setLoadedKey(sourceKey);
    setResponse(null);
    setError(false);
    setFailure(null);
    setChangedIds([]);
    setSavedNow(false);
  }

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- long-polls the Brain server for this chat's context
  useEffect(() => {
    if (environmentId === null || projectId === null) {
      return;
    }
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    let pending = false;
    let revision: string | undefined;
    let previousNotes: Map<string, string> | undefined;
    let highlightTimer: ReturnType<typeof setTimeout>;
    let delay = LONG_POLL_DELAY_MS;
    const refresh = async () => {
      if (disposed || pending || document.visibilityState === "hidden") {
        return;
      }
      pending = true;
      try {
        const result = await execute({
          environmentId,
          input: threadId
            ? { action: "readChat", threadId, ...(revision ? { revision } : {}) }
            : { action: "read", projectId, metadataOnly: true },
        });
        if (disposed) {
          return;
        }
        if (result._tag === "Failure") {
          setError(true);
          setFailure(UNANSWERED_FAILURE);
          delay = RETRY_DELAY_MS;
          revision = undefined;
          return;
        }
        if (result.value.error) {
          revision = undefined;
          delay = RETRY_DELAY_MS;
          setError(true);
          setFailure(result.value.error);
          setResponse((previous) => retainChatContextOnError(previous, result.value));
          return;
        }
        revision = result.value.chatMemories?.revision;
        delay = revision ? LONG_POLL_DELAY_MS : RETRY_DELAY_MS;
        const currentNotes = noteFingerprints(result.value);
        if (previousNotes && notesChanged(previousNotes, currentNotes)) {
          setChangedIds(changedNoteIds(previousNotes, currentNotes));
          setSavedNow(true);
          clearTimeout(highlightTimer);
          highlightTimer = setTimeout(() => {
            setChangedIds([]);
            setSavedNow(false);
          }, CHANGE_HIGHLIGHT_MS);
        }
        previousNotes = currentNotes;
        setError(false);
        setFailure(null);
        setResponse((previous) =>
          JSON.stringify(previous) === JSON.stringify(result.value) ? previous : result.value,
        );
      } catch {
        revision = undefined;
        delay = RETRY_DELAY_MS;
        if (!disposed) {
          setError(true);
          setFailure(UNANSWERED_FAILURE);
        }
      } finally {
        pending = false;
        if (!disposed) {
          clearTimeout(timer);
          timer = setTimeout(() => void refresh(), delay);
        }
      }
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    };
    void refresh();
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      disposed = true;
      clearTimeout(timer);
      clearTimeout(highlightTimer);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [environmentId, threadId, projectId, execute]);

  const brain = chatBrainWorkspace(response, threadId, projectId);
  const hasBrain = brain !== undefined;
  const updating = response?.chatMemories?.status === "extracting";
  const loading =
    response === null && failure === null && environmentId !== null && projectId !== null;
  const threadKey = threadRef ? scopedThreadKey(threadRef) : null;

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- publishes the chat's Brain status to the header button and command palette
  useEffect(() => {
    if (threadKey === null) {
      return;
    }
    const { setStatus } = useChatBrainStatusStore.getState();
    setStatus(
      threadKey,
      hasBrain || failure !== null || loading ? { updating, failure, loading } : null,
    );
    return () => setStatus(threadKey, null);
  }, [threadKey, hasBrain, updating, failure, loading]);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- announces a new Brain failure once, as soon as the poll sees it
  useEffect(() => {
    if (environmentId === null) {
      return;
    }
    const { claimFailureAnnouncement } = useChatBrainStatusStore.getState();
    if (claimFailureAnnouncement(environmentId, failure)) {
      toastManager.add({ type: "error", title: "Brain unavailable", description: failure });
    }
  }, [environmentId, failure]);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- opens the Brain tab once the server confirms this chat has a Brain
  useEffect(() => {
    if (threadRef === null || !hasBrain) {
      return;
    }
    useRightPanelStore.getState().openBrainByDefault(threadRef, revealPanelByDefault);
  }, [threadRef, hasBrain, revealPanelByDefault]);

  return { response, brain, error, changedIds, savedNow };
}

function chatBrainWorkspace(
  response: BrainResponse | null,
  threadId: ThreadId | null,
  projectId: ProjectId | null,
): BrainWorkspace | undefined {
  if (response === null) {
    return undefined;
  }
  // readChat already narrows the workspaces to the chat's own Brain.
  if (threadId !== null) {
    return response.state.workspaces[0];
  }
  if (projectId === null) {
    return undefined;
  }
  return response.state.workspaces.find((workspace) => workspace.projectIds?.includes(projectId));
}

/** One entry per note, memory and document, whose value changes when its content does. */
function noteFingerprints(response: BrainResponse): Map<string, string> {
  const memories = response.chatMemories;
  const fingerprints = new Map<string, string>();
  for (const note of memories?.memories ?? []) {
    fingerprints.set(note.id, note.text);
  }
  if (memories?.notes) {
    fingerprints.set(memories.notes.id, memories.notes.text);
  }
  for (const document of memories?.documents ?? []) {
    fingerprints.set(document.id, String(document.revision));
  }
  return fingerprints;
}

function notesChanged(previous: Map<string, string>, current: Map<string, string>): boolean {
  return previous.size !== current.size || changedNoteIds(previous, current).length > 0;
}

/** Ids that are new or changed; a removed note counts as a save with nothing to highlight. */
function changedNoteIds(previous: Map<string, string>, current: Map<string, string>): string[] {
  return [...current].filter(([id, text]) => previous.get(id) !== text).map(([id]) => id);
}
