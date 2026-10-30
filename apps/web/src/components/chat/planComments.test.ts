import { describe, expect, it } from "vite-plus/test";

import { buildPlanReviewComment } from "./planComments";

describe("buildPlanReviewComment", () => {
  it("quotes the passage start for the chip and sends the whole passage with the note", () => {
    const comment = buildPlanReviewComment({
      id: "plan-comment:1",
      planId: "plan-1",
      passage: "  Add a migration for the new column\nand backfill old rows  ",
      note: " Use a separate PR for the backfill ",
    });
    expect(comment).toMatchObject({
      filePath: "Plan.md",
      rangeLabel: '"Add a migration for the new colu..."',
      text: "Use a separate PR for the backfill",
      diff: "Add a migration for the new column\nand backfill old rows",
      fenceLanguage: "markdown",
    });
    expect(
      buildPlanReviewComment({ id: "c", planId: "p", passage: "Step one", note: "ok" }).rangeLabel,
    ).toBe('"Step one"');
  });
});
