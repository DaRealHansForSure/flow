#!/usr/bin/env bash
# Full test suites in four parallel lanes, with progress a person can follow.
#
#   scripts/fork/test-lanes.sh run [lane...]   run the lanes (default: all) and wait for them
#   scripts/fork/test-lanes.sh status          one line: each lane's files done of total
#   scripts/fork/test-lanes.sh progress        a status line every minute until every lane ends
#
# Lanes: server, web-unit, web-browser, packages. Each writes .t3/test-run/<lane>.log and,
# when it ends, <lane>.exit. Start a long run detached so it outlives the shell:
#   nohup setsid scripts/fork/test-lanes.sh run > /dev/null 2>&1 < /dev/null &
set -u
root=$(git rev-parse --show-toplevel)
out="$root/.t3/test-run"
all_lanes="server web-unit web-browser packages"
mkdir -p "$out"

strip() {
    sed 's/\x1b\[[0-9;]*m//g' "$1" 2>/dev/null
}

# Test files a lane will run, counted the way its vitest config includes them.
count_files() {
    case $1 in
        server)
            find "$root/apps/server" \( -name node_modules -o -name dist \) -prune -o \
                -type f \( -name '*.test.ts' -o -name '*.test.tsx' \) -print | wc -l
            ;;
        web-unit)
            find "$root/apps/web/src" -type f \( -name '*.test.ts' -o -name '*.test.tsx' \) \
                ! -name '*.browser.test.*' | wc -l
            ;;
        web-browser)
            find "$root/apps/web/src" -type f -name '*.browser.test.*' | wc -l
            ;;
        packages)
            # Packages with a test script; each is one step of the lane.
            local package count=0
            for package in "$root"/packages/*/package.json; do
                node -e 'process.exit(require(process.argv[1]).scripts?.test ? 0 : 1)' "$package" &&
                    count=$((count + 1))
            done
            echo "$count"
            ;;
    esac
}

run() {
    export PATH="$root/node_modules/.bin:$PATH"
    # Never let a test reach the installed service (CLAUDE.md).
    unset FLOW_RELEASE_HOME FLOW_INSTANCE_HOME FLOW_SERVICE_MANAGED
    local lanes=${*:-$all_lanes}
    date +%s > "$out/started"

    lane() {
        local name=$1 dir=$2
        shift 2
        case " $lanes " in
            *" $name "*) ;;
            *) return ;;
        esac
        rm -f "$out/$name.log" "$out/$name.exit"
        count_files "$name" > "$out/$name.total"
        (cd "$root/$dir" && "$@" > "$out/$name.log" 2>&1; echo $? > "$out/$name.exit") &
    }

    # The verbose reporter prints each test as it ends; the default one stays silent until the
    # end when its output is not a terminal. Worker caps keep four lanes from timing out on load.
    lane server apps/server vp test run --reporter=verbose --maxWorkers=4
    lane web-unit apps/web vp test run --project unit --reporter=verbose --maxWorkers=3
    lane web-browser apps/web vp test run --project browser --reporter=verbose --maxWorkers=3
    local filters=() package name
    for package in "$root"/packages/*/package.json; do
        name=$(node -e 'const p=require(process.argv[1]); if (p.scripts?.test) console.log(p.name)' "$package")
        [[ -n "$name" ]] && filters+=(--filter "$name")
    done
    lane packages . vp run --concurrency-limit 1 "${filters[@]}" test
    wait
}

lane_status() {
    local lane=$1 log="$out/$1.log" summary seen failed total
    if [[ ! -f "$log" ]]; then
        echo "$lane: not started"
        return
    fi
    if [[ -f "$out/$lane.exit" ]]; then
        summary=$(strip "$log" | grep -E "^ *Tests " | tail -1 | tr -s ' ')
        echo "$lane: exit $(cat "$out/$lane.exit") (${summary:-no summary})"
        return
    fi
    if [[ $lane == packages ]]; then
        # One "~/packages/<name>$ <command>" line per package the runner has started.
        seen=$(strip "$log" | grep -cE '^~/packages/[^$]+\$ ')
        echo "$lane: package $seen/$(cat "$out/$lane.total" 2>/dev/null || echo "?")"
        return
    fi
    # Distinct test files that have reported a result so far.
    seen=$(strip "$log" | grep -oE '^ *(✓|×|↓) (\|[^|]+\| )?[^ ]+\.test\.[a-z]+' |
        sed -E 's/^ *(✓|×|↓) (\|[^|]+\| )?//' | sort -u | wc -l)
    failed=$(strip "$log" | grep -cE '^ *× ')
    total=$(cat "$out/$lane.total" 2>/dev/null || echo "?")
    echo "$lane: $seen/$total files, $failed failed"
}

status() {
    local line="" lane elapsed=""
    if [[ -f "$out/started" ]]; then
        elapsed="$(( ($(date +%s) - $(cat "$out/started")) / 60 )) min | "
    fi
    for lane in $all_lanes; do
        line+="$(lane_status "$lane") | "
    done
    echo "$(date +%H:%M) $elapsed${line% | }"
}

progress() {
    local lane finished
    while true; do
        finished=0
        for lane in $all_lanes; do
            [[ -f "$out/$lane.exit" || ! -f "$out/$lane.log" ]] && finished=$((finished + 1))
        done
        if [[ $finished -eq 4 ]]; then
            echo "DONE $(status)"
            return 0
        fi
        status
        sleep 60
    done
}

case ${1:-} in
    run)
        shift
        run "$@"
        ;;
    status) status ;;
    progress) progress ;;
    *)
        echo "Usage: $0 run [lane...] | status | progress" >&2
        exit 2
        ;;
esac
