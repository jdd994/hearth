// index.ts
// Hearth sync server. Stores opaque ciphertext + non-secret metadata only —
// never plaintext, the passphrase, or any encryption key. Ported from Driftless:
// the client encrypts, this stores blobs, devices reconcile by id + updatedAt.

import { Hono, type Context, type Next } from "hono";
import { cors } from "hono/cors";
import { hashPassword, verifyPassword, signToken, verifyToken } from "./auth";

type Env = {
  DB: D1Database;
  TOKEN_SECRET: string;
  ALLOWED_ORIGIN: string;
};
type Vars = { userId: string };
type AppContext = Context<{ Bindings: Env; Variables: Vars }>;

// Per-user storage quotas — cost safety, not stinginess. Far above any real use;
// they bound the worst case a single account (or a bot) can cost the bill payer.
const MAX_USER_OBJECTS = 100_000;
const MAX_USER_CONTENT_BYTES = 100 * 1024 * 1024; // 100 MB of ciphertext

const app = new Hono<{ Bindings: Env; Variables: Vars }>();

// CORS allowlist (comma-separated origins); empty reflects any (dev only).
app.use("*", (c, next) => {
  const allowed = (c.env.ALLOWED_ORIGIN || "").split(",").map((s) => s.trim()).filter(Boolean);
  return cors({
    origin: (origin) => (allowed.length === 0 ? "*" : allowed.includes(origin) ? origin : null),
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400,
  })(c, next);
});

async function requireAuth(c: AppContext, next: Next) {
  const header = c.req.header("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const userId = token ? await verifyToken(token, c.env.TOKEN_SECRET) : null;
  if (!userId) return c.json({ error: "Not signed in." }, 401);
  c.set("userId", userId);
  await next();
}

// Fixed-window rate limit for the open endpoints (register/login).
async function withinRateLimit(c: AppContext, action: string, limit: number, windowMs: number): Promise<boolean> {
  const ip = c.req.header("CF-Connecting-IP") ?? "unknown";
  const key = `${action}:${ip}:${Math.floor(Date.now() / windowMs)}`;
  try {
    const row = await c.env.DB.prepare(
      "INSERT INTO rate_limits (key, count, expires_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = count + 1 RETURNING count"
    ).bind(key, Date.now() + windowMs).first<{ count: number }>();
    if (Math.random() < 0.02) {
      await c.env.DB.prepare("DELETE FROM rate_limits WHERE expires_at < ?").bind(Date.now()).run();
    }
    return (row?.count ?? 1) <= limit;
  } catch {
    return true; // never let the limiter itself take the service down
  }
}
const TOO_MANY = "Too many attempts from here — please wait a little and try again.";

async function objectUsage(db: D1Database, userId: string): Promise<{ n: number; bytes: number }> {
  const row = await db
    .prepare("SELECT COUNT(*) AS n, COALESCE(SUM(LENGTH(content)), 0) AS bytes FROM objects WHERE user_id = ?")
    .bind(userId).first<{ n: number; bytes: number }>();
  return { n: row?.n ?? 0, bytes: row?.bytes ?? 0 };
}

app.get("/health", (c) => c.json({ ok: true, service: "hearth-server" }));
app.get("/me", requireAuth, (c) => c.json({ userId: c.get("userId") }));

// Delete the account and everything the server holds for it. The passphrase was
// never here, so this IS the whole server-side footprint: the encrypted objects,
// the vault record, and the account row. Local data on the device is untouched —
// this only clears the cloud copy. Irreversible, and the client confirms first.
app.delete("/me", requireAuth, async (c) => {
  const userId = c.get("userId");
  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM objects WHERE user_id = ?").bind(userId),
    c.env.DB.prepare("DELETE FROM vaults WHERE user_id = ?").bind(userId),
    c.env.DB.prepare("DELETE FROM user_usage WHERE user_id = ?").bind(userId),
    c.env.DB.prepare("DELETE FROM users WHERE id = ?").bind(userId),
  ]);
  return c.json({ ok: true });
});

// ---- accounts + vault ----------------------------------------------------

