// Body.tsx
// Body metrics — weight and a measurement or two, over time. This is the part
// where diet apps do the most harm (BMI, "ideal weight", red arrows). Hearth
// does none of it: your own number, watched gently, like a garden through the
// seasons. The change is stated as a plain fact, never as good or bad.

import { useState } from "react";
import {
  METRIC_META, METRIC_KINDS, series, latest, change, chartPoints,
  formatMetric, type Metric, type MetricContent, type MetricKind,
} from "../lib/metrics";

// A quiet inline line chart — no library, no axes clutter. Just the shape of the
// trend. Ember line on the warm ground.
function Chart({ points }: { points: { at: number; value: number }[] }) {
  const W = 600, H = 120, pad = 10;
  if (points.length === 0) return null;
  const xs = points.map((p) => p.at);
  const ys = points.map((p) => p.value);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const px = (x: number) => pad + ((x - minX) / spanX) * (W - 2 * pad);
  const py = (y: number) => H - pad - ((y - minY) / spanY) * (H - 2 * pad);
  const pts = points.map((p) => `${px(p.at).toFixed(1)},${py(p.value).toFixed(1)}`);
  const last = points[points.length - 1];

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      {points.length > 1 ? (
        <polyline points={pts.join(" ")} fill="none" stroke="var(--ember)" strokeWidth="2"
          strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      ) : null}
      <circle cx={px(last.at)} cy={py(last.value)} r="3.5" fill="var(--ember)" />
    </svg>
  );
}

export function Body({
  metrics, onLog, onRemove,
}: {
  metrics: Metric[];
  onLog: () => void;
  onRemove: (id: string) => void;
}) {
  // Which kinds actually have data (weight always shown as the default entry).
  const present = METRIC_KINDS.filter((k) => series(metrics, k).length > 0);
  const kinds = present.length ? present : (["weight"] as MetricKind[]);
  const [kind, setKind] = useState<MetricKind>(kinds[0]);
  const active = kinds.includes(kind) ? kind : kinds[0];

  const s = series(metrics, active);
  const cur = latest(metrics, active);
  const chg = change(metrics, active);
  const points = chartPoints(metrics, active);

  return (
    <section className="section">
      <div className="section-head">
        <h2 className="section-title">Body</h2>
        <button className="btn btn-sm" onClick={onLog}>Log</button>
      </div>

      {present.length > 1 ? (
        <div className="metric-tabs">
          {present.map((k) => (
            <button key={k} className={"metric-tab" + (k === active ? " active" : "")} onClick={() => setKind(k)}>
              {METRIC_META[k].label}
            </button>
          ))}
        </div>
      ) : null}

      {s.length === 0 ? (
        <div className="empty">
          Nothing logged yet.
          <br />
          Note your weight when you like — Hearth just shows you the gentle line over time, never a
          judgement.
        </div>
      ) : (
        <div className="metric-card">
          <div className="metric-now">
            <span className="metric-val">{cur ? formatMetric(cur.value, active, cur.unit) : "—"}</span>
            {chg ? (
              <span className="metric-change">
                {chg.delta === 0
                  ? "steady since you started"
                  : `${chg.delta < 0 ? "down" : "up"} ${Math.abs(chg.delta).toFixed(METRIC_META[active].dp)} ${chg.unit} since ${new Date(s[0].at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`}
              </span>
            ) : (
              <span className="metric-change">your first reading — the trend appears with the next</span>
            )}
          </div>
          <Chart points={points} />
          <div className="metric-list">
            {[...s].reverse().slice(0, 6).map((m) => (
              <div className="metric-row" key={m.id}>
                <span className="metric-row-val">{formatMetric(m.value, active, m.unit)}</span>
                <span className="metric-row-date">{new Date(m.at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
                <button className="btn btn-ghost btn-sm" onClick={() => onRemove(m.id)} title="Remove">×</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function todayStr(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function LogMetric({
  onLog, onClose,
}: {
  onLog: (c: MetricContent, at: number) => Promise<void>;
  onClose: () => void;
}) {
  const [kind, setKind] = useState<MetricKind>("weight");
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState(METRIC_META.weight.units[0]);
  const [date, setDate] = useState(todayStr());
  const [error, setError] = useState<string | null>(null);

  function pickKind(k: MetricKind) {
    setKind(k);
    setUnit(METRIC_META[k].units[0]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = Number(value);
    if (!v || v <= 0) return setError("Enter a number.");
    const at = date === todayStr() ? Date.now() : new Date(`${date}T12:00:00`).getTime();
    await onLog({ kind, value: v, unit }, at);
    onClose();
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h3>Log a reading</h3>
        <div className="choices">
          {METRIC_KINDS.map((k) => (
            <button key={k} type="button" className="choice" aria-pressed={kind === k} onClick={() => pickKind(k)}>
              {METRIC_META[k].label}
            </button>
          ))}
        </div>
        <form onSubmit={submit}>
          {error ? <div className="error">{error}</div> : null}
          <div className="row">
            <label className="field">
              <span className="label">{METRIC_META[kind].label}</span>
              <input type="number" min={0} step="0.1" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0.0" autoFocus />
            </label>
            {METRIC_META[kind].units.length > 1 ? (
              <label className="field" style={{ flex: "0 0 90px" }}>
                <span className="label">Unit</span>
                <select value={unit} onChange={(e) => setUnit(e.target.value)}>
                  {METRIC_META[kind].units.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </label>
            ) : null}
          </div>
          <label className="field">
            <span className="label">When</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <div className="sheet-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}
