// useHearth.ts
// The ONLY place state, IO, and the decrypted key meet. Everything else is pure
// logic (lib/) or a presentational component. If plaintext can only leave memory
// through this file, then verifying "what you ate never reaches disk unencrypted"
// means reading this one file.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  checkVerifier, deriveKeyFromSalt, exportKeyRaw, generateIdentityKeypair,
  importKeyRaw, makeVerifier, newSalt, openJSON, sealJSON, exportPublicKeyB64,
  wrapPrivateKey, PBKDF2_ITERATIONS,
} from "../lib/crypto";
import * as db from "../lib/db";
import { biometricSupported, enrollBiometric, unlockBiometric } from "../lib/biometric";
import {
  dayBounds, windowTotal, goalProgress,
  type Food, type FoodLog, type FoodLogContent, type Goal, type GoalContent,
  type GoalProgress, type Nutrients,
} from "../lib/nutrition";

export type Status = "loading" | "setup" | "locked" | "unlocked";

export type Hearth = {
  status: Status;
  error: string | null;
  busy: boolean;

  logs: FoodLog[];
  goals: Goal[];

  today: Nutrients; // derived: today's running total
  progressFor: (g: Goal) => GoalProgress;

  canBiometric: boolean;
  hasBiometric: boolean;

  setup: (passphrase: string) => Promise<void>;
  unlock: (passphrase: string) => Promise<boolean>;
  unlockWithBiometric: () => Promise<boolean>;
  enableBiometric: () => Promise<boolean>;
  lock: () => void;

  logFood: (food: Food, amountGrams: number, at?: number, note?: string) => Promise<void>;
  removeLog: (id: string) => Promise<void>;
  addGoal: (content: GoalContent) => Promise<void>;
  removeGoal: (id: string) => Promise<void>;
};

const uid = () => crypto.randomUUID();

