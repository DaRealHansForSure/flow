import { useEffect, useState, type ReactNode } from "react";
import * as Schema from "effect/Schema";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import type {
  BrainDocument,
  BrainDocumentSummary,
  BrainKnowledge,
  EnvironmentId,
} from "@t3tools/contracts";
import {
  BookOpenIcon,
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  FileCode2Icon,
  SearchIcon,
  SparklesIcon,
} from "lucide-react";
import { brainCommand } from "../../state/brain";
import { BrainSectionHeader } from "./BrainSectionHeader";
import { useAtomCommand } from "../../state/use-atom-command";
import ChatMarkdown from "../ChatMarkdown";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogPanel,
} from "../ui/dialog";

function documentLifecycle(document: BrainDocumentSummary): string {
  if (document.status === "resolved") return "Resolved · lesson retained";
  if (document.lifecycle === "temporal") return "Time-sensitive context";
  if (document.lifecycle === "issue") return "Open issue";
  return document.kind === "skill"
    ? "Reusable procedure"
    : document.kind === "doc"
      ? "Maintained context"
      : "Retained memory";
}

const COLLAPSED_SECTIONS_KEY = "flow:brain:collapsed-sections";
const NO_COLLAPSED_SECTIONS: Record<string, boolean> = {};
const CollapsedSectionsSchema = Schema.Record(Schema.String, Schema.Boolean);

export function BrainDocumentDialog(props: Parameters<typeof BrainDocumentDialogContent>[0]) {
  return (
    <BrainDocumentDialogContent
      key={`${props.environmentId}:${props.workspaceId}:${props.document?.id ?? "closed"}:${props.document?.revision ?? 0}`}
      {...props}
    />
  );
}

