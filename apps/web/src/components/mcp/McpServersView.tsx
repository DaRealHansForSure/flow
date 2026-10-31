import {
  AuthProvidersManageScope,
  type EnvironmentId,
  type ProviderInstanceId,
  type ProviderMcpCheck,
  type ProviderMcpListInput,
  type ProviderMcpListing,
  type ThreadId,
} from "@t3tools/contracts";
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import { Link } from "@tanstack/react-router";
import { PlugIcon, PlugZapIcon, PowerOffIcon } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { useClientSettings } from "~/hooks/useSettings";
import { deriveProviderInstanceEntries } from "~/providerInstances";
import { useQuietThreadProjection } from "~/state/entities";
import { useEnvironmentProviders } from "~/state/environments";
import { mcpAppEnvironment } from "~/state/mcpApps";
import { useEnvironmentQuery } from "~/state/query";
import { useEnvironmentScope } from "~/state/session";
import { useAtomCommand } from "~/state/use-atom-command";
import { buildThreadRouteParams } from "~/threadRoutes";
import { formatShortTimestamp } from "~/timestampFormat";
import { Button } from "../ui/button";
import { RefreshIcon } from "../ui/refresh-icon";
import { PanelTabEmpty, PanelTabFrame } from "../chat/PanelTabFrame";
import { McpServerList } from "./McpServerList";
import { liveProviderSessionId } from "./mcpPanelSession";

function useProviderName(
  environmentId: EnvironmentId,
  instanceId: ProviderInstanceId | undefined,
): string | null {
  const providers = useEnvironmentProviders().get(environmentId) ?? [];
  const provider = providers.find((candidate) => candidate.instanceId === instanceId);
  if (provider === undefined) {
    return null;
  }
  return deriveProviderInstanceEntries([provider])[0]?.displayName ?? provider.instanceId;
}

/** Asked once on open and again on Refresh; never polled, since each ask reaches the agent. */
function useProviderMcpListing(environmentId: EnvironmentId, input: ProviderMcpListInput) {
  return useEnvironmentQuery(mcpAppEnvironment.providerServers({ environmentId, input }));
}

function instanceOf(listing: ProviderMcpListing | null): ProviderInstanceId | undefined {
  return listing?.instanceId ?? undefined;
}

/** The MCP tab of a chat's right panel. */
export function McpPanel(props: {
  readonly environmentId: EnvironmentId;
  readonly threadId: ThreadId;
}) {
  const query = useProviderMcpListing(props.environmentId, { threadId: props.threadId });
  const listing = query.data;
  const liveSessionId = liveProviderSessionId(
    useQuietThreadProjection(scopeThreadRef(props.environmentId, props.threadId))?.projection ??
      null,
  );
  const askedForSessionIdRef = useRef(liveSessionId);
  const { refresh, isPending } = query;
  const answeredNotRunning = listing?._tag === "no-session" && !isPending;
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- asks the agent again once the chat's session starts after a "not running" answer
  useEffect(() => {
    if (
      answeredNotRunning &&
      liveSessionId !== null &&
      liveSessionId !== askedForSessionIdRef.current
    ) {
      askedForSessionIdRef.current = liveSessionId;
      refresh();
    }
  }, [answeredNotRunning, liveSessionId, refresh]);
  const providerName = useProviderName(props.environmentId, instanceOf(listing)) ?? "The agent";
  const timestampFormat = useClientSettings((settings) => settings.timestampFormat);

  const refreshButton = (
    <Button
      size="compact"
      variant="outline"
      onClick={() => query.refresh()}
      disabled={query.isPending}
    >
      <RefreshIcon refreshing={query.isPending} />
      Refresh
    </Button>
  );

  if (listing === null) {
    return (
      <PanelTabFrame title="MCP" actions={refreshButton}>
        <div role="status">
          <PanelTabEmpty
            icon={<PlugZapIcon />}
            title={
              query.error ? "Could not ask the agent" : "Asking the agent for its MCP servers..."
            }
            description={query.error ?? undefined}
          />
        </div>
      </PanelTabFrame>
    );
  }
  if (listing._tag === "no-session") {
    return (
      <PanelTabFrame title="MCP" actions={refreshButton}>
        <PanelTabEmpty
          icon={<PowerOffIcon />}
          title="The agent is not running"
          description="Send a message, then its MCP servers show here."
        />
      </PanelTabFrame>
    );
  }
  if (listing._tag === "unsupported") {
    return (
      <PanelTabFrame title={providerName}>
        <PanelTabEmpty
          icon={<PlugIcon />}
          title={`${providerName} does not report MCP servers`}
          description={
            <>
              {providerName} does not tell Flow which MCP servers it loaded. Flow's own tools (
              <code>t3-code</code>) are always there.
            </>
          }
        />
      </PanelTabFrame>
    );
  }
  return (
    <PanelTabFrame
      title={providerName}
      summary={`checked ${formatShortTimestamp(listing.checkedAt, timestampFormat)}`}
      actions={refreshButton}
    >
      {query.error ? (
        <div role="alert" className="px-3 pt-2 text-destructive text-xs">
          {query.error}
        </div>
      ) : null}
      {listing.servers.length === 0 ? (
        <PanelTabEmpty icon={<PlugIcon />} title={`${providerName} has no MCP servers loaded`} />
      ) : (
        <McpServerList servers={listing.servers} />
      )}
    </PanelTabFrame>
  );
}

