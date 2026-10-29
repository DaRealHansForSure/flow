// Flow fork: the pinned install a desktop app runs to bring its matching
// service. Temporary directories and an injected fetcher only: nothing here
// reads the real release home or reaches the network.
import * as NodeTest from "node:test";
import * as NodeAssert from "node:assert/strict";
import * as NodeFSP from "node:fs/promises";
import * as NodePath from "node:path";
import * as NodeOS from "node:os";
import * as NodeCrypto from "node:crypto";

import { installVersion, pointCurrent, releaseRepository, run } from "./flow-release.mjs";

const { test } = NodeTest;
const assert = NodeAssert;
const fs = NodeFSP;
const { join } = NodePath;

const THIS_REPOSITORY = "DaRealHansForSure/flow";
const OTHER_REPOSITORY = "samyakkkk/flow";
const RELEASE_API = `https://api.github.com/repos/${THIS_REPOSITORY}/releases/tags/`;

function releaseJson(tag) {
  return {
    tag_name: tag,
    draft: false,
    prerelease: false,
    assets: ["flow-source.tar.gz", "flow-source.tar.gz.sha256"].map((name) => ({
      name,
      browser_download_url: `https://github.com/${THIS_REPOSITORY}/releases/download/${tag}/${name}`,
    })),
  };
}

async function fixture(t) {
  const root = await fs.realpath(await fs.mkdtemp(join(NodeOS.tmpdir(), "install-version-test-")));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const source = join(root, "source");
  for (const file of [
    "scripts/flow-release.mjs",
    "scripts/flow.mjs",
    "apps/server/src/bin.ts",
    "pnpm-lock.yaml",
  ]) {
    await fs.mkdir(join(source, file, ".."), { recursive: true });
    await fs.writeFile(join(source, file), "fixture");
  }
  const archive = join(root, "source.tar.gz");
  await run("tar", ["-czf", archive, "-C", source, "."], root);
  const bytes = await fs.readFile(archive);
  const checksum =
    NodeCrypto.createHash("sha256").update(bytes).digest("hex") + "  flow-source.tar.gz\n";
  const requested = [];
  const fetcher = async (url) => {
    requested.push(url);
    if (url.startsWith(RELEASE_API)) {
      return new Response(JSON.stringify(releaseJson(url.slice(RELEASE_API.length))));
    }
    return new Response(url.endsWith(".sha256") ? checksum : bytes);
  };
  const build = async (directory) => {
    await fs.mkdir(join(directory, "apps/web/dist"), { recursive: true });
    await fs.writeFile(join(directory, "apps/web/dist/index.html"), "ready");
  };
  return { home: join(root, "installation"), fetcher, build, requested };
}

/** A release some other installer left behind, made current. */
async function installForeignRelease(home, tag, { recordRepository }) {
  const directory = join(home, "releases", tag);
  await fs.mkdir(join(directory, "scripts"), { recursive: true });
  await fs.writeFile(
    join(directory, "scripts/flow-release.mjs"),
    `const repository = "${OTHER_REPOSITORY}";\n`,
  );
  const receipt = { tag, sha256: "0".repeat(64) };
  if (recordRepository) {
    receipt.repository = OTHER_REPOSITORY;
  }
  await fs.writeFile(join(directory, "flow-release.json"), JSON.stringify(receipt));
  await pointCurrent(home, directory);
  return directory;
}

const currentReceipt = async (home) =>
  JSON.parse(await fs.readFile(join(home, "current/flow-release.json"), "utf8"));

test("installs exactly the requested version and records its repository", async (t) => {
  const f = await fixture(t);
  await installVersion(f.home, "1.2.0", f);
  assert.equal(await fs.realpath(join(f.home, "current")), join(f.home, "releases/flow-v1.2.0"));
  assert.equal(f.requested[0], `${RELEASE_API}flow-v1.2.0`);
  const receipt = await currentReceipt(f.home);
  assert.equal(receipt.tag, "flow-v1.2.0");
  assert.equal(receipt.repository, THIS_REPOSITORY);
});

test("the same version again from this repository downloads nothing", async (t) => {
  const f = await fixture(t);
  await installVersion(f.home, "1.2.0", f);
  const noDownload = {
    ...f,
    fetcher: () => {
      throw Error("unexpected download");
    },
  };
  assert.equal((await installVersion(f.home, "1.2.0", noDownload)).tag, "flow-v1.2.0");
});

test("replaces the same version from another repository in its own directory", async (t) => {
  const f = await fixture(t);
  const foreign = await installForeignRelease(f.home, "flow-v1.2.0", { recordRepository: false });
  await installVersion(f.home, "1.2.0", f);
  const current = await fs.realpath(join(f.home, "current"));
  assert.equal(current, `${foreign}-DaRealHansForSure-flow`);
  assert.equal((await currentReceipt(f.home)).repository, THIS_REPOSITORY);
  // The other repository's build stays, untouched, for a manual rollback.
  await fs.access(join(foreign, "flow-release.json"));
});

test("an older release from another repository is upgraded", async (t) => {
  const f = await fixture(t);
  await installForeignRelease(f.home, "flow-v1.1.5", { recordRepository: true });
  await installVersion(f.home, "1.2.0", f);
  assert.equal(await fs.realpath(join(f.home, "current")), join(f.home, "releases/flow-v1.2.0"));
});

test("never replaces a newer release from another repository", async (t) => {
  const f = await fixture(t);
  const foreign = await installForeignRelease(f.home, "flow-v1.3.0", { recordRepository: true });
  await assert.rejects(installVersion(f.home, "1.2.0", f), /never replaces a release/);
  assert.equal(await fs.realpath(join(f.home, "current")), foreign);
});

test("keeps a newer release already prepared from this repository", async (t) => {
  const f = await fixture(t);
  await installVersion(f.home, "1.3.0", f);
  const kept = await installVersion(f.home, "1.2.0", {
    ...f,
    fetcher: () => {
      throw Error("unexpected download");
    },
  });
  assert.equal(kept.tag, "flow-v1.3.0");
});

test("rejects a version that is not X.Y.Z", async (t) => {
  const f = await fixture(t);
  await assert.rejects(installVersion(f.home, "1.2", f), /install-version X\.Y\.Z/);
  await assert.rejects(installVersion(f.home, "../1.2.0", f), /install-version X\.Y\.Z/);
});

test("reads the repository from the receipt, else from the release's own bootstrap", async (t) => {
  const f = await fixture(t);
  const foreign = await installForeignRelease(f.home, "flow-v1.0.0", { recordRepository: false });
  assert.equal(await releaseRepository(foreign, { tag: "flow-v1.0.0" }), OTHER_REPOSITORY);
  assert.equal(await releaseRepository(foreign, { tag: "flow-v1.0.0", repository: "a/b" }), "a/b");
  assert.equal(await releaseRepository(join(f.home, "missing"), { tag: "flow-v1.0.0" }), null);
});
