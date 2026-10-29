#!/usr/bin/env bash
# Starts the Dev Flow: the desktop app from this checkout with hot reload, on its
# own server and its own data in .t3/dev, so the installed Flow (and the chat
# running in it) is never touched.
#
# Usage: scripts/fork/dev-flow.sh [--seed]
#   --seed  copy a snapshot of your real chats into .t3/dev first (only when
#           .t3/dev has no database yet; the live database is opened read-only)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEV_HOME="${REPO_ROOT}/.t3/dev"
LIVE_DATABASE="${HOME}/.t3/userdata/state.sqlite"
DEV_DATABASE="${DEV_HOME}/userdata/state.sqlite"

seed_dev_database() {
    if [[ -e "${DEV_DATABASE}" ]]; then
        echo "dev-flow: ${DEV_DATABASE} already exists, not seeding again."
        return
    fi
    if [[ ! -e "${LIVE_DATABASE}" ]]; then
        echo "dev-flow: no live database at ${LIVE_DATABASE}, starting empty."
        return
    fi
    mkdir -p "${DEV_HOME}/userdata"
    # VACUUM INTO gives one consistent file even while the live server has it open.
    node -e '
        const { DatabaseSync } = require("node:sqlite");
        const [source, target] = process.argv.slice(1);
        new DatabaseSync(source, { readOnly: true }).exec(`VACUUM INTO '"'"'${target}'"'"'`);
    ' "${LIVE_DATABASE}" "${DEV_DATABASE}"
    echo "dev-flow: seeded ${DEV_DATABASE} from ${LIVE_DATABASE}."
}

if [[ "${1:-}" == "--seed" ]]; then
    seed_dev_database
fi

cd "${REPO_ROOT}"
if [[ ! -x "${REPO_ROOT}/node_modules/.bin/vp" ]]; then
    echo "dev-flow: dependencies are missing, run 'pnpm install' first." >&2
    exit 1
fi
# dev-runner spawns `vp`, which only the repo's own node_modules provides; `vp run`
# and `pnpm run` add this to PATH, a direct call has to do it itself.
export PATH="${REPO_ROOT}/node_modules/.bin:${PATH}"
# The legacy backend makes the dev app run its own server from this checkout
# instead of attaching to the installed flow.service.
export FLOW_DESKTOP_LEGACY_BACKEND=1
exec node scripts/dev-runner.ts dev:desktop --home-dir "${DEV_HOME}"
