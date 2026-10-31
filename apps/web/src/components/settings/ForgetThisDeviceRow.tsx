import { useState } from "react";

import { forgetThisDevice } from "~/environments/primary";
import { Button } from "../ui/button";
import { stackedThreadToast, toastManager } from "../ui/toast";
import { SettingsRow } from "./settingsLayout";

/**
 * Flow: a browser paired with a code can also forget itself, without the right to manage other
 * clients. The next load asks for a new pairing code.
 */
export function ForgetThisDeviceRow() {
  const [busy, setBusy] = useState(false);
  const forget = async () => {
    if (
      !window.confirm("Forget this device? Opening Flow here again asks for a new pairing code.")
    ) {
      return;
    }
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
        <Button
          type="button"
          size="sm"
          variant="destructive-outline"
          disabled={busy}
          onClick={() => void forget()}
        >
          Forget this device
        </Button>
      }
    />
  );
}
