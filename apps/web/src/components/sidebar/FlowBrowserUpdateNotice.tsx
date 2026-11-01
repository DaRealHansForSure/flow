import { useEffect, useRef, useState } from "react";
import type {
  EnvironmentId,
  FlowBrowserUpdateInput,
  FlowBrowserUpdateState,
} from "@t3tools/contracts";
import {
  type AtomCommandResult,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import { ArrowUpCircleIcon } from "lucide-react";
import { isElectron } from "../../env";
import { Button } from "../ui/button";
import {
  type FlowFleetMember,
  fetchFlowBrowserUpdate,
  planFlowFleetUpdate,
  runFlowFleetUpdate,
  waitForFlowBrowserUpdate,
} from "./flowBrowserUpdate";
import { ensureLocalApi } from "~/localApi";
import { useEnvironments, usePrimaryEnvironmentId } from "~/state/environments";
import { serverEnvironment } from "~/state/server";
import { useAtomCommand } from "~/state/use-atom-command";

export function FlowBrowserUpdateNotice() {
  return isElectron ? null : <BrowserUpdateNotice />;
}

function joinLabels(labels: ReadonlyArray<string>): string {
  if (labels.length <= 2) return labels.join(" and ");
  return `${labels.slice(0, -1).join(", ")}, and ${labels.at(-1)}`;
}

async function readOtherState<E>(
  read: (target: {
    readonly environmentId: EnvironmentId;
    readonly input: FlowBrowserUpdateInput;
  }) => Promise<AtomCommandResult<FlowBrowserUpdateState, E>>,
  environmentId: EnvironmentId,
): Promise<FlowBrowserUpdateState> {
  const result = await read({ environmentId, input: {} });
  if (result._tag === "Failure") {
    const failure = squashAtomCommandFailure(result);
    throw new Error(failure instanceof Error ? failure.message : "Could not reach this server.");
  }
  return result.value;
}

function BrowserUpdateNotice() {
  const [state, setState] = useState<FlowBrowserUpdateState | null>(null);
  const [members, setMembers] = useState<ReadonlyArray<FlowFleetMember>>([]);
  const [progress, setProgress] = useState<{ title: string; detail: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Other connected environments update first; the server hosting this page restarts last.
  const { environments } = useEnvironments();
  const primaryId = usePrimaryEnvironmentId();
  const readOther = useAtomCommand(serverEnvironment.flowBrowserUpdate, { reportFailure: false });
  const applyOther = useAtomCommand(serverEnvironment.applyFlowBrowserUpdate, {
    reportFailure: false,
  });
  const fleet = useRef({
    others: [] as ReadonlyArray<{ id: EnvironmentId; label: string }>,
    readOther,
  });
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- The polling loop reads the latest environment list and command without restarting.
  useEffect(() => {
    fleet.current = {
      others: environments
        .filter(
          (environment) =>
            environment.environmentId !== primaryId && environment.connection.phase === "connected",
        )
        .map((environment) => ({ id: environment.environmentId, label: environment.label })),
      readOther,
    };
  });

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Polls the server's update route and rechecks when the tab becomes visible.
  useEffect(() => {
    let disposed = false;
    let pending = false;
    const check = async () => {
      if (document.hidden || pending) return;
      pending = true;
      return await (async () => {
        try {
          const next = await fetchFlowBrowserUpdate();
          if (!disposed) setState(next);
        } catch {
          /* Source installations and older servers may not expose this route. */
        }
        const others = await Promise.all(
          fleet.current.others.map(async ({ id, label }) => ({
            environmentId: id,
            label,
            // Older servers do not know the method; they simply are not offered.
            state: await readOtherState(fleet.current.readOther, id).catch(() => null),
          })),
        );
        if (!disposed) setMembers(others);
      })().finally(() => {
        pending = false;
      });
    };
    void check();
    const timer = setInterval(() => void check(), 30000);
    const onVisible = () => void check();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      disposed = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const plan = planFlowFleetUpdate(state, members);
  const otherLabels = plan.others.map(({ label }) => label);

  const confirmRestart = async () => {
    const message =
      otherLabels.length === 0
        ? "Restart Flow to update?\nThis restarts the server hosting this app. Running agents and terminal commands may be interrupted. Your saved threads, projects, and Brain data stay in place."
        : `Update Flow on ${joinLabels(otherLabels)}${plan.hostingVersion === null ? "" : ", then on this server"}?\nEach server restarts in turn${plan.hostingVersion === null ? "" : "; the server hosting this app goes last"}. Running agents and terminal commands may be interrupted. Your saved threads, projects, and Brain data stay in place.`;
    const confirmed = await ensureLocalApi().dialogs.confirm(message);
    if (confirmed) await restart();
  };

  const restart = async () => {
    if (progress !== null) return;
    setError(null);
    try {
      const failures = await runFlowFleetUpdate(plan, {
        updateOther: async ({ environmentId, label, version }) => {
          setProgress({
            title: `Updating ${label}…`,
            detail: "Waiting until it runs the new version.",
          });
          const result = await applyOther({ environmentId, input: {} });
          if (result._tag === "Failure") {
            const failure = squashAtomCommandFailure(result);
            throw new Error(
              failure instanceof Error ? failure.message : "Could not start the update.",
            );
          }
          await waitForFlowBrowserUpdate(result.value.readyVersion ?? version, {
            read: () => readOtherState(readOther, environmentId),
            wait: () => new Promise<void>((resolve) => setTimeout(resolve, 1500)),
            now: () => Date.now(),
          });
        },
        updateHosting: async (version) => {
          setProgress({
            title: "Restarting Flow…",
            detail: "This page will reload when Flow reconnects.",
          });
          await applyFlowBrowserUpdate(version);
          window.location.reload();
        },
      });
      if (failures.length > 0) setError(failures.join("\n"));
      setMembers([]);
      setProgress(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not restart Flow. Please retry.");
      setProgress(null);
    }
  };

  if (plan.hostingVersion === null && plan.others.length === 0 && progress === null && !error) {
    return null;
  }
  const version = plan.hostingVersion ?? plan.others[0]?.version ?? null;
  const where =
    otherLabels.length === 0
      ? ""
      : ` on ${joinLabels(plan.hostingVersion === null ? otherLabels : ["this server", ...otherLabels])}`;
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs">
      <div className="flex items-center gap-2 font-medium" role="status">
        <ArrowUpCircleIcon className="size-4 shrink-0" />
        {progress?.title ?? "Update ready"}
      </div>
      <p className="mt-1 text-muted-foreground">
        {progress !== null
          ? progress.detail
          : version === null
            ? "Flow could not finish the update."
            : `Flow ${version} is ready to install${where}.`}
      </p>
      {error && (
        <p className="mt-2 whitespace-pre-line text-destructive" role="alert">
          {error}
        </p>
      )}
      {(plan.hostingVersion !== null || plan.others.length > 0) && (
        <Button
          className="mt-2 w-full"
          size="sm"
          disabled={progress !== null}
          onClick={() => void confirmRestart()}
        >
          {otherLabels.length === 0 ? "Restart to update" : "Update all"}
        </Button>
      )}
    </div>
  );
}

/** Starts the update and waits until the service runs the new version. */
async function applyFlowBrowserUpdate(readyVersion: string) {
  let target = readyVersion;
  try {
    target = (await fetchFlowBrowserUpdate(true)).readyVersion ?? target;
  } catch (cause) {
    // A dropped response can mean the restart already began. HTTP errors
    // are explicit rejections and should remain actionable immediately.
    if (cause instanceof Error && cause.message.startsWith("Flow update request failed")) {
      throw cause;
    }
  }
  await waitForFlowBrowserUpdate(target);
}
