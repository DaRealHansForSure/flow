import * as NodeTest from "node:test";
import * as NodeAssert from "node:assert/strict";
import Database from "better-sqlite3";
import { CurationStore } from "../src/curation/store.js";
import { CurationCoordinator } from "../src/curation/coordinator.js";
import type {
  BrainCurationOutputs,
  BrainCuratorRun,
  BrainCuratorResult,
  BrainCuratorReply,
} from "../../runtime/src/contracts.js";

const result: BrainCuratorResult = { nativeThreadId: "ephemeral-1", assistantCharacters: 20 };
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
function fixture(run: (request: BrainCuratorRun) => Promise<BrainCuratorReply>) {
  const db = new Database(":memory:");
  db.exec(
    "CREATE TABLE t3_capture(seq INTEGER PRIMARY KEY, session TEXT, kind TEXT, data TEXT, ts INTEGER)",
  );
  const store = new CurationStore(db);
  const coordinator = new CurationCoordinator(store, {
    run,
    endpoint: "http://localhost:1",
    token: "private",
    cwd: "/tmp",
    intervalMs: 60000,
  });
  let seq = 0;
  return {
    db,
    store,
    coordinator,
    add(text: string, closed = false, outputs?: BrainCurationOutputs) {
      db.prepare("INSERT INTO t3_capture VALUES (?, 'chat-a', 'user_prompt', ?, ?)").run(
        ++seq,
        JSON.stringify({ text }),
        seq * 1000,
      );
      coordinator.capture("chat-a", "flow", seq, closed, outputs);
      return seq;
    },
    close() {
      coordinator.close();
      db.close();
    },
  };
}

NodeTest.test(
  "notes exist synchronously; busy checkpoints coalesce without advancing unfinished work",
  async () => {
    const begun = deferred<void>();
    const complete = deferred<BrainCuratorResult>();
    const calls: BrainCuratorRun[] = [];
    const f = fixture(async (request) => {
      calls.push(request);
      if (calls.length === 1) {
        begun.resolve();
        return complete.promise;
      }
      return result;
    });
    f.add("Create useful memory notes.");
    NodeAssert.match(f.store.get("notes:chat-a")!.text, /Create useful memory notes/);
    await begun.promise;
    f.add("Use original context.");
    f.add("Keep native history empty.", true);
    NodeAssert.equal(calls.length, 1);
    NodeAssert.equal(f.store.session("chat-a").lastSeq, 0);
    const flushed = f.coordinator.flush();
    complete.resolve(result);
    await flushed;
    NodeAssert.equal(calls.length, 2);
    NodeAssert.equal(calls[0]!.renew, true);
    NodeAssert.equal(calls[1]!.renew, false);
    NodeAssert.match(calls[1]!.input, /Use original context/);
    NodeAssert.match(calls[1]!.input, /Keep native history empty/);
    NodeAssert.doesNotMatch(calls[1]!.input, /Create useful memory notes/);
    NodeAssert.equal(f.store.session("chat-a").lastSeq, 3);
    f.close();
  },
);

NodeTest.test(
  "failed extraction retains its cursor and renews safely when explicitly retried",
  async () => {
    let fail = true;
    const calls: BrainCuratorRun[] = [];
    const f = fixture(async (request) => {
      calls.push(request);
      if (fail) throw new Error("Codex usage limit reached");
      return result;
    });
    f.add("Keep this request.");
    await f.coordinator.flush();
    NodeAssert.equal(f.store.session("chat-a").status, "error");
    NodeAssert.equal(f.store.session("chat-a").lastSeq, 0);
    NodeAssert.match(f.store.session("chat-a").error!, /usage limit/);
    fail = false;
    await f.coordinator.flush();
    NodeAssert.equal(calls.length, 2);
    NodeAssert.equal(calls[1]!.renew, true);
    NodeAssert.equal(f.store.session("chat-a").lastSeq, 1);
    f.close();
  },
);

