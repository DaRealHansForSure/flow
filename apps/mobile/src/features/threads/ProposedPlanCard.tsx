import { useAtomValue } from "@effect/atom-react";
import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import { planVersionLabel } from "@t3tools/client-runtime/state/plan-versions";
import type { EnvironmentId, PlanId } from "@t3tools/contracts";
import { proposedPlanTitle, stripDisplayedPlanMarkdown } from "@t3tools/shared/proposedPlanText";
import { useRef, useState, type ReactNode } from "react";
import { View } from "react-native";

import { AppText as Text } from "../../components/ui/AppText";
import { Button } from "../../components/ui/Button";
import * as Dialog from "../../components/ui/Dialog";
import { projectEnvironment } from "../../state/projects";
import { useAtomCommand } from "../../state/use-atom-command";
import { CopyTextButton } from "./CopyTextButton";
import { MobilePlanReviewActions, useMobilePlanReview } from "./plan-review";

export function ProposedPlanCard(props: {
  readonly planId: PlanId;
  readonly environmentId: EnvironmentId;
  readonly workspaceRoot: string | null | undefined;
  readonly markdown: string;
  readonly renderMarkdown: (text: string) => ReactNode;
}) {
  const canWrite = useAtomValue(projectEnvironment.writeFile.permissionAtom(props.environmentId));
  const writeFile = useAtomCommand(projectEnvironment.writeFile, { reportFailure: false });
  const inFlight = useRef(false);
  const [saving, setSaving] = useState(false);
  const [lastPath, setLastPath] = useState("plan.md");
  const contents = `${props.markdown.trimEnd()}\n`;
  const { versions, review, reopen } = useMobilePlanReview();
  const version = versions.find((candidate) => candidate.id === props.planId);
  const statusLabel = version ? planVersionLabel(version, versions.length) : null;

  const save = async (path: string) => {
    const relativePath = path.trim();
    if (!canWrite || !props.workspaceRoot || inFlight.current) return;
    if (!relativePath) {
      Dialog.alert("Enter a workspace path");
      return;
    }
    inFlight.current = true;
    setSaving(true);
    setLastPath(relativePath);
    const result = await writeFile({
      environmentId: props.environmentId,
      input: { cwd: props.workspaceRoot, relativePath, contents },
    }).finally(() => {
      inFlight.current = false;
      setSaving(false);
    });
    if (result._tag === "Success") {
      Dialog.alert("Plan saved to workspace", result.value.relativePath);
    } else if (!isAtomCommandInterrupted(result)) {
      const error = squashAtomCommandFailure(result);
      Dialog.alert("Could not save plan", error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <View className="mb-3 gap-3 rounded-[20px] border border-border bg-card-alt p-4">
      <View className="flex-row items-center gap-2">
        <Text accessibilityRole="header" className="flex-1 font-t3-bold text-base text-foreground">
          {proposedPlanTitle(props.markdown) ?? "Proposed plan"}
        </Text>
        <CopyTextButton accessibilityLabel="Copy plan" text={contents} />
      </View>
      {statusLabel ? <Text className="text-sm text-foreground-muted">{statusLabel}</Text> : null}
      {props.renderMarkdown(stripDisplayedPlanMarkdown(props.markdown))}
      {review !== null && review.planId === props.planId ? (
        <MobilePlanReviewActions review={review} />
      ) : reopen !== null && version !== undefined && version.status !== "active" ? (
        <View className="flex-row">
          <Button label="Reopen this plan" onPress={() => reopen(props.planId)} />
        </View>
      ) : null}
      <View className="flex-row">
        <Button
          label={saving ? "Saving..." : "Save to workspace"}
          tone="secondary"
          disabled={!canWrite || !props.workspaceRoot || saving}
          onPress={() =>
            Dialog.prompt({
              title: "Save plan to workspace",
              // The write replaces an existing file, and the RPC has no create-only mode.
              message:
                "Enter a path relative to the thread's workspace. A file already at that path is replaced.",
              initialValue: lastPath,
              confirmText: "Save",
              onConfirm: (path) => void save(path),
            })
          }
        />
      </View>
    </View>
  );
}
