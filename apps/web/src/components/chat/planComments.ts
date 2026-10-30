import type { ReviewCommentContext } from "../../reviewCommentContext";

const PLAN_COMMENT_QUOTE_MAX_CHARS = 32;

/**
 * Flow: a comment on a passage of the open plan, sent like a file review comment so the
 * composer shows it as a chip and the agent gets the quoted passage with the note.
 */
export function buildPlanReviewComment(input: {
  readonly id: string;
  readonly planId: string;
  readonly passage: string;
  readonly note: string;
}): ReviewCommentContext {
  const passage = input.passage.trim();
  const firstLine = passage.split("\n", 1)[0] ?? "";
  const quote =
    firstLine.length > PLAN_COMMENT_QUOTE_MAX_CHARS || firstLine.length < passage.length
      ? `${firstLine.slice(0, PLAN_COMMENT_QUOTE_MAX_CHARS).trimEnd()}...`
      : firstLine;
  return {
    id: input.id,
    sectionId: `plan:${input.planId}`,
    sectionTitle: "Plan comment",
    filePath: "Plan.md",
    startIndex: 0,
    endIndex: 0,
    rangeLabel: `"${quote}"`,
    text: input.note.trim(),
    diff: passage,
    fenceLanguage: "markdown",
  };
}
