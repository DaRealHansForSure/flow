# Settings and project overrides

On web and desktop, the "Applying settings for …" sentence at the top of Settings pages picks
the project and environment a change applies to. Pages that only hold device preferences, such as
Appearance, don't show it. They start at **All projects** and **All environments**
and stay selected as you move between categories or search for a setting.

Preferences saved on this device, such as appearance, confirmations and browser profiles, always
show and ignore the selection. Everything else is stored on a server. Choose one environment to
edit its settings, or leave **All environments** to edit every connected environment at once.
Offline environments keep their current values; this is a bulk edit, not a synced global default.

Choose a project to override settings for it on the selected environments. A layers icon beside
each server row's title shows where the value comes from: the built-in default, the environment,
or a project override. Click it to see that chain on every selected environment. An override can
be reset to inherit again. Settings that cannot be overridden by a project are shown read-only
while a project is selected.

When the selected environments disagree, the control shows **Mixed** in place of a value and the
layers icon turns amber. Picking a value applies it to every selected environment.

Changing an environment value never touches a project's own override. When projects override the
setting you are editing, the layers icon counts them and the chain lists each one with its value:
click a project to jump to it, or **Reset all** to make those projects follow the environment
again.

Providers and diagnostics are per machine: they show one environment at a time, the primary
one until you pick another. Every other setting fans out to the selection.

With a project selected, a provider's switch in **Settings → Providers** turns it on or off for
that project only, in either direction: a provider off on the machine can be used in one project,
and one on everywhere can be kept out of another. That project's model pickers follow the switch,
and no new turn there can start on a provider it turned off, including queued messages and
follow-ups from delegated tasks. A turn already running when the switch flips finishes. A delegated
task's result still lands in its parent thread, which sees it on its next turn. Reset returns the project to the
machine's setting. Every other provider setting stays per machine.

On mobile, open **Settings** and use the filter in its header to choose connected environments
and a project. The filter stays available in server-setting pages. With **All projects** selected,
the server-setting pages, such as Threads, Source control and Worktrees, edit the selected
environments' defaults. Choosing a project edits its overrides on the selected
environments. Use **Use defaults** in a page to remove that page's project overrides.
Open **Settings → Projects** to rename the project across its selected
connected checkouts and see where those checkouts live.
Settings that are environment-wide stay read-only while a project is selected. When selected
targets disagree, a control shows **Mixed** until you choose one value. Appearance, keyboard,
and other phone-only settings ignore the filter.

## Worktree branch names

In **Settings → Worktrees → Worktree branch naming**, choose a static prefix,
a model-selected semantic prefix such as `feat/` or `fix/`, or custom instructions
for the complete name. The static prefix defaults to `t3/`; a trailing slash is
optional, and an empty prefix adds nothing. Invalid characters in a static prefix
are replaced with hyphens. Custom instructions are appended to
the naming prompt and can specify issue IDs, namespaces, and casing.

These settings apply to automatically named new worktree branches. Select a project
to override its environment defaults. Worktree directories keep their original names.
If generation fails, or a custom name is invalid or already taken, the temporary
branch name remains.

## Scheduled tasks on mobile

Open **Settings → Scheduled tasks** to create recurring tasks or manage existing
ones across your connected environments. Use the settings filter to narrow the
list by environment or project. Each task runs on the environment you choose,
using its project, model, and workspace settings. Fixed-time schedules use that
environment's time zone, which may differ from your phone's.

Deleting a thread also deletes tasks that post into that thread. Tasks that start
a new thread on each run survive deletion of their previous threads.

You can edit, pause, resume, run immediately, or delete a task from the list.
Webhook tasks only run when their URL is called, so they can't be run
immediately.
Leaving an edited form asks before discarding unsaved changes.

## Webhook automations

In **Settings → Scheduled tasks**, choose **On webhook**
as a task's schedule to run it whenever another service calls its URL, such as
GitHub on a new pull request or a CI job that failed. A public URL needs a
[T3 Connect](remote-access.md) managed tunnel; after you save the task, copy
its URL from the editor. Without one, the editor shows only the URL's path.
**Rotate** replaces the URL and the old one stops working.

The prompt decides what the agent sees. Placeholders pull values out of the
request: `{{body.path}}` for a JSON or form field, `{{headers.name}}`,
`{{query.name}}`, `{{body}}` for the raw body, and `{{request}}` for everything.
For example, `Review this PR: {{body.pull_request.html_url}}` sends only the
pull request link. A placeholder with no value is left empty.

