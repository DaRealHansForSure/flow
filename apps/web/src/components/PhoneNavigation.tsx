import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentId, ScopedThreadRef, ThreadId } from "@t3tools/contracts";
import { useLocation, useParams, useRouter } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useRef } from "react";

import {
  classifyEdgeSwipe,
  isPhoneScreenPath,
  phoneBackAction,
  type PhoneBackState,
} from "../phoneNavigation";
import { selectThreadRightPanelState, useRightPanelStore } from "../rightPanelStore";
import { useThreadShell } from "../state/entities";
import { useSidebar } from "./ui/sidebar";

/** Open Base UI popups (dialogs, sheets, menus, popovers, selects), except the sidebar's sheet. */
const OPEN_POPUP_SELECTOR =
  '[data-open]:is([role="dialog"],[role="alertdialog"],[role="menu"],[role="listbox"]):not([data-sidebar="sidebar"])';

function isPopupOpen(): boolean {
  return document.querySelector(OPEN_POPUP_SELECTOR) !== null;
}

/** Base UI closes its topmost popup on Escape, which keeps each popup's own close handling. */
function closeTopPopup() {
  const target = document.activeElement ?? document.body;
  target.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
}

/** A swipe inside something that scrolls sideways (code, tables, tab strips) belongs to it. */
function startsInHorizontalScroller(target: EventTarget | null): boolean {
  let element = target instanceof Element ? target : null;
  while (element !== null && element !== document.body) {
    const overflowX = getComputedStyle(element).overflowX;
    const scrolls = overflowX === "auto" || overflowX === "scroll";
    if (scrolls && element.scrollWidth > element.clientWidth) {
      return true;
    }
    element = element.parentElement;
  }
  return false;
}

interface PhoneNavigationSnapshot {
  readonly pathname: string;
  readonly threadRef: ScopedThreadRef | null;
  readonly sidebarOpen: boolean;
  readonly parentThreadRef: ScopedThreadRef | null;
}

// The chat a full-screen page returns to, kept for the tab so a reload keeps the way back.
const RETURN_CHAT_KEY = "flow:phone-return-chat";

function readReturnChat(): string | null {
  try {
    return window.sessionStorage.getItem(RETURN_CHAT_KEY);
  } catch {
    return null;
  }
}

function saveReturnChat(href: string) {
  try {
    window.sessionStorage.setItem(RETURN_CHAT_KEY, href);
  } catch {
    // Storage can be off in private modes; the way back then lasts until a reload.
  }
}

/**
 * Flow: on a phone the chat is the main page. Back closes a popup, a full-screen page or the right
 * panel, then opens the projects sidebar; edge swipes open and close the side menus.
 */
