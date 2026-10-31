import type { ReactNode } from "react";
import { ChevronDownIcon } from "lucide-react";

/**
 * The header bar of a collapsible Brain section: the whole row toggles the section, while
 * `actions` (a switch, an expand button) stay separately clickable. Flow: labelled like the MCP and
 * Agents tabs' sections (small uppercase label and count, no icon), see docs/internals/web-ui.md.
 */
export function BrainSectionHeader({
  label,
  count,
  description,
  expanded,
  onToggle,
  actions,
}: {
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
    <header className="@container relative grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-2 gap-y-1 px-3 pt-3 pb-1.5">
      <button
        type="button"
        aria-label={`${expanded ? "Collapse" : "Expand"} ${label}`}
        aria-expanded={expanded}
        onClick={onToggle}
        className="absolute inset-0 hover:bg-muted/40"
      />
      <div className="pointer-events-none relative min-w-0 flex-1">
        <h2 className="font-semibold text-2xs text-muted-foreground uppercase tracking-wide">
          {label}
          {count !== undefined && <span className="ml-2 tabular-nums">{count}</span>}
        </h2>
        {description && (
          <p className="mt-1 text-xs text-muted-foreground normal-case">{description}</p>
        )}
      </div>
      {actions && (
        <div className="relative flex items-start justify-end gap-1 @max-[22rem]:col-span-2 @max-[22rem]:col-start-1 @max-[22rem]:row-start-2">
          {actions}
        </div>
      )}
      <ChevronDownIcon
        className={`pointer-events-none relative col-start-3 row-start-1 size-4 shrink-0 text-muted-foreground ${expanded ? "rotate-180" : ""}`}
      />
    </header>
  );
}
