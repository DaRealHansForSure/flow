// Verifies per-user PATs ("flowpat_<id>_<secret>", stored as sha256(secret)) against
// data/auth.json. A PAT is valid here only while its user exists and holds a grant on
// this gateway's project, so revoking a person cuts their agents off within the cache
// TTL, with no token rotation.
import * as NodeFS from "node:fs";
import * as NodeCrypto from "node:crypto";

const AUTH_PATH = process.env.FLOW_AUTH_PATH ?? "";
const PROJECT_NAME = process.env.FLOW_PROJECT_NAME ?? "";

interface AuthStore {
  users?: { id: string; role?: string }[];
  grants?: Record<string, string[]>;
  tokens?: { id: string; userId: string; hash: string; projects?: string[] }[];
}

const CACHE_TTL_MS = 2000;
let cache: { at: number; mtimeMs: number; store: AuthStore } | null = null;

function loadStore(): AuthStore | null {
  if (!AUTH_PATH) return null;
  try {
    const stat = NodeFS.statSync(AUTH_PATH);
    const now = Date.now();
    if (cache && cache.mtimeMs === stat.mtimeMs && now - cache.at < CACHE_TTL_MS) {
      return cache.store;
    }
    const store = JSON.parse(NodeFS.readFileSync(AUTH_PATH, "utf-8")) as AuthStore;
    cache = { at: now, mtimeMs: stat.mtimeMs, store };
    return store;
  } catch {
    return null;
  }
}

/** Looks like a PAT at all? (Routes the auth check; not a validity claim.) */
export function isPat(bearer: string): boolean {
  return bearer.startsWith("flowpat_");
}

/**
 * Verify a PAT for this gateway's project. Returns the user id when the
 * token is genuine AND its user holds a grant here, else null.
 */
export function verifyPatForProject(bearer: string): string | null {
  const m = bearer.match(/^flowpat_([0-9a-f]{8})_([0-9a-f]{32})$/);
  if (!m) return null;
  const store = loadStore();
  if (!store) return null;

  const record = (store.tokens ?? []).find((t) => t.id === m[1]);
  if (!record) return null;
  if (record.projects && (!PROJECT_NAME || !record.projects.includes(PROJECT_NAME))) return null;
  const expected = record.hash.replace(/^sha256:/, "");
  const actual = NodeCrypto.createHash("sha256").update(m[2]).digest("hex");
  try {
    if (!NodeCrypto.timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"))) return null;
  } catch {
    return null;
  }

  const user = (store.users ?? []).find((u) => u.id === record.userId);
  if (!user) return null; // deleted users take their tokens with them
  if (user.role === "owner") return user.id;
  const grants = store.grants?.[user.id] ?? [];
  if (!PROJECT_NAME) return null; // no project scope configured — fail closed
  return grants.includes("*") || grants.includes(PROJECT_NAME) ? user.id : null;
}
