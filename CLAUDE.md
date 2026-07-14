# CLAUDE.md — Hearth

Context for Claude Code working in this repo. Read this first.

Third in a family with **Driftless** (`../driftless`, journaling) and **Ballast**
(`../ballast`, money). Same spine: local-first, end-to-end encrypted, no
analytics, no extraction, PWA. Where they overlap technically (crypto, IndexedDB,
vault/lock, biometric unlock, PWA shell, sync), **port the proven code from
Ballast/Driftless rather than reinventing it.** Ballast is the closest sibling
(dashboard + goals + a trust ladder) and the best starting point to copy.

## What this is

A personal nutrition and wellbeing app. One job: **help you see what you're
actually eating and feel steadier about it** — calmly, privately, without shame.
Log food, see the nutrients, notice your own trends, aim at goals *you* set. It
is local-first and end-to-end encrypted; what you eat is nobody's business but
yours.

The name is deliberate. A **hearth** is the warm centre of a home, where food is
made and people gather — nourishment and care, not a clinical calorie ledger.
Hold that feeling. This is the opposite of a diet app the way Driftless is the
opposite of a feed.

## Purpose (the north star)

**The north star is gratitude and helping people** (the root value under all three
apps — see the `north-star-gratitude` memory). Hearth exists to make someone's
relationship with food a little kinder and clearer, and to be grateful they let
it try. Not engagement, not weight-loss-at-any-cost, not streaks.

Diet culture is the thing to invert here, the way social media is for Driftless
and the affiliate-fintech model is for Ballast. Diet apps run on **shame and
comparison**: red numbers, "you're over," "bad" foods, a streak you broke, a body
measured against a norm. That machinery makes people feel worse and eat worse, and
Hearth refuses all of it.

- **Awareness over judgement.** Show people what they ate and what's in it,
  clearly. Clarity is the product. Never a verdict.
- **Compassion over control.** No "good/bad" foods, no shame, no punishment, no
  guilt-tripping nudges. A person who feels bad about food opens the app less and
  eats worse. Kindness is not a nicety here; it's the mechanism.
- **You name the goal; we tell you the truth.** A goal is *yours* — a habit, a
  protein floor, a gentle deficit you chose. Hearth reports honestly on your own
  trajectory toward *your* target. It never sets the target for you.
- **No scoreboard, no bodies to measure against.** No "people like you," no
  before/after theatre, no BMI shaming.

Filter every feature through: *does this deepen someone's calm, honest awareness
of their own eating — or does it sneak in shame, comparison, or diet-culture
pressure?* If the latter, don't build it, no matter how normal it is for a
nutrition app. **Never** add: calorie-shaming, "good/bad" food labels, streaks,
public metrics, weight-loss leaderboards, before/after prompts, guilt nudges,
ads, analytics, or affiliate supplement/meal-plan sales.

### The line on targets & "recommended daily values"

The user was explicit: *"I don't like the comparison too much."* So:

- ✅ **Your goals, front and centre.** You set them; Hearth tracks your pace,
  honestly — same as Ballast's "you name the target."
- ✅ **Standard daily values (RDAs) available as *reference*, not a verdict** —
  clearly labelled as a rough guide, and **off by default**. A curiosity you can
  switch on, never a bar you're failing against.
- ❌ Never RDAs shoved in your face as pass/fail. Never "you only got 60% of your
  iron" in red. Reference, not report card.

## Design intent (don't flatten this)

- The feeling is a **warm hearth**: amber/ember warmth, calm, homely. Not
  clinical, not sporty-neon, not diet-app red-and-green. (Driftless is lamplight;
  Ballast is deep water; Hearth is firelight. Pick tokens in that spirit.)
- **No red "over budget" colouring.** Numbers are information, shown calmly.
  Nothing about food is rendered as alarm.
- **Food is never labelled good or bad.** The UI has no vocabulary for it.
- System-native fonts (like Ballast) so `font-src 'self'` stays absolute — no
  font CDN. (Learn from Driftless's font bug: never `@import` a webfont under a
  strict CSP.) Tabular numerals where numbers live.
- Inline SVG for icons, never Unicode glyphs (they tofu on system-font stacks —
  Ballast learned this).

## Stack

- Vite + React 18 + TypeScript, `idb` for IndexedDB, WebCrypto (AES-GCM +
  PBKDF2 @ 600k) for encryption — no crypto dependencies — `vite-plugin-pwa`.
  Vitest for the pure nutrition math.
- No analytics. No third-party scripts. Ever.

## Architecture (planned — mirrors Ballast)

- `src/lib/crypto.ts` — **port from Ballast.** Passphrase → AES-GCM key;
  `sealJSON`/`openJSON` as the only doors between plaintext and storage. Identity
  keypair from day one (for future household/family sharing — a shared meal plan
  is the analogue of a shared strand).
- `src/lib/db.ts` — IndexedDB. Stores: `vault`, `foods` (a logged item: what +
  when + amount + resolved nutrients), `recipes` (named ingredient lists),
  `metrics` (body metrics — weight etc., **next**), `goals`, `sync`, `device`.
  Every record `{ id, createdAt, updatedAt, deleted, dirty, content: CipherBlob }`
  — plaintext bookkeeping, encrypted everything-else.
