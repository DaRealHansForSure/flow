import { isElectron } from "../../env";
import { useDesktopUpdateState } from "../../state/desktopUpdate";
import { usePrimaryEnvironment } from "../../state/environments";
import { SettingsRow } from "./settingsLayout";

function VersionTitle(props: { readonly label: string; readonly version: string }) {
  return (
    <span className="inline-flex items-baseline gap-2">
      <span>{props.label}</span>
      <code className="text-2xs font-medium text-muted-foreground">{props.version}</code>
    </span>
  );
}

/**
 * Flow: the versions of the parts besides this app, so a mismatch is easy to spot: the service
 * this window talks to, and the desktop app around it when it runs in one.
 */
export function AboutComponentVersions() {
  const serverVersion = usePrimaryEnvironment()?.serverConfig?.environment.serverVersion ?? null;
  const desktopVersion = useDesktopUpdateState()?.currentVersion ?? null;
  return (
    <>
      <SettingsRow
        title={<VersionTitle label="Service" version={serverVersion ?? "unknown"} />}
        description={
          serverVersion
            ? "The Flow service this window is connected to."
            : "Not connected to the Flow service yet."
        }
      />
      {isElectron && desktopVersion ? (
        <SettingsRow
          title={<VersionTitle label="Desktop app" version={desktopVersion} />}
          description="The installed desktop app around this window."
        />
      ) : null}
    </>
  );
}
