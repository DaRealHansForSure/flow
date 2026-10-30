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

`upstream` and `t3` have their push URL set to `no-push`, so a stray push fails, and fetch no
tags: only this fork's own release tags exist here and on `origin`.
On a fresh clone, recreate the setup:

```bash
git remote add upstream https://github.com/samyakkkk/flow.git
git remote add -t main t3 https://github.com/pingdotgg/t3code.git
git remote set-url --push upstream no-push
git remote set-url --push t3 no-push
git config remote.upstream.tagOpt --no-tags
git config remote.t3.tagOpt --no-tags
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
- **One branch per topic, not per commit.** A branch carries one feature or piece of
  work (`feat/dev-flow`, `fix/service-network-access`) as several logical commits, cut
  from `develop` and merged once with `--no-ff` when the topic is done. Follow-up fixes
  to unmerged work go onto the same branch. Do not commit work directly to `develop` or
  `main`, and delete a topic branch once it is merged.
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
scripts/fork/dev-flow.sh          # desktop app with hot reload, data in ~/.flow-dev
scripts/fork/dev-flow.sh --seed   # copy snapshots of the real chats and Brain (about 6 GB)
scripts/fork/dev-flow.sh --seed --force   # delete the Dev Flow's copies and copy both fresh
```

- Needs `pnpm install` and, on Ubuntu, `sudo apt install libsecret-1-dev` once; the
  launcher checks both. The first start builds everything and takes about two minutes.
- UI changes (`apps/web`) reload in place; desktop changes (`apps/desktop`) restart the
  dev app. The server runs from `apps/server/dist`, built once at launch, so server and
  Brain changes need `dev-flow.sh` restarted.
- Closing the dev window ends the whole session about 15 seconds later; Ctrl+C works too.
- Everything the Dev Flow prints is also written to `~/.flow-dev/logs/dev-flow.log` (the
  previous run in `dev-flow.previous.log`). Read that file to see the app's logs; strip
  colour codes with `sed 's/\x1b\[[0-9;]*m//g'`.
- The window's console is in the same log (`ELECTRON_ENABLE_LOGGING=1`). For slowness,
  `grep '\[flow-perf\]' ~/.flow-dev/logs/dev-flow.log` lists renderer stalls with the scripts
  behind them, slow or large API responses and route timings. Dev builds run React in
  development mode under StrictMode, so they are slower than a release on their own.
- `glab` / "No unknown source control provider" warnings in the log are harmless: they
  come from PR lookups for seeded GitLab or remote-less projects.
- The Dev Flow runs its own server (`FLOW_DESKTOP_LEGACY_BACKEND=1`) on `~/.flow-dev`,
  outside the checkout because T3 hides "No project" chats when the data directory is
  inside a git work tree. Never point dev at `~/.t3`, and never attach it to the
  installed service.
- Agent chats live in `flow.service`. Stopping or restarting it, installing a release,
  or toggling its network access ends every running chat, including the one doing the work.
- For longer tasks an agent works in a git worktree, so neither side switches branches
  under the other.
- Agents run inside `flow.service` and inherit its `FLOW_RELEASE_HOME`,
  `FLOW_INSTANCE_HOME` and `FLOW_SERVICE_MANAGED`, which point at the real installation.
  Never run the release and service tests (`scripts/flow-*.test.mjs`,
  `scripts/instances/*.test.mjs`, `scripts/retire-legacy-flow.test.mjs`) from an agent
  chat: twice they restarted `flow.service` and ended every chat. Run them only with
  those variables removed: `env -u FLOW_RELEASE_HOME -u FLOW_INSTANCE_HOME -u
  FLOW_SERVICE_MANAGED node --test <file>`.

## Backing up the Brain

`scripts/fork/backup-brain.sh --dry-run` lists what a backup holds: the Brain store
(`<home>/userdata/brain`), its knowledge graph (`~/.flow-brain/<hash>`, named after the
store path), the agent registry (`~/.flow`) and the chats. A real run needs the service
stopped, so quit the app and pass `--stop-service`; that ends every running chat. The
backup lands in `~/Backups/flow-<date>-<time>` with a `RESTORE.txt`.

## Removing the installed Flow

`scripts/fork/uninstall-flow.sh` lists the installed parts (service, releases, `flow`
command, AppImages, app settings, menu entries); `--yes` removes them. Chats, the Brain and
the Dev Flow are never touched. Run it from a normal terminal with Flow closed; it refuses
to run inside the service.

## Syncing with upstream

Sync every week or two. Seven weeks of drift once gave 227 conflicting files.

1. `git fetch upstream t3`
2. `git switch -c sync/upstream-<date> develop`
3. `git merge --no-ff upstream/release`, then `git merge --no-ff t3/main` to take T3
   Code directly. Flow upstream merges T3 itself, but often lags behind it.
4. Fix the conflicts, run the focused tests for what changed, and merge the sync branch
   into `develop` with `--no-ff`.

To sync with a specific T3 release instead of `t3/main`, fetch its tag on its own and merge the
commit without keeping the tag: `git fetch t3 refs/tags/v0.1.6` then `git merge --no-ff FETCH_HEAD`.

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

Installed Flow updates from this fork: the `flow` CLI and `install.sh` / `install.ps1`
download from DaRealHansForSure/flow releases (`scripts/flow-release.mjs`), and the desktop
app's update feed is the repository its release workflow runs in.

- Service (browser and CLI) releases: pushing to the `release` branch runs
  `flow-browser-release.yml`, which publishes the next `flow-vX.Y.Z`.
- Desktop releases: `flow-desktop-release.yml` adds the AppImage to the existing `flow-vX.Y.Z`
  release of the same version and refuses to run when that release does not exist. It also
  refreshes `flow-desktop-latest`, the hidden feed the desktop updater reads.
- Both at once: run `flow-release.yml` on the `release` branch with a `version`. It publishes
  `flow-vX.Y.Z` and then adds the desktop app to it, from the same commit, so one page holds
  both. Release this way: every desktop app offers to move the service to exactly its own
  version, so that service release must exist.
- Before releasing, rename `[Unreleased]` in `CHANGELOG.md` to `[X.Y.Z] - <date>`: that section
  becomes the release text. Without one the page only points at the CHANGELOG.
- Every push to `release` starts a service release of the next patch version on its own. When
  the push is only the base for a "Flow release" run, put `[skip ci]` in its merge commit.
- A machine that still has an upstream install switches once, by accepting the update the
  fork's desktop app offers at start or by running this fork's `install.sh`; after that
  `flow update` and the desktop updater follow this fork.
