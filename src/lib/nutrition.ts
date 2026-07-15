// nutrition.ts
// Pure, IO-free nutrition logic. No storage, no network, no React.
//
// A deliberate contrast with Ballast's money.ts: there, money is an exact integer
// count of minor units, because a cent of drift destroys trust. HERE, nutrients
// are floats — because the underlying data is *inherently* approximate (USDA
// values are population averages; a "medium banana" is an estimate; you ate
// "about a cup"). Pretending otherwise would be false precision. So we compute in
// floats and round only for display, and the app's copy never implies more
// accuracy than the data has.

// The nutrient set we track. More is not kinder — a wall of 40 micronutrients is
// its own kind of pressure. Kept small and useful; the schema is open to extend.
export type Nutrients = {
  kcal: number; // energy, kilocalories
  protein: number; // g
  carbs: number; // g
  sugars: number; // g (of which)
  fibre: number; // g
  fat: number; // g
  satFat: number; // g (of which)
  sodium: number; // mg
  potassium: number; // mg
  calcium: number; // mg
  iron: number; // mg
  vitC: number; // mg
  vitD: number; // µg
};

export const NUTRIENT_KEYS = [
  "kcal", "protein", "carbs", "sugars", "fibre", "fat", "satFat",
  "sodium", "potassium", "calcium", "iron", "vitC", "vitD",
] as const;

export type NutrientKey = keyof Nutrients;

// Display metadata: label, unit, decimals. Also which are the "headline" macros
// the dashboard leads with, vs. the micros shown on request.
export const NUTRIENT_META: Record<NutrientKey, { label: string; unit: string; dp: number; headline?: boolean }> = {
  kcal: { label: "Energy", unit: "kcal", dp: 0, headline: true },
  protein: { label: "Protein", unit: "g", dp: 1, headline: true },
  carbs: { label: "Carbs", unit: "g", dp: 1, headline: true },
  fat: { label: "Fat", unit: "g", dp: 1, headline: true },
  fibre: { label: "Fibre", unit: "g", dp: 1 },
  sugars: { label: "Sugars", unit: "g", dp: 1 },
  satFat: { label: "Saturated fat", unit: "g", dp: 1 },
  sodium: { label: "Sodium", unit: "mg", dp: 0 },
  potassium: { label: "Potassium", unit: "mg", dp: 0 },
  calcium: { label: "Calcium", unit: "mg", dp: 0 },
  iron: { label: "Iron", unit: "mg", dp: 1 },
  vitC: { label: "Vitamin C", unit: "mg", dp: 0 },
  vitD: { label: "Vitamin D", unit: "µg", dp: 1 },
};

export const ZERO: Nutrients = {
  kcal: 0, protein: 0, carbs: 0, sugars: 0, fibre: 0, fat: 0, satFat: 0,
  sodium: 0, potassium: 0, calcium: 0, iron: 0, vitC: 0, vitD: 0,
};

// Nutrients are stored per 100g (USDA's basis). Scale to an actual amount.
export function scale(per100g: Nutrients, grams: number): Nutrients {
  const f = grams / 100;
  const out = { ...ZERO };
  for (const k of NUTRIENT_KEYS) out[k] = per100g[k] * f;
  return out;
}

export function add(a: Nutrients, b: Nutrients): Nutrients {
  const out = { ...ZERO };
  for (const k of NUTRIENT_KEYS) out[k] = a[k] + b[k];
  return out;
}

export function sum(list: Nutrients[]): Nutrients {
  return list.reduce(add, { ...ZERO });
}

export function formatNutrient(key: NutrientKey, value: number): string {
  const m = NUTRIENT_META[key];
  const rounded = value.toFixed(m.dp);
  return `${Number(rounded).toLocaleString()} ${m.unit}`;
}

// ---- Foods -------------------------------------------------------------

export type Portion = { label: string; grams: number };
export type FoodSource = "seed" | "usda" | "off" | "custom";

export type Food = {
  id: string; // "seed:oats" | "usda:170285" | "off:<barcode>" | "custom:<uuid>"
  name: string;
  source: FoodSource;
  portions: Portion[]; // e.g. { label: "1 cup", grams: 240 }
  per100g: Nutrients;
};

// A logged item — the ENCRYPTED content of a food-log record. The nutrients are
// SNAPSHOTTED onto the log (not just a reference to the food), so refreshing the
// bundled database later never silently rewrites your history — the same
// "don't rewrite the past" honesty Ballast keeps.
export type FoodLogContent = {
  foodId: string;
  name: string; // denormalised, so a log is readable even if the food is gone
  amountGrams: number;
  per100g: Nutrients; // snapshot at log time
  note?: string;
};

