import * as NodeTest from "node:test";
import * as NodeAssert from "node:assert/strict";
import * as NodeFSP from "node:fs/promises";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import * as NodeHttp from "node:http";
import * as NodeEvents from "node:events";
import { discoverCloudService, discoverService, primaryStateDir } from "./service-discovery.mjs";

async function fixture(t) {
  const home = await NodeFSP.mkdtemp(NodePath.join(NodeOS.tmpdir(), "flow-discovery-"));
  t.after(() => NodeFSP.rm(home, { recursive: true, force: true }));
  const directory = NodePath.join(home, "instance-home/instances/primary");
  await NodeFSP.mkdir(NodePath.join(directory, "data"), { recursive: true });
  const config = {
    version: 1,
    id: "environment",
    name: "primary",
    mode: "isolated",
    dev: false,
    home: NodePath.join(directory, "data"),
    code: NodePath.join(home, "releases/old-running-version"),
  };
  const save = (file, data) =>
    NodeFSP.writeFile(NodePath.join(directory, file), JSON.stringify(data));
  await save("config.json", config);
  return { home, directory, config, save };
}
async function live(t, f, handler) {
  const server = NodeHttp.createServer(handler);
  server.listen(0, "127.0.0.1");
  await NodeEvents.once(server, "listening");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await f.save("runtime.json", {
    id: "environment",
    generation: "generation",
    token: "private-control-token",
    controlUrl: `http://127.0.0.1:${server.address().port}`,
  });
}
NodeTest.test("absent installation is reported without creating it", async () => {
  const home = NodePath.join(NodeOS.tmpdir(), `flow-missing-${crypto.randomUUID()}`);
  NodeAssert.equal((await discoverCloudService(home)).status, "not-configured");
  await NodeAssert.rejects(NodeFSP.stat(home), { code: "ENOENT" });
});
NodeTest.test("stopped service retains identity and pinned code without starting it", async (t) => {
  const f = await fixture(t);
  const result = await discoverCloudService(f.home);
  NodeAssert.equal(result.status, "stopped");
  NodeAssert.equal(result.environmentId, f.config.id);
  NodeAssert.equal(result.runningCode, f.config.code);
});
NodeTest.test(
  "corrupt, homeless and unsupported metadata cannot look like a fresh install",
  async (t) => {
    const f = await fixture(t);
    await NodeFSP.writeFile(NodePath.join(f.directory, "config.json"), "{");
    NodeAssert.equal((await discoverCloudService(f.home)).status, "invalid");
    await f.save("config.json", { ...f.config, home: NodePath.join(f.home, "moved-away") });
    NodeAssert.equal((await discoverCloudService(f.home)).status, "invalid");
    await f.save("config.json", { ...f.config, home: "" });
    NodeAssert.equal((await discoverCloudService(f.home)).status, "invalid");
    await f.save("config.json", { ...f.config, version: 2 });
    NodeAssert.equal((await discoverCloudService(f.home)).status, "incompatible");
  },
);
NodeTest.test("a service may own data outside its instance directory", async (t) => {
  const f = await fixture(t);
  const adopted = NodePath.join(f.home, "adopted-home");
  await NodeFSP.mkdir(adopted, { recursive: true });
  await f.save("config.json", { ...f.config, home: adopted });
  const result = await discoverCloudService(f.home);
  NodeAssert.equal(result.status, "stopped");
  NodeAssert.equal(result.dataHome, adopted);
});
NodeTest.test("registry discovery and the cloud wrapper report the same service", async (t) => {
  const f = await fixture(t);
  const direct = await discoverService({ registryRoot: NodePath.join(f.home, "instance-home") });
  const wrapped = await discoverCloudService(f.home);
  NodeAssert.equal(direct.status, "stopped");
  NodeAssert.equal(direct.environmentId, wrapped.environmentId);
  NodeAssert.equal(wrapped.installationHome, f.home);
});
NodeTest.test(
  "the primary state directory follows the recorded home, or its instance directory",
  async (t) => {
    const f = await fixture(t);
    const registry = NodePath.join(f.home, "instance-home");
    NodeAssert.equal(await primaryStateDir(registry), NodePath.join(f.directory, "data/userdata"));
    await f.save("config.json", { ...f.config, home: "/srv/flow-home" });
    NodeAssert.equal(await primaryStateDir(registry), "/srv/flow-home/userdata");
    NodeAssert.equal(
      await primaryStateDir(NodePath.join(f.home, "nowhere")),
      NodePath.join(f.home, "nowhere/instances/primary/data/userdata"),
    );
  },
);
NodeTest.test(
  "authenticates live identity without exposing credentials or trusting response fields",
  async (t) => {
    const f = await fixture(t);
    await live(t, f, (req, res) => {
      NodeAssert.equal(req.headers.authorization, "Bearer private-control-token");
      res.end(
        JSON.stringify({
          id: "environment",
          generation: "generation",
          phase: "ready",
          token: "leak",
          arbitrary: true,
        }),
      );
    });
    const result = await discoverCloudService(f.home);
    NodeAssert.equal(result.status, "ready");
    NodeAssert.equal(result.environmentId, "environment");
    NodeAssert.equal(result.token, undefined);
    NodeAssert.equal(result.arbitrary, undefined);
    // A supervisor that predates the setting reports nothing, not a guess.
    NodeAssert.equal(result.networkAccess, undefined);
    NodeAssert.equal(JSON.stringify(result).includes("private-control-token"), false);
  },
);
NodeTest.test("rejects a reused port with a different service identity", async (t) => {
  const f = await fixture(t);
  await live(t, f, (_req, res) =>
    res.end(JSON.stringify({ id: "other", generation: "generation", phase: "ready" })),
  );
  NodeAssert.equal((await discoverCloudService(f.home)).status, "invalid");
});
NodeTest.test("does not follow redirects or treat authentication failure as stopped", async (t) => {
  const f = await fixture(t);
  let status = 302;
  await live(t, f, (_req, res) => {
    res.writeHead(status, { location: "http://127.0.0.1:1/" });
    res.end();
  });
  NodeAssert.equal((await discoverCloudService(f.home)).status, "unreachable");
  status = 401;
  NodeAssert.equal((await discoverCloudService(f.home)).status, "unreachable");
});
