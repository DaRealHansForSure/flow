import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import { AuthFilesystemWriteScope, type EnvironmentId } from "@t3tools/contracts";
import { useId, useState } from "react";

import { useCopyToClipboard } from "~/hooks/useCopyToClipboard";
import { projectEnvironment } from "~/state/projects";
import { readEnvironmentScope, useEnvironmentScope } from "~/state/session";
import { useAtomCommand } from "~/state/use-atom-command";
import {
  buildProposedPlanMarkdownFilename,
  downloadPlanAsTextFile,
  normalizePlanMarkdownForExport,
} from "../../proposedPlan";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { stackedThreadToast, toastManager } from "../ui/toast";

/** Copy, download and save-to-workspace for a plan, shared by the plan card and the Plan tab. */
export function usePlanFileActions(input: {
  readonly planMarkdown: string;
  readonly environmentId: EnvironmentId;
  readonly workspaceRoot: string | undefined;
}) {
  const { planMarkdown, environmentId, workspaceRoot } = input;
  const canWriteFiles = useEnvironmentScope(environmentId, AuthFilesystemWriteScope);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [lastSavePath, setLastSavePath] = useState("");
  const [isSavingToWorkspace, setIsSavingToWorkspace] = useState(false);
  const writeProjectFile = useAtomCommand(projectEnvironment.writeFile, {
    reportFailure: false,
  });
  const { copyToClipboard, isCopied } = useCopyToClipboard({
    target: "plan",
    onError: (error) => {
      toastManager.add(
        stackedThreadToast({
          type: "error",
          title: "Could not copy plan",
          description: error instanceof Error ? error.message : "An error occurred while copying.",
        }),
      );
    },
  });
  const downloadFilename = buildProposedPlanMarkdownFilename(planMarkdown);
  const saveContents = normalizePlanMarkdownForExport(planMarkdown);

  const openSaveDialog = () => {
    if (!canWriteFiles) {
      return;
    }
    if (!workspaceRoot) {
      toastManager.add(
        stackedThreadToast({
          type: "error",
          title: "Workspace path is unavailable",
          description: "This thread does not have a workspace path to save into.",
        }),
      );
      return;
    }
    setIsSaveDialogOpen(true);
  };

  const saveToWorkspace = (savePath: string) => {
    const relativePath = savePath.trim();
    if (!workspaceRoot || !readEnvironmentScope(environmentId, AuthFilesystemWriteScope)) {
      return;
    }
    if (!relativePath) {
      toastManager.add({
        type: "warning",
        title: "Enter a workspace path",
      });
      return;
    }

    setLastSavePath(savePath);
    setIsSavingToWorkspace(true);
    void (async () => {
      const result = await writeProjectFile({
        environmentId,
        input: {
          cwd: workspaceRoot,
          relativePath,
          contents: saveContents,
        },
      });
      setIsSavingToWorkspace(false);
      if (result._tag === "Success") {
        setIsSaveDialogOpen(false);
        toastManager.add({
          type: "success",
          title: "Plan saved to workspace",
          description: result.value.relativePath,
        });
        return;
      }
      if (!isAtomCommandInterrupted(result)) {
        const error = squashAtomCommandFailure(result);
        toastManager.add(
          stackedThreadToast({
            type: "error",
            title: "Could not save plan",
            description: error instanceof Error ? error.message : "An error occurred while saving.",
          }),
        );
      }
    })();
  };

  const saveDialog = (
    <Dialog
      open={isSaveDialogOpen}
      onOpenChange={(open) => {
        if (!isSavingToWorkspace) {
          setIsSaveDialogOpen(open);
        }
      }}
    >
      <DialogPopup className="max-w-xl">
        <SavePlanToWorkspaceForm
          initialPath={lastSavePath || downloadFilename}
          placeholder={downloadFilename}
          workspaceRoot={workspaceRoot}
          canWriteFiles={canWriteFiles}
          saving={isSavingToWorkspace}
          onCancel={() => setIsSaveDialogOpen(false)}
          onSave={saveToWorkspace}
        />
      </DialogPopup>
    </Dialog>
  );

  return {
    downloadFilename,
    isCopied,
    canSave: canWriteFiles && workspaceRoot !== undefined && !isSavingToWorkspace,
    copy: () => copyToClipboard(saveContents),
    download: () => downloadPlanAsTextFile(downloadFilename, saveContents),
    openSaveDialog,
    saveDialog,
  };
}

function SavePlanToWorkspaceForm({
  initialPath,
  placeholder,
  workspaceRoot,
  canWriteFiles,
  saving,
  onCancel,
  onSave,
}: {
  initialPath: string;
  placeholder: string;
  workspaceRoot: string | undefined;
  canWriteFiles: boolean;
  saving: boolean;
  onCancel: () => void;
  onSave: (path: string) => void;
}) {
  const [savePath, setSavePath] = useState(initialPath);
  const savePathInputId = useId();
  return (
    <>
      <DialogHeader>
        <DialogTitle>Save plan to workspace</DialogTitle>
        <DialogDescription>
          Enter a path relative to <code>{workspaceRoot ?? "the workspace"}</code>.
        </DialogDescription>
      </DialogHeader>
      <DialogPanel>
        <label htmlFor={savePathInputId} className="grid gap-1.5">
          <span className="text-xs font-medium text-foreground">Workspace path</span>
          <Input
            id={savePathInputId}
            value={savePath}
            onChange={(event) => setSavePath(event.target.value)}
            placeholder={placeholder}
            spellCheck={false}
            disabled={saving}
          />
        </label>
      </DialogPanel>
      <DialogFooter>
        <Button variant="outline" size="sm" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button size="sm" onClick={() => onSave(savePath)} disabled={!canWriteFiles || saving}>
          {saving ? "Saving..." : "Save"}
        </Button>
      </DialogFooter>
    </>
  );
}
