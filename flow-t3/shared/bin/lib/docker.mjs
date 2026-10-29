// FalkorDB provisioning for `flow up`, the only thing Flow runs in Docker. An
// existing FalkorDB (a container, a native build, or FALKOR_HOST) is used as is.
// Container flow-falkordb (FALKOR_CONTAINER overrides), image
// falkordb/falkordb:latest, port FALKOR_PORT (default 6379).

import * as NodeChildProcess from "node:child_process";
import * as NodeNet from "node:net";

const IMAGE = "falkordb/falkordb:latest";
const HOST = process.env.FALKOR_HOST ?? "localhost";
const PORT = Number(process.env.FALKOR_PORT ?? 6379);
// One container per FalkorDB port, so a test deployment on a shifted
// FALKOR_PORT gets its own store; one shared name would let `docker inspect`
// find the default container and leave the gateway on an empty port.
const CONTAINER_NAME =
  process.env.FALKOR_CONTAINER ?? (PORT === 6379 ? "flow-falkordb" : `flow-falkordb-${PORT}`);

// A friendly, already-explained setup problem. flow.mjs's top-level catch prints
// err.message behind a ✗ — so these read as guidance, not a stack trace.
class SetupError extends Error {}

function isLocalHost(h) {
  return h === "localhost" || h === "127.0.0.1" || h === "::1";
}

function docker(args, opts = {}) {
  return NodeChildProcess.spawnSync("docker", args, { encoding: "utf-8", ...opts });
}

function dockerInstalled() {
  return docker(["--version"]).status === 0;
}

function dockerDaemonUp() {
  return docker(["info"], { stdio: ["ignore", "ignore", "ignore"] }).status === 0;
}

// Is something already accepting connections on FalkorDB's port?
function portOpen(host, port, timeoutMs = 500) {
  return new Promise((resolve) => {
    const sock = NodeNet.createConnection({ host, port });
    let settled = false;
    const done = (v) => {
      if (settled) return;
      settled = true;
      sock.destroy();
      resolve(v);
    };
    sock.setTimeout(timeoutMs);
    sock.once("connect", () => done(true));
    sock.once("timeout", () => done(false));
    sock.once("error", () => done(false));
  });
}

async function waitForPort(host, port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await portOpen(host, port)) return true;
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

// Pull the FalkorDB image if it isn't cached locally. Pull progress is shown
// (stdout inherited); stderr is captured so a failure reports its REAL cause —
// never the "Unable to find image … locally" informational line.
async function ensureImage() {
  const have = docker(["image", "inspect", IMAGE], { stdio: ["ignore", "ignore", "ignore"] });
  if (have.status === 0) return;

  console.log(`  downloading FalkorDB image (first run, a few hundred MB)…`);
  const pull = NodeChildProcess.spawnSync("docker", ["pull", IMAGE], {
    encoding: "utf-8",
    stdio: ["ignore", "inherit", "pipe"], // progress → terminal, errors → captured
  });
  if (pull.status === 0) return;

  const err = (pull.stderr ?? "").trim();
  const cause =
    err
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !/unable to find image/i.test(l))
      .pop() ?? "unknown error";
  if (/toomanyrequests|rate limit/i.test(err)) {
    throw new SetupError(
      `Docker Hub refused the FalkorDB image pull — you've hit its anonymous rate limit.\n` +
        `  Fix: run  docker login  (a free Docker Hub account raises the limit), or wait\n` +
        `  an hour, then re-run  flow up.\n` +
        `  (${cause})`
    );
  }
  throw new SetupError(
    `Couldn't download the FalkorDB image (docker pull ${IMAGE}):\n` +
      `  ${cause}\n` +
      `  Usually a network hiccup — check connectivity/VPN and re-run  flow up.\n` +
      `  You can also pull it yourself to watch the full output:  docker pull ${IMAGE}`
  );
}

function notReadyError() {
  // Container came up but never opened the port — surface why instead of a
  // silent 20s stall followed by "gateway didn't start".
  const logs = docker(["logs", "--tail", "20", CONTAINER_NAME]);
  const tail = ((logs.stdout ?? "") + (logs.stderr ?? "")).trim().split("\n").slice(-6).join("\n  ");
  return new SetupError(
    `FalkorDB didn't become reachable on ${HOST}:${PORT} within 20s.\n` +
      (tail ? `  Last container logs:\n  ${tail}\n` : "") +
      `  Inspect with:  docker logs ${CONTAINER_NAME}`
  );
}

