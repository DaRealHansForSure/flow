import { useAtomValue } from "@effect/atom-react";

import { shortcutLabelForCommand } from "../keybindings";
import { primaryServerKeybindingsAtom } from "../state/server";
import { ComposerControl } from "./chat/ComposerControl";
import {
  type PermissionMode,
  planPermissionModeOption,
  runtimeModeConfig,
} from "./chat/runtimeModeConfig";
import { ComposerContextLabel } from "./ComposerContextLabel";
import { Tooltip, TooltipPopup, TooltipTrigger } from "./ui/tooltip";

/** The new-thread strip names the permissions the first send will use; clicking opens them. */
export function ComposerContextPermissions(props: {
  permissionMode: PermissionMode;
  onOpen: () => void;
}) {
  const shortcutLabel = shortcutLabelForCommand(
    useAtomValue(primaryServerKeybindingsAtom),
    "composer.mode",
  );
  const { icon: Icon, label } =
    props.permissionMode === "plan"
      ? planPermissionModeOption
      : runtimeModeConfig[props.permissionMode];
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <ComposerControl
            size="xs"
            className="ms-auto min-w-0 shrink-0"
            aria-label={`Permissions: ${label}`}
            aria-haspopup="menu"
            data-composer-context-control
            onClick={props.onOpen}
          />
        }
      >
        <Icon aria-hidden="true" className="size-3" />
        <ComposerContextLabel>{label}</ComposerContextLabel>
      </TooltipTrigger>
      <TooltipPopup>Permissions{shortcutLabel ? ` · ${shortcutLabel}` : null}</TooltipPopup>
    </Tooltip>
  );
}
