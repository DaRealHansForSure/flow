# Changelog

Changes in this fork (DaRealHansForSure/flow) on top of upstream Flow
(samyakkkk/flow) and T3 Code. Upstream's own changes are listed in their release
notes; only the sync they arrived in is recorded here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Pinch on a phone or Ctrl + mouse wheel on a computer changes one terminal's font size, in the
  bottom drawer and in the right panel; other terminals keep theirs. A badge shows the size and
  resets it.
- The knowledge graph has a Fit button beside Open larger, in the Brain tab, on the Brain page and
  in the large view, that centres and fits the graph again after you moved or zoomed it.
- One status pill stays above the composer instead of scrolling with the chat, as in the mobile
  app: background work with its Stop button, how long the thread has been working, its browsers
  and its queued messages, with a round button beside it to scroll back to the end. Tapping the
  background work lists every running command and subagent by its full name with what it is doing,
  and opens a subagent's thread; on a phone the list opens as a bottom sheet.
- On web and desktop, holding the send button while the agent works (or right-clicking it) opens a
  menu to Steer now or Queue the message, as in the mobile app.
- A globe in the status pill shows how many browsers the chat has open while none is on screen; it
  opens the newest in the side panel and carries a dot for new ones.
- The browser panel and the floating browser can be magnified on your screen without zooming the
  page: pinch with two fingers on a phone, or Ctrl + mouse wheel or a trackpad pinch on a computer.
  A badge shows the zoom and resets it.
- Moving the floating browser into the right panel sticks for the chat: browsers the agent opens
  later join the panel as tabs instead of floating over the chat. A tab that arrives while the
  panel is closed puts a blue dot on the panel button until you open it. Popping a browser out of
  the panel again floats the chat's later browsers too.
- An Agents tab in the right panel (+ > Agents, or G) lists the chat's active and previous agents,
  the overview T3 Code dropped when it replaced its Agents panel. It uses the panel's full height,
  lists every agent without "Show more", and indents the agents under each section. Its titles and
  rows line up with the Brain tab's.
- Settings > Appearance > Chat font sizes only the text of chat messages (70 to 130 % of the
  interface size), so the chat can be smaller without shrinking buttons the way browser zoom does.
- The file panel has a Download button for the open file. On phones its actions (rendered view,
  word wrap, preview browser, download, file tree) sit in one menu instead of a row of icons.
- A chat whose plan waits for Accept, Revise or Decline shows a violet "Plan ready" badge in the
  sidebar, in the desktop and web apps, where finished chats show "Done". It does not fade like
  finished chats, and a closed project folder shows its attention dot.
- Settings > About lists the version of each part together under the update track: the web app,
  the Flow service it is connected to, and the desktop app when it runs in one.
- A step that read an image shows a small thumbnail at the end of its row, in place of its time;
  tapping it opens the picture. A folded group of such steps ("Read 3 files") previews up to three
  of them.
- A Plan tab in the right panel shows the chat's latest plan like an opened `Plan.md`, as rendered
  Markdown or raw text, with Copy, Download and Save as file. It opens on its own for each new
  plan, and from the plan card's menu or the panel's + menu.
- Plans are answered with Accept, Revise or Decline in the composer, the plan card and the Plan
  tab. Accept continues in the chat's permission mode or one picked from its menu, or in a new
  thread; Revise asks for feedback and makes a new version without carrying out the plan's steps;
  Decline keeps the chat in Plan. Each plan shows its version and whether it was accepted, revised
  or declined, and the Plan tab can show earlier versions.
- Passages of an open plan can be commented on: select text in the plan card or the Plan tab,
  choose Comment and write a note. Each comment becomes a chip in the composer and is sent, with
  the quoted passage, when you Revise.
- An accepted, declined or revised plan can be reopened from its card's menu or the Plan tab. The
  chat goes back to Plan with that version as the open plan, ready to Accept, Revise or Decline
  again; changes already made from it are kept.

### Changed

- In a No project chat the Brain tab says the chat only reads the Brain, in place of the notes,
  Auto-Docs and Auto-Skills switches.
- The Brain page's sources no longer list cards that are not built yet (Linear, Fireflies.ai,
  Meeting Notes, Slack Bot); only GitHub repositories and local folders remain.
