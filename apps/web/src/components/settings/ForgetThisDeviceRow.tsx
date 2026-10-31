import { useState } from "react";

import { forgetThisDevice } from "~/environments/primary";
import { stackedThreadToast, toastManager } from "../ui/toast";
import { ConfirmActionButton } from "./ConfirmActionButton";
import { SettingsRow } from "./settingsLayout";

/**
 * Flow: a browser paired with a code can also forget itself, without the right to manage other
 * clients. The next load asks for a new pairing code.
 */
export function ForgetThisDeviceRow() {
  const [busy, setBusy] = useState(false);
  const forget = async () => {
    setBusy(true);
    try {
      await forgetThisDevice();
      window.location.assign("/pair");
    } catch (error) {
      setBusy(false);
      toastManager.add(
        stackedThreadToast({
          type: "error",
          title: "Could not forget this device",
          description: error instanceof Error ? error.message : undefined,
        }),
      );
    }
  };
  return (
    <SettingsRow
      title="This device"
      description="Forget this browser's pairing. Pairing it again needs a new pairing code."
      control={
        <ConfirmActionButton
          size="sm"
          disabled={busy}
          title="Forget this device?"
          description="This browser is signed out. Opening Flow here again needs a new pairing code."
          onConfirm={() => void forget()}
        >
          Forget this device
        </ConfirmActionButton>
      }
    />
  );
}
