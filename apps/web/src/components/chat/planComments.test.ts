import { ReviewCommentContextRecord } from "@t3tools/contracts";
import * as Schema from "effect/Schema";
import { describe, expect, it } from "vite-plus/test";

import { reviewCommentContextRecord } from "../../lib/composerContextRecords";
import { buildPlanReviewComment } from "./planComments";

const decodeReviewCommentRecord = Schema.decodeSync(ReviewCommentContextRecord);

describe("buildPlanReviewComment", () => {
  it("quotes the passage start for the chip and sends the whole passage with the note", () => {
    const comment = buildPlanReviewComment({
      id: "plan-comment:1",
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
    expect(buildPlanReviewComment({ id: "c", passage: "Step one", note: "ok" }).rangeLabel).toBe(
      '"Step one"',
    );
  });

  // regression: a section id built from a provider's long plan id failed the message schema
  it("fits the message context schema for a plan with a long id", () => {
    const record = reviewCommentContextRecord(
      buildPlanReviewComment({
        id: "plan-comment:0f7c2c1e-1111-4222-8333-944455556666",
        passage: "The file is untracked; no commit is made.",
        note: "Keep it tracked",
      }),
    );
    expect(() => decodeReviewCommentRecord(record)).not.toThrow();
  });
});
