#!/usr/bin/env bash
# Removes every GitHub workflow that is not the fork's own (flow-*.yml). T3 Code's workflows run on
# Blacksmith runners this repository does not have, so on GitHub they wait for a runner forever.
# Run it after merging upstream or t3 in a sync, before committing the merge: a sync brings back
# the workflows T3 changed and adds new ones. The fork CI (flow-ci.yml) fails while any remain.
#
# Usage: scripts/fork/prune-upstream-workflows.sh [--check]
#   --check    only list foreign workflows and exit 1 if there are any
set -euo pipefail

CHECK_ONLY=false

for argument in "$@"; do
    case "${argument}" in
        --check) CHECK_ONLY=true ;;
        -h | --help)
            sed -n '2,9p' "$0"
            exit 0
            ;;
        *)
            echo "prune-upstream-workflows: unknown option ${argument}" >&2
            exit 2
            ;;
    esac
done

cd "$(git rev-parse --show-toplevel)"

foreign=()
for workflow in .github/workflows/*.yml .github/workflows/*.yaml; do
    [[ -e "${workflow}" ]] || continue
    case "$(basename "${workflow}")" in
        flow-*) ;;
        *) foreign+=("${workflow}") ;;
    esac
done

if [[ ${#foreign[@]} -eq 0 ]]; then
    echo "prune-upstream-workflows: only the fork's own workflows are present."
    exit 0
fi

if [[ "${CHECK_ONLY}" == true ]]; then
    echo "prune-upstream-workflows: workflows that are not the fork's own:" >&2
    printf '  %s\n' "${foreign[@]}" >&2
    echo "Run scripts/fork/prune-upstream-workflows.sh and commit the removal." >&2
    exit 1
fi

for workflow in "${foreign[@]}"; do
    if git ls-files --error-unmatch "${workflow}" > /dev/null 2>&1; then
        git rm --quiet --force -- "${workflow}"
    else
        rm -f -- "${workflow}"
    fi
    echo "removed ${workflow}"
done
