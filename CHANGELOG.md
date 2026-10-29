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
  isolated data, optionally seeded from a snapshot of the real chats.

### Changed

- Synced with upstream Flow `release` (flow-v0.1.15): OpenCode CLI capture, notes
  agent on an inexpensive model.

### Fixed

- The Dev Flow window no longer fails with "Failed to fetch": the server's development
  CORS list now allows the Flow desktop origins (`flow://app`, `flow-dev://app`).
- Settings > Network access now reaches the Flow service: the service listens on every
  interface when it is on, and Settings shows the service's real LAN and Tailscale
  addresses instead of the unused port 3773. Needs a service built from this fork.