NodeTest.test(
  "preparation failures report an error and leave the shared queue usable for retry",
  async (context) => {
    const calls: BrainCuratorRun[] = [];
    const f = fixture(async (request) => {
      calls.push(request);
      return result;
    });
    const originalList = f.store.list.bind(f.store);
    let fail = true;
    context.mock.method(f.store, "list", (...args: Parameters<CurationStore["list"]>) => {
      if (fail) throw new Error("Could not read the document catalog");
      return originalList(...args);
    });
    f.add("Preserve this request through preparation failure.");
    await NodeAssert.doesNotReject(f.coordinator.flush());
    NodeAssert.equal(calls.length, 0);
    NodeAssert.equal(f.store.session("chat-a").lastSeq, 0);
    NodeAssert.equal(f.store.session("chat-a").status, "error");
    NodeAssert.match(f.store.session("chat-a").error!, /document catalog/);
    fail = false;
    f.db
      .prepare("INSERT INTO t3_capture VALUES (2, 'chat-b', 'user_prompt', ?, 2000)")
      .run(JSON.stringify({ text: "Another chat must still work." }));
    f.coordinator.capture("chat-b", "flow", 2, true);
    await f.coordinator.flush();
    NodeAssert.equal(calls.length, 2);
    NodeAssert.ok(calls.every((call) => call.renew));
    NodeAssert.equal(f.store.session("chat-a").lastSeq, 1);
    NodeAssert.equal(f.store.session("chat-b").lastSeq, 2);
    NodeAssert.equal(f.store.session("chat-a").status, "idle");
    NodeAssert.equal(f.store.session("chat-b").status, "idle");
    f.close();
  },
);

NodeTest.test(
  "context renewal keeps a recent bounded original window and saved notes",
  async () => {
    const calls: BrainCuratorRun[] = [];
    const f = fixture(async (request) => {
      calls.push(request);
      return result;
    });
    f.add("Original task: improve memory.");
    await f.coordinator.flush();
    f.add("x".repeat(149000), true);
    await f.coordinator.flush();
    f.add("A later correction with important new evidence.", true);
    await f.coordinator.flush();
    NodeAssert.equal(calls.length, 3);
    NodeAssert.equal(calls[1]!.renew, true);
    NodeAssert.equal(calls[2]!.renew, false);
    NodeAssert.match(calls[1]!.input, /Current notes/);
    NodeAssert.match(calls[2]!.input, /later correction/);
    NodeAssert.ok(calls[1]!.input.length + calls[1]!.instructions.length <= 120000);
    NodeAssert.doesNotMatch(calls[2]!.input, /x{100}/);
    f.close();
  },
);

NodeTest.test(
  "recovery resumes enrolled work but opening an old chat enrolls only that chat",
  async () => {
    const calls: BrainCuratorRun[] = [];
    const f = fixture(async (request) => {
      calls.push(request);
      return result;
    });
    f.db
      .prepare("INSERT INTO t3_capture VALUES (1, 'archived', 'user_prompt', ?, 1000)")
      .run(JSON.stringify({ text: "An older task with useful history." }));
    f.db
      .prepare("INSERT INTO t3_capture VALUES (2, 'unopened', 'user_prompt', ?, 2000)")
      .run(JSON.stringify({ text: "An unrelated archive." }));
    f.coordinator.recover();
    await f.coordinator.flush();
    NodeAssert.equal(calls.length, 0);
    f.coordinator.open("archived", false);
    NodeAssert.match(f.store.get("notes:archived")!.text, /older task/);
    NodeAssert.equal(calls.length, 0);
    f.coordinator.open("archived");
    await f.coordinator.flush();
    NodeAssert.equal(calls.length, 1);
    NodeAssert.equal(calls[0]!.sessionId, "archived");
    f.coordinator.open("archived");
    await f.coordinator.flush();
    NodeAssert.equal(calls.length, 1);
    NodeAssert.equal(f.store.get("notes:unopened"), undefined);
    f.close();
  },
);

