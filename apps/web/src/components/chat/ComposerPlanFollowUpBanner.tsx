import { memo } from "react";
import { Button } from "../ui/button";
import { ComposerBanner } from "./ComposerBanner";

export const ComposerPlanFollowUpBanner = memo(function ComposerPlanFollowUpBanner({
  planTitle,
  onNewMessage,
}: {
  planTitle: string | null;
  /** Flow: the next message goes out as typed instead of revising this plan. */
  onNewMessage?: (() => void) | undefined;
}) {
  return (
    <ComposerBanner.Row>
      <ComposerBanner.Icon />
      <ComposerBanner.Content>
        <span className="shrink-0 font-medium text-muted-foreground">Plan ready</span>
        {planTitle ? (
          <span className="min-w-0 flex-1 truncate text-foreground/85">{planTitle}</span>
        ) : null}
      </ComposerBanner.Content>
      {onNewMessage ? (
        <ComposerBanner.Actions>
          <Button size="xs" variant="ghost" onClick={onNewMessage}>
            New message
          </Button>
        </ComposerBanner.Actions>
      ) : null}
    </ComposerBanner.Row>
  );
});
