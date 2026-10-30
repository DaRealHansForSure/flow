import { BrainIcon } from "./BrainIcon";
import { useState } from "react";
import type { ChatMemoryList, EnvironmentId, ThreadId } from "@t3tools/contracts";
import {
  BrainCircuitIcon,
  ChevronDownIcon,
  BookOpenIcon,
  Maximize2Icon,
  AlertCircleIcon,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { BrainGraph } from "./BrainGraph";
import { BrainGraphDialog, BrainGraphExpandButton } from "./BrainGraphDialog";
import { BrainDocumentDialog, BrainDocumentLibrary } from "./BrainDocuments";
import { ConversationNotesPreview } from "./ConversationNotesPreview";
import { Toggle, ToggleGroup } from "../ui/toggle-group";
import { toastManager } from "../ui/toast";
import { cliName } from "./BrainControls";
import type { ChatBrain } from "./useChatBrain";

type NotesAgentChoice = "default" | "on" | "off";

/** The Brain tab of a chat's right panel; the chat view keeps its context fresh. */
export function ChatBrainPanel({
  environmentId,
  threadId,
  chatBrain,
}: {
  environmentId: EnvironmentId;
  threadId: ThreadId | null;
  chatBrain: ChatBrain;
}) {
  const { response, brain, error, changedIds, savedNow, setNotesAgent } = chatBrain;
  const [notesExpanded, setNotesExpanded] = useState(true);
  const [brainExpanded, setBrainExpanded] = useState(false);
  const [view, setView] = useState<string | null>(null);
  const [graphAutoExpanded, setGraphAutoExpanded] = useState(false);
  const failedSources = brain?.sources.filter((source) => source.status === "error") ?? [];
  const notes = response?.chatMemories;
  const consultedNodeIds = [...new Set(notes?.consultedNodeIds ?? [])];
  const consultedNodeCount = consultedNodeIds.length;
  // The graph opens by itself the first time this chat uses the Brain; the tab is keyed per chat.
  if (consultedNodeCount > 0 && !graphAutoExpanded) {
    setGraphAutoExpanded(true);
    setBrainExpanded(true);
  }
  const notesAgentOff = notes?.notesAgent?.enabled === false;
  const memoryStatus = chatNotesStatus({
    hasBrain: brain !== undefined,
    notes,
    notesAgentOff,
    savedNow,
  });
  const notesAgent =
    brain && notes?.curatorCli ? (
      <>
        Notes are written by {cliName(notes.curatorCli)} on this computer
        {brain.remote ? ", even though this Brain lives in the cloud" : ""}.{" "}
        <Link
          to="/brain"
          search={{ brain: brain.id, environment: environmentId, settings: true }}
          className="text-primary hover:underline"
        >
          Change
        </Link>
      </>
    ) : null;
  return (
    <>
      <section
        aria-label="Flow brain and conversation notes"
        className="h-full min-h-0 overflow-y-auto p-4"
      >
        <div className="mb-3 flex items-center gap-2">
          <BrainCircuitIcon className="size-4 text-primary" />
          <h2 className="text-sm font-semibold">Flow</h2>
        </div>
        {error && (
          <p role="alert" className="mb-3 text-xs text-destructive">
            Could not refresh context. {response ? "Showing last loaded data." : "Reconnecting…"}
          </p>
        )}
        {!response && !error && (
          <p role="status" className="py-3 text-xs text-muted-foreground">
            Loading your brain…
          </p>
        )}
        {response && (
          <>
            <section aria-label="Connected brain">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-expanded={brainExpanded}
                  onClick={() => setBrainExpanded((value) => !value)}
                  className="flex min-w-0 flex-1 items-center gap-2 rounded-xl px-2 py-2 text-left hover:bg-muted/60"
                >
                  {brain ? (
                    <BrainIcon id={brain.id} />
                  ) : (
                    <BrainCircuitIcon className="size-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs text-muted-foreground">Brain</span>
                    <span className="block truncate text-sm">
                      {brain?.name ?? "No brain connected"}
                    </span>
                  </span>
                  {consultedNodeCount > 0 && (
                    <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-3xs font-medium text-primary">
                      {consultedNodeCount} used
                    </span>
                  )}
                  <ChevronDownIcon
                    className={`size-4 shrink-0 text-muted-foreground ${brainExpanded ? "rotate-180" : ""}`}
                  />
                </button>
                {brain && threadId && (
                  <button
                    type="button"
                    aria-label="Expand brain graph"
                    onClick={() => setView("brain")}
                    className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Maximize2Icon className="size-3.5" />
                  </button>
                )}
              </div>
              {brain && failedSources.length > 0 && (
                <div
                  role="alert"
                  className="mt-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive"
                >
                  <div className="flex items-center gap-2 font-medium">
                    <AlertCircleIcon className="size-4 shrink-0" />
                    <span>
                      Indexing failed for {failedSources.length}{" "}
                      {failedSources.length === 1 ? "source" : "sources"}
                    </span>
                  </div>
                  <ul className="mt-2 max-h-40 space-y-2 overflow-y-auto">
                    {failedSources.map((source) => (
                      <li key={source.id}>
                        <details>
                          <summary className="cursor-pointer break-words font-medium">
                            {source.repository || source.localPath || "Source"}
                          </summary>
                          <p className="mt-1 whitespace-pre-wrap break-words">
                            {source.message ||
                              "Indexing did not complete. Open the brain to retry this source."}
                          </p>
                        </details>
                      </li>
                    ))}
                  </ul>
                  <Link
                    to="/brain"
                    search={{ brain: brain.id, environment: environmentId }}
                    className="mt-3 inline-block font-medium underline underline-offset-2"
                  >
                    Manage sources and retry →
                  </Link>
                </div>
              )}
              {brainExpanded && (
                <div className="mt-2 overflow-hidden rounded-xl border border-border/50">
                  {brain && response.state.database.status !== "ready" ? (
                    <p role="alert" className="p-3 text-xs text-destructive">
                      {response.state.database.message}
                    </p>
                  ) : brain?.knowledge.entities.length ? (
                    <div className="relative">
                      <BrainGraph
                        knowledge={brain.knowledge}
                        highlightedNodeIds={consultedNodeIds}
                        compact
                      />
                      <div className="absolute top-1.5 right-1.5">
                        <BrainGraphExpandButton onClick={() => setView("brain")} />
                      </div>
                    </div>
                  ) : (
                    <p className="p-3 text-xs text-muted-foreground">
                      {brain
                        ? threadId
                          ? "Index sources to see your knowledge graph."
                          : "Open this brain to explore its knowledge graph."
                        : "This chat has no Brain."}
                    </p>
                  )}
                  {consultedNodeCount > 0 && (
                    <p
                      role="status"
                      className="border-t border-border/50 px-3 py-2 text-2xs text-muted-foreground"
                    >
                      Highlighting {consultedNodeCount}{" "}
                      {consultedNodeCount === 1 ? "node" : "nodes"} used by this chat
                    </p>
                  )}
                  <Link
                    to="/brain"
                    search={{ brain: brain?.id, environment: environmentId }}
                    className="block px-3 py-2 text-xs text-primary hover:underline"
                  >
                    Open brain →
                  </Link>
                </div>
              )}
            </section>
          </>
        )}
        {brain && (
          <BrainDocumentLibrary
            key={brain.id}
            compact
            environmentId={environmentId}
            workspaceId={brain.id}
            documents={(notes?.documents ?? []).filter((doc) => doc.kind !== "memory")}
          />
        )}
        <section aria-label="Conversation notes" className="mt-3 border-t border-border/60 pt-3">
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-expanded={notesExpanded}
              onClick={() => setNotesExpanded((value) => !value)}
              className="flex min-w-0 flex-1 items-center gap-2 rounded-xl px-2 py-2 text-left hover:bg-muted/60"
            >
              <BookOpenIcon className="size-4 shrink-0 text-primary" />
              <span className="flex-1 text-sm">Conversation notes</span>
              <ChevronDownIcon
                className={`size-4 text-muted-foreground ${notesExpanded ? "rotate-180" : ""}`}
              />
            </button>
            {notes?.notes && (
              <button
                type="button"
                aria-label="Read full conversation notes"
                onClick={() => setView("notes")}
                className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Maximize2Icon className="size-3.5" />
              </button>
            )}
          </div>
          {brain && threadId && notes?.notesAgent ? (
            <ChatNotesAgentControl notesAgent={notes.notesAgent} onChange={setNotesAgent} />
          ) : null}
          {notesExpanded && (
            <>
              {notes?.notes ? (
                <button
                  type="button"
                  aria-label="Read full notes"
                  onClick={() => setView("notes")}
                  className={`w-full rounded-xl px-2 py-2 text-left hover:bg-muted/60 ${changedIds.includes(notes.notes.id) ? "bg-primary/5" : ""}`}
                >
                  <ConversationNotesPreview text={notes.notes.text} />
                  <span className="mt-2 block text-2xs text-primary">Read full notes →</span>
                </button>
              ) : (
                <p className="px-2 py-3 text-xs leading-relaxed text-muted-foreground">
                  {brain
                    ? "Your task, progress, and corrections will appear here from the first message."
                    : "Notes help you and your agent pick up where this conversation left off."}
                </p>
              )}
              <p
                role="status"
                className={
                  notes?.extractionIssue && !notesAgentOff
                    ? "px-2 py-2 text-2xs text-destructive"
                    : "px-2 py-2 text-2xs text-muted-foreground"
                }
              >
                {memoryStatus}
              </p>
              {/* Who writes the notes matters when they stop; the full view always says. */}
              {notesAgent && notes?.status === "error" ? (
                <p className="px-2 pb-2 text-2xs leading-relaxed text-muted-foreground">
                  {notesAgent}
                </p>
              ) : null}
              {notes?.extractionError && (
                <details className="px-2 pb-2 text-xs text-destructive">
                  <summary className="cursor-pointer">
                    {notes.extractionIssue ? "Details" : "Extraction needs attention"}
                  </summary>
                  <p className="mt-2 break-words">{notes.extractionError}</p>
                </details>
              )}
            </>
          )}
        </section>
      </section>
      {brain && (
        <BrainDocumentDialog
          document={view === "notes" ? (notes?.notes ?? null) : null}
          initial={notes?.notes ?? undefined}
          environmentId={environmentId}
          workspaceId={brain.id}
          onClose={() => setView(null)}
          details={notesAgent}
        />
      )}
      <BrainGraphDialog
        open={view === "brain"}
        onOpenChange={(open) => {
          if (!open) {
            setView(null);
          }
        }}
        title={brain?.name ?? "Brain"}
        knowledge={response?.state.database.status === "ready" ? brain?.knowledge : undefined}
        highlightedNodeIds={consultedNodeIds}
      />
    </>
  );
}

/** The one-line state of the chat's conversation notes under the notes preview. */
function chatNotesStatus(input: {
  readonly hasBrain: boolean;
  readonly notes: ChatMemoryList | undefined;
  readonly notesAgentOff: boolean;
  readonly savedNow: boolean;
}): string {
  const { hasBrain, notes, notesAgentOff, savedNow } = input;
  if (!hasBrain) {
    return "This chat has no Brain.";
  }
  if (notesAgentOff) {
    return "The notes agent is off for this chat. Its messages are still recorded and are caught up when it is turned back on.";
  }
  if (notes?.status === "extracting") {
    return "Updating notes, auto-docs, and skills…";
  }
  if (notes?.status === "error") {
    // A recognised cause (signed out, usage limit) says what to do; Flow retries either way.
    return notes.extractionIssue?.message ?? "Extraction needs attention. Flow will retry.";
  }
  if (notes?.status === "disabled") {
    return "Automatic extraction is disabled.";
  }
  if (savedNow) {
    return "Saved just now";
  }
  if (notes?.notes) {
    return "Saved automatically from this conversation";
  }
  return "Ready for conversation notes";
}

/** The chat's own Notes agent choice: follow Settings, or on or off for this chat only. */
function ChatNotesAgentControl({
  notesAgent,
  onChange,
}: {
  readonly notesAgent: NonNullable<ChatMemoryList["notesAgent"]>;
  readonly onChange: ChatBrain["setNotesAgent"];
}) {
  const [pendingChoice, setPendingChoice] = useState<NotesAgentChoice | null>(null);
  const savedChoice = notesAgentChoice(notesAgent.choice);
  const shownChoice = pendingChoice ?? savedChoice;
  const select = (choice: NotesAgentChoice) => {
    if (choice === shownChoice) {
      return;
    }
    setPendingChoice(choice);
    void onChange(notesAgentEnabled(choice)).then((failure) => {
      setPendingChoice(null);
      if (failure) {
        toastManager.add({ type: "error", title: "Notes agent not changed", description: failure });
      }
    });
  };
  let hint = "Only for this chat.";
  if (shownChoice === "default") {
    hint = notesAgent.enabled ? "Follows Settings: on." : "Follows Settings: off.";
  }
  return (
    <div className="flex items-center gap-2 px-2 pb-1">
      <span className="min-w-0 flex-1">
        <span className="block text-xs">Notes agent</span>
        <span className="block text-2xs text-muted-foreground">{hint}</span>
      </span>
      <ToggleGroup
        aria-label="Notes agent for this chat"
        value={[shownChoice]}
        onValueChange={(next) => {
          const choice = next[0];
          if (choice === "default" || choice === "on" || choice === "off") {
            select(choice);
          }
        }}
      >
        <Toggle value="default">Default</Toggle>
        <Toggle value="on">On</Toggle>
        <Toggle value="off">Off</Toggle>
      </ToggleGroup>
    </div>
  );
}

function notesAgentChoice(choice: boolean | undefined): NotesAgentChoice {
  if (choice === undefined) {
    return "default";
  }
  return choice ? "on" : "off";
}

function notesAgentEnabled(choice: NotesAgentChoice): boolean | undefined {
  if (choice === "default") {
    return undefined;
  }
  return choice === "on";
}
