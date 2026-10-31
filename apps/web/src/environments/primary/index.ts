export {
  createServerPairingCredential,
  peekPairingTokenFromUrl,
  PrimaryEnvironmentPairingCredentialRejectedError,
  PrimaryEnvironmentRequestError,
  resolveInitialServerAuthGateState,
  revokeOtherServerClientSessions,
  revokeServerClientSession,
  forgetThisDevice,
  revokeServerPairingLink,
  stripPairingTokenFromUrl,
  submitServerAuthCredential,
  takePairingTokenFromUrl,
  type ServerClientSessionRecord,
  type ServerPairingLinkRecord,
  __resetServerAuthBootstrapForTests,
} from "./auth";

export { readPrimaryAttachFailure } from "./attachFailure";

export { usePrimarySessionState } from "./sessionState";

export {
  DesktopEnvironmentBootstrapIncompleteError,
  PrimaryEnvironmentProtocolUnsupportedError,
  PrimaryEnvironmentUrlInvalidError,
  readPrimaryEnvironmentTarget,
  resolvePrimaryEnvironmentHttpUrl,
  isLoopbackHostname,
  type PrimaryEnvironmentTarget,
} from "./target";
