# Worklog

Updated: 2026-10-30 00:50

## Current focus

- **Topic:** The app keeps the Flow service at its own version (all-in-one AppImage)
- **Goal:** Every AppImage brings its matching service; one release run publishes both
- **Branch:** feat/app-keeps-service-current (worktree .t3/worktrees/service-sync), not merged
- **Last step done:** install-version in flow-release.mjs with repository in receipts;
  desktop version check, native question with running chats, parked update screen with
  retry; flow-release.yml runs the service and desktop release of one version
- **Next step:** Owner review, merge --no-ff into develop; first real check is a release run
  of flow-release.yml on `release`, then an AppImage start on the machine with the upstream
  0.1.15 service (offers the switch to the fork)
- **Open questions / blockers:** An older service that fails to attach as `incompatible`
  gets no update offer yet; window.test.ts relay telemetry case fails on develop already;
  four Brain web tests need a rewrite without react-test-renderer

## Finished features

- 2026-10-30 - Brain tab, close confirmation, Auto-Docs/Auto-Skills switches, lint cleanup (develop)
- 2026-10-29 - T3 Code v0.1.5 sync, telemetry opt-in, mobile Brain screen (merged into develop)
- 2026-10-29 - Brain backup script scripts/fork/backup-brain.sh (merged into develop)
- 2026-10-29 - Pull requests switch in Settings, server to mobile (merged into develop)
- 2026-10-29 - Working Dev Flow: CORS, log file, stop on window close (daf73c209)
- 2026-10-29 - Dev Flow launcher scripts/fork/dev-flow.sh (35a521f5e)
- 2026-10-29 - Service network access fix - merged into develop
- 2026-10-29 - Fork guide in CLAUDE.md - merged into develop

## History

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
