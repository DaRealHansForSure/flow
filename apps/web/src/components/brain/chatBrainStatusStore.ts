// Fork-only: which open chats have a Brain, whether it is writing their notes right now,
// whose notes changed unseen, and why it failed to answer. The chat view fills it from its Brain context, so the header
// button and the command palette can follow the chat without polling the Brain themselves.

import { create } from "zustand";

interface ChatBrainStatus {
  /** True while the Brain updates this chat's notes, Auto-Docs and skills. */
  readonly updating: boolean;
  /** Why the Brain did not answer for this chat; null while it answers. */
  readonly failure: string | null;
  /** True until the Brain's first answer for this chat arrived. */
  readonly loading: boolean;
}

interface ChatBrainStatusStoreState {
  /** Chats with a Brain, a Brain still loading, or a Brain that failed to answer. */
  readonly byThreadKey: Readonly<Record<string, ChatBrainStatus>>;
  readonly setStatus: (threadKey: string, status: ChatBrainStatus | null) => void;
  /** The failure last announced per environment, so one outage raises one toast. */
  readonly announcedFailureByEnvironment: Readonly<Record<string, string>>;
  /** True when this failure is new for the environment and should be announced. */
  readonly claimFailureAnnouncement: (environmentId: string, failure: string | null) => boolean;
  /** Chats whose notes changed since their Brain tab was last shown. */
  readonly unseenNotesByThreadKey: Readonly<Record<string, true>>;
  readonly markNotesChanged: (threadKey: string) => void;
  readonly markNotesSeen: (threadKey: string) => void;
}

export const useChatBrainStatusStore = create<ChatBrainStatusStoreState>()((set) => ({
  byThreadKey: {},
  setStatus: (threadKey, status) =>
    set((state) => {
      const current = state.byThreadKey[threadKey];
      if (status === null) {
        if (current === undefined) {
          return state;
        }
        const { [threadKey]: _removed, ...rest } = state.byThreadKey;
        return { byThreadKey: rest };
      }
      if (
        current?.updating === status.updating &&
        current.failure === status.failure &&
        current.loading === status.loading
      ) {
        return state;
      }
      return { byThreadKey: { ...state.byThreadKey, [threadKey]: status } };
    }),
  unseenNotesByThreadKey: {},
  markNotesChanged: (threadKey) =>
    set((state) =>
      state.unseenNotesByThreadKey[threadKey]
        ? state
        : { unseenNotesByThreadKey: { ...state.unseenNotesByThreadKey, [threadKey]: true } },
    ),
  markNotesSeen: (threadKey) =>
    set((state) => {
      if (!state.unseenNotesByThreadKey[threadKey]) {
        return state;
      }
      const { [threadKey]: _seen, ...rest } = state.unseenNotesByThreadKey;
      return { unseenNotesByThreadKey: rest };
    }),
  announcedFailureByEnvironment: {},
  claimFailureAnnouncement: (environmentId, failure) => {
    const announced = useChatBrainStatusStore.getState().announcedFailureByEnvironment;
    if (failure === null) {
      if (environmentId in announced) {
        const { [environmentId]: _cleared, ...rest } = announced;
        set({ announcedFailureByEnvironment: rest });
      }
      return false;
    }
    if (announced[environmentId] === failure) {
      return false;
    }
    set({ announcedFailureByEnvironment: { ...announced, [environmentId]: failure } });
    return true;
  },
}));