- `src/lib/nutrition.ts` — **pure.** Nutrient math: sum a day's intake, scale a
  food by amount, roll a recipe's ingredients into per-serving nutrients, goal
  progress. Exact where it needs to be. Unit-tested. Add logic here by preference.
- `src/lib/fooddata/*` — the food/nutrient database layer + connectors. Each
  source declares its **trust tier** (see below and FOOD_DATA.md).
- `src/lib/recognize.ts` — the **FoodRecognizer seam** (see below). Empty today.
- `src/hooks/useHearth.ts` — the ONLY place state, IO, and the key meet.
- `src/components/*` — presentational.

### The food-data trust ladder

Same idea as Ballast's account trust ladder — every food source wears the honest
cost of using it. **Full plan: FOOD_DATA.md.**

| Tier | Source | Who learns what |
|---|---|---|
| 0 | **Manual entry** + **bundled USDA FoodData Central** (whole foods) | **Nobody.** Public-domain data shipped with the app; lookups are fully offline. |
| 1 | **Open Food Facts** barcode lookup (packaged goods) | The provider learns *a barcode was scanned* — never who, never your day. |
| 2 | **AI photo recognition** (the `FoodRecognizer` seam) | A photo of your meal — so **on-device only, or explicit per-use consent.** Off by default. |
| — | Commercial nutrition APIs (Nutritionix, Edamam…) | They see every query and cost money. **Not used** — against the soul. |

### The FoodRecognizer seam (`recognize.ts`)

Same pattern as Ballast's `ReceiptReader`. Photographing a plate and having it
identify the food is genuinely desirable, and genuinely dangerous by default —
it means sending pictures of your meals somewhere. So today the seam does
**nothing**; the UI logs food by search/barcode. The seam exists so that when a
good **on-device** vision model is cheap, or the user gives **explicit,
per-use consent** to a cloud recognizer, it plugs in and the logging UI
pre-fills — changing one file, not the app. A recognizer that ships a photo off
the device silently is never a valid implementation. The CSP enforces it.

### Invariants — please preserve

1. Plaintext (what you ate, your weight, your goals) never reaches storage, logs,
   or the network. Only ciphertext leaves memory. Everything via `sealJSON`/`openJSON`.
2. The key stays in memory only — a ref in `useHearth`, never React state, never
   persisted (except the device-local biometric wrap).
3. **No shame, no comparison, no "good/bad" food** — an invariant, not a
   preference. The UI must have no way to express it.
4. **A photo of your food never leaves the device** without explicit consent or
   an on-device model. See `recognize.ts`.
5. **Auth and encryption stay separate** (when sync lands) — same as the siblings:
   the account says whose ciphertext this is; the passphrase decrypts it and never
   leaves the device. A server breach yields only ciphertext.
6. **RDAs are reference, never a verdict**, and off by default.

## Conventions

- TypeScript strict on. Pure logic → `lib/`. State/IO → the hook. Components
  presentational.
- Copy is warm, plain, second person. Never scold anyone about food. Errors say
  what happened and what to do.

## Licence

**AGPL-3.0**, same as Driftless and Ballast. The licence does the same job as the
encryption: it makes the promises structural. A permissive licence would let
someone fork Hearth, bolt on supplement affiliate sales and shame mechanics, and
run it closed. The AGPL closes that door, including the network loophole. Do not
change it.

## Roadmap

1. **Vault + food logging core.** Port the Ballast crypto/db/lock/welcome
   foundation. Bundle a curated USDA subset; search + log a food; see a day's
   nutrients. (First milestone — see FOOD_DATA.md for the data prep.)
2. **Recipes.** Named ingredient lists that roll up into per-serving nutrients;
   cooking a saved recipe = a one-tap log. (A recipe is the same structured data
   the tracker needs — build the food core so recipes fall out of it.)
3. **Body metrics.** Simple encrypted weight/measurements log, charted over time.
   Calm, no BMI-shaming. (Explicitly next, per the user.)
4. **Barcodes (tier 1).** Open Food Facts lookup for packaged goods. Add its
   origin to `connect-src`; that's a trust-ladder decision, not a config tweak.
5. **Sync.** Port the Driftless/Ballast model (Cloudflare Workers + D1, opaque
   ciphertext, LWW). Records already carry `deleted`/`dirty` + an identity key,
   built for it. Bake in the HARDENING.md protections (quotas, rate limits) from
   the first server commit.
6. **Later / maybe:** wearables (Apple Health / Google Fit — a new data-source
   trust tier; big, fiddly, per-platform); exercise (possibly a separate app);
   the FoodRecognizer becoming real; household/shared meal plans (uses the
   identity keys, like shared strands).

## Watch out for

- StrictMode double-invokes effects in dev — keep them idempotent.
- IndexedDB is async; the hook updates memory optimistically then persists. Keep
  that order so logging feels instant.
- Never introduce diet-culture affordances "because every nutrition app has
  them." Re-read the north star.
- Don't add analytics or any third-party script that could see what someone eats.
