// Flow: the Brain page's Connected projects, as a searchable table with sortable columns.
import type { EnvironmentProject } from "@t3tools/client-runtime/state/models";
import type { BrainCommand, BrainSource, BrainState, BrainWorkspace } from "@t3tools/contracts";
import * as Schema from "effect/Schema";
import { Folder } from "lucide-react";

import { useLocalStorage } from "../../hooks/useLocalStorage";
import { useThreadShells } from "../../state/entities";
import { formatRelativeTimeLabel } from "../../timestampFormat";
import { SearchableSelect } from "../SearchableSelect";
import { DataTable, type DataTableColumn } from "../ui/data-table";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import type { DataTableSort } from "../ui/data-table.logic";
import { BrainSelect } from "./BrainControls";
import { BrainIcon } from "./BrainIcon";

const SORT_KEY = "flow:brain:connected-projects-sort";
const DEFAULT_SORT: DataTableSort | null = { columnId: "project", direction: "asc" };
const SortSchema = Schema.NullOr(
  Schema.Struct({
    columnId: Schema.String,
    direction: Schema.Literals(["asc", "desc"]),
  }),
);

interface ProjectRow {
  readonly project: EnvironmentProject;
  readonly source: BrainSource | undefined;
  readonly chats: number;
  readonly lastActivityAt: string | null;
}

const SOURCE_STATUS: Record<BrainSource["status"], { label: string; dot: string }> = {
  ready: { label: "Ready", dot: "bg-success" },
  queued: { label: "Queued", dot: "bg-muted-foreground" },
  waiting: { label: "Waiting", dot: "bg-muted-foreground" },
  cloning: { label: "Cloning", dot: "bg-info" },
  indexing: { label: "Indexing", dot: "bg-info" },
  embedding: { label: "Embedding", dot: "bg-info" },
  error: { label: "Error", dot: "bg-destructive" },
  cancelled: { label: "Cancelled", dot: "bg-muted-foreground" },
};