Each value reaches the agent wrapped in `<webhook-data-…>` tags and marked as
untrusted request data. This helps the agent tell it apart from your
instructions, but it doesn't guarantee the agent ignores what the text says.
Inside a value, every `$`, other currency sign and `@`, and a `/` that starts
a lone word, gets an invisible character after it, so mentions like `$skill`,
`@file` and `/command` don't act. Text copied from a value, such as an email
address or a command, carries that character too. Without a signature, anyone
with the URL can start a run with any content. A signature only proves which
service sent the request: a GitHub payload still carries text written by any
GitHub user.

For GitHub, turn on **Require signature**, keep the header
`x-hub-signature-256`, hex encoding and the `sha256=` prefix, and enter the
same secret in the repository's webhook settings with content type
`application/json`. Requests without a valid signature are rejected. Set this
up on desktop or web; mobile keeps an existing signature check but can't turn
one on.

To run only for some requests, add **Filters**. Each one tests a value named
like a placeholder, without the braces, such as `headers.x-github-event` equals
`pull_request` or `body.action` is one of `opened, reopened`. A task runs only
when every filter matches; other requests are answered normally, logged as
**Filtered** with the first filter that failed, and start nothing. Values
compare as text, and a value that is an object or a list only passes
**exists**. Separate **is one of** values with commas; a value can't contain
a comma or start or end with a space.

To suppress repeated deliveries, set a **Replay key** template, such as
`{{headers.delivery-id}}`. The same key is ignored for seven days per task.
To combine a burst, set a **Coalesce key**, such as `{{body.id}}`, and a window
of 10–3600 seconds (120 by default). One run uses the latest body, headers,
and query when the window from the first delivery closes; later requests
do not extend it. Pending windows survive a server restart. Keys must contain
request placeholders; if any placeholder is missing, or the render is empty,
that key's rule is skipped. Clear the templates to turn dedupe off.

Duplicate and coalesced log entries share a limit of 10 per task per minute.
Additional deliveries are accepted without a log entry, and coalesced deliveries
always replace the persisted payload. Coalesced updates count toward a separate
60-per-minute validation limit; exceeding it receives HTTP 429.

On desktop and web, pick **Deliveries** from a task's menu to see recent
requests and the prompt each one produced.

If the environment is offline, the sender gets an error and nothing runs;
redeliver from the sender, such as GitHub's **Recent Deliveries**, once it is
back. To have T3 Connect keep requests instead, turn on **Hold webhooks while
offline** in **Settings → Sharing & access**. T3 Connect then stores requests to a
T3 Connect URL for up to 24 hours and delivers them when the environment
returns. Leave it off if you don't want request bodies stored outside your
machine. To skip requests that waited too long, set **Skip requests older
than** on the task.

## Defaults and inheritance

Threads contains the model and workspace for new threads. Browser controls agent browser
access. Source control contains automatic pull, the default pull request merge method and text
generation. The same rows edit environment defaults or project overrides depending on the
project crumb.

The Projects category, under Code, holds the project's name, icon, actions,
checkouts and removal. Actions belong to a project: editing them creates the project's own list
on each selected environment, and reset returns to the environment's shared list. A project's
`t3.json` actions can be imported there.

Settings a repository can also declare in `t3.json`, such as the workspace for new threads,
resolve in one order: a project override, then the environment setting, then `t3.json`, then the
built-in default. Leave a setting on **Inherit** to let the next tier decide.
Browser access changes apply when an agent session next starts.

New worktrees initialize git submodules recursively. If that step is slow because the repository
declares many nested submodules, set **Submodules** in **Settings → Worktrees** under Advanced (with the project
selected to override it there) to **Top level only** to stop at the ones the repository declares
itself, or **Skip** to leave them for a setup script. It resolves in the same order as the
workspace default: a `"worktreeSubmodules"` value in the `t3.json` of the branch being checked out
applies when the project and environment are both on **Inherit**.

## Worktree location

New worktrees go in the `worktrees` folder of the T3 home directory. To put them somewhere else,
such as another drive, set **Settings → Worktrees → Worktree location** to an absolute path like
`D:\worktrees` or `~/worktrees`. The setting is per machine. Existing worktrees stay where they
are, and cleanup covers both the default folder and the custom one.

