// fooddata/index.ts
// Looking up foods. Today this searches the bundled seed (tier 0, offline). Later
// it fans out to the full USDA import (also tier 0) and, on a barcode scan, to
// Open Food Facts (tier 1 — see FOOD_DATA.md). The search API stays the same;
// only the sources behind it grow.

import type { Food } from "../nutrition";
import { SEED_FOODS } from "./seed";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

// Name search, ranked: exact > starts-with > word-starts-with > contains. Purely
// local over the bundled data — the provider-learns-nothing rung.
export function searchFoods(query: string, limit = 20): Food[] {
  const q = norm(query);
  if (!q) return [];
  const scored: { food: Food; score: number }[] = [];
  for (const food of SEED_FOODS) {
    const name = norm(food.name);
    let score = 0;
    if (name === q) score = 100;
    else if (name.startsWith(q)) score = 80;
    else if (name.split(" ").some((w) => w.startsWith(q))) score = 60;
    else if (name.includes(q)) score = 40;
    if (score > 0) scored.push({ food, score });
  }
  return scored
    .sort((a, b) => b.score - a.score || a.food.name.localeCompare(b.food.name))
    .slice(0, limit)
    .map((s) => s.food);
}

const BY_ID = new Map(SEED_FOODS.map((f) => [f.id, f]));

export function foodById(id: string): Food | undefined {
  return BY_ID.get(id);
}
