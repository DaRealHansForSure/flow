import { describe, expect, it } from "vite-plus/test";

import { gradePlanRevision, toolCalls } from "./grade.ts";

describe("plan revision grader", () => {
  const plansDirectory = "/run/case/plans";
  const stepScripts = ["tools/tick_log.py"];
  const grade = (
    expectation: "revise" | "implement",
    calls: Parameters<typeof gradePlanRevision>[0]["calls"],
  ) => gradePlanRevision({ expect: expectation, calls, stepScripts, plansDirectory }).pass;

  it("reads tool calls with their paths and commands", () => {
    const transcript = [
      JSON.stringify({ type: "system", subtype: "init" }),
      JSON.stringify({
        type: "assistant",
        message: {
          content: [
            { type: "tool_use", name: "Bash", input: { command: "ls" } },
            { type: "tool_use", name: "Write", input: { file_path: "/run/case/plans/p.md" } },
          ],
        },
      }),
    ].join("\n");
    expect(toolCalls(transcript)).toEqual([
      { name: "Bash", command: "ls" },
      { name: "Write", path: "/run/case/plans/p.md" },
    ]);
  });

  it("counts running a step or changing a project file as carrying out the plan", () => {
    expect(grade("revise", [{ name: "Bash", command: "python3 tools/tick_log.py" }])).toBe(false);
    expect(grade("revise", [{ name: "Write", path: "/run/case/tick-log.txt" }])).toBe(false);
  });

  it("lets a revision look around and write its plan file", () => {
    expect(
      grade("revise", [
        { name: "Bash", command: "ls -la && cat tools/tick_log.py" },
        { name: "Write", path: "/run/case/plans/plan.md" },
        { name: "ExitPlanMode" },
      ]),
    ).toBe(true);
  });

  it("counts reading a research step's file as carrying out that step", () => {
    const research = (calls: Parameters<typeof gradePlanRevision>[0]["calls"]) =>
      gradePlanRevision({
        expect: "revise",
        calls,
        stepScripts: [],
        stepFiles: ["dumps/s3-frames.txt"],
        plansDirectory,
      }).pass;
    expect(research([{ name: "Grep", path: "/run/case/project/dumps/s3-frames.txt" }])).toBe(false);
    expect(research([{ name: "Bash", command: "cat dumps/s3-frames.txt" }])).toBe(false);
    expect(research([{ name: "Bash", command: "ls dumps" }])).toBe(true);
  });

  it("fails an accepted plan that never starts the work", () => {
    expect(grade("implement", [{ name: "Read", path: "/run/case/README.md" }])).toBe(false);
    expect(grade("implement", [{ name: "Write", path: "/run/case/hello.txt" }])).toBe(true);
  });
});
