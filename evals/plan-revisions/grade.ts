export interface ToolCall {
  readonly name: string;
  readonly path?: string;
  readonly command?: string;
}

/** Tool calls of a Claude CLI `stream-json` transcript, in order. */
export function toolCalls(transcript: string): ToolCall[] {
  const calls: ToolCall[] = [];
  for (const line of transcript.split("\n")) {
    if (!line.trim().startsWith("{")) continue;
    const event = JSON.parse(line) as {
      type?: string;
      message?: {
        content?: ReadonlyArray<{
          type?: string;
          name?: string;
          input?: { file_path?: string; path?: string; command?: string };
        }>;
      };
    };
    if (event.type !== "assistant") continue;
    for (const part of event.message?.content ?? []) {
      if (part.type !== "tool_use" || !part.name) continue;
      calls.push({
        name: part.name,
        ...(part.input?.file_path || part.input?.path
          ? { path: part.input.file_path ?? part.input.path }
          : {}),
        ...(part.input?.command ? { command: part.input.command } : {}),
      });
    }
  }
  return calls;
}

const FILE_TOOLS = new Set(["Write", "Edit", "MultiEdit", "NotebookEdit"]);

/**
 * Carrying out a step means running one of the plan's step scripts or changing a project file.
 * Reading, listing and writing the plan file itself (under `plansDirectory`) is planning.
 */
function stepWork(
  call: ToolCall,
  steps: { readonly scripts: ReadonlyArray<string>; readonly files: ReadonlyArray<string> },
  plansDirectory: string,
) {
  if (FILE_TOOLS.has(call.name)) return !(call.path ?? "").startsWith(plansDirectory);
  // A research step is carried out by reading or searching the files it names.
  const touchesStepFile = steps.files.some(
    (file) => (call.path ?? "").endsWith(file) || (call.command ?? "").includes(file),
  );
  if (touchesStepFile) return true;
  if (call.name !== "Bash") return false;
  // Running a step script counts; reading it (cat, grep) does not.
  return steps.scripts.some((script) =>
    new RegExp(
      String.raw`\b(?:python3?|sh|bash|node)\s+(?:\S+\s+)*\S*` + escapeRegExp(script),
    ).test(call.command ?? ""),
  );
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

/** A revision passes when no step ran; an accepted plan passes when its work started. */
export function gradePlanRevision(input: {
  readonly expect: "revise" | "implement";
  readonly calls: ReadonlyArray<ToolCall>;
  readonly stepScripts: ReadonlyArray<string>;
  readonly stepFiles?: ReadonlyArray<string>;
  readonly plansDirectory: string;
}) {
  const steps = { scripts: input.stepScripts, files: input.stepFiles ?? [] };
  const worked = input.calls.filter((call) => stepWork(call, steps, input.plansDirectory));
  const summary = worked
    .map((call) => call.command ?? `${call.name} ${call.path ?? ""}`)
    .join("; ");
  if (input.expect === "revise") {
    return {
      pass: worked.length === 0,
      detail: worked.length === 0 ? "revised" : `ran ${summary}`,
    };
  }
  return {
    pass: worked.length > 0,
    detail: worked.length > 0 ? `started: ${summary}` : "did not start the work",
  };
}
