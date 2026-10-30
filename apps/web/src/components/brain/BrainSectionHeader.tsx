import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { ChevronDownIcon } from "lucide-react";

/**
 * The header bar of a collapsible Brain section: the whole row toggles the section, while
 * `actions` (a switch, an expand button) stay separately clickable.
 */
export function BrainSectionHeader({
  icon: Icon,
  label,
  count,
  description,
  expanded,
  onToggle,
  actions,
}: {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly count?: number | undefined;
  readonly description?: string | undefined;
  readonly expanded: boolean;
  readonly onToggle: () => void;
  readonly actions?: ReactNode;
}) {
  // The toggle is stretched under the row rather than wrapping it, since a button must not
  // contain the action buttons. Everything above it but the actions lets clicks through.
  // In a narrow panel (a phone) the actions move to a second row so the title keeps its line.
  return (
    <header className="@container relative grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-start gap-x-2 gap-y-1 px-2.5 py-2">
      <button
        type="button"
        aria-label={`${expanded ? "Collapse" : "Expand"} ${label}`}
        aria-expanded={expanded}
        onClick={onToggle}
        className="absolute inset-0 rounded-xl hover:bg-muted/60"
      />
      <Icon className="pointer-events-none relative mt-0.5 size-4 shrink-0 text-primary" />
      <div className="pointer-events-none relative min-w-0 flex-1">
        <h2 className="text-sm font-medium">
          {label}
          {count !== undefined && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">{count}</span>
          )}
        </h2>
        {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
      </div>
      {actions && (
        <div className="relative flex items-start justify-end gap-1 @max-[22rem]:col-span-3 @max-[22rem]:col-start-2 @max-[22rem]:row-start-2">
          {actions}
        </div>
      )}
      <ChevronDownIcon
        className={`pointer-events-none relative col-start-4 row-start-1 mt-0.5 size-4 shrink-0 text-muted-foreground ${expanded ? "rotate-180" : ""}`}
      />
    </header>
  );
}
