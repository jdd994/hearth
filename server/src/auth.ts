// auth.ts
// Password hashing + signed session tokens, using only WebCrypto (available in
// the Workers runtime). The account password is the *login* secret — entirely
// separate from the encryption passphrase, which never reaches the server.

const enc = new TextEncoder();
const PW_ITERATIONS = 100_000;

function b64(bytes: ArrayBuffer | Uint8Array): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const b of u8) s += String.fromCharCode(b);
  return btoa(s);
}
function fromB64(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}
function b64url(bytes: ArrayBuffer | Uint8Array): string {
  return b64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64url(s: string): Uint8Array {
  const pad = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : "";
  return fromB64(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
}

// Constant-time-ish string compare to avoid leaking via timing.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function hashPassword(
  password: string,
  salt?: Uint8Array
): Promise<{ saltB64: string; hashB64: string }> {
  const s = salt ?? crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: s, iterations: PW_ITERATIONS, hash: "SHA-256" },
    key,
    256
  );
  return { saltB64: b64(s), hashB64: b64(bits) };
}

export async function verifyPassword(
  password: string,
  saltB64: string,
  hashB64: string
): Promise<boolean> {
  const { hashB64: computed } = await hashPassword(password, fromB64(saltB64));
  return safeEqual(computed, hashB64);
}

async function hmac(secret: string, data: string): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return crypto.subtle.sign("HMAC", key, enc.encode(data));
}

const DEFAULT_TTL = 60 * 60 * 24 * 30; // 30 days

// token = base64url(payload) . base64url(hmac(payload)); payload = "userId|exp".
export async function signToken(
  userId: string,
  secret: string,
  ttlSeconds = DEFAULT_TTL
): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${userId}|${exp}`;
  const sig = b64url(await hmac(secret, payload));
  return `${b64url(enc.encode(payload))}.${sig}`;
}

export async function verifyToken(token: string, secret: string): Promise<string | null> {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  let payload: string;
  try {
    payload = new TextDecoder().decode(fromB64url(parts[0]));
  } catch {
    return null;
  }
  const expectedSig = b64url(await hmac(secret, payload));
  if (!safeEqual(expectedSig, parts[1])) return null;
  const [userId, expStr] = payload.split("|");
  if (!userId || !expStr) return null;
  if (Number(expStr) < Math.floor(Date.now() / 1000)) return null; // expired
  return userId;
}
