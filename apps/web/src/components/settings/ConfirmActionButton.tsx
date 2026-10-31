import type { ComponentProps, ReactNode } from "react";

import { ensureLocalApi } from "~/localApi";
import { Button } from "../ui/button";

/**
 * Flow: a destructive button that asks first through the app's shared confirm (`dialogs.confirm`:
 * an in-app dialog on web, the system dialog on desktop).
 */
export function ConfirmActionButton(props: {
  readonly children: ReactNode;
  /** The question, such as "Revoke this client?". */
  readonly title: string;
  readonly description: string;
  readonly onConfirm: () => void;
  readonly disabled?: boolean;
  readonly size?: ComponentProps<typeof Button>["size"];
}) {
  const ask = async () => {
    const confirmed = await ensureLocalApi().dialogs.confirm(
      `${props.title}\n${props.description}`,
      { variant: "destructive" },
    );
    if (confirmed) props.onConfirm();
  };
  return (
    <Button
      type="button"
      size={props.size ?? "xs"}
      variant="destructive-outline"
      disabled={props.disabled}
      onClick={() => void ask()}
    >
      {props.children}
    </Button>
  );
}
