// Goals.tsx
// YOUR targets, tracked calmly. A goal is a nutrient, a number, and a direction
// you chose. Progress is shown as gentle information — "62 of your 100g protein"
// — never pass/fail, never red. RDAs aren't imposed here; if a reference is ever
// offered it's off by default and labelled "a rough guide, not a verdict."

import { useState } from "react";
import {
  NUTRIENT_META, type Goal, type GoalContent, type GoalDirection, type GoalProgress, type NutrientKey,
} from "../lib/nutrition";

const GOALABLE: NutrientKey[] = ["kcal", "protein", "carbs", "fat", "fibre", "sugars", "satFat", "sodium"];
const DIR_LABEL: Record<GoalDirection, string> = { atLeast: "at least", atMost: "at most", target: "around" };

export function Goals({
  goals, progressFor, onRemove,
}: {
  goals: Goal[];
  progressFor: (g: Goal) => GoalProgress;
  onRemove: (id: string) => void;
}) {
  if (goals.length === 0) {
    return (
      <div className="empty">
        No goals yet.
        <br />
        Set one you care about — a protein floor, a gentle calorie aim — and Hearth shows your
        pace, kindly.
      </div>
    );
  }
  return (
    <div>
      {goals.map((g) => {
        const p = progressFor(g);
        const m = NUTRIENT_META[g.nutrient];
        return (
          <div className="goal" key={g.id}>
            <div className="goal-head">
              <span className="goal-name">{g.name}</span>
              <span className="goal-amt">
                {Number(p.current.toFixed(m.dp)).toLocaleString()} / {g.amount.toLocaleString()} {m.unit}
              </span>
            </div>
            <div className="bar">
              <div className={`bar-fill tone-${p.tone}`} style={{ width: `${Math.round(p.fraction * 100)}%` }} />
            </div>
            <div className="goal-read">
              {DIR_LABEL[g.direction]} {g.amount.toLocaleString()} {m.unit} of {m.label.toLowerCase()}
              {p.tone === "over" ? " · a little past, no worries" : p.tone === "on" ? " · there" : ""}
              <button className="btn btn-danger btn-sm" style={{ marginLeft: 10 }} onClick={() => onRemove(g.id)}>
                remove
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function AddGoal({
  onAdd, onClose,
}: {
  onAdd: (c: GoalContent) => Promise<void>;
  onClose: () => void;
}) {
  const [nutrient, setNutrient] = useState<NutrientKey>("protein");
  const [direction, setDirection] = useState<GoalDirection>("atLeast");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(amount);
    if (!n || n <= 0) return setError("Pick an amount.");
    const m = NUTRIENT_META[nutrient];
    await onAdd({ name: `${DIR_LABEL[direction]} ${n} ${m.unit} ${m.label.toLowerCase()}`, nutrient, amount: n, direction });
    onClose();
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h3>A goal you set</h3>
        <p className="hint" style={{ marginTop: -6, marginBottom: 16 }}>
          Whatever matters to <em>you</em> — a protein floor, a gentle calorie aim, less added
          sugar. Hearth tracks it kindly; it never decides the number for you.
        </p>
        <form onSubmit={submit}>
          {error ? <div className="error">{error}</div> : null}
          <div className="row">
            <label className="field">
              <span className="label">I want</span>
              <select value={direction} onChange={(e) => setDirection(e.target.value as GoalDirection)}>
                <option value="atLeast">at least</option>
                <option value="atMost">at most</option>
                <option value="target">around</option>
              </select>
            </label>
            <label className="field">
              <span className="label">Amount</span>
              <input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="100" autoFocus />
            </label>
          </div>
          <label className="field">
            <span className="label">of</span>
            <select value={nutrient} onChange={(e) => setNutrient(e.target.value as NutrientKey)}>
              {GOALABLE.map((k) => (
                <option key={k} value={k}>{NUTRIENT_META[k].label} ({NUTRIENT_META[k].unit})</option>
              ))}
            </select>
          </label>
          <div className="sheet-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Add goal</button>
          </div>
        </form>
      </div>
    </div>
  );
}
