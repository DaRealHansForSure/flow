import type { SubagentPillSegment } from "@t3tools/client-runtime/state/thread-subagents";
import { ChevronDownIcon, GlobeIcon, ListOrderedIcon, UsersIcon } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { useMediaQuery } from "~/hooks/useMediaQuery";
import { tickTextContent } from "~/lib/tickTextContent";
import { Popover, PopoverPopup, PopoverTitle, PopoverTrigger } from "../ui/popover";
import { Sheet, SheetHeader, SheetPopup, SheetTitle } from "../ui/sheet";
import { cn } from "~/lib/utils";
import { STATUS_PILL_CLASS } from "./statusPill";
import type { ThreadNowItem } from "./ThreadNow";
import { formatWorkingTimerNow } from "./TimelineWorkGroupRows.logic";

export interface ComposerStatusBrowsers {
  readonly count: number;
  readonly unseen: boolean;
  readonly onOpen: () => void;
}

export interface ComposerStatusAgents {
  readonly segment: SubagentPillSegment;
  readonly onOpen: () => void;
}

const WORK_TRIGGER_CLASS =
  "flex min-w-0 cursor-pointer items-center gap-2 text-left focus-visible:outline-2 focus-visible:outline-ring";

/** On phones the list is a bottom sheet over the chat, as in the mobile app. */
function BackgroundWorkSheet(props: {
  readonly icon: ReactNode;
  readonly title: ReactNode;
  readonly details: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={WORK_TRIGGER_CLASS}
        aria-label="Show background work"
        onPointerDown={(event) => event.preventDefault()}
        onClick={() => setOpen(true)}
      >
        <span aria-hidden className="flex shrink-0">
          {props.icon}
        </span>
        <span className="min-w-0 truncate text-foreground">{props.title}</span>
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        {/* Focus goes back to this pill, outside the composer: left alone it fell back to a
            composer button (attach) and opened the resting composer. */}
        <SheetPopup side="bottom" className="max-h-[70dvh]" finalFocus={triggerRef}>
          <SheetHeader>
            <SheetTitle>Background work</SheetTitle>
          </SheetHeader>
          <div className="min-h-0 overflow-y-auto px-6 pb-6 [&_[data-work-row]]:py-3.5 [&_li_.text-xs]:text-sm">
            {props.details}
          </div>
        </SheetPopup>
      </Sheet>
    </>
  );
}

/**
 * Closes on any press outside, caught in the capture phase: the composer handles its own presses
 * and would otherwise keep the popover open.
 */
function BackgroundWorkPopover(props: {
  readonly icon: ReactNode;
  readonly title: ReactNode;
  readonly details: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- listens to document presses outside React while the popover is open
  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && (popupRef.current?.contains(target) || triggerRef.current?.contains(target))) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePress, true);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePress, true);
  }, [open]);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            ref={triggerRef}
            type="button"
            className={WORK_TRIGGER_CLASS}
            aria-label="Show background work"
          />
        }
      >
        <span aria-hidden className="flex shrink-0">
          {props.icon}
        </span>
        <span className="min-w-0 truncate text-foreground hover:underline">{props.title}</span>
      </PopoverTrigger>
      <PopoverPopup
        ref={popupRef}
        side="top"
        align="center"
        className="w-[min(92vw,24rem)]"
        finalFocus={false}
      >
        <PopoverTitle className="mb-1">Background work</PopoverTitle>
        {props.details}
      </PopoverPopup>
    </Popover>
  );
}

const SEGMENT_CLASS =
  "flex h-full shrink-0 cursor-pointer items-center gap-1.5 px-3 first:ps-4 last:pe-4 hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring";

function Segment(props: {
  readonly label: string;
  readonly onPress: (() => void) | null;
  readonly children: ReactNode;
}) {
  if (props.onPress === null) {
    return (
      <span className={cn(SEGMENT_CLASS, "cursor-default hover:bg-transparent")}>
        {props.children}
      </span>
    );
  }
  return (
    <button
      type="button"
      aria-label={props.label}
      className={SEGMENT_CLASS}
      onPointerDown={(event) => event.preventDefault()}
      onClick={props.onPress}
    >
      {props.children}
    </button>
  );
}