- The Flow logo on the start screen is part of the page itself, so it shows at once on a slow
  connection instead of after the app's first downloads.
- The Brain page's Connected projects is a searchable table: each project's path, source status,
  last index, number of chats and last activity, sortable by clicking a column (the sort is
  remembered). On a phone the rows stack and the sort sits in a menu.
- A page the agent rendered in chat (a chart, diagram or mockup) opens full screen when you tap or
  click it, like an image, instead of through a small button in its corner; it is interactive in
  the full-screen view. On a phone that view's close button stays on the screen.
- The terminal's split, new and close buttons are larger, with 16 px icons, in the bottom drawer
  and in the right panel.
- The terminal and right panel buttons at the top right show an arrow while their panel is open, like
  the sidebar toggle, so you can see at a glance what is open.
- Long chats open with their last five turns (at most 300 entries) and load older turns in chunks
  of five as you scroll up, instead of the last ten at once behind a "Load earlier turns" button.
- On a phone both side menus open across the full width. The side panel (Brain, Plan, files) fills
  the screen without its maximize button and its edge, and the sidebar button stays reachable at
  its top left.
- On touch screens the chat header, right panel header and sidebar icon buttons (Settings, Pull
  requests, Usage, filter, add project, new thread) are 40 px with 20 px icons, whatever the font
  size.
- The composer stands out more from the chat history in light and dark themes: a tinted surface and
  a visible outline, mixed from the theme's own colours. On a phone it is a full-width, square bar
  on the bottom edge over an opaque base, so chat text no longer scrolls into view below or beside
  it.
- On a phone the idle composer shows "Ask anything..." in a rounded, outlined field, so it reads as
  a place to type; the send button and model chip line up with it.
- The composer's "Ask anything" hint is a clear grey, so in a dark theme it no longer looks like
  text you typed.
- The context window indicator turns amber from 80 % and red from 90 %, so a filling context shows
  before it compacts.
- The update dialog names the app Flow instead of T3 Code, and lists each provider with the version
  it moves from and to (for example Claude 2.1.300 → 2.1.308).
- In the folder sidebar every thread uses two lines, with its provider icon always at the end of
  the second line, also when the thread has no branch.
- The sidebar shows a thread's earlier provider only when it was a different kind, so a switch
  between two setups of the same provider no longer shows its logo twice.
- In the command palette's project list, No project has a second line like the projects, so every
  row is as tall and easy to tap.
- With the Working section turned off, the sidebar's chat list follows Project order: on "Last user
  message" the chat you last wrote in comes first. Created at and Manual keep the fixed, draggable
  order.
- The floating browser has a grip in its top-left corner that is always visible, so it is easy to
  grab and move.
- In a subagent's chat, the bar in place of the composer matches the composer: the status is a chip
  with a dot that shows whether it still runs, and Open parent is a real button.
- A file opened from a link in the chat (or from search) opens on its own, without the file tree
  beside it, and Markdown files always open rendered; switching to the source applies to that file
  only. The tree and the source view are still one click away.
- The Brain panel is tidier: the Default / On / Off switches drop the "Follows Settings" line under
  them (it moved into their tooltip), the conversation notes' enlarge button sits in the top right
  of the notes instead of the section header, and the "Flow" title above the Brain is gone.
- Plan is a permission mode: the fifth entry in the composer's permission picker, shown as a "Plan"
  chip, with Shift+Tab and `/plan` still switching to it. It replaces the separate Build/Plan
  toggle and the Legacy settings switch, and is available for every provider that plans.
- While a chat is in Plan, every command asks first with every provider, even in a chat set to Full
  access or Auto. The chat's own mode applies again once it leaves Plan.
- Plan can be the default permission mode (Settings, Threads, Permissions), with an "After the
  plan" row for the mode a thread switches to once its plan is accepted. New threads always start
  with these defaults instead of copying the previous thread's mode.
- The mobile app offers Plan in the thread's Runtime list and as a default in the server settings,
  with an "After the plan" choice; new tasks start with that default. The Legacy "Plan Mode" switch
  is gone.
