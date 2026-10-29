import * as NodeTest from "node:test";
import * as NodeAssert from "node:assert/strict";
import { manageBrains } from "./cli-brains.mjs";

NodeTest.test(
  "local Brain creation delegates to the service and invalid providers cannot create",
  async () => {
    const calls = [];
    await manageBrains(
      ["create", "--state-dir", "/isolated", "--name", "Test", "--cli", "claude"],
      async (...args) => {
        calls.push(args);
        return "brain-id";
      },
    );
    NodeAssert.deepEqual(calls, [
      [
        { stateDir: "/isolated", instance: "cli-brains" },
        "command",
        { command: { action: "create", name: "Test", cli: "claude" } },
      ],
    ]);
    await NodeAssert.rejects(
      manageBrains(
        ["create", "--state-dir", "/isolated", "--name", "Test", "--cli", "unknown"],
        () => NodeAssert.fail(),
      ),
      /Usage/,
    );
  },
);

NodeTest.test("local creation propagates service failure instead of claiming success", async () => {
  await NodeAssert.rejects(
    manageBrains(
      ["create", "--state-dir", "/isolated", "--name", "Test", "--cli", "claude"],
      async () => {
        throw Error("Local database unavailable");
      },
    ),
    /database unavailable/,
  );
});
