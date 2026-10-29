import { findProjectByPath } from "@t3tools/client-runtime/state/projects";
import type { AgentSessionProjectCandidate, EnvironmentId, ProjectId } from "@t3tools/contracts";

const RECENT_PROJECT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_SELECTION_MIN_THREADS = 3;

/** Treat candidates missing git as repositories for servers predating git scans. */
export function partitionOnboardingProjects<T extends AgentSessionProjectCandidate>(
  candidates: ReadonlyArray<T>,
  now = Date.now(),
) {
  const cutoff = now - RECENT_PROJECT_WINDOW_MS;

  return {
    available: candidates,
    recent: candidates.filter((candidate) => {
      if (candidate.git === null) return false;
      if (candidate.threadCount < DEFAULT_SELECTION_MIN_THREADS) return false;
      if (candidate.lastActiveAt === null) return false;
      const lastActiveAt = Date.parse(candidate.lastActiveAt);
      return lastActiveAt >= cutoff && lastActiveAt <= now;
    }),
  };
}

export interface OnboardingProjectGroup<T> {
  readonly key: string;
  readonly label: string;
  readonly repository: string | null;
  readonly candidates: ReadonlyArray<T>;
  readonly threadCount: number;
  readonly lastActiveAt: string | null;
}

function latestActivity(left: string | null, right: string | null): string | null {
  if (left === null) return right;
  if (right === null) return left;
  return left > right ? left : right;
}

export function groupOnboardingProjects<
  T extends Pick<
    AgentSessionProjectCandidate,
    "path" | "title" | "git" | "threadCount" | "lastActiveAt"
  >,
>(candidates: ReadonlyArray<T>) {
  const groups = new Map<string, OnboardingProjectGroup<T> & { candidates: Array<T> }>();
  const other: Array<T> = [];

  for (const candidate of candidates) {
    if (candidate.git === null) {
      other.push(candidate);
      continue;
    }
    const git = candidate.git ?? { remoteKey: null, repository: null };
    const key = git.remoteKey === null ? `path:${candidate.path}` : `remote:${git.remoteKey}`;
    const existing = groups.get(key);
    if (existing === undefined) {
      groups.set(key, {
        key,
        label: git.repository ?? candidate.title,
        repository: git.repository,
        candidates: [candidate],
        threadCount: candidate.threadCount,
        lastActiveAt: candidate.lastActiveAt,
      });
      continue;
    }
    existing.candidates.push(candidate);
    groups.set(key, {
      ...existing,
      threadCount: existing.threadCount + candidate.threadCount,
      lastActiveAt: latestActivity(existing.lastActiveAt, candidate.lastActiveAt),
    });
  }

  const repositories = [...groups.values()].sort((left, right) => {
    if (left.lastActiveAt === right.lastActiveAt) return left.label.localeCompare(right.label);
    if (left.lastActiveAt === null) return 1;
    if (right.lastActiveAt === null) return -1;
    return right.lastActiveAt.localeCompare(left.lastActiveAt);
  });

  return { repositories, other };
}

/** Use the server's project match before the client snapshot, which can lag behind the scan. */
export function resolveOnboardingProjectId(
  projects: ReadonlyArray<{
    readonly id: ProjectId;
    readonly environmentId: EnvironmentId;
    readonly workspaceRoot: string;
  }>,
  environmentId: EnvironmentId,
  candidate: Pick<AgentSessionProjectCandidate, "path" | "projectId">,
): ProjectId | null {
  if (candidate.projectId !== undefined) return candidate.projectId;
  const environmentProjects = projects.filter((project) => project.environmentId === environmentId);
  const currentRootMatch = findProjectByPath(environmentProjects, candidate.path);
  if (currentRootMatch !== undefined) return currentRootMatch.id;
  return null;
}

export function resolveOnboardingLandingProject<T>(
  selection: ReadonlyArray<string>,
  projectsWithImportedHistory: ReadonlyMap<string, T>,
  completedProjects: ReadonlyMap<string, T>,
): T | undefined {
  for (const path of selection) {
    const project = projectsWithImportedHistory.get(path);
    if (project !== undefined) return project;
  }
  for (const path of selection) {
    const project = completedProjects.get(path);
    if (project !== undefined) return project;
  }
  return undefined;
}

export function splitOnboardingProjectPath(path: string): {
  readonly name: string;
  readonly parent: string;
} {
  if (/^[A-Za-z]:[\\/]+$/.test(path) || /^[\\/]{2}[^\\/]+[\\/][^\\/]+[\\/]*$/.test(path)) {
    return { name: path, parent: "" };
  }
  const trimmed = path.replace(/[\\/]+$/, "");
  const separatorIndex = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
  if (trimmed.length === 0) return { name: path, parent: "" };
  if (separatorIndex < 0) return { name: trimmed, parent: "" };
  return { name: trimmed.slice(separatorIndex + 1), parent: trimmed.slice(0, separatorIndex + 1) };
}

