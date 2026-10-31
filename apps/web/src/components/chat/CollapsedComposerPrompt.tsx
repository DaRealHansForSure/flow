import {
  assistantCitationLabel,
  collectAssistantCitations,
} from "@t3tools/shared/assistantCitations";
import { collectComposerContextReferences } from "@t3tools/shared/composerContextReferences";

import { ContextChip, type ContextChipKind } from "../ContextChip";

const CHIP_KINDS = new Set<string>([
  "image",
  "file",
  "mention",
  "terminal",
  "element",
  "preview-annotation",
  "review-comment",
  "skill",
  "thread",
  "environment",
]);

/**
 * Flow: the collapsed phone composer's one-line preview, with context references and answer quotes
 * drawn as chips instead of their raw `[label](t3-context://...)` or `t3-citation://` markup.
 */
export function CollapsedComposerPrompt(props: { readonly prompt: string }) {
  const references = [
    ...collectComposerContextReferences(props.prompt).map((reference) => ({
      start: reference.start,
      end: reference.end,
      kind: CHIP_KINDS.has(reference.kind) ? (reference.kind as ContextChipKind) : "neutral",
      label: reference.label,
    })),
    // Quotes of an answer are links too; the editor draws them as chips, so does the preview.
    ...collectAssistantCitations(props.prompt).map((reference) => ({
      start: reference.start,
      end: reference.end,
      kind: "citation" as const,
      label: assistantCitationLabel(reference.citation),
    })),
  ].toSorted((left, right) => left.start - right.start);
  const parts: Array<string | (typeof references)[number]> = [];
  let cursor = 0;
  for (const reference of references) {
    if (reference.start < cursor) {
      continue;
    }
    parts.push(props.prompt.slice(cursor, reference.start), reference);
    cursor = reference.end;
  }
  parts.push(props.prompt.slice(cursor));
  return parts.map((part) =>
    typeof part === "string" ? (
      part
    ) : (
      <ContextChip key={part.start} kind={part.kind}>
        {part.label}
      </ContextChip>
    ),
  );
}
