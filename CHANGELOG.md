# Changelog

Changes in this fork (DaRealHansForSure/flow) on top of upstream Flow
(samyakkkk/flow) and T3 Code. Upstream's own changes are listed in their release
notes; only the sync they arrived in is recorded here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Changed

- The "Enjoying T3 Code? Star on GitHub" toast no longer appears; it pointed at T3 Code's
  repository, not this fork.
- Revoking a client, a pairing link or all other clients, and forgetting this device, ask in a
  confirm dialog first.
- The status pill and the scroll-to-end button above the composer keep a visible border at normal
  contrast in every theme, mixed from the theme's text colour.
- The icons under the composer (checkout, branch, permissions) match the header icons: 18 px on
  desktop and 20 px on touch screens.
- Synced with T3 Code main as of 2026-10-31 (414 commits).
- Thinking, command and tool rows between answers use a greyer text colour, mixed from the theme's
  own text and background, so they read apart from the answer in every theme.
- **Update dialog.** Flow, servers and providers are listed the same way, each as one line with
  the version it moves from and to.
- **Update icon.** The sidebar update button takes the theme's primary color while an update is
  waiting or downloading.
- **Desktop icon sizes.** The sidebar's top row (project filter, Add project, New thread) uses
  the same button and icon size as the chat header, and the composer's checkout, branch and
  permissions strip is larger and easier to read.
- **Close buttons.** The close button of dialogs and sheets, such as the Brain graph, has the
  same size as the header controls.
- **Stop button.** The banner of a running or waiting chat stops it with a red stop icon instead
  of a text link.
- **Menus on phones.** Rows of menus, context menus, selects and pickers are a full finger tall
  (44 px) on touch screens, so a tap no longer hits the row next to it.
- **Side panel tabs.** Brain, Agents and MCP share one frame: the header line stays in place while
  the tab scrolls and shows in every state, and loading or empty tabs show the same empty state.

### Fixed

- On a phone, the buttons of a folded settings section (such as Revoke others and Create link
  next to Authorized clients) wrap below its title instead of covering it.
- A subagent's chat shows the task it was given at the top, above "Load earlier turns", while its
  first message is not loaded yet.
- A new chat on the project checkout keeps the branch it started on; preparing its first message
  no longer cleared it.
- On a phone, Cite and the plan's Comment button sit 40 px under the selection, clear of
  Android's selection handle, and are finger-sized.
- A chat's mode, Plan included, now follows the chat on every device: once a message or a plan
  Accept carries the mode to the server, the device drops its own remembered choice. Before, a
  plan accepted on the phone came back as Plan on the PC after a restart.
- On a phone, a resting composer no longer opens when a closing dialog or sheet hands focus back
  to one of its buttons; it opens only for a tap on it or an action like Revise.
- On a phone, the touch that closes a sheet such as Background work no longer opens the resting
  composer underneath it; only a tap that starts on the message field opens it.
- On a phone, closing the Background work list hands focus back to its pill instead of the
  composer's attach button, so a resting composer stays at rest.
- On a phone, coming back from Usage, Settings or another page leaves a resting composer at rest
  instead of opening it without a cursor.
- The "Loading…" pill shown while Settings, Usage or another page opens sits under the header
  again, above everything else; on a phone it was centred behind the composer and barely visible.
- On a phone, Back in a subagent's chat returns to the chat that started it before it opens the
  sidebar, and a reload on Settings, the Brain page or Usage keeps the way back to the chat.
- Picking another Brain on the Brain page no longer adds a page per pick, so Back closes the Brain
  page at once.
- In Chrome on Android, Back in a chat opened straight from a link or after a reload opens the
  sidebar instead of leaving the app. Chrome skipped the history entry Flow added on load.
- On a phone, switching chats from the sidebar or the command palette replaces the page instead of
  adding one, so the browser history no longer grows with every chat.
- **Update icon position.** The sidebar's update icon sits right next to Settings instead of in
  the middle of the row, at the same size as the other sidebar icons.
