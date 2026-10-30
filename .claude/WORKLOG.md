# Worklog

Updated: 2026-10-30 19:05

## Current focus

- **Topic:** release 0.2.1 prep, phone and status UI polish
- **Goal:** ship Plan mode and today's fixes as service and desktop 0.2.1
- **Branch:** develop (pushed up to aaab3a083 = 0.2.1-dev.5; about 27 commits since, not pushed)
- **Last step done:** status pill above the composer (T3 Android style), Steer/Queue long press,
  background work list, touch-sized header and sidebar buttons, full-width phone menus, idle
  composer field, greyer hint, first history page back to 5 turns (server), provider stack shows
  other kinds only. Dev web runs against the live service: `dev-runner dev:web --port 3773
  --share` on https://nixda.tail096d14.ts.net:5733/
- **Next step:** run the affected test files (owner: tests at the end), then push develop and
  build 0.2.1-dev.6; then background task output (.plans/background-task-output.md)
- **Open questions / blockers:** feat/windows-desktop stays unmerged (owner); no compatibility
  shims for the Play Store T3 app (owner); 21 eval plan files in the Claude profile's plans
  folder stay (owner); server-side changes (FalkorDB fix, branch recording, 5-turn first page)
  need a new AppImage, the dev web cannot show them

## Finished features

- 2026-10-30 - Status pill above the composer, Steer/Queue long press, background work list, Done status for subagents, browser grip and drag fixes, touch-sized buttons, full-width phone menus, context window colours, update dialog versions (develop)
- 2026-10-30 - Agents tab, Chat font, sidebar follows Last user message, browser zoom and globe pill, docked browser fixes, Revise reworks the plan, FalkorDB crash fix, user docs (develop)
- 2026-10-30 - Chunked chat history, file panel (opens alone, rendered Markdown, Download, phone menu), docked browser, Brain dot, phone composer bar, Plan ready badge (develop)
- 2026-10-30 - Phone layout fixes, Read image thumbnails, version info in About, SearchableSelect, React Compiler and test cleanup (develop)
- 2026-10-30 - Plan as a permission mode, steps 1 to 8 plus Reopen (merged into develop)
- 2026-10-30 - Flow runs only while the app is open; backup step in the install guide (develop)
- 2026-10-30 - uninstall-flow.sh, code block download, graph dialog, Brain status colours (develop)
- 2026-10-30 - App keeps the service at its version, release workflow, installs from fork (develop)
- 2026-10-30 - Brain tab, close confirmation, Auto-Docs/Auto-Skills switches, lint cleanup (develop)
- 2026-10-29 - T3 Code v0.1.5 sync, telemetry opt-in, mobile Brain screen (merged into develop)
- 2026-10-29 - Brain backup script scripts/fork/backup-brain.sh (merged into develop)
- 2026-10-29 - Pull requests switch in Settings, server to mobile (merged into develop)
- 2026-10-29 - Working Dev Flow: CORS, log file, stop on window close (daf73c209)
- 2026-10-29 - Dev Flow launcher scripts/fork/dev-flow.sh (35a521f5e)
- 2026-10-29 - Service network access fix - merged into develop
- 2026-10-29 - Fork guide in CLAUDE.md - merged into develop

## History

- 2026-10-30 19:05 - Phone polish from live dev web review; first page 5 turns; worklog updated
- 2026-10-30 18:00 - Dev web served against the live service for live review
- 2026-10-30 17:40 - 0.2.1-dev.5 built and develop pushed
- 2026-10-30 17:05 - User docs and worklog updated for the afternoon changes
- 2026-10-30 16:55 - Revise reworks the plan, branch on checkout chats, floating browser drag, subagent bar, phone composer
- 2026-10-30 16:30 - Browser zoom (pinch, Ctrl+wheel), composer contrast, snooze options on phones, Cite on Android, FalkorDB crash fix
- 2026-10-30 16:10 - Agents tab, globe pill, browser pops out of the panel again
- 2026-10-30 15:50 - Chat font, sidebar chats follow Last user message
- 2026-10-30 16:10 - First page is the newest turn; worklog updated
- 2026-10-30 15:40 - Markdown always opens rendered; AppImage 0.2.1-dev.4
- 2026-10-30 15:25 - Chunked chat loading, file panel Download and phone menu; AppImage 0.2.1-dev.3
- 2026-10-30 14:50 - Docked browser stays, panel dot, Brain dot on real changes, phone composer bar; AppImage 0.2.1-dev.2
- 2026-10-30 14:20 - Measured header room for the floating buttons; develop pushed
- 2026-10-30 14:10 - Phone sheets layer cleanly; fork tests are browser tests; docs updated
- 2026-10-30 13:30 - Read image thumbnails, About versions, SearchableSelect, React Compiler fixes
- 2026-10-30 13:45 - Plan work merged; check fixes merged; visual pass fixes merged

- 2026-10-30 11:45 - Step 7 mobile committed; web fixes from phone tests merged (Cite on touch, chips, comments)

- 2026-10-30 12:40 - Reopen for closed plans committed (owner request while testing)

- 2026-10-30 12:10 - Plan permission mode step 6 committed (comments on plan passages)

- 2026-10-30 11:20 - Plan permission mode step 5 committed (Accept, Revise, Decline)

- 2026-10-30 10:15 - Plan permission mode step 4 committed (Plan tab)

- 2026-10-30 09:30 - Plan permission mode step 3 committed (Settings default, After the plan)

- 2026-10-30 09:00 - Plan permission mode step 2 committed (Supervised in Plan)

- 2026-10-30 08:50 - Plan permission mode step 1 committed on feat/plan-permission-mode

- 2026-10-30 02:05 - app-only merged, 67 focused tests pass, AppImage rebuild started
- 2026-10-30 01:50 - backup-brain.sh refuses --stop-service from inside Flow; install guide backup step
- 2026-10-30 00:50 - Service version sync: decision, wording, update runner tested with fakes only
- 2026-10-30 00:10 - Brain moved into the right panel as a tab; header button with update dot
- 2026-10-29 23:15 - Sync merged into develop; built server boots, Brain API answers
- 2026-10-29 22:45 - Sync: tests ran only after server pinned catalog typescript (one vitest copy)
- 2026-10-29 21:30 - Sync: Brain hooks into RunExecutionService via BrainChatTurns reference
- 2026-10-29 23:55 - backup-brain.sh: dry run lists 2.6G Brain, 5.8G chats; refuses with service up
- 2026-10-29 22:50 - [flow-perf]: routes 22-40 s on first open, Babel/React Compiler per module
- 2026-10-29 22:30 - pullRequestsEnabled: server gates, capability folding, web and mobile
- 2026-10-29 21:40 - Server traces: chat open 1-50ms server side, slowness is renderer
- 2026-10-29 21:05 - One branch per topic; per-commit branches regrouped
- 2026-10-29 20:55 - Dev Flow stops on window close (runner group watcher)
- 2026-10-29 20:45 - Dev Flow log file for agents: .t3/dev/logs/dev-flow.log
- 2026-10-29 20:35 - Dev Flow ran; server CORS lacked flow-dev://app, fixed
- 2026-10-29 20:10 - docs and fix branches merged into develop
- 2026-10-29 19:55 - Supervisor networkAccess, /network-access, desktop follows attached service
- 2026-10-29 19:45 - CHANGELOG.md and worklog started on develop
- 2026-10-29 19:20 - T3 v0.1.5 trial merge: 228 conflicts, postponed as own project
- 2026-10-29 19:00 - Remotes upstream and t3 added, develop created from main