- The mobile app's plan cards show their version and status and offer Accept (with a menu for the
  permissions to continue in, and Decline), Revise (asks for feedback) and Reopen.
- Release pages no longer list their files in a table; they link to the install guide instead.

### Fixed

- The No project folder no longer shows up as a project in Settings, the settings scope picker,
  the Brain page's Connected projects and its Connect an existing project picker, or the scheduled
  task editor.
- A chat started with No project only reads its Brain: nothing from it is recorded as notes,
  Auto-Docs or Auto-Skills, the agent's save tools refuse it, and its folder can no longer be
  connected to a Brain.
- Two security fixes from T3 Code, taken ahead of the next sync: a failed clone no longer shows a
  token from the repository URL, and signed asset and upload URLs stay out of HTTP traces.
- The Brain tab remembers which sections are open (graph, conversation notes, Auto-Docs,
  Auto-Skills) when you switch tabs or chats, and the graph no longer reopens on its own once you
  closed it.
- A built-in provider such as Codex can be removed from Settings > Providers once it is turned off,
  and a turned-off one no longer stays in the list; Add provider brings it back.
- Sending the first message of a No project chat no longer asks to connect the scratch folder to a
  Brain; the Brain picker above the composer (or No Brain) already decides it.
- An empty composer's send button looks disabled (grey) instead of a ready blue, also in the
  collapsed phone composer.
- On a phone the composer no longer grows a few pixels when text arrives: the stop button is as big
  as the send button.
- Finished subagents show Done (or how they ended) in Lineage and the Agents tab, matching the
  subagent bar, instead of Idle.
- Coming back to the web app after its tab was in the background for a while (for example a
  minimised browser on a phone) reconnects within a few seconds instead of waiting up to 15 seconds
  on a connection the browser had already dropped.
- A new chat on a project's own checkout shows its branch in the sidebar again: the server records
  the branch the checkout is on when the chat starts, unless a branch was picked.
- The floating browser can be dragged over the chat history on a wide window instead of stopping at
  an invisible column beside the chat.
- Settings > Threads > Snooze options fit a phone screen instead of pushing the page sideways.
- Selecting text with a long press on an Android phone shows the Cite button again. The selection
  helper treated the touch's pointercancel as a dismissal.
- A dropped connection to the Brain's FalkorDB no longer takes the whole Flow server down, and every
  running chat with it.
- In the desktop app every button at the top right can be clicked again. A fixed strip kept them
  out of the window's drag area and was too narrow for four buttons, so the leftmost one (such as
  the panel's enlarge button) neither reacted nor changed the pointer. The strip now follows the
  buttons' width. Panel tab close buttons and the notes' enlarge button have larger targets.
- With the side panel open, its header no longer repeats the Brain button; the Brain tab and the
  panel's + menu already open it. On a phone this also keeps a second tab such as Plan.md from
  being squeezed down to "P…".
- The chat title no longer runs under the buttons at the top right while a chat loads: the header
  measures the room the buttons take instead of guessing it from whether the chat has a Brain.
- On a phone the sidebar covers the chat and the side panel cleanly: what is behind it is dimmed,
  and the header and panel buttons no longer show through on top of it.
- The computer picker in Brain settings and "Connect an existing project" search computers and
  projects; they had taken over the Brain picker's "Search Brains" box.
- A chat whose provider instance is missing or turned off says so: its model shows in red, a notice
  links to the provider settings, and sending waits until you pick another model. It no longer
  switches to another instance silently, and Plan can be chosen in it again.
- In a narrow Brain panel the Default / On / Off switches move under their section title, so
  "Conversation notes" no longer breaks over two lines.
- Plan titles no longer repeat "Plan": a heading such as "Plan: Add a README" shows as "Add a
  README" in the plan card, the Plan tab, the Plan ready banner and the implementation chat's title.
- The Brain button's blue dot appears only when the chat's notes really changed, and goes away once
  you open the Brain tab. It used to show whenever the Brain counted as busy, even with the notes
  agent off, and in the theme colour, which is amber in some themes.
- The mobile app links bare web addresses in chat in full. Its Markdown parser stopped at `=` after
  a `#`, so a pairing link lost its token, and older builds left such addresses as plain text.

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
