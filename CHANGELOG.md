# Changelog

Changes in this fork (DaRealHansForSure/flow) on top of upstream Flow
(samyakkkk/flow) and T3 Code. Upstream's own changes are listed in their release
notes; only the sync they arrived in is recorded here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- CLAUDE.md guide for maintaining the fork: remotes, branches, syncing with upstream
  Flow and T3 Code, upstream naming, and the owner's working rules.
- `scripts/fork/dev-flow.sh`: starts the Dev Flow from the checkout with hot reload on
  isolated data, optionally seeded from a snapshot of the real chats. Its output is also
  written to `.t3/dev/logs/dev-flow.log`, and closing the dev window ends the session.
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

- A loading indicator in the content pane while a page or chat is still loading, instead of
  an empty pane.

- A chat without a project picks its own Brain or "No Brain" on the new-chat screen; the
  choice stays with the chat.

### Changed

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

- The web build (and with it the Dev Flow) no longer stops at T3's third-party license check:
  the Brain packages and their redis, bezier-js and reflink dependencies have notices.

- The Dev Flow window no longer fails with "Failed to fetch": the server's development
  CORS list now allows the Flow desktop origins (`flow://app`, `flow-dev://app`).
- Settings > Network access now reaches the Flow service: the service listens on every
  interface when it is on, and Settings shows the service's real LAN and Tailscale
  addresses instead of the unused port 3773. Needs a service built from this fork.
