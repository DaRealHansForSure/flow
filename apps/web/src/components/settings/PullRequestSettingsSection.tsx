// Fork-only: the switch that turns every pull/merge request feature on or off.
// The server enforces it; clients hide the features through the `pullRequests`
// capability that client-runtime derives from this setting.

import { DEFAULT_UNIFIED_SETTINGS } from "@t3tools/contracts/settings";

import { usePrimarySettings, useUpdatePrimarySettings } from "../../hooks/useSettings";
import { Switch } from "../ui/switch";
import { SettingResetButton, SettingsRow, SettingsSection } from "./settingsLayout";
import { searchableSetting } from "./settingsSearch";

export function PullRequestSettingsSection() {
  const pullRequestsEnabled = usePrimarySettings((settings) => settings.pullRequestsEnabled);
  const updateSettings = useUpdatePrimarySettings();
  const isChanged = pullRequestsEnabled !== DEFAULT_UNIFIED_SETTINGS.pullRequestsEnabled;

  return (
    <SettingsSection title="Pull requests">
      <SettingsRow
        serverScoped
        {...searchableSetting("pull-requests-enabled")}
        description="Pull and merge request features: the Pull Requests page, PR status on threads, creating PRs from git actions and looking them up on GitHub, GitLab and other hosts. Off stops all of it, including the background lookups."
        resetAction={
          isChanged ? (
            <SettingResetButton
              label="pull requests"
              onClick={() =>
                updateSettings({
                  pullRequestsEnabled: DEFAULT_UNIFIED_SETTINGS.pullRequestsEnabled,
                })
              }
            />
          ) : null
        }
        control={
          <Switch
            checked={pullRequestsEnabled}
            onCheckedChange={(checked) => updateSettings({ pullRequestsEnabled: Boolean(checked) })}
            aria-label="Pull requests"
          />
        }
      />
    </SettingsSection>
  );
}
