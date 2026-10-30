# Worklog

Updated: 2026-10-30 02:05

## Current focus

- **Topic:** First own release 0.2.0 (AppImage plus service from DaRealHansForSure/flow)
- **Goal:** The machine runs this fork's Flow, installed and updated only from the fork
- **Branch:** develop (everything merged; ~4600 commits ahead of origin, not pushed)
- **Last step done:** App-only default merged (own server unless "Keep Flow running in the
  background"); install guide starts with a backup; uninstall-flow.sh; inherited tags removed;
  local AppImage rebuild started into .t3/appimage
- **Next step:** Owner tests the AppImage isolated, then on OK: merge develop into main
  (--no-ff), push develop and main, create `release`, run the "Flow release" workflow with
  0.2.0; on this machine back up, move a stale ~/.t3/userdata/statev2.sqlite aside, start
  the AppImage and answer the switch question
- **Open questions / blockers:** Actions and workflow write permission must be on in the fork;
  the startup switch box, real systemctl timing and the Settings row are untested in a real
  app; codex/opencode curator flags untested; four Brain web tests need a rewrite without
  react-test-renderer; DesktopPreReadyPlatform has 4 failing tests already on develop

## Finished features

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
