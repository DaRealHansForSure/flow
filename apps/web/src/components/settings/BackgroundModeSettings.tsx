import { BRAND } from "@t3tools/shared/branding";
import { useState } from "react";

import { desktopBackgroundModeAtom } from "~/state/desktopBackgroundMode";
import { useEnvironmentQuery } from "~/state/query";
import { SettingResetButton, SettingsRow } from "./settingsLayout";
import { searchableSetting } from "./settingsSearch";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";

const DESCRIPTION = `Off: ${BRAND.name} runs only while the app is open, and quitting ends running chats. On: a background service keeps chats running after you close the app, for your phone and other devices too.`;

interface SwitchQuestion {
  readonly title: string;
  readonly description: string;
  readonly confirmLabel: string;
}

function describeSwitchQuestion(runInBackground: boolean): SwitchQuestion {
  if (runInBackground) {
    return {
      title: `Keep ${BRAND.name} running in the background?`,
      description: `${BRAND.name} restarts and moves to its background service, setting it up if this machine has none. Running chats end during the restart.`,
      confirmLabel: "Switch and restart",
    };
  }
  return {
    title: "Stop the background service?",
    description: `${BRAND.name} stops the background service, turns off its autostart and restarts. It then runs only while the app is open. Running chats end. The service stays installed, so you can turn this back on.`,
    confirmLabel: "Switch and restart",
  };
}

/**
 * Flow: the switch between app-only (the default) and the background service.
 * The desktop picks the mode once per launch, so a change restarts the app.
 */
export function BackgroundModeSettingsRow({
  runInBackground,
  defaultRunInBackground,
  onRunInBackgroundChange,
}: {
  readonly runInBackground: boolean;
  readonly defaultRunInBackground: boolean;
  readonly onRunInBackgroundChange: (runInBackground: boolean) => void;
}) {
  const bridge = typeof window === "undefined" ? undefined : window.desktopBridge;
  const query = useEnvironmentQuery(
    bridge?.getBackgroundMode === undefined ? null : desktopBackgroundModeAtom,
  );
  const [pendingTarget, setPendingTarget] = useState<boolean | null>(null);
  const [isSwitching, setIsSwitching] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);

  const mode = query.data;
  const canSwitch = mode?.canSwitch === true && bridge?.switchBackgroundMode !== undefined;
  const isRunningInBackground = mode?.activeMode === "attach";
  const needsRestart =
    canSwitch && mode?.activeMode !== null && isRunningInBackground !== runInBackground;

  const requestChange = (target: boolean) => {
    if (!canSwitch) {
      onRunInBackgroundChange(target);
      return;
    }
    setSwitchError(null);
    setPendingTarget(target);
  };

  const confirmChange = async (target: boolean) => {
    const switchMode = bridge?.switchBackgroundMode;
    if (!switchMode) {
      return;
    }
    onRunInBackgroundChange(target);
    setIsSwitching(true);
    try {
      // On success the app relaunches, so only a failure comes back here.
      const result = await switchMode(target);
      if (!result.ok) {
        setSwitchError(result.detail ?? "The switch did not complete.");
      }
    } catch (cause) {
      setSwitchError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setIsSwitching(false);
      setPendingTarget(null);
    }
  };

  let status: string | null = null;
  if (switchError !== null) {
    status = switchError;
  } else if (mode !== null && mode !== undefined && !mode.canSwitch) {
    status = "This build always runs its own server.";
  } else if (needsRestart) {
    status = `Restart ${BRAND.name} to apply.`;
  }

  const question = pendingTarget === null ? null : describeSwitchQuestion(pendingTarget);

  return (
    <>
      <SettingsRow
        {...searchableSetting("run-in-background")}
        description={DESCRIPTION}
        status={
          status === null ? null : (
            <span className="flex items-center gap-2 text-muted-foreground">
              {status}
              {needsRestart && switchError === null ? (
                <Button
                  size="xs"
                  variant="outline"
                  disabled={isSwitching}
                  onClick={() => requestChange(runInBackground)}
                >
                  Restart now
                </Button>
              ) : null}
            </span>
          )
        }
        resetAction={
          runInBackground !== defaultRunInBackground ? (
            <SettingResetButton
              label="background mode"
              onClick={() => requestChange(defaultRunInBackground)}
            />
          ) : null
        }
        control={
          <Switch
            checked={runInBackground}
            disabled={isSwitching}
            onCheckedChange={(checked) => requestChange(Boolean(checked))}
            aria-label={`Keep ${BRAND.name} running in the background`}
          />
        }
      />
      <AlertDialog
        open={question !== null}
        onOpenChange={(open) => {
          if (!open && !isSwitching) {
            setPendingTarget(null);
          }
        }}
      >
        <AlertDialogPopup>
          <AlertDialogHeader>
            <AlertDialogTitle>{question?.title}</AlertDialogTitle>
            <AlertDialogDescription>{question?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose
              disabled={isSwitching}
              render={<Button variant="outline" disabled={isSwitching} />}
            >
              Cancel
            </AlertDialogClose>
            <Button
              variant="destructive"
              disabled={isSwitching}
              onClick={() => {
                if (pendingTarget !== null) {
                  void confirmChange(pendingTarget);
                }
              }}
            >
              {isSwitching ? "Switching…" : question?.confirmLabel}
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>
    </>
  );
}
