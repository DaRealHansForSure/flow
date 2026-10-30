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

/**
 * The global Notes agent switch with the Auto-Docs and Auto-Skills switches beneath it; a
 * picked project shows its own override of the latter two.
 */
export function BrainCurationSettings() {
  return (
    <SettingsSection id="brain-curation" title="Brain">
      <BrainCurationSettingRows />
    </SettingsSection>
  );
}

/** The switch rows alone, for a section that already carries the Brain title. */
export function BrainCurationSettingRows() {
  return (
    <>
      <NotesAgentSettingRow />
      {BRAIN_OUTPUT_SETTINGS.map((setting) => (
        <BrainOutputSettingRow key={setting.key} setting={setting} />
      ))}
    </>
  );
}

function NotesAgentSettingRow() {
  const enabled = useScopedSettings((settings) => settings.brainNotesAgent);
  const updateSettings = useUpdateScopedSettings();
  const defaultValue = DEFAULT_SERVER_SETTINGS.brainNotesAgent;

  return (
    <SettingsRow
      serverScoped
      settingKeys={["brainNotesAgent"]}
      {...searchableSetting("brain-notes-agent")}
      description="Let the notes agent keep conversation notes, Auto-Docs and Auto-Skills from your chats. Off, chats keep their Brain and their messages are still recorded, so turning it back on catches up. A chat can choose for itself in its Brain tab."
      resetAction={
        enabled !== defaultValue ? (
          <SettingResetButton
            label="default notes agent"
            onClick={() => updateSettings({ brainNotesAgent: defaultValue })}
          />
        ) : null
      }
      control={
        <ScopedSwitch
          settingKeys={["brainNotesAgent"]}
          aria-label="Notes agent"
          checked={enabled}
          onCheckedChange={(checked) => updateSettings({ brainNotesAgent: checked })}
        />
      }
    />
  );
}

function BrainOutputSettingRow({ setting }: { readonly setting: BrainOutputSetting }) {
  const { scope } = useSettingsScope();
  const settings = useScopedSettings();
  const updateSettings = useUpdateScopedSettings();
  const isProjectScope = scope.kind === "project" || scope.kind === "checkout";
  const enabled = settings[setting.key];
  const defaultValue = DEFAULT_SERVER_SETTINGS[setting.key];
  const notesAgentOff = !settings.brainNotesAgent;
  const chats = isProjectScope ? "this project's chats" : "your chats";
  const kept = `The Brain keeps conversation notes either way, and existing ${setting.noun} stay available.`;
  const override = isProjectScope ? "" : " Projects can override it.";
  let description = `Let the notes agent write and update ${setting.label} from ${chats}. ${kept}${override}`;
  if (notesAgentOff) {
    description = `Needs the notes agent: turn it on above to change ${setting.label}. Chats that turn the agent on for themselves keep using this value.`;
  }

  return (
    <SettingsRow
      serverScoped
      settingKeys={[setting.key]}
      {...searchableSetting(setting.searchId)}
      aria-disabled={notesAgentOff || undefined}
      description={description}
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
          disabled={notesAgentOff}
          checked={enabled}
          onCheckedChange={(checked) => updateSettings({ [setting.key]: checked })}
        />
      }
    />
  );
}