- **Plan feedback with an attachment.** A message with an image or file sent while a plan waits
  for review now revises the plan, as text-only feedback does, instead of going to the agent as an
  ordinary message.
- **Provider settings.** The folded Runtime, Environment, Models and MCP servers sections keep a
  margin to the sides of the provider card instead of meeting its edge.

### Added

- A paired browser can forget itself: Settings → Sharing & access → Forget this device ends its
  own session without the right to manage other clients; pairing again needs a new code.

## [0.2.2] - 2026-10-31

### Added

- **Phone navigation.** On a phone the chat is the main page. Back closes an open menu or sheet,
  then a full-screen page such as Settings (back to the chat it came from), then the side panel,
  and then opens the projects sidebar; Back in the sidebar returns to the chat. Swiping in from the
  left edge opens the sidebar, from the right edge the side panel, and swiping back toward the
  edge closes it.
- **MCP tab.** The right panel lists the MCP servers of the chat's running agent, grouped into
  Flow, your servers, plugins and claude.ai connectors, with each server's status and tools;
  failed servers and servers that need a sign-in come first. Open it with `/mcp`, **Show MCP
  servers** in the command palette or the panel's + menu. Settings > Providers shows the same list
  per provider, and **Check servers** starts Claude once when no chat runs. Claude, Codex and
  OpenCode report their servers; only Claude has been tested so far.
- **Usage warning on the model chip.** The chip under the composer turns amber when the account
  has used more than 80 % of a usage limit and red above 90 %; its tooltip names the limit and when
  it resets. Coming back to the app refreshes usage that is older than 5 minutes.
- **No project folders are cleaned up.** Deleting a No project chat also deletes its folder under
  `~/.t3/scratch`, unless another chat still works in it. Settings > Maintenance > Delete unused
  No project folders (on, after 1 day) removes folders no chat uses any more.
- **Plain tool input.** Settings > Appearance > Highlight code in tool calls (on by default) shows
  commands and tool input as plain text when off.

### Changed

- **Side panel tabs share one layout.** The Brain, Agents and MCP tabs have a header line (name,
  summary, actions) and sections with a small uppercase label, a count and a divider. The Brain tab
  shows Knowledge graph, Conversation notes, Auto-Docs and Auto-Skills as such sections. The Agents
  tab shows Running, Finished and Related chats, each subagent's status, model and latest activity
  on its row, and Done instead of Idle.
- **Agents in the status pill.** The pill above the composer shows the turn's agents as the mobile
  app does ("2/3" while they work, "3 done" after); tapping it opens the Agents tab. Rows in the
  background work list open their agent's chat; the separate Open button is gone.
- **Sidebar.** The project filter, Add project and New thread sit right-aligned in the top row, and
  the search field below is bordered and full width. The Working, Snoozed and Settled headers look
  like the side panel's sections. The Brain opens from an icon in the bottom row, with an amber dot
  while it starts and a red one when it fails; Settings sits alone at the row's right end.
- **One colour scheme for both sides.** The right side panel, its Plan tab included, uses the left
  sidebar's colours in every theme, on desktop and phone.
- **Control sizes.** Header, side panel, terminal, Usage and Settings header buttons are 32 px with
  18 px icons on desktop and 40 px with 20 px icons on touch screens; the side panel's tabs are a
  step larger, and Usage and Settings headers are as tall as the chat header. On touch screens the
  open composer's send and stop button is 44 px and its attach button 40 px, the sidebar's bottom
  row uses larger icons, and Settings' section list has 40 px rows.
- **Resting phone composer.** The message field and send button are 48 px high, the attach button
  stays left of the field, and files picked there open the composer with the cursor in it.
- **Work rows.** Thinking, commands, tools, file edits and searches each have a colour, on the icon
  and as a rail beside expanded details, and expanded details line up under the row's label. Code
  inside tool calls and thinking uses 80 % of the code font size.
