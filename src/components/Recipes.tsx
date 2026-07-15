// Recipes.tsx
// A recipe is a named ingredient list split into servings. Its whole point here:
// cooking one is a one-tap log of a serving — no re-entering what's in it. Built
// on the same food search and nutrition math as everything else.

import { useEffect, useMemo, useState } from "react";
import { searchFoods, foodDbReady } from "../lib/fooddata";
import {
  recipePerServing, recipeServingGrams, type Food, type Recipe,
  type RecipeContent, type RecipeIngredient,
} from "../lib/nutrition";

export function Recipes({
  recipes, busy, onCook, onRemove,
}: {
  recipes: Recipe[];
  busy: boolean;
  onCook: (r: Recipe) => void;
  onRemove: (id: string) => void;
}) {
  if (recipes.length === 0) {
    return (
      <div className="empty">
        No recipes yet.
        <br />
        Save something you cook often — then logging it is a single tap.
      </div>
    );
  }
  return (
    <div>
      {recipes.map((r) => {
        const per = recipePerServing(r);
        return (
          <div className="recipe" key={r.id}>
            <div className="recipe-main">
              <div className="recipe-name">{r.name}</div>
              <div className="recipe-meta">
                {r.servings} serving{r.servings === 1 ? "" : "s"} · {Math.round(per.kcal)} kcal ·{" "}
                {per.protein.toFixed(1)}g protein per serving
              </div>
            </div>
            <button className="btn btn-sm btn-primary" disabled={busy} onClick={() => onCook(r)} title="Log one serving">
              Cook
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => onRemove(r.id)} title="Remove">×</button>
          </div>
        );
      })}
    </div>
  );
}

export function AddRecipe({
  onAdd, onClose,
}: {
  onAdd: (c: RecipeContent) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [servings, setServings] = useState(2);
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState<Food | null>(null);
  const [grams, setGrams] = useState(100);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => { void foodDbReady.then(() => setReady(true)); }, []);

  const results = useMemo(() => searchFoods(query), [query, ready]);
  const perServing = useMemo(
    () => recipePerServing({ name, servings, ingredients }),
    [name, servings, ingredients]
  );

  function addIngredient() {
    if (!pending) return;
    setIngredients((prev) => [
      ...prev,
      { foodId: pending.id, name: pending.name, grams, per100g: pending.per100g },
    ]);
    setPending(null);
    setQuery("");
    setGrams(100);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Give the recipe a name.");
    if (ingredients.length === 0) return setError("Add at least one ingredient.");
    await onAdd({ name: name.trim(), servings: Math.max(1, servings), ingredients });
    onClose();
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h3>New recipe</h3>
        <form onSubmit={save}>
          {error ? <div className="error">{error}</div> : null}
          <div className="row">
            <label className="field">
              <span className="label">Name</span>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Porridge" autoFocus />
            </label>
            <label className="field">
              <span className="label">Servings</span>
              <input type="number" min={1} value={servings} onChange={(e) => setServings(Math.max(1, Number(e.target.value) || 1))} />
            </label>
          </div>

          {/* current ingredients */}
          {ingredients.length > 0 ? (
            <div className="ingredients">
              {ingredients.map((i, idx) => (
                <div className="ingredient" key={idx}>
                  <span>{i.name}</span>
                  <span className="ing-g">{i.grams} g</span>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setIngredients((p) => p.filter((_, x) => x !== idx))}>×</button>
                </div>
              ))}
            </div>
          ) : null}

          {/* add an ingredient */}
          {!pending ? (
            <label className="field">
              <span className="label">Add an ingredient</span>
              <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search a food…" />
              {query ? (
                <div className="results" style={{ marginTop: 6 }}>
                  {results.length === 0 ? (
                    <p className="hint" style={{ padding: "8px 2px" }}>No matches — try a simpler name.</p>
                  ) : (
                    results.slice(0, 8).map((f) => (
                      <button type="button" key={f.id} className="result" onClick={() => { setPending(f); setGrams(f.portions[0]?.grams ?? 100); }}>
                        <span className="result-name">{f.name}</span>
                        <span className="result-kcal">{Math.round(f.per100g.kcal)} kcal/100g</span>
                      </button>
                    ))
                  )}
                </div>
              ) : null}
            </label>
          ) : (
            <div className="field">
              <span className="label">{pending.name} — how much?</span>
              <div className="row" style={{ alignItems: "flex-end" }}>
                <input type="number" min={1} value={grams} onChange={(e) => setGrams(Math.max(1, Number(e.target.value) || 0))} />
                <button type="button" className="btn btn-primary" style={{ flex: "0 0 auto" }} onClick={addIngredient}>Add</button>
                <button type="button" className="btn btn-ghost" style={{ flex: "0 0 auto" }} onClick={() => setPending(null)}>Cancel</button>
              </div>
            </div>
          )}

          {ingredients.length > 0 ? (
            <p className="hint" style={{ marginTop: 4 }}>
              Per serving ≈ {Math.round(perServing.kcal)} kcal · {perServing.protein.toFixed(1)}g protein ·{" "}
              {Math.round(recipeServingGrams({ name, servings, ingredients }))} g
            </p>
          ) : null}

          <div className="sheet-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save recipe</button>
          </div>
        </form>
      </div>
    </div>
  );
}
