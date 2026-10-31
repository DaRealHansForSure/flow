// Fork-only: what the content pane shows while a route's code or data is still
// loading, instead of staying blank. It overlays its outlet instead of taking space,
// because some outlets (dialog routes such as Settings) normally occupy none.

import { Spinner } from "./ui/spinner";

export function RoutePendingView() {
  return (
    // Under the header, above the composer: centred, a phone's composer covered and dimmed it.
    <div className="pointer-events-none absolute inset-x-0 top-[calc(var(--workspace-topbar-height)+0.75rem)] z-50 flex justify-center">
      {/* A pill of its own, so it reads clearly over whatever page is still showing. */}
      <div
        role="status"
        className="flex items-center gap-2 rounded-full border border-border bg-popover px-4 py-2 text-sm text-foreground shadow-lg"
      >
        <Spinner className="size-4" />
        <span>Loading…</span>
      </div>
    </div>
  );
}
