import { test } from "node:test";
import assert from "node:assert/strict";
import { bearerTokenMatches, requireBearerToken } from "../src/bearer-token.js";

const token = "a".repeat(64);

test("a local endpoint refuses to start without a full-length token", () => {
  assert.throws(() => requireBearerToken(undefined, "FLOW_ADMIN_TOKEN"), /FLOW_ADMIN_TOKEN/);
  assert.throws(() => requireBearerToken("short", "FLOW_ADMIN_TOKEN"), /FLOW_ADMIN_TOKEN/);
  assert.equal(requireBearerToken(token, "FLOW_ADMIN_TOKEN"), token);
});

test("only the exact bearer token is accepted", () => {
  const cases: Array<[string | string[] | undefined, boolean]> = [
    [`Bearer ${token}`, true],
    [`Bearer ${"b".repeat(64)}`, false],
    ["Bearer undefined", false],
    [`bearer ${token}`, false],
    [`Bearer ${token} `, false],
    [undefined, false],
    [[`Bearer ${token}`], false],
  ];
  for (const [header, expected] of cases) {
    assert.equal(bearerTokenMatches(header, token), expected, String(header));
  }
});
