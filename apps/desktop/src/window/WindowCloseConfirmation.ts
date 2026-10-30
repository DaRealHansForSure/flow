// Flow: asks before closing the main window quits the app.
import * as Electron from "electron";

const QUIT_BUTTON_INDEX = 0;
const CANCEL_BUTTON_INDEX = 1;

/** What a close request on the main window should do. */
export type WindowCloseDecision = "close" | "ask" | "keep-open";

export interface WindowCloseRequest {
  readonly platform: NodeJS.Platform;
  readonly isAppQuitting: boolean;
  readonly isSystemShuttingDown: boolean;
  readonly isCloseConfirmed: boolean;
  readonly isConfirmationOpen: boolean;
}

/**
 * Decides whether a close request may proceed, needs the user's confirmation, or must wait
 * for a confirmation that is already open.
 */
export function decideWindowClose(request: WindowCloseRequest): WindowCloseDecision {
  // A quit that is already under way was confirmed by its own path (quit shortcut,
  // updater, signal) and destroys the windows itself; a shutdown must never be held up.
  if (request.isCloseConfirmed || request.isAppQuitting || request.isSystemShuttingDown) {
    return "close";
  }
  if (request.isConfirmationOpen) {
    return "keep-open";
  }
  // macOS keeps the app running without windows, so closing the window ends nothing.
  // Elsewhere the main window's dependents (preview popouts) close with it and the app quits.
  if (request.platform === "darwin") {
    return "close";
  }
  return "ask";
}

export interface WindowCloseConfirmationOptions {
  readonly platform: NodeJS.Platform;
  readonly appName: string;
  readonly isAppQuitting: () => boolean;
  /** Resolves to the `confirmWindowClose` client setting; never rejects. */
  readonly isConfirmationEnabled: () => Promise<boolean>;
  /** Saves `confirmWindowClose: false`; never rejects. */
  readonly disableConfirmation: () => Promise<void>;
}

/**
 * Returns the main window's "close" handler, which holds the close until the user confirms
 * that quitting the app is intended.
 */
export function makeWindowCloseHandler(
  window: Electron.BrowserWindow,
  options: WindowCloseConfirmationOptions,
): (event: { preventDefault: () => void }) => void {
  let isCloseConfirmed = false;
  let isConfirmationOpen = false;
  let isSystemShuttingDown = false;

  const markSystemShuttingDown = () => {
    isSystemShuttingDown = true;
  };
  // Windows ends a session through these window events. Linux sends SIGTERM, which starts
  // the app's own quit, and macOS never asks, so neither needs a shutdown flag.
  window.on("query-session-end", markSystemShuttingDown);
  window.on("session-end", markSystemShuttingDown);

  const askToQuit = async (): Promise<boolean> => {
    if (!(await options.isConfirmationEnabled())) {
      return true;
    }
    if (window.isDestroyed()) {
      return false;
    }
    const { response, checkboxChecked } = await Electron.dialog.showMessageBox(window, {
      type: "question",
      title: options.appName,
      message: `Quit ${options.appName}?`,
      detail: `Closing this window quits ${options.appName}.`,
      buttons: ["Quit", "Cancel"],
      defaultId: CANCEL_BUTTON_INDEX,
      cancelId: CANCEL_BUTTON_INDEX,
      checkboxLabel: "Don't ask again",
      checkboxChecked: false,
      noLink: true,
    });
    if (response !== QUIT_BUTTON_INDEX) {
      return false;
    }
    if (checkboxChecked) {
      await options.disableConfirmation();
    }
    return true;
  };

  const closeAfterConfirmation = async () => {
    isConfirmationOpen = true;
    // A dialog that cannot be shown must not leave the window impossible to close.
    const shouldClose = await askToQuit().catch(() => true);
    isConfirmationOpen = false;
    if (!shouldClose || window.isDestroyed()) {
      return;
    }
    isCloseConfirmed = true;
    window.close();
  };

  return (event) => {
    const decision = decideWindowClose({
      platform: options.platform,
      isAppQuitting: options.isAppQuitting(),
      isSystemShuttingDown,
      isCloseConfirmed,
      isConfirmationOpen,
    });
    if (decision === "close") {
      return;
    }
    event.preventDefault();
    if (decision === "ask") {
      void closeAfterConfirmation();
    }
  };
}
