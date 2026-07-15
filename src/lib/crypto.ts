// crypto.ts
// End-to-end encryption for everything Ballast knows about your money.
//
// Model: a passphrase only you know is stretched into an AES-GCM key with
// PBKDF2. Balances, account names, addresses, goals — all encrypted in the
// browser. Only ciphertext is ever written to storage or (later) to a sync
// server. The key lives in memory for the session only.
//
// Honest tradeoff: there is no recovery. If the passphrase is forgotten, the
// data cannot be decrypted by anyone, including us. That's the point — it is
// the same property that means a breach of our server yields nothing.
//
// Ported from Driftless, which has been running this scheme in production.
// Deliberately unchanged where it didn't need to change.

// OWASP's 2023+ guidance for PBKDF2-SHA256 is 600k. The count a vault was
// created with is stored in the vault (see db.ts) so raising this later never
// locks out an existing vault.
export const PBKDF2_ITERATIONS = 600_000;
const KEY_ALGO = { name: "AES-GCM", length: 256 } as const;
const enc = new TextEncoder();
const dec = new TextDecoder();

export type CipherBlob = {
  iv: number[]; // 12-byte AES-GCM nonce
  data: number[]; // ciphertext bytes
};

// Copy any byte view into a fresh, standalone ArrayBuffer. WebCrypto wants a
// BufferSource backed by ArrayBuffer (not SharedArrayBuffer).
function toBuf(view: Uint8Array): ArrayBuffer {
  const out = new ArrayBuffer(view.byteLength);
  new Uint8Array(out).set(view);
  return out;
}

function randomBytes(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n));
}

export function newSalt(): number[] {
  return Array.from(randomBytes(16));
}

async function deriveKey(
  passphrase: string,
  salt: Uint8Array,
  iterations: number
): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    toBuf(enc.encode(passphrase)),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: toBuf(salt), iterations, hash: "SHA-256" },
    baseKey,
    KEY_ALGO,
    // Extractable so a device can wrap a copy of the key for biometric unlock.
    // The key still lives only in memory; CSP blocks any script that could read
    // it back out to another origin.
    true,
    ["encrypt", "decrypt"]
  );
}

export async function deriveKeyFromSalt(
  passphrase: string,
  salt: number[],
  iterations = PBKDF2_ITERATIONS
): Promise<CryptoKey> {
  return deriveKey(passphrase, new Uint8Array(salt), iterations);
}

export async function encryptString(key: CryptoKey, plaintext: string): Promise<CipherBlob> {
  const iv = randomBytes(12);
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: toBuf(iv) },
    key,
    toBuf(enc.encode(plaintext))
  );
  return { iv: Array.from(iv), data: Array.from(new Uint8Array(cipher)) };
}

export async function decryptString(key: CryptoKey, blob: CipherBlob): Promise<string> {
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toBuf(new Uint8Array(blob.iv)) },
    key,
    toBuf(new Uint8Array(blob.data))
  );
  return dec.decode(plain);
}

// Every domain object is stored as an encrypted JSON payload. These two are the
// only doors between plaintext domain types and stored ciphertext — if you find
// yourself writing an object to the DB without passing through `sealJSON`,
// something has gone wrong.
export async function sealJSON<T>(key: CryptoKey, value: T): Promise<CipherBlob> {
  return encryptString(key, JSON.stringify(value));
}

export async function openJSON<T>(key: CryptoKey, blob: CipherBlob): Promise<T> {
  return JSON.parse(await decryptString(key, blob)) as T;
}

// ---- Binary encryption (receipt photos) ---------------------------------
// Images are raw bytes. IndexedDB stores ArrayBuffers efficiently, so they skip
// the number[] shape that small text blobs use. A receipt is ciphertext at rest
// exactly like a balance is — it names the merchant, the items, the time, and
// often the last four digits of a card.
export type CipherBytes = { iv: Uint8Array; data: ArrayBuffer };

export async function encryptBytes(key: CryptoKey, bytes: ArrayBuffer): Promise<CipherBytes> {
  const iv = randomBytes(12);
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv: toBuf(iv) }, key, bytes);
  return { iv, data };
}

export async function decryptBytes(key: CryptoKey, blob: CipherBytes): Promise<ArrayBuffer> {
  return crypto.subtle.decrypt({ name: "AES-GCM", iv: toBuf(blob.iv) }, key, blob.data);
}

// ---- Raw key export/import + wrapping (for biometric unlock) ------------

export async function exportKeyRaw(key: CryptoKey): Promise<number[]> {
  return Array.from(new Uint8Array(await crypto.subtle.exportKey("raw", key)));
}

