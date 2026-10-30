# Worklog

Updated: 2026-10-30 23:10

## Current focus

- **Topic:** side fixes from the Brain settings chat (Part 1 of the plan)
- **Goal:** phone and chat polish first, then Brain settings in one place (Part 2)
- **Branch:** develop (Part 1 merged, nothing pushed)
- **Last step done:** agents pill and Agents tab rows, subagent window, usage chip, Revise, plan
  header, phone Back and swipes, terminal buttons, keyboard guard, work-row colours and sizes
- **Next step:** owner checks Part 1 on the phone and says when to run tests; then Part 2
  (Brain settings, plan in the Claude profile plans folder)
- **Open questions / blockers:**
  - Tests written but not run: threadHistoryPaging, ThreadFind, usageLimitTone, phoneNavigation.
  - feat/windows-desktop stays unmerged; no shims for the Play Store T3 app.

## Also open: MCP view

- **Topic:** MCP view (feat/mcp-view, 4 commits on develop 7ab8f4c49, not merged, not pushed)
- **Goal:** let the user see the MCP servers of the chat's running agent: MCP tab in the right
  panel (`/mcp`, command palette, + menu) and an MCP servers section in Settings > Providers
- **Last step done:** server RPC providerMcp.list (live sessions only, never starts one),
  Claude/Codex/OpenCode adapters, MCP tab and Settings section; checked live in `vp run dev`
  with a Haiku chat: t3-code, desigma, rea and Claude Docs shown, `/mcp` sends no turn
- **Next step:** owner review; merge feat/mcp-view into develop with --no-ff when the owner
  says so. Later steps: reconnect/enable/sign-in actions, a check without a running chat,
  config-file listing for Cursor and Antigravity
- **Open questions / blockers:**
  - `vp run check:changed` fails only on apps/desktop typecheck (warning in
    src/preview/Manager.ts, also on develop); everything else passes.
  - Claude status during a running turn is untested (owner did not OK the paid check).

## Finished features

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