app.post("/auth/register", async (c) => {
  if (!(await withinRateLimit(c, "register", 10, 3_600_000))) return c.json({ error: TOO_MANY }, 429);
  const body = await c.req.json().catch(() => null);
  const email = (body?.email ?? "").trim().toLowerCase();
  const password = body?.password ?? "";
  const vault = body?.vault;
  const identityPublicKey = body?.identityPublicKey ?? null;
  const identityPrivWrapped = body?.identityPrivWrapped ?? null;
  if (!email || !password || !vault || !Array.isArray(vault.salt) || !vault.verifier) {
    return c.json({ error: "Missing email, password, or vault." }, 400);
  }
  const existing = await c.env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
  if (existing) return c.json({ error: "That email is already registered." }, 409);

  const userId = crypto.randomUUID();
  const { saltB64, hashB64 } = await hashPassword(password);
  const now = Date.now();
  await c.env.DB.batch([
    c.env.DB.prepare("INSERT INTO users (id, email, pw_hash, pw_salt, identity_pub, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(userId, email, hashB64, saltB64, identityPublicKey, now),
    c.env.DB.prepare("INSERT INTO vaults (user_id, salt, verifier, iterations, identity_priv_wrapped, currency, wrapped_dek, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(userId, JSON.stringify(vault.salt), JSON.stringify(vault.verifier), vault.iterations ?? 600000,
        identityPrivWrapped ? JSON.stringify(identityPrivWrapped) : null,
        typeof vault.currency === "string" ? vault.currency : null,
        vault.wrappedDEK ? JSON.stringify(vault.wrappedDEK) : null, now),
  ]);
  return c.json({ token: await signToken(userId, c.env.TOKEN_SECRET), userId });
});

app.post("/auth/login", async (c) => {
  if (!(await withinRateLimit(c, "login", 30, 900_000))) return c.json({ error: TOO_MANY }, 429);
  const body = await c.req.json().catch(() => null);
  const email = (body?.email ?? "").trim().toLowerCase();
  const password = body?.password ?? "";
  const user = await c.env.DB.prepare("SELECT id, pw_hash, pw_salt FROM users WHERE email = ?")
    .bind(email).first<{ id: string; pw_hash: string; pw_salt: string }>();
  if (!user || !(await verifyPassword(password, user.pw_salt, user.pw_hash))) {
    return c.json({ error: "Wrong email or password." }, 401);
  }
  return c.json({ token: await signToken(user.id, c.env.TOKEN_SECRET), userId: user.id });
});

app.get("/vault", requireAuth, async (c) => {
  const v = await c.env.DB.prepare("SELECT salt, verifier, iterations, identity_priv_wrapped, currency, wrapped_dek FROM vaults WHERE user_id = ?")
    .bind(c.get("userId")).first<{ salt: string; verifier: string; iterations: number; identity_priv_wrapped: string | null; currency: string | null; wrapped_dek: string | null }>();
  if (!v) return c.json({ error: "no vault" }, 404);
  return c.json({
    salt: JSON.parse(v.salt),
    verifier: JSON.parse(v.verifier),
    iterations: v.iterations,
    identityPrivWrapped: v.identity_priv_wrapped ? JSON.parse(v.identity_priv_wrapped) : null,
    currency: v.currency ?? null,
    wrappedDEK: v.wrapped_dek ? JSON.parse(v.wrapped_dek) : null,
  });
});

// Update the vault after a passphrase change: new salt, verifier, iterations,
// re-wrapped DEK. Envelope-only — object ciphertext is untouched, so no re-upload
// is needed; another device requires the new passphrase on its next sign-in.
app.put("/vault", requireAuth, async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json().catch(() => null);
  if (!body || !Array.isArray(body.salt) || !body.verifier || !body.wrappedDEK) {
    return c.json({ error: "Missing salt, verifier, or wrappedDEK." }, 400);
  }
  const res = await c.env.DB.prepare(
    "UPDATE vaults SET salt = ?, verifier = ?, iterations = ?, wrapped_dek = ? WHERE user_id = ?"
  ).bind(
    JSON.stringify(body.salt), JSON.stringify(body.verifier),
    body.iterations ?? 600000, JSON.stringify(body.wrappedDEK), userId
  ).run();
  if (!res.meta.changes) return c.json({ error: "No vault found." }, 404);
  return c.json({ ok: true });
});

