// Fork-only: what the content pane shows while a route's code or data is still
// loading, instead of staying blank. It overlays its outlet instead of taking space,
// because some outlets (dialog routes such as Settings) normally occupy none.

import { Spinner } from "./ui/spinner";

export function RoutePendingView() {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center gap-2 text-sm text-muted-foreground">
      <Spinner className="size-4" />
      <span>Loading…</span>
    </div>
  );
}
