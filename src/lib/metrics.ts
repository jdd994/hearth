// metrics.ts
// Pure logic for body metrics — weight and a couple of measurements, tracked
// over time. The tone rule from CLAUDE.md is absolute here: this is your own
// number, watched gently, like a garden through the seasons. NEVER a BMI, never
// an "ideal weight", never a comparison to anyone, never a verdict. It just shows
// you your own trend, so you can notice it with compassion.

export type MetricKind = "weight" | "waist" | "bodyfat";

export const METRIC_META: Record<MetricKind, { label: string; units: string[]; canonical: string; dp: number }> = {
  weight: { label: "Weight", units: ["kg", "lb"], canonical: "kg", dp: 1 },
  waist: { label: "Waist", units: ["cm", "in"], canonical: "cm", dp: 1 },
  bodyfat: { label: "Body fat", units: ["%"], canonical: "%", dp: 1 },
};

export const METRIC_KINDS = Object.keys(METRIC_META) as MetricKind[];

export type MetricContent = { kind: MetricKind; value: number; unit: string; note?: string };
export type Metric = MetricContent & { id: string; at: number };

// Convert to/from each kind's canonical unit, so readings entered in kg and lb
// (or cm and in) sit on one honest scale for trend + charting.
export function toCanonical(value: number, kind: MetricKind, unit: string): number {
  if (kind === "weight" && unit === "lb") return value * 0.45359237;
  if (kind === "waist" && unit === "in") return value * 2.54;
  return value;
}
export function fromCanonical(value: number, kind: MetricKind, unit: string): number {
  if (kind === "weight" && unit === "lb") return value / 0.45359237;
  if (kind === "waist" && unit === "in") return value / 2.54;
  return value;
}

// Readings of a kind, oldest → newest.
export function series(metrics: Metric[], kind: MetricKind): Metric[] {
  return metrics.filter((m) => m.kind === kind).sort((a, b) => a.at - b.at);
}

export function latest(metrics: Metric[], kind: MetricKind): Metric | undefined {
  const s = series(metrics, kind);
  return s[s.length - 1];
}

// Net change from first to latest reading, in the latest reading's display unit.
// Null if fewer than two readings (nothing to compare yet — stay quiet, don't
// invent a trend).
export function change(metrics: Metric[], kind: MetricKind): { delta: number; unit: string } | null {
  const s = series(metrics, kind);
  if (s.length < 2) return null;
  const first = s[0];
  const last = s[s.length - 1];
  const unit = last.unit;
  const deltaCanonical =
    toCanonical(last.value, kind, last.unit) - toCanonical(first.value, kind, first.unit);
  return { delta: fromCanonical(deltaCanonical, kind, unit), unit };
}

// Points for a chart: {at, value} in the latest reading's display unit, so a
// mixed-unit history still draws one continuous line.
export type Point = { at: number; value: number };
export function chartPoints(metrics: Metric[], kind: MetricKind): Point[] {
  const s = series(metrics, kind);
  if (s.length === 0) return [];
  const unit = s[s.length - 1].unit;
  return s.map((m) => ({ at: m.at, value: fromCanonical(toCanonical(m.value, kind, m.unit), kind, unit) }));
}

export function formatMetric(value: number, kind: MetricKind, unit: string): string {
  return `${Number(value.toFixed(METRIC_META[kind].dp)).toLocaleString()} ${unit}`;
}
