import type { ProviderInstanceEnvironment } from "@t3tools/contracts";
import * as HostProcess from "@t3tools/shared/HostProcess";
import * as Effect from "effect/Effect";

import { expandHomePath } from "./pathExpansion.ts";

// Flow captures these sessions directly; external hooks must not capture them again.
const FLOW_MANAGED_SESSION = { FLOW_SESSION_ID: "t3-managed" };

export const mergeProviderInstanceEnvironment = Effect.fn(function* (
  environment: ProviderInstanceEnvironment | undefined,
  baseEnv: NodeJS.ProcessEnv = process.env,
) {
  const next: NodeJS.ProcessEnv = { ...baseEnv, ...FLOW_MANAGED_SESSION };
  if (!environment || environment.length === 0) {
    return next;
  }

  const home = yield* HostProcess.HomeDirectory;
  for (const variable of environment) {
    // An unresolved secret reference carries no value; the registry resolves it for the provider.
    if (typeof variable.value !== "string") continue;
    next[variable.name] =
      variable.name === "CODEX_HOME" || variable.name === "CLAUDE_CONFIG_DIR"
        ? expandHomePath(variable.value, home)
        : variable.value;
  }
  return { ...next, ...FLOW_MANAGED_SESSION };
});
