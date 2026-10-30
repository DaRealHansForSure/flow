import { useRef, useState, type MouseEvent, type PointerEvent } from "react";

const LONG_PRESS_MS = 500;

/**
 * Flow: a long press on the send button opens the Steer / Queue menu, as in the mobile app.
 * Chrome on Android turns that long press into a contextmenu followed by pointercancel, so the
 * contextmenu itself opens the menu (and suppresses the browser's), and a cancel never closes it.
 * A right-click on desktop opens the same menu.
 */
export function useSendFollowUpMenu() {
  const [open, setOpen] = useState(false);
  // State, not a ref: the menu reads the anchor element during render.
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const press = useRef<{ timer: number | null; opened: boolean }>({ timer: null, opened: false });

  const clearTimer = () => {
    if (press.current.timer === null) return;
    window.clearTimeout(press.current.timer);
    press.current.timer = null;
  };
  const openMenu = () => {
    clearTimer();
    press.current.opened = true;
    setOpen(true);
  };

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    clearTimer();
    press.current.opened = false;
    press.current.timer = window.setTimeout(openMenu, LONG_PRESS_MS);
  };
  const onContextMenu = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    openMenu();
  };

  /** True once when the press that just ended opened the menu, so its click does not send too. */
  const consumeLongPress = () => {
    const opened = press.current.opened;
    press.current.opened = false;
    return opened;
  };

  return {
    open,
    setOpen,
    anchor,
    setAnchor,
    onPointerDown,
    onContextMenu,
    cancelPress: clearTimer,
    consumeLongPress,
  };
}
