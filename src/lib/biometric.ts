// biometric.ts
// Optional, per-device quick unlock built on WebAuthn's PRF extension.
//
// A platform passkey (Face ID / Touch ID / fingerprint) can emit a stable secret
// after a biometric check. We use that secret to wrap a copy of the vault key on
// THIS device. The passphrase stays the durable root — this never replaces it,
// and a platform that can't do PRF simply falls back to typing it.
//
// The wrapped key never syncs. It is meaningless off this device.
//
// Ported from Driftless unchanged except for the app name and PRF salt.

import { wrapWithSecret, unwrapWithSecret, type CipherBlob } from "./crypto";

// A fixed app salt for the PRF evaluation. The secret is per-credential, so a
// constant salt is fine and keeps enroll/unlock consistent.
const PRF_SALT = new Uint8Array([
  0x62, 0x61, 0x6c, 0x6c, 0x61, 0x73, 0x74, 0x2d, 0x70, 0x72, 0x66, 0x2d, 0x76, 0x31, 0x00, 0x00,
  0x3d, 0x91, 0x27, 0xb4, 0x6a, 0xf0, 0x18, 0x5c, 0xe3, 0x72, 0xa9, 0x46, 0x0b, 0xd8, 0x51, 0x2f,
]);

function rand(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n));
}

export type Enrollment = {
  credentialId: number[];
  prfSalt: number[];
  wrapped: CipherBlob;
};

export async function biometricSupported(): Promise<boolean> {
  try {
    return (
      typeof window !== "undefined" &&
      !!window.PublicKeyCredential &&
      (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())
    );
  } catch {
    return false;
  }
}

async function assertPrf(credentialId: number[]): Promise<ArrayBuffer | undefined> {
  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge: rand(32),
      allowCredentials: [{ type: "public-key", id: new Uint8Array(credentialId) }],
      userVerification: "required",
      timeout: 60_000,
      extensions: { prf: { eval: { first: PRF_SALT } } },
    },
  } as unknown as CredentialRequestOptions)) as PublicKeyCredential | null;
  const ext = assertion?.getClientExtensionResults() as
    | { prf?: { results?: { first?: ArrayBuffer } } }
    | undefined;
  return ext?.prf?.results?.first;
}

// Create a platform passkey with PRF and wrap the vault key with its output.
// Returns null when the platform can't produce a PRF secret, in which case the
// caller keeps the passphrase-only flow.
export async function enrollBiometric(vaultKeyRaw: number[]): Promise<Enrollment | null> {
  const cred = (await navigator.credentials.create({
    publicKey: {
      rp: { name: "Hearth", id: location.hostname },
      user: { id: rand(16), name: "hearth", displayName: "Hearth" },
      challenge: rand(32),
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "required",
      },
      timeout: 60_000,
      extensions: { prf: { eval: { first: PRF_SALT } } },
    },
  } as unknown as CredentialCreationOptions)) as PublicKeyCredential | null;
  if (!cred) return null;

  const ext = cred.getClientExtensionResults() as {
    prf?: { enabled?: boolean; results?: { first?: ArrayBuffer } };
  };
  if (!ext.prf || ext.prf.enabled === false) return null; // no PRF here

  const credentialId = Array.from(new Uint8Array(cred.rawId));
  // Some platforms return the secret at create time; others need an assertion.
  const secret = ext.prf.results?.first ?? (await assertPrf(credentialId));
  if (!secret) return null;

  return {
    credentialId,
    prfSalt: Array.from(PRF_SALT),
    wrapped: await wrapWithSecret(secret, vaultKeyRaw),
  };
}

export async function unlockBiometric(enr: Enrollment): Promise<number[] | null> {
  const secret = await assertPrf(enr.credentialId);
  if (!secret) return null;
  try {
    return await unwrapWithSecret(secret, enr.wrapped);
  } catch {
    return null;
  }
}
