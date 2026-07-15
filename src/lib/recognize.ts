// recognize.ts
// The seam where "photograph a meal → what did I eat" will one day plug in — and,
// today, doesn't. Same pattern as Ballast's receipt.ts.
//
// ## Why this exists while doing nothing
//
// Snapping a plate and having the food identified is the single most friction-
// saving input, and the single most trust-costly one: it means sending pictures
// of your meals somewhere. So today Hearth logs food by search (bundled, private).
// The seam exists so that when the trade-off changes, ONE file changes:
//
//   - a good **on-device** vision model becomes cheap (WASM/WebGPU), or
//   - the user gives **explicit, per-use consent** to a cloud recognizer.
//
// A recognizer only ever needs to output a food NAME + amount; the nutrients are
// then resolved locally from the bundled/USDA data — so the smart, private part
// stays on-device regardless. A recognizer that ships a photo off the device
// silently is never a valid implementation, and the CSP would block it anyway.
//
// See CLAUDE.md invariant #4.

export type FoodDraft = { name: string; amountGrams?: number };

export type FoodRecognizer = {
  name: string;
  available: () => Promise<boolean>;
  // Must be pure-local (or explicitly consented). Returns candidate foods to
  // confirm — never auto-logs.
  recognize: (image: Blob) => Promise<FoodDraft[]>;
};

// Today's recognizer: honest about knowing nothing.
export const noRecognizer: FoodRecognizer = {
  name: "none",
  available: async () => false,
  recognize: async () => [],
};

let active: FoodRecognizer = noRecognizer;

export function setFoodRecognizer(r: FoodRecognizer): void {
  active = r;
}

export function activeRecognizer(): FoodRecognizer {
  return active;
}

// Called by the logging flow. Returns [] today, so the UI just opens to search —
// exactly as if this weren't here. The day it returns candidates, nothing
// downstream needs rewriting.
export async function recognizeFood(image: Blob): Promise<FoodDraft[]> {
  try {
    if (!(await active.available())) return [];
    return await active.recognize(image);
  } catch {
    return [];
  }
}
