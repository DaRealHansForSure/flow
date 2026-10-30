import { RegistryContext } from "@effect/atom-react";
import type { BrainCommand, BrainResponse } from "@t3tools/contracts";
import { AsyncResult, Atom } from "effect/reactivity";
import { describe, expect, it, vi } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";

import "~/index.css";
import { render } from "../../../test/render";

type BrainResult = AsyncResult.AsyncResult<BrainResponse, unknown>;

const state = vi.hoisted(() => ({
  providers: null as unknown,
  config: null as unknown,
  brainCommand: vi.fn(),
  refreshProviders: vi.fn(),
  updateSettings: vi.fn(),
  onChoose: vi.fn(),
  onContinue: vi.fn(),
}));

vi.mock(import("../../state/server"), async (original) => {
  const actual = await original();
  return {
    ...actual,
    serverEnvironment: {
      ...actual.serverEnvironment,
      providersValueAtom: (() => state.providers) as never,
      configValueAtom: (() => state.config) as never,
      refreshProviders: "refreshProviders" as never,
      updateSettings: "updateSettings" as never,
    },
  };
});
vi.mock(import("../../state/brain"), async (original) => ({
  ...(await original()),
  brainCommand: "brainCommand" as never,
}));
// The step reads Brains in an effect keyed on the command, so each executor must keep its identity.
vi.mock(import("../../state/use-atom-command"), async (original) => ({
  ...(await original()),
  useAtomCommand: ((command: "brainCommand" | "refreshProviders" | "updateSettings") =>
    state[command]) as never,
}));

import { appAtomRegistry } from "../../rpc/atomRegistry";
import { ConnectedAgentsStep } from "./WelcomeWizard";

const environmentId = "local" as never;

const readyProvider = (driver: string) => ({
  driver,
  instanceId: driver,
  enabled: true,
  installed: true,
  status: "ready",
  auth: { status: "authenticated" },
});

function brainResponse(overrides: Partial<BrainResponse>): BrainResponse {
  return {
    state: {
      database: { status: "ready", message: "" },
      embeddings: { status: "ready", message: "" },
      github: { connected: false, login: "", message: "" },
      clis: [
        { id: "claude", installed: true },
        { id: "codex", installed: false },
        { id: "opencode", installed: false },
      ],
      workspaces: [],
    },
    error: null,
    createdWorkspaceId: null,
    ...overrides,
  } as BrainResponse;
}

function respondWith(result: BrainResult) {
  state.brainCommand.mockImplementation(async () => result);
}

function brainCalls(): BrainCommand[] {
  return state.brainCommand.mock.calls.map(([args]) => (args as { input: BrainCommand }).input);
}

// The mocked modules read `state`, so every test starts by replacing all of it.
function setup() {
  state.providers = Atom.make([readyProvider("claudeAgent")]).pipe(Atom.keepAlive);
  state.config = Atom.make(null).pipe(Atom.keepAlive);
  state.brainCommand.mockReset();
  respondWith(AsyncResult.success(brainResponse({})));
  state.refreshProviders.mockReset().mockResolvedValue(AsyncResult.success(undefined));
  state.updateSettings.mockReset().mockResolvedValue(AsyncResult.success(undefined));
  state.onChoose.mockReset();
  state.onContinue.mockReset();
}

async function mountStep() {
  const screen = await render(
    <RegistryContext.Provider value={appAtomRegistry}>
      <ConnectedAgentsStep
        environmentId={environmentId}
        choice={undefined}
        onChoose={state.onChoose}
        onContinue={state.onContinue}
      />
    </RegistryContext.Provider>,
  );
  await vi.waitFor(() =>
    expect(brainCalls()).toContainEqual({ action: "read", metadataOnly: true }),
  );
  return screen;
}

async function switchToConnect(screen: Awaited<ReturnType<typeof render>>) {
  await userEvent.click(screen.getByRole("radio", { name: "Connect to your team Brain" }));
  await expect.element(screen.getByLabelText("Brain URL or invitation link")).toBeInTheDocument();
}

async function fillConnectForm(
  screen: Awaited<ReturnType<typeof render>>,
  fields: { endpoint: string; email: string; password: string },
) {
  await userEvent.fill(screen.getByLabelText("Brain URL or invitation link"), fields.endpoint);
  await userEvent.fill(screen.getByLabelText("Email"), fields.email);
  await userEvent.fill(screen.getByLabelText("Password"), fields.password);
}

