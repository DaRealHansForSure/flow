// Fork-only: the git actions without their pull request parts, for when the
// user turned pull requests off (Settings > Source Control). Commit and push stay
// exactly as they are; only the step that would create or open a PR goes away.

import type { GitActionMenuItem, GitQuickAction } from "./GitActionsControl.logic";

// The id buildMenuItems gives its "Create PR" / "View PR" entry.
const PULL_REQUEST_MENU_ITEM_ID = "pr";

export function withoutPullRequestMenuItems(
  items: readonly GitActionMenuItem[],
): GitActionMenuItem[] {
  return items.filter((item) => item.id !== PULL_REQUEST_MENU_ITEM_ID);
}

/** The same quick action with any PR step dropped, keeping its commit and push. */
export function withoutPullRequestQuickAction(quickAction: GitQuickAction): GitQuickAction {
  if (quickAction.kind !== "run_action") {
    return quickAction;
  }
  if (quickAction.action === "commit_push_pr") {
    return { ...quickAction, label: "Commit & push", action: "commit_push" };
  }
  if (quickAction.action === "create_pr") {
    return { ...quickAction, label: "Push", action: "push" };
  }
  return quickAction;
}