export function useHearth(): Hearth {
  const keyRef = useRef<CryptoKey | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [logs, setLogs] = useState<FoodLog[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [canBiometric, setCanBiometric] = useState(false);
  const [hasBiometric, setHasBiometric] = useState(false);

  useEffect(() => {
    (async () => {
      const [vault, device, supported] = await Promise.all([
        db.getVault(), db.getDevice(), biometricSupported(),
      ]);
      setCanBiometric(supported);
      setHasBiometric(!!device);
      setStatus(vault ? "locked" : "setup");
    })();
  }, []);

  const loadAll = useCallback(async (key: CryptoKey) => {
    const [sl, sg] = await Promise.all([db.allFoodLogs(), db.allGoals()]);
    const l = await Promise.all(
      sl.filter((r) => !r.deleted).map(async (r): Promise<FoodLog> => {
        const c = await openJSON<FoodLogContent>(key, r.content);
        return { ...c, id: r.id, at: r.at };
      })
    );
    const g = await Promise.all(
      sg.filter((r) => !r.deleted).map(async (r): Promise<Goal> => {
        const c = await openJSON<GoalContent>(key, r.content);
        return { ...c, id: r.id };
      })
    );
    setLogs(l);
    setGoals(g);
  }, []);

  const setup = useCallback(async (passphrase: string) => {
    setBusy(true);
    setError(null);
    try {
      const salt = newSalt();
      const key = await deriveKeyFromSalt(passphrase, salt, PBKDF2_ITERATIONS);
      const kp = await generateIdentityKeypair();
      await db.saveVault({
        id: "vault", salt, verifier: await makeVerifier(key), createdAt: Date.now(),
        iterations: PBKDF2_ITERATIONS,
        identityPublic: await exportPublicKeyB64(kp.publicKey),
        identityPrivate: await wrapPrivateKey(key, kp.privateKey),
      });
      keyRef.current = key;
      setStatus("unlocked");
    } finally {
      setBusy(false);
    }
  }, []);

  const finishUnlock = useCallback(async (key: CryptoKey) => {
    keyRef.current = key;
    await loadAll(key);
    setStatus("unlocked");
  }, [loadAll]);

  const unlock = useCallback(async (passphrase: string): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      const vault = await db.getVault();
      if (!vault) return false;
      const key = await deriveKeyFromSalt(passphrase, vault.salt, vault.iterations);
      if (!(await checkVerifier(key, vault.verifier))) {
        setError("That passphrase doesn't open this vault.");
        return false;
      }
      await finishUnlock(key);
      return true;
    } finally {
      setBusy(false);
    }
  }, [finishUnlock]);

  const unlockWithBiometric = useCallback(async (): Promise<boolean> => {
    setError(null);
    const [vault, device] = await Promise.all([db.getVault(), db.getDevice()]);
    if (!vault || !device) return false;
    const raw = await unlockBiometric(device);
    if (!raw) { setError("Couldn't unlock with biometrics. Use your passphrase."); return false; }
    const key = await importKeyRaw(raw);
    if (!(await checkVerifier(key, vault.verifier))) {
      await db.clearDevice();
      setHasBiometric(false);
      setError("This device's quick unlock is out of date. Use your passphrase.");
      return false;
    }
    await finishUnlock(key);
    return true;
  }, [finishUnlock]);

  const enableBiometric = useCallback(async (): Promise<boolean> => {
    const key = keyRef.current;
    if (!key) return false;
    const enrollment = await enrollBiometric(await exportKeyRaw(key));
    if (!enrollment) { setError("This device can't do biometric unlock."); return false; }
    await db.saveDevice({ id: "device", ...enrollment });
    setHasBiometric(true);
    return true;
  }, []);

  const lock = useCallback(() => {
    keyRef.current = null;
    setLogs([]);
    setGoals([]);
    setError(null);
    setStatus("locked");
  }, []);

  // ---- writes: encrypt -> update memory -> persist -----------------------

  const logFood = useCallback(async (food: Food, amountGrams: number, at?: number, note?: string) => {
    const key = keyRef.current;
    if (!key) return;
    const when = at ?? Date.now();
    const content: FoodLogContent = {
      foodId: food.id,
      name: food.name,
      amountGrams,
      per100g: food.per100g, // snapshot — history never rewritten
      note: note?.trim() || undefined,
    };
    const id = uid();
    setLogs((prev) => [...prev, { ...content, id, at: when }]);
    await db.putFoodLog({
      id, at: when, createdAt: Date.now(), updatedAt: Date.now(),
      deleted: false, dirty: true, content: await sealJSON(key, content),
    });
  }, []);

  const removeLog = useCallback(async (id: string) => {
    setLogs((prev) => prev.filter((l) => l.id !== id));
    const stored = await db.getFoodLog(id);
    if (stored) await db.putFoodLog({ ...stored, deleted: true, dirty: true, updatedAt: Date.now() });
  }, []);

  const addGoal = useCallback(async (content: GoalContent) => {
    const key = keyRef.current;
    if (!key) return;
    const id = uid();
    setGoals((prev) => [...prev, { ...content, id }]);
    await db.putGoal({
      id, createdAt: Date.now(), updatedAt: Date.now(),
      deleted: false, dirty: true, content: await sealJSON(key, content),
    });
  }, []);

  const removeGoal = useCallback(async (id: string) => {
    setGoals((prev) => prev.filter((g) => g.id !== id));
    const stored = (await db.allGoals()).find((g) => g.id === id);
    if (stored) await db.putGoal({ ...stored, deleted: true, dirty: true, updatedAt: Date.now() });
  }, []);

  // ---- derived -----------------------------------------------------------
  const { from, to } = dayBounds(Date.now());
  const today = windowTotal(logs, from, to);
  const progressFor = useCallback((g: Goal) => goalProgress(g, today), [today]);

  return {
    status, error, busy, logs, goals, today, progressFor,
    canBiometric, hasBiometric,
    setup, unlock, unlockWithBiometric, enableBiometric, lock,
    logFood, removeLog, addGoal, removeGoal,
  };
}
