// sync.test.ts
// The reconcile engine, exercised as two devices sharing one account. The
// network is mocked with a tiny in-memory "server" that behaves like the real
// one (LWW upsert, monotonic seq, pull-by-cursor); the local store is a real
// IndexedDB via fake-indexeddb. So this tests the actual push/pull/LWW code
// against real persistence, without touching the wire.

import "fake-indexeddb/auto";
import { openDB } from "idb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CipherBlob } from "./crypto";

type Row = {
  kind: string; id: string; createdAt: number; updatedAt: number;
  deleted: boolean; content: CipherBlob; meta?: Record<string, unknown>; seq: number;
};
const server: { rows: Row[]; seq: number } = { rows: [], seq: 0 };

vi.mock("./api", () => ({
  pushChanges: async (_t: string, changes: Omit<Row, "seq">[]) => {
    for (const ch of changes) {
      const existing = server.rows.find((r) => r.kind === ch.kind && r.id === ch.id);
      if (existing && ch.updatedAt < existing.updatedAt) continue;
      const seq = ++server.seq;
      if (existing) Object.assign(existing, ch, { seq });
      else server.rows.push({ ...ch, seq });
    }
    return { applied: changes.length, cursor: server.seq };
  },
  pullChanges: async (_t: string, since: number) => {
    const rows = server.rows.filter((r) => r.seq > since).sort((a, b) => a.seq - b.seq);
    const changes = rows.map(({ seq, ...rest }) => { void seq; return rest; });
    return { changes, cursor: rows.length ? rows[rows.length - 1].seq : since, more: false };
  },
}));

const blob = (n: number): CipherBlob => ({ iv: [n], data: [n, n] });

async function wipeLocal() {
  const raw = await openDB("hearth", 1);
  for (const s of ["foodLogs", "metrics", "goals", "recipes", "sync"]) {
    if (raw.objectStoreNames.contains(s)) await raw.clear(s);
  }
  raw.close();
}

describe("sync reconcile engine", () => {
  beforeEach(async () => {
    server.rows = [];
    server.seq = 0;
    const db = await import("./db");
    await db.putFoodLog({ id: "warm", at: 0, createdAt: 0, updatedAt: 0, deleted: false, dirty: false, content: blob(0) });
    await wipeLocal();
  });

  it("pushes the dirty set and clears the flags, carrying `at` as meta", async () => {
    const db = await import("./db");
    const { push } = await import("./sync");

    await db.putFoodLog({ id: "f-1", at: 555, createdAt: 1, updatedAt: 1, deleted: false, dirty: true, content: blob(1) });
    await db.putRecipe({ id: "r-1", createdAt: 2, updatedAt: 2, deleted: false, dirty: true, content: blob(2) });

    await push("t");

    expect(server.rows).toHaveLength(2);
    const log = server.rows.find((r) => r.kind === "foodLog")!;
    expect(log.meta).toEqual({ at: 555 });
    const recipe = server.rows.find((r) => r.kind === "recipe")!;
    expect(recipe.meta).toBeUndefined();

    const stored = await db.getFoodLog("f-1");
    expect(stored!.dirty).toBe(false);
  });

  it("materializes a second device's records from a pull, reconstructing `at`", async () => {
    const db = await import("./db");
    const { push, pull } = await import("./sync");

    await db.putFoodLog({ id: "f-1", at: 555, createdAt: 1, updatedAt: 1, deleted: false, dirty: true, content: blob(1) });
    await db.putMetric({ id: "m-1", at: 777, createdAt: 2, updatedAt: 2, deleted: false, dirty: true, content: blob(2) });
    await push("t");

    await wipeLocal();
    expect(await pull("t")).toBe(true);

    const log = (await db.allFoodLogs()).find((l) => l.id === "f-1")!;
    expect(log.dirty).toBe(false);
    expect(log.at).toBe(555);
    expect(log.content).toEqual(blob(1));

    const metric = (await db.allMetrics()).find((m) => m.id === "m-1")!;
    expect(metric.at).toBe(777);

    expect(await pull("t")).toBe(false); // cursor advanced
  });

  it("keeps the newer record on conflict (last-write-wins by updatedAt)", async () => {
    const db = await import("./db");
    const { pull } = await import("./sync");

    server.rows.push({ kind: "goal", id: "g-1", createdAt: 1, updatedAt: 1, deleted: false, content: blob(1), seq: ++server.seq });
    await db.putGoal({ id: "g-1", createdAt: 1, updatedAt: 1000, deleted: false, dirty: false, content: blob(9) });

    expect(await pull("t")).toBe(false);

    const g = (await db.allGoals()).find((x) => x.id === "g-1")!;
    expect(g.updatedAt).toBe(1000);
    expect(g.content).toEqual(blob(9));
  });

  it("propagates a tombstone through sync", async () => {
    const db = await import("./db");
    const { push, pull } = await import("./sync");

    await db.putFoodLog({ id: "f-1", at: 1, createdAt: 1, updatedAt: 1, deleted: false, dirty: true, content: blob(1) });
    await push("t");
    await db.putFoodLog({ id: "f-1", at: 1, createdAt: 1, updatedAt: 2, deleted: true, dirty: true, content: blob(1) });
    await push("t");

    await wipeLocal();
    await pull("t");
    const raw = await openDB("hearth", 1);
    const got = await raw.get("foodLogs", "f-1");
    raw.close();
    expect(got!.deleted).toBe(true);
  });
});
