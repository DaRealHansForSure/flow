import { PRIMARY_LOCAL_ENVIRONMENT_ID, type DesktopAttachFailure } from "@t3tools/contracts";

/**
 * Why the desktop could not attach to the Flow service, read synchronously from
 * the primary bootstrap where the main process parked it; the renderer never
 * probes. Null in browsers and on a desktop that attached.
 */
export function readPrimaryAttachFailure(): DesktopAttachFailure | null {
  const bootstraps = window.desktopBridge?.getLocalEnvironmentBootstraps() ?? [];
  const primary = bootstraps.find((entry) => entry.id === PRIMARY_LOCAL_ENVIRONMENT_ID);
  return primary?.attachFailure ?? null;
}
