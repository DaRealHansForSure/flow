import {
  memo,
  type MouseEventHandler,
  type PointerEvent as ReactPointerEvent,
  type PointerEventHandler,
} from "react";
import { CheckIcon, ChevronDownIcon, ChevronLeftIcon, Minimize2Icon, PlayIcon } from "lucide-react";
import { CornerUpRight, ListPlus } from "lucide";
import { MorphIcon } from "~/components/MorphIcon";
import { useEnvironmentIdentificationMode } from "~/hooks/useSettings";
import { formatContextWindowTokens } from "~/lib/contextWindow";
import { cn, isMacPlatform } from "~/lib/utils";
import { useShortcutModifierState } from "../../shortcutModifierState";
import { StageBackdropButtonArt, useSidebarStageBackdropVariant } from "../SidebarStageBackdrop";
import { Button } from "../ui/button";
import {
  Menu,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from "../ui/menu";
import { Spinner } from "../ui/spinner";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { composerFloatingLayerProps } from "./composerEventScope";
import { useSendFollowUpMenu } from "./useSendFollowUpMenu";
import { usePlanReview } from "./planReview";
import { runtimeModeConfig } from "./runtimeModeConfig";
import {
  alternateComposerDispatchAction,
  resolveComposerDispatchMode,
} from "@t3tools/client-runtime/state/composer-dispatch";

interface PendingActionState {
  questionIndex: number;
  isLastQuestion: boolean;
  canAdvance: boolean;
  isResponding: boolean;
  isComplete: boolean;
}

interface ComposerPrimaryActionsProps {
  compact: boolean;
  canOperateThread: boolean;
  pendingAction: PendingActionState | null;
  isRunning: boolean;
  canInterrupt: boolean;
  followUpBehavior?: "queue" | "steer";
  canSteer?: boolean;
  alternateShortcutLabel?: string | null;
  showPlanFollowUpPrompt: boolean;
  promptHasText: boolean;
  isSendBusy: boolean;
  sendDisabledReason: string | null;
  isEnvironmentUnavailable: boolean;
  isPreparingWorktree: boolean;
  hasSendableContent: boolean;
  canResume?: boolean;
  preserveComposerFocusOnPointerDown?: boolean;
  isEditingQueuedMessage?: boolean;
  onSubmitMessage?: MouseEventHandler<HTMLButtonElement>;
  /** Flow: sends with an explicit follow-up choice from the long-press menu. */
  onSendWithMode?: (mode: "steer" | "queue") => void;
  onResume?: () => void;
  onPreviousPendingQuestion: () => void;
  onInterrupt: () => void;
  onImplementPlanInNewThread: () => void;
  compactBeforeSendTokens?: number | null;
  keepFullHistory?: boolean;
  onToggleKeepFullHistory?: () => void;
}

const formatPendingPrimaryActionLabel = (input: {
  compact: boolean;
  isLastQuestion: boolean;
  isResponding: boolean;
  questionIndex: number;
}) => {
  if (input.isResponding) {
    return "Submitting...";
  }
  if (input.compact) {
    return input.isLastQuestion ? "Submit" : "Next";
  }
  if (!input.isLastQuestion) {
    return "Next question";
  }
  return input.questionIndex > 0 ? "Submit answers" : "Submit answer";
};

const messageActionPillClassName =
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-message-action font-medium text-base text-message-action-foreground shadow-xs shadow-message-action/24 outline-none hover:bg-message-action-hover focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-64 disabled:shadow-none sm:text-sm";

const preventPointerFocus: PointerEventHandler<HTMLElement> = (event) => {
  event.preventDefault();
};

export const ComposerPrimaryActions = memo(function ComposerPrimaryActions({
  compact,
  canOperateThread,
  pendingAction,
  isRunning,
  canInterrupt,
  followUpBehavior = "steer",
  canSteer = true,
  alternateShortcutLabel = null,
  showPlanFollowUpPrompt,
  promptHasText,
  isSendBusy,
  sendDisabledReason,
  isEnvironmentUnavailable,
  isPreparingWorktree,
  hasSendableContent,
  canResume = false,
  preserveComposerFocusOnPointerDown = false,
  isEditingQueuedMessage = false,
  onSubmitMessage,
  onSendWithMode,
  onResume,
  onPreviousPendingQuestion,
  onInterrupt,
  onImplementPlanInNewThread,
  compactBeforeSendTokens = null,
  keepFullHistory = false,
  onToggleKeepFullHistory,
}: ComposerPrimaryActionsProps) {
  const { review: planReview } = usePlanReview();
  const {
    open: followUpMenuOpen,
    setOpen: setFollowUpMenuOpen,
    anchor: followUpMenuAnchor,
    setAnchor: setFollowUpMenuAnchor,
    onPointerDown: startFollowUpPress,
    onContextMenu: openFollowUpFromContextMenu,
    cancelPress: cancelFollowUpPress,
    consumeLongPress: consumeFollowUpLongPress,
  } = useSendFollowUpMenu();
  const pointerFocusProps = preserveComposerFocusOnPointerDown
    ? { onPointerDown: preventPointerFocus }
    : undefined;
  const environmentIdentificationMode = useEnvironmentIdentificationMode();
  const shortcutModifiers = useShortcutModifierState();
  const isQueuing =
    !isEditingQueuedMessage &&
    resolveComposerDispatchMode({
      running: isRunning,
      activeTurnDefault: followUpBehavior,
      canSteer,
      alternateModifier: shortcutModifiers.metaKey || shortcutModifiers.ctrlKey,
    }) === "queue";
  const alternateAction = alternateComposerDispatchAction(followUpBehavior);
  const isSendDisabled = !canOperateThread || sendDisabledReason !== null;
  const stageBackdropVariant = useSidebarStageBackdropVariant(environmentIdentificationMode);

  const renderStopGenerationButton = (insidePendingAction: boolean) => (
    <Tooltip key="interrupt">
      <TooltipTrigger
        render={
          <button
            type="button"
            className={cn(
              "flex shrink-0 cursor-pointer items-center justify-center rounded-full bg-destructive/90 text-white shadow-xs shadow-destructive/24 inset-shadow-control-highlight transition-colors duration-150 hover:bg-destructive active:inset-shadow-control-pressed active:shadow-none [&_svg]:pointer-events-none",
              // Flow: as big as the send button, so the row keeps its height when text arrives.
              insidePendingAction ? "size-8 sm:size-7" : "size-9 sm:size-8",
            )}
            {...pointerFocusProps}
            disabled={!canOperateThread}
            onClick={() => {
              if (canOperateThread) onInterrupt();
            }}
            aria-label="Stop generation"
            data-composer-primary-action={insidePendingAction ? undefined : ""}
          />
        }
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
          <rect x="2" y="2" width="8" height="8" rx="1.5" />
        </svg>
      </TooltipTrigger>
      <TooltipPopup>Interrupt</TooltipPopup>
    </Tooltip>
  );

  if (pendingAction) {
    return (
      <div className={cn("flex items-center justify-end", compact ? "gap-1.5" : "gap-2")}>
        {canInterrupt ? renderStopGenerationButton(true) : null}
        {pendingAction.questionIndex > 0 ? (
          compact ? (
            <Button
              size="icon-sm"
              variant="outline"
              {...pointerFocusProps}
              onClick={onPreviousPendingQuestion}
              disabled={pendingAction.isResponding}
              aria-label="Previous question"
            >
              <ChevronLeftIcon className="size-3.5" />
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              {...pointerFocusProps}
              onClick={onPreviousPendingQuestion}
              disabled={pendingAction.isResponding}
            >
              Previous
            </Button>
          )
        ) : null}
        <button
          type="submit"
          className={cn(messageActionPillClassName, "h-8 sm:h-7", compact ? "px-3" : "px-4")}
          {...pointerFocusProps}
          disabled={
            !canOperateThread ||
            isEnvironmentUnavailable ||
            pendingAction.isResponding ||
            (pendingAction.isLastQuestion ? !pendingAction.isComplete : !pendingAction.canAdvance)
          }
        >
          {formatPendingPrimaryActionLabel({
            compact,
            isLastQuestion: pendingAction.isLastQuestion,
            isResponding: pendingAction.isResponding,
            questionIndex: pendingAction.questionIndex,
          })}
        </button>
      </div>
    );
  }

  if (showPlanFollowUpPrompt && (promptHasText || !canResume)) {
    if (promptHasText) {
      return (
        <button
          type="submit"
          className={cn(messageActionPillClassName, "h-9 sm:h-8", compact ? "px-3" : "px-4")}
          {...pointerFocusProps}
          disabled={isSendBusy || isSendDisabled || isEnvironmentUnavailable}
        >
          {isSendBusy ? "Sending..." : "Revise"}
        </button>
      );
    }

    return (
      <div data-chat-composer-implement-actions="true" className="flex items-center justify-end">
        <button
          type="submit"
          className={cn(messageActionPillClassName, "h-9 rounded-r-none px-4 sm:h-8")}
          {...pointerFocusProps}
          disabled={isSendBusy || isSendDisabled || isEnvironmentUnavailable}
        >
          {isSendBusy ? "Sending..." : "Accept"}
        </button>
        <Menu>
          <MenuTrigger
            render={
              <button
                type="button"
                className={cn(
                  messageActionPillClassName,
                  "h-9 rounded-l-none border-l border-message-action-foreground/20 px-2 sm:h-8",
                )}
                aria-label="Accept with other permissions"
                onMouseDown={
                  preserveComposerFocusOnPointerDown ? (event) => event.preventDefault() : undefined
                }
                disabled={isSendBusy || isSendDisabled || isEnvironmentUnavailable}
              />
            }
          >
            <ChevronDownIcon className="size-3.5" />
          </MenuTrigger>
          <MenuPopup align="end" side="top" {...composerFloatingLayerProps}>
            {planReview !== null ? (
              <>
                <MenuGroup>
                  <MenuGroupLabel>Accept and continue with</MenuGroupLabel>
                  {planReview.runtimeModes.map((mode) => {
                    const option = runtimeModeConfig[mode];
                    const Icon = option.icon;
                    return (
                      <MenuItem
                        key={mode}
                        disabled={isSendBusy || isSendDisabled || isEnvironmentUnavailable}
                        onClick={() => {
                          if (canOperateThread) planReview.accept(mode);
                        }}
                      >
                        <Icon aria-hidden="true" className="size-3.5" />
                        {option.label}
                        {mode === planReview.runtimeMode ? (
                          <span className="ms-auto text-muted-foreground text-xs">Current</span>
                        ) : null}
                      </MenuItem>
                    );
                  })}
                </MenuGroup>
                <MenuSeparator />
              </>
            ) : null}
            <MenuItem
              disabled={isSendBusy || isSendDisabled || isEnvironmentUnavailable}
              onClick={() => {
                if (canOperateThread) onImplementPlanInNewThread();
              }}
            >
              Accept in a new thread
            </MenuItem>
            {planReview !== null ? (
              <MenuItem
                disabled={isSendBusy || isEnvironmentUnavailable}
                onClick={() => {
                  if (canOperateThread) planReview.decline();
                }}
              >
                Decline
              </MenuItem>
            ) : null}
          </MenuPopup>
        </Menu>
      </div>
    );
  }

  if (canInterrupt && !hasSendableContent && !isEditingQueuedMessage) {
    return renderStopGenerationButton(false);
  }

  const showResume = canResume && !hasSendableContent && !isEditingQueuedMessage;

  const compactTokens =
    compactBeforeSendTokens !== null && !showResume && !isEditingQueuedMessage
      ? formatContextWindowTokens(compactBeforeSendTokens)
      : null;
  const compactsBeforeSend = compactTokens !== null && !keepFullHistory;

  const submitLabel = showResume
    ? "Resume thread"
    : isEditingQueuedMessage
      ? "Update queued message"
      : compactsBeforeSend
        ? "Compact and send"
        : isQueuing
          ? "Queue message"
          : isRunning
            ? "Steer message"
            : "Submit message";
  const submitStatus = isEnvironmentUnavailable
    ? "Environment disconnected"
    : (sendDisabledReason ??
      (isPreparingWorktree
        ? "Preparing worktree"
        : isSendBusy
          ? isEditingQueuedMessage
            ? "Updating queued message"
            : "Submitting message"
          : null));
  const submitTooltip =
    submitStatus ??
    (compactsBeforeSend
      ? `Summarize ${compactTokens} tokens of history, then send`
      : isRunning && !isEditingQueuedMessage && canSteer
        ? `Click to ${followUpBehavior}, ${isMacPlatform(navigator.platform) ? "⌘" : "Ctrl"}-click${alternateShortcutLabel ? ` or ${alternateShortcutLabel}` : ""} to ${alternateAction}`
        : submitLabel);

  const offersFollowUpChoice =
    onSendWithMode !== undefined &&
    isRunning &&
    canSteer &&
    hasSendableContent &&
    !isEditingQueuedMessage &&
    !showResume &&
    !isSendBusy &&
    !isSendDisabled &&
    !isEnvironmentUnavailable;

  const sendButtonDisabled =
    isSendBusy ||
    isSendDisabled ||
    isEnvironmentUnavailable ||
    (!hasSendableContent && !showResume);
  const sendButton = (
    <button
      ref={setFollowUpMenuAnchor}
      type={showResume ? "button" : "submit"}
      data-composer-primary-action=""
      className={cn(
        "relative isolate flex h-9 w-9 select-none items-center justify-center overflow-hidden rounded-full shadow-xs [-webkit-touch-callout:none] transition-all duration-150 enabled:cursor-pointer enabled:inset-shadow-control-highlight hover:scale-105 active:inset-shadow-control-pressed active:shadow-none disabled:pointer-events-none disabled:shadow-none disabled:hover:scale-100 sm:h-8 sm:w-8 [&_svg]:pointer-events-none",
        stageBackdropVariant
          ? "bg-transparent text-white enabled:shadow-black/24 enabled:hover:brightness-110 disabled:bg-foreground/12 disabled:text-muted-foreground"
          : "bg-message-action text-message-action-foreground enabled:shadow-message-action/24 hover:bg-message-action-hover disabled:bg-foreground/12 disabled:text-muted-foreground",
      )}
      {...pointerFocusProps}
      onPointerDown={(event: ReactPointerEvent<HTMLButtonElement>) => {
        pointerFocusProps?.onPointerDown(event);
        if (offersFollowUpChoice) startFollowUpPress(event);
      }}
      onPointerUp={() => cancelFollowUpPress()}
      onPointerLeave={() => cancelFollowUpPress()}
      onPointerCancel={() => cancelFollowUpPress()}
      onContextMenu={(event) => {
        if (offersFollowUpChoice) openFollowUpFromContextMenu(event);
      }}
      onClick={(event) => {
        // The press that opened the Steer / Queue menu must not send as well.
        if (offersFollowUpChoice && consumeFollowUpLongPress()) {
          event.preventDefault();
          return;
        }
        if (showResume) onResume?.();
        else onSubmitMessage?.(event);
      }}
      disabled={sendButtonDisabled}
      aria-label={submitStatus ?? submitLabel}
    >
      {/* Flow: the art marks a ready button; a disabled one stays plain grey. */}
      {stageBackdropVariant && !sendButtonDisabled ? (
        <span className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
          <StageBackdropButtonArt variant={stageBackdropVariant} />
        </span>
      ) : null}
      {isSendBusy ? (
        <Spinner size="sm" aria-hidden="true" />
      ) : showResume ? (
        <PlayIcon className="size-4 fill-current" aria-hidden="true" />
      ) : isEditingQueuedMessage ? (
        <CheckIcon className="size-4" aria-hidden="true" />
      ) : isRunning ? (
        <MorphIcon className="size-4" icon={isQueuing ? ListPlus : CornerUpRight} />
      ) : (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path
            d="M7 11.5V2.5M7 2.5L3 6.5M7 2.5L11 6.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );

  const followUpChoices = [
    { mode: "steer", title: "Steer now", subtitle: "Interrupt what the agent is doing" },
    { mode: "queue", title: "Queue", subtitle: "Run after the current turn" },
  ] as const;
  const submit = (
    <>
      <Tooltip key="submit">
        <TooltipTrigger render={<span className="inline-flex" />}>{sendButton}</TooltipTrigger>
        <TooltipPopup>{submitTooltip}</TooltipPopup>
      </Tooltip>
      {offersFollowUpChoice ? (
        <Menu open={followUpMenuOpen} onOpenChange={setFollowUpMenuOpen}>
          <MenuPopup
            anchor={followUpMenuAnchor}
            side="top"
            align="end"
            aria-label="Choose how to send this message"
            {...composerFloatingLayerProps}
          >
            {followUpChoices.map((choice) => (
              <MenuItem
                key={choice.mode}
                onClick={() => {
                  setFollowUpMenuOpen(false);
                  onSendWithMode?.(choice.mode);
                }}
              >
                <span className="flex flex-col">
                  <span>{choice.title}</span>
                  <span className="text-muted-foreground text-xs">{choice.subtitle}</span>
                </span>
                {choice.mode === followUpBehavior ? (
                  <CheckIcon className="ms-auto size-4" aria-hidden />
                ) : null}
              </MenuItem>
            ))}
          </MenuPopup>
        </Menu>
      ) : null}
    </>
  );
  if (compactTokens === null) return submit;

  return (
    <div data-chat-composer-compact-send="true" className="flex items-center gap-2">
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              className="flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-(--control-radius) px-2 font-medium text-base text-foreground/80 tabular-nums outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-64 sm:text-sm aria-pressed:bg-accent/60 aria-pressed:text-foreground [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:text-muted-foreground"
              {...pointerFocusProps}
              aria-pressed={!keepFullHistory}
              aria-label={`Compact ${compactTokens} tokens of history before sending`}
              disabled={!canOperateThread}
              onClick={onToggleKeepFullHistory}
            />
          }
        >
          <Minimize2Icon aria-hidden="true" />
          <span className="@max-[480px]/composer-surface:hidden">
            {keepFullHistory ? "Keep" : "Compact"}
          </span>
          <span className="text-muted-foreground">{compactTokens}</span>
        </TooltipTrigger>
        <TooltipPopup>
          <div>
            {keepFullHistory
              ? `Next send keeps all ${compactTokens} tokens.`
              : `Next send compacts ${compactTokens} tokens first.`}
          </div>
          <div>{keepFullHistory ? "Click to compact first" : "Click to keep full history"}</div>
        </TooltipPopup>
      </Tooltip>
      {submit}
    </div>
  );
});
