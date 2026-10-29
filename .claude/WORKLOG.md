# Worklog

Updated: 2026-10-29 21:05

## Current focus

- **Topic:** Dev Flow launcher for developing Flow next to the installed Flow
- **Goal:** One command starts the Dev Flow from develop with hot reload on .t3/dev
- **Branch:** feat/dev-flow (topic branch, merged into develop)
- **Last step done:** Unpushed dev-flow commits regrouped on feat/dev-flow; topic-branch rule
- **Next step:** Skip the full web and server rebuild at Dev Flow launch when unchanged
- **Open questions / blockers:** Fork releases needed before the service fix reaches the installed app

## Finished features

- 2026-10-29 - Dev Flow launcher scripts/fork/dev-flow.sh (35a521f5e)
- 2026-10-29 - Service network access fix - merged into develop
- 2026-10-29 - Fork guide in CLAUDE.md - merged into develop

## History

- 2026-10-29 21:05 - One branch per topic; per-commit branches regrouped
- 2026-10-29 20:55 - Dev Flow stops on window close (runner group watcher)
- 2026-10-29 20:45 - Dev Flow log file for agents: .t3/dev/logs/dev-flow.log
- 2026-10-29 20:35 - Dev Flow ran; server CORS lacked flow-dev://app, fixed
- 2026-10-29 20:10 - docs and fix branches merged into develop
- 2026-10-29 19:55 - Supervisor networkAccess, /network-access, desktop follows attached service
- 2026-10-29 19:45 - CHANGELOG.md and worklog started on develop
- 2026-10-29 19:20 - T3 v0.1.5 trial merge: 228 conflicts, postponed as own project
- 2026-10-29 19:00 - Remotes upstream and t3 added, develop created from main