function timestamp(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function samePath(left: string | undefined, right: string): boolean {
  return left !== undefined && left.replace(/\/+$/u, "") === right.replace(/\/+$/u, "");
}

/** Cuts a long path in the middle, keeping its last folder; the full path shows on hover. */
function MiddleTruncatedPath(props: { readonly path: string }) {
  const cut = props.path.lastIndexOf("/");
  const head = cut > 0 ? props.path.slice(0, cut) : "";
  const tail = cut > 0 ? props.path.slice(cut) : props.path;
  return (
    <Tooltip>
      <TooltipTrigger
        render={<span className="flex min-w-0 font-mono text-2xs text-muted-foreground" />}
      >
        <span className="truncate">{head}</span>
        <span className="max-w-[75%] shrink-0 truncate">{tail}</span>
      </TooltipTrigger>
      <TooltipPopup variant="code">{props.path}</TooltipPopup>
    </Tooltip>
  );
}

export function ConnectedProjectsTable(props: {
  readonly workspace: BrainWorkspace;
  readonly state: BrainState | null;
  readonly projects: ReadonlyArray<EnvironmentProject>;
  readonly busy: boolean;
  readonly send: (input: BrainCommand) => unknown;
}) {
  const { workspace, state, busy, send } = props;
  const [sort, setSort] = useLocalStorage(SORT_KEY, DEFAULT_SORT, SortSchema);
  const threads = useThreadShells();
  const connected = props.projects.filter((project) => workspace.projectIds?.includes(project.id));
  const rows: ProjectRow[] = connected.map((project) => {
    const projectThreads = threads.filter(
      (thread) =>
        thread.environmentId === project.environmentId &&
        thread.projectId === project.id &&
        thread.archivedAt === null,
    );
    const lastActivityAt = projectThreads.reduce<string | null>((latest, thread) => {
      const activity = thread.latestUserMessageAt ?? thread.updatedAt;
      return latest === null || activity > latest ? activity : latest;
    }, null);
    return {
      project,
      source: workspace.sources.find((source) => samePath(source.localPath, project.workspaceRoot)),
      chats: projectThreads.length,
      lastActivityAt,
    };
  });

  const columns: ReadonlyArray<DataTableColumn<ProjectRow>> = [
    {
      id: "project",
      header: "Project",
      phone: "title",
      sortValue: (row) => row.project.title,
      renderCell: (row) => (
        <div className="flex max-w-96 min-w-0 items-center gap-2.5">
          <Folder aria-hidden size={16} className="shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{row.project.title}</div>
            <MiddleTruncatedPath path={row.project.workspaceRoot} />
          </div>
        </div>
      ),
    },
    {
      id: "source",
      header: "Source",
      sortValue: (row) => (row.source ? SOURCE_STATUS[row.source.status].label : null),
      renderCell: (row) => {
        if (!row.source) {
          return <span className="text-xs text-muted-foreground">No source</span>;
        }
        const status = SOURCE_STATUS[row.source.status];
        return (
          <span
            className={`inline-flex items-center gap-1.5 text-xs ${row.source.status === "error" ? "text-destructive" : ""}`}
          >
            <span aria-hidden className={`size-1.5 rounded-full ${status.dot}`} />
            {status.label}
          </span>
        );
      },
    },
    {
      id: "indexed",
      header: "Last indexed",
      sortValue: (row) => timestamp(row.source?.indexedAt),
      renderCell: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.source?.indexedAt ? formatRelativeTimeLabel(row.source.indexedAt) : "Not yet"}
        </span>
      ),
    },
    {
      id: "chats",
      header: "Chats",
      align: "end",
      sortValue: (row) => row.chats,
      renderCell: (row) => (
        <span className="text-xs">{row.chats === 1 ? "1 chat" : `${row.chats} chats`}</span>
      ),
    },
    {
      id: "activity",
      header: "Last activity",
      sortValue: (row) => timestamp(row.lastActivityAt),
      renderCell: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.lastActivityAt ? formatRelativeTimeLabel(row.lastActivityAt) : "No chats"}
        </span>
      ),
    },
    {
      id: "brain",
      header: "Brain",
      phone: "trailing",
      renderCell: (row) => {
        const brain = state?.workspaces.find((entry) => entry.projectIds?.includes(row.project.id));
        return (
          <BrainSelect
            label={`Brain for ${row.project.title}`}
            value={brain?.id ?? "none"}
            disabled={busy}
            options={[
              { value: "none", label: "No brain" },
              ...(state?.workspaces ?? []).map((entry) => ({
                value: entry.id,
                label: entry.name,
                icon: <BrainIcon id={entry.id} />,
              })),
            ]}
            onChange={(value) =>
              void send({
                action: "bindProject",
                projectId: row.project.id,
                workspaceId: value === "none" ? null : value,
              })
            }
          />
        );
      },
    },
  ];

  return (
    <DataTable
      rows={rows}
      columns={columns}
      getRowId={(row) => row.project.id}
      searchText={(row) =>
        `${row.project.title} ${row.project.workspaceRoot} ${row.source?.repository ?? ""}`
      }
      searchLabel="Search projects"
      sort={sort}
      onSortChange={setSort}
      countLabel={(count) => (count === 1 ? "1 project" : `${count} projects`)}
      emptyLabel="Create a project from the sidebar or connect an existing one. Its repository will be added as a source automatically."
      actions={
        <SearchableSelect
          label="Connect an existing project"
          searchLabel="Search projects"
          emptyLabel="No matching projects."
          value=""
          disabled={busy}
          options={props.projects
            .filter((project) => !workspace.projectIds?.includes(project.id))
            .map((project) => ({ value: project.id, label: project.title }))}
          onChange={(id) => {
            const project = props.projects.find((entry) => entry.id === id);
            if (project) {
              void send({
                action: "bindProject",
                projectId: project.id,
                workspaceId: workspace.id,
              });
            }
          }}
        />
      }
    />
  );
}