type CheckState =
  | { readonly status: "idle" }
  | { readonly status: "checking" }
  | { readonly status: "done"; readonly result: ProviderMcpCheck }
  | { readonly status: "failed"; readonly message: string };

/**
 * Settings > Providers: the servers of the instance's most recently updated running chat, or,
 * behind a button, a one-off check that starts the provider just to read them.
 */
export function McpSettingsSection(props: {
  readonly environmentId: EnvironmentId;
  readonly instanceId: ProviderInstanceId;
  readonly providerName: string;
}) {
  const query = useProviderMcpListing(props.environmentId, { instanceId: props.instanceId });
  const listing = query.data;
  const timestampFormat = useClientSettings((settings) => settings.timestampFormat);
  const canManageProviders = useEnvironmentScope(props.environmentId, AuthProvidersManageScope);
  const checkServers = useAtomCommand(mcpAppEnvironment.checkProviderServers, {
    reportFailure: false,
  });
  const [check, setCheck] = useState<CheckState>({ status: "idle" });

  const runCheck = async () => {
    setCheck({ status: "checking" });
    const result = await checkServers({
      environmentId: props.environmentId,
      input: { instanceId: props.instanceId },
    });
    if (result._tag === "Success") {
      setCheck({ status: "done", result: result.value });
      return;
    }
    setCheck({
      status: "failed",
      message:
        "error" in result.cause && result.cause.error instanceof Error
          ? result.cause.error.message
          : `${props.providerName} did not report its MCP servers.`,
    });
  };

  const hint = (text: ReactNode) => (
    <p className="px-3 pt-3 text-muted-foreground text-xs sm:px-4">{text}</p>
  );
  const checkButton = (label: string) => (
    <Button
      size="compact"
      variant="outline"
      onClick={() => void runCheck()}
      disabled={check.status === "checking"}
    >
      <RefreshIcon refreshing={check.status === "checking"} />
      {check.status === "checking" ? "Checking..." : label}
    </Button>
  );

  if (check.status === "done" && check.result._tag === "checked") {
    const result = check.result;
    return (
      <div className="flex flex-col">
        <div className="flex items-start gap-2 px-3 pt-3 sm:px-4">
          <p className="min-w-0 flex-1 text-muted-foreground text-xs">
            Checked by starting {props.providerName} once ·{" "}
            {formatShortTimestamp(result.checkedAt, timestampFormat)}
            {result.profile ? (
              <>
                {" "}
                · <span className="font-mono">{result.profile}</span>
              </>
            ) : null}
            . Project servers show in a chat's MCP tab.
          </p>
          {checkButton("Check again")}
        </div>
        {result.servers.length === 0 ? (
          hint(`${props.providerName} has no MCP servers configured.`)
        ) : (
          <McpServerList servers={result.servers} />
        )}
      </div>
    );
  }

  if (listing === null) {
    return hint(query.error ?? `Asking ${props.providerName} for its MCP servers...`);
  }
  if (
    listing._tag === "unsupported" ||
    (check.status === "done" && check.result._tag === "unsupported")
  ) {
    return hint(
      <>
        {props.providerName} does not tell Flow which MCP servers it loaded. Flow's own tools (
        <code>t3-code</code>) are always there.
      </>,
    );
  }
  if (listing._tag === "no-session") {
    return (
      <div className="flex flex-col gap-2 px-3 py-3 sm:px-4">
        <p className="text-muted-foreground text-xs">
          No chat with {props.providerName} is running. Check servers starts {props.providerName}{" "}
          for a moment to list them; that also starts every MCP server it is configured with.
        </p>
        {check.status === "failed" ? (
          <p className="text-destructive text-xs">{check.message}</p>
        ) : null}
        {canManageProviders ? (
          <div>{checkButton("Check servers")}</div>
        ) : (
          <p className="text-muted-foreground text-xs">
            Checking needs permission to manage providers on this environment.
          </p>
        )}
      </div>
    );
  }
  return (
    <div className="flex flex-col">
      <div className="flex items-start gap-2 px-3 pt-3 sm:px-4">
        <p className="min-w-0 flex-1 text-muted-foreground text-xs">
          From the running chat{" "}
          <Link
            to="/$environmentId/$threadId"
            params={buildThreadRouteParams(scopeThreadRef(props.environmentId, listing.threadId))}
            className="text-primary hover:underline"
          >
            {listing.threadTitle}
          </Link>{" "}
          · checked {formatShortTimestamp(listing.checkedAt, timestampFormat)}
          {listing.profile ? (
            <>
              {" "}
              · <span className="font-mono">{listing.profile}</span>
            </>
          ) : null}
        </p>
        <Button
          size="compact"
          variant="outline"
          onClick={() => query.refresh()}
          disabled={query.isPending}
        >
          <RefreshIcon refreshing={query.isPending} />
          Refresh
        </Button>
      </div>
      {listing.servers.length === 0 ? (
        hint(`${props.providerName} has no MCP servers loaded.`)
      ) : (
        <McpServerList servers={listing.servers} />
      )}
    </div>
  );
}
