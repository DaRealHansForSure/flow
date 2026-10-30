interface ErrorEmitter {
  on(event: "error", listener: (error: unknown) => void): unknown;
}

/**
 * The falkordb client re-emits every socket error and reconnects on its own, but an "error"
 * event without a listener throws, and falkordblite rethrows it from `uncaughtException`, so one
 * dropped socket ended the whole server. A database that really stopped still shows in
 * `BrainRuntime.state()` through `isRunning`.
 */
export function survivesFalkorClientErrors(database: object): void {
  // falkordblite types `client` as private; it is the falkordb EventEmitter.
  const client = (database as { readonly client?: ErrorEmitter }).client;
  client?.on("error", () => {});
}
