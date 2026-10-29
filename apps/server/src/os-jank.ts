import * as HostProcess from "@t3tools/shared/HostProcess";
import {
  listLoginShellCandidates,
  mergePathEntries,
  readEnvironmentFromLoginShell,
  readPathFromLaunchctl,
  resolveWindowsEnvironment,
  setWindowsPath,
} from "@t3tools/shared/shell";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as NodeOS from "node:os";

import { legacyBaseDirProbePath, resolveHomeBaseDir } from "@t3tools/shared/homeBaseDir";

function logPathHydrationWarning(message: string, error?: unknown): void {
  process.stderr.write(
    `[server] ${message} ${error instanceof Error ? error.message : (error ?? "")}\n`,
  );
}

function hydratePosixPath(env: NodeJS.ProcessEnv, platform: NodeJS.Platform): void {
  let shellEnvironment: Partial<Record<string, string>> = {};
  for (const shell of listLoginShellCandidates(platform, env.SHELL)) {
    try {
      // mise's record of the PATH entries it added. It must travel with the
      // shell's PATH, or `mise x` can rebuild PATH behind a same-named wrapper
      // (`exec mise x claude -- claude`) that then re-runs itself forever.
      shellEnvironment = readEnvironmentFromLoginShell(shell, ["PATH", "__MISE_DIFF", "JAVA_HOME"]);
    } catch (error) {
      logPathHydrationWarning(`Failed to read PATH from login shell ${shell}.`, error);
    }

    if (shellEnvironment.PATH) break;
  }

  const shellPath = shellEnvironment.PATH;
  const launchctlPath = platform === "darwin" && !shellPath ? readPathFromLaunchctl() : undefined;
  const mergedPath = mergePathEntries(shellPath ?? launchctlPath, env.PATH, platform);
  if (mergedPath) {
    env.PATH = mergedPath;
  }
  if (shellPath && shellEnvironment.__MISE_DIFF) {
    env.__MISE_DIFF = shellEnvironment.__MISE_DIFF;
  }
  // Android SDK tools are Java programs. A keg-only JDK (Homebrew's openjdk)
  // is only reachable through the JAVA_HOME the shell profile sets.
  if (!env.JAVA_HOME && shellEnvironment.JAVA_HOME) {
    env.JAVA_HOME = shellEnvironment.JAVA_HOME;
  }
}

export function hydratePosixHome(
  env: NodeJS.ProcessEnv,
  resolveHomeDir = () => NodeOS.userInfo().homedir,
): void {
  if ((env.HOME?.trim() ?? "").length > 0) return;

  const homeDir = resolveHomeDir();
  if (homeDir.length > 0) {
    env.HOME = homeDir;
  }
}

/** Keeps a Flow release's bundled runtime (node, git) first on PATH after shell hydration. */
export const preserveBundledRuntimePath = Effect.fn("preserveBundledRuntimePath")(function* (
  env: NodeJS.ProcessEnv,
  platform: NodeJS.Platform,
) {
  const path = yield* Path.Path;
  const fs = yield* FileSystem.FileSystem;
  const executable = yield* HostProcess.ExecutablePath;
  const bin = path.dirname(executable);
  if (path.basename(bin) !== "bin" || path.basename(path.dirname(bin)) !== "runtime") {
    return;
  }
  const root = path.resolve(bin, "../..");
  const bundled = yield* fs
    .exists(path.join(root, "flow-bundle.json"))
    .pipe(Effect.orElseSucceed(() => false));
  if (!bundled) {
    return;
  }
  env.FLOW_BUNDLED_RUNTIME = "1";
  // Login-shell hydration puts Apple's Git stub first on a clean Mac.
  env.PATH = mergePathEntries(
    [bin, path.join(root, "runtime/git/bin")].join(":"),
    env.PATH,
    platform,
  );
});

export const fixPath = Effect.fn("fixPath")(function* (options?: {
  readonly shellEnvironmentPrepared?: boolean | undefined;
}): Effect.fn.Return<void, never, FileSystem.FileSystem | Path.Path> {
  const platform = yield* HostProcess.Platform;
  const env = yield* HostProcess.Environment;

  if (platform === "win32") {
    // Desktop already populated the child env; repeating PowerShell probes costs seconds.
    if (options?.shellEnvironmentPrepared === true) return;
    const repairedEnvironment = yield* resolveWindowsEnvironment(env).pipe(
      Effect.catchDefect((defect) =>
        Effect.sync(() => {
          logPathHydrationWarning("Failed to hydrate PATH from the user environment.", defect);
          return {} as Partial<NodeJS.ProcessEnv>;
        }),
      ),
    );
    for (const [key, value] of Object.entries(repairedEnvironment)) {
      if (value === undefined) continue;
      if (key === "PATH") {
        setWindowsPath(env, value);
      } else {
        env[key] = value;
      }
    }
    return;
  }

  if (platform !== "darwin" && platform !== "linux") return;

  yield* Effect.sync(() => hydratePosixHome(env)).pipe(
    Effect.catchDefect((defect) =>
      Effect.sync(() => {
        logPathHydrationWarning("Failed to hydrate HOME from the user account.", defect);
      }),
    ),
  );
  if (options?.shellEnvironmentPrepared === true) return;
  yield* Effect.sync(() => hydratePosixPath(env, platform)).pipe(
    Effect.catchDefect((defect) =>
      Effect.sync(() => {
        logPathHydrationWarning("Failed to hydrate PATH from the user environment.", defect);
      }),
    ),
  );
  yield* preserveBundledRuntimePath(env, platform);
});

export const expandHomePath = Effect.fn(function* (input: string) {
  const { join } = yield* Path.Path;
  const home = yield* HostProcess.HomeDirectory;
  if (input === "~") {
    return home;
  }
  if (input.startsWith("~/") || input.startsWith("~\\")) {
    return join(home, input.slice(2));
  }
  return input;
});

export const resolveBaseDir = Effect.fn(function* (raw: string | undefined) {
  const path = yield* Path.Path;
  const fs = yield* FileSystem.FileSystem;
  const homeDirectory = yield* HostProcess.HomeDirectory;
  const explicit = raw?.trim();
  const isExplicit = explicit !== undefined && explicit.length > 0;
  // Flow: existing installs keep ~/.t3, fresh installs get ~/.flow (see homeBaseDir.ts).
  const baseDir = resolveHomeBaseDir({
    explicit,
    homeDirectory,
    joinPath: path.join,
    // Only the default branch needs the probe, and an unreadable home must not
    // fail a command that never looks at it.
    legacyHomeExists: isExplicit
      ? false
      : yield* fs
          .exists(legacyBaseDirProbePath(homeDirectory, path.join))
          .pipe(Effect.orElseSucceed(() => false)),
  });
  // `~` expansion and relative paths are the caller's, so only an explicit
  // selection goes through them; the default is already absolute.
  return isExplicit ? path.resolve(yield* expandHomePath(baseDir)) : baseDir;
});
