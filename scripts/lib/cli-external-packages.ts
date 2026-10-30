/**
 * Keep bundler externals and staged runtime dependency roots aligned. Scoped
 * families and the entries in PREFIX_MATCHED_EXTERNALS match prefixes; ordinary
 * names match only the package and its subpaths, not similarly named packages.
 */
// Filesystem-loaded externals need dependencies outside the bundle.
const CLI_RUNTIME_EXTERNAL_PREFIXES = [
  // Flow's Brain runtime: native addons and their loaders load from disk.
  "better-sqlite3",
  "bindings",
  "file-uri-to-path",
  "@falkordblite/",
  "falkordb",
  "falkordblite",
  "@node-llama-cpp/",
  "node-llama-cpp",
  // Cursor ships computed Webpack imports and platform helper packages.
  "@cursor/sdk",
  // Playwright reads package.json and browsers.json beside its runtime modules.
  "playwright-core",
  "node-pty",
  "ffi-rs",
  "@yuuang/",
  "@ff-labs/",
  "@napi-rs/keyring",
  "@clerk/electron-passkeys",
  "@msgpackr-extract/",
  // Its UMD entry keeps runtime-relative requires (e.g. ./impl/format) when
  // bundled by Rolldown. Keep the package intact alongside those modules.
  "jsonc-parser",
  "msgpackr-extract",
  "node-gyp-build",
  "node-addon-api",
  // Keep libc detection alongside the native loader that selects Linux builds.
  "detect-libc",
  "bufferutil",
  "utf-8-validate",
] as const;

// Entries whose platform siblings share the name as a prefix.
const PREFIX_MATCHED_EXTERNALS = new Set<string>([
  "node-gyp-build",
  "@clerk/electron-passkeys",
  "@cursor/sdk",
  "@napi-rs/keyring",
]);

function matchesExternalEntry(id: string, entry: string): boolean {
  if (entry.endsWith("/") || PREFIX_MATCHED_EXTERNALS.has(entry)) {
    return id.startsWith(entry);
  }
  return id === entry || id.startsWith(`${entry}/`);
}

// Match Cursor dependency boundaries so zod does not externalize zod-to-json-schema.
const CURSOR_RUNTIME_DEPENDENCIES = [
  "@bufbuild/protobuf",
  "@connectrpc/connect",
  "@connectrpc/connect-node",
  "@connectrpc/connect-web",
  "@statsig/js-client",
  "@statsig/client-core",
  "zod",
  "undici",
  "@fastify/busboy",
] as const;

export function isRuntimeExternalCliDependency(id: string): boolean {
  return (
    CLI_RUNTIME_EXTERNAL_PREFIXES.some((entry) => matchesExternalEntry(id, entry)) ||
    CURSOR_RUNTIME_DEPENDENCIES.some((name) => id === name || id.startsWith(`${name}/`))
  );
}

/** Use neverBundle: false from alwaysBundle means no opinion and leaves transitive packages bundled. */
export function isExternalCliDependency(id: string): boolean {
  return isRuntimeExternalCliDependency(id);
}

export function shouldBundleCliDependency(id: string): boolean {
  if (id.startsWith("node:")) return false;
  return !isExternalCliDependency(id);
}

export function selectCliRuntimeExternalDependencies(
  dependencies: Readonly<Record<string, string>>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(dependencies).filter(([name]) => isRuntimeExternalCliDependency(name)),
  );
}

/** regionCount distinguishes a clean bundle from a changed marker format the scan cannot see. */
export function findInlinedExternalPackages(source: string): {
  readonly regionCount: number;
  readonly inlined: ReadonlyArray<string>;
  readonly inlinedPackages: ReadonlyArray<string>;
} {
  // Rolldown marks each inlined module with a `//#region <path>` line; newer
  // releases (vite-plus 1.4) emit a bare `// <path>` line instead.
  const regionPattern = /^\/\/(?:#region)?[ \t]+(\S+)[ \t]*$/gm;
  const packagePattern = /node_modules\/((?:@[^/\s]+\/)?[^/\s]+)\//g;

  let regionCount = 0;
  const inlined = new Set<string>();
  const inlinedPackages = new Set<string>();
  for (const region of source.matchAll(regionPattern)) {
    regionCount += 1;
    const regionPath = region[1] ?? "";
    for (const candidate of regionPath.matchAll(packagePattern)) {
      const name = candidate[1];
      if (name === undefined || name === ".pnpm") continue;
      inlinedPackages.add(name);
      if (isExternalCliDependency(name)) inlined.add(name);
    }
  }

  return {
    regionCount,
    inlined: [...inlined].sort(),
    inlinedPackages: [...inlinedPackages].sort(),
  };
}