// ---- sync ----------------------------------------------------------------

const PULL_LIMIT = 500;
const MAX_PUSH = 1000;
const KINDS = ["foodLog", "metric", "goal", "recipe"];

const UPSERT_OBJECT = `
INSERT INTO objects (user_id, kind, id, created_at, updated_at, deleted, content, meta, seq)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(user_id, kind, id) DO UPDATE SET
  updated_at = excluded.updated_at,
  deleted    = excluded.deleted,
  content    = excluded.content,
  meta       = excluded.meta,
  seq        = excluded.seq
WHERE excluded.updated_at >= objects.updated_at`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isCipherBlob(x: any): boolean {
  return x && Array.isArray(x.iv) && Array.isArray(x.data);
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function validChange(ch: any): boolean {
  return ch && KINDS.includes(ch.kind) && typeof ch.id === "string" &&
    typeof ch.createdAt === "number" && typeof ch.updatedAt === "number" &&
    typeof ch.deleted === "boolean" && isCipherBlob(ch.content);
}
async function maxSeq(db: D1Database, userId: string): Promise<number> {
  const r = await db.prepare("SELECT COALESCE(MAX(seq), 0) AS m FROM objects WHERE user_id = ?")
    .bind(userId).first<{ m: number }>();
  return r?.m ?? 0;
}

app.post("/sync/push", requireAuth, async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json().catch(() => null);
  const changes = body?.changes;
  if (!Array.isArray(changes)) return c.json({ error: "changes must be an array" }, 400);
  if (changes.length > MAX_PUSH) return c.json({ error: `too many changes (max ${MAX_PUSH})` }, 400);
  for (const ch of changes) if (!validChange(ch)) return c.json({ error: "malformed change" }, 400);

  const usage = await objectUsage(c.env.DB, userId);
  let addRows = 0, addBytes = 0;
  for (const ch of changes) { addRows += 1; addBytes += JSON.stringify(ch.content).length; }
  if (usage.n + addRows > MAX_USER_OBJECTS || usage.bytes + addBytes > MAX_USER_CONTENT_BYTES) {
    return c.json({ error: "This account has reached its storage limit. Nothing was lost — it stays on your device." }, 413);
  }

  let applied = 0;
  if (changes.length > 0) {
    const base = await maxSeq(c.env.DB, userId);
    const stmts = changes.map((ch: { kind: string; id: string; createdAt: number; updatedAt: number; deleted: boolean; content: unknown; meta?: unknown }, i: number) =>
      c.env.DB.prepare(UPSERT_OBJECT).bind(
        userId, ch.kind, ch.id, ch.createdAt, ch.updatedAt, ch.deleted ? 1 : 0,
        JSON.stringify(ch.content), ch.meta !== undefined ? JSON.stringify(ch.meta) : null, base + i + 1
      )
    );
    const res = await c.env.DB.batch(stmts);
    applied = res.reduce((n, r) => n + (r.meta?.changes ?? 0), 0);
  }
  return c.json({ applied, cursor: await maxSeq(c.env.DB, userId) });
});

app.get("/sync/pull", requireAuth, async (c) => {
  const userId = c.get("userId");
  const since = Math.max(0, Number(c.req.query("since") ?? "0") || 0);
  const rows = await c.env.DB.prepare(
    "SELECT kind, id, created_at, updated_at, deleted, content, meta, seq FROM objects WHERE user_id = ? AND seq > ? ORDER BY seq LIMIT ?"
  ).bind(userId, since, PULL_LIMIT).all<{
    kind: string; id: string; created_at: number; updated_at: number;
    deleted: number; content: string; meta: string | null; seq: number;
  }>();
  const results = rows.results ?? [];
  const changes = results.map((r) => ({
    kind: r.kind, id: r.id, createdAt: r.created_at, updatedAt: r.updated_at,
    deleted: r.deleted === 1, content: JSON.parse(r.content),
    meta: r.meta ? JSON.parse(r.meta) : undefined,
  }));
  const cursor = results.length ? results[results.length - 1].seq : since;
  return c.json({ changes, cursor, more: results.length === PULL_LIMIT });
});

export default app;
