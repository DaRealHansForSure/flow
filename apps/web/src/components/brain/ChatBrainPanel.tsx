import { BrainIcon } from "./BrainIcon";
import { useState } from "react";
import * as Schema from "effect/Schema";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import type {
  BrainChatCurationOutput,
  ChatMemoryList,
  EnvironmentId,
  ThreadId,
} from "@t3tools/contracts";
import {
  BrainCircuitIcon,
  ChevronDownIcon,
  BookOpenIcon,
  Maximize2Icon,
  AlertCircleIcon,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { BrainGraph } from "./BrainGraph";
import { BrainGraphDialog, brainGraphCorner } from "./BrainGraphDialog";
import { BrainDocumentDialog, BrainDocumentLibrary } from "./BrainDocuments";
import { ConversationNotesPreview } from "./ConversationNotesPreview";
import { cliName } from "./BrainControls";
import { BrainSectionHeader } from "./BrainSectionHeader";
import { ChatCurationSwitch } from "./ChatCurationSwitch";
import type { ChatBrain } from "./useChatBrain";

const OUTPUT_NEEDS_NOTES_AGENT = "Needs the notes agent.";

/** The Brain tab of a chat's right panel; the chat view keeps its context fresh. */
const NOTES_EXPANDED_KEY = "flow:brain-tab:notes-expanded";
const GRAPH_EXPANDED_KEY = "flow:brain-tab:graph-expanded";
const GraphExpandedSchema = Schema.NullOr(Schema.Boolean);

export function ChatBrainPanel({
  environmentId,
  threadId,
  chatBrain,
}: {
  environmentId: EnvironmentId;
  threadId: ThreadId | null;
  chatBrain: ChatBrain;
}) {
  const { response, brain, error, changedIds, savedNow, setCurationOutput } = chatBrain;
  // Flow: open sections are remembered across tabs, chats and reloads.
  const [notesExpanded, setNotesExpanded] = useLocalStorage(
    NOTES_EXPANDED_KEY,
    true,
    Schema.Boolean,
  );
  // null until the user opens or closes the graph; until then it opens by itself once used.
  const [storedBrainExpanded, setBrainExpanded] = useLocalStorage<boolean | null, boolean | null>(
    GRAPH_EXPANDED_KEY,
    null,
    GraphExpandedSchema,
  );
  const [view, setView] = useState<string | null>(null);
  const failedSources = brain?.sources.filter((source) => source.status === "error") ?? [];
  const notes = response?.chatMemories;
  const consultedNodeIds = [...new Set(notes?.consultedNodeIds ?? [])];
  const consultedNodeCount = consultedNodeIds.length;
  const brainExpanded = storedBrainExpanded ?? consultedNodeCount > 0;
  const curation = brain && threadId ? notes?.curation : undefined;
  const notesAgentOff = notes?.curation?.notesAgent.enabled === false;
  const curationSwitch = (output: BrainChatCurationOutput, label: string) => {
    if (!curation) {
      return null;
    }
    const needsNotesAgent = output !== "notesAgent" && notesAgentOff;
    return (
      <ChatCurationSwitch
        label={label}
        choice={curation[output]}
        disabledHint={needsNotesAgent ? OUTPUT_NEEDS_NOTES_AGENT : undefined}
        onChange={(enabled) => setCurationOutput(output, enabled)}
      />
    );
  };
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
                  onClick={() => setBrainExpanded(!brainExpanded)}
                  className="flex min-w-0 flex-1 items-center gap-2 rounded-xl px-2.5 py-2 text-left hover:bg-muted/60"
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
                    <BrainGraph
                      knowledge={brain.knowledge}
                      highlightedNodeIds={consultedNodeIds}
                      compact
                      corner={brainGraphCorner(() => setView("brain"))}
                    />
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
        <section aria-label="Conversation notes" className="mt-3 border-t border-border/60 pt-3">
          <BrainSectionHeader
            icon={BookOpenIcon}
            label="Conversation notes"
            expanded={notesExpanded}
            onToggle={() => setNotesExpanded(!notesExpanded)}
            actions={curationSwitch("notesAgent", "Notes agent")}
          />
          {notesExpanded && (
            <>
              {notes?.notes ? (
                <div className="relative">
                  <button
                    type="button"
                    aria-label="Read full notes"
                    onClick={() => setView("notes")}
                    className={`w-full rounded-xl py-2 pr-9 pl-2.5 text-left hover:bg-muted/60 ${changedIds.includes(notes.notes.id) ? "bg-primary/5" : ""}`}
                  >
                    <ConversationNotesPreview text={notes.notes.text} />
                    <span className="mt-2 block text-2xs text-primary">Read full notes →</span>
                  </button>
                  <button
                    type="button"
                    aria-label="Read full conversation notes"
                    onClick={() => setView("notes")}
                    className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Maximize2Icon className="size-3.5" />
                  </button>
                </div>
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
        {/* Auto-Docs and Auto-Skills come from the notes agent, so they follow its section. */}
        {brain && (
          <BrainDocumentLibrary
            key={brain.id}
            compact
            environmentId={environmentId}
            workspaceId={brain.id}
            documents={(notes?.documents ?? []).filter((doc) => doc.kind !== "memory")}
            chatSwitches={{
              doc: curationSwitch("autoDocs", "Auto-Docs"),
              skill: curationSwitch("autoSkills", "Auto-Skills"),
            }}
          />
        )}
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
