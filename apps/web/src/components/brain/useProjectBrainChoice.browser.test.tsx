import { EnvironmentId, type BrainState } from "@t3tools/contracts";
import { useState } from "react";
import { describe, expect, it, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";

import "~/index.css";
import { render } from "../../../test/render";

const mocks = vi.hoisted(() => ({ execute: vi.fn() }));

vi.mock(import("../../state/use-atom-command"), async (original) => ({
  ...(await original()),
  useAtomCommand: (() => mocks.execute) as never,
}));

import { useProjectBrainChoice } from "./useProjectBrainChoice";

const environmentId = EnvironmentId.make("local");

function setup() {
  mocks.execute.mockReset();
}

function brainState(workspaces: BrainState["workspaces"]): BrainState {
  return {
    database: { status: "ready", message: "" },
    embeddings: { status: "ready", message: "" },
    github: { connected: false, login: "", message: "" },
    clis: [
      { id: "claude", installed: true },
      { id: "codex", installed: false },
      { id: "opencode", installed: false },
    ],
    workspaces,
  };
}

function success(state: BrainState, createdWorkspaceId: string | null = null) {
  return { _tag: "Success", value: { state, error: null, createdWorkspaceId } };
}

function Harness() {
  const { chooseBrain, brainChoiceDialog } = useProjectBrainChoice({ required: true });
  const [choice, setChoice] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => {
          void chooseBrain(environmentId, "Acme project").then((next) => {
            setChoice(next?.workspaceId ?? null);
          });
        }}
      >
        Start
      </button>
      <output>{choice ?? "pending"}</output>
      {brainChoiceDialog}
    </>
  );
}

describe("useProjectBrainChoice", () => {
  it("requires an existing brain and defaults to the first available one", async () => {
    setup();
    mocks.execute.mockResolvedValue(
      success(
        brainState([
          {
            id: "brain-1",
            name: "Team brain",
            cli: "claude",
            sources: [],
            knowledge: { entities: [], edges: [], memories: [] },
          },
        ]),
      ),
    );
    await using screen = await render(<Harness />);

    await userEvent.click(screen.getByRole("button", { name: "Start" }));
    const connect = page.getByRole("button", { name: "Connect brain" });
    await expect.element(connect).toBeEnabled();

    await expect.element(page.getByText("Continue without a brain")).not.toBeInTheDocument();
    await expect.element(page.getByText("No brain", { exact: true })).not.toBeInTheDocument();
    await userEvent.click(connect);
    await expect.element(screen.getByRole("status")).toHaveTextContent("brain-1");
  });

  it("opens a one-action creation flow and connects the new brain", async () => {
    setup();
    mocks.execute
      .mockResolvedValueOnce(success(brainState([])))
      .mockResolvedValueOnce(success(brainState([]), "brain-created"));
    await using screen = await render(<Harness />);

    await userEvent.click(screen.getByRole("button", { name: "Start" }));

    await expect.element(page.getByText("Create a brain")).toBeInTheDocument();
    await expect.element(page.getByRole("textbox", { name: "Brain name" })).toHaveValue("My brain");
    await userEvent.click(page.getByRole("button", { name: "Create brain" }));

    await expect.element(screen.getByRole("status")).toHaveTextContent("brain-created");
    expect(mocks.execute).toHaveBeenLastCalledWith({
      environmentId,
      input: { action: "create", name: "My brain", cli: "claude" },
    });
  });

  it("connects a remote brain from creation without requiring a local CLI or creating a local brain", async () => {
    setup();
    const empty = { ...brainState([]), clis: [] };
    mocks.execute
      .mockResolvedValueOnce(success(empty))
      .mockResolvedValueOnce(success(empty, "remote-brain"));
    await using screen = await render(<Harness />);

    await userEvent.click(screen.getByRole("button", { name: "Start" }));
    await userEvent.click(page.getByRole("radio", { name: "Remote Brain" }));
    await userEvent.fill(
      page.getByRole("textbox", { name: "Brain URL or invitation link" }),
      "https://brain.example.com",
    );
    await userEvent.fill(page.getByLabelText("Password"), "test-password");
    await userEvent.fill(page.getByRole("textbox", { name: "Email" }), "member@example.com");

    const connect = page.getByRole("button", { name: "Connect remote Brain" });
    await expect.element(connect).toBeEnabled();
    await userEvent.click(connect);

    await expect.element(screen.getByRole("status")).toHaveTextContent("remote-brain");
    expect(mocks.execute).toHaveBeenLastCalledWith({
      environmentId,
      input: {
        action: "connectCloud",
        endpoint: "https://brain.example.com",
        email: "member@example.com",
        password: "test-password",
      },
    });
  });
});