NodeTest.test(
  "an expired native segment gets full bounded context immediately without losing the source cursor",
  async () => {
    const calls: BrainCuratorRun[] = [];
    const f = fixture(async (request) => {
      calls.push(request);
      return calls.length === 2 ? { requiresContext: true } : result;
    });
    f.add("Original task and durable context.");
    await f.coordinator.flush();
    f.add("A correction after the native segment expired.", true);
    await f.coordinator.flush();
    NodeAssert.equal(calls.length, 3);
    NodeAssert.deepEqual(
      calls.map((call) => call.renew),
      [true, false, true],
    );
    NodeAssert.match(calls[2]!.input, /Original task and durable context/);
    NodeAssert.match(calls[2]!.input, /A correction after/);
    NodeAssert.equal(f.store.session("chat-a").lastSeq, 2);
    NodeAssert.equal(f.store.session("chat-a").status, "idle");
    NodeAssert.equal(f.store.session("chat-a").error, null);
    f.close();
  },
);

NodeTest.test(
  "the periodic checkpoint stays anchored to its prior start instead of restarting a full minute on late activity",
  async (context) => {
    context.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 1000 });
    const calls: BrainCuratorRun[] = [];
    const second = deferred<void>();
    const f = fixture(async (request) => {
      calls.push(request);
      if (calls.length === 2) second.resolve();
      return result;
    });
    f.add("Original task.");
    await f.coordinator.flush();
    context.mock.timers.tick(55_000);
    f.add("Meaningful progress near the checkpoint deadline.");
    context.mock.timers.tick(4999);
    NodeAssert.equal(calls.length, 1);
    context.mock.timers.tick(1);
    await second.promise;
    NodeAssert.equal(calls.length, 2);
    NodeAssert.match(calls[1]!.input, /Meaningful progress/);
    await f.coordinator.flush();
    f.close();
  },
);

