# Worklog

Updated: 2026-10-30 21:00

## Current focus

- **Topic:** release 0.2.1 prep: phone, Brain page and No project polish
- **Goal:** ship Plan mode and today's chat, Brain and phone changes as service and desktop 0.2.1
- **Branch:** develop (pushed up to 0697c3631 = 0.2.1-dev.6; 36 commits since, not pushed)
- **Last step done:** No project chats only read their Brain and stay out of project lists
  (server and web, merged from fix/no-project-temporary); Connected projects as a searchable,
  sortable table with tap hints; per-terminal font zoom; rendered pages open on tap; Brain tab
  remembers sections; graph Fit button; two T3 security fixes cherry-picked; FORK.md and
  CHANGELOG tidied. Dev web against the live service: `node scripts/dev-runner.ts dev:web
  --port 3773 --share` on https://nixda.tail096d14.ts.net:5733/
- **Next step:** push develop and build 0.2.1-dev.7 when the owner says so (server changes need
  it); then the T3 sync (157 commits) or background task output
  (.plans/background-task-output.md)
- **Open questions / blockers:**
  - Removing notes recorded from earlier No project chats, and the scratch folder's old Brain
    binding, deletes Brain data: only with the owner's yes.
  - No project chats follow the normal settle rules (owner); phone scroll loss after closing
    Usage is ignored for now (owner).
  - feat/windows-desktop stays unmerged; no shims for the Play Store T3 app; the eval plan files
    in the Claude profile stay (owner).

## Finished features

- 2026-10-30 - No project chats only read their Brain and are not projects; Connected projects table; source search; terminal font zoom; rendered pages open on tap; Brain tab memory; graph Fit; provider removal; About order; dev bundling page fits phones (develop)
- 2026-10-30 - Status pill, Steer/Queue long press, background work list, touch-sized buttons, full-width phone menus, context window colours, update dialog versions (develop)
- 2026-10-30 - Agents tab, Chat font, sidebar follows Last user message, browser zoom and globe pill, docked browser, Revise reworks the plan, FalkorDB crash fix (develop)
- 2026-10-30 - Chunked chat history, file panel, Brain dot, phone composer bar, Plan ready badge, Read image thumbnails, About versions (develop)
- 2026-10-30 - Plan as a permission mode with Plan tab, Accept/Revise/Decline, comments, Reopen (merged into develop)
- 2026-10-30 - Flow runs only while the app is open; app keeps the service at its version; installs and releases from the fork (develop)
- 2026-10-30 - Brain tab, close confirmation, Auto-Docs/Auto-Skills switches, uninstall-flow.sh, graph dialog (develop)
- 2026-10-29 - T3 Code v0.1.5 sync, telemetry opt-in, mobile Brain screen (merged into develop)
- 2026-10-29 - Brain backup script, Pull requests switch, service network access, Dev Flow launcher (merged into develop)

## History

- 2026-10-30 21:00 - FORK.md, CHANGELOG and worklog tidied; tap hints in the projects table
- 2026-10-30 20:45 - No project chats only read their Brain, hidden from project lists (merged)
- 2026-10-30 20:30 - Projects table: icons, middle-cut paths, state hints, picker above it
- 2026-10-30 20:15 - Connected projects table, terminal font zoom and pinch fix, inlined start logo
- 2026-10-30 19:55 - Two T3 security fixes cherry-picked; open-panel arrows; larger terminal buttons
- 2026-10-30 19:45 - Brain tab remembers sections; provider removal; graph Fit; No project send fix
- 2026-10-30 19:30 - Tests fixed (onboarding import, bundled dev); 0.2.1-dev.6 built, develop pushed
- 2026-10-30 19:05 - Phone polish from live dev web review; first page 5 turns
- 2026-10-30 17:40 - 0.2.1-dev.5 built and develop pushed
- 2026-10-30 16:30 - Browser zoom, Agents tab, globe pill, composer contrast, FalkorDB crash fix
- 2026-10-30 15:25 - Chunked chat loading, file panel; AppImages 0.2.1-dev.2 to dev.4
- 2026-10-30 13:45 - Plan permission mode steps 1 to 8 and Reopen merged
- 2026-10-30 02:05 - App-only mode merged, AppImage rebuilt
- 2026-10-30 00:50 - Service version sync; Brain moved into the right panel
- 2026-10-29 23:15 - T3 v0.1.5 sync merged into develop
- 2026-10-29 21:05 - One branch per topic; Dev Flow launcher and log
- 2026-10-29 19:45 - CHANGELOG.md and worklog started; remotes and develop set up
