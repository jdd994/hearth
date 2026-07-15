import { useState } from "react";
import { useHearth } from "./hooks/useHearth";
import { Welcome } from "./components/Welcome";
import { LockScreen } from "./components/LockScreen";
import { Today } from "./components/Today";
import { LogFood } from "./components/LogFood";
import { Goals, AddGoal } from "./components/Goals";
import { Recipes, AddRecipe } from "./components/Recipes";
import { Body, LogMetric } from "./components/Body";
import { Sync } from "./components/Sync";
import { loggedNutrients, type FoodLog } from "./lib/nutrition";

function timeLabel(at: number): string {
  return new Date(at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export default function App() {
  const h = useHearth();
  const [logging, setLogging] = useState(false);
  const [addingGoal, setAddingGoal] = useState(false);
  const [addingRecipe, setAddingRecipe] = useState(false);
  const [loggingMetric, setLoggingMetric] = useState(false);
  const [sync, setSync] = useState(false);

  if (h.status === "loading") return null;
  if (h.status === "setup") {
    return (
      <>
        <Welcome onSetup={h.setup} busy={h.busy} onSignIn={() => setSync(true)} />
        {sync ? (
          <Sync
            account={h.account}
            syncing={h.syncing}
            syncError={h.syncError}
            canCreate={false}
            onCreate={h.connectCreate}
            onSignIn={h.connectSignIn}
            onDisconnect={h.disconnect}
            onDelete={h.deleteAccount}
            onChangePassphrase={h.changePassphrase}
            onSyncNow={h.syncNow}
            onClose={() => setSync(false)}
          />
        ) : null}
      </>
    );
  }
  if (h.status === "locked") {
    return (
      <LockScreen
        onUnlock={h.unlock}
        onBiometric={h.unlockWithBiometric}
        hasBiometric={h.hasBiometric}
        error={h.error}
        busy={h.busy}
      />
    );
  }

  const now = Date.now();
  const startOfDay = new Date(new Date(now).getFullYear(), new Date(now).getMonth(), new Date(now).getDate()).getTime();
  const todayLogs: FoodLog[] = h.logs.filter((l) => l.at >= startOfDay).sort((a, b) => b.at - a.at);

  return (
    <div className="wrap">
      <header className="top">
        <h1 className="brand">Hearth<span>.</span></h1>
        <div className="top-actions">
          {h.canBiometric && !h.hasBiometric ? (
            <button className="btn btn-sm" onClick={() => void h.enableBiometric()}>Quick unlock</button>
          ) : null}
          <button
            className="btn btn-sm"
            onClick={() => setSync(true)}
            title={h.account ? `Syncing as ${h.account}` : "Sync across devices"}
          >
            {h.syncing ? "Syncing…" : h.account ? "Synced" : "Sync"}
          </button>
          <button className="btn btn-sm" onClick={h.lock} title="Lock the vault">Lock</button>
        </div>
      </header>

      {h.error ? <div className="error">{h.error}</div> : null}

      <Today today={h.today} hasLogs={todayLogs.length > 0} />

      <section className="section">
        <div className="section-head">
          <h2 className="section-title">Goals</h2>
          <button className="btn btn-sm" onClick={() => setAddingGoal(true)}>Add</button>
        </div>
        <Goals goals={h.goals} progressFor={h.progressFor} onRemove={(id) => void h.removeGoal(id)} />
      </section>

      <section className="section">
        <div className="section-head">
          <h2 className="section-title">Recipes</h2>
          <button className="btn btn-sm" onClick={() => setAddingRecipe(true)}>Add</button>
        </div>
        <Recipes
          recipes={h.recipes}
          busy={h.busy}
          onCook={(r) => void h.logRecipeServing(r)}
          onRemove={(id) => void h.removeRecipe(id)}
        />
      </section>

      <section className="section">
        <div className="section-head">
          <h2 className="section-title">Eaten today</h2>
          <button className="btn btn-sm btn-primary" onClick={() => setLogging(true)}>Log food</button>
        </div>
        {todayLogs.length === 0 ? (
          <div className="empty">Nothing yet today. Log your first thing with the button above.</div>
        ) : (
          todayLogs.map((l) => {
            const nut = loggedNutrients(l);
            return (
              <div className="log" key={l.id}>
                <div className="log-main">
                  <div className="log-name">{l.name}</div>
                  <div className="log-meta">
                    <span>{Math.round(l.amountGrams)} g</span>
                    <span aria-hidden="true">·</span>
                    <span>{timeLabel(l.at)}</span>
                    {l.note ? (<><span aria-hidden="true">·</span><span>{l.note}</span></>) : null}
                  </div>
                </div>
                <div className="log-amt">{Math.round(nut.kcal)}<span className="log-kcal"> kcal</span></div>
                <button className="btn btn-ghost btn-sm" onClick={() => void h.removeLog(l.id)} title="Remove">×</button>
              </div>
            );
          })
        )}
      </section>

      <Body metrics={h.metrics} onLog={() => setLoggingMetric(true)} onRemove={(id) => void h.removeMetric(id)} />

      {logging ? (
        <LogFood
          busy={h.busy}
          onLog={(food, grams, note) => h.logFood(food, grams, undefined, note)}
          onClose={() => setLogging(false)}
        />
      ) : null}
      {addingGoal ? <AddGoal onAdd={h.addGoal} onClose={() => setAddingGoal(false)} /> : null}
      {addingRecipe ? <AddRecipe onAdd={h.addRecipe} onClose={() => setAddingRecipe(false)} /> : null}
      {loggingMetric ? <LogMetric onLog={h.logMetric} onClose={() => setLoggingMetric(false)} /> : null}
      {sync ? (
        <Sync
          account={h.account}
          syncing={h.syncing}
          syncError={h.syncError}
          canCreate={true}
          onCreate={h.connectCreate}
          onSignIn={h.connectSignIn}
          onDisconnect={h.disconnect}
          onDelete={h.deleteAccount}
            onChangePassphrase={h.changePassphrase}
            onSyncNow={h.syncNow}
          onClose={() => setSync(false)}
        />
      ) : null}
    </div>
  );
}
