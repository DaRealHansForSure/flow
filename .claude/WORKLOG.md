# Worklog

Updated: 2026-10-30 14:20

## Current focus

- **Topic:** Release 0.2.1 (everything below is merged into develop, not pushed)
- **Goal:** ship Plan mode and today's fixes as service and desktop 0.2.1
- **Branch:** develop (pushed to origin)
- **Last step done:** chat header measures the room its floating buttons need (no title
  overlap while a chat loads); docs up to date; develop pushed
- **Next step:** release branch: CHANGELOG [Unreleased] -> [0.2.1], merge develop into main
  and release, push and run the "Flow release" workflow (needs the owner's push OK; installing
  restarts flow.service and ends every chat)
- **Open questions / blockers:** Plan fallback for providers without plan mode (step 9,
  optional); feat/windows-desktop waits for the Windows work; the Dev Flow lacks the
  claude_work provider instance

## Finished features

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
