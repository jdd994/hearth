// api.ts
// Thin client for the Hearth sync server. It only ever sends/receives opaque
// ciphertext + non-secret metadata — never the passphrase or the key. The auth
// token is a separate secret from the encryption passphrase.

import type { CipherBlob, WrappedKey } from "./crypto";

const API_BASE = "https://hearth-server.jdd994.workers.dev";

export type VaultMetaDTO = {
  salt: number[];
  verifier: CipherBlob;
  iterations?: number;
  identityPrivWrapped?: WrappedKey | null;
  // Envelope encryption: the DEK wrapped by the passphrase-derived KEK. Opaque —
  // stored/returned by the server, never read. Absent for legacy vaults.
  wrappedDEK?: CipherBlob | null;
};

// A record on the wire: opaque content + optional non-secret `meta` (a food
// log's `at`, a metric's `at`) the server passes through unread.
export type SyncRecord = {
  kind: "foodLog" | "metric" | "goal" | "recipe";
  id: string;
  createdAt: number;
  updatedAt: number;
  deleted: boolean;
  content: CipherBlob;
  meta?: Record<string, unknown>;
};

async function req(path: string, opts: { method?: string; token?: string; body?: unknown } = {}): Promise<any> {
  const res = await fetch(API_BASE + path, {
    method: opts.method ?? "GET",
    headers: {
      ...(opts.body ? { "Content-Type": "application/json" } : {}),
      ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status}).`);
  return data;
}

export function register(
  email: string,
  password: string,
  vault: VaultMetaDTO,
  identityPublicKey: string,
  identityPrivWrapped: WrappedKey
): Promise<{ token: string; userId: string }> {
  return req("/auth/register", {
    method: "POST",
    body: { email, password, vault, identityPublicKey, identityPrivWrapped },
  });
}

export function login(email: string, password: string): Promise<{ token: string; userId: string }> {
  return req("/auth/login", { method: "POST", body: { email, password } });
}

export function fetchVault(token: string): Promise<VaultMetaDTO> {
  return req("/vault", { token });
}

// Permanently delete the account and every blob the server holds for it. Local
// data on the device is untouched. Irreversible.
export function deleteAccount(token: string): Promise<{ ok: boolean }> {
  return req("/me", { method: "DELETE", token });
}

// Update the vault after a passphrase change: new salt, verifier, re-wrapped DEK.
// Envelope-only — object ciphertext is untouched (the DEK didn't change).
export function updateVault(
  token: string,
  vault: { salt: number[]; verifier: CipherBlob; iterations?: number; wrappedDEK: CipherBlob }
): Promise<{ ok: boolean }> {
  return req("/vault", { method: "PUT", token, body: vault });
}

export function pushChanges(token: string, changes: SyncRecord[]): Promise<{ applied: number; cursor: number }> {
  return req("/sync/push", { method: "POST", token, body: { changes } });
}

export function pullChanges(
  token: string,
  since: number
): Promise<{ changes: SyncRecord[]; cursor: number; more: boolean }> {
  return req(`/sync/pull?since=${since}`, { token });
}