export async function importKeyRaw(bytes: number[]): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", toBuf(new Uint8Array(bytes)), KEY_ALGO, true, [
    "encrypt",
    "decrypt",
  ]);
}

// Use the first 32 bytes of an external secret as an AES-GCM wrapping key.
async function kekFromSecret(secret: ArrayBuffer): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", secret.slice(0, 32), KEY_ALGO, false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function wrapWithSecret(secret: ArrayBuffer, keyRaw: number[]): Promise<CipherBlob> {
  const kek = await kekFromSecret(secret);
  const iv = randomBytes(12);
  const data = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: toBuf(iv) },
    kek,
    toBuf(new Uint8Array(keyRaw))
  );
  return { iv: Array.from(iv), data: Array.from(new Uint8Array(data)) };
}

export async function unwrapWithSecret(secret: ArrayBuffer, blob: CipherBlob): Promise<number[]> {
  const kek = await kekFromSecret(secret);
  const raw = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toBuf(new Uint8Array(blob.iv)) },
    kek,
    toBuf(new Uint8Array(blob.data))
  );
  return Array.from(new Uint8Array(raw));
}

// ---- Identity keypair (ECDH P-256) --------------------------------------
// Nothing uses this yet. It exists from day one because Driftless learned the
// hard way that retrofitting identity into an already-synced data model is
// painful (see driftless/SYNC_PLAN.md). When a household wants a shared view of
// joint accounts, the keys will already be there.
//
// Public key: shareable, so others can encrypt to you. Private key: wrapped by
// the vault key, so it survives to a new device once the passphrase unlocks.

function b64(u8: Uint8Array): string {
  let s = "";
  const chunk = 0x8000;
  for (let i = 0; i < u8.length; i += chunk) s += String.fromCharCode(...u8.subarray(i, i + chunk));
  return btoa(s);
}
function fromB64(s: string): Uint8Array {
  const bin = atob(s);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}

export type WrappedKey = { iv: string; data: string }; // base64

export function generateIdentityKeypair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
    "deriveKey",
    "deriveBits",
  ]);
}

export async function exportPublicKeyB64(pub: CryptoKey): Promise<string> {
  return b64(new Uint8Array(await crypto.subtle.exportKey("spki", pub)));
}

export async function wrapPrivateKey(vaultKey: CryptoKey, priv: CryptoKey): Promise<WrappedKey> {
  const pkcs8 = await crypto.subtle.exportKey("pkcs8", priv);
  const iv = randomBytes(12);
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv: toBuf(iv) }, vaultKey, pkcs8);
  return { iv: b64(iv), data: b64(new Uint8Array(data)) };
}

export async function unwrapPrivateKey(vaultKey: CryptoKey, w: WrappedKey): Promise<CryptoKey> {
  const bytes = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toBuf(fromB64(w.iv)) },
    vaultKey,
    toBuf(fromB64(w.data))
  );
  return crypto.subtle.importKey("pkcs8", bytes, { name: "ECDH", namedCurve: "P-256" }, true, [
    "deriveKey",
    "deriveBits",
  ]);
}

// ---- Verifier -----------------------------------------------------------
// A small known token, encrypted at setup. On unlock we try to decrypt it;
// success means the passphrase was correct. AES-GCM fails loudly on a wrong
// key, so this never produces a false positive.
const VERIFIER_TEXT = "hearth-ok";

// ---- Envelope encryption (change-passphrase without re-encrypting data) ---
// A random DEK encrypts all data; the passphrase-derived KEK only WRAPS the DEK.
// Changing the passphrase re-wraps the DEK — the DEK (and every ciphertext, and
// each device's ability to read it) never changes. See useHearth.changePassphrase.
export function generateDEK(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
}
export async function wrapVaultKey(kek: CryptoKey, dek: CryptoKey): Promise<CipherBlob> {
  return encryptString(kek, JSON.stringify(await exportKeyRaw(dek)));
}
export async function unwrapVaultKey(kek: CryptoKey, blob: CipherBlob): Promise<CryptoKey> {
  return importKeyRaw(JSON.parse(await decryptString(kek, blob)) as number[]);
}

export async function makeVerifier(key: CryptoKey): Promise<CipherBlob> {
  return encryptString(key, VERIFIER_TEXT);
}

export async function checkVerifier(key: CryptoKey, blob: CipherBlob): Promise<boolean> {
  try {
    return (await decryptString(key, blob)) === VERIFIER_TEXT;
  } catch {
    return false;
  }
}