describe("onboarding Brain step", () => {
  it("creates a local Brain by default and advances", async () => {
    setup();
    await using screen = await mountStep();
    await expect.element(screen.getByLabelText("Brain name")).toBeInTheDocument();
    await expect
      .element(screen.getByLabelText("Brain URL or invitation link"))
      .not.toBeInTheDocument();
    const create = screen.getByRole("button", { name: "Create Brain" });
    await expect.element(create).toBeEnabled();

    respondWith(AsyncResult.success(brainResponse({ createdWorkspaceId: "brain-1" })));
    await userEvent.click(create);

    await vi.waitFor(() => expect(state.onContinue).toHaveBeenCalledWith(environmentId));
    expect(brainCalls().at(-1)).toEqual({ action: "create", name: "My Brain", cli: "claude" });
    expect(state.onChoose).toHaveBeenCalledWith(environmentId, {
      id: "brain-1",
      name: "My Brain",
    });
  });

  it("offers only a team Brain on a computer that cannot host one", async () => {
    setup();
    // Windows has no native graph database, so there is no local Brain to
    // create and no choice to make: the step is the connect form.
    const response = brainResponse({});
    respondWith(
      AsyncResult.success({ ...response, state: { ...response.state, localBrains: false } }),
    );
    await using screen = await mountStep();

    await expect.element(screen.getByLabelText("Brain URL or invitation link")).toBeInTheDocument();
    await expect
      .element(screen.getByRole("radiogroup", { name: "Brain setup" }))
      .not.toBeInTheDocument();
    await expect.element(screen.getByLabelText("Brain name")).not.toBeInTheDocument();
    await expect.element(screen.getByRole("button", { name: "Connect Brain" })).toBeInTheDocument();
  });

  it("swaps the create fields for connect fields and requires all three", async () => {
    setup();
    await using screen = await mountStep();
    await switchToConnect(screen);

    await expect.element(screen.getByLabelText("Brain name")).not.toBeInTheDocument();
    // Conversation notes are curated locally, so the CLI choice stays in connect mode.
    await expect
      .element(screen.getByRole("radio", { name: "Use Claude Code for this Brain" }))
      .toBeInTheDocument();
    await expect.element(screen.getByLabelText("Email")).toBeInTheDocument();
    await expect.element(screen.getByLabelText("Password")).toBeInTheDocument();
    const connect = screen.getByRole("button", { name: "Connect Brain" });
    await expect.element(connect).toBeDisabled();

    await userEvent.fill(
      screen.getByLabelText("Brain URL or invitation link"),
      "https://brain.example.com",
    );
    await userEvent.fill(screen.getByLabelText("Email"), "dev@example.com");
    await expect.element(connect).toBeDisabled();
    await userEvent.fill(screen.getByLabelText("Password"), "hunter2hunter2");
    await expect.element(connect).toBeEnabled();
  });

  it("connects an existing remote Brain, records it, and advances", async () => {
    setup();
    await using screen = await mountStep();
    await switchToConnect(screen);
    await fillConnectForm(screen, {
      endpoint: "  https://brain.example.com  ",
      email: "  dev@example.com ",
      password: " hunter2hunter2 ",
    });

    respondWith(
      AsyncResult.success(
        brainResponse({
          createdWorkspaceId: "remote-1",
          state: {
            ...brainResponse({}).state,
            workspaces: [
              {
                id: "remote-1",
                name: "Acme Brain",
                remote: { endpoint: "https://brain.example.com", brainId: "b1", status: "ready" },
                sources: [
                  { id: "s1", repository: "https://github.com/team/app" },
                  { id: "s2", repository: "https://github.com/team/site" },
                ],
              },
            ] as never,
          },
        }),
      ),
    );
    await userEvent.click(screen.getByRole("button", { name: "Connect Brain" }));

    await vi.waitFor(() => expect(state.onContinue).toHaveBeenCalledWith(environmentId));
    expect(brainCalls().at(-1)).toEqual({
      action: "connectCloud",
      endpoint: "https://brain.example.com",
      email: "dev@example.com",
      password: " hunter2hunter2 ",
      cli: "claude",
    });
    expect(state.onChoose).toHaveBeenCalledWith(environmentId, {
      id: "remote-1",
      name: "Acme Brain",
      sources: ["https://github.com/team/app", "https://github.com/team/site"],
    });
    await expect.element(screen.getByLabelText("Password")).toHaveValue("");
  });

  it("shows the server error and stays on the step when the connect fails", async () => {
    setup();
    await using screen = await mountStep();
    await switchToConnect(screen);
    await fillConnectForm(screen, {
      endpoint: "https://brain.example.com",
      email: "dev@example.com",
      password: "wrong-password",
    });

    respondWith(AsyncResult.success(brainResponse({ error: "Invalid email or password." })));
    await userEvent.click(screen.getByRole("button", { name: "Connect Brain" }));

    await expect.element(screen.getByText("Invalid email or password.")).toBeInTheDocument();
    await expect.element(screen.getByRole("button", { name: "Connect Brain" })).toBeEnabled();
    expect(state.onChoose).not.toHaveBeenCalled();
    expect(state.onContinue).not.toHaveBeenCalled();
  });

  it("falls back to guidance copy when the connect fails without a message", async () => {
    setup();
    await using screen = await mountStep();
    await switchToConnect(screen);
    await fillConnectForm(screen, {
      endpoint: "https://brain.example.com",
      email: "dev@example.com",
      password: "hunter2hunter2",
    });

    respondWith(AsyncResult.fail("boom"));
    await userEvent.click(screen.getByRole("button", { name: "Connect Brain" }));

    await expect.element(screen.getByText(/Could not connect to this Brain\./)).toBeInTheDocument();
    expect(state.onContinue).not.toHaveBeenCalled();
  });
});
