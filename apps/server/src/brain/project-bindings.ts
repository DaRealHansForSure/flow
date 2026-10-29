// @effect-diagnostics nodeBuiltinImport:off - Atomic brain association storage.
import * as NodeFSP from "node:fs/promises";
import * as NodePath from "node:path";
import * as NodeCrypto from "node:crypto";
import * as Schema from "effect/Schema";
import type { BrainChatCurationOutput, ProjectId } from "@t3tools/contracts";

const decode = Schema.decodeUnknownSync(Schema.Record(Schema.String, Schema.NullOr(Schema.String)));
type Project = {
  id: ProjectId;
  workspaceRoot: string;
  repositoryIdentity?: { canonicalKey: string } | null | undefined;
};

const threadKey = (threadId: string) => `thread:${threadId}`;
// The notes agent's key predates the others; stored choices keep working under it.
const CURATION_CHOICE_PREFIXES: Record<BrainChatCurationOutput, string> = {
  notesAgent: "notes-agent",
  autoDocs: "auto-docs",
  autoSkills: "auto-skills",
};
const CURATION_OUTPUTS = Object.keys(CURATION_CHOICE_PREFIXES) as BrainChatCurationOutput[];
const threadCurationKey = (threadId: string, output: BrainChatCurationOutput) =>
  `${CURATION_CHOICE_PREFIXES[output]}:thread:${threadId}`;
const CHOICE_ON = "on";
const CHOICE_OFF = "off";

/** A chat's own curation choices; a missing output follows its project or the global setting. */
export type ChatCurationChoices = Partial<Record<BrainChatCurationOutput, boolean>>;

/** A repository's brain is independent of its checkout ids. Null records an explicit disconnect. */
export class ProjectBrainBindings {
  private projects = new Map<ProjectId, string>();
  private choices: Record<string, string | null> = {};
  private readonly directory: string;
  constructor(directory: string) {
    this.directory = directory;
  }
  async initialize() {
    try {
      this.choices = decode(
        JSON.parse(
          await NodeFSP.readFile(NodePath.join(this.directory, "project-brains.json"), "utf8"),
        ),
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  register(project: Project) {
    if (!project.repositoryIdentity && this.projects.has(project.id)) return;
    this.projects.set(
      project.id,
      project.repositoryIdentity?.canonicalKey
        ? `repository:${project.repositoryIdentity.canonicalKey}`
        : `project:${project.id}`,
    );
  }
  configuredProjectIds() {
    return [...this.projects.keys()].filter((id) => Object.hasOwn(this.choices, this.key(id)));
  }
  private key(id: ProjectId) {
    return this.projects.get(id) ?? `project:${id}`;
  }
  members(id: ProjectId) {
    const key = this.key(id);
    return [
      ...new Set([
        id,
        ...[...this.projects].filter(([, value]) => value === key).map(([member]) => member),
      ]),
    ];
  }
  resolve(id: ProjectId, legacy: (id: ProjectId) => string | undefined) {
    const key = this.key(id);
    if (Object.hasOwn(this.choices, key)) return this.choices[key] ?? undefined;
    const previous = new Set(
      this.members(id)
        .map(legacy)
        .filter((value) => value !== undefined),
    );
    if (previous.size > 1)
      throw new Error(
        "This project's checkouts have conflicting brains. Choose one brain for the project in Settings → Projects.",
      );
    return previous.values().next().value;
  }
  idsFor(
    workspace: string,
    legacy: (id: ProjectId) => string | undefined,
    fallback: readonly ProjectId[],
  ) {
    return [...new Set([...this.projects.keys(), ...fallback])].filter((id) => {
      try {
        return this.resolve(id, legacy) === workspace;
      } catch {
        return legacy(id) === workspace;
      }
    });
  }
  async adoptLegacy(resolveCurrent: (id: ProjectId) => string | undefined) {
    const next = { ...this.choices };
    let changed = false;
    for (const id of this.projects.keys()) {
      const key = this.key(id);
      if (Object.hasOwn(next, key)) continue;
      try {
        const workspace = resolveCurrent(id);
        if (workspace) {
          next[key] = workspace;
          changed = true;
        }
      } catch {
        /* Conflicting legacy choices require the user to select one. */
      }
    }
    if (changed) await this.persist(next);
  }
  async bind(id: ProjectId, workspace: string | null) {
    await this.persist({ ...this.choices, [this.key(id)]: workspace });
  }
  /**
   * A chat's own Brain choice (fork): a Brain id, null for an explicit "no
   * Brain", or undefined when the chat follows its project.
   */
  threadChoice(threadId: string): string | null | undefined {
    const key = threadKey(threadId);
    if (!Object.hasOwn(this.choices, key)) {
      return undefined;
    }
    return this.choices[key] ?? null;
  }
  /** Records a chat's Brain (null for none); undefined forgets it so the chat follows its project. */
  async bindThread(threadId: string, workspace: string | null | undefined) {
    const { [threadKey(threadId)]: _previous, ...rest } = this.choices;
    if (workspace === undefined) {
      await this.persist(rest);
      return;
    }
    await this.persist({ ...rest, [threadKey(threadId)]: workspace });
  }
  /**
   * A chat's own choice for one curation output (fork): true or false, or undefined when the
   * chat follows its project or the global setting. Kept beside the chat's Brain choice, on
   * the instance that owns the chat.
   */
  threadCurationChoice(threadId: string, output: BrainChatCurationOutput): boolean | undefined {
    const choice = this.choices[threadCurationKey(threadId, output)];
    if (choice === CHOICE_ON) {
      return true;
    }
    if (choice === CHOICE_OFF) {
      return false;
    }
    return undefined;
  }
  /** All of a chat's own curation choices. */
  threadCurationChoices(threadId: string): ChatCurationChoices {
    const choices: ChatCurationChoices = {};
    for (const output of CURATION_OUTPUTS) {
      const choice = this.threadCurationChoice(threadId, output);
      if (choice !== undefined) {
        choices[output] = choice;
      }
    }
    return choices;
  }
  /** Records a chat's choice for one output; undefined forgets it so the chat follows again. */
  async setThreadCurationChoice(
    threadId: string,
    output: BrainChatCurationOutput,
    enabled: boolean | undefined,
  ) {
    const key = threadCurationKey(threadId, output);
    const { [key]: _previous, ...rest } = this.choices;
    if (enabled === undefined) {
      await this.persist(rest);
      return;
    }
    await this.persist({ ...rest, [key]: enabled ? CHOICE_ON : CHOICE_OFF });
  }
  private async persist(next: Record<string, string | null>) {
    await NodeFSP.mkdir(this.directory, { recursive: true });
    const file = NodePath.join(this.directory, "project-brains.json");
    const temp = `${file}.${NodeCrypto.randomUUID()}.tmp`;
    await NodeFSP.writeFile(temp, JSON.stringify(next, null, 2), { mode: 0o600 });
    await NodeFSP.rename(temp, file);
    this.choices = next;
  }
}
