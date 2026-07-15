# Hearth

**Tend and nourish yourself, gently.**

A personal nutrition and wellbeing app that is local-first and end-to-end
encrypted. What you eat, your weight, your goals — all encrypted on your device
before they're stored anywhere. Not "encrypted in transit" — encrypted so that we
could not read it if we wanted to, and a breach of any server would yield nothing
but noise.

The name is deliberate: a **hearth** is the warm centre of a home, where food is
made and people gather — nourishment and care, not a clinical calorie ledger.
"Hearth" even hides *heart* (the love you put in) and *earth* (grounding, whole
food). Third sibling to [Driftless](https://driftless.page) and
[Ballast](https://ballast.gold). Same soul, different corner of a life.

**→ [hearth.garden](https://hearth.garden)** — open it and add it to your home
screen (see below). No sign-up, nothing to install from a store.

> **Local-only for now.** Hearth lives entirely on the device you open it on;
> each device keeps its own private vault. Cross-device sync — and, later,
> co-authored *shared* recipes/meal-plans with someone you love — is the next
> chapter (the model is already proven in Driftless, and Hearth's vault bakes in
> an identity keypair from day one precisely for it). Until then, your data stays
> on one device.

---

## What it does

- **See your day.** Log what you eat and see it add up — energy and macros up
  front, the micronutrients a tap away. Shown calmly; never a red "over budget",
  never a verdict.
- **Real food data, fully private.** Search ~7,800 whole foods from USDA
  FoodData Central. The database ships *with* the app, so lookups are completely
  offline — no provider ever learns what you searched, let alone ate.
- **Recipes.** Save something you cook, and logging it later is a single tap
  ("Cook" logs one serving). A recipe is just an ingredient list — the same data
  the tracker already understands.
- **Body, gently.** Track weight (and other measurements) over time as a soft
  line, watched like a garden through the seasons. No BMI, no "ideal weight", no
  shame — your own number, shown as a plain fact.
- **Your goals, not ours.** Set what *you* care about — a protein floor, a gentle
  calorie aim. Standard daily values are available only as an optional reference,
  off by default, clearly labelled "a rough guide, not a verdict."

## What it's for

Diet culture runs on shame and comparison — red numbers, "bad" foods, streaks,
bodies measured against a norm. That machinery makes people feel worse and eat
worse. Hearth refuses all of it: **awareness over judgement, compassion over
control.** It's here to make your relationship with food a little kinder and
clearer — and, when you don't need it, to get out of your way.

The motive underneath is simple: make something that helps, and be grateful
you're trusting it with something this personal.

## What it will never do

No ads. No analytics. **No shame, no "good/bad" foods, no streaks, no BMI, no
comparison to anyone.** No supplement or meal-plan affiliate sales. If you open
Hearth, see clearly, feel steadier, and then don't need it for a while — that's
it working exactly as intended.

## The food-data trust ladder

Every source of food data wears the honest cost of using it (the same idea as
Ballast's account trust ladder). Enforced by a Content Security Policy that lists
every host the app may contact (`public/_headers`) — there is no analytics host,
and nothing that could ever see what you eat.

| Tier | Source | Who learns what |
|---|---|---|
| **0** | Manual entry + bundled USDA whole foods | **Nobody.** Public-domain data, shipped with the app; lookups are fully offline. |
| **1** | Barcode lookup (Open Food Facts) | A provider learns *which barcode* you scanned — never who, never your day. *(not built yet)* |
| **2** | Photo → food recognition | A photo of your meal — so **on-device only, or explicit per-use consent**. *(a seam only)* |

## The trade

The key comes from your passphrase, and your passphrase never leaves your device.
So **there is no reset** — forget it and nothing can decrypt your data, not us,
not anyone. Keep it somewhere safe. That's the price of it being truly private.

## Install to your home screen

Open **[hearth.garden](https://hearth.garden)**, then:

- **iPhone/iPad (Safari):** Share → Add to Home Screen.
- **Android (Chrome):** menu → Install app / Add to Home Screen.
- **Desktop (Chrome/Edge):** the install icon in the address bar.

It launches full-screen like a native app and works offline.

## Running it locally

```bash
npm install
npm run dev       # http://localhost:5173
npm run test      # the nutrition math
npm run build
npm run deploy    # build + ship to Cloudflare Pages
```

The bundled food database (`public/foods.json`) is generated from USDA data by
`scripts/build-food-db.py` — see [FOOD_DATA.md](FOOD_DATA.md) to refresh it. The
architecture and invariants live in [CLAUDE.md](CLAUDE.md).

## How it's built

Vite + React + TypeScript. `idb` for IndexedDB. WebCrypto (AES-GCM, PBKDF2 at
600k iterations) for encryption — no crypto dependencies. A PWA, so it installs
and works offline. Nutrients are floats on purpose: the underlying data is
genuinely approximate, and false precision would be a lie.

## Licence

**AGPL-3.0**, the same as Driftless and Ballast. The licence does the same job as
the encryption: it makes the promise structural. A permissive licence would let
someone fork Hearth, bolt on supplement affiliate sales and shame mechanics, and
run it closed. The AGPL closes that door, including the network loophole. Use it,
run it, fork it, audit it — you just can't quietly turn it into the thing it was
built to be an alternative to.
