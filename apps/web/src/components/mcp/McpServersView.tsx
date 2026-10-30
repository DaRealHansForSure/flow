import type {
  EnvironmentId,
  ProviderInstanceId,
  ProviderMcpListInput,
  ProviderMcpListing,
  ThreadId,
} from "@t3tools/contracts";
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import { Link } from "@tanstack/react-router";
import { PlugIcon, PowerOffIcon } from "lucide-react";
import type { ReactNode } from "react";

import { useClientSettings } from "~/hooks/useSettings";
import { deriveProviderInstanceEntries } from "~/providerInstances";
import { useEnvironmentProviders } from "~/state/environments";
import { mcpAppEnvironment } from "~/state/mcpApps";
import { useEnvironmentQuery } from "~/state/query";
import { buildThreadRouteParams } from "~/threadRoutes";
import { formatShortTimestamp } from "~/timestampFormat";
import { Button } from "../ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "../ui/empty";
import { RefreshIcon } from "../ui/refresh-icon";
import { McpServerList } from "./McpServerList";

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

function CenteredEmpty(props: {
  readonly icon: ReactNode;
  readonly title: string;
  readonly description: ReactNode;
}) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">{props.icon}</EmptyMedia>
        <EmptyTitle>{props.title}</EmptyTitle>
        <EmptyDescription>{props.description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

/** The MCP tab of a chat's right panel. */
export function McpPanel(props: {
  readonly environmentId: EnvironmentId;
  readonly threadId: ThreadId;
}) {
  const query = useProviderMcpListing(props.environmentId, { threadId: props.threadId });
  const listing = query.data;
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
      <div className="flex min-h-0 flex-1 items-center justify-center px-6 text-center text-muted-foreground text-xs">
        {query.error ?? "Asking the agent for its MCP servers..."}
      </div>
    );
  }
  if (listing._tag === "no-session") {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <CenteredEmpty
          icon={<PowerOffIcon />}
          title="The agent is not running"
          description="Send a message, then its MCP servers show here."
        />
      </div>
    );
  }
  if (listing._tag === "unsupported") {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <CenteredEmpty
          icon={<PlugIcon />}
          title={`${providerName} does not report MCP servers`}
          description={
            <>
              {providerName} does not tell Flow which MCP servers it loaded. Flow's own tools (
              <code>t3-code</code>) are always there.
            </>
          }
        />
      </div>
    );
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">{providerName}</span>
          <span className="text-muted-foreground text-xs">
            · checked {formatShortTimestamp(listing.checkedAt, timestampFormat)}
          </span>
          <span className="flex-1" />
          {refreshButton}
        </div>
        {listing.profile ? (
          <div className="mt-0.5 truncate font-mono text-2xs text-muted-foreground">
            {listing.profile}
          </div>
        ) : null}
        {query.error ? <div className="mt-1 text-destructive text-xs">{query.error}</div> : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {listing.servers.length === 0 ? (
          <div className="px-3 py-4 text-muted-foreground text-xs">
            {providerName} has no MCP servers loaded.
          </div>
        ) : (
          <McpServerList servers={listing.servers} />
        )}
      </div>
    </div>
  );
}

/** Settings > Providers: the servers of the instance's most recently updated running chat. */
export function McpSettingsSection(props: {
  readonly environmentId: EnvironmentId;
  readonly instanceId: ProviderInstanceId;
  readonly providerName: string;
}) {
  const query = useProviderMcpListing(props.environmentId, { instanceId: props.instanceId });
  const listing = query.data;
  const timestampFormat = useClientSettings((settings) => settings.timestampFormat);

  if (listing === null) {
    return (
      <div className="px-3 py-3 text-muted-foreground text-xs sm:px-4">
        {query.error ?? `Asking ${props.providerName} for its MCP servers...`}
      </div>
    );
  }
  if (listing._tag === "no-session") {
    return (
      <div className="px-3 py-3 text-muted-foreground text-xs sm:px-4">
        No chat with {props.providerName} is running. Its MCP servers show here while one runs.
      </div>
    );
  }
  if (listing._tag === "unsupported") {
    return (
      <div className="px-3 py-3 text-muted-foreground text-xs sm:px-4">
        {props.providerName} does not tell Flow which MCP servers it loaded. Flow's own tools (
        <code>t3-code</code>) are always there.
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
        <div className="px-3 py-3 text-muted-foreground text-xs sm:px-4">
          {props.providerName} has no MCP servers loaded.
        </div>
      ) : (
        <McpServerList servers={listing.servers} />
      )}
    </div>
  );
}
