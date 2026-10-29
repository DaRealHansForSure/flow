// Fork-only: picks the Brain for a chat started without a project. The choice
// is saved for the draft's future chat id right away, so it is in place before
// the first message loads its context. DraftHeroHeadline forgets it again if
// the draft moves to a real project, which then brings its own Brain.

import type { EnvironmentId, ThreadId } from "@t3tools/contracts";
import { useEffect, useState } from "react";

import { useAtomCommand } from "../../state/use-atom-command";
import { brainCommand } from "../../state/brain";
import { toastManager } from "../ui/toast";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../ui/select";

const NO_BRAIN_VALUE = "none";

interface BrainOption {
  readonly id: string;
  readonly name: string;
}

export function ScratchBrainPicker(props: {
  readonly environmentId: EnvironmentId;
  readonly threadId: ThreadId;
  readonly selectedBrainId: string | null;
  readonly onSelectedBrainIdChange: (brainId: string | null) => void;
}) {
  const execute = useAtomCommand(brainCommand, { reportFailure: false });
  const [brains, setBrains] = useState<readonly BrainOption[]>([]);
  const { environmentId, threadId, selectedBrainId, onSelectedBrainIdChange } = props;

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Loads the environment's Brain list from the server.
  useEffect(() => {
    let cancelled = false;
    void execute({ environmentId, input: { action: "read", metadataOnly: true } }).then(
      (result) => {
        if (cancelled || result._tag !== "Success" || result.value.error) {
          return;
        }
        setBrains(
          result.value.state.workspaces.map((brain) => ({ id: brain.id, name: brain.name })),
        );
      },
    );
    return () => {
      cancelled = true;
    };
  }, [environmentId, execute]);

  const chooseBrain = (value: string) => {
    const brainId = value === NO_BRAIN_VALUE ? null : value;
    const previous = selectedBrainId;
    onSelectedBrainIdChange(brainId);
    void execute({
      environmentId,
      input: { action: "bindThread", threadId, workspaceId: brainId },
    }).then((result) => {
      const failure =
        result._tag !== "Success" ? "The Brain could not be saved." : result.value.error;
      if (failure) {
        onSelectedBrainIdChange(previous);
        toastManager.add({ type: "error", title: "Brain not changed", description: failure });
      }
    });
  };

  if (brains.length === 0) {
    return null;
  }
  const selectedBrainName = brains.find((brain) => brain.id === selectedBrainId)?.name;
  let triggerLabel = "No Brain";
  if (selectedBrainId !== null) {
    triggerLabel = `Brain: ${selectedBrainName ?? selectedBrainId}`;
  }
  return (
    <Select
      value={selectedBrainId ?? NO_BRAIN_VALUE}
      onValueChange={(value) => chooseBrain(String(value))}
    >
      <SelectTrigger size="compact" variant="ghost" aria-label="Brain for this chat">
        <SelectValue>{triggerLabel}</SelectValue>
      </SelectTrigger>
      <SelectPopup>
        <SelectItem value={NO_BRAIN_VALUE}>No Brain</SelectItem>
        {brains.map((brain) => (
          <SelectItem key={brain.id} value={brain.id}>
            {brain.name}
          </SelectItem>
        ))}
      </SelectPopup>
    </Select>
  );
}
