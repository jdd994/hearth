// db.ts
// Local-first storage. Everything lives in IndexedDB, so logging is instant and
// works offline. The rule, same as its siblings: anything that says something
// about you — what you ate, your weight, your goals — is CIPHERTEXT. Only
// bookkeeping the sync engine needs (ids, timestamps, tombstones, dirty flags)
// stays in the clear.
//
// A server (later) would see: "record abc123 updated at 14:22, 300 bytes." Never
// the food, the amount, or the number on the scale.

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { CipherBlob, WrappedKey } from "./crypto";

export const DB_VERSION = 1;

export type VaultMeta = {
  id: "vault";
  salt: number[];
  verifier: CipherBlob;
  createdAt: number;
  iterations: number;
  // Identity keypair (unused until household/shared meal plans; baked in now so
  // it never has to be retrofitted). Public plaintext; private wrapped.
  identityPublic?: string;
  identityPrivate?: WrappedKey;
};

// Sync bookkeeping shared by syncable records. Plaintext, never secret.
type Syncable = {
  id: string;
  createdAt: number;
  updatedAt: number;
  deleted: boolean;
  dirty: boolean;
};

// content encrypts a FoodLogContent. `at` is plaintext (like Ballast's) so the
// day's log can be windowed without decrypting everything.
export type StoredFoodLog = Syncable & { at: number; content: CipherBlob };

// content encrypts a body-metric reading ({ kind, value, unit }). `at` plaintext.
export type StoredMetric = Syncable & { at: number; content: CipherBlob };

// content encrypts a GoalContent.
export type StoredGoal = Syncable & { content: CipherBlob };

// content encrypts a recipe ({ name, ingredients:[{foodId, name, grams}], servings }).
export type StoredRecipe = Syncable & { content: CipherBlob };

export type SyncState = { id: "state"; cursor: number; token?: string; accountEmail?: string };

export type DeviceEnrollment = {
  id: "device";
  credentialId: number[];
  prfSalt: number[];
  wrapped: CipherBlob;
};

interface HearthDB extends DBSchema {
  vault: { key: string; value: VaultMeta };
  foodLogs: { key: string; value: StoredFoodLog; indexes: { byTime: number } };
  metrics: { key: string; value: StoredMetric; indexes: { byTime: number } };
  goals: { key: string; value: StoredGoal };
  recipes: { key: string; value: StoredRecipe };
  sync: { key: string; value: SyncState };
  device: { key: string; value: DeviceEnrollment };
}

let dbPromise: Promise<IDBPDatabase<HearthDB>> | null = null;

function db() {
  if (!dbPromise) {
    dbPromise = openDB<HearthDB>("hearth", DB_VERSION, {
      upgrade(database) {
        const logs = database.createObjectStore("foodLogs", { keyPath: "id" });
        logs.createIndex("byTime", "at");
        const metrics = database.createObjectStore("metrics", { keyPath: "id" });
        metrics.createIndex("byTime", "at");
        database.createObjectStore("vault", { keyPath: "id" });
        database.createObjectStore("goals", { keyPath: "id" });
        database.createObjectStore("recipes", { keyPath: "id" });
        database.createObjectStore("sync", { keyPath: "id" });
        database.createObjectStore("device", { keyPath: "id" });
      },
    });
  }
  return dbPromise;
}

// ---- vault ---------------------------------------------------------------
export async function getVault(): Promise<VaultMeta | undefined> {
  return (await db()).get("vault", "vault");
}
export async function saveVault(meta: VaultMeta): Promise<void> {
  await (await db()).put("vault", meta);
}

// ---- food logs -----------------------------------------------------------
export async function allFoodLogs(): Promise<StoredFoodLog[]> {
  return (await db()).getAllFromIndex("foodLogs", "byTime");
}
export async function putFoodLog(l: StoredFoodLog): Promise<void> {
  await (await db()).put("foodLogs", l);
}
export async function getFoodLog(id: string): Promise<StoredFoodLog | undefined> {
  return (await db()).get("foodLogs", id);
}

// ---- metrics -------------------------------------------------------------
export async function allMetrics(): Promise<StoredMetric[]> {
  return (await db()).getAllFromIndex("metrics", "byTime");
}
export async function putMetric(m: StoredMetric): Promise<void> {
  await (await db()).put("metrics", m);
}

// ---- goals ---------------------------------------------------------------
export async function allGoals(): Promise<StoredGoal[]> {
  return (await db()).getAll("goals");
}
export async function putGoal(g: StoredGoal): Promise<void> {
  await (await db()).put("goals", g);
}

// ---- recipes -------------------------------------------------------------
export async function allRecipes(): Promise<StoredRecipe[]> {
  return (await db()).getAll("recipes");
}
export async function putRecipe(r: StoredRecipe): Promise<void> {
  await (await db()).put("recipes", r);
}

// ---- sync + device -------------------------------------------------------
export async function getSyncState(): Promise<SyncState | undefined> {
  return (await db()).get("sync", "state");
}
export async function saveSyncState(s: SyncState): Promise<void> {
  await (await db()).put("sync", s);
}
export async function getDevice(): Promise<DeviceEnrollment | undefined> {
  return (await db()).get("device", "device");
}
export async function saveDevice(e: DeviceEnrollment): Promise<void> {
  await (await db()).put("device", e);
}
export async function clearDevice(): Promise<void> {
  await (await db()).delete("device", "device");
}

const ALL_STORES = ["vault", "foodLogs", "metrics", "goals", "recipes", "sync", "device"] as const;

// Wipe everything (forget this device). Without the passphrase nothing readable
// remains anywhere anyway.
export async function wipe(): Promise<void> {
  const d = await db();
  const tx = d.transaction(ALL_STORES, "readwrite");
  await Promise.all(ALL_STORES.map((s) => tx.objectStore(s).clear()));
  await tx.done;
}