export type FoodLog = FoodLogContent & { id: string; at: number };

export function loggedNutrients(log: FoodLogContent): Nutrients {
  return scale(log.per100g, log.amountGrams);
}

// Total for a set of logs within a time window [from, to).
export function windowTotal(logs: FoodLog[], from: number, to: number): Nutrients {
  return sum(logs.filter((l) => l.at >= from && l.at < to).map(loggedNutrients));
}

export function dayBounds(now: number): { from: number; to: number } {
  const d = new Date(now);
  const from = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return { from, to: from + 24 * 60 * 60 * 1000 };
}

// ---- Recipes -----------------------------------------------------------
// A recipe is a named list of ingredients (each a food + an amount) split into
// servings. It's the same structured data the tracker already consumes — which
// is the whole reason recipes belong in this app: cooking a saved recipe becomes
// a one-tap log of a serving, no re-entering anything.
//
// Each ingredient snapshots its per-100g nutrients (like a food log), so editing
// the food database later never silently rewrites a saved recipe.

export type RecipeIngredient = { foodId: string; name: string; grams: number; per100g: Nutrients };

export type RecipeContent = {
  name: string;
  ingredients: RecipeIngredient[];
  servings: number; // how many servings the whole recipe makes (>= 1)
};

export type Recipe = RecipeContent & { id: string };

export function recipeTotalGrams(r: RecipeContent): number {
  return r.ingredients.reduce((g, i) => g + i.grams, 0);
}

export function recipeTotalNutrients(r: RecipeContent): Nutrients {
  return sum(r.ingredients.map((i) => scale(i.per100g, i.grams)));
}

export function recipeServingGrams(r: RecipeContent): number {
  const servings = Math.max(1, r.servings);
  return recipeTotalGrams(r) / servings;
}

export function recipePerServing(r: RecipeContent): Nutrients {
  const servings = Math.max(1, r.servings);
  const total = recipeTotalNutrients(r);
  const out = { ...ZERO };
  for (const k of NUTRIENT_KEYS) out[k] = total[k] / servings;
  return out;
}

// Normalize the whole recipe to a per-100g vector, so a serving can be logged
// through the ordinary food-log path (loggedNutrients then reproduces the
// per-serving values exactly). Guards an empty recipe.
export function recipeAsFood(r: Recipe): Food {
  const grams = recipeTotalGrams(r);
  const total = recipeTotalNutrients(r);
  const per100g = { ...ZERO };
  if (grams > 0) for (const k of NUTRIENT_KEYS) per100g[k] = (total[k] / grams) * 100;
  return {
    id: r.id,
    name: r.name,
    source: "custom",
    portions: [{ label: "1 serving", grams: recipeServingGrams(r) }],
    per100g,
  };
}

// ---- Goals -------------------------------------------------------------
// YOUR targets, never a norm imposed on you. A goal is a nutrient, a number, and
// a direction. Progress is reported calmly — "you're at 60 of your 100g protein"
// — never as pass/fail, never in red. See CLAUDE.md: awareness over judgement.

export type GoalDirection = "atLeast" | "atMost" | "target";

export type GoalContent = {
  name: string;
  nutrient: NutrientKey;
  amount: number;
  direction: GoalDirection;
};

export type Goal = GoalContent & { id: string };

export type GoalProgress = {
  current: number;
  amount: number;
  fraction: number; // 0..1, clamped — for a calm progress bar
  // A gentle, non-judgemental read. `tone` is "on"/"over"/"under"/"neutral" for
  // subtle colour only; it is NEVER rendered as "good/bad".
  tone: "on" | "over" | "under" | "neutral";
};

export function goalProgress(goal: Goal, today: Nutrients): GoalProgress {
  const current = today[goal.nutrient];
  const amount = goal.amount;
  const fraction = amount <= 0 ? 0 : Math.min(1, current / amount);

  let tone: GoalProgress["tone"] = "neutral";
  if (goal.direction === "atLeast") {
    tone = current >= amount ? "on" : "under";
  } else if (goal.direction === "atMost") {
    tone = current <= amount ? "on" : "over";
  } else {
    // "target": near it is fine; only well past reads as "over" (gently).
    tone = current >= amount ? "on" : "under";
  }
  return { current, amount, fraction, tone };
}
