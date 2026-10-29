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
LOG_DIRECTORY="${DEV_HOME}/logs"
LOG_FILE="${LOG_DIRECTORY}/dev-flow.log"

# dev-electron.mjs marks the dev app it starts with this argument.
DEV_APP_MARKER="--t3code-dev-root=${REPO_ROOT}/apps/desktop"
CHECK_INTERVAL_SECONDS=2
# Long enough to ride out the restart dev-electron.mjs does after a desktop change.
WINDOW_CLOSED_GRACE_SECONDS=15

# Mirrors everything this run prints into LOG_FILE, so an agent can read the app's
# logs while the owner develops. The previous run is kept as dev-flow.previous.log.
start_log() {
    mkdir -p "${LOG_DIRECTORY}"
    if [[ -e "${LOG_FILE}" ]]; then
        mv "${LOG_FILE}" "${LOG_DIRECTORY}/dev-flow.previous.log"
    fi
    exec > >(tee -a "${LOG_FILE}") 2>&1
    echo "dev-flow: $(date '+%Y-%m-%d %H:%M:%S') logging to ${LOG_FILE}"
}

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

start_log

if [[ "${1:-}" == "--seed" ]]; then
    seed_dev_database
fi

# True while the dev app runs inside the runner's process group. Limiting the
# match to that group keeps unrelated processes that merely mention the marker
# (an agent's shell command, an editor) from counting. Only looks, never signals.
is_dev_app_running() {
    local runner_group="$1"
    pgrep -g "${runner_group}" -f -- "${DEV_APP_MARKER}" >/dev/null
}

# Upstream's dev-electron.mjs keeps the session alive when the app quits, so the
# runner would outlive a closed window. Stop it once the app has been gone a while.
stop_when_window_closes() {
    local runner_pid="$1"
    local seen_app=false
    local absent_seconds=0
    while kill -0 "${runner_pid}" 2>/dev/null; do
        sleep "${CHECK_INTERVAL_SECONDS}"
        if is_dev_app_running "${runner_pid}"; then
            seen_app=true
            absent_seconds=0
        elif [[ "${seen_app}" == true ]]; then
            absent_seconds=$((absent_seconds + CHECK_INTERVAL_SECONDS))
        fi
        if (( absent_seconds >= WINDOW_CLOSED_GRACE_SECONDS )); then
            echo "dev-flow: the Flow window was closed, stopping the dev session."
            kill -INT -- "-${runner_pid}" 2>/dev/null || true
            kill -CONT -- "-${runner_pid}" 2>/dev/null || true
            return
        fi
    done
}

cd "${REPO_ROOT}"
if [[ ! -x "${REPO_ROOT}/node_modules/.bin/vp" ]]; then
    echo "dev-flow: dependencies are missing, run 'pnpm install' first." >&2
    exit 1
fi
# The desktop build compiles a C helper for browser login import against libsecret.
if ! pkg-config --exists libsecret-1 2>/dev/null; then
    echo "dev-flow: libsecret headers are missing, run 'sudo apt install libsecret-1-dev' first." >&2
    exit 1
fi
# dev-runner spawns `vp`, which only the repo's own node_modules provides; `vp run`
# and `pnpm run` add this to PATH, a direct call has to do it itself.
export PATH="${REPO_ROOT}/node_modules/.bin:${PATH}"
# Makes Electron print the renderer console (including the [flow-perf] lines of
# apps/web/src/debug/devPerformanceLog.ts) to stderr, so it lands in LOG_FILE.
export ELECTRON_ENABLE_LOGGING=1
# The legacy backend makes the dev app run its own server from this checkout
# instead of attaching to the installed flow.service.
export FLOW_DESKTOP_LEGACY_BACKEND=1
# Own process group (set -m), so Ctrl+C and a closed window both stop the runner
# and everything it started, exactly as an interactive Ctrl+C would. A background
# group that touches the terminal is suspended by the kernel (SIGTTIN), and Vite
# reads stdin for its key shortcuts, so the runner gets no terminal input at all.
set -m
node scripts/dev-runner.ts dev:desktop --home-dir "${DEV_HOME}" </dev/null &
RUNNER_PID=$!
set +m
stop_runner() {
    kill -INT -- "-${RUNNER_PID}" 2>/dev/null || true
    # Wakes anything the kernel suspended, so it can act on the interrupt.
    kill -CONT -- "-${RUNNER_PID}" 2>/dev/null || true
}
trap stop_runner INT TERM
stop_when_window_closes "${RUNNER_PID}" &
WATCHER_PID=$!
RUNNER_STATUS=0
wait "${RUNNER_PID}" || RUNNER_STATUS=$?
# A trapped Ctrl+C interrupts the first wait while the runner is still shutting down.
if kill -0 "${RUNNER_PID}" 2>/dev/null; then
    wait "${RUNNER_PID}" || RUNNER_STATUS=$?
fi
kill "${WATCHER_PID}" 2>/dev/null || true
exit "${RUNNER_STATUS}"