export function PhoneNavigation() {
  const { isMobile, openMobile, setOpenMobile } = useSidebar();
  const router = useRouter();
  const pathname = useLocation({ select: (location) => location.pathname });
  const params = useParams({ strict: false }) as {
    readonly environmentId?: string;
    readonly threadId?: string;
  };
  const threadRef =
    params.environmentId !== undefined && params.threadId !== undefined
      ? scopeThreadRef(params.environmentId as EnvironmentId, params.threadId as ThreadId)
      : null;
  const shell = useThreadShell(threadRef);
  const parentThreadRef =
    threadRef !== null &&
    shell?.lineage.relationshipToParent === "subagent" &&
    shell.lineage.parentThreadId !== null
      ? scopeThreadRef(threadRef.environmentId, shell.lineage.parentThreadId)
      : null;

  const snapshotRef = useRef<PhoneNavigationSnapshot>({
    pathname,
    threadRef,
    sidebarOpen: openMobile,
    parentThreadRef,
  });
  const lastChatHrefRef = useRef<string | null>(readReturnChat());
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- the history blocker and touch listeners read the latest route and sidebar state at event time
  useLayoutEffect(() => {
    snapshotRef.current = { pathname, threadRef, sidebarOpen: openMobile, parentThreadRef };
    if (!isPhoneScreenPath(pathname) && lastChatHrefRef.current !== router.state.location.href) {
      lastChatHrefRef.current = router.state.location.href;
      saveReturnChat(router.state.location.href);
    }
  });

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- intercepts the browser's Back through the router history while on a phone
  useEffect(() => {
    if (!isMobile) {
      return;
    }
    const readState = (): PhoneBackState => {
      const snapshot = snapshotRef.current;
      const rightPanel = selectThreadRightPanelState(
        useRightPanelStore.getState().byThreadKey,
        snapshot.threadRef,
      );
      return {
        popupOpen: isPopupOpen(),
        screenOpen: isPhoneScreenPath(snapshot.pathname),
        rightPanelOpen: snapshot.threadRef !== null && rightPanel.isOpen,
        sidebarOpen: snapshot.sidebarOpen,
        hasParentChat: snapshot.parentThreadRef !== null,
      };
    };
    // On the first entry Back would leave the app, so a copy gives it something to come back
    // from. Read the router's history: a memory history never changes window.history.
    // Chrome's Back skips entries added before the user touched the page, so wait for a tap.
    const addFirstEntryCopy = () => {
      if (router.history.location.state.__TSR_index !== 0) {
        return;
      }
      // Without the old state, so the router gives the copy its own history index; copying the
      // index made Back read as a jump, which the blocker let through.
      router.history.push(router.state.location.href);
    };
    const onFirstActivation = () => {
      removeActivationListeners();
      addFirstEntryCopy();
    };
    const removeActivationListeners = () => {
      document.removeEventListener("pointerup", onFirstActivation, { capture: true });
      document.removeEventListener("keydown", onFirstActivation, { capture: true });
    };
    if (navigator.userActivation?.hasBeenActive === true) {
      addFirstEntryCopy();
    } else {
      document.addEventListener("pointerup", onFirstActivation, { capture: true });
      document.addEventListener("keydown", onFirstActivation, { capture: true });
    }
    const unblock = router.history.block({
      enableBeforeUnload: false,
      blockerFn: ({ action, currentLocation, nextLocation }) => {
        // A jump (GO) to an earlier or the same entry is a Back too, for example after entries
        // that share an index.
        const movesBack =
          action === "BACK" ||
          (action === "GO" && nextLocation.state.__TSR_index <= currentLocation.state.__TSR_index);
        if (!movesBack) {
          return false;
        }
        const backAction = phoneBackAction(readState());
        const snapshot = snapshotRef.current;
        switch (backAction) {
          case "close-popup":
            closeTopPopup();
            return true;
          case "close-screen":
            void router.navigate({ href: lastChatHrefRef.current ?? "/", replace: true });
            return true;
          case "close-right-panel":
            if (snapshot.threadRef !== null) {
              useRightPanelStore.getState().close(snapshot.threadRef);
            }
            return true;
          case "open-parent-chat":
            if (snapshot.parentThreadRef !== null) {
              void router.navigate({
                to: "/$environmentId/$threadId",
                params: {
                  environmentId: snapshot.parentThreadRef.environmentId,
                  threadId: snapshot.parentThreadRef.threadId,
                },
                replace: true,
              });
            }
            return true;
          case "open-sidebar":
            setOpenMobile(true);
            return true;
          case "close-sidebar":
            setOpenMobile(false);
            return true;
        }
      },
    });
    return () => {
      removeActivationListeners();
      unblock();
    };
  }, [isMobile, router, setOpenMobile]);

  // The sidebar stays open behind pickers it opens (New thread, Add project); a new page closes it.
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- follows router navigations while on a phone
  useEffect(() => {
    if (!isMobile) {
      return;
    }
    return router.subscribe("onResolved", (event) => {
      if (event.pathChanged && snapshotRef.current.sidebarOpen) {
        setOpenMobile(false);
      }
    });
  }, [isMobile, router, setOpenMobile]);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- listens for edge swipes on the document while on a phone
  useEffect(() => {
    if (!isMobile) {
      return;
    }
    let start: { readonly x: number; readonly y: number; readonly ignored: boolean } | null = null;
    const onTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (event.touches.length !== 1 || touch === undefined) {
        start = null;
        return;
      }
      start = {
        x: touch.clientX,
        y: touch.clientY,
        ignored: isPopupOpen() || startsInHorizontalScroller(event.target),
      };
    };
    const onTouchEnd = (event: TouchEvent) => {
      const touch = event.changedTouches[0];
      const began = start;
      start = null;
      if (began === null || began.ignored || touch === undefined) {
        return;
      }
      const swipe = classifyEdgeSwipe({
        startX: began.x,
        deltaX: touch.clientX - began.x,
        deltaY: touch.clientY - began.y,
        screenWidth: window.innerWidth,
      });
      const snapshot = snapshotRef.current;
      if (swipe === null || isPhoneScreenPath(snapshot.pathname)) {
        return;
      }
      const panelStore = useRightPanelStore.getState();
      const rightPanelOpen =
        snapshot.threadRef !== null &&
        selectThreadRightPanelState(panelStore.byThreadKey, snapshot.threadRef).isOpen;
      if (swipe === "from-left-edge" && !snapshot.sidebarOpen && !rightPanelOpen) {
        setOpenMobile(true);
      } else if (swipe === "toward-left" && snapshot.sidebarOpen) {
        setOpenMobile(false);
      } else if (
        swipe === "from-right-edge" &&
        snapshot.threadRef !== null &&
        !snapshot.sidebarOpen &&
        !rightPanelOpen
      ) {
        panelStore.show(snapshot.threadRef);
      } else if (swipe === "toward-right" && snapshot.threadRef !== null && rightPanelOpen) {
        panelStore.close(snapshot.threadRef);
      }
    };
    document.addEventListener("touchstart", onTouchStart, { passive: true, capture: true });
    document.addEventListener("touchend", onTouchEnd, { passive: true, capture: true });
    return () => {
      document.removeEventListener("touchstart", onTouchStart, { capture: true });
      document.removeEventListener("touchend", onTouchEnd, { capture: true });
    };
  }, [isMobile, setOpenMobile]);

  return null;
}