function BrainDocumentDialogContent({
  document,
  initial,
  environmentId,
  workspaceId,
  onClose,
  details,
}: {
  document: BrainDocumentSummary | null;
  initial?: BrainDocument | undefined;
  environmentId: EnvironmentId;
  workspaceId: string;
  onClose: () => void;
  /** Extra context shown under the document's dates, such as who writes these notes. */
  details?: React.ReactNode;
}) {
  const execute = useAtomCommand(brainCommand, { reportFailure: false });
  const [loaded, setLoaded] = useState<BrainDocument | null>(
    initial?.id === document?.id ? (initial ?? null) : null,
  );
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const id = document?.id,
    revision = document?.revision;
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Fetches the opened document's body from the Brain service, dropping stale replies.
  useEffect(() => {
    let disposed = false;
    if (!id) return;
    if (initial?.id === id && initial.revision === revision) {
      return;
    }
    void execute({ environmentId, input: { action: "readDocument", workspaceId, documentId: id } })
      .then((result) => {
        if (disposed) return;
        if (result._tag === "Failure")
          setError("Could not load this document. Reopen it to retry.");
        else if (result.value.error) setError(result.value.error);
        else if (!result.value.document) setError("This document is no longer available.");
        else setLoaded(result.value.document);
      })
      .catch(() => {
        if (!disposed)
          setError("Could not reach this brain. Reopen the document after reconnecting.");
      });
    return () => {
      disposed = true;
    };
  }, [id, revision, initial, environmentId, workspaceId, execute]);
  const skill = document?.kind === "skill";
  async function copyPrompt() {
    if (!document) return;
    try {
      await navigator.clipboard.writeText(
        `Use the “${document.name}” skill from Flow brain ${workspaceId} in a chat connected to that brain. Read its latest version with read_skill (id: ${document.id}) before applying it to this task.`,
      );
      setCopied(true);
    } catch {
      setError(
        "Clipboard access is unavailable. You can ask your agent to use this skill by name.",
      );
    }
  }
  function download() {
    if (!loaded) return;
    const url = URL.createObjectURL(
      new Blob([loaded.text], { type: "text/markdown;charset=utf-8" }),
    );
    const link = window.document.createElement("a");
    link.href = url;
    link.download = skill ? "SKILL.md" : `${loaded.name.replace(/[^a-zA-Z0-9_-]+/g, "-")}.md`;
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <Dialog
      open={Boolean(document)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogPopup className="sm:max-w-3xl">
        <DialogHeader>
          <div className="mb-2 flex items-center gap-2 pr-7 text-xs text-muted-foreground">
            {skill ? (
              <FileCode2Icon className="size-4 text-primary" />
            ) : (
              <BookOpenIcon className="size-4 text-primary" />
            )}
            {skill
              ? "SKILL.md"
              : document?.kind === "notes"
                ? "Conversation notes"
                : document?.kind === "doc"
                  ? "Auto-Doc"
                  : "Memory"}
            {document && <span className="ml-auto">Revision {document.revision}</span>}
          </div>
          <DialogTitle>{document?.name ?? "Brain document"}</DialogTitle>
          <DialogDescription>
            {skill
              ? document.description
              : document?.kind === "notes"
                ? "The task, progress, and corrections preserved from this conversation."
                : "Context learned from conversations and retained in this brain."}
          </DialogDescription>
          {details ? <p className="text-xs text-muted-foreground">{details}</p> : null}
          {!!(loaded ?? document)?.contributors?.length && (
            <p className="text-xs text-muted-foreground">
              Contributors:{" "}
              {(loaded ?? document)?.contributors?.map((user) => user.email).join(", ")}
            </p>
          )}
        </DialogHeader>
        <DialogPanel>
          {error && (
            <p
              role="alert"
              className="mb-4 rounded-lg bg-destructive/5 p-3 text-sm text-destructive"
            >
              {error}
            </p>
          )}
          {!loaded && !error && (
            <p role="status" className="py-8 text-sm text-muted-foreground">
              Opening document…
            </p>
          )}
          {loaded && (
            <>
              <div className="mb-5 flex flex-wrap items-center gap-2 border-b border-border/60 pb-4">
                {loaded.kind !== "notes" && (
                  <span className="rounded-full bg-muted px-2.5 py-1 text-2xs text-muted-foreground">
                    {documentLifecycle(loaded)}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  Updated {new Date(loaded.updatedAt).toLocaleDateString()}
                  {loaded.observedAt !== undefined && (
                    <> · Evidence from {new Date(loaded.observedAt).toLocaleDateString()}</>
                  )}
                </span>
                <div className="ml-auto flex min-w-0 max-w-full flex-wrap justify-end gap-2">
                  {skill && (
                    <Button variant="outline" size="sm" onClick={() => void copyPrompt()}>
                      {copied ? (
                        <CheckIcon className="size-3.5" />
                      ) : (
                        <CopyIcon className="size-3.5" />
                      )}
                      {copied ? "Copied" : "Copy chat prompt"}
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={download}>
                    <DownloadIcon className="size-3.5" />
                    {skill ? "Download SKILL.md" : "Download"}
                  </Button>
                </div>
              </div>
              <ChatMarkdown
                cwd={undefined}
                environmentId={environmentId}
                text={
                  skill ? loaded.text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "") : loaded.text
                }
                className="text-sm leading-7"
              />
              {skill && (
                <p className="mt-6 rounded-xl border border-primary/15 bg-primary/5 p-3 text-xs leading-relaxed text-muted-foreground">
                  Use a chat connected to this brain and ask your agent for this skill by name. It
                  can discover and read the latest version before following the procedure.
                </p>
              )}
              {loaded.lifecycle === "temporal" && (
                <p className="mt-5 text-xs text-muted-foreground">
                  This context becomes less prominent over time
                  {loaded.halfLifeDays ? ` (half-life: ${loaded.halfLifeDays} days)` : ""}. Its
                  history remains available.
                </p>
              )}
            </>
          )}
        </DialogPanel>
      </DialogPopup>
    </Dialog>
  );
}

const EMPTY_LEGACY_MEMORIES: BrainKnowledge["memories"] = [];

export function BrainDocumentLibrary({
  documents,
  legacyMemories = EMPTY_LEGACY_MEMORIES,
  environmentId,
  workspaceId,
  compact = false,
  kind: selectedKind,
  chatSwitches,
}: {
  documents: readonly BrainDocumentSummary[];
  legacyMemories?: BrainKnowledge["memories"];
  environmentId: EnvironmentId;
  workspaceId: string;
  compact?: boolean;
  kind?: "doc" | "skill" | "memory";
  /**
   * Fork: one chat's documents. Both sections then show even while empty, each with the
   * chat's switch for that kind in its header.
   */
  chatSwitches?: { readonly doc: ReactNode; readonly skill: ReactNode };
}) {
  const [selected, setSelected] = useState<BrainDocumentSummary | null>(null);
  const [legacy, setLegacy] = useState<BrainKnowledge["memories"][number] | null>(null);
  const [query, setQuery] = useState("");
  // Flow: closed sections stay closed across tabs, chats and reloads.
  const [collapsed, setCollapsed] = useLocalStorage(
    COLLAPSED_SECTIONS_KEY,
    NO_COLLAPSED_SECTIONS,
    CollapsedSectionsSchema,
  );
  const matches = (text: string) => text.toLowerCase().includes(query.toLowerCase());
  return (
    <>
      {!compact && (documents.length > 0 || legacyMemories.length > 0) && (
        <label className="flex max-w-md items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-muted-foreground">
          <SearchIcon className="size-4" />
          <input
            aria-label={
              selectedKind === "doc"
                ? "Search auto-docs"
                : selectedKind === "skill"
                  ? "Search auto-skills"
                  : selectedKind === "memory"
                    ? "Search memories"
                    : "Search auto-docs and skills"
            }
            placeholder={
              selectedKind === "doc"
                ? "Search auto-docs…"
                : selectedKind === "skill"
                  ? "Search auto-skills…"
                  : selectedKind === "memory"
                    ? "Search memories…"
                    : "Search auto-docs and skills…"
            }
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      )}
      {(selectedKind
        ? [selectedKind]
        : compact
          ? (["doc", "skill"] as const)
          : (["doc", "skill"] as const)
      ).map((kind) => {
        const all = documents.filter((doc) => doc.kind === kind);
        const old = kind === "memory" ? legacyMemories : [];
        const isEmpty = !all.length && !old.length;
        if (isEmpty && !chatSwitches)
          return selectedKind ? (
            <p
              key={kind}
              className="rounded-xl border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground"
            >
              {kind === "doc"
                ? "No auto-docs yet. Durable context will appear as you work in connected chats."
                : kind === "skill"
                  ? "No auto-skills yet. Reusable procedures will appear as you work in connected chats."
                  : "No memories yet. Decisions, lessons, and useful context will appear as you work in connected chats."}
            </p>
          ) : null;
        const visible = all.filter((doc) => matches(`${doc.name} ${doc.description}`));
        const oldVisible = old.filter((doc) => matches(`${doc.title} ${doc.body}`));
        const Icon =
          kind === "skill" ? FileCode2Icon : kind === "doc" ? BookOpenIcon : SparklesIcon;
        const label = kind === "doc" ? "Auto-Docs" : kind === "skill" ? "Auto-Skills" : "Memories";
        return (
          <section
            key={kind}
            aria-label={label}
            className={compact ? "mt-3 border-t border-border/60 pt-3" : "space-y-3"}
          >
            <BrainSectionHeader
              icon={Icon}
              label={label}
              count={all.length + old.length}
              description={compact ? undefined : sectionDescription(kind)}
              expanded={!collapsed[kind]}
              onToggle={() => setCollapsed({ ...collapsed, [kind]: !collapsed[kind] })}
              actions={kind === "doc" || kind === "skill" ? chatSwitches?.[kind] : null}
            />
            <div
              hidden={Boolean(collapsed[kind])}
              className={
                compact
                  ? "max-h-64 space-y-1 overflow-y-auto"
                  : "grid max-h-[32rem] gap-3 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3"
              }
            >
              {visible.map((doc) => (
                <button
                  type="button"
                  key={doc.id}
                  onClick={() => setSelected(doc)}
                  className={
                    compact
                      ? "group w-full rounded-xl px-2 py-2.5 text-left hover:bg-muted/60"
                      : "group flex h-full flex-col rounded-xl border border-border/70 bg-card p-4 text-left hover:border-primary/35 hover:bg-primary/[0.025]"
                  }
                >
                  <span className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 text-sm font-medium leading-snug">
                      {doc.name}
                    </span>
                    {kind === "skill" && !compact && (
                      <span className="rounded bg-primary/8 px-1.5 py-0.5 font-mono text-3xs text-primary">
                        SKILL.md
                      </span>
                    )}
                  </span>
                  {doc.description && (
                    <span
                      className={`mt-1.5 block text-xs leading-relaxed text-muted-foreground ${compact ? "line-clamp-2" : "line-clamp-3"}`}
                    >
                      {doc.description}
                    </span>
                  )}
                  {!compact && (
                    <span className="mt-auto flex items-center justify-between gap-2 pt-4 text-3xs text-muted-foreground">
                      <span>{documentLifecycle(doc)}</span>
                      <span>v{doc.revision}</span>
                    </span>
                  )}
                </button>
              ))}
              {oldVisible.map((doc) => (
                <button
                  type="button"
                  key={doc.id}
                  onClick={() => setLegacy(doc)}
                  className={
                    compact
                      ? "w-full rounded-xl px-2 py-2.5 text-left text-xs leading-relaxed hover:bg-muted/60"
                      : "rounded-xl border border-border/70 bg-card p-4 text-left hover:border-primary/35"
                  }
                >
                  <span className="line-clamp-4 block text-sm leading-relaxed">{doc.body}</span>
                </button>
              ))}
              {isEmpty && (
                <p className="px-2 py-1 text-xs text-muted-foreground">
                  No {label} from this chat yet.
                </p>
              )}
              {!isEmpty && !visible.length && !oldVisible.length && (
                <p className="p-3 text-xs text-muted-foreground">
                  No matching {kind === "skill" ? "skills" : "memories"}.
                </p>
              )}
            </div>
          </section>
        );
      })}
      <BrainDocumentDialog
        document={selected}
        environmentId={environmentId}
        workspaceId={workspaceId}
        onClose={() => setSelected(null)}
      />
      <Dialog
        open={Boolean(legacy)}
        onOpenChange={(open) => {
          if (!open) setLegacy(null);
        }}
      >
        <DialogPopup className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Memory</DialogTitle>
            <DialogDescription>Retained from an earlier conversation.</DialogDescription>
          </DialogHeader>
          <DialogPanel>
            <ChatMarkdown cwd={undefined} environmentId={environmentId} text={legacy?.body ?? ""} />
          </DialogPanel>
        </DialogPopup>
      </Dialog>
    </>
  );
}

function sectionDescription(kind: "doc" | "skill" | "memory"): string {
  if (kind === "doc") {
    return "Maintained facts, customer context, and standing constraints.";
  }
  if (kind === "skill") {
    return "Procedures your agents can find, read, and reuse.";
  }
  return "Decisions, lessons, and context carried across conversations.";
}
