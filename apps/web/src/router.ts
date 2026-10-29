import { createRouter, RouterHistory } from "@tanstack/react-router";

import { routeTree } from "./routeTree.gen";
import { RoutePendingView } from "./components/RoutePendingView";

const ROUTE_PENDING_DELAY_MS = 150;
const ROUTE_PENDING_MIN_VISIBLE_MS = 300;

export function getRouter(history: RouterHistory) {
  return createRouter({
    routeTree,
    history,
    context: {},
    // Route components are split chunks (autoCodeSplitting in vite.config);
    // fetching them on hover/focus intent hides the load from the first
    // settings or pull-request navigation.
    defaultPreload: "intent",
    // Show a loading state in the content pane once a navigation takes longer
    // than a blink, and keep it up long enough not to flash (fork).
    defaultPendingComponent: RoutePendingView,
    defaultPendingMs: ROUTE_PENDING_DELAY_MS,
    defaultPendingMinMs: ROUTE_PENDING_MIN_VISIBLE_MS,
  });
}

export type AppRouter = ReturnType<typeof getRouter>;

declare module "@tanstack/react-router" {
  interface Register {
    router: AppRouter;
  }
}
