import type { ReactNode } from "react";

import { cn } from "../lib/utils";
import { THREAD_DETAILS_PANEL_LABEL_CLASS } from "./chat/threadDetailsPanelStyles";

export function ComposerContextLabel({
  children,
  displayMode = "toolbar",
}: {
  children: ReactNode;
  displayMode?: "toolbar" | "panel";
}) {
  return (
    <span
      data-composer-label
      className={cn(
        "min-w-0",
        displayMode === "panel"
          ? "flex-1 overflow-x-clip overflow-y-visible text-left"
          : // Flow: phones show the strip as icons, so it does not jump with label lengths.
            "max-w-[240px] group-data-[compact]/composer-context:max-w-0 max-sm:sr-only",
      )}
    >
      <span
        data-composer-label-motion
        className={cn(
          "block w-full min-w-0 truncate",
          displayMode === "panel" && THREAD_DETAILS_PANEL_LABEL_CLASS,
          displayMode === "toolbar" &&
            "max-w-[240px] transition-opacity duration-180 ease-drawer group-data-[compact]/composer-context:opacity-0 motion-reduce:transition-none",
        )}
      >
        {children}
      </span>
    </span>
  );
}
