import type { PlanId, RuntimeMode } from "@t3tools/contracts";
import { ChevronDownIcon } from "lucide-react";
import { createContext, useContext } from "react";

import { Button } from "../ui/button";
import { Group, GroupSeparator } from "../ui/group";
import {
  Menu,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from "../ui/menu";
import type { PlanVersion } from "@t3tools/client-runtime/state/plan-versions";
import { runtimeModeConfig } from "./runtimeModeConfig";

/** Flow: what can be done with the chat's open proposed plan. */
export interface PlanReview {
  readonly planId: PlanId;
  /** The mode Accept continues in: the chat's own mode, kept while it planned. */
  readonly runtimeMode: RuntimeMode;
  readonly runtimeModes: ReadonlyArray<RuntimeMode>;
  readonly disabled: boolean;
  readonly accept: (runtimeMode: RuntimeMode) => void;
  readonly acceptInNewThread: () => void;
  readonly revise: () => void;
  readonly decline: () => void;
  /** Adds a comment on a passage of the plan to the composer, sent with the next Revise. */
  readonly comment: (passage: string, note: string) => void;
}

interface PlanReviewState {
  readonly versions: ReadonlyArray<PlanVersion>;
  readonly review: PlanReview | null;
  /** Makes a closed plan the open one again and switches the chat to Plan; null when unavailable. */
  readonly reopen: ((planId: PlanId) => void) | null;
}

const PlanReviewContext = createContext<PlanReviewState>({
  versions: [],
  review: null,
  reopen: null,
});

export const PlanReviewProvider = PlanReviewContext.Provider;

export function usePlanReview(): PlanReviewState {
  return useContext(PlanReviewContext);
}

/** Accept (with the mode to continue in), Revise and Decline for the open plan. */
export function PlanReviewActions(props: { readonly review: PlanReview }) {
  const { review } = props;
  return (
    <div className="flex flex-wrap items-center gap-2" data-plan-review-actions>
      <Group aria-label="Accept the plan">
        <Button
          size="sm"
          disabled={review.disabled}
          onClick={() => review.accept(review.runtimeMode)}
        >
          Accept
        </Button>
        <GroupSeparator />
        <Menu>
          <MenuTrigger
            render={
              <Button
                size="icon-sm"
                aria-label="Accept with other permissions"
                disabled={review.disabled}
              />
            }
          >
            <ChevronDownIcon className="size-3.5" />
          </MenuTrigger>
          <MenuPopup align="start">
            <MenuGroup>
              <MenuGroupLabel>Accept and continue with</MenuGroupLabel>
              {review.runtimeModes.map((mode) => {
                const option = runtimeModeConfig[mode];
                const Icon = option.icon;
                return (
                  <MenuItem key={mode} onClick={() => review.accept(mode)}>
                    <Icon aria-hidden="true" className="size-3.5" />
                    {option.label}
                    {mode === review.runtimeMode ? (
                      <span className="ms-auto text-muted-foreground text-xs">Current</span>
                    ) : null}
                  </MenuItem>
                );
              })}
            </MenuGroup>
            <MenuSeparator />
            <MenuItem onClick={review.acceptInNewThread}>Accept in a new thread</MenuItem>
          </MenuPopup>
        </Menu>
      </Group>
      <Button size="sm" variant="outline" disabled={review.disabled} onClick={review.revise}>
        Revise
      </Button>
      <Button size="sm" variant="ghost-muted" disabled={review.disabled} onClick={review.decline}>
        Decline
      </Button>
    </div>
  );
}
