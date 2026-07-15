-- Ballast sync server schema.
-- The server stores OPAQUE CIPHERTEXT and non-secret metadata only. It never
-- sees plaintext, the passphrase, or any encryption key. Ported from Driftless.

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,     -- random uuid
  email         TEXT UNIQUE NOT NULL,
  pw_hash       TEXT NOT NULL,        -- PBKDF2(password) — login secret only
  pw_salt       TEXT NOT NULL,
  identity_pub  TEXT,                 -- public half of the identity keypair
  created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS vaults (
  user_id     TEXT PRIMARY KEY REFERENCES users(id),
  salt        TEXT NOT NULL,          -- JSON number[] — non-secret KDF salt
  verifier    TEXT NOT NULL,          -- JSON CipherBlob — checks the passphrase
  iterations  INTEGER NOT NULL,
  identity_priv_wrapped TEXT,         -- identity private key, wrapped by the vault key (opaque)
  currency    TEXT,                   -- base display currency (unused by Hearth; kept for a shared server shape)
  wrapped_dek TEXT,                   -- envelope: the data key (DEK) wrapped by the passphrase-derived KEK (opaque)
  created_at  INTEGER NOT NULL
);

-- Synced objects. One table for all record kinds — 'account', 'snapshot',
-- 'transaction', 'goal'. `content` is always an opaque JSON CipherBlob. `meta`
-- is opaque non-secret metadata the client needs preserved that isn't inside the
-- ciphertext (a snapshot's accountId + at, a transaction's at) — the server
-- treats it as a passthrough blob and never inspects it. `seq` is a per-user
-- monotonic counter; the pull cursor is "everything with seq > since".
CREATE TABLE IF NOT EXISTS objects (
  user_id     TEXT NOT NULL REFERENCES users(id),
  kind        TEXT NOT NULL,
  id          TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  deleted     INTEGER NOT NULL DEFAULT 0,
  content     TEXT NOT NULL,          -- JSON CipherBlob (opaque)
  meta        TEXT,                   -- JSON of extra non-secret fields (opaque)
  seq         INTEGER NOT NULL,
  PRIMARY KEY (user_id, kind, id)
);
CREATE INDEX IF NOT EXISTS objects_by_seq ON objects(user_id, seq);

-- Per-user usage (storage quota accounting). media_bytes reserved for when
-- receipt-photo sync (R2) lands; object count/bytes are computed live.
CREATE TABLE IF NOT EXISTS user_usage (
  user_id     TEXT PRIMARY KEY REFERENCES users(id),
  media_bytes INTEGER NOT NULL DEFAULT 0
);

-- Fixed-window rate-limit counters keyed by action + IP + time bucket.
CREATE TABLE IF NOT EXISTS rate_limits (
  key        TEXT PRIMARY KEY,
  count      INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS rate_limits_by_expiry ON rate_limits(expires_at);
