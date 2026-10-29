@AGENTS.md

# Maintaining this fork

This repository is DaRealHansForSure/flow, a fork of samyakkkk/flow, which in turn
imports T3 Code. This section is fork-only: keep it here and out of `AGENTS.md`,
which upstream owns, so syncing never conflicts on it.

## Remotes

| Remote     | Repository                | Use                                    |
| ---------- | ------------------------- | -------------------------------------- |
| `origin`   | DaRealHansForSure/flow    | This fork. The only remote to push to. |
| `upstream` | samyakkkk/flow            | Flow upstream. Fetch only.             |
| `t3`       | pingdotgg/t3code (`main`) | T3 Code upstream. Fetch only.          |

`upstream` and `t3` have their push URL set to `no-push`, so a stray push fails.
On a fresh clone, recreate the setup:

```bash
git remote add upstream https://github.com/samyakkkk/flow.git
git remote add -t main t3 https://github.com/pingdotgg/t3code.git
git remote set-url --push upstream no-push
git remote set-url --push t3 no-push
git config rerere.enabled true
git config rerere.autoupdate true
git config merge.ff false
git config pull.ff only
```

## Branches

- `main` holds releases. `develop` collects finished work.
- Every change goes on its own branch from `develop` (`feat/...`, `fix/...`, `docs/...`),
  merged with `git merge --no-ff` into `develop`, then `develop` into `main`.
- Never rebase history that has already been pushed.

## How the owner wants work done

These rules come from the owner and override the upstream guidance above where they differ.

- **Logical commits.** One commit per coherent change, with a conventional title
  (`fix(service): ...`). Never mix unrelated changes in one commit, and never bundle a
  sync, a refactor and a fix together.
- **Sensible branches.** Name each branch for the change it carries (`fix/service-network-access`),
  one concern per branch, cut from `develop`. Do not commit work directly to `develop` or `main`.
- **Tests only when they pay.** Run tests after a big feature is complete or when the owner
  asks, not after every small edit. Typecheck and lint the touched scope before committing.
- **CHANGELOG.md.** Every user-visible fork change gets a line under `[Unreleased]` in the
  same commit (Added / Changed / Fixed). Upstream changes get one line per sync, not a copy
  of their notes.
- **Worklog.** Keep the worklog skill active: `.claude/WORKLOG.md` (committed) and its
  machine copy stay current with the topic, last step and next step.
- **Writing style.** Apply the `no-em-dash` and `senior-code-style` skills to all code,
  comments, docs and commit messages. Follow the repository's formatter (`vp fmt`) for
  layout; braces stay mandatory on every block you write.
- **No co-author trailers** in commit messages, and never push without the owner's word.

## Developing Flow with Flow

The installed Flow (AppImage plus `flow.service`, data in `~/.t3`) is the stable tool the
owner works and chats in. The Dev Flow runs from this checkout next to it:

```bash
scripts/fork/dev-flow.sh          # desktop app with hot reload, data in .t3/dev
scripts/fork/dev-flow.sh --seed   # first run: copy a snapshot of the real chats (about 3 GB)
```

- Needs `pnpm install` and, on Ubuntu, `sudo apt install libsecret-1-dev` once; the
  launcher checks both. The first start builds everything and takes about two minutes.
- UI changes (`apps/web`) reload in place; desktop changes (`apps/desktop`) restart the
  dev app. The server runs from `apps/server/dist`, built once at launch, so server and
  Brain changes need `dev-flow.sh` restarted.
- Everything the Dev Flow prints is also written to `.t3/dev/logs/dev-flow.log` (the
  previous run in `dev-flow.previous.log`). Read that file to see the app's logs; strip
  colour codes with `sed 's/\x1b\[[0-9;]*m//g'`.
- `glab` / "No unknown source control provider" warnings in the log are harmless: they
  come from PR lookups for seeded GitLab or remote-less projects.
- The Dev Flow runs its own server (`FLOW_DESKTOP_LEGACY_BACKEND=1`) on `.t3/dev`. Never
  point dev at `~/.t3`, and never attach it to the installed service.
- Agent chats live in `flow.service`. Stopping or restarting it, installing a release,
  or toggling its network access ends every running chat, including the one doing the work.
- For longer tasks an agent works in a git worktree, so neither side switches branches
  under the other.

## Syncing with upstream

Sync every week or two. Seven weeks of drift once gave 227 conflicting files.

1. `git fetch upstream t3`
2. `git switch -c sync/upstream-<date> develop`
3. `git merge --no-ff upstream/release`, then `git merge --no-ff t3/main` to take T3
   Code directly. Flow upstream merges T3 itself, but often lags behind it.
4. Fix the conflicts, run the focused tests for what changed, and merge the sync branch
   into `develop` with `--no-ff`.

`rerere` records how each conflict was resolved and replays it in the next sync, so
resolve carefully once. Check progress with
`git rev-list --count develop..upstream/release` and `git rev-list --count develop..t3/main`.

### Upstream's branch and tag names

Upstream's naming is inconsistent; this is what each name means in practice:

- `upstream/release` is what the published Flow releases are built from. It contains
  all of `upstream/main` plus release-only commits, so it is the branch to sync from.
- `upstream/main` is the integration branch; `main-dev` feeds it through pull requests.
- `main-v2`, `main-legacy`, `dev` and `release-0115` are older lines. Ignore them, and
  ignore upstream pull requests that target them.
- Tags come in three families: `flow-vX.Y.Z` (browser and CLI release, the installed
  service), `flow-desktop-vX.Y.Z` (desktop AppImage) and `flow-cloud-cli-vX.Y.Z`. Their
  numbers are independent: desktop 0.1.6 runs against service 0.1.15.

## Keeping the fork cheap to sync

- Keep fork changes small and away from upstream files where possible: new files,
  adapters and settings rather than edits in the middle of shared code.
- Send general fixes upstream as pull requests so the fork stops carrying them.

## Releases

The installer and the updater download from samyakkkk/flow (`install.sh:66`,
`scripts/flow-release.mjs:19`). Fork changes to the installed app, the service or the
supervisor reach this machine only once those point at DaRealHansForSure/flow and
releases are published from this fork.
