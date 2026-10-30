import {
  deriveProposedPlanVersions,
  type PlanVersion,
} from "@t3tools/client-runtime/state/plan-versions";
import {
  CommandId,
  type EnvironmentId,
  MessageId,
  type ModelSelection,
  type PlanId,
  type ProviderInteractionMode,
  type RuntimeMode,
  type ThreadId,
} from "@t3tools/contracts";
import { buildPlanImplementationPrompt } from "@t3tools/shared/proposedPlanText";
import { createContext, useContext } from "react";
import { View } from "react-native";

import { Button } from "../../components/ui/Button";
import { ControlPill } from "../../components/ui/ControlPill";
import * as Dialog from "../../components/ui/Dialog";
import { Menu } from "../../components/ui/Menu";
import { makeTurnCommandMetadata } from "../../lib/commandMetadata";
import { useAtomCommand } from "../../state/use-atom-command";
import { threadEnvironment } from "../../state/threads";
import { RUNTIME_MODE_CHOICES } from "./thread-settings-options";

/** Flow: what can be done with the thread's open proposed plan. */
export interface MobilePlanReview {
  readonly planId: PlanId;
  readonly runtimeMode: RuntimeMode;
  readonly accept: (runtimeMode: RuntimeMode) => void;
  readonly revise: () => void;
  readonly decline: () => void;
}

interface MobilePlanReviewState {
  readonly versions: ReadonlyArray<PlanVersion>;
  readonly review: MobilePlanReview | null;
  readonly reopen: ((planId: PlanId) => void) | null;
}

const MobilePlanReviewContext = createContext<MobilePlanReviewState>({
  versions: [],
  review: null,
  reopen: null,
});

export const MobilePlanReviewProvider = MobilePlanReviewContext.Provider;

export function useMobilePlanReview(): MobilePlanReviewState {
  return useContext(MobilePlanReviewContext);
}

/**
 * Builds the review state for a thread: its plan versions, and Accept, Revise, Decline and
 * Reopen, sent straight to the server like the web app's plan actions.
 */
export function useMobilePlanReviewState(input: {
  readonly environmentId: EnvironmentId | null;
  readonly threadId: ThreadId | null;
  readonly structure: Parameters<typeof deriveProposedPlanVersions>[0];
  readonly working: boolean;
  readonly modelSelection: ModelSelection | null;
  readonly runtimeMode: RuntimeMode;
  readonly onInteractionModeChange: (mode: ProviderInteractionMode) => void;
  readonly onRuntimeModeChange: (mode: RuntimeMode) => void;
}): MobilePlanReviewState {
  const setThreadRuntimeMode = useAtomCommand(threadEnvironment.setRuntimeMode, "plan permissions");
  const setThreadInteractionMode = useAtomCommand(
    threadEnvironment.setInteractionMode,
    "plan mode",
  );
  const startTurn = useAtomCommand(threadEnvironment.startTurn, "plan answer");
  const declinePlan = useAtomCommand(threadEnvironment.declineProposedPlan, "decline plan");
  const reopenPlan = useAtomCommand(threadEnvironment.reopenProposedPlan, "reopen plan");
  const versions = deriveProposedPlanVersions(input.structure);
  const { environmentId, threadId } = input;
  if (environmentId === null || threadId === null) {
    return { versions, review: null, reopen: null };
  }
  const openPlan = input.working
    ? undefined
    : versions.findLast((version) => version.status === "active");

  const send = async (
    text: string,
    interactionMode: ProviderInteractionMode,
    runtimeMode: RuntimeMode,
    sourcePlanId?: PlanId,
  ) => {
    const metadata = makeTurnCommandMetadata();
    await setThreadRuntimeMode({ environmentId, input: { threadId, runtimeMode } });
    await setThreadInteractionMode({ environmentId, input: { threadId, interactionMode } });
    input.onRuntimeModeChange(runtimeMode);
    input.onInteractionModeChange(interactionMode);
    await startTurn({
      environmentId,
      input: {
        threadId,
        commandId: CommandId.make(metadata.commandId),
        message: {
          messageId: MessageId.make(metadata.messageId),
          role: "user",
          text,
          attachments: [],
        },
        ...(input.modelSelection === null ? {} : { modelSelection: input.modelSelection }),
        runtimeMode,
        interactionMode,
        ...(sourcePlanId === undefined
          ? {}
          : { sourceProposedPlan: { threadId, planId: sourcePlanId } }),
        createdAt: metadata.createdAt,
      },
    });
  };

  const review: MobilePlanReview | null =
    openPlan === undefined
      ? null
      : {
          planId: openPlan.id,
          runtimeMode: input.runtimeMode,
          accept: (runtimeMode) =>
            void send(
              buildPlanImplementationPrompt(openPlan.planMarkdown),
              "default",
              runtimeMode,
              openPlan.id,
            ),
          revise: () =>
            Dialog.prompt({
              title: "Revise the plan",
              message: "What should change? The agent writes a new version.",
              placeholder: "Feedback",
              initialValue: "",
              confirmText: "Revise",
              onConfirm: (feedback) => {
                if (feedback.trim().length > 0) {
                  void send(feedback.trim(), "plan", input.runtimeMode);
                }
              },
            }),
          decline: () =>
            void declinePlan({ environmentId, input: { threadId, planId: openPlan.id } }),
        };
  return {
    versions,
    review,
    reopen: input.working
      ? null
      : (planId) =>
          void reopenPlan({ environmentId, input: { threadId, planId } }).then((result) => {
            if (result._tag === "Success") {
              input.onInteractionModeChange("plan");
            }
          }),
  };
}

/** Accept (with the mode to continue in from its menu), Revise and Decline for the open plan. */
export function MobilePlanReviewActions(props: { readonly review: MobilePlanReview }) {
  const { review } = props;
  return (
    <View className="flex-row flex-wrap items-center gap-2">
      <Button label="Accept" tone="primary" onPress={() => review.accept(review.runtimeMode)} />
      <Button label="Revise" onPress={review.revise} />
      <Menu
        accessible
        accessibilityRole="button"
        accessibilityLabel="More plan actions"
        title="Accept and continue with"
        actions={[
          ...RUNTIME_MODE_CHOICES.map((choice) => ({
            id: choice.mode,
            title: choice.mode === review.runtimeMode ? `${choice.label} (current)` : choice.label,
          })),
          { id: "decline", title: "Decline", attributes: { destructive: true } },
        ]}
        onPressAction={({ nativeEvent }) => {
          if (nativeEvent.event === "decline") {
            review.decline();
            return;
          }
          const choice = RUNTIME_MODE_CHOICES.find((entry) => entry.mode === nativeEvent.event);
          if (choice) {
            review.accept(choice.mode);
          }
        }}
      >
        <ControlPill icon="ellipsis" accessibilityLabel="More plan actions" />
      </Menu>
    </View>
  );
}
