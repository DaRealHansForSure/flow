import { BrainRepositoryPicker } from "@flow/brain-ui";
import { describe, expect, it, vi } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";

import { render } from "../../../test/render";

describe("BrainRepositoryPicker", () => {
  it("loads repositories and branches, then imports the selected branch", async () => {
    const connect = vi.fn(async () => {});
    const onConnected = vi.fn();
    await using screen = await render(
      <BrainRepositoryPicker
        connectedRepositories={["acme/already"]}
        connection="GitHub connected"
        loadRepositories={async () => [
          { name: "acme/already", private: true },
          { name: "acme/new", private: true, defaultBranch: "main" },
        ]}
        loadBranches={async () => ["main", "release"]}
        connect={connect}
        onConnected={onConnected}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Browse repositories" }));
    await expect.element(screen.getByRole("checkbox", { name: /acme\/already/ })).toBeDisabled();

    await userEvent.click(screen.getByRole("checkbox", { name: /acme\/new/ }));
    const branch = screen.getByRole("combobox", { name: "Branch for acme/new" });
    await expect.element(branch.getByRole("option", { name: "release" })).toBeInTheDocument();
    await userEvent.selectOptions(branch, "release");

    await userEvent.click(screen.getByRole("button", { name: "Connect 1 repositories" }));
    await vi.waitFor(() => {
      expect(onConnected).toHaveBeenCalledOnce();
    });
    expect(connect).toHaveBeenCalledExactlyOnceWith("acme/new", "release");
  });

  it("keeps failed selections retryable without reconnecting successful imports", async () => {
    const connect = vi
      .fn<(repository: string, branch?: string) => Promise<void>>()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(Error("Import failed"))
      .mockResolvedValueOnce(undefined);
    const onConnected = vi.fn();
    await using screen = await render(
      <BrainRepositoryPicker
        connectedRepositories={[]}
        connection="GitHub connected"
        loadRepositories={async () => [
          { name: "acme/one", private: false },
          { name: "acme/two", private: false },
        ]}
        loadBranches={async () => []}
        connect={connect}
        onConnected={onConnected}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Browse repositories" }));
    await userEvent.click(screen.getByRole("checkbox", { name: /acme\/one/ }));
    await userEvent.click(screen.getByRole("checkbox", { name: /acme\/two/ }));
    await userEvent.click(screen.getByRole("button", { name: "Connect 2 repositories" }));

    await expect.element(screen.getByRole("alert")).toHaveTextContent("Import failed");
    expect(onConnected).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Connect 1 repositories" }));
    await vi.waitFor(() => {
      expect(onConnected).toHaveBeenCalledOnce();
    });
    expect(connect.mock.calls.map(([name]) => name)).toEqual(["acme/one", "acme/two", "acme/two"]);
  });
});
