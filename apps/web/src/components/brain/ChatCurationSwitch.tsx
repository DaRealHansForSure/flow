import { useState } from "react";
import type { BrainChatCurationChoice } from "@t3tools/contracts";
import { Toggle, ToggleGroup } from "../ui/toggle-group";
import { toastManager } from "../ui/toast";

type CurationChoice = "default" | "on" | "off";

/**
 * One chat's own choice for something the notes agent maintains: Default follows the project
 * or global setting, On and Off apply to this chat only. The hint under it says which.
 */
export function ChatCurationSwitch({
  label,
  choice,
  disabledHint,
  onChange,
}: {
  /** What the switch controls, as the section names it: "Auto-Docs". */
  readonly label: string;
  readonly choice: BrainChatCurationChoice;
  /** Disables the switch and replaces the hint, saying why it has no effect right now. */
  readonly disabledHint?: string | undefined;
  /** Resolves with an error message, or null once the server has saved the choice. */
  readonly onChange: (enabled: boolean | undefined) => Promise<string | null>;
}) {
  const [pendingChoice, setPendingChoice] = useState<CurationChoice | null>(null);
  const shownChoice = pendingChoice ?? curationChoice(choice.choice);
  const select = (next: CurationChoice) => {
    if (next === shownChoice) {
      return;
    }
    setPendingChoice(next);
    void onChange(curationEnabled(next)).then((failure) => {
      setPendingChoice(null);
      if (failure) {
        toastManager.add({ type: "error", title: `${label} not changed`, description: failure });
      }
    });
  };
  return (
    <div className="flex shrink-0 flex-col items-end gap-0.5">
      <ToggleGroup
        aria-label={`${label} for this chat`}
        disabled={disabledHint !== undefined}
        value={[shownChoice]}
        onValueChange={(next) => {
          const picked = next[0];
          if (picked === "default" || picked === "on" || picked === "off") {
            select(picked);
          }
        }}
      >
        <Toggle value="default">Default</Toggle>
        <Toggle value="on">On</Toggle>
        <Toggle value="off">Off</Toggle>
      </ToggleGroup>
      <span className="text-2xs text-muted-foreground">
        {curationHint(shownChoice, choice.inherited, disabledHint)}
      </span>
    </div>
  );
}

function curationHint(
  shownChoice: CurationChoice,
  inherited: boolean,
  disabledHint: string | undefined,
): string {
  if (disabledHint !== undefined) {
    return disabledHint;
  }
  if (shownChoice !== "default") {
    return "Only for this chat.";
  }
  return inherited ? "Follows Settings: on." : "Follows Settings: off.";
}

function curationChoice(choice: boolean | undefined): CurationChoice {
  if (choice === undefined) {
    return "default";
  }
  return choice ? "on" : "off";
}

function curationEnabled(choice: CurationChoice): boolean | undefined {
  if (choice === "default") {
    return undefined;
  }
  return choice === "on";
}
