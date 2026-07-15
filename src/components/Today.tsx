// Today.tsx
// The spine: what you've eaten today, at a glance. Headline macros up front, the
// rest a tap away. Numbers shown calmly — never red, never "over budget", never
// a verdict. This is Hearth's signature element, the way the waterline is
// Ballast's: the one thing you open the app to see.

import { useState } from "react";
import { NUTRIENT_KEYS, NUTRIENT_META, type Nutrients, type NutrientKey } from "../lib/nutrition";

const HEADLINE: NutrientKey[] = ["kcal", "protein", "carbs", "fat"];

export function Today({ today, hasLogs }: { today: Nutrients; hasLogs: boolean }) {
  const [showMicros, setShowMicros] = useState(false);

  const micros = NUTRIENT_KEYS.filter((k) => !HEADLINE.includes(k)).filter((k) => today[k] > 0);

  return (
    <section className="today">
      <div className="today-label">Today</div>

      {!hasLogs ? (
        <p className="today-empty">Nothing logged yet. Add what you've eaten and this fills in — gently, no targets you didn't set.</p>
      ) : (
        <>
          <div className="stats">
            {HEADLINE.map((k) => {
              const m = NUTRIENT_META[k];
              return (
                <div className="stat" key={k}>
                  <span className="stat-val">
                    {Math.round(today[k] * (m.dp ? 10 : 1)) / (m.dp ? 10 : 1)}
                    <span className="stat-unit">{m.unit}</span>
                  </span>
                  <span className="stat-lab">{m.label}</span>
                </div>
              );
            })}
          </div>

          {micros.length > 0 ? (
            <>
              <button className="btn btn-ghost btn-sm micros-toggle" onClick={() => setShowMicros((v) => !v)}>
                {showMicros ? "Hide details" : "More detail"}
              </button>
              {showMicros ? (
                <div className="micros">
                  {micros.map((k) => (
                    <div className="micro" key={k}>
                      <span>{NUTRIENT_META[k].label}</span>
                      <span className="m-val">
                        {Number(today[k].toFixed(NUTRIENT_META[k].dp)).toLocaleString()} {NUTRIENT_META[k].unit}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </>
          ) : null}
        </>
      )}
    </section>
  );
}
