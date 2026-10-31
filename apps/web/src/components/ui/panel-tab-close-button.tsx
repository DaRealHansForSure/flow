import { X } from "lucide-react";
import type { ReactNode } from "react";
import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";

interface PanelTabCloseButtonProps {
  children: ReactNode;
  label: string;
  onClick: () => void;
  tooltip?: string;
  /**
   * Flow: how the button behaves on a touch screen, where there is no hover. "close" shows the X
   * (the tab you are on), "activate" shows the icon and only switches to the tab.
   */
  touch?:
    | { readonly mode: "close" }
    | { readonly mode: "activate"; readonly onActivate: () => void };
}

export function PanelTabCloseButton({
  children,
  label,
  onClick,
  tooltip,
  touch,
}: PanelTabCloseButtonProps) {
  if (touch?.mode === "activate") {
    return (
      <button
        type="button"
        className="relative flex size-4 shrink-0 items-center justify-center"
        aria-label={label.replace(/^Close /, "Show ")}
        onClick={touch.onActivate}
      >
        <span className="relative flex size-3 items-center justify-center">{children}</span>
      </button>
    );
  }
  if (touch?.mode === "close") {
    return (
      <button
        type="button"
        className="cursor-pointer relative flex size-4 shrink-0 items-center justify-center rounded-sm before:absolute before:-inset-1.5 before:content-['']"
        aria-label={label}
        onClick={onClick}
      >
        <X className="size-3" />
      </button>
    );
  }
  const button = (
    <button
      type="button"
      className="cursor-pointer group/close relative flex size-4 shrink-0 items-center justify-center rounded-sm before:absolute before:-inset-1 before:content-[''] hover:bg-muted"
      aria-label={label}
      onClick={onClick}
    >
      <span className="relative flex size-3 items-center justify-center group-hover/tab:hidden group-focus-visible/close:hidden">
        {children}
      </span>
      <X className="hidden size-3 group-hover/tab:block group-focus-visible/close:block" />
    </button>
  );

  if (!tooltip) return button;

  return (
    <Tooltip>
      <TooltipTrigger render={button} />
      <TooltipPopup>{tooltip}</TooltipPopup>
    </Tooltip>
  );
}
