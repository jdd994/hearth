import { describe, it, expect } from "vitest";
import {
  ZERO, scale, add, sum, windowTotal, dayBounds, goalProgress,
  type Nutrients, type FoodLog, type Goal,
} from "./nutrition";

// A compact helper to build a partial Nutrients (rest zero).
function n(partial: Partial<Nutrients>): Nutrients {
  return { ...ZERO, ...partial };
}

describe("scale", () => {
  it("scales per-100g values to an amount", () => {
    const oatsPer100 = n({ kcal: 389, protein: 16.9, carbs: 66.3, fibre: 10.6 });
    const half = scale(oatsPer100, 50); // 50g
    expect(half.kcal).toBeCloseTo(194.5, 3);
    expect(half.protein).toBeCloseTo(8.45, 3);
    expect(half.fibre).toBeCloseTo(5.3, 3);
  });
  it("scales up past 100g", () => {
    expect(scale(n({ kcal: 100 }), 250).kcal).toBeCloseTo(250, 6);
  });
  it("zero grams is all zero", () => {
    expect(scale(n({ kcal: 500 }), 0).kcal).toBe(0);
  });
});

describe("add / sum", () => {
  it("adds nutrient vectors component-wise", () => {
    const r = add(n({ kcal: 100, protein: 5 }), n({ kcal: 50, protein: 3, iron: 2 }));
    expect(r.kcal).toBe(150);
    expect(r.protein).toBe(8);
    expect(r.iron).toBe(2);
  });
  it("sums a list, empty = zero", () => {
    expect(sum([]).kcal).toBe(0);
    expect(sum([n({ kcal: 10 }), n({ kcal: 20 }), n({ kcal: 5 })]).kcal).toBe(35);
  });
});

describe("windowTotal / dayBounds", () => {
  const mk = (at: string, kcal: number, grams = 100): FoodLog => ({
    id: at, at: new Date(at).getTime(), foodId: "x", name: "x",
    amountGrams: grams, per100g: n({ kcal }),
  });

  it("totals only logs inside the window", () => {
    const now = new Date("2026-07-14T13:00:00").getTime();
    const { from, to } = dayBounds(now);
    const logs = [
      mk("2026-07-14T08:00:00", 300), // today
      mk("2026-07-14T12:30:00", 500), // today
      mk("2026-07-13T22:00:00", 999), // yesterday, excluded
    ];
    expect(windowTotal(logs, from, to).kcal).toBe(800);
  });

  it("respects the logged amount when totalling", () => {
    const now = new Date("2026-07-14T13:00:00").getTime();
    const { from, to } = dayBounds(now);
    // 200g of a 100-kcal/100g food = 200 kcal
    const logs = [mk("2026-07-14T09:00:00", 100, 200)];
    expect(windowTotal(logs, from, to).kcal).toBe(200);
  });
});

describe("goalProgress — calm, never pass/fail", () => {
  const today = n({ protein: 60, sugars: 40, kcal: 1800 });

  it("atLeast: under target reads 'under', met reads 'on'", () => {
    const g: Goal = { id: "1", name: "Protein", nutrient: "protein", amount: 100, direction: "atLeast" };
    const p = goalProgress(g, today);
    expect(p.current).toBe(60);
    expect(p.fraction).toBeCloseTo(0.6, 5);
    expect(p.tone).toBe("under");
    expect(goalProgress(g, n({ protein: 120 })).tone).toBe("on");
  });

  it("atMost: within is 'on', over is 'over'", () => {
    const g: Goal = { id: "2", name: "Sugar ceiling", nutrient: "sugars", amount: 50, direction: "atMost" };
    expect(goalProgress(g, today).tone).toBe("on"); // 40 <= 50
    expect(goalProgress(g, n({ sugars: 70 })).tone).toBe("over");
  });

  it("fraction clamps at 1 and never NaN", () => {
    const g: Goal = { id: "3", name: "Cal", nutrient: "kcal", amount: 2000, direction: "target" };
    expect(goalProgress(g, n({ kcal: 3000 })).fraction).toBe(1);
    const zeroTarget: Goal = { ...g, amount: 0 };
    expect(goalProgress(zeroTarget, today).fraction).toBe(0);
  });
});
