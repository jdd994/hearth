// fooddata/index.ts
// Looking up foods. The bundled USDA database (public/foods.json, ~7,800 whole
// foods, SR Legacy) is the tier-0 source: it ships WITH the app and is precached,
// so search is fully offline and fully private — the provider-learns-nothing
// rung. The small hand-curated seed stays too, because its foods carry friendly
// portions ("1 cup", "1 medium") the raw USDA rows don't; it's searched first.
//
// Barcode lookup (Open Food Facts, tier 1) plugs in later without changing this
// API — see FOOD_DATA.md.

import { ZERO, type Food, type NutrientKey } from "../nutrition";
import { SEED_FOODS } from "./seed";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

// Loaded USDA foods (empty until foods.json arrives). Fire-and-forget on import so
// the fetch starts immediately; `foodDbReady` lets a component re-render when it's
// in (usually already done by the time anyone types).
let usdaFoods: Food[] = [];
let byId = new Map<string, Food>(SEED_FOODS.map((f) => [f.id, f]));

type CompactDb = { keys: string[]; foods: [string, string, number[]][] };

function decode(db: CompactDb): Food[] {
  return db.foods.map(([id, name, values]) => {
    const per100g = { ...ZERO };
    db.keys.forEach((k, i) => {
      per100g[k as NutrientKey] = values[i] ?? 0;
    });
    return { id: `usda:${id}`, name, source: "usda" as const, portions: [{ label: "100 g", grams: 100 }], per100g };
  });
}

export const foodDbReady: Promise<void> = (async () => {
  try {
    const res = await fetch("/foods.json");
    if (!res.ok) return;
    usdaFoods = decode(await res.json());
    byId = new Map([...SEED_FOODS, ...usdaFoods].map((f) => [f.id, f]));
  } catch {
    // offline before first load, or blocked — search just uses the seed until then.
  }
})();

// Name search, ranked: exact > starts-with > word-starts-with > contains. Seed
// foods first (curated names + portions), then the USDA long tail.
export function searchFoods(query: string, limit = 25): Food[] {
  const q = norm(query);
  if (!q) return [];
  const scored: { food: Food; score: number }[] = [];
  const consider = (food: Food, base: number) => {
    const name = norm(food.name);
    let score = 0;
    if (name === q) score = 100;
    else if (name.startsWith(q)) score = 80;
    else if (name.split(" ").some((w) => w.startsWith(q))) score = 60;
    else if (name.includes(q)) score = 40;
    if (score > 0) scored.push({ food, score: score + base });
  };
  for (const f of SEED_FOODS) consider(f, 5); // small nudge so curated foods lead
  for (const f of usdaFoods) consider(f, 0);
  return scored
    .sort((a, b) => b.score - a.score || a.food.name.localeCompare(b.food.name))
    .slice(0, limit)
    .map((s) => s.food);
}

export function foodById(id: string): Food | undefined {
  return byId.get(id);
}
