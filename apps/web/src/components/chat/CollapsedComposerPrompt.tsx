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
 * Flow: the collapsed phone composer's one-line preview, with context references drawn as chips
 * instead of their raw `[label](t3-context://...)` markup.
 */
export function CollapsedComposerPrompt(props: { readonly prompt: string }) {
  const parts: Array<
    string | { readonly key: number; readonly kind: string; readonly label: string }
  > = [];
  let cursor = 0;
  for (const reference of collectComposerContextReferences(props.prompt)) {
    parts.push(props.prompt.slice(cursor, reference.start));
    parts.push({ key: reference.start, kind: reference.kind, label: reference.label });
    cursor = reference.end;
  }
  parts.push(props.prompt.slice(cursor));
  return parts.map((part) =>
    typeof part === "string" ? (
      part
    ) : (
      <ContextChip
        key={part.key}
        kind={CHIP_KINDS.has(part.kind) ? (part.kind as ContextChipKind) : "neutral"}
      >
        {part.label}
      </ContextChip>
    ),
  );
}
