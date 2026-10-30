# Changelog

Changes in this fork (DaRealHansForSure/flow) on top of upstream Flow
(samyakkkk/flow) and T3 Code. Upstream's own changes are listed in their release
notes; only the sync they arrived in is recorded here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Changed

- Each release page carries its CHANGELOG.md section as its text, the titles say "service" or
  "desktop", and the duplicate `flow-cloud-cli-v*` release and the `builder-debug.yml` asset
  are no longer published.

## [0.2.0] - 2026-10-30

### Added

- The install guide starts with backing up a Flow already in use (`backup-brain.sh`, also
  runnable straight from the release branch), and the README links to it.

- `scripts/fork/uninstall-flow.sh` removes the installed Flow (service, releases, `flow`
  command, AppImages, app settings and menu entries) and never touches chats or the Brain.
  Without `--yes` it only lists what it would remove; it refuses to run from inside Flow.

- Code blocks in chats, Brain documents and file previews have a Download button next to Copy.
  It saves the block through the normal Save dialog or downloads folder. The file takes the
  fence's file name or, without one, the project's name plus date and time with an ending from
  the block's language, e.g. `example-20261030-010203.sh` (`.txt` when the language is unknown).

- The knowledge graph opens in a large dialog: the button beside the counts on the Brain page
  and the one on a chat's graph preview show it near full screen, with the chat's nodes
  still highlighted.

- `dev-flow.sh --seed --force` deletes the Dev Flow's chats and Brain and copies both fresh
  from your real data.

- `dev-flow.sh --seed` also copies your real Brain (store and knowledge graph) into the Dev
  Flow, so it looks like your real setup; the copy's paths point at the Dev Flow's own data.

- CLAUDE.md guide for maintaining the fork: remotes, branches, syncing with upstream
  Flow and T3 Code, upstream naming, and the owner's working rules.
- `scripts/fork/dev-flow.sh`: starts the Dev Flow from the checkout with hot reload on
  isolated data, optionally seeded from a snapshot of the real chats. Its output is also
  written to `~/.flow-dev/logs/dev-flow.log`, and closing the dev window ends the session.
- `scripts/fork/backup-brain.sh`: backs up the Brain (store, knowledge graph, agent registry)
  and the chats into a dated folder with restore steps. `--dry-run` lists what it would copy;
  it refuses to run while `flow.service` is active unless `--stop-service` is given.

- Renderer performance log (`apps/web/src/debug/devPerformanceLog.ts`): `[flow-perf]` console
  lines for renderer stalls over 100 ms with the scripts behind them, slow or large API
  responses, and how long each route change (opening a chat) takes. On in dev builds,
  elsewhere via `localStorage.setItem("flow:perf-log", "1")`.

- Settings > Source Control > Pull requests: turns every pull/merge request feature off. The
  server stops PR lookups (no more `glab`/`gh` calls or warnings), threads show no PR status,
  git actions offer commit and push without a PR, and the Pull Requests page disappears, on
  web, desktop and mobile.

- Settings > General > Brain: Auto-Docs and Auto-Skills switches turn off what the notes agent
  writes besides conversation notes. Each project inherits them and can override them in its
  project settings; existing docs and skills stay available and searchable.

- Notes agent switch in Settings > General > Brain, and Default / On / Off for one chat in the
  chat's Brain tab. Off, the notes agent writes no notes, Auto-Docs or Auto-Skills for the chat,
  which keeps its Brain briefing and tools; its messages are still recorded, so turning the
  agent back on catches up. Auto-Docs and Auto-Skills are greyed out while it is off.

- A loading indicator in the content pane while a page or chat is still loading, instead of
  an empty pane.

- A chat without a project picks its own Brain or "No Brain" on the new-chat screen; the
  choice stays with the chat.

- On Windows and Linux, closing the desktop window asks "Quit Flow?" before the app quits;
  "Don't ask again" or Settings > General > Confirm before closing turns it off.

- Every desktop release brings its matching Flow service: at start the app offers to update an
  older service, or one installed from another repository, to its own version, says how many
  chats are running, and shows the progress with a retry. "Later" asks again at the next start;
  the service is never downgraded.

### Changed

- Flow runs only while the app is open: the desktop app starts its own server and stops it
  when you quit, instead of attaching to the background service. Settings > General > Keep
  Flow running in the background brings the service back. A machine with the service
  installed is asked once at startup whether to stop it and turn off its autostart.

- The chat's Brain tab lists Conversation notes, with the notes agent switch, before Auto-Docs
  and Auto-Skills, which depend on it.

