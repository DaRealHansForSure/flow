import { GlobeIcon, RefreshCwIcon } from "lucide-react";
import type { ReactNode } from "react";

import { threadSyncLabel, type ThreadSyncPhase } from "../../threadSync";
import { cn } from "~/lib/utils";
import { NoticeText } from "./ComposerBannerStack";
import { STATUS_PILL_CLASS, STATUS_PILL_PART_CLASS } from "./statusPill";

/** A line of thread state for the end of the timeline. */
export interface ThreadNowItem {
  readonly id: string;
  readonly icon: ReactNode;
  readonly title: ReactNode;
  readonly description?: ReactNode;
  readonly actions?: ReactNode;
}

/** Matches ThreadStatusLine, so every line at the end of the timeline reads as one family. */
const lineClassName = cn(
  "mx-auto flex w-full min-w-0 max-w-(--chat-content-max-width) items-center gap-1.5 px-1 pb-2 text-xs text-muted-foreground [&_svg]:size-3.5 [&_svg]:shrink-0",
  // A details button must not make its line taller than the others.
  "[&_[data-slot=popover-trigger]]:-my-1.5",
  // Inline actions keep their text size but get a finger-sized hit area on touch.
  "pointer-coarse:[&_[data-slot=inline-button]]:relative pointer-coarse:[&_[data-slot=inline-button]]:after:absolute pointer-coarse:[&_[data-slot=inline-button]]:after:-inset-x-1.5 pointer-coarse:[&_[data-slot=inline-button]]:after:-inset-y-3.5",
  "transition-opacity duration-150 ease-out starting:opacity-0 motion-reduce:transition-none",
);

/** One line of thread state at the end of the timeline: icon, title, detail, then actions. */
function ThreadNowLine({
  item,
  announce = false,
  chip = false,
}: {
  readonly item: ThreadNowItem;
  /** Announces the line when it appears; only for something that needs the user. */
  readonly announce?: boolean;
  /** Flow: draws the line as a pill, so running background work reads as one control. */
  readonly chip?: boolean;
}) {
  const content = (
    <>
      <span aria-hidden className="flex size-3.5 shrink-0 items-center justify-center">
        {item.icon}
      </span>
      {/* Title and detail read as one line that gives way before the actions, so Stop stays
          reachable; when it is cut, its details button shows all of it. */}
      <NoticeText
        detailsLabel={
          typeof item.title === "string" ? `Show details: ${item.title}` : "Show details"
        }
        className="min-w-0 truncate"
      >
        {item.title}
        {item.description ? (
          <>
            {" "}
            <span className="ms-0.5 text-muted-foreground/60 light:text-muted-foreground/80">
              {item.description}
            </span>
          </>
        ) : null}
      </NoticeText>
      {item.actions ? (
        <span
          className={cn(
            "ms-1.5 flex shrink-0 items-center gap-2.5",
            chip && STATUS_PILL_PART_CLASS,
          )}
        >
          {item.actions}
        </span>
      ) : null}
    </>
  );
  return (
    <div
      role={announce ? "alert" : undefined}
      className={lineClassName}
      data-thread-now-line="true"
    >
      {chip ? (
        // Matches the mobile app's running-work pill: centered, a divider before its actions.
        <span className={STATUS_PILL_CLASS}>{content}</span>
      ) : (
        content
      )}
    </div>
  );
}

/** Flow: like the mobile app's globe, a pill for the chat's browsers while none is on screen. */
function ThreadBrowserChip({ browser }: { readonly browser: ThreadNowBrowser }) {
  const label = browser.count === 1 ? "1 browser" : `${browser.count} browsers`;
  return (
    <div className={lineClassName} data-thread-now-line="true">
      <button
        type="button"
        onClick={browser.onOpen}
        aria-label={`Show ${label}`}
        className={cn(
          STATUS_PILL_CLASS,
          "relative cursor-pointer hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring",
        )}
      >
        <GlobeIcon aria-hidden />
        {label}
        {browser.unseen ? (
          <span aria-hidden className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-info" />
        ) : null}
      </button>
    </div>
  );
}

export interface ThreadNowBrowser {
  readonly count: number;
  readonly unseen: boolean;
  readonly onOpen: () => void;
}

function ThreadSyncLine({ phase }: { readonly phase: ThreadSyncPhase }) {
  return (
    <div className={lineClassName} role="status" data-composer-sync-status={phase}>
      <RefreshCwIcon aria-hidden />
      <span className="truncate">{threadSyncLabel(phase)}</span>
    </div>
  );
}

/**
 * What the thread is doing now, at the end of the timeline: what needs you, background work,
 * the sync status while messages load, then the goal.
 */
export function ThreadNow({
  attention,
  work,
  syncPhase,
  goal,
  browser = null,
}: {
  /** Something that needs you elsewhere, such as a subagent's question. */
  readonly attention: ThreadNowItem | null;
  readonly work: ThreadNowItem | null;
  readonly syncPhase: ThreadSyncPhase | null;
  readonly goal: ThreadNowItem | null;
  readonly browser?: ThreadNowBrowser | null;
}): ReactNode {
  return (
    <>
      {attention ? <ThreadNowLine item={attention} announce /> : null}
      {work ? <ThreadNowLine item={work} chip /> : null}
      {browser ? <ThreadBrowserChip browser={browser} /> : null}
      {syncPhase ? <ThreadSyncLine phase={syncPhase} /> : null}
      {goal ? <ThreadNowLine item={goal} /> : null}
    </>
  );
}
