import type { ReactNode } from "react";

/**
 * Flow: the Agents tab's frame, laid out like the MCP tab: a header line with the tab's summary and
 * actions, then a scrolling list of sections.
 */
export function AgentsPanelFrame(props: {
  readonly summary: string | null;
  readonly actions?: ReactNode;
  readonly children: ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col" data-thread-relationships-panel>
      <div className="flex min-h-11 items-center gap-2 border-b px-3 py-2">
        <span className="font-semibold text-sm">Agents</span>
        {props.summary === null ? null : (
          <span className="min-w-0 truncate text-muted-foreground text-xs">· {props.summary}</span>
        )}
        <span className="flex-1" />
        {props.actions}
      </div>
      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto pb-2">{props.children}</div>
    </div>
  );
}

/** A labelled group of the Agents tab, with its size, as the MCP tab groups servers. */
export function AgentsPanelSection(props: {
  readonly label: string;
  readonly count: number;
  readonly children: ReactNode;
}) {
  return (
    <section aria-label={props.label}>
      <div className="flex justify-between px-3 pt-3 pb-1 font-semibold text-2xs text-muted-foreground uppercase tracking-wide">
        <span>{props.label}</span>
        <span className="tabular-nums">{props.count}</span>
      </div>
      <div className="px-0.5">{props.children}</div>
    </section>
  );
}
