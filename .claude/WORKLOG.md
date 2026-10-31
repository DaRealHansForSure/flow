# Worklog

Updated: 2026-10-31 12:00

## Current focus

- **Topic:** after 0.2.2: phone navigation, T3 Code sync, then Brain settings Part 2
- **Goal:** sync tested and merged; Brain settings Part 2 next (plan file, step 3)
- **Branch:** develop (not pushed; phone navigation and T3 sync merged)
- **Last step done:** T3 Code main synced (414 commits, 19 conflicts), four test lanes run,
  failures fixed or explained; phone composer focus fixes; dev AppImage 0.2.3-dev.1 building
- **Next step:** owner checks phone navigation and composer on the dev server; then Part 2
- **Open questions / blockers:**
  - `dc8fe2f29` (new chats record their branch): its test fails on develop before the sync too;
    the branch is dispatched but missing from the projection. Feature likely not working.
  - T3's new `ChatView.browser.test.tsx` draft test hangs while rendering AppRoot in the fork.
  - Known since 0.2.1: BrainRuntime integration, OpenCode2 plan mode, OpenCode2 text generation
    replay (now 3 tests), storageCleanup submodule test. Load-only flakes in web and browser lanes.
  - Windows service bundle switched off until fixed.

## Finished features

- 2026-10-31 - Phone navigation fixes and T3 Code sync of 31 Oct (develop)
- 2026-10-31 - Shared icon sizes on desktop, plan revise with attachments, red Stop, shared panel tab frame (develop)
- 2026-10-31 - Release 0.2.2 (service and desktop) published from release
- 2026-10-31 - Brain tab sections, sidebar layout, touch sizes, CI fixes (develop, pushed)
- 2026-10-31 - Flow CI, T3 workflows removed, No project cleanup, Cite and composer fixes (develop)
- 2026-10-30 - MCP view: MCP tab, /mcp, Settings > Providers MCP section, folded provider cards (merged into develop)
- 2026-10-30 - Side fixes: agents pill, phone Back and swipes, usage chip, keyboard guard, work-row colours (develop)
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

- 2026-10-31 12:00 - T3 sync merged into develop after the four test lanes
- 2026-10-31 03:30 - 0.2.2 released; suites green apart from issues already in 0.2.1
- 2026-10-31 02:25 - develop pushed, CI quick tests fixed, full suites running for 0.2.2
- 2026-10-31 01:00 - CI fixed, scratch cleanup merged; push and tests waiting
- 2026-10-30 23:45 - feat/mcp-view merged into develop; later: Check servers for Codex and OpenCode
- 2026-10-30 23:10 - Part 1 side fixes committed on develop; tests waiting for the owner
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
