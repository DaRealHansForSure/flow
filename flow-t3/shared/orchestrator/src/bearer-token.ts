// @effect-diagnostics nodeBuiltinImport:off - Plain Node script code outside the Effect runtime.
import { timingSafeEqual } from "node:crypto";

/** Shortest token a local Brain endpoint accepts: 32 random bytes in hex. */
export const MIN_BEARER_TOKEN_LENGTH = 64;

/** The token a local endpoint is started with; missing or short tokens stop the start. */
export function requireBearerToken(token: string | undefined, name: string): string {
  if (token === undefined || token.length < MIN_BEARER_TOKEN_LENGTH) {
    throw new Error(`${name} must be set to at least ${MIN_BEARER_TOKEN_LENGTH} characters.`);
  }
  return token;
}

/** Whether an Authorization header carries exactly this token, compared in constant time. */
export function bearerTokenMatches(header: string | string[] | undefined, token: string): boolean {
  if (typeof header !== "string") {
    return false;
  }
  const given = Buffer.from(header);
  const expected = Buffer.from(`Bearer ${token}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