export function onboardingProjectKey(environmentId: EnvironmentId, path: string): string {
  return JSON.stringify([environmentId, path]);
}

/** Compare server-returned canonical macOS paths with paths chosen in the browser. */
export function projectIsWithinFolder(project: string, folder: string): boolean {
  const normalize = (value: string) =>
    value
      .replaceAll("\\", "/")
      .replace(/^\/private\/tmp(?=\/|$)/, "/tmp")
      .replace(/\/$/, "");
  const root = normalize(folder);
  const candidate = normalize(project);
  return candidate === root || candidate.startsWith(root + "/");
}

/** Internal indexer directories are not user projects. Temporary folders require an explicit choice. */
export function isSuggestedBrainProject(
  path: string,
  chosenFolders: readonly string[] = [],
): boolean {
  const normalized = path.replaceAll("\\", "/");
  if (/\/(?:userdata\/brain\/workspaces|\.t3\/worktrees)\//.test(normalized)) return false;
  if (/\/data\/projects\/[^/]+\/workspace\/repos\//.test(normalized)) return false;
  if (chosenFolders.some((folder) => projectIsWithinFolder(path, folder))) return true;
  return !/^(?:\/private)?\/tmp(?:\/|$)|^\/private\/var\/folders\//.test(normalized);
}

/** Match HTTPS/SSH GitHub URLs using repository identity, never directory names. */
export function githubRepositoryKey(value: string): string | null {
  const cleaned = value.trim().replace(/^git@github\.com:/i, "https://github.com/");
  const match =
    /^(?:https?:\/\/github\.com\/|ssh:\/\/git@github\.com\/)?([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/i.exec(
      cleaned,
    );
  return match ? `${match[1]}/${match[2]}`.toLowerCase() : null;
}

/** Reuse the nearest known parent project; internal indexing clones never qualify. */
export function matchGithubProjects(
  repository: string,
  candidates: readonly AgentSessionProjectCandidate[],
  projects: readonly { path: string; title: string; projectId?: ProjectId | undefined }[],
  chosenFolders: readonly string[] = [],
): AgentSessionProjectCandidate[] {
  const key = githubRepositoryKey(repository);
  if (!key) return [];
  const matches = new Map<string, AgentSessionProjectCandidate>();
  for (const candidate of candidates) {
    if (!isSuggestedBrainProject(candidate.path, chosenFolders)) continue;
    if (!candidate.git?.repository || githubRepositoryKey(candidate.git.repository) !== key)
      continue;
    const parent = projects
      .filter(
        (project) =>
          isSuggestedBrainProject(project.path, chosenFolders) &&
          projectIsWithinFolder(candidate.path, project.path),
      )
      .sort((a, b) => b.path.length - a.path.length)[0];
    const path = parent?.path ?? candidate.path;
    const { projectId: _checkoutProjectId, ...checkout } = candidate;
    matches.set(
      path,
      parent
        ? {
            ...checkout,
            path,
            title: parent.title,
            alreadyImported: Boolean(parent.projectId),
            ...(parent.projectId ? { projectId: parent.projectId, alreadyImported: true } : {}),
            git: path === candidate.path ? candidate.git : null,
          }
        : candidate,
    );
  }
  return [...matches.values()];
}

/** A folder offered for a remote Brain source counts only when its origin is that repository. */
export function folderMatchesRemoteSource(
  repository: string,
  origin: string | null | undefined,
): boolean {
  const key = githubRepositoryKey(repository);
  const originKey = origin ? githubRepositoryKey(origin) : null;
  return key !== null && originKey !== null && key === originKey;
}

export interface RemoteBrainSourceMatch {
  /** The remote Brain's repository URL, as the Brain reports it. */
  readonly repository: string;
  readonly candidates: readonly AgentSessionProjectCandidate[];
}

/**
 * Line a connected remote Brain's indexed repositories up with local checkouts
 * so onboarding can preselect them. Sources not cloned here or not on GitHub
 * come back as `unmatched`; two sources for one GitHub repository count once.
 */
export function matchRemoteBrainSources(
  repositories: readonly string[],
  candidates: readonly AgentSessionProjectCandidate[],
  projects: readonly { path: string; title: string; projectId?: ProjectId | undefined }[],
  chosenFolders: readonly string[] = [],
): { matched: readonly RemoteBrainSourceMatch[]; unmatched: readonly string[] } {
  const matched: RemoteBrainSourceMatch[] = [];
  const unmatched: string[] = [];
  const seen = new Set<string>();
  for (const repository of repositories) {
    const key = githubRepositoryKey(repository);
    if (key === null) {
      if (!seen.has(repository)) {
        seen.add(repository);
        unmatched.push(repository);
      }
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    const found = matchGithubProjects(repository, candidates, projects, chosenFolders);
    if (found.length === 0) unmatched.push(repository);
    else matched.push({ repository, candidates: found });
  }
  return { matched, unmatched };
}
