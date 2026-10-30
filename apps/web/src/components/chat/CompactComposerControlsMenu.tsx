import { memo, type ReactNode, useRef } from "react";
import { EllipsisIcon } from "lucide-react";
import { Menu, MenuPopup, MenuSeparator as MenuDivider, MenuTrigger } from "../ui/menu";
import { ComposerControl, ComposerControlIcon } from "./ComposerControl";
import { focusRequestedPermission, useComposerMenuProps } from "./composerEventScope";
import { useComposerMenuState } from "./useComposerMenuState";
import { ComposerPermissionsSection } from "./ComposerFooterControls";
import type { PermissionMode, PermissionModeOption } from "./runtimeModeConfig";

export const CompactComposerControlsMenu = memo(function CompactComposerControlsMenu(props: {
  permissionMode: PermissionMode;
  permissionModeOptions: ReadonlyArray<PermissionModeOption>;
  traitsMenuContent?: ReactNode;
  showPermissions?: boolean;
  size?: "sm" | "xs";
  /** Close the portaled popup when its trigger hides. */
  hidden?: boolean;
  onPermissionModeChange: (mode: PermissionMode) => void;
}) {
  const composerFloatingLayerProps = useComposerMenuProps();
  const size = props.size ?? "sm";
  const [open, setOpen] = useComposerMenuState(props.hidden);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <Menu
      open={open}
      onOpenChange={setOpen}
      onOpenChangeComplete={(isOpen) => focusRequestedPermission(isOpen, triggerRef.current)}
    >
      <MenuTrigger
        render={
          <ComposerControl
            ref={triggerRef}
            size={size}
            className="shrink-0"
            aria-label="More composer controls"
            data-composer-shortcut={
              [
                props.showPermissions !== false ? "composer.mode" : null,
                props.traitsMenuContent ? "composer.effort" : null,
              ]
                .filter(Boolean)
                .join(" ") || undefined
            }
          />
        }
      >
        <ComposerControlIcon icon={EllipsisIcon} size={size} />
      </MenuTrigger>
      <MenuPopup align="start" {...composerFloatingLayerProps}>
        {props.traitsMenuContent ? (
          <>
            {props.traitsMenuContent}
            {props.showPermissions !== false ? <MenuDivider /> : null}
          </>
        ) : null}
        {props.showPermissions === false ? null : (
          <ComposerPermissionsSection
            permissionMode={props.permissionMode}
            permissionModeOptions={props.permissionModeOptions}
            onPermissionModeChange={props.onPermissionModeChange}
          />
        )}
      </MenuPopup>
    </Menu>
  );
});
