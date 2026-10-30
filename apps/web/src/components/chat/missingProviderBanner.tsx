import { CircleAlertIcon } from "lucide-react";

import { Button } from "../ui/button";
import type { ComposerBannerStackItem } from "./ComposerBannerStack";

/**
 * Flow: the chat's missing provider instance stays its provider until a model is picked by hand
 * on another instance; an automatic draft selection never replaces it.
 */
export function heldMissingProvider<InstanceId extends string>(input: {
  readonly missingInstanceId: InstanceId | null | undefined;
  readonly draftActiveProvider: string | null;
  readonly draftSelectionExplicit: boolean | undefined;
}): InstanceId | null {
  if (input.missingInstanceId == null) {
    return null;
  }
  const pickedOtherProvider =
    input.draftSelectionExplicit === true &&
    input.draftActiveProvider !== null &&
    input.draftActiveProvider !== input.missingInstanceId;
  return pickedOtherProvider ? null : input.missingInstanceId;
}

/**
 * Flow: the chat's own provider instance is not set up on this server, so the composer falls
 * back to another one. Says so instead of switching accounts silently.
 */
export function missingProviderBannerItem(input: {
  readonly instanceId: string;
  readonly onOpenSettings: () => void;
}): ComposerBannerStackItem {
  return {
    id: `missing-provider:${input.instanceId}`,
    variant: "error",
    icon: <CircleAlertIcon />,
    // One short line: a longer title or a description each add a details button.
    title: `Provider "${input.instanceId}" missing`,
    actions: (
      <Button size="xs" variant="ghost" onClick={input.onOpenSettings}>
        Provider settings
      </Button>
    ),
  };
}