## Storage cleanup

Open **Settings → Worktrees → Cleanup** to enable automatic cleanup on one machine or all connected
environments. Policies are off by default and run on the server at startup, when changed, and
hourly. Offline machines keep their existing policies.

Select a project to set **Automatic worktree cleanup** to **Inherit**, **Off**, or **Custom**.
Inherit follows each machine's rules; Off keeps that project's worktrees until you remove them
manually. Custom applies separate worktree rules to the selected project or checkout. Browser
captures and log retention remain machine-wide.

Worktrees can be removed after a chosen number of inactive days, after a thread settles, after
merging, or when they have no commits beyond the default branch. Set settled retention to 0 days
to remove a worktree at the next cleanup after settlement. Only T3-managed worktrees are eligible.
Active sessions and shared worktrees prevent removal. **Keep worktrees with local changes** defaults
to **Uncommitted changes**, which protects tracked edits and untracked files but deletes ignored
files such as `.env` and build output. **Any local files** also protects ignored files other than
`node_modules`. **Edited tracked files** protects only tracked edits and allows untracked and
ignored files to be deleted. Branches and thread history stay; starting another turn recreates the checkout.
Merge cleanup requires a merged pull request whose commits are included in the remote default
branch. A squash or rebase merge on GitHub also counts when the pull request targeted the default
branch and the worktree is still at the pull request's last commit.

Enable **Delete worktrees with deleted threads** to remove safe worktrees after their last
thread is deleted, including archived threads and worktrees left by earlier deletions. The
server waits for sessions and terminals to stop and retries skipped worktrees after restart.
Existing prompts for deleting a worktree manually remain available when this policy is off.

Choose **Delete now** to run the enabled rules immediately. The latest results show which
worktrees were removed or kept and why, plus any failures.
Results also list folders in the worktree folder that no thread uses, with their sizes; cleanup never removes them, so remove them manually if you want.

Browser captures and rotated logs have separate retention periods. Expired capture links stop
working. Current logs, message attachments, and browser profiles are kept.

## Project icons

Select the project and open Project to choose an icon, emoji, monogram, or image. The choice applies to
every checkout in the project group and appears on connected clients. Choose **Automatic** to let
T3 Code detect an icon again.

Choose **Monogram** in the icon picker to set one or two letters or numbers and a color.

When no image is found, web and desktop show a two-character monogram with a color
from the icon palette, derived from the saved project name. For example, `Nebula` becomes `NA`,
`Silver Orchard` becomes `SO`, and `M7 Forge` becomes `M7`.

## Keep the default branch current

In Source control, enable **Automatically pull** to keep the default-branch checkout up to date
with its configured upstream. Choose an environment to set the default or a project to override it.
On mobile, use **Settings → Source control** to change selected environment defaults or project overrides.

T3 Code only pulls when it can fast-forward and the checkout has no changed files, untracked files,
or local commits. It skips checkouts on another branch or without an upstream. If a checkout has
local work, resolve it yourself before automatic pulls can resume.

## Connected Flow brain

Select a project in **Settings → Projects**. The **Brain** section at the top shows its current
brain. Choose another brain, use **New brain** to create and connect one, or select **No brain**
to disconnect. One brain is shared by all checkouts of the same repository, including checkouts
added later. If older checkouts used different brains, choose one for the project to resolve the conflict.

Before the first message in an unconfigured project, Flow offers the same choice. **Continue
without a brain** is remembered for the project across chats and devices. Chats then run
without Flow orientation or memory capture; you can connect a brain later in project settings.

A chat without a project starts with no brain. To give it one, pick a brain from the **No Brain**
menu on the new-chat screen before you send the first message; the chat keeps that choice.

In a chat with a brain, the **Brain** tab of the right panel shows the graph, the chat's
Auto-Docs and Auto-Skills, and the conversation notes. A new chat opens it by itself. Close it like any other tab and that chat
keeps it closed; the Brain button in the chat header, the panel's new-tab menu or **Show Brain
for this chat** in the command palette bring it back. A dot on the button means the brain is
updating the chat's notes. Chats without a brain show neither tab nor button.

Choose a brain for the project to give its chats Flow's graph, memory, and committed-source
access. The next regular message automatically supplies Flow's orientation, including in an
existing chat. Chats receive Flow's Brain tools without a separate skill or MCP installation.

