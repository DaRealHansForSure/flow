/**
 * Flow: on a phone the chat is the main page. Back first closes what lies on top of it, then
 * opens the projects sidebar; edge swipes open and close the side menus.
 */

export interface PhoneBackState {
  /** A dialog, menu, popover or sheet other than the sidebar is open. */
  readonly popupOpen: boolean;
  /** A full-screen page such as Settings or the Brain is shown over the chat. */
  readonly screenOpen: boolean;
  readonly rightPanelOpen: boolean;
  readonly sidebarOpen: boolean;
}

export type PhoneBackAction =
  | "close-popup"
  | "close-screen"
  | "close-right-panel"
  | "open-sidebar"
  | "close-sidebar";

export function phoneBackAction(state: PhoneBackState): PhoneBackAction {
  if (state.popupOpen) {
    return "close-popup";
  }
  if (state.screenOpen) {
    return "close-screen";
  }
  if (state.rightPanelOpen) {
    return "close-right-panel";
  }
  // The sidebar is reached from the chat, so Back returns there; the app is left with Home.
  if (state.sidebarOpen) {
    return "close-sidebar";
  }
  return "open-sidebar";
}

/** Pages that cover the chat on a phone; Back returns to the chat they were opened from. */
const SCREEN_PATHS = ["/settings", "/brain", "/usage", "/pull-requests", "/projects"];

export function isPhoneScreenPath(pathname: string): boolean {
  return SCREEN_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

const EDGE_ZONE_PX = 24;
const MIN_SWIPE_PX = 48;
const HORIZONTAL_RATIO = 1.5;

export type EdgeSwipe = "from-left-edge" | "from-right-edge" | "toward-left" | "toward-right";

/** A touch that moved clearly sideways; `null` for taps, scrolls and short drags. */
export function classifyEdgeSwipe(input: {
  readonly startX: number;
  readonly deltaX: number;
  readonly deltaY: number;
  readonly screenWidth: number;
}): EdgeSwipe | null {
  const distance = Math.abs(input.deltaX);
  const isHorizontal =
    distance >= MIN_SWIPE_PX && distance > HORIZONTAL_RATIO * Math.abs(input.deltaY);
  if (!isHorizontal) {
    return null;
  }
  if (input.deltaX > 0 && input.startX <= EDGE_ZONE_PX) {
    return "from-left-edge";
  }
  if (input.deltaX < 0 && input.startX >= input.screenWidth - EDGE_ZONE_PX) {
    return "from-right-edge";
  }
  if (input.deltaX < 0) {
    return "toward-left";
  }
  return "toward-right";
}
