/**
 * Phase 9 — verify the OIDC token Google attaches to a Pub/Sub push request.
 *
 * A push endpoint that accepts arbitrary JSON as a trusted Google event is an
 * open door, so every request must present a Google-issued OIDC JWT and DARB
 * must check its signature, issuer, audience and (optionally) the calling
 * service account before treating the body as an event.
 *
 * Implemented directly on Web Crypto (RS256 + Google's JWKS) rather than a
 * hand-rolled shared secret, which is what Pub/Sub's authenticated-push
 * configuration is for.
 */

export type Jwk = {
  kty: string;
  kid?: string;
  alg?: string;
  use?: string;
  n?: string;
  e?: string;
};

export type JwkSet = { keys: Jwk[] };

export type OidcClaims = {
  iss?: string;
  aud?: string | string[];
  exp?: number;
  iat?: number;
  nbf?: number;
  email?: string;
  email_verified?: boolean;
  sub?: string;
  [key: string]: unknown;
};

export class OidcVerificationError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "OidcVerificationError";
    this.code = code;
  }
}

/** Google issues its ID tokens from either of these spellings. */
export const GOOGLE_OIDC_ISSUERS = [
  "https://accounts.google.com",
  "accounts.google.com",
] as const;

/** Google's published JWKS for ID tokens. */
export const GOOGLE_JWKS_URI = "https://www.googleapis.com/oauth2/v3/certs";

/** The service account Google Business Profile publishes notifications as. */
export const GOOGLE_PUBSUB_SERVICE_ACCOUNT =
  "mybusiness-api-pubsub@system.gserviceaccount.com";

const CLOCK_SKEW_SECONDS = 60;

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad =
    padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function base64UrlToJson<T>(value: string): T {
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(value))) as T;
}

export type ParsedJwt = {
  header: { alg?: string; kid?: string; typ?: string };
  claims: OidcClaims;
  signingInput: string;
  signature: Uint8Array;
};

/** Splits and decodes a compact JWT. Does NOT verify anything. */
export function parseJwt(token: string): ParsedJwt {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new OidcVerificationError(
      "MALFORMED_TOKEN",
      "JWT must have three segments",
    );
  }
  const [headerPart, payloadPart, signaturePart] = parts;
  let header: ParsedJwt["header"];
  let claims: OidcClaims;
  try {
    header = base64UrlToJson<ParsedJwt["header"]>(headerPart);
    claims = base64UrlToJson<OidcClaims>(payloadPart);
  } catch {
    throw new OidcVerificationError(
      "MALFORMED_TOKEN",
      "JWT segments are not valid JSON",
    );
  }
  return {
    header,
    claims,
    signingInput: `${headerPart}.${payloadPart}`,
    signature: base64UrlToBytes(signaturePart),
  };
}

async function verifyRs256(
  signingInput: string,
  signature: Uint8Array,
  jwk: Jwk,
): Promise<boolean> {
  if (jwk.kty !== "RSA" || !jwk.n || !jwk.e) return false;
  const key = await crypto.subtle.importKey(
    "jwk",
    { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  return crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    signature as unknown as ArrayBuffer,
    new TextEncoder().encode(signingInput) as unknown as ArrayBuffer,
  );
}

export type VerifyOidcOptions = {
  /** The expected `aud` — the configured push endpoint URL. */
  audience: string;
  jwks: JwkSet;
  /** When set, `email` must be one of these (e.g. the Pub/Sub service account). */
  allowedEmails?: readonly string[];
  /** Injectable clock for tests. */
  nowSeconds?: number;
};

/**
 * Verifies a Google OIDC token. Throws `OidcVerificationError` on any failure —
 * callers must treat every throw as "reject the request".
 */
export async function verifyGoogleOidc(
  token: string,
  options: VerifyOidcOptions,
): Promise<OidcClaims> {
  const { header, claims, signingInput, signature } = parseJwt(token);

  if (header.alg !== "RS256") {
    throw new OidcVerificationError(
      "BAD_ALG",
      `Unsupported JWT alg: ${header.alg ?? "none"}`,
    );
  }
  if (!header.kid) {
    throw new OidcVerificationError(
      "MALFORMED_TOKEN",
      "JWT header is missing kid",
    );
  }

  const candidates = (options.jwks.keys ?? []).filter(
    (k) => k.kid === header.kid && (k.alg === undefined || k.alg === "RS256"),
  );
  if (!candidates.length) {
    throw new OidcVerificationError(
      "UNKNOWN_KEY",
      "No JWKS key matches the token kid",
    );
  }

  let signatureValid = false;
  for (const jwk of candidates) {
    if (await verifyRs256(signingInput, signature, jwk)) {
      signatureValid = true;
      break;
    }
  }
  if (!signatureValid) {
    throw new OidcVerificationError(
      "BAD_SIGNATURE",
      "JWT signature does not verify",
    );
  }

  if (
    !GOOGLE_OIDC_ISSUERS.includes(
      (claims.iss ?? "") as (typeof GOOGLE_OIDC_ISSUERS)[number],
    )
  ) {
    throw new OidcVerificationError(
      "BAD_ISSUER",
      `Unexpected issuer: ${claims.iss ?? "none"}`,
    );
  }

  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audiences.includes(options.audience)) {
    throw new OidcVerificationError(
      "BAD_AUDIENCE",
      "Token audience does not match this endpoint",
    );
  }

  const now = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (typeof claims.exp === "number" && now > claims.exp + CLOCK_SKEW_SECONDS) {
    throw new OidcVerificationError("EXPIRED", "Token has expired");
  }
  if (typeof claims.nbf === "number" && now + CLOCK_SKEW_SECONDS < claims.nbf) {
    throw new OidcVerificationError("NOT_YET_VALID", "Token is not valid yet");
  }

  if (options.allowedEmails && options.allowedEmails.length) {
    if (!claims.email || !options.allowedEmails.includes(claims.email)) {
      throw new OidcVerificationError(
        "BAD_EMAIL",
        "Token email is not an allowed sender",
      );
    }
  }

  return claims;
}

export type JwksResolver = () => Promise<JwkSet>;

/**
 * Wraps a JWKS fetch with a short-lived cache. Google rotates its keys, so a
 * `kid` miss should force one refetch before giving up (handled by the caller
 * passing `force`).
 */
export function createJwksCache(
  fetcher: (uri: string) => Promise<unknown>,
  ttlSeconds = 3600,
  uri = GOOGLE_JWKS_URI,
): { get: (force?: boolean) => Promise<JwkSet> } {
  let cached: { at: number; set: JwkSet } | null = null;
  return {
    async get(force = false): Promise<JwkSet> {
      const now = Math.floor(Date.now() / 1000);
      if (!force && cached && now - cached.at < ttlSeconds) return cached.set;
      const raw = (await fetcher(uri)) as JwkSet;
      if (!raw || !Array.isArray(raw.keys)) {
        throw new OidcVerificationError(
          "BAD_JWKS",
          "JWKS response has no keys array",
        );
      }
      cached = { at: now, set: raw };
      return raw;
    },
  };
}

/** Reads `Authorization: Bearer <token>` from a request. */
export function bearerToken(header: string | null): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}
