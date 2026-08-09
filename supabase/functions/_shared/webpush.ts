/**
 * Web Push (RFC 8291 `aes128gcm` + RFC 8292 VAPID), implemented directly on
 * Web Crypto so it runs unmodified on the Deno edge runtime and speaks the
 * exact protocol Apple's push service requires.
 *
 * No third-party push library: the encryption is short, and a hand-rolled
 * dependency-free version cannot drift with an npm/Node-compat shim.
 */

const enc = new TextEncoder();

export interface PushSubscriptionRecord {
  endpoint: string;
  p256dh: string;
  auth_key: string;
}

export interface SendOptions {
  /** Seconds the push service should retain the message when the device is offline. */
  ttl?: number;
  urgency?: "very-low" | "low" | "normal" | "high";
  topic?: string;
}

export interface SendResult {
  status: number;
  ok: boolean;
  /** Permanent failure — the subscription must be deactivated. */
  gone: boolean;
  error?: string;
}

export function b64urlToBytes(input: string): Uint8Array {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  const bin = atob(input.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToB64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

async function hkdf(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  length: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info },
    key,
    length * 8,
  );
  return new Uint8Array(bits);
}

/** Import the VAPID key pair from the raw public key + the private scalar `d`. */
async function importVapidKey(publicKeyB64: string, privateKeyB64: string): Promise<CryptoKey> {
  const pub = b64urlToBytes(publicKeyB64);
  if (pub.length !== 65 || pub[0] !== 0x04) {
    throw new Error("VAPID public key must be a 65-byte uncompressed P-256 point");
  }
  return crypto.subtle.importKey(
    "jwk",
    {
      kty: "EC",
      crv: "P-256",
      x: bytesToB64url(pub.slice(1, 33)),
      y: bytesToB64url(pub.slice(33, 65)),
      d: privateKeyB64,
      ext: true,
    },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
}

/** RFC 8292 `vapid` Authorization header for one push-service origin. */
async function vapidAuthorization(
  audience: string,
  publicKeyB64: string,
  privateKeyB64: string,
  subject: string,
): Promise<string> {
  const header = bytesToB64url(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const payload = bytesToB64url(
    enc.encode(
      JSON.stringify({
        aud: audience,
        // Apple rejects anything beyond 24h; 12h keeps a comfortable margin.
        exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
        sub: subject,
      }),
    ),
  );
  const unsigned = `${header}.${payload}`;
  const key = await importVapidKey(publicKeyB64, privateKeyB64);
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    enc.encode(unsigned),
  );
  return `vapid t=${unsigned}.${bytesToB64url(new Uint8Array(sig))}, k=${publicKeyB64}`;
}

/** RFC 8291 content encryption. Returns the full `aes128gcm` body. */
async function encryptPayload(
  plaintext: string,
  uaPublicB64: string,
  authSecretB64: string,
): Promise<Uint8Array> {
  const uaPublic = b64urlToBytes(uaPublicB64);
  const authSecret = b64urlToBytes(authSecretB64);
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const asKeys = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
    "deriveBits",
  ]);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", asKeys.publicKey));
  const uaKey = await crypto.subtle.importKey(
    "raw",
    uaPublic,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const shared = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, asKeys.privateKey, 256),
  );

  const ikm = await hkdf(
    authSecret,
    shared,
    concat(enc.encode("WebPush: info\0"), uaPublic, asPublic),
    32,
  );
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);

  const aesKey = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  // A single record: plaintext followed by the 0x02 final-record delimiter.
  const padded = concat(enc.encode(plaintext), new Uint8Array([0x02]));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce, tagLength: 128 }, aesKey, padded),
  );

  const recordSize = new Uint8Array(4);
  new DataView(recordSize.buffer).setUint32(0, 4096);
  return concat(salt, recordSize, new Uint8Array([asPublic.length]), asPublic, ciphertext);
}

/**
 * Encrypt and deliver one Web Push message.
 * Never throws for a push-service rejection — the status is returned so the
 * caller can log it and retire dead subscriptions.
 */
export async function sendWebPush(
  subscription: PushSubscriptionRecord,
  payload: unknown,
  vapid: { publicKey: string; privateKey: string; subject: string },
  options: SendOptions = {},
): Promise<SendResult> {
  try {
    const audience = new URL(subscription.endpoint).origin;
    const [authorization, body] = await Promise.all([
      vapidAuthorization(audience, vapid.publicKey, vapid.privateKey, vapid.subject),
      encryptPayload(JSON.stringify(payload), subscription.p256dh, subscription.auth_key),
    ]);

    const headers: Record<string, string> = {
      Authorization: authorization,
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: String(options.ttl ?? 3600),
      Urgency: options.urgency ?? "normal",
    };
    if (options.topic) headers.Topic = options.topic;

    const res = await fetch(subscription.endpoint, { method: "POST", headers, body });
    const gone = res.status === 404 || res.status === 410;
    let error: string | undefined;
    if (!res.ok) {
      // Push services return a short diagnostic string; it contains no secrets.
      error = (await res.text().catch(() => "")).slice(0, 300) || res.statusText;
    }
    return { status: res.status, ok: res.ok, gone, error };
  } catch (e) {
    return { status: 0, ok: false, gone: false, error: (e as Error).message };
  }
}
