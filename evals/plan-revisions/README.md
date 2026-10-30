# Plan revisions

Checks that feedback typed while a proposed plan waits makes the agent revise the plan, not carry out its steps, and that accepting the plan still starts the work.

## Run

```sh
cd evals
pnpm plan-revisions --out runs/plan-revisions
pnpm plan-revisions --out runs/plan-revisions --case narrow-to-first-steps --samples 1
```

- It runs the local Claude Code CLI (`claude -p`) in a fresh project folder per sample, holding the small scripts the plan's steps run. A revision runs in plan mode and an accepted plan with edits allowed, the modes the app uses. No MCP servers and no user settings are loaded, and plan files go to the run folder.
- The text it sends comes from `resolvePlanFollowUpSubmission` in `apps/web/src/proposedPlan.ts`, so the eval always tests the current wording. The earlier plan turn is replayed as context at the top of the prompt.
- `--model` defaults to `haiku`; `--samples` defaults to 3.
- A run writes `results.json` (tool calls and verdict per sample), `summary.txt`, and each sample's transcript.

## Grading

Carrying out a step means running one of the case's step scripts or writing a project file. Looking around and writing the plan file is planning. A revision passes when no step was carried out; an accepted plan passes when one was. A case fails when half or more of its samples fail. `run.test.ts` tests the grader.

## Cost

Each sample is one short Haiku session; a full run is 12 sessions.

## Add a case

Add an entry to `cases.ts` with an `id`, a `source`, the `plan`, the user's `draft`, the project `files`, the `stepScripts` its steps run, and whether the agent should `revise` or `implement`.
