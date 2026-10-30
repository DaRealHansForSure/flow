#!/usr/bin/env node
// @effect-diagnostics nodeBuiltinImport:off globalConsole:off
import * as NodeChildProcess from "node:child_process";
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeUtil from "node:util";

import { resolvePlanFollowUpSubmission } from "@t3tools/shared/proposedPlanText";
import { planRevisionCases } from "./cases.ts";
import { gradePlanRevision, toolCalls, type ToolCall } from "./grade.ts";

const { values } = NodeUtil.parseArgs({
  options: {
    out: { type: "string" },
    model: { type: "string", default: "haiku" },
    samples: { type: "string", default: "3" },
    case: { type: "string" },
  },
});
if (!values.out) throw new Error("Use --out <directory>.");
const outputDirectory = NodePath.resolve(values.out);
const samples = Number(values.samples);
const selected = values.case?.split(",");
NodeFS.mkdirSync(outputDirectory, { recursive: true });

const rows: Array<{
  id: string;
  sample: number;
  mode: string;
  calls: ToolCall[];
  pass: boolean;
  detail: string;
}> = [];
for (const fixture of planRevisionCases) {
  if (selected && !selected.includes(fixture.id)) continue;
  // The app sends exactly this text and mode for the composer's Revise or Accept.
  const submission = resolvePlanFollowUpSubmission({
    draftText: fixture.draft,
    planMarkdown: fixture.plan,
  });
  // The thread's earlier plan turn is replayed as context in the same prompt.
  const prompt = `Earlier in this conversation you proposed this plan:\n\n${fixture.plan}\n\n---\n\n${submission.text}`;
  for (let sample = 1; sample <= samples; sample += 1) {
    const sampleDirectory = NodeFS.mkdtempSync(NodePath.join(outputDirectory, `${fixture.id}-`));
    const workspace = NodePath.join(sampleDirectory, "project");
    // Claude Code only honours a plans folder inside the project.
    const plansDirectory = NodePath.join(workspace, ".plans");
    for (const [file, contents] of Object.entries(fixture.files)) {
      NodeFS.mkdirSync(NodePath.dirname(NodePath.join(workspace, file)), { recursive: true });
      NodeFS.writeFileSync(NodePath.join(workspace, file), contents);
    }
    const run = NodeChildProcess.spawnSync(
      "claude",
      [
        "-p",
        prompt,
        "--model",
        values.model,
        "--permission-mode",
        submission.interactionMode === "plan" ? "plan" : "acceptEdits",
        "--strict-mcp-config",
        "--setting-sources",
        "project",
        // Plan files stay in the run folder instead of the user's Claude profile.
        "--settings",
        JSON.stringify({ plansDirectory: "./.plans" }),
        "--output-format",
        "stream-json",
        "--verbose",
      ],
      { cwd: workspace, encoding: "utf8", timeout: 300_000 },
    );
    NodeFS.writeFileSync(NodePath.join(sampleDirectory, "transcript.jsonl"), run.stdout ?? "");
    const calls = toolCalls(run.stdout ?? "");
    const grade = gradePlanRevision({
      expect: fixture.expect,
      calls,
      stepScripts: fixture.stepScripts,
      ...(fixture.stepFiles ? { stepFiles: fixture.stepFiles } : {}),
      plansDirectory,
    });
    rows.push({ id: fixture.id, sample, mode: submission.interactionMode, calls, ...grade });
    console.log(`${fixture.id} #${sample}: ${grade.pass ? "pass" : "FAIL"} (${grade.detail})`);
  }
}
NodeFS.writeFileSync(NodePath.join(outputDirectory, "results.json"), JSON.stringify(rows, null, 2));
const summary = planRevisionCases
  .filter((fixture) => !selected || selected.includes(fixture.id))
  .map((fixture) => {
    const runs = rows.filter((row) => row.id === fixture.id);
    const passed = runs.filter((row) => row.pass).length;
    // A case fails when half or more of its samples fail.
    return `${passed * 2 > runs.length ? "pass" : "FAIL"}  ${fixture.id}  ${passed}/${runs.length}`;
  });
NodeFS.writeFileSync(NodePath.join(outputDirectory, "summary.txt"), `${summary.join("\n")}\n`);
console.log(summary.join("\n"));
