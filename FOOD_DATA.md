# Food data — the crux

A private, search-based nutrition app lives or dies on its food/nutrient
database. This is the plan for where that data comes from, kept honest by the same
trust-ladder thinking as Ballast's accounts. None of this is built yet.

## The requirement

To log "1 cup of oats" and show what's in it, we need **nutrient composition per
food** — calories, macros, and key micros per unit weight. Two shapes of food:

- **Whole/generic foods** ("oats", "banana", "chicken breast") — stable, finite,
  perfect to **bundle** and look up offline.
- **Packaged/branded products** (a specific cereal box) — a huge, changing
  long-tail best resolved by **barcode**, on demand.

## Status

**Tier 0 (USDA) is DONE (2026-07-14).** `scripts/build-food-db.py` turns the SR
Legacy CSV into `public/foods.json` — ~7,800 whole foods, 914 KB (251 KB
gzipped), precached so search is fully offline. The small hand seed stays for its
friendly portions and is searched first. Tier 1 (barcodes) and tier 2 (photo
recognition) are still ahead. Known nicety for later: search has no stemming, so
"sardines" misses "Fish, sardine, …" — search the singular for now.

## Tier 0 — bundle USDA FoodData Central (whole foods)

[FoodData Central](https://fdc.nal.usda.gov/) is US-government data, **public
domain** — free to ship and redistribute, no attribution required (we'll credit it
anyway). It's the gold standard for whole-food nutrients.

Its datasets:
- **Foundation Foods** + **SR Legacy** — thousands of generic whole foods with
  full nutrient profiles. **This is our core.** Curate a subset of the common
  foods a person actually eats, trim to the nutrients we display, and **ship it
  with the app** (a static, compressed asset loaded into IndexedDB on first run).
- **Branded Foods** — ~1M+ packaged products. Too big to bundle; overlaps Open
  Food Facts. Skip for tier 0; barcodes cover this in tier 1.

**Why bundling matters:** a lookup against bundled data is **fully offline and
fully private** — nobody learns what you searched, let alone ate. That's tier 0,
the airtight rung, and it's the default path.

**Prep (a build/prep script, run occasionally, output committed as a data asset):**
1. Download the FDC Foundation + SR Legacy datasets (CSV/JSON).
2. Filter to a curated common-foods set (keep it a few MB, not the whole DB).
3. Reduce each food to `{ id, name, portions, nutrients }` for the nutrient set
   below; drop the rest.
4. Compress (gzip/JSON-min, or a compact columnar form). Ship as a static asset;
   hydrate into an IndexedDB store on first run so search is instant + offline.
5. Client-side search (name match) over that store — no network, no server.

Keep the prep script + a note of the FDC release version in `scripts/`, so the
dataset can be refreshed deliberately (like Driftless's `fetch-fonts.md`).

## Tier 1 — Open Food Facts (barcodes / packaged goods)

[Open Food Facts](https://world.openfoodfacts.org/) is an open, crowdsourced
database of packaged products with a free API and barcode lookup. Data under
**ODbL** (attribute + share-alike on the data) — compatible with our AGPL app;
we'll attribute it.

- On a barcode scan, query OFF for that product's nutrition facts.
- **The honest leak:** the request tells OFF *a barcode was looked up* (plus IP).
  It never learns who you are or your day's intake. That's tier 1 — the same
  shape as a crypto-address lookup in Ballast. Disclose it where the user scans.
- Adding `world.openfoodfacts.org` (or the API host) to `connect-src` in the CSP
  is a **trust-ladder decision, not a config tweak** — it's the app's first
  outbound host. Review it deliberately.
- Optional later: cache resolved products locally so a repeat scan is offline;
  optionally let a user point at a self-hosted OFF mirror to close the leak.

## Tier 2 — the FoodRecognizer seam (photo → food)

See `recognize.ts` and CLAUDE.md. A photo of a meal is the highest-friction-saving
and highest-trust-cost input. The seam is empty today; it becomes real only with
an **on-device** model or **explicit per-use consent** to a cloud recognizer.
Even then it only ever needs to output a *food name + amount*, which the tier-0/1
data then resolves — so the smart part (nutrients) stays local. Never a valid
implementation if it ships the photo silently.

## Not used — commercial nutrition APIs

Nutritionix, Edamam, Spoonacular, etc. have great coverage and natural-language
parsing, but they **see every query** and **cost money per call**. That's the
extraction model Hearth exists to avoid. Not used.

## The nutrient set (v1)

Track a useful-but-not-overwhelming set; more is not kinder.

- **Energy** (kcal)
- **Macros:** protein, carbohydrate (of which sugars, fibre), fat (of which
  saturated)
- **Key micros:** sodium, potassium, calcium, iron, vitamin C, vitamin D
  (extend later; keep the schema open)

Store nutrients per 100 g (USDA's basis) and scale by the logged amount.

## Data model (sketch — refine in code)

```ts
// A food in the database (bundled USDA or a resolved OFF product).
type Food = {
  id: string;           // "usda:170285" | "off:<barcode>" | "custom:<uuid>"
  name: string;
  source: "usda" | "off" | "custom";
  portions: { label: string; grams: number }[]; // "1 cup" → 240g, etc.
  per100g: NutrientVector;                        // the nutrient set above
};

// A logged item (what the user ate) — ENCRYPTED content.
type FoodLogContent = {
  foodId: string;       // resolves to a Food (bundled) or embeds a custom one
  name: string;         // denormalised so a log survives DB refreshes
  amountGrams: number;
  per100g: NutrientVector; // snapshotted, so historical logs never shift if data updates
  at: number;           // plaintext metadata (like Ballast) for cheap day-windowing
};
```

Snapshot the nutrients onto the log so a later database refresh never silently
rewrites your history — the same "an unknown is not a zero / don't rewrite the
past" honesty as Ballast.

## Licensing / attribution

- **USDA FDC:** public domain (US-gov). No obligation; credit it in an About/credits
  note as good manners.
- **Open Food Facts:** ODbL (data) + CC-BY-SA (content). Attribute OFF and note
  the licence where its data is shown. Compatible with the AGPL app.
