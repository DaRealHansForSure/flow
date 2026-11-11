# Worklog

Updated: 2026-11-11 23:58

## Current focus

- **Topic:** Release 0.2.4 (service and desktop): Update all for connected environments
- **Goal:** `flow-v0.2.4` published with the service and the desktop app from `release`
- **Branch:** develop; `main` and `release` carry 0.2.4
- **Last step done:** 0.2.4 branches rebuilt and force-pushed; old 0.2.4 tags removed
- **Next step:** delete the old "Flow 0.2.4" release on GitHub, then run "Flow release" on `release` with 0.2.4
- **Open questions / blockers:** `flowApplyBrowserUpdate` missing in `CLIENT_GUARDED_RPC_SCOPES`; `origin/feat/windows-desktop` unmerged

## Finished features

- 2026-11-11 - Update all for connected environments (PR #1, da71751cf), merged into develop
- 2026-10-31 - Release 0.2.3 (service and desktop): Forget this device, Windows bundle, Background status
- 2026-10-31 - Security review fixes F2-F4, plan feedback, Android Chrome Back, Windows bundle (develop)
- 2026-10-31 - Phone navigation fixes and T3 Code sync of 31 Oct (develop)
- 2026-10-31 - Shared desktop icon sizes, plan revise with attachments, red Stop, panel tab frame
- 2026-10-31 - Release 0.2.2 (service and desktop) published from release
- 2026-10-31 - Brain tab sections, sidebar layout, touch sizes, CI fixes (develop)
- 2026-10-31 - Flow CI, T3 workflows removed, No project cleanup, Cite and composer fixes
- 2026-10-30 - MCP view: MCP tab, /mcp, Providers MCP section, folded provider cards
- 2026-10-30 - Side fixes: agents pill, phone Back and swipes, usage chip, keyboard guard
- 2026-10-30 - No project chats read only their Brain; Connected projects table; source search
- 2026-10-30 - Status pill, Steer/Queue long press, background work list, touch-sized buttons
- 2026-10-30 - Agents tab, Chat font, browser zoom, docked browser, FalkorDB crash fix
- 2026-10-30 - Chunked chat history, file panel, Brain dot, phone composer bar, About versions
- 2026-10-30 - Plan permission mode: Plan tab, Accept/Revise/Decline, comments, Reopen
- 2026-10-30 - Flow runs only while the app is open; installs and releases from the fork
- 2026-10-30 - Brain tab, close confirmation, Auto-Docs/Auto-Skills switches, uninstall-flow.sh
- 2026-10-29 - T3 Code v0.1.5 sync, telemetry opt-in, mobile Brain screen
- 2026-10-29 - Brain backup script, Pull requests switch, service network access, Dev Flow launcher

## History

- 2026-11-11 23:58 - 0.2.4 branches rebuilt and force-pushed; release run waits for the owner
- 2026-11-11 23:27 - 0.2.4 cut from develop after PR #1; worklog compacted to the limits
- 2026-10-31 15:45 - 0.2.3 released (service and desktop), main merged back into develop
- 2026-10-31 14:50 - `chore/brain-deps` merged: fastify 5, MCP SDK 1.32
- 2026-10-31 12:00 - T3 sync merged into develop after the four test lanes
- 2026-10-31 03:30 - 0.2.2 released
- 2026-10-31 02:25 - develop pushed, CI quick tests fixed, full suites running for 0.2.2
- 2026-10-31 01:00 - CI fixed, scratch cleanup merged
- 2026-10-30 23:45 - feat/mcp-view merged into develop
- 2026-10-30 23:10 - Part 1 side fixes committed on develop
- 2026-10-30 21:00 - FORK.md, CHANGELOG and worklog tidied; tap hints in the projects table
- 2026-10-30 20:45 - No project chats only read their Brain, hidden from project lists
- 2026-10-30 20:15 - Connected projects table, terminal font zoom and pinch fix
- 2026-10-30 19:55 - Two T3 security fixes cherry-picked; larger terminal buttons
- 2026-10-30 19:30 - Tests fixed; 0.2.1-dev.6 built, develop pushed
- 2026-10-30 16:30 - Browser zoom, Agents tab, globe pill, composer contrast, FalkorDB crash fix
- 2026-10-30 13:45 - Plan permission mode steps 1 to 8 and Reopen merged
- 2026-10-30 02:05 - App-only mode merged, AppImage rebuilt
- 2026-10-29 23:15 - T3 v0.1.5 sync merged into develop
- 2026-10-29 21:05 - One branch per topic; Dev Flow launcher and log