Orientation refreshes after an agent session restarts, after compaction, or when you change the
connected brain. It is not repeated on every message. Disconnecting stops further reads and
capture, but cannot erase knowledge already in the conversation; start a new chat for a clean context.

### Add sources to a brain

Open **Brain → Sources** to add the code and context Flow can learn from. Connect a GitHub
repository or choose a local folder. Public GitHub repositories work without signing in; private
repositories use the selected machine's GitHub CLI authentication from **Settings → Source control**.

Linear, Fireflies.ai, meeting notes, and the Slack bot are shown as upcoming source types and cannot
be connected from this page yet.

![Flow Brain sources, including GitHub repositories, local folders, and upcoming integrations](../images/flow-brain-sources.webp)

### Conversation notes, Auto-Docs, and Auto-Skills

The chat's **Brain** tab starts conversation notes with your first message. As you work,
Flow maintains a readable account of the task, progress, corrections, and unfinished work so
an agent can recover after compaction. Your agent can retrieve it with `get_chat_memories`.

The same background process maintains Auto-Docs and Auto-Skills from the conversation and
its recorded tool evidence. Auto-Docs preserve decisions, lessons, and useful project context.
Auto-Skills describe procedures that were actually demonstrated, such as reproducing a failure
and verifying its fix. Related documents are refined as later conversations add evidence. The
**Brain** tab always shows all three sections, with what this chat has produced so far.

To stop this background work, turn off **Settings → General → Brain → Notes agent**. To keep
notes but stop Auto-Docs or Auto-Skills, turn them off in the same section; a project inherits
these two switches and can override them in the **Brain** section of its settings.

Each section of a chat's **Brain** tab has its own **Default / On / Off** switch for that chat
only. **Default** follows Settings, or for Auto-Docs and Auto-Skills the project's override where
it has one, and says whether that is currently on or off. Auto-Docs and Auto-Skills need the notes agent, so their
switches are greyed out while it is off for the chat. A change applies from the next update.

With the notes agent off, the chat keeps its brain briefing and tools, and its messages are
still recorded, so turning it back on catches up on what it missed. Existing documents stay
available and searchable whatever the switches say.

Notes update after completed turns and about every 60 seconds while new activity arrives.
Busy extraction coalesces later activity into a follow-up. The tab shows pending work or an
extraction error rather than reporting that unavailable processing succeeded. Captured activity
is retained locally for retry; incomplete or truncated tool output can limit the conclusions.

Automatic extraction follows the CLI selected for the Brain: Codex, Claude Code, or OpenCode.
Enable and sign in to a matching provider in Settings. If several matching providers are enabled,
Flow prefers your default provider when it matches that CLI, otherwise the first enabled match.
A missing matching provider produces an extraction error; Flow does not switch to another CLI.
Codex extraction requires a ChatGPT subscription. OpenCode extraction requires a local provider
without a Server URL or remote organization configuration so background sessions can be isolated.
The main conversation can use a different provider.

Background sessions stay out of your chat list, but the CLI keeps them in its own session
history. They reuse context between checkpoints and renew it as it grows or when you change the
Brain's CLI, retaining saved notes and access to earlier evidence.
`FLOW_DISTILLER=0` disables automatic extraction in the brain runtime.

### Find and use what your brain learned

Open **Brain** and choose **Auto-Docs** or **Auto-Skills** to browse what the connected brain
has learned. **Knowledge Graph** contains its code map and source connections. Search by
name or purpose and open a document to read it fully. **Updated** is when the document was
edited; **Evidence from** is when its newest supporting conversation evidence was recorded.
Older procedures can depend on an earlier branch or runtime, so check their stated scope.
Time-sensitive memories become less prominent with age; lasting rules and useful fixes remain.

![Flow Brain knowledge graph showing the entities and relationships learned from connected sources](../images/flow-knowledge-graph.webp)

Open a skill and choose **Copy chat prompt** to ask your agent to read and use its latest
version in a chat connected to that brain. You can also ask for a skill by purpose: orientation
includes a skill catalog, and agents can use `list_skills` and `read_skill` to find the full
procedure. **Download SKILL.md** saves a portable copy. Downloading does not install the skill
into a provider's local skill directory or slash menu.

The Brain tab and Brain page read from the selected brain. Switching brains changes the
available documents; disconnecting stops further capture and reads. Indexed source references
may describe an older revision than the current checkout.
