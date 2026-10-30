import { PlanId } from "@t3tools/contracts";
import { expect, it, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";

import { render } from "../../../test/render";
import { type PlanReview, PlanReviewActions } from "./planReview";

it("accepts the plan in a mode picked from the Accept menu", async () => {
  const review: PlanReview = {
    planId: PlanId.make("plan-1"),
    runtimeMode: "approval-required",
    runtimeModes: ["approval-required", "full-access"],
    disabled: false,
    accept: vi.fn(),
    acceptInNewThread: vi.fn(),
    revise: vi.fn(),
    decline: vi.fn(),
  };
  await using screen = await render(<PlanReviewActions review={review} />, { router: false }); // no routes involved
  await userEvent.click(screen.getByRole("button", { name: "Accept with other permissions" }));
  await userEvent.click(page.getByRole("menuitem", { name: "Full access" }));
  expect(review.accept).toHaveBeenCalledWith("full-access");
});
