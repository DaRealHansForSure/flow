/**
 * Which directory under `$HOME` a T3 base dir defaults to. An install with
 * `~/.t3/userdata` stays in `~/.t3`: moving it would orphan FalkorDB stores and
 * worktree `gitdir:` pointers. Fresh installs get `~/.flow`. Callers pass the
 * existence check in. Unrelated to the worktree `.t3` in `./devHome.ts`.
 */

export type JoinPath = (first: string, ...segments: string[]) => string;

const LEGACY_BASE_DIR_NAME = ".t3";
const DEFAULT_BASE_DIR_NAME = ".flow";

/** The path whose existence means "an install already lives at `~/.t3`". */
export const legacyBaseDirProbePath = (homeDirectory: string, joinPath: JoinPath): string =>
  joinPath(homeDirectory, LEGACY_BASE_DIR_NAME, "userdata");

/**
 * The base dir to use: an explicit selection (`T3CODE_HOME`, `--base-dir`) wins,
 * then the adopted legacy home, then the fresh-install default. The explicit
 * value is returned verbatim apart from trimming; resolving `~` or relative
 * paths belongs to the caller that knows its own cwd.
 */
export const resolveHomeBaseDir = (input: {
  readonly explicit: string | undefined;
  readonly homeDirectory: string;
  readonly joinPath: JoinPath;
  readonly legacyHomeExists: boolean;
}): string => {
  const explicit = input.explicit?.trim();
  if (explicit !== undefined && explicit.length > 0) {
    return explicit;
  }
  return input.joinPath(
    input.homeDirectory,
    input.legacyHomeExists ? LEGACY_BASE_DIR_NAME : DEFAULT_BASE_DIR_NAME,
  );
};
