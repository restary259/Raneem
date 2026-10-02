import { beforeAll, describe, expect, it } from "vitest";
import {
  GOOGLE_PUBSUB_SERVICE_ACCOUNT,
  OidcVerificationError,
  bearerToken,
  createJwksCache,
  parseJwt,
  verifyGoogleOidc,
  type JwkSet,
} from "@/lib/googlePubSubAuth";

const AUDIENCE = "https://example.test/functions/v1/google-business-webhook";

function b64url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function b64urlJson(obj: unknown): string {
  return b64url(new TextEncoder().encode(JSON.stringify(obj)));
}

let keyPair: CryptoKeyPair;
let jwks: JwkSet;
let kid: string;

beforeAll(async () => {
  keyPair = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );
  const jwk = (await crypto.subtle.exportKey(
    "jwk",
    keyPair.publicKey,
  )) as Record<string, unknown>;
  kid = "test-key-1";
  jwks = { keys: [{ ...jwk, kid, alg: "RS256", use: "sig" } as never] };
});

async function signToken(
  claims: Record<string, unknown>,
  header: Record<string, unknown> = {},
): Promise<string> {
  const head = b64urlJson({ alg: "RS256", kid, typ: "JWT", ...header });
  const body = b64urlJson(claims);
  const input = `${head}.${body}`;
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    keyPair.privateKey,
    new TextEncoder().encode(input),
  );
  return `${input}.${b64url(new Uint8Array(sig))}`;
}

function validClaims(overrides: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000);
  return {
    iss: "https://accounts.google.com",
    aud: AUDIENCE,
    exp: now + 600,
    iat: now - 5,
    email: GOOGLE_PUBSUB_SERVICE_ACCOUNT,
    email_verified: true,
    sub: "1234567890",
    ...overrides,
  };
}

describe("parseJwt", () => {
  it("splits a well-formed token", async () => {
    const token = await signToken(validClaims());
    const parsed = parseJwt(token);
    expect(parsed.header.alg).toBe("RS256");
    expect(parsed.claims.iss).toBe("https://accounts.google.com");
  });

  it("rejects a token that is not three segments", () => {
    expect(() => parseJwt("a.b")).toThrow(OidcVerificationError);
  });
});

describe("verifyGoogleOidc", () => {
  it("accepts a correctly signed Google token for this audience", async () => {
    const token = await signToken(validClaims());
    const claims = await verifyGoogleOidc(token, { audience: AUDIENCE, jwks });
    expect(claims.email).toBe(GOOGLE_PUBSUB_SERVICE_ACCOUNT);
  });

  it("accepts the bare accounts.google.com issuer spelling", async () => {
    const token = await signToken(validClaims({ iss: "accounts.google.com" }));
    await expect(
      verifyGoogleOidc(token, { audience: AUDIENCE, jwks }),
    ).resolves.toBeTruthy();
  });

  it("rejects a token signed by a different key", async () => {
    const other = await crypto.subtle.generateKey(
      {
        name: "RSASSA-PKCS1-v1_5",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["sign", "verify"],
    );
    const head = b64urlJson({ alg: "RS256", kid, typ: "JWT" });
    const body = b64urlJson(validClaims());
    const sig = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      other.privateKey,
      new TextEncoder().encode(`${head}.${body}`),
    );
    const token = `${head}.${body}.${b64url(new Uint8Array(sig))}`;
    await expect(
      verifyGoogleOidc(token, { audience: AUDIENCE, jwks }),
    ).rejects.toMatchObject({
      code: "BAD_SIGNATURE",
    });
  });

  it("rejects an alg:none token", async () => {
    const token = `${b64urlJson({ alg: "none", kid })}.${b64urlJson(validClaims())}.`;
    await expect(
      verifyGoogleOidc(token, { audience: AUDIENCE, jwks }),
    ).rejects.toMatchObject({
      code: "BAD_ALG",
    });
  });

  it("rejects a token whose audience is not this endpoint", async () => {
    const token = await signToken(
      validClaims({ aud: "https://evil.test/hook" }),
    );
    await expect(
      verifyGoogleOidc(token, { audience: AUDIENCE, jwks }),
    ).rejects.toMatchObject({
      code: "BAD_AUDIENCE",
    });
  });

  it("rejects a foreign issuer", async () => {
    const token = await signToken(validClaims({ iss: "https://evil.test" }));
    await expect(
      verifyGoogleOidc(token, { audience: AUDIENCE, jwks }),
    ).rejects.toMatchObject({
      code: "BAD_ISSUER",
    });
  });

  it("rejects an expired token", async () => {
    const token = await signToken(
      validClaims({ exp: Math.floor(Date.now() / 1000) - 3600 }),
    );
    await expect(
      verifyGoogleOidc(token, { audience: AUDIENCE, jwks }),
    ).rejects.toMatchObject({
      code: "EXPIRED",
    });
  });

  it("rejects an unknown kid", async () => {
    const token = await signToken(validClaims(), { kid: "missing-key" });
    await expect(
      verifyGoogleOidc(token, { audience: AUDIENCE, jwks }),
    ).rejects.toMatchObject({
      code: "UNKNOWN_KEY",
    });
  });

  it("rejects a token whose email is not the expected sender", async () => {
    const token = await signToken(validClaims({ email: "attacker@evil.test" }));
    await expect(
      verifyGoogleOidc(token, {
        audience: AUDIENCE,
        jwks,
        allowedEmails: [GOOGLE_PUBSUB_SERVICE_ACCOUNT],
      }),
    ).rejects.toMatchObject({ code: "BAD_EMAIL" });
  });

  it("accepts the expected sender when an allowlist is given", async () => {
    const token = await signToken(validClaims());
    await expect(
      verifyGoogleOidc(token, {
        audience: AUDIENCE,
        jwks,
        allowedEmails: [GOOGLE_PUBSUB_SERVICE_ACCOUNT],
      }),
    ).resolves.toBeTruthy();
  });
});

describe("bearerToken", () => {
  it("extracts a bearer token case-insensitively", () => {
    expect(bearerToken("Bearer abc.def.ghi")).toBe("abc.def.ghi");
    expect(bearerToken("bearer xyz")).toBe("xyz");
  });

  it("returns null for a missing or non-bearer header", () => {
    expect(bearerToken(null)).toBeNull();
    expect(bearerToken("Basic abc")).toBeNull();
  });
});

describe("createJwksCache", () => {
  it("caches until forced", async () => {
    let calls = 0;
    const cache = createJwksCache(async () => {
      calls += 1;
      return { keys: [] };
    });
    await cache.get();
    await cache.get();
    expect(calls).toBe(1);
    await cache.get(true);
    expect(calls).toBe(2);
  });

  it("rejects a JWKS response without a keys array", async () => {
    const cache = createJwksCache(async () => ({ nope: true }));
    await expect(cache.get()).rejects.toBeInstanceOf(OidcVerificationError);
  });
});
