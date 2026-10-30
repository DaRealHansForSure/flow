#!/usr/bin/env bash
# Removes the installed Flow: the background service, its releases and `flow` command,
# Flow AppImages, the desktop app's settings and its menu entries. It never touches chats,
# the Brain or the Dev Flow. Without --yes it only lists what it would do.
#
# Run it from a normal terminal with Flow closed: stopping the service ends every chat,
# including an agent that would run this script.
#
# Usage: scripts/fork/uninstall-flow.sh [--yes]
#   --yes    remove what the dry run lists
set -euo pipefail

SERVICE_UNIT="flow.service"
APPLY=false

for argument in "$@"; do
    case "${argument}" in
        --yes) APPLY=true ;;
        -h | --help)
            sed -n '2,10p' "$0"
            exit 0
            ;;
        *)
            echo "uninstall-flow: unknown option ${argument}" >&2
            exit 2
            ;;
    esac
done

# Anything started from a Flow chat runs inside the service's cgroup.
if grep -q "/${SERVICE_UNIT}" /proc/self/cgroup 2> /dev/null || [[ -n "${FLOW_SERVICE_MANAGED:-}" ]]; then
    echo "uninstall-flow: this shell runs inside Flow; stopping the service would end it." >&2
    echo "Close Flow and run the script from a normal terminal." >&2
    exit 1
fi

RELEASE_HOME="${HOME}/.local/share/flow-browser"
LAUNCHER="${HOME}/.local/bin/flow"
UNIT_FILE="${HOME}/.config/systemd/user/${SERVICE_UNIT}"
DESKTOP_SETTINGS="${HOME}/.config/flow-desktop"
DESKTOP_ENTRIES=(
    "${HOME}/.local/share/applications/flow.desktop"
    "${HOME}/.local/share/applications/flow-url-handler.desktop"
)
# Never removed: chats, the Brain store, knowledge graphs and the agent registry.
DATA_PATHS=("${HOME}/.t3" "${HOME}/.flow" "${HOME}/.flow-brain")

remove_paths=()
for path in "${RELEASE_HOME}" "${UNIT_FILE}" "${DESKTOP_SETTINGS}" "${DESKTOP_ENTRIES[@]}"; do
    if [[ -e "${path}" ]]; then
        remove_paths+=("${path}")
    fi
done
# Only the launcher the release installer wrote, never another tool named flow.
if [[ -f "${LAUNCHER}" ]] && grep -q 'flow-managed-launcher' "${LAUNCHER}"; then
    remove_paths+=("${LAUNCHER}")
fi
for folder in "${HOME}/Applications" "${HOME}/Downloads"; do
    for appimage in "${folder}"/Flow-*.AppImage; do
        if [[ -f "${appimage}" ]]; then
            remove_paths+=("${appimage}")
        fi
    done
done

service_installed=false
if systemctl --user cat "${SERVICE_UNIT}" > /dev/null 2>&1; then
    service_installed=true
fi

echo "Installed Flow parts:"
if [[ "${service_installed}" == true ]]; then
    echo "  service   ${SERVICE_UNIT} (stopped, autostart turned off, unit removed)"
fi
for path in "${remove_paths[@]}"; do
    printf '  %8s  %s\n' "$(du -sh "${path}" 2> /dev/null | cut -f1)" "${path}"
done
echo
echo "Kept: your data (${DATA_PATHS[*]}), the Dev Flow (~/.flow-dev) and this checkout."

if [[ "${APPLY}" != true ]]; then
    echo
    echo "Dry run; nothing changed. Run again with --yes to remove the parts above."
    exit 0
fi

if pgrep -f 'Flow-[0-9.]+-x86_64\.AppImage' > /dev/null; then
    echo "uninstall-flow: a Flow AppImage is still running; quit it first." >&2
    exit 1
fi

if [[ "${service_installed}" == true ]]; then
    systemctl --user disable --now "${SERVICE_UNIT}" || true
fi
for path in "${remove_paths[@]}"; do
    rm -rf -- "${path}"
done
if [[ "${service_installed}" == true ]]; then
    systemctl --user daemon-reload
fi
if command -v update-desktop-database > /dev/null; then
    update-desktop-database "${HOME}/.local/share/applications" 2> /dev/null || true
fi

echo
echo "Flow is uninstalled. Your data is still in ${DATA_PATHS[*]}; a new Flow picks it up again."
