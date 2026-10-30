import { useState } from "react";
import {
  BrainIntegrationCatalog,
  BrainRepositoryPicker,
  BrainConnectedSources,
} from "@flow/brain-ui";
import { Link } from "@tanstack/react-router";
import type {
  BrainWorkspace,
  BrainState,
  EnvironmentId,
  FilesystemBrowseResult,
} from "@t3tools/contracts";
import { Folder, ArrowUp, ChevronRight, SearchIcon } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogPanel,
  DialogFooter,
} from "../ui/dialog";
import { filesystemEnvironment } from "../../state/filesystem";
import { useAtomQueryRunner } from "../../state/use-atom-query-runner";
import { type SendBrainCommand } from "./BrainControls";

const active = (status: string) => ["queued", "cloning", "indexing", "embedding"].includes(status);
// Same source catalog and focused connection dialogs as Flow's IntegrationCatalog.
// The memory-driven integrations stay visibly unavailable until their workers are ported.
export function BrainSources({
  workspace,
  state,
  environmentId,
  send,
  busy,
}: {
  workspace: BrainWorkspace;
  state: BrainState;
  environmentId: EnvironmentId;
  send: SendBrainCommand;
  busy: boolean;
}) {
  const [modal, setModal] = useState<"github" | "folder" | null>(null);
  const [connectedModal, setConnectedModal] = useState<"github" | "folder" | null>(null);
  // Flow: the connected sources list can be searched by name, path or branch.
  const [sourceQuery, setSourceQuery] = useState("");
  const openConnected = (kind: "github" | "folder") => {
    setSourceQuery("");
    setConnectedModal(kind);
  };
  const connectedSources = workspace.sources.filter(
    (source) => Boolean(source.localPath) === (connectedModal === "folder"),
  );
  const sourceTerms = sourceQuery.trim().toLowerCase().split(/\s+/u).filter(Boolean);
  const matchingSources = connectedSources.filter((source) => {
    const text = `${source.repository} ${source.localPath ?? ""} ${source.branch}`.toLowerCase();
    return sourceTerms.every((term) => text.includes(term));
  });
  const [error, setError] = useState("");
  const [folder, setFolder] = useState("");
  const [listing, setListing] = useState<FilesystemBrowseResult | null>(null);
  const browse = useAtomQueryRunner(filesystemEnvironment.browse, {
    reportFailure: false,
    refresh: true,
  });
  const [browsing, setBrowsing] = useState(false);
  async function browseFolder(path: string) {
    setBrowsing(true);
    setError("");
    return await (async () => {
      const result = await browse({
        environmentId,
        input: { partialPath: path.endsWith("/") ? path : path + "/" },
      });
      if (result._tag === "Failure") {
        setError("Could not browse this folder on the selected computer.");
        return;
      }
      setListing(result.value);
      setFolder(result.value.parentPath);
    })().finally(() => {
      setBrowsing(false);
    });
  }
  return (
    <section className="space-y-4" aria-label="Brain sources">
      <BrainIntegrationCatalog
        brainName={workspace.name}
        github={{
          onConnect: () => {
            setError("");
            setModal("github");
          },
          onList: () => openConnected("github"),
        }}
        folder={{
          description: workspace.remote
            ? "Use a checkout’s GitHub repository"
            : "Code on this computer",
          onConnect: () => {
            setError("");
            setModal("folder");
          },
          onList: () => openConnected("folder"),
        }}
      />
      <Dialog
        open={connectedModal !== null}
        onOpenChange={(open) => !open && setConnectedModal(null)}
      >
        <DialogPopup className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {connectedModal === "github"
                ? "Connected GitHub repositories"
                : "Connected local folders"}
            </DialogTitle>
            <DialogDescription>
              Sources connected to {workspace.name}. Reindex to pull the latest committed changes.
            </DialogDescription>
            {connectedSources.length > 1 ? (
              <label className="mt-2 flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5 text-muted-foreground">
                <SearchIcon aria-hidden className="size-4 shrink-0" />
                <input
                  type="search"
                  aria-label="Search sources"
                  placeholder="Search by name, path or branch…"
                  value={sourceQuery}
                  onChange={(event) => setSourceQuery(event.target.value)}
                  className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                />
                <span className="shrink-0 text-xs tabular-nums">
                  {matchingSources.length} of {connectedSources.length}
                </span>
              </label>
            ) : null}
          </DialogHeader>
          <DialogPanel>
            {matchingSources.length > 0 ? (
              <BrainSourceList
                sources={matchingSources}
                workspaceId={workspace.id}
                send={send}
                busy={busy}
              />
            ) : connectedSources.length > 0 ? (
              <p className="text-sm text-muted-foreground">Nothing matches the search.</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                No {connectedModal === "github" ? "GitHub repositories" : "local folders"} connected
                yet.
              </p>
            )}
          </DialogPanel>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConnectedModal(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
      <Dialog
        open={modal !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setModal(null);
        }}
      >
        <DialogPopup className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {modal === "github" ? "Connect GitHub repositories" : "Connect a local folder"}
            </DialogTitle>
            <DialogDescription>
              {modal === "github"
                ? `Select sources for ${workspace.name}. Public repositories work without signing in.`
                : "Choose a Git repository on this computer. Flow reads committed files without changing your working folder."}
            </DialogDescription>
          </DialogHeader>
          <DialogPanel>
            {modal === "github" ? (
              <BrainRepositoryPicker
                connectedRepositories={workspace.sources
                  .filter((source) => !source.localPath)
                  .map((source) => source.repository)}
                connection={
                  <>
                    <span>
                      {state.github.connected
                        ? `Signed in as ${state.github.login}`
                        : "Connect GitHub to browse your repositories."}
                    </span>
                    {!state.github.connected && (
                      <Link to="/settings/source-control">Connect GitHub ↗</Link>
                    )}
                  </>
                }
                loadRepositories={async () => {
                  const result = await send(
                    { action: "listGithubRepositories", workspaceId: workspace.id },
                    true,
                  );
                  if (!result?.repositories)
                    throw Error(result?.error ?? "Could not load repositories.");
                  return result.repositories;
                }}
                loadBranches={async (repository) => {
                  const result = await send(
                    { action: "listGithubBranches", workspaceId: workspace.id, repository },
                    true,
                  );
                  if (!result?.branches) throw Error(result?.error ?? "Could not load branches.");
                  return result.branches;
                }}
                connect={async (repository, branch) => {
                  const result = await send({
                    action: "import",
                    workspaceId: workspace.id,
                    repository,
                    ...(branch ? { branch } : {}),
                  });
                  if (!result || result.error)
                    throw Error(result?.error ?? "Could not connect the repository.");
                }}
                onConnected={() => setModal(null)}
              />
            ) : (
              <>
                <form
                  className="flex items-end gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void browseFolder(folder || "~");
                  }}
                >
                  <label className="min-w-0 flex-1 space-y-2 text-sm">
                    Folder path
                    <Input
                      value={folder}
                      onChange={(event) => setFolder(event.target.value)}
                      placeholder="Browse to a repository…"
                    />
                  </label>
                  <Button variant="outline" type="submit" disabled={browsing}>
                    {browsing ? "Loading…" : "Browse"}
                  </Button>
                </form>
                {listing && (
                  <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
                    <button
                      className="flex w-full items-center gap-2 p-3 text-xs hover:bg-muted"
                      onClick={() =>
                        void browseFolder(
                          listing.parentPath.replace(/[/\\][^/\\]+[/\\]?$/, "") || "/",
                        )
                      }
                    >
                      <ArrowUp size={14} />
                      Parent folder
                    </button>
                    {listing.entries.map((entry) => (
                      <button
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
                        key={entry.fullPath}
                        onClick={() => void browseFolder(entry.fullPath)}
                      >
                        <Folder size={14} />
                        <span className="flex-1 text-left">{entry.name}</span>
                        <ChevronRight size={14} />
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </DialogPanel>
          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={() => setModal(null)}>
              Close
            </Button>
            {modal === "folder" && (
              <Button
                disabled={busy || !folder.trim()}
                onClick={() => {
                  setError("");
                  void send({
                    action: "importFolder",
                    workspaceId: workspace.id,
                    path: folder,
                  }).then((result) => {
                    if (result && !result.error) setModal(null);
                    else setError(result?.error ?? "Could not connect the folder.");
                  });
                }}
              >
                Connect folder
              </Button>
            )}
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </section>
  );
}

function BrainSourceList({
  sources,
  workspaceId,
  send,
  busy,
}: {
  sources: BrainWorkspace["sources"];
  workspaceId: string;
  send: SendBrainCommand;
  busy: boolean;
}) {
  return (
    <BrainConnectedSources
      sources={sources}
      busy={busy}
      onAction={(action, sourceId) => {
        void send({ action, workspaceId, sourceId });
      }}
    />
  );
}

export function BrainIndexing({
  workspace,
  send,
  busy,
}: {
  workspace: BrainWorkspace;
  send: SendBrainCommand;
  busy: boolean;
}) {
  const sources = workspace.sources.filter((source) => active(source.status));
  if (!sources.length) return null;
  return (
    <section aria-label="Active indexing">
      <BrainSourceList sources={sources} workspaceId={workspace.id} send={send} busy={busy} />
    </section>
  );
}
