export function proposedPlanTitle(planMarkdown: string): string | null {
  const heading = planMarkdown.match(/^\s{0,3}#{1,6}\s+(.+)$/m)?.[1]?.trim();
  if (!heading) {
    return null;
  }
  // Flow: agents title plans "Plan: ...", which repeats the Plan label shown next to it.
  const withoutPrefix = heading.replace(/^plan\s*[:-]\s+/i, "").trim();
  return withoutPrefix.length > 0 ? withoutPrefix : heading;
}

export function stripDisplayedPlanMarkdown(planMarkdown: string): string {
  const lines = planMarkdown.trimEnd().split(/\r?\n/);
  const sourceLines = lines[0] && /^\s{0,3}#{1,6}\s+/.test(lines[0]) ? lines.slice(1) : [...lines];
  while (sourceLines[0]?.trim().length === 0) {
    sourceLines.shift();
  }
  const firstHeadingMatch = sourceLines[0]?.match(/^\s{0,3}#{1,6}\s+(.+)$/);
  if (firstHeadingMatch?.[1]?.trim().toLowerCase() === "summary") {
    sourceLines.shift();
    while (sourceLines[0]?.trim().length === 0) {
      sourceLines.shift();
    }
  }
  return sourceLines.join("\n");
}

export const PLAN_IMPLEMENTATION_PROMPT_PREFIX = "PLEASE IMPLEMENT THIS PLAN:\n";

export function buildPlanImplementationPrompt(planMarkdown: string): string {
  return `${PLAN_IMPLEMENTATION_PROMPT_PREFIX}${planMarkdown.trim()}`;
}

/** Flow: feedback on a waiting plan reads as a request to rework the plan, not to start it. */
export const PLAN_REVISION_PROMPT_PREFIX =
  "Revise your proposed plan with this feedback and present the updated plan. Do not carry out any of its steps yet.\n\n";

export function buildPlanRevisionPrompt(feedback: string): string {
  return `${PLAN_REVISION_PROMPT_PREFIX}${feedback.trim()}`;
}

/**
 * What the composer sends for a waiting plan: feedback revises it, an empty draft accepts it. An
 * attached image or file is feedback too, even without text.
 */
export function resolvePlanFollowUpSubmission(input: {
  draftText: string;
  planMarkdown: string;
  hasAttachments?: boolean;
}): {
  text: string;
  interactionMode: "default" | "plan";
} {
  const trimmedDraftText = input.draftText.trim();
  if (trimmedDraftText.length > 0 || input.hasAttachments === true) {
    return {
      text: buildPlanRevisionPrompt(trimmedDraftText),
      interactionMode: "plan",
    };
  }

  return {
    text: buildPlanImplementationPrompt(input.planMarkdown),
    interactionMode: "default",
  };
}
