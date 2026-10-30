import { expect, it, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { useState } from "react";

import { render } from "../../../test/render";
import { PlanCommentSelection } from "./PlanCommentSelection";

function PlanText(props: { readonly onComment: (passage: string, note: string) => void }) {
  const [container, setContainer] = useState<HTMLElement | null>(null);
  return (
    <>
      <p ref={setContainer}>Add a migration for the new column.</p>
      <PlanCommentSelection container={container} onComment={props.onComment} />
    </>
  );
}

it("comments on a passage selected in the plan", async () => {
  const onComment = vi.fn();
  await using screen = await render(<PlanText onComment={onComment} />, { router: false }); // no routes involved
  const paragraph = screen.getByText("Add a migration for the new column.").element();
  const range = document.createRange();
  range.selectNodeContents(paragraph);
  window.getSelection()?.removeAllRanges();
  window.getSelection()?.addRange(range);

  await userEvent.click(page.getByRole("button", { name: "Comment" }));
  const note = page.getByRole("textbox", { name: "Comment on the selected passage" });
  await expect.element(note).toHaveFocus();
  await userEvent.keyboard("Split this step");
  // The dialog opens with the note focused; the repo's dialog tests drive it by keyboard.
  await userEvent.keyboard("{Control>}{Enter}{/Control}");
  expect(onComment).toHaveBeenCalledWith("Add a migration for the new column.", "Split this step");
  await expect
    .element(page.getByRole("textbox", { name: "Comment on the selected passage" }))
    .not.toBeInTheDocument();
});
