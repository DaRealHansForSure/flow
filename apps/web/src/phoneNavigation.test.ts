import { describe, expect, it } from "vite-plus/test";

import {
  classifyEdgeSwipe,
  isAppPath,
  isPhoneScreenPath,
  phoneBackAction,
  type PhoneBackState,
} from "./phoneNavigation";

const CLOSED: PhoneBackState = {
  popupOpen: false,
  screenOpen: false,
  rightPanelOpen: false,
  sidebarOpen: false,
  hasParentChat: false,
};

describe("phoneBackAction", () => {
  it.each([
    [{ popupOpen: true, screenOpen: true, rightPanelOpen: true }, "close-popup"],
    [{ screenOpen: true, rightPanelOpen: true }, "close-screen"],
    [{ rightPanelOpen: true }, "close-right-panel"],
    [{ sidebarOpen: true }, "close-sidebar"],
    [{ sidebarOpen: true, hasParentChat: true }, "close-sidebar"],
    [{ rightPanelOpen: true, hasParentChat: true }, "close-right-panel"],
    [{ hasParentChat: true }, "open-parent-chat"],
    [{}, "open-sidebar"],
  ] as const)("%o gives %s", (open, action) => {
    expect(phoneBackAction({ ...CLOSED, ...open })).toBe(action);
  });
});

describe("isAppPath", () => {
  it.each([
    ["/env-1/thread-1?tab=plan", true],
    ["/", true],
    ["https://example.com/", false],
    ["//example.com/", false],
    ["/\\example.com/", false],
    ["javascript:alert(1)", false],
    [null, false],
  ] as const)("%s is an app path: %s", (href, expected) => {
    expect(isAppPath(href)).toBe(expected);
  });
});

describe("isPhoneScreenPath", () => {
  it.each([
    ["/settings/general", true],
    ["/settings", true],
    ["/brain", true],
    ["/projects/abc", true],
    ["/env-1/thread-1", false],
    ["/brainstorm", false],
    ["/", false],
  ] as const)("%s is a screen: %s", (pathname, expected) => {
    expect(isPhoneScreenPath(pathname)).toBe(expected);
  });
});

describe("classifyEdgeSwipe", () => {
  const swipe = (startX: number, deltaX: number, deltaY = 0) =>
    classifyEdgeSwipe({ startX, deltaX, deltaY, screenWidth: 400 });

  it.each([
    [10, 80, 0, "from-left-edge"],
    [390, -80, 0, "from-right-edge"],
    [200, -80, 0, "toward-left"],
    [200, 80, 0, "toward-right"],
    [10, 40, 0, null],
    [10, 80, 60, null],
    [30, 80, 0, "toward-right"],
  ] as const)("start %d, dx %d, dy %d gives %s", (startX, deltaX, deltaY, expected) => {
    expect(swipe(startX, deltaX, deltaY)).toBe(expected);
  });
});
