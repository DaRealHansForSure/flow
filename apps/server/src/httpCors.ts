import { ORCHESTRATION_PROTOCOL_HEADER } from "@t3tools/contracts";

export const browserApiCorsAllowedMethods = ["GET", "POST", "OPTIONS"] as const;
export const browserApiCorsAllowedHeaders = [
  "authorization",
  "b3",
  "traceparent",
  "content-type",
  "dpop",
  ORCHESTRATION_PROTOCOL_HEADER,
] as const;

// Flow's desktop serves its renderer from `flow://app` (`flow-dev://app` in dev), see
// DESKTOP_PRODUCTION_SCHEME in apps/desktop/src/electron/ElectronProtocol.ts. The T3
// origins stay for upstream parity.
export const DESKTOP_RENDERER_ORIGINS = [
  "t3code://app",
  "t3code-dev://app",
  "flow://app",
  "flow-dev://app",
] as const;
