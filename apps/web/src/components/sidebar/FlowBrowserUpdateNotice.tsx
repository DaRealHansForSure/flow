import { useEffect, useState } from "react";
import type { FlowBrowserUpdateState } from "@t3tools/contracts";
import { ArrowUpCircleIcon } from "lucide-react";
import { isElectron } from "../../env";
import { Button } from "../ui/button";
import { fetchFlowBrowserUpdate, waitForFlowBrowserUpdate } from "./flowBrowserUpdate";
import { ensureLocalApi } from "~/localApi";

export function FlowBrowserUpdateNotice() {
  return isElectron ? null : <BrowserUpdateNotice />;
}

function BrowserUpdateNotice() {
  const [state, setState] = useState<FlowBrowserUpdateState | null>(null);
  const [restarting, setRestarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  const confirmRestart = async () => {
    const confirmed = await ensureLocalApi().dialogs.confirm(
      "Restart Flow to update?\nThis restarts the server hosting this app. Running agents and terminal commands may be interrupted. Your saved threads, projects, and Brain data stay in place.",
    );
    if (confirmed) await restart();
  };

  const restart = async () => {
    if (!state?.readyVersion || restarting) return;
    setRestarting(true);
    setError(null);
    try {
      await applyFlowBrowserUpdate(state.readyVersion);
      window.location.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not restart Flow. Please retry.");
      setRestarting(false);
    }
  };
  if (!state?.supported || (!state.readyVersion && !restarting && !error)) return null;
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs">
      <div className="flex items-center gap-2 font-medium" role="status">
        <ArrowUpCircleIcon className="size-4 shrink-0" />
        {restarting ? "Restarting Flow…" : "Update ready"}
      </div>
      <p className="mt-1 text-muted-foreground">
        {restarting
          ? "This page will reload when Flow reconnects."
          : `Flow ${state.readyVersion} is ready to install.`}
      </p>
      {error && (
        <p className="mt-2 text-destructive" role="alert">
          {error}
        </p>
      )}
      <Button
        className="mt-2 w-full"
        size="sm"
        disabled={restarting}
        onClick={() => void confirmRestart()}
      >
        Restart to update
      </Button>
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
