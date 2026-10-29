// @effect-diagnostics globalTimers:off - Captured native child deadline and kill escalation.
// @effect-diagnostics nodeBuiltinImport:off - Native CLI boundary owns the child process lifecycle.
import * as NodeChildProcess from "node:child_process";
import * as NodeReadline from "node:readline";

import type { CuratorProcessExit } from "./curator-cli.ts";

const STDERR_TAIL_CHARACTERS = 8192;
const KILL_ESCALATION_MS = 3000;

interface CuratorProcessOptions {
  readonly cwd: string;
  readonly environment: NodeJS.ProcessEnv;
  /** Written to stdin; a turn can exceed what one command-line argument may hold. */
  readonly input: string;
  readonly signal: AbortSignal | undefined;
  readonly timeoutMs: number;
  readonly platform: NodeJS.Platform;
  readonly onLine: (line: string) => void;
}

/**
 * Runs one curator CLI turn, streaming stdout lines to `onLine`. Resolves with the exit code and a
 * bounded stderr tail; rejects only when the turn was cancelled, timed out or could not start.
 */
export function runCuratorProcess(
  executable: string,
  args: ReadonlyArray<string>,
  options: CuratorProcessOptions,
): Promise<CuratorProcessExit> {
  return new Promise((resolve, reject) => {
    const usesProcessGroup = options.platform !== "win32";
    const child = NodeChildProcess.spawn(executable, args, {
      cwd: options.cwd,
      env: options.environment,
      stdio: ["pipe", "pipe", "pipe"],
      detached: usesProcessGroup,
      windowsHide: true,
    });
    let failure: Error | undefined;
    let escalation: ReturnType<typeof setTimeout> | undefined;
    const kill = (signal: NodeJS.Signals) => {
      try {
        // This group belongs only to the child spawned above.
        if (usesProcessGroup && child.pid) {
          process.kill(-child.pid, signal);
        } else {
          child.kill(signal);
        }
      } catch {
        // Already exited.
      }
    };
    const stop = (reason: Error) => {
      failure ??= reason;
      kill("SIGTERM");
      escalation ??= setTimeout(() => kill("SIGKILL"), KILL_ESCALATION_MS);
      escalation.unref();
    };
    const cancel = () => stop(new Error("Background extraction cancelled."));
    const deadline = setTimeout(
      () => stop(new Error("Background extraction timed out.")),
      options.timeoutMs,
    );
    options.signal?.addEventListener("abort", cancel, { once: true });
    if (options.signal?.aborted) {
      cancel();
    }

    let stderrTail = "";
    child.stderr.on("data", (chunk: Buffer) => {
      stderrTail = (stderrTail + chunk.toString("utf8")).slice(-STDERR_TAIL_CHARACTERS);
    });
    const lines = NodeReadline.createInterface({ input: child.stdout });
    lines.on("line", (line) => {
      try {
        options.onLine(line);
      } catch {
        // A malformed event does not end the turn; the exit status decides.
      }
    });
    // The CLI may exit before reading its input, for example when it is signed out.
    child.stdin.on("error", () => {});
    child.stdin.end(options.input);

    child.once("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") {
        failure ??= new Error(`${executable} is not installed on this computer (ENOENT).`);
      } else {
        failure ??= error;
      }
    });
    child.once("close", (exitCode) => {
      clearTimeout(deadline);
      if (escalation) {
        clearTimeout(escalation);
      }
      options.signal?.removeEventListener("abort", cancel);
      lines.close();
      if (failure) {
        reject(failure);
      } else {
        resolve({ exitCode, stderrTail });
      }
    });
  });
}
