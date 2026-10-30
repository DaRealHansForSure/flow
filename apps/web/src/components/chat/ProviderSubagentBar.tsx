import {
  formatProviderSubagentStatus,
  type ProviderSubagentStatus,
} from "@t3tools/client-runtime/state/thread-execution";
import { isOrchestrationV2WorkActive } from "@t3tools/contracts";
import { ArrowUpLeftIcon } from "lucide-react";

import { tickTextContent } from "~/lib/tickTextContent";
import type { ProviderInstanceEntry } from "../../providerInstances";
import { Button } from "../ui/button";
import { ProviderInstanceIcon } from "./ProviderInstanceIcon";

export function ProviderSubagentBar(props: {
  readonly provider: ProviderInstanceEntry | null;
  readonly showInstanceBadge: boolean;
  readonly modelLabel: string;
  readonly effortLabel: string | null;
  readonly status: ProviderSubagentStatus | null;
  readonly onOpenParent: (() => void) | null;
}) {
  const { status } = props;
  const live = status !== null && isOrchestrationV2WorkActive(status.status);
  const modelDescription =
    props.effortLabel === null ? props.modelLabel : `${props.modelLabel}, ${props.effortLabel}`;
  const announcement = formatProviderSubagentStatus(
    status === null ? null : { ...status, startedAt: null },
    0,
  );

  // Sized by the composer, not the viewport: a docked side panel narrows the
  // chat column on a wide window, and one row there squeezes out the model
  // and status, so the status drops to its own line instead.
  return (
    <div className="flex min-h-12 items-center gap-3 rounded-2xl py-2 ps-5 pe-2 text-sm">
      <div className="flex min-w-0 flex-1 items-center gap-3 @max-[560px]/composer-surface:flex-col @max-[560px]/composer-surface:items-start @max-[560px]/composer-surface:gap-1.5">
        <span className="flex min-w-0 max-w-full items-center gap-2">
          {props.provider ? (
            <ProviderInstanceIcon
              driverKind={props.provider.driverKind}
              displayName={props.provider.displayName}
              accentColor={props.provider.accentColor}
              acpRegistryAgentId={props.provider.acpRegistryAgentId}
              acpRegistryIconUrl={props.provider.acpRegistryIconUrl}
              showBadge={props.showInstanceBadge}
              className="size-4 shrink-0"
              iconClassName="size-4"
              badgeClassName="right-[-0.125rem] bottom-[-0.125rem] h-3 min-w-3 px-0.5 text-5xs"
            />
          ) : null}
          <span className="min-w-0 truncate font-medium text-foreground">{props.modelLabel}</span>
          {props.effortLabel === null ? null : (
            <span className="shrink-0 text-muted-foreground">{props.effortLabel}</span>
          )}
        </span>
        {/* Flow: the status reads as a chip, like the composer's other controls. */}
        <span
          aria-hidden
          className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full border border-border bg-background/60 px-2.5 py-0.5 text-muted-foreground text-xs"
        >
          <span
            className={
              live
                ? "size-1.5 shrink-0 rounded-full bg-info"
                : "size-1.5 shrink-0 rounded-full bg-muted-foreground/50"
            }
          />
          <span
            ref={tickTextContent((nowMs) => formatProviderSubagentStatus(status, nowMs), live)}
            className="min-w-0 truncate tabular-nums"
          />
        </span>
      </div>
      <span role="status" className="sr-only">
        {`${modelDescription} subagent: ${announcement}`}
      </span>
      <span className="shrink-0 text-muted-foreground @max-[640px]/composer-surface:sr-only">
        Runs on its own
      </span>
      {props.onOpenParent ? (
        <Button size="sm" variant="outline" onClick={props.onOpenParent}>
          <ArrowUpLeftIcon />
          <span className="@max-[320px]/composer-surface:sr-only">Open parent</span>
        </Button>
      ) : null}
    </div>
  );
}
