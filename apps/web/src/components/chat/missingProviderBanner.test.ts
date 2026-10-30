import { describe, expect, it } from "vite-plus/test";

import { heldMissingProvider } from "./missingProviderBanner";

describe("heldMissingProvider", () => {
  it("keeps a chat on its missing provider until another one is picked by hand", () => {
    const missingInstanceId = "claudeAgent_work";
    expect(
      heldMissingProvider({
        missingInstanceId,
        draftActiveProvider: null,
        draftSelectionExplicit: undefined,
      }),
    ).toBe(missingInstanceId);
    // A sticky or default selection fills the draft without the user choosing it.
    expect(
      heldMissingProvider({
        missingInstanceId,
        draftActiveProvider: "claudeAgent",
        draftSelectionExplicit: false,
      }),
    ).toBe(missingInstanceId);
    expect(
      heldMissingProvider({
        missingInstanceId,
        draftActiveProvider: "claudeAgent",
        draftSelectionExplicit: true,
      }),
    ).toBeNull();
    expect(
      heldMissingProvider({
        missingInstanceId: null,
        draftActiveProvider: null,
        draftSelectionExplicit: undefined,
      }),
    ).toBeNull();
  });
});
