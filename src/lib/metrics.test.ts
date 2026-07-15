import { describe, it, expect } from "vitest";
import { series, latest, change, chartPoints, toCanonical, type Metric } from "./metrics";

const mk = (at: string, value: number, unit = "kg"): Metric => ({
  id: at, at: new Date(at).getTime(), kind: "weight", value, unit,
});

describe("metrics", () => {
  it("orders a series oldest → newest and finds the latest", () => {
    const ms = [mk("2026-07-10", 80), mk("2026-07-14", 78.5), mk("2026-07-12", 79.2)];
    const s = series(ms, "weight");
    expect(s.map((m) => m.value)).toEqual([80, 79.2, 78.5]);
    expect(latest(ms, "weight")!.value).toBe(78.5);
  });

  it("net change is latest minus first, in the latest unit", () => {
    const ms = [mk("2026-07-01", 82), mk("2026-07-14", 79.5)];
    expect(change(ms, "weight")).toEqual({ delta: -2.5, unit: "kg" });
  });

  it("stays quiet with fewer than two readings", () => {
    expect(change([mk("2026-07-14", 80)], "weight")).toBeNull();
    expect(change([], "weight")).toBeNull();
  });

  it("mixes units honestly: kg then lb sit on one scale", () => {
    // 80 kg, then 176.37 lb (== 80 kg) → net change ≈ 0
    const ms = [mk("2026-07-01", 80, "kg"), mk("2026-07-14", 176.37, "lb")];
    const c = change(ms, "weight")!;
    expect(c.unit).toBe("lb");
    expect(c.delta).toBeCloseTo(0, 1);
  });

  it("converts lb to canonical kg", () => {
    expect(toCanonical(220.462, "weight", "lb")).toBeCloseTo(100, 2);
  });

  it("chart points come out in the latest display unit", () => {
    const ms = [mk("2026-07-01", 80, "kg"), mk("2026-07-14", 170, "lb")];
    const pts = chartPoints(ms, "weight");
    expect(pts).toHaveLength(2);
    // first point (80 kg) rendered in lb ≈ 176.4
    expect(pts[0].value).toBeCloseTo(176.37, 1);
    expect(pts[1].value).toBeCloseTo(170, 5);
  });
});
