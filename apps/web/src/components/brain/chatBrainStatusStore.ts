// Fork-only: which open chats have a Brain, and whether it is writing their notes right
// now. The chat view fills it from its Brain context, so the header button and the command
// palette can follow the chat without polling the Brain themselves.

import { create } from "zustand";

interface ChatBrainStatus {
  /** True while the Brain updates this chat's notes, Auto-Docs and skills. */
  readonly updating: boolean;
}

interface ChatBrainStatusStoreState {
  /** Only chats with a Brain have an entry. */
  readonly byThreadKey: Readonly<Record<string, ChatBrainStatus>>;
  readonly setStatus: (threadKey: string, status: ChatBrainStatus | null) => void;
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
      if (current?.updating === status.updating) {
        return state;
      }
      return { byThreadKey: { ...state.byThreadKey, [threadKey]: status } };
    }),
}));
