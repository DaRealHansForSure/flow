# Permission modes

Permission modes control when an agent needs your approval to act. Choose a mode in the message
composer; it applies to that thread. A new thread names its mode under the composer. In a thread
on your default mode, open **Permissions** from the effort menu or press `mod+shift+a`. A thread on
another mode, or a model without an effort menu, shows the mode next to the model.

Set the default for new threads in **Settings → Threads → New threads → Permissions**.
Projects can override the environment default. New threads use this setting rather than the
mode of the thread you were viewing. The initial default is **Full access**; existing threads
and modes you choose in a draft keep their permissions.

| Mode                  | Behavior                                                                              |
| --------------------- | ------------------------------------------------------------------------------------- |
| **Supervised**        | Requests approval for commands and file changes.                                      |
| **Auto-accept edits** | Approves file edits automatically; other actions can still require approval.          |
| **Auto**              | Uses the provider's automatic review to approve routine actions and ask about others. |
| **Full access**       | Allows commands and edits without approval prompts.                                   |

Approve or reject requests in the conversation to let the agent continue. Permission modes do
not prevent the agent from asking questions about the task.

## Plan

**Plan** is the fifth mode, offered for providers with their own plan mode (Claude, Codex,
Cursor, and OpenCode). The agent reads and plans instead of changing files, and every command
asks for approval, even in a thread that otherwise runs in **Full access**. Switch to it in the
permission picker, with `Shift+Tab`, or with `/plan`; `/default` leaves it.

Plan keeps the thread's other mode for afterwards. To start new threads in Plan, choose it as the
default in **Settings → Threads → New threads → Permissions**, then pick the mode accepted plans
continue in under **After the plan**.

A finished plan opens in the **Plan** tab of the side panel, rendered or as Markdown source, where
you can copy, download, or save it as a file. Answer it from the tab, the plan card, or the
composer:

- **Accept** implements the plan in the thread's other mode. Its menu offers another mode or a
  new thread.
- **Revise** sends your feedback with a request to rework the plan into a new version without
  starting on its steps. To comment on a passage, select
  it, choose **Comment**, and write a note. Comments are sent with the next revision.
- **Decline** closes the plan and keeps the thread in Plan.

A message typed right after a new plan is sent as Revise feedback. To send it as an ordinary
message instead, choose **New message** in the composer's **Plan ready** banner. An older plan
that is still open does not take your messages; use **Revise** on it to give feedback. While the
thread still waits on its subagents, the plan can be answered once they finish.

Each plan shows its version and whether it was accepted, revised, or declined; the Plan tab lists
earlier versions. **Reopen this plan**, in a closed plan's menu or the Plan tab, makes it the open
plan again. Changes already made from it stay. On web and desktop, a thread whose plan waits for
an answer shows **Plan ready** in the sidebar.

## Provider differences

Providers enforce permissions differently. Some read-only actions can proceed in **Supervised**.
**Auto** uses automatic review on Codex, Claude, Cursor, Grok, and fx; providers without an equivalent,
including OpenCode and Antigravity, fall back to asking. On Grok, commands its review blocks come
to you for approval. On fx, prompts it still sends also come to you.

Muse Code offers only **Supervised** and **Full access**. A Muse thread already set to another mode
runs in **Supervised**.

T3 Code offers no **Auto-accept edits** or **Full access** for fx. An fx thread already set to either runs in
**Supervised**.

Grok offers no **Auto-accept edits**. A Grok thread already set to it runs in **Supervised**. Grok
file-change approvals offer **Allow all edits this session**. Its command approvals have no
session-wide choice, because Grok would remember that command for the whole project.

ACP Registry agents run their own tools in their own mode; T3 Code answers their approval requests
by the permission mode. See [ACP Registry permissions](./providers-acp.md#permissions-and-terminals).

Claude can still ask in **Full access** when its settings disable bypass permissions or require
approval for an action.
While a Claude approval is pending, type a text reply to decline that request and give feedback
directly to the agent that asked, including a subagent. Other pending requests stay unanswered.

Antigravity can still send native approval requests in **Full access**. It only offers remembered
approvals for actions that support them.

See the [provider guides](./install.md#providers) for setup and provider-specific limits.
