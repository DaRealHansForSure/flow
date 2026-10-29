import { DEFAULT_SERVER_SETTINGS } from "@t3tools/contracts";

import { ScopedSwitch } from "./ScopedSwitch";
import { useSettingsScope } from "./SettingsScopeContext";
import { SettingResetButton, SettingsRow, SettingsSection } from "./settingsLayout";
import { searchableSetting } from "./settingsSearch";
import { useScopedSettings, useUpdateScopedSettings } from "./useScopedSettings";

const BRAIN_OUTPUT_SETTINGS = [
  { key: "brainAutoDocs", searchId: "brain-auto-docs", label: "Auto-Docs", noun: "docs" },
  { key: "brainAutoSkills", searchId: "brain-auto-skills", label: "Auto-Skills", noun: "skills" },
] as const;

type BrainOutputSetting = (typeof BRAIN_OUTPUT_SETTINGS)[number];

/** The global Auto-Docs and Auto-Skills switches; a picked project shows its own override. */
export function BrainCurationSettings() {
  return (
    <SettingsSection id="brain-curation" title="Brain">
      <BrainCurationSettingRows />
    </SettingsSection>
  );
}

/** The switch rows alone, for a section that already carries the Brain title. */
export function BrainCurationSettingRows() {
  return BRAIN_OUTPUT_SETTINGS.map((setting) => (
    <BrainOutputSettingRow key={setting.key} setting={setting} />
  ));
}

function BrainOutputSettingRow({ setting }: { readonly setting: BrainOutputSetting }) {
  const { scope } = useSettingsScope();
  const settings = useScopedSettings();
  const updateSettings = useUpdateScopedSettings();
  const isProjectScope = scope.kind === "project" || scope.kind === "checkout";
  const enabled = settings[setting.key];
  const defaultValue = DEFAULT_SERVER_SETTINGS[setting.key];
  const chats = isProjectScope ? "this project's chats" : "your chats";
  const kept = `The Brain keeps conversation notes either way, and existing ${setting.noun} stay available.`;
  const override = isProjectScope ? "" : " Projects can override it.";

  return (
    <SettingsRow
      serverScoped
      settingKeys={[setting.key]}
      {...searchableSetting(setting.searchId)}
      description={`Let the notes agent write and update ${setting.label} from ${chats}. ${kept}${override}`}
      resetAction={
        enabled !== defaultValue ? (
          <SettingResetButton
            label={`default ${setting.label}`}
            onClick={() => updateSettings({ [setting.key]: defaultValue })}
          />
        ) : null
      }
      control={
        <ScopedSwitch
          settingKeys={[setting.key]}
          aria-label={setting.label}
          checked={enabled}
          onCheckedChange={(checked) => updateSettings({ [setting.key]: checked })}
        />
      }
    />
  );
}
