#!/usr/bin/env bash
# Backs up everything the Flow Brain needs, plus the chats it refers to, into one
# dated folder with a restore note. Finds the paths the way Flow does: the data
# home (~/.t3 for existing installs, ~/.flow for fresh ones, or T3CODE_HOME), and
# the FalkorDB graph under ~/.flow-brain/<first 12 hex of sha256(brain folder)>.
#
# The databases are only consistent while nothing writes to them, so the backup
# refuses to run while flow.service is active. --stop-service stops it and starts
# it again afterwards; that ends every running chat, including agent chats.
#
# Usage: scripts/fork/backup-brain.sh [--dry-run] [--stop-service] [TARGET_FOLDER]
#   --dry-run       show what would be backed up, with sizes, and stop
#   --stop-service  stop flow.service for the backup and start it again afterwards
#   TARGET_FOLDER   defaults to ~/Backups/flow-<date>-<time>
set -euo pipefail

SERVICE_UNIT="flow.service"
DRY_RUN=false
STOP_SERVICE=false
TARGET=""

for argument in "$@"; do
    case "${argument}" in
        --dry-run) DRY_RUN=true ;;
        --stop-service) STOP_SERVICE=true ;;
        -h | --help)
            sed -n '2,14p' "$0"
            exit 0
            ;;
        -*)
            echo "backup-brain: unknown option ${argument}" >&2
            exit 2
            ;;
        *) TARGET="${argument}" ;;
    esac
done

# Same rule as packages/shared/src/homeBaseDir.ts.
resolve_data_home() {
    if [[ -n "${T3CODE_HOME:-}" ]]; then
        echo "${T3CODE_HOME}"
    elif [[ -d "${HOME}/.t3/userdata" ]]; then
        echo "${HOME}/.t3"
    else
        echo "${HOME}/.flow"
    fi
}

DATA_HOME="$(resolve_data_home)"
USERDATA="${DATA_HOME}/userdata"
BRAIN_DIR="${USERDATA}/brain"
# Same rule as BrainRuntime's databasePath.
GRAPH_HASH="$(printf '%s' "${BRAIN_DIR}" | sha256sum | cut -c1-12)"
GRAPH_DIR="${HOME}/.flow-brain/${GRAPH_HASH}"
AGENT_REGISTRY="${HOME}/.flow"

if [[ ! -d "${BRAIN_DIR}" ]]; then
    echo "backup-brain: no Brain found at ${BRAIN_DIR}" >&2
    exit 1
fi

# Paths relative to $HOME, so the archives restore with a plain `tar -C ~ -xf`.
relative() {
    echo "${1#"${HOME}"/}"
}

brain_paths=("$(relative "${BRAIN_DIR}")")
if [[ -d "${GRAPH_DIR}" ]]; then
    brain_paths+=("$(relative "${GRAPH_DIR}")")
else
    echo "backup-brain: warning, no knowledge graph at ${GRAPH_DIR}" >&2
fi
# The agent registry is ~/.flow; on a fresh install that is also the data home,
# which the chat archive already covers.
if [[ -d "${AGENT_REGISTRY}" && "${AGENT_REGISTRY}" != "${DATA_HOME}" ]]; then
    brain_paths+=("$(relative "${AGENT_REGISTRY}")")
fi

chat_paths=()
for name in state.sqlite state.sqlite-wal state.sqlite-shm statev2.sqlite statev2.sqlite-wal \
    statev2.sqlite-shm settings.json secrets; do
    if [[ -e "${USERDATA}/${name}" ]]; then
        chat_paths+=("$(relative "${USERDATA}/${name}")")
    fi
done

echo "Data home:       ${DATA_HOME}"
echo "Brain:           ${BRAIN_DIR}"
echo "Knowledge graph: ${GRAPH_DIR}"
echo
echo "Brain archive:"
for path in "${brain_paths[@]}"; do
    printf '  %8s  ~/%s\n' "$(du -sh "${HOME}/${path}" | cut -f1)" "${path}"
done
echo "Chats archive:"
for path in "${chat_paths[@]}"; do
    printf '  %8s  ~/%s\n' "$(du -sh "${HOME}/${path}" | cut -f1)" "${path}"
done

if [[ "${DRY_RUN}" == true ]]; then
    exit 0
fi

service_was_active=false
if systemctl --user is-active --quiet "${SERVICE_UNIT}" 2>/dev/null; then
    service_was_active=true
fi
if [[ "${service_was_active}" == true && "${STOP_SERVICE}" != true ]]; then
    echo >&2
    echo "backup-brain: ${SERVICE_UNIT} is running, so the databases may change mid-copy." >&2
    echo "Quit the Flow app and run again with --stop-service (this ends every running chat)." >&2
    exit 1
fi

restart_service() {
    if [[ "${service_was_active}" == true ]]; then
        systemctl --user start "${SERVICE_UNIT}"
        echo "backup-brain: started ${SERVICE_UNIT} again."
    fi
}

if [[ "${service_was_active}" == true ]]; then
    # Stopping the service from one of its chats kills this script before it restarts it.
    if grep -q "/${SERVICE_UNIT}" /proc/self/cgroup 2> /dev/null || [[ -n "${FLOW_SERVICE_MANAGED:-}" ]]; then
        echo "backup-brain: this shell runs inside Flow; stopping the service would end it." >&2
        echo "Close Flow and run the script from a normal terminal." >&2
        exit 1
    fi
    systemctl --user stop "${SERVICE_UNIT}"
    trap restart_service EXIT
fi

if [[ -z "${TARGET}" ]]; then
    TARGET="${HOME}/Backups/flow-$(date +%F-%H%M)"
fi
mkdir -p "${TARGET}"

tar -C "${HOME}" -cf "${TARGET}/brain.tar" "${brain_paths[@]}"
if [[ "${#chat_paths[@]}" -gt 0 ]]; then
    tar -C "${HOME}" -cf "${TARGET}/chats.tar" "${chat_paths[@]}"
fi

cat > "${TARGET}/RESTORE.txt" <<EOF
Flow Brain backup from $(date '+%Y-%m-%d %H:%M'), data home ${DATA_HOME}.

To restore, quit the Flow app and run:
  systemctl --user stop ${SERVICE_UNIT}
  tar -C ~ -xf brain.tar
  tar -C ~ -xf chats.tar
  systemctl --user start ${SERVICE_UNIT}

The data home must stay at the same path: the knowledge graph folder name
(~/.flow-brain/${GRAPH_HASH}) is derived from ${BRAIN_DIR}.
EOF

echo
echo "Backup written to ${TARGET}:"
du -sh "${TARGET}"/*.tar | sed 's/^/  /'
echo "Copy this folder to another disk too; a backup on the same disk does not survive a disk failure."
