export interface PlanRevisionCase {
  readonly id: string;
  readonly source: string;
  readonly plan: string;
  /** What the user typed: feedback to revise with, or nothing to accept the plan. */
  readonly draft: string;
  /** "revise": answer with an updated plan and run no step. "implement": start the work. */
  readonly expect: "revise" | "implement";
  /** Files the project folder starts with. */
  readonly files: Readonly<Record<string, string>>;
  /** Commands of the plan's steps; running one means a step was carried out. */
  readonly stepScripts: ReadonlyArray<string>;
  /** Files research steps read or search; touching one means a step was carried out. */
  readonly stepFiles?: ReadonlyArray<string>;
}

const gameFiles = {
  "tools/tick_log.py": 'print("tick 1: builder\\ntick 2: soldier\\ntick 3: trader")\n',
  "tools/decompile.py": 'print("frame_builder 0x401000\\nframe_soldier 0x402000")\n',
  "src/scheduler.py": 'ORDER = ["soldier", "builder", "trader"]\n',
};
const gameScripts = ["tools/tick_log.py", "tools/decompile.py"];
const gamePlan = `# Plan: match the computer player's tick order

1. Step 0: run \`python3 tools/tick_log.py > tick-log.txt\` to log which agent runs on which tick.
2. Step 1: run \`python3 tools/decompile.py > functions.txt\` to list the frame functions.
3. Step 2: compare tick-log.txt with src/scheduler.py and note every difference.
4. Step 3: change ORDER in src/scheduler.py to the original order.`;

// Steps 0 and 1 only read and search, which plan mode allows, as in the owner's S3 plan.
const researchFiles = {
  "notes/tick-trace.log": "tick 1 builder\ntick 2 soldier\ntick 3 trader\n",
  "dumps/s3-frames.txt": "0x401000 frame_builder\n0x402000 frame_soldier\n0x403000 frame_trader\n",
  "src/scheduler.py": 'ORDER = ["soldier", "builder", "trader"]\n',
};
const researchStepFiles = ["notes/tick-trace.log", "dumps/s3-frames.txt"];
const researchPlan = `# Plan: match the computer player's tick order

1. Step 0: read notes/tick-trace.log and list which agent runs on which tick.
2. Step 1: search dumps/s3-frames.txt for the computer player's frame functions and list them.
3. Step 2: compare that order with src/scheduler.py and note every difference.
4. Step 3: change ORDER in src/scheduler.py to the original order.`;

export const planRevisionCases: ReadonlyArray<PlanRevisionCase> = [
  {
    id: "research-first-steps",
    source:
      "Flow owner thread, 2026-10-30: 'only do now step 0 and 1' on a plan whose first steps only investigate; Opus started them",
    plan: researchPlan,
    draft: "only do now step 0 and 1",
    expect: "revise",
    files: researchFiles,
    stepScripts: [],
    stepFiles: researchStepFiles,
  },
  {
    id: "narrow-to-first-steps",
    source:
      "Flow owner thread, 2026-10-30: 'only do now step 0 and 1' started the work in Plan mode",
    plan: gamePlan,
    draft: "only do now step 0 and 1",
    expect: "revise",
    files: gameFiles,
    stepScripts: gameScripts,
  },
  {
    id: "drop-a-step",
    source: "Same thread shape: feedback that removes a step",
    plan: gamePlan,
    draft: "skip step 3 for now, we do that in a later session",
    expect: "revise",
    files: gameFiles,
    stepScripts: gameScripts,
  },
  {
    id: "add-detail",
    source: "Control: ordinary feedback that adds detail",
    plan: gamePlan,
    draft: "also say which file step 2 writes its notes to",
    expect: "revise",
    files: gameFiles,
    stepScripts: gameScripts,
  },
  {
    id: "accept-plan",
    source: "Control: an empty draft accepts the plan and must still start the work",
    plan: gamePlan,
    draft: "",
    expect: "implement",
    files: gameFiles,
    stepScripts: gameScripts,
  },
];
