// Fork-only: what the content pane shows while a route's code or data is still
// loading, instead of staying blank. The router renders it inside the parent
// layout's outlet, so sidebars and settings navigation stay in place.

import { Spinner } from "./ui/spinner";

export function RoutePendingView() {
  return (
    <div className="flex min-h-0 w-full flex-1 items-center justify-center gap-2 self-stretch text-sm text-muted-foreground">
      <Spinner className="size-4" />
      <span>Loading…</span>
    </div>
  );
}
