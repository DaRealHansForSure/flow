import { describe, expect, it } from "vite-plus/test";

import { decideWindowClose, type WindowCloseRequest } from "./WindowCloseConfirmation.ts";

const USER_CLOSE_ON_LINUX: WindowCloseRequest = {
  platform: "linux",
  isAppQuitting: false,
  isSystemShuttingDown: false,
  isCloseConfirmed: false,
  isConfirmationOpen: false,
};

describe("decideWindowClose", () => {
  it.each([
    ["a user close on Linux", {}, "ask"],
    ["a user close on Windows", { platform: "win32" }, "ask"],
    ["a close on macOS, which keeps the app running", { platform: "darwin" }, "close"],
    ["the close the user just confirmed", { isCloseConfirmed: true }, "close"],
    ["a quit already under way", { isAppQuitting: true }, "close"],
    ["a system shutdown", { isSystemShuttingDown: true }, "close"],
    ["a second close while the confirmation is open", { isConfirmationOpen: true }, "keep-open"],
    [
      "a quit that starts while the confirmation is open",
      { isConfirmationOpen: true, isAppQuitting: true },
      "close",
    ],
    [
      "a shutdown that starts while the confirmation is open",
      { isConfirmationOpen: true, isSystemShuttingDown: true },
      "close",
    ],
  ] as const)("%s: %s", (_name, overrides, decision) => {
    expect(decideWindowClose({ ...USER_CLOSE_ON_LINUX, ...overrides })).toBe(decision);
  });
});
