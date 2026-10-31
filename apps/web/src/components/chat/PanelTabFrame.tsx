import type { ComponentProps, ReactNode } from "react";

import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "../ui/empty";

/**
 * Flow: the frame of the right panel's Brain, Agents and MCP tabs: a header line with the tab's
 * subject, a muted summary and the tab's actions, above a scrolling body.
 */
export function PanelTabFrame({
  title,
  icon,
  summary,
  actions,
  children,
  ...props
}: {
  readonly title: ReactNode;
  /** Only an icon that informs, such as a Brain's own icon. */
  readonly icon?: ReactNode;
  readonly summary?: string | null;
  readonly actions?: ReactNode;
  readonly children: ReactNode;
} & Omit<ComponentProps<"div">, "title" | "children">) {
  return (
    <div className="flex min-h-0 flex-1 flex-col" {...props}>
      <div className="flex min-h-11 shrink-0 items-center gap-2 border-b px-3 py-2">
        {icon}
        <span className="min-w-0 truncate font-semibold text-sm">{title}</span>
        {summary ? (
          <span className="min-w-0 truncate text-muted-foreground text-xs">· {summary}</span>
        ) : null}
        <span className="flex-1" />
        {actions}
      </div>
      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto pb-2">{children}</div>
    </div>
  );
}

/** A labelled group of a panel tab, with its size on the right. */
export function PanelTabSection(props: {
  readonly label: string;
  readonly count: number;
  readonly children: ReactNode;
}) {
  return (
    <section aria-label={props.label} data-panel-section="">
      <div className="flex justify-between px-3 pt-3 pb-1 font-semibold text-2xs text-muted-foreground uppercase tracking-wide">
        <span>{props.label}</span>
        <span className="tabular-nums">{props.count}</span>
      </div>
      <div className="px-0.5">{props.children}</div>
    </section>
  );
}

/** A panel tab with nothing to show yet, or that cannot show anything here. */
export function PanelTabEmpty(props: {
  readonly icon: ReactNode;
  readonly title: string;
  readonly description?: ReactNode;
  readonly children?: ReactNode;
}) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">{props.icon}</EmptyMedia>
        <EmptyTitle>{props.title}</EmptyTitle>
        {props.description ? <EmptyDescription>{props.description}</EmptyDescription> : null}
      </EmptyHeader>
      {props.children}
    </Empty>
  );
}