/**
 * Flow: the mobile app's floating status control for web and desktop. It stays above the composer
 * instead of scrolling with the chat: work in progress, the chat's browsers, queued messages, and a
 * way back to the end. Parts are split by dividers; the control hides when it has nothing to show.
 */
export function ComposerStatusControl(props: {
  readonly bottom: number;
  /** Background work, with its own actions such as Stop. */
  readonly work: ThreadNowItem | null;
  readonly workingSince: string | null;
  readonly browsers: ComposerStatusBrowsers | null;
  /** This turn's subagents, as in the mobile app: "2/3" while working, "3 done" after. */
  readonly agents: ComposerStatusAgents | null;
  readonly queuedCount: number;
  readonly showScrollToEnd: boolean;
  readonly onScrollToEnd: () => void;
}) {
  const isPhone = useMediaQuery("max-sm");
  const segments: ReactNode[] = [];
  if (props.work !== null) {
    const work = props.work;
    segments.push(
      <span
        key="work"
        className="flex h-full min-w-0 items-center gap-2 px-3 first:ps-4 last:pe-4 text-muted-foreground"
      >
        {!work.details ? (
          <>
            <span aria-hidden className="flex shrink-0">
              {work.icon}
            </span>
            <span className="min-w-0 truncate text-foreground">{work.title}</span>
          </>
        ) : isPhone ? (
          <BackgroundWorkSheet icon={work.icon} title={work.title} details={work.details} />
        ) : (
          <BackgroundWorkPopover icon={work.icon} title={work.title} details={work.details} />
        )}
        {work.actions ? (
          <span className="flex shrink-0 items-center gap-2 border-l border-border ps-3">
            {work.actions}
          </span>
        ) : null}
      </span>,
    );
  }
  if (props.workingSince !== null) {
    const startedAt = props.workingSince;
    segments.push(
      <Segment key="working" label="Working" onPress={null}>
        Working
        <span
          ref={tickTextContent(() => formatWorkingTimerNow(startedAt), true)}
          className="tabular-nums"
        />
      </Segment>,
    );
  }
  if (props.browsers !== null) {
    const { count, unseen } = props.browsers;
    const label = count === 1 ? "Show 1 browser" : `Show ${count} browsers`;
    segments.push(
      <Segment key="browsers" label={label} onPress={props.browsers.onOpen}>
        <span className="relative flex">
          <GlobeIcon aria-hidden />
          {unseen ? (
            <span
              aria-hidden
              className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-info"
            />
          ) : null}
        </span>
        {count > 1 ? <span className="tabular-nums">{count}</span> : null}
      </Segment>,
    );
  }
  if (props.agents !== null) {
    const { segment } = props.agents;
    segments.push(
      <Segment
        key="agents"
        label={`Open agents, ${segment.accessibilityLabel}`}
        onPress={props.agents.onOpen}
      >
        <UsersIcon aria-hidden />
        <span className="tabular-nums">{segment.label}</span>
      </Segment>,
    );
  }
  if (props.queuedCount > 0) {
    segments.push(
      <Segment key="queued" label={`${props.queuedCount} queued`} onPress={props.onScrollToEnd}>
        <ListOrderedIcon aria-hidden />
        <span className="tabular-nums">{props.queuedCount} queued</span>
      </Segment>,
    );
  }
  if (segments.length === 0 && !props.showScrollToEnd) return null;
  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-30 flex items-center justify-center gap-2 px-3"
      style={{ bottom: props.bottom }}
    >
      {segments.length > 0 ? (
        <div
          role="group"
          aria-label="Thread status"
          className={cn(
            STATUS_PILL_CLASS,
            "pointer-events-auto mx-0 gap-0 divide-x divide-(--floating-pill-border) overflow-hidden px-0",
          )}
        >
          {segments}
        </div>
      ) : null}
      {/* As in the mobile app, scrolling back down is its own round button beside the pill. */}
      {props.showScrollToEnd ? (
        <button
          type="button"
          aria-label="Scroll to end"
          onPointerDown={(event) => event.preventDefault()}
          onClick={props.onScrollToEnd}
          className={cn(
            STATUS_PILL_CLASS,
            "pointer-events-auto mx-0 w-10 shrink-0 cursor-pointer justify-center px-0 hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring sm:w-9",
          )}
        >
          <ChevronDownIcon aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
