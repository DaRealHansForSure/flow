# Changelog

Changes in this fork (DaRealHansForSure/flow) on top of upstream Flow
(samyakkkk/flow) and T3 Code. Upstream's own changes are listed in their release
notes; only the sync they arrived in is recorded here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Moving the floating browser into the right panel sticks for the chat: browsers the agent
  opens later join the panel as tabs instead of floating over the chat, and closing the panel no
  longer floats one. A tab that arrives while the panel is closed puts a blue dot on the panel
  button until you open it.
- A chat whose plan waits for Accept, Revise or Decline shows a violet "Plan ready" badge in
  the sidebar, in the desktop and web apps, where finished chats show "Done". It does not fade
  like finished chats, and a closed project folder shows its attention dot.
- Settings > About lists the version of each part: the web app, the Flow service it is connected
  to, and the desktop app when it runs in one.
- A step that read an image shows a small thumbnail at the end of its row, in place of its
  time; tapping it opens the picture. A folded group of such steps ("Read 3 files") previews up
  to three of them.
- A Plan tab in the right panel shows the chat's latest plan like an opened `Plan.md`, as
  rendered Markdown or raw text, with Copy, Download and Save as file. It opens on its own
  for each new plan, and from the plan card's menu or the panel's + menu.

- Plans are answered with Accept, Revise or Decline in the composer, the plan card and the
  Plan tab. Accept continues in the chat's permission mode or one picked from its menu, or
  in a new thread; Revise asks for feedback and makes a new version; Decline keeps the chat
  in Plan. Each plan shows its version and whether it was accepted, revised or declined,
  and the Plan tab can show earlier versions.

- Passages of an open plan can be commented on: select text in the plan card or the Plan
  tab, choose Comment and write a note. Each comment becomes a chip in the composer and is
  sent, with the quoted passage, when you Revise.

- An accepted, declined or revised plan can be reopened from its card's menu or the Plan
  tab. The chat goes back to Plan with that version as the open plan, ready to Accept,
  Revise or Decline again; changes already made from it are kept.

### Changed

- The Brain panel is tidier: the Default / On / Off switches drop the "Follows Settings" line
  under them (it moved into their tooltip), and the conversation notes' enlarge button sits in
  the top right of the notes instead of the section header.
- Plan is a permission mode: the fifth entry in the composer's permission picker, shown as a
  "Plan" chip, with Shift+Tab and `/plan` still switching to it. It replaces the separate
  Build/Plan toggle and the Legacy settings switch, and is available for every provider
  that plans.

- While a chat is in Plan, every command asks first with every provider, even in a chat set
  to Full access or Auto. The chat's own mode applies again once it leaves Plan.

- Plan can be the default permission mode (Settings, Threads, Permissions), with an
  "After the plan" row for the mode a thread switches to once its plan is accepted. New
  threads always start with these defaults instead of copying the previous thread's mode.

- The mobile app offers Plan in the thread's Runtime list and as a default in the server
  settings, with an "After the plan" choice; new tasks start with that default. The Legacy
  "Plan Mode" switch is gone.

- The mobile app's plan cards show their version and status and offer Accept (with a menu
  for the permissions to continue in, and Decline), Revise (asks for feedback) and Reopen.

- Running background commands and subagents show as a chip at the end of the chat instead of
  a plain line of text, so their Stop button reads as part of one control.
- Release pages no longer list their files in a table; they link to the install guide
  instead.

### Fixed

- On a phone the composer sits on the bottom edge of the window over an opaque base, so chat
  text no longer scrolls into view below or beside it.

- In the desktop app every button at the top right can be clicked again. A fixed strip kept
  them out of the window's drag area and was too narrow for four buttons, so the leftmost one
  (such as the panel's enlarge button) neither reacted nor changed the pointer. The strip now
  follows the buttons' width. Panel tab close buttons and the notes' enlarge button have
  larger targets.

- With the side panel open, its header no longer repeats the Brain button; the Brain tab and
  the panel's + menu already open it.

- The chat title no longer runs under the buttons at the top right while a chat loads: the
  header measures the room the buttons take instead of guessing it from whether the chat has a
  Brain.

- On a phone the sidebar covers the chat and the side panel cleanly: what is behind it is dimmed,
  and the header and panel buttons no longer show through on top of it.

- The computer picker in Brain settings and "Connect an existing project" search computers and
  projects; they had taken over the Brain picker's "Search Brains" box.

- A chat whose provider instance is missing or turned off says so: its model shows in red,
  a notice links to the provider settings, and sending waits until you pick another model.
  It no longer switches to another instance silently, and Plan can be chosen in it again.

- On a phone the side panel's tabs keep their names: its header no longer repeats the Brain
  button next to the Brain tab, which squeezed a second tab such as Plan.md down to "P…".

- In a narrow Brain panel the Default / On / Off switches move under their section title, so
  "Conversation notes" no longer breaks over two lines.

- Plan titles no longer repeat "Plan": a heading such as "Plan: Add a README" shows as "Add a
  README" in the plan card, the Plan tab, the Plan ready banner and the implementation chat's title.

- On a phone the side panel (Brain, Plan, files) fills the screen instead of leaving a strip of
  cut-off chat text beside it; the sidebar button stays reachable at its top left.

- Cite shows for text selected by long press on a phone. The selection helper treated the
  touch's pointercancel as a dismissal, so touchscreens never saw it.

- The Brain button's dot for notes being written is blue. It used the theme colour, which is
  amber in some themes and looked like a warning.

- The mobile app links bare web addresses in chat in full. Its Markdown parser stopped at
  `=` after a `#`, so a pairing link lost its token, and older builds left such addresses
  as plain text.

## [0.2.0] - 2026-10-30

### Added

- Every release page ends with a table of its files: what each one is and how to use it,
  with the install commands pinned to that version.

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

- Releases no longer carry `install-cloud.sh`, a copy of `install-cli.sh` for upstream's Cloud
  dashboard, and each desktop download gets its own `.sha256` file instead of one `SHA256SUMS`,
  the way the service archive already has one.

- One release page per version: `flow-vX.Y.Z` holds the service and the desktop app, with the
  version's CHANGELOG.md section as its text. The separate `flow-desktop-v*` page, the
  duplicate `flow-cloud-cli-v*` release and the `builder-debug.yml` asset are gone.

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

- The Windows service release builds with the vite-plus version the workspace pins instead of
  an old 0.3.0, whose pnpm misread the lockfile and installed every platform's packages.

- The Windows service release installs only Windows packages again: pnpm 12 no longer expands
  the `FLOW_INSTALL_*` variables in `pnpm-workspace.yaml`, so the release build pins its copy
  to the machine it runs on.

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
