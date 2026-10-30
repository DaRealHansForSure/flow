import { describe, expect, it } from "vite-plus/test";

import { proposedPlanTitle } from "./proposedPlanText";

describe("proposedPlanTitle", () => {
  it.each([
    ["# Plan: Add README.md to empty folder", "Add README.md to empty folder"],
    ["## plan - Fix the login", "Fix the login"],
    ["# Plan", "Plan"],
    ["# Planning the release", "Planning the release"],
    ["# Plan:", "Plan:"],
  ])("shows %j as %j", (markdown, title) => {
    expect(proposedPlanTitle(`${markdown}\n\nSteps`)).toBe(title);
  });
});
