// crypto.envelope.test.ts
// Proves the envelope scheme that makes change-passphrase safe: a random DEK
// encrypts the data; the passphrase only derives a KEK that WRAPS the DEK. The
// point to nail down is that the DEK — and therefore every ciphertext and every
// device's ability to read it — survives both migration and a passphrase change.

import { describe, it, expect } from "vitest";
import {
  newSalt, deriveKeyFromSalt, generateDEK, wrapVaultKey, unwrapVaultKey,
  makeVerifier, checkVerifier, encryptString, decryptString, exportKeyRaw,
} from "./crypto";

const ITER = 1000; // fast; the real app uses 600k

describe("envelope encryption", () => {
  it("new vault: KEK wraps DEK, unlock unwraps it and reads the data", async () => {
    const salt = newSalt();
    const kek = await deriveKeyFromSalt("correct horse battery", salt, ITER);
    const dek = await generateDEK();
    const wrapped = await wrapVaultKey(kek, dek);
    const verifier = await makeVerifier(dek);
    const cipher = await encryptString(dek, "a fleeting thought");

    // Unlock: re-derive KEK, unwrap DEK, verify, read.
    const kek2 = await deriveKeyFromSalt("correct horse battery", salt, ITER);
    const dek2 = await unwrapVaultKey(kek2, wrapped);
    expect(await checkVerifier(dek2, verifier)).toBe(true);
    expect(await decryptString(dek2, cipher)).toBe("a fleeting thought");
  });

  it("wrong passphrase can't unwrap the DEK", async () => {
    const salt = newSalt();
    const kek = await deriveKeyFromSalt("right", salt, ITER);
    const wrapped = await wrapVaultKey(kek, await generateDEK());
    const wrongKek = await deriveKeyFromSalt("wrong", salt, ITER);
    await expect(unwrapVaultKey(wrongKek, wrapped)).rejects.toBeTruthy();
  });

  it("migration: an old direct-derived key becomes the DEK, old data still reads", async () => {
    // Old-style vault: the key IS derived straight from the passphrase.
    const oldSalt = newSalt();
    const oldKey = await deriveKeyFromSalt("my passphrase", oldSalt, ITER);
    const oldData = await encryptString(oldKey, "written before sync existed");
    const oldVerifier = await makeVerifier(oldKey);

    // Migrate in place: keep oldKey AS the DEK (no data re-encryption), and wrap
    // it under a KEK derived from a fresh salt. The verifier still validates the
    // DEK, so it carries over unchanged.
    const dek = oldKey;
    const newSalt_ = newSalt();
    const kek = await deriveKeyFromSalt("my passphrase", newSalt_, ITER);
    const wrapped = await wrapVaultKey(kek, dek);

    // Later unlock, envelope-style: derive KEK from the new salt, unwrap, read
    // the DATA THAT WAS NEVER RE-ENCRYPTED.
    const kek2 = await deriveKeyFromSalt("my passphrase", newSalt_, ITER);
    const dek2 = await unwrapVaultKey(kek2, wrapped);
    expect(await checkVerifier(dek2, oldVerifier)).toBe(true);
    expect(await decryptString(dek2, oldData)).toBe("written before sync existed");
  });

  it("change passphrase: DEK is unchanged; new passphrase opens it, old one fails", async () => {
    const dek = await generateDEK();
    const dekRawBefore = await exportKeyRaw(dek);
    const data = await encryptString(dek, "keep me");

    // Start with passphrase A.
    const saltA = newSalt();
    const kekA = await deriveKeyFromSalt("passphrase-A", saltA, ITER);
    const wrappedA = await wrapVaultKey(kekA, dek);

    // Change to passphrase B: fresh salt, re-wrap the SAME dek.
    const saltB = newSalt();
    const kekB = await deriveKeyFromSalt("passphrase-B", saltB, ITER);
    const wrappedB = await wrapVaultKey(kekB, dek);

    // New passphrase opens the new wrap and reads data encrypted before the change.
    const dekB = await unwrapVaultKey(await deriveKeyFromSalt("passphrase-B", saltB, ITER), wrappedB);
    expect(await decryptString(dekB, data)).toBe("keep me");
    // The DEK bytes are identical before and after — so biometric (which wraps
    // the raw DEK) and every other device keep working.
    expect(await exportKeyRaw(dekB)).toEqual(dekRawBefore);

    // The old passphrase no longer opens the new vault.
    await expect(
      unwrapVaultKey(await deriveKeyFromSalt("passphrase-A", saltB, ITER), wrappedB)
    ).rejects.toBeTruthy();
    // (wrappedA is now dead once the server/device has wrappedB.)
    void wrappedA;
  });
});
