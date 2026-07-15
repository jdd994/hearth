// LogFood.tsx
// Search the bundled food database, pick a portion (or type grams), log it.
// Fully local — the provider-learns-nothing rung. The camera/recognize seam is
// noted for later; today it's search-first.

import { useEffect, useMemo, useState } from "react";
import { searchFoods, foodDbReady } from "../lib/fooddata";
import { scale, type Food } from "../lib/nutrition";

export function LogFood({
  busy, onLog, onClose,
}: {
  busy: boolean;
  onLog: (food: Food, grams: number, note?: string) => Promise<void>;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Food | null>(null);
  const [grams, setGrams] = useState<number>(100);
  const [note, setNote] = useState("");
  const [ready, setReady] = useState(false);
  useEffect(() => { void foodDbReady.then(() => setReady(true)); }, []);

  const results = useMemo(() => searchFoods(query), [query, ready]);

  function pick(food: Food) {
    setPicked(food);
    setGrams(food.portions[0]?.grams ?? 100);
  }

  const preview = picked ? scale(picked.per100g, grams) : null;

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        {!picked ? (
          <>
            <h3>What did you eat?</h3>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search — oats, banana, chicken…"
              autoFocus
            />
            <div className="results">
              {query && results.length === 0 ? (
                <p className="hint" style={{ padding: "10px 2px" }}>
                  No matches — try a simpler or different name (e.g. "rice", "chicken breast").
                  Barcode scanning for packaged foods is coming.
                </p>
              ) : (
                results.map((f) => (
                  <button key={f.id} className="result" onClick={() => pick(f)}>
                    <span className="result-name">{f.name}</span>
                    <span className="result-kcal">{Math.round(f.per100g.kcal)} kcal/100g</span>
                  </button>
                ))
              )}
            </div>
            <div className="sheet-actions">
              <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            </div>
          </>
        ) : (
          <>
            <h3>{picked.name}</h3>

            <span className="label">How much?</span>
            <div className="portions">
              {picked.portions.map((p) => (
                <button
                  key={p.label}
                  className="portion"
                  aria-pressed={grams === p.grams}
                  onClick={() => setGrams(p.grams)}
                >
                  {p.label} · {p.grams}g
                </button>
              ))}
            </div>

            <label className="field">
              <span className="label">…or grams</span>
              <input
                type="number"
                min={1}
                value={grams}
                onChange={(e) => setGrams(Math.max(1, Number(e.target.value) || 0))}
              />
            </label>

            {preview ? (
              <p className="hint" style={{ marginTop: -6, marginBottom: 14 }}>
                ≈ {Math.round(preview.kcal)} kcal · {preview.protein.toFixed(1)}g protein ·{" "}
                {preview.carbs.toFixed(1)}g carbs · {preview.fat.toFixed(1)}g fat
              </p>
            ) : null}

            <label className="field">
              <span className="label">Note (optional)</span>
              <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="with breakfast…" />
            </label>

            <div className="sheet-actions">
              <button className="btn btn-ghost" onClick={() => setPicked(null)}>Back</button>
              <button
                className="btn btn-primary"
                disabled={busy || grams < 1}
                onClick={async () => { await onLog(picked, grams, note.trim() || undefined); onClose(); }}
              >
                {busy ? "Logging…" : "Log it"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
