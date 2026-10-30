import type { VcsStatusResult } from "@t3tools/contracts";
import { assert, describe, it } from "vite-plus/test";

import { buildMenuItems, resolveQuickAction } from "./GitActionsControl.logic";
import {
  withoutPullRequestMenuItems,
  withoutPullRequestQuickAction,
} from "./GitActionsControl.pullRequests";

function status(overrides: Partial<VcsStatusResult> = {}): VcsStatusResult {
  return {
    isRepo: true,
    hasPrimaryRemote: true,
    isDefaultRef: false,
    refName: "feature/test",
    hasWorkingTreeChanges: false,
    workingTree: { files: [], insertions: 0, deletions: 0 },
    hasUpstream: true,
    aheadCount: 0,
    behindCount: 0,
    pr: null,
    ...overrides,
  };
}

describe("git actions with pull requests turned off", () => {
  it("drops the PR step from commit, push and PR", () => {
    const quick = resolveQuickAction(status({ hasWorkingTreeChanges: true }), false);
    assert.equal(quick.action, "commit_push_pr");
    const withoutPr = withoutPullRequestQuickAction(quick);
    assert.equal(withoutPr.action, "commit_push");
    assert.equal(withoutPr.label, "Commit & push");
  });

  it("pushes instead of push and create PR", () => {
    const quick = resolveQuickAction(status({ hasUpstream: false, aheadCount: 1 }), false);
    assert.equal(quick.action, "create_pr");
    const withoutPr = withoutPullRequestQuickAction(quick);
    assert.equal(withoutPr.action, "push");
    assert.equal(withoutPr.label, "Push");
  });

  it("leaves actions without a PR step alone", () => {
    const quick = resolveQuickAction(status({ behindCount: 2 }), false);
    assert.deepEqual(withoutPullRequestQuickAction(quick), quick);
  });

  it("removes only the PR entry from the menu", () => {
    const items = buildMenuItems(status({ aheadCount: 1 }), false);
    const ids = withoutPullRequestMenuItems(items).map((item) => item.id);
    assert.deepEqual(ids, ["commit", "push"]);
  });
});
