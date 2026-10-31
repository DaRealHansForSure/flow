# This fork of Flow

This repository is [DaRealHansForSure/flow](https://github.com/DaRealHansForSure/flow). It
builds on two projects: [T3 Code](https://github.com/pingdotgg/t3code), a desktop and web app
for running coding agents, and [Flow](https://github.com/samyakkkk/flow), which adds a Brain to
T3 Code (a knowledge graph of your code, conversation notes, Auto-Docs and Auto-Skills). This
fork takes Flow, keeps it close to both projects, and adds the changes listed below. Every week or
two it merges Flow's `release` branch and T3 Code's `main`; [CLAUDE.md](./CLAUDE.md) describes
the remotes, branches and sync steps for maintainers, and [CHANGELOG.md](./CHANGELOG.md) lists
every change.

## What is different

### Brain

- **Pick a Brain for a chat without a project.** A "No project" chat starts with no Brain; the
  menu on the new-chat screen gives it one of your Brains, and the chat keeps that choice. You
  get the Brain's memory in quick one-off chats without creating a project first.
- **No project chats only read.** They never write to their Brain: no conversation notes,
  Auto-Docs or Auto-Skills, and the agent's save tools refuse them. Their folder is not a project
  either, so it stays out of Settings, the Brain page and every project picker.
- **Turn the notes agent off.** The notes agent is the background helper that writes a chat's
  conversation notes, Auto-Docs and Auto-Skills. Settings > General > Brain > Notes agent turns
  it off everywhere, and the Notes agent choice in a chat's Brain tab (Default, On or Off)
  decides for that one chat. While it is off the chat still has its Brain and its tools, and its
  messages are still recorded, so turning the agent back on catches up on what it missed.
- **Turn Auto-Docs and Auto-Skills off.** The same settings section has a switch for each, and a
  project can override them in the Brain section of its settings. Notes keep being written and
  existing documents stay searchable, so you choose what the notes agent writes without losing
  anything.
- **The notes agent runs your CLI directly.** It starts `claude`, `codex` or `opencode` itself
  instead of going through Flow's old provider adapters, and its sessions show up in that CLI's
  own history, so you can see what it did.
- **A tidier Brain page.** Connected projects is a searchable, sortable table (icon, path, source
  status with an explanation, last index, chats, last activity). The connected sources dialogs can
  be searched, the knowledge graph has a Fit button, and source cards that do not exist yet are
  hidden. The chat's Brain tab remembers which sections you opened.
- **The Brain works with T3 Code's new chat engine.** After the sync with T3 Code v0.1.5, the
  Brain briefs and records chats through the new engine, so orientation and note taking keep
  working on the current T3 Code.

### Chats

- **The Brain is a tab in the right panel.** It can be closed like any other tab, and each chat
  remembers that. A Brain button in the chat header, the panel's new-tab menu and the command
  palette open it again; a dot on the button shows that the Brain is updating the chat's notes.
  In a chat without a Brain the menu entry is greyed out with a hint instead of missing.
- **You see when the Brain has trouble.** The chat's Brain button is amber until the Brain has
  answered and turns red, with the reason on hover, when it fails; a "Brain unavailable" message
  then appears once. The Brain icon in the sidebar's bottom row does the same for the Brain as a
  whole with a small dot: amber while it starts, red when it fails.
- **A chat shows its own Brain.** A chat that picked its own Brain shows that Brain next to it,
  and a "No Brain" chat shows none, instead of the project's Brain.
- **Plan is a permission mode.** Plan sits in the composer's permission picker and can be the
  default. A plan opens in a Plan tab like a `Plan.md`, is answered with Accept, Revise or Decline,
  takes comments on selected passages, keeps its versions and can be reopened. In Plan every
  command asks first.
- **More in the right panel.** Besides the Brain and Plan tabs, an Agents tab lists the chat's
  running and finished agents with their status, model and latest activity, and an MCP tab lists
  the MCP servers of the chat's agent with their status and tools (`/mcp`; tested with Claude).
  The Brain, Agents and MCP tabs share one layout: a header line and labelled sections. The panel
  uses the sidebar's colours, and the terminal and panel buttons show an arrow while their panel
  is open.
- **A status pill above the composer**, as in the mobile app: the turn's agents, background work
  (with the full list one tap away), the working timer, the chat's browsers and queued messages.
  Holding the send button while the agent works offers Steer now or Queue.
- **Usage at a glance.** The model chip under the composer turns amber above 80 % of a usage limit
  and red above 90 %.
- **Work rows by colour.** Thinking, commands, tools, file edits and searches each have a colour,
  and code inside them is set smaller than the answer.
- **Long chats open fast.** A chat opens with its last five turns and loads older ones in chunks
  of five as you scroll up.
- **Browsers, files and pages.** The floating browser can be moved into the right panel and stays
  there for the chat; both can be magnified without zooming the page. Files from chat links open
  on their own, Markdown rendered, with Download. A page the agent rendered opens full screen on a
  tap. Each terminal can get its own font size with a pinch or Ctrl + wheel.
- **"No project" comes first** in the command palette's project list, so a quick chat is one
  keypress away.
- **A loading indicator** shows over the content pane while a page or chat is still loading,
  instead of an empty pane, and it does not push the layout around.

### Phones and touch screens

- **Made for the phone browser.** Side menus open full width and at once, header, sidebar,
  composer and settings buttons are finger-sized, the idle composer looks like a field, Cite works
  after a long press on Android, hints open on a tap, and the start screen shows its logo at once.
- **The chat is the main page.** Back closes menus, full-screen pages and the side panel, then
  opens the projects sidebar; swipes from the screen edges open the side menus.
- **The keyboard stays down** unless you tap the message box: closing a dialog or menu no longer
  raises it, and tapping a side panel tab switches to it instead of closing it.

### Settings

- **Chat font.** Settings > Appearance > Chat font sizes only the chat's text, so the chat can be
  smaller without shrinking the buttons. Highlight code in tool calls turns syntax colours off
  for commands and tool input.
- **No project folders are cleaned up.** Deleting a No project chat deletes its folder, and
  Settings > Maintenance removes folders no chat uses any more after a day.
- **Shorter provider cards.** Each provider's Runtime, Environment, Models and MCP servers fold
  under their own header.
- **Built-in providers can go.** A turned-off Codex or Claude default leaves Settings > Providers;
  Add provider brings it back.

- **Pull requests can be turned off.** Settings > Source Control > Pull requests switches off
  every pull and merge request feature on web, desktop and mobile: no PR lookups, no PR status
  on threads, and git actions that commit and push without opening a PR. Useful when you do not
  work with pull requests, or when your host keeps printing `glab` or `gh` warnings.
- **Network access reaches the Flow service.** Settings > Sharing & access > Network access now
  opens the Flow service to your network and shows its real LAN and Tailscale addresses, so other
  devices can connect. Changing it restarts the service, which ends running chats.

### Desktop

- **Flow runs only while the app is open.** The desktop app starts its own server and stops it
  when you quit, so nothing of Flow keeps running. Quitting ends running chats, phones and other
  devices reach Flow only while the app is open, and the notes agent catches up on missed chat
  messages at the next start. Settings > General > Keep Flow running in the background switches
  to the background service instead; the app restarts to apply either change. On a machine that
  already runs the service, the app asks once at startup: "Switch" stops the service and turns
  off its autostart (it stays installed), "Keep background service" keeps it.
- **One download is enough.** The desktop app (an AppImage) is all you need to install. With
  Keep Flow running in the background on, a first start on a computer without Flow sets up the
  Flow service and the `flow` command for the terminal. The app and the service both update
  from this fork's releases.
- **The app keeps the service at its own version.** Each app release brings its matching
  service. When the app starts and finds an older service, or one installed from upstream Flow,
  it asks first: "Update now" or "Later", and it says whether chats are running, since the
  restart interrupts them. "Later" asks again at the next start. It never moves the service to
  an older version, and your data stays where it is.
- **Closing the window asks first.** On Linux and Windows, closing the window quits Flow, so it
  now asks "Quit Flow?". Tick "Don't ask again", or turn off Settings > General > Confirmations >
  Confirm before closing, to quit straight away.

### Privacy and telemetry

- **Telemetry is off by default.** Flow sends no usage data, no relay connection traces and no
  mobile crash reports unless you turn them on (see [Product usage data](./docs/user/telemetry.md)).
  The welcome screen says so.

### Install and updates

- **Installs and updates come from this fork.** The `flow` command, `install.sh`, `install.ps1`
  and the app's links point at DaRealHansForSure/flow, so `flow update` and the desktop updater
  follow this fork's releases. A machine that has upstream Flow switches once, either by
  accepting the service update the desktop app offers or by running this fork's `install.sh`.
  [Back up first](./docs/user/install.md#back-up-an-existing-flow-first).
- **One release run publishes both parts.** The "Flow release" workflow, run by hand on the
  `release` branch, publishes the service and the desktop app of the same version together, so
  the service version every app asks for exists.
- **Releases build for Linux.** The release workflows no longer build the macOS service bundle
  or macOS desktop apps, so publishing needs no Apple signing keys. The Windows service bundle is
  paused until its build is fixed.

### Development tooling

- **Dev Flow.** `scripts/fork/dev-flow.sh` runs a second Flow from the checkout, with hot reload,
  next to the installed one, so you can change Flow while you keep working in it. It runs its own
  server on its own data in `~/.flow-dev` and never touches the installed service or its `flow`
  command. `--seed` copies a snapshot of your real chats and Brain into it, and `--seed --force`
  throws that copy away and takes a fresh one. Its Brain runs on the system Node
  (`FLOW_BRAIN_NODE`, set by the launcher). Its output is written to
  `~/.flow-dev/logs/dev-flow.log`, and closing the dev window ends the session.
- **Performance log.** Dev builds print `[flow-perf]` lines for renderer stalls over 100 ms,
  slow or large API responses and how long opening a chat takes.
- **Brain backup.** `scripts/fork/backup-brain.sh` copies the Brain (its store and knowledge
  graph), the agent registry and the chats into a dated folder under `~/Backups` with restore
  steps. `--dry-run` shows what it would copy. It needs the Flow service stopped and ends every
  running chat when you pass `--stop-service`.
- **Upstream checks pass.** The fork's code follows T3 Code's lint and knip rules and carries
  license notices for the Brain packages, so the build and the pre-commit hook run as they do
  upstream.
- **Flow CI.** Each push to `develop` or `main` runs format, lint, typecheck and quick tests on
  GitHub's own runners (`flow-ci.yml`). T3 Code's workflows need runners this repository does not
  have, so they are removed, and `scripts/fork/prune-upstream-workflows.sh` removes them again
  after each sync.

## What stays the same

- **Your data stays where it is.** Chats and settings live in `~/.t3` for an existing install
  or `~/.flow` for a fresh one, Brain graphs in `~/.flow-brain`, and release files in
  `~/.local/share/flow-browser`. Switching to this fork moves or converts nothing.
- **Everything else from upstream is kept**: the providers (Codex, Claude Code, Cursor, Grok
  Build, OpenCode, Antigravity and the rest), remote access, the mobile app, the Brain page with
  its Knowledge Graph, Auto-Docs and Auto-Skills, and Cloud Brains.
- **Upstream keeps flowing in.** Each sync brings in new Flow and T3 Code features; the fork's
  own changes are kept small and mostly in separate files so syncing stays cheap.

## In progress

- **Phone navigation, second round.** Phone screens as standalone layers in the browser history,
  and a check of the desktop's side panels and dialogs.
- **Brain settings in one place.** A Settings > Brain page for the agents that index and write
  notes, instructions per Brain and per source, storage, and moving a Brain to another folder.
- Releases so far: 0.2.0 (the first from this fork), 0.2.1 and 0.2.2.

## Platforms

This fork targets Linux x64 (Ubuntu 24.04 or compatible): the desktop app ships as an AppImage,
and the `flow` command and service install with the app or with `install.sh`. Windows x64 still
gets the `install.ps1` bundle, which connects to a Brain hosted on another computer or in Cloud;
there is no Windows desktop app, and that bundle is paused from 0.2.2 until its build is fixed. macOS is not targeted: no macOS builds are published, although
upstream's macOS code is still in the repository.