/**
 * Ensure a FalkorDB is reachable for the gateway before services start.
 * Returns "external", "running", "started" or "launched" for a one-line log.
 * Throws SetupError (friendly, no stack) when Docker is needed but unavailable.
 */
export async function ensureFalkordb() {
  // 1) Remote / user-managed FalkorDB — never touch Docker.
  if (!isLocalHost(HOST)) return "external";

  // 2) Already serving locally (our container from a previous run, a native
  //    FalkorDB, Colima/OrbStack…). Use it; don't require Docker at all.
  if (await portOpen(HOST, PORT)) return "running";

  // 3) We must bring the container up — Docker has to be usable. Fail with a fix.
  if (!dockerInstalled()) {
    throw new SetupError(
      `Docker isn't installed, and nothing is serving FalkorDB on ${HOST}:${PORT}.\n` +
        `  Flow runs its graph database (FalkorDB) in a container.\n` +
        `  → Install Docker Desktop: https://docs.docker.com/get-docker/  then re-run  flow up\n` +
        `  Prefer no Docker? Run FalkorDB yourself and point Flow at it:\n` +
        `      FALKOR_HOST=<host> FALKOR_PORT=<port> flow up`
    );
  }
  if (!dockerDaemonUp()) {
    throw new SetupError(
      `Docker is installed but its daemon isn't running.\n` +
        `  Start Docker Desktop (or your engine), wait until it's ready, then re-run  flow up.`
    );
  }

  // 4) Pull the image BEFORE `docker run`: an explicit pull shows progress for
  //    hundreds of MB, and a run-triggered pull's stderr starts with "Unable to
  //    find image locally", which would hide the real cause of a failure.
  await ensureImage();

  // Container already exists? inspect exits non-zero ONLY for "no such
  // container" now that we know the daemon is up.
  const inspect = docker(["inspect", CONTAINER_NAME, "--format", "{{.State.Status}}"]);
  if (inspect.status === 0) {
    if (inspect.stdout.trim() === "running") return "running";
    // Exists but not running (exited/created/paused/dead) — start it.
    const started = docker(["start", CONTAINER_NAME]);
    if (started.status !== 0) {
      throw new SetupError(
        `Couldn't start the existing flow-falkordb container:\n  ${(started.stderr ?? "").trim().split("\n")[0]}\n` +
          `  Try:  docker rm -f ${CONTAINER_NAME}   then re-run  flow up  to recreate it.`
      );
    }
    if (!(await waitForPort(HOST, PORT, 20000))) throw notReadyError();
    return "started";
  }

  // 5) Create it.
  const run = docker(["run", "-d", "--name", CONTAINER_NAME, "-p", `${PORT}:6379`, IMAGE]);
  if (run.status !== 0) {
    const err = (run.stderr ?? "").trim();
    if (/already in use|address already in use|port is already allocated/i.test(err)) {
      throw new SetupError(
        `Port ${PORT} is already in use, so FalkorDB can't start.\n` +
          `  Something else (another Redis/FalkorDB?) holds it. Free it, or point Flow\n` +
          `  at that instance:  FALKOR_HOST=<host> FALKOR_PORT=<port> flow up`
      );
    }
    if (/name .* already in use/i.test(err)) {
      // Rare race: inspect said no-such-container but the name is taken. Recover.
      docker(["rm", "-f", CONTAINER_NAME]);
      const retry = docker(["run", "-d", "--name", CONTAINER_NAME, "-p", `${PORT}:6379`, IMAGE]);
      if (retry.status === 0 && (await waitForPort(HOST, PORT, 20000))) return "launched";
    }
    const cause =
      err.split("\n").map((l) => l.trim()).filter((l) => l && !/unable to find image/i.test(l)).pop() ??
      "unknown error";
    throw new SetupError(`Couldn't start FalkorDB via Docker:\n  ${cause}`);
  }
  if (!(await waitForPort(HOST, PORT, 20000))) throw notReadyError();
  return "launched";
}
