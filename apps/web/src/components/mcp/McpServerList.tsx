import type { ProviderMcpServer, ProviderMcpServerStatus } from "@t3tools/contracts";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { useState } from "react";

import { cn } from "~/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";

const TOOLS_SHOWN_FIRST = 20;

const STATUS_LABEL: Record<ProviderMcpServerStatus, string> = {
  connected: "Connected",
  pending: "Starting",
  "needs-auth": "Needs sign-in",
  failed: "Failed",
  disabled: "Disabled",
};

const STATUS_BADGE = {
  connected: "success",
  pending: "outline",
  "needs-auth": "warning",
  failed: "error",
  disabled: "outline",
} as const satisfies Record<ProviderMcpServerStatus, string>;

const STATUS_DOT: Record<ProviderMcpServerStatus, string> = {
  connected: "bg-success",
  pending: "border border-muted-foreground",
  "needs-auth": "bg-warning",
  failed: "bg-destructive",
  disabled: "border border-muted-foreground bg-border",
};

const SCOPE_LABEL: Record<string, string> = {
  user: "User",
  project: "Project",
  local: "Local",
  plugin: "Plugin",
  managed: "Managed",
  enterprise: "Enterprise",
};

type McpServerGroup = "Flow" | "Your servers" | "Plugins" | "claude.ai";
const GROUP_ORDER: ReadonlyArray<McpServerGroup> = ["Flow", "Your servers", "Plugins", "claude.ai"];

function groupOf(server: ProviderMcpServer): McpServerGroup {
  if (server.origin !== "provider") {
    return "Flow";
  }
  if (server.scope === "plugin") {
    return "Plugins";
  }
  return server.scope === "claudeai" ? "claude.ai" : "Your servers";
}

/** Connectors are named "claude.ai <name>"; their group already says claude.ai. */
function displayName(server: ProviderMcpServer): string {
  return server.scope === "claudeai" ? server.name.replace(/^claude\.ai\s+/i, "") : server.name;
}

function originLabel(server: ProviderMcpServer, group: McpServerGroup): string | null {
  if (server.origin === "flow-brain") {
    return "Flow Brain";
  }
  if (group !== "Your servers" || server.scope === undefined) {
    return null;
  }
  return SCOPE_LABEL[server.scope] ?? server.scope;
}

const needsAttention = (server: ProviderMcpServer) =>
  server.status === "failed" || server.status === "needs-auth";

function StatusDot(props: { readonly status: ProviderMcpServerStatus }) {
  return (
    <span
      aria-label={STATUS_LABEL[props.status]}
      className={cn("size-2 shrink-0 rounded-full", STATUS_DOT[props.status])}
    />
  );
}

function ToolList(props: { readonly server: ProviderMcpServer }) {
  const tools = props.server.tools ?? [];
  const [filter, setFilter] = useState("");
  const [showAll, setShowAll] = useState(false);
  const needle = filter.trim().toLowerCase();
  const matching =
    needle === "" ? tools : tools.filter((tool) => tool.name.toLowerCase().includes(needle));
  const visible = showAll || needle !== "" ? matching : matching.slice(0, TOOLS_SHOWN_FIRST);
  return (
    <div className="flex flex-col gap-0.5 pb-2 pl-8 pr-3">
      {tools.length > TOOLS_SHOWN_FIRST ? (
        <Input
          size="compact"
          className="my-1"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder={`Filter ${tools.length} tools`}
          aria-label={`Filter the tools of ${props.server.name}`}
        />
      ) : null}
      {visible.map((tool) => (
        <div key={tool.name} className="flex min-w-0 items-baseline gap-2 py-0.5">
          <code className="min-w-0 truncate font-mono text-xs">{tool.name}</code>
          {tool.description ? (
            <span className="min-w-0 flex-1 truncate text-muted-foreground text-xs">
              {tool.description}
            </span>
          ) : (
            <span className="flex-1" />
          )}
          {tool.readOnly ? (
            <Badge size="sm" variant="outline">
              read-only
            </Badge>
          ) : null}
        </div>
      ))}
      {!showAll && needle === "" && matching.length > TOOLS_SHOWN_FIRST ? (
        <button
          type="button"
          className="self-start py-1 text-primary text-xs hover:underline"
          onClick={() => setShowAll(true)}
        >
          Show all {matching.length} tools
        </button>
      ) : null}
    </div>
  );
}

function ServerRow(props: { readonly server: ProviderMcpServer; readonly group: McpServerGroup }) {
  const { server } = props;
  const toolCount = server.tools?.length ?? 0;
  const [open, setOpen] = useState(false);
  const label = originLabel(server, props.group);
  const rowContent = (
    <>
      <span className="w-3 shrink-0 text-muted-foreground">
        {toolCount > 0 ? (
          open ? (
            <ChevronDownIcon className="size-3" />
          ) : (
            <ChevronRightIcon className="size-3" />
          )
        ) : null}
      </span>
      <StatusDot status={server.status} />
      <span className="min-w-0 truncate font-medium">{displayName(server)}</span>
      {label ? <span className="shrink-0 text-muted-foreground text-xs">{label}</span> : null}
      <span className="flex-1" />
      {server.status === "connected" && toolCount > 0 ? (
        <span className="shrink-0 text-muted-foreground text-xs">
          {toolCount === 1 ? "1 tool" : `${toolCount} tools`}
        </span>
      ) : (
        <Badge size="sm" variant={STATUS_BADGE[server.status]}>
          {STATUS_LABEL[server.status]}
        </Badge>
      )}
    </>
  );
  return (
    <div>
      {toolCount > 0 ? (
        <button
          type="button"
          aria-expanded={open}
          className="flex w-full min-w-0 items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent"
          onClick={() => setOpen(!open)}
        >
          {rowContent}
        </button>
      ) : (
        <div className="flex min-w-0 items-center gap-2 px-3 py-1.5 text-sm">{rowContent}</div>
      )}
      {open && toolCount > 0 ? <ToolList server={server} /> : null}
    </div>
  );
}

/** Failed and needs-sign-in servers are boxed on top and also stay in their group. */
export function McpServerList(props: { readonly servers: ReadonlyArray<ProviderMcpServer> }) {
  const problems = props.servers.filter(needsAttention);
  return (
    <div className="flex flex-col pb-2">
      {problems.length > 0 ? (
        <div className="flex flex-col gap-2 px-3 pt-3">
          {problems.map((server) => (
            <Alert
              key={`problem:${server.name}`}
              variant={server.status === "failed" ? "error" : "warning"}
            >
              <AlertTitle>
                {displayName(server)} · {STATUS_LABEL[server.status]}
              </AlertTitle>
              <AlertDescription>
                {server.error ??
                  (server.status === "failed"
                    ? "The server could not start."
                    : "Sign in to use its tools.")}
              </AlertDescription>
            </Alert>
          ))}
        </div>
      ) : null}
      {GROUP_ORDER.map((group) => {
        const members = props.servers.filter((server) => groupOf(server) === group);
        if (members.length === 0) {
          return null;
        }
        return (
          <section key={group} aria-label={group} data-panel-section="">
            <div className="flex justify-between px-3 pt-3 pb-1 font-semibold text-2xs text-muted-foreground uppercase tracking-wide">
              <span>{group}</span>
              <span className="tabular-nums">{members.length}</span>
            </div>
            {members.map((server) => (
              <ServerRow key={server.name} server={server} group={group} />
            ))}
          </section>
        );
      })}
    </div>
  );
}