- **Provider settings fold.** Runtime, Environment, Models and MCP servers each fold under a header
  with a short summary, so a provider no longer runs several screens long on a phone.
- **Brain graph buttons.** Fit and Open larger sit in a bordered group on a solid background, like
  the terminal's buttons.
- **Scroll hints.** Settings' section list fades at its top and bottom edges when there is more to
  scroll.
- **No Windows bundle in this release.** The Windows service bundle (`install.ps1`) is not built
  until its build is fixed; Linux is unchanged.

### Fixed

- **Phone sidebar.** It opens as instantly as the right panel, follows the panel animation setting
  (no sliding at 0 ms), and stays open behind the New thread project picker until the new chat
  opens. Opening a chat from it closes the side panel. Its Brain icon no longer flashes amber on
  every open.
- **Phone side panel.** A tap on a tab only switches to it; only the open tab shows its X, and
  closing a view tab offers Undo for a few seconds. The left menu button hides while the panel is
  open, and the panel's tabs start where that button sits.
- **Phone keyboard.** The message box takes the cursor, and raises the keyboard, only when you tap
  it or press Revise on a plan; closing a dialog, sheet or menu no longer brings the keyboard up.
- **Cite.** A long press on an answer offers Cite also while the message box has focus. The Cite
  and Comment buttons appear where the selection ends, also when it was dragged upwards, and a
  selection dragged from above an answer into it cites the answer's part. Cite is a primary button
  the size of Comment, and the resting composer shows a quote as a chip instead of its raw link.
- **Scrolling on touch screens.** An expanded tool call shows its whole content instead of a small
  box that scrolls on its own and stops the chat from scrolling.
- **Plans.** A plan card keeps its menu at the top right and wraps a long title to two lines.
  Revise brings the message box into view with the cursor in it and says "Describe what to change
  in the plan".
- **MCP tab** asks the agent again once the chat's session starts, instead of staying on "The agent
  is not running".
- **"Worked for …"** opens and closes from anywhere on its row.
- **Loading** for pages such as Usage or Settings sits in a solid pill instead of bare text.
- **Settings > About** no longer offers T3 Code's update tracks or its `t3` command; Flow updates
  from this fork's releases only.
- **A chat that cannot be opened** (deleted, or on a computer the app is not connected to) shows
  "This chat could not be opened" after ten seconds, with Go to start and Retry, instead of a blank
  page.

## [0.2.1] - 2026-10-30

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

- The Brain page's sources no longer list cards that are not built yet (Linear, Fireflies.ai,
  Meeting Notes, Slack Bot); only GitHub repositories and local folders remain.
- The Flow logo on the start screen is part of the page itself, so it shows at once on a slow
  connection instead of after the app's first downloads.
- The Brain page's Connected projects is a searchable table with each project's icon, path, source
  status, last index, number of chats and last activity, sortable by clicking a column (the sort is
  remembered). Long paths are cut in the middle; the full path and what each status means open on
  hover or tap. On a phone the rows stack and the sort sits in a menu.
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

- Chats started with No project stay temporary. Their folder no longer appears as a project (in
  Settings, the settings scope picker, the Brain page's Connected projects and its picker, and the
  scheduled task editor), the first message no longer asks to connect it to a Brain, and such a
  chat only reads its Brain: nothing from it is recorded as notes, Auto-Docs or Auto-Skills, the
  agent's save tools refuse it, and the Brain tab says so in place of the curation switches.
- Two security fixes from T3 Code, taken ahead of the next sync: a failed clone no longer shows a
  token from the repository URL, and signed asset and upload URLs stay out of HTTP traces.
- The Brain tab remembers which sections are open (graph, conversation notes, Auto-Docs,
  Auto-Skills) when you switch tabs or chats, and the graph no longer reopens on its own once you
  closed it.
- A built-in provider such as Codex can be removed from Settings > Providers once it is turned off,
  and a turned-off one no longer stays in the list; Add provider brings it back.
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
