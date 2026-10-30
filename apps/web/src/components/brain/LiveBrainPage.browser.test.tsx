import type { ReactNode } from "react";
import type { BrainResponse, BrainState } from "@t3tools/contracts";
import type { EnvironmentConnectionPhase } from "@t3tools/client-runtime/connection";
import * as Option from "effect/Option";
import * as Cause from "effect/Cause";
import { AsyncResult } from "effect/reactivity";
import { describe, expect, it, vi } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";

import { act, fakeTimers, render } from "../../../test/render";

type ReadResult = AsyncResult.AsyncResult<BrainResponse, Error>;

const runtime = vi.hoisted(() => ({
  isReady: false,
  hasEnvironment: true,
  prepared: false,
  phase: "connecting" as EnvironmentConnectionPhase,
  execute: vi.fn(),
  finishRead: (_result: ReadResult): void => {},
}));

vi.mock(import("../../state/environments"), async (original) => ({
  ...(await original()),
  usePrimaryEnvironmentId: (() => "local") as never,
  useEnvironments: (() => ({
    isReady: runtime.isReady,
    environments: runtime.hasEnvironment
      ? [
          {
            environmentId: "local",
            label: "My computer",
            connection: { phase: runtime.phase, error: null },
          },
        ]
      : [],
  })) as never,
}));
vi.mock(import("../../state/session"), async (original) => ({
  ...(await original()),
  usePreparedConnection: (() => (runtime.prepared ? Option.some({}) : Option.none())) as never,
}));
vi.mock(import("../../state/use-atom-command"), async (original) => ({
  ...(await original()),
  useAtomCommand: (() => runtime.execute) as never,
}));
vi.mock(import("../../state/entities"), async (original) => ({
  ...(await original()),
  useProjects: () => [],
}));
vi.mock("../ui/sidebar", () => ({
  SidebarInset: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("../WorkspacePageHeader", () => ({
  WorkspacePageHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>,
}));
vi.mock("../ui/dialog", () => ({
  Dialog: () => null,
  DialogPopup: () => null,
  DialogHeader: () => null,
  DialogTitle: () => null,
  DialogDescription: () => null,
  DialogPanel: () => null,
}));
vi.mock("./BrainControls", () => ({
  BrainSelect: () => null,
  ConnectCloudDialog: () => null,
  CreateBrainDialog: () => null,
  cliName: (id: string) => id,
}));
vi.mock("./BrainSources", () => ({ BrainSources: () => null, BrainIndexing: () => null }));

import { LiveBrainPage } from "./LiveBrainPage";

const emptyState: BrainState = {
  database: { status: "ready", message: "" },
  embeddings: { status: "ready", message: "" },
  github: { connected: false, login: "", message: "" },
  clis: [],
  workspaces: [],
};

function setup({
  connected = false,
}: {
  readonly connected?: boolean;
} = {}) {
  runtime.isReady = connected;
  runtime.hasEnvironment = true;
  runtime.prepared = connected;
  runtime.phase = connected ? "connected" : "connecting";
  runtime.finishRead = () => {};
  runtime.execute.mockReset().mockImplementation(
    () =>
      new Promise<ReadResult>((resolve) => {
        runtime.finishRead = resolve;
      }),
  );
}

function page(environment = "local", workspace: string | null = null) {
  return (
    <LiveBrainPage
      selectedWorkspaceId={workspace}
      selectedEnvironmentId={environment}
      onSelectionChange={() => {}}
    />
  );
}

function finishRead(result: ReadResult) {
  return act(() => runtime.finishRead(result));
}

function succeed(state: BrainState) {
  return finishRead(AsyncResult.success({ state, error: null, createdWorkspaceId: null }));
}

describe("Brain startup", () => {
  it("waits for the catalog and prepared connection, then shows creation only after a successful empty read", async () => {
    setup();
    // The page starts its 2 s poll on mount.
    using _timers = fakeTimers();
    await using screen = await render(page());
    const text = () => screen.container.textContent ?? "";
    expect(text()).toContain("Opening brain…");
    expect(text()).not.toContain("Create your first brain");
    expect(runtime.execute).not.toHaveBeenCalled();

    runtime.isReady = true;
    runtime.phase = "connected";
    await screen.rerender(page());
    expect(text()).toContain("Connecting to your brain…");
    expect(runtime.execute).not.toHaveBeenCalled();

    runtime.prepared = true;
    await screen.rerender(page());
    expect(runtime.execute).toHaveBeenCalledTimes(1);
    expect(text()).toContain("Loading your brains and their knowledge.");
    expect(text()).not.toContain("Create your first brain");

    await succeed(emptyState);
    expect(text()).toContain("Create your first brain");
  });

  it.each(["offline", "error", "reconnecting"] as const)(
    "does not treat %s as an empty brain list",
    async (phase) => {
      setup({ connected: true });
      runtime.phase = phase;
      // The page starts its 2 s poll on mount.
      using _timers = fakeTimers();
      await using screen = await render(page());
      const text = screen.container.textContent ?? "";
      expect(text).not.toContain("Create your first brain");
      expect(text).not.toContain("Choose a name and the CLI");
      expect(runtime.execute).not.toHaveBeenCalled();
    },
  );

  it("keeps a missing selected remote host from falling back to the local brain", async () => {
    setup({ connected: true });
    // The page starts its 2 s poll on mount.
    using _timers = fakeTimers();
    await using screen = await render(page("missing-remote"));
    const text = screen.container.textContent ?? "";
    expect(text).toContain("Choose a brain computer");
    expect(text).not.toContain("Create your first brain");
    expect(runtime.execute).not.toHaveBeenCalled();
  });

  it("shows a read failure without offering creation, then recovers on the next read", async () => {
    setup({ connected: true });
    // The page starts its 2 s poll on mount.
    using _timers = fakeTimers();
    await using screen = await render(page());
    const text = () => screen.container.textContent ?? "";
    await finishRead(AsyncResult.failure(Cause.fail(new Error("Brain service unavailable"))));
    expect(text()).toContain("Brain service unavailable");
    expect(text()).toContain("Brain unavailable");
    expect(text()).not.toContain("Create your first brain");

    await act(() => vi.advanceTimersByTime(2000));
    await succeed(emptyState);
    expect(text()).not.toContain("Brain service unavailable");
    expect(text()).toContain("Create your first brain");
  });

  it("retains loaded knowledge while reconnecting and refreshes immediately on reconnection", async () => {
    setup({ connected: true });
    // The page starts its 2 s poll on mount.
    using _timers = fakeTimers();
    await using screen = await render(page("local", "brain"));
    const text = () => screen.container.textContent ?? "";
    await succeed({
      ...emptyState,
      workspaces: [
        {
          id: "brain",
          name: "My brain",
          cli: "codex",
          sources: [],
          knowledge: {
            entities: [{ id: "node", name: "Node", kind: "Service", description: "", source: "" }],
            edges: [],
            memories: [],
          },
        },
      ],
    });

    runtime.phase = "reconnecting";
    runtime.prepared = false;
    await screen.rerender(page("local", "brain"));
    expect(text()).toContain("Reconnecting to your brain…");
    expect(text()).toContain("Drag to explore · Scroll to zoom");
    expect(runtime.execute).toHaveBeenCalledTimes(1);

    runtime.phase = "connected";
    runtime.prepared = true;
    await screen.rerender(page("local", "brain"));
    expect(runtime.execute).toHaveBeenCalledTimes(2);
    expect(text()).not.toContain("Reconnecting to your brain…");
  });
});

it.each(["transferring", "error"] as const)(
  "reflects %s migration state in the cloud button",
  async (status) => {
    setup({ connected: true });
    // The page starts its 2 s poll on mount.
    using _timers = fakeTimers();
    await using screen = await render(page("local", "brain"));
    await succeed({
      ...emptyState,
      workspaces: [
        {
          id: "brain",
          name: "Flow",
          cli: "opencode",
          sources: [],
          knowledge: { entities: [], edges: [], memories: [], documents: [] },
          migration: {
            endpoint: "https://brain.example.com",
            brainId: "remote",
            status,
            message: "Transferring",
          },
        },
      ],
    });
    const label = status === "transferring" ? "Connecting cloud…" : "Connect cloud";
    const button = screen.getByRole("button", { name: label, exact: true });
    if (status === "transferring") {
      await expect.element(button).toBeDisabled();
    } else {
      await expect.element(button).toBeEnabled();
    }
  },
);

it.each([false, true])(
  "keeps indexing failures visible and supports recovery (remote=%s)",
  async (remote) => {
    setup({ connected: true });
    const response = (status: "error" | "indexing"): BrainState => ({
      ...emptyState,
      workspaces: [
        {
          id: "brain",
          name: "Flow",
          cli: "opencode",
          ...(remote
            ? {
                remote: {
                  endpoint: "https://brain.example.com",
                  brainId: "cloud",
                  status: "ready" as const,
                  message: "Connected",
                },
              }
            : {}),
          sources: [
            {
              id: "repo",
              repository: "team/private",
              branch: "main",
              commit: "",
              revision: "",
              status,
              message: "GitHub denied repository access.",
              indexedAt: null,
            },
          ],
          knowledge: { entities: [], edges: [], memories: [], documents: [] },
        },
      ],
    });
    // The page starts its 2 s poll on mount.
    using _timers = fakeTimers();
    await using screen = await render(page("local", "brain"));
    const text = () => screen.container.textContent ?? "";
    await succeed(response("error"));
    await expect.element(screen.getByLabelText("Repository indexing failed")).toBeInTheDocument();
    expect(text()).toContain("team/private");
    expect(text()).toContain("GitHub denied repository access.");

    await userEvent.click(screen.getByRole("tab", { name: "Auto-Docs" }));
    await expect.element(screen.getByRole("alert")).toBeInTheDocument();

    const retry = screen.getByRole("button", { name: "Retry indexing team/private" });
    await userEvent.click(retry);
    expect(runtime.execute.mock.calls.at(-1)?.[0]?.input).toMatchObject({
      action: "reindex",
      workspaceId: "brain",
      sourceId: "repo",
    });
    await expect.element(retry).toBeDisabled();

    await succeed(response("indexing"));
    await expect
      .element(screen.getByLabelText("Repository indexing failed"))
      .not.toBeInTheDocument();
  },
);