NodeTest.test(
  "a switched-off output leaves the instructions, and switching it back renews the context",
  async () => {
    const calls: BrainCuratorRun[] = [];
    const f = fixture(async (request) => {
      calls.push(request);
      return result;
    });
    f.add("Document the deploy procedure.", true, { docs: false, skills: true });
    await f.coordinator.flush();
    f.add("Another step, settings unchanged.", true);
    await f.coordinator.flush();
    f.add("Docs are wanted again.", true, { docs: true, skills: true });
    await f.coordinator.flush();
    NodeAssert.equal(calls.length, 3);
    NodeAssert.doesNotMatch(calls[0]!.instructions, /^AUTO-DOCS$/m);
    NodeAssert.match(calls[0]!.instructions, /^AUTO-SKILLS$/m);
    NodeAssert.match(calls[0]!.instructions, /Auto-Docs \(doc\) are turned off/);
    NodeAssert.equal(calls[1]!.renew, false);
    NodeAssert.match(calls[1]!.input, /Continue the same conversation's notes and Auto-Skills/);
    NodeAssert.doesNotMatch(calls[1]!.instructions, /^AUTO-DOCS$/m);
    NodeAssert.equal(calls[2]!.renew, true);
    NodeAssert.match(calls[2]!.instructions, /^AUTO-DOCS$/m);
    NodeAssert.deepEqual(f.store.curationOutputs("chat-a"), {
      docs: true,
      skills: true,
      notesAgent: true,
    });
    f.close();
  },
);

NodeTest.test(
  "a chat with the notes agent off never runs, also after a restart, and catches up when turned on",
  async () => {
    const calls: BrainCuratorRun[] = [];
    const run = async (request: BrainCuratorRun) => {
      calls.push(request);
      return result;
    };
    const f = fixture(run);
    f.add("Original task with the agent on.", true);
    await f.coordinator.flush();
    NodeAssert.equal(calls.length, 1);
    f.coordinator.configure("chat-a", { docs: true, skills: true, notesAgent: false });
    f.add("Captured while the agent is off.", true);
    f.add("Still off, no settings sent.", true);
    f.coordinator.open("chat-a");
    await f.coordinator.flush();
    NodeAssert.equal(calls.length, 1);
    NodeAssert.equal(f.store.session("chat-a").lastSeq, 1);
    f.coordinator.close();

    const restarted = new CurationCoordinator(f.store, {
      run,
      endpoint: "http://localhost:1",
      token: "private",
      cwd: "/tmp",
      intervalMs: 60000,
    });
    restarted.recover();
    await restarted.flush();
    NodeAssert.equal(calls.length, 1);
    restarted.configure("chat-a", { docs: true, skills: true, notesAgent: true });
    await restarted.flush();
    NodeAssert.equal(calls.length, 2);
    NodeAssert.match(calls[1]!.input, /Previously processed through E1; new source ends at E3/);
    NodeAssert.match(calls[1]!.input, /Captured while the agent is off/);
    NodeAssert.match(calls[1]!.input, /Still off, no settings sent/);
    NodeAssert.equal(f.store.session("chat-a").lastSeq, 3);
    restarted.close();
    f.db.close();
  },
);

NodeTest.test("a chat that starts with the notes agent off gets no notes until it is turned on", async () => {
  const calls: BrainCuratorRun[] = [];
  const f = fixture(async (request) => {
    calls.push(request);
    return result;
  });
  f.add("A private chat.", true, { docs: true, skills: true, notesAgent: false });
  await f.coordinator.flush();
  NodeAssert.equal(calls.length, 0);
  NodeAssert.equal(f.store.get("notes:chat-a"), undefined);
  f.add("Notes are wanted now.", true, { docs: true, skills: true, notesAgent: true });
  await f.coordinator.flush();
  NodeAssert.equal(calls.length, 1);
  NodeAssert.match(calls[0]!.input, /A private chat/);
  NodeAssert.match(calls[0]!.input, /Notes are wanted now/);
  f.close();
});

NodeTest.test(
  "Auto-Docs and Auto-Skills turned off for one chat by a read reach its next run, also after a restart",
  async () => {
    const calls: BrainCuratorRun[] = [];
    const run = async (request: BrainCuratorRun) => {
      calls.push(request);
      return result;
    };
    const f = fixture(run);
    f.add("Original task.", true);
    await f.coordinator.flush();
    // A chat read carries the chat's own choices without a new capture.
    f.coordinator.configure("chat-a", { docs: false, skills: false, notesAgent: true });
    f.coordinator.close();

    const restarted = new CurationCoordinator(f.store, {
      run,
      endpoint: "http://localhost:1",
      token: "private",
      cwd: "/tmp",
      intervalMs: 60000,
    });
    const insert = f.db.prepare("INSERT INTO t3_capture VALUES (?, ?, 'user_prompt', ?, ?)");
    insert.run(2, "chat-a", JSON.stringify({ text: "Next step in the first chat." }), 2000);
    insert.run(3, "chat-b", JSON.stringify({ text: "A second chat." }), 3000);
    restarted.capture("chat-a", "flow", 2, true);
    restarted.capture("chat-b", "flow", 3, true, { docs: true, skills: true, notesAgent: true });
    await restarted.flush();
    const firstChat = calls.filter((call) => call.sessionId === "chat-a");
    const secondChat = calls.filter((call) => call.sessionId === "chat-b");
    NodeAssert.equal(firstChat.length, 2);
    NodeAssert.match(firstChat[0]!.instructions, /^AUTO-DOCS$/m);
    NodeAssert.match(firstChat[1]!.input, /Next step in the first chat/);
    NodeAssert.doesNotMatch(firstChat[1]!.instructions, /^AUTO-DOCS$/m);
    NodeAssert.doesNotMatch(firstChat[1]!.instructions, /^AUTO-SKILLS$/m);
    NodeAssert.equal(secondChat.length, 1);
    NodeAssert.match(secondChat[0]!.instructions, /^AUTO-DOCS$/m);
    NodeAssert.match(secondChat[0]!.instructions, /^AUTO-SKILLS$/m);
    restarted.close();
    f.db.close();
  },
);