- The knowledge graph's "open larger" button sits in the graph's top right corner on both the
  Brain page and the chat's Brain tab; the second one in the Brain tab's header is gone.

- Dragging the knowledge graph shows the move cursor.

- The project name in the new-chat headline is shown in the accent colour, so it reads as the
  link that changes the project.

- A chat's Brain tab always shows its Auto-Docs, Auto-Skills and Conversation notes sections,
  each with a Default / On / Off switch for that chat; Default follows the project or Settings,
  and the Auto-Docs and Auto-Skills switches are greyed out while the notes agent is off. The
  whole header bar of each section folds it.

- Clickable controls everywhere show the hand cursor, including plain buttons such as the Brain
  tab's arrows; the Brain tab no longer shows a "Your context" label.

- The Brain entry at the top of the sidebar turns amber while the Brain starts and red when it
  fails, with the reason on hover.

- The chat's Brain button is amber until the Brain has answered. When the Brain fails to
  answer, the button turns red with the reason and a
  "Brain unavailable" toast appears once, instead of the error showing only inside the Brain
  tab.

- FORK.md explains what this fork changes, and the README and user guides match it: Linux
  downloads, opt-in telemetry, the Brain tab and its status colours, per-chat Brains, the notes
  agent switches and the desktop app keeping the service at its version.

- In a chat without a Brain, the right panel lists "Brain" greyed out with a hint instead of
  leaving it out.

- Releases build for Linux only: the macOS service bundle and the macOS desktop builds are
  gone from the release workflows.

- Flow installs and updates from this fork (DaRealHansForSure/flow): the `flow` CLI,
  `install.sh` / `install.ps1` and the app's links point here instead of samyakkkk/flow.

- The Brain next to a chat is now a "Brain" tab in the right panel, so it can be closed
  like any other tab. A chat with a Brain starts with the tab open, and each chat remembers
  when you close it. A Brain button in the chat header opens it (a dot on it while the Brain
  updates the chat's notes), as do the panel's new-tab menu and the command palette. Chats
  without a Brain have no button, and the panel lists "Brain" greyed out.

- "No project" is always the first entry in the command palette's project list, ahead of
  the current project.

- Telemetry is off by default: no usage data, no relay connection traces and no mobile crash
  reports unless you turn them on (`T3CODE_TELEMETRY_ENABLED=true`, Settings > About >
  Diagnostics > Send crash reports on mobile). The welcome screen and the telemetry guide
  say so.

- Synced with T3 Code v0.1.5 (its new chat engine, "No project" chats, Effect 4). The Brain
  now briefs and records chats through the new engine, and the conversation-notes agent
  runs `claude`, `codex` or `opencode` directly. Its sessions now appear in that CLI's own
  history.

- Synced with upstream Flow `release` (flow-v0.1.15): OpenCode CLI capture, notes
  agent on an inexpensive model.

### Fixed

- The Linux service release builds again: it reads pnpm 12's lockfile, which starts with a
  document of its own.

- The Windows service release builds again: the two `@reflink` packages it installs without a
  license file have notices in the third-party license config.

- On Wayland the desktop app no longer logs "'--ozone-platform=wayland' is not compatible with
  Vulkan" at every start; Chromium skips Vulkan there, which it could not use anyway.

- The loading indicator no longer pushes the layout aside while a dialog such as Settings
  loads; it overlays the area instead of taking space.

- Projects connected to a Brain by their repository (most of them) found their Brain again
  after the T3 v0.1.5 sync; chats in them showed no Brain.

- The Dev Flow's Brain starts: its worker runs on the system Node instead of Electron's, which
  cannot load the checkout's better-sqlite3 build.

- A chat that picked its own Brain shows that Brain next to it, and a "No Brain" chat shows
  none, instead of the project's Brain.

- "No project" chats now show in the Dev Flow: its data moved from `.t3/dev` inside the
  checkout to `~/.flow-dev`. `dev-flow.sh` moves an existing `.t3/dev` there once, with its
  Brain graph.

- The web build (and with it the Dev Flow) no longer stops at T3's third-party license check:
  the Brain packages and their redis, bezier-js and reflink dependencies have notices.

- The Dev Flow window no longer fails with "Failed to fetch": the server's development
  CORS list now allows the Flow desktop origins (`flow://app`, `flow-dev://app`).
- Settings > Network access now reaches the Flow service: the service listens on every
  interface when it is on, and Settings shows the service's real LAN and Tailscale
  addresses instead of the unused port 3773. Needs a service built from this fork.
