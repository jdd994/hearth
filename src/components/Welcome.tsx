// Welcome.tsx
// First run. Two things get said before a single bite is logged: the no-reset
// trade (same honesty as the siblings), and the promise about tone — that this
// is not a diet app, and it will never make you feel bad about food.

import { useState } from "react";

export function Welcome({ onSetup, busy, onSignIn }: { onSetup: (p: string) => Promise<void>; busy: boolean; onSignIn?: () => void }) {
  const [step, setStep] = useState<"intro" | "pass">("intro");
  const [pass, setPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (pass.length < 10) return setError("Use at least 10 characters — a few plain words you'll remember.");
    if (pass !== confirm) return setError("Those don't match.");
    await onSetup(pass);
  }

  if (step === "intro") {
    return (
      <div className="gate">
        <div className="gate-card">
          <h1 className="gate-brand">Hearth<span>.</span></h1>
          <h2>Tend and nourish yourself, gently.</h2>
          <p>
            A calm place to see what you're eating and how it's nourishing you. Log food, notice
            your day, aim at goals <em>you</em> set. Everything is encrypted on this device before
            it's stored — what you eat is nobody's business but yours.
          </p>

          <div className="trade">
            <strong>A promise about how this feels:</strong> Hearth is not a diet app. There are no
            "bad" foods, no shame, no streaks to break, no bodies to measure you against. Just your
            own picture, shown kindly. Being aware of what you eat is a way of caring for yourself —
            never a reason to feel small.
          </div>

          <p style={{ fontSize: 13.5, color: "var(--ink-faint)" }}>
            Because the key is made from your passphrase and never leaves this device, there's{" "}
            <strong style={{ color: "var(--ink-soft)" }}>no reset</strong>. Forget it and the data
            can't be recovered by anyone — including us. Keep it somewhere safe. That's the price of
            it being truly private.
          </p>

          <button className="btn btn-primary" style={{ width: "100%", marginTop: 12 }} onClick={() => setStep("pass")}>
            Set a passphrase
          </button>

          {onSignIn ? (
            <p className="gate-alt">
              Already set up on another device?{" "}
              <button type="button" className="linklike" onClick={onSignIn}>
                Sign in to sync
              </button>
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="gate">
      <div className="gate-card">
        <h1 className="gate-brand">Hearth<span>.</span></h1>
        <h2>Choose a passphrase</h2>
        <p>This is the only key to your vault. A few plain words you won't forget beats a short clever one.</p>
        <form onSubmit={submit}>
          {error ? <div className="error">{error}</div> : null}
          <label className="field">
            <span className="label">Passphrase</span>
            <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} autoFocus autoComplete="new-password" placeholder="at least 10 characters" />
          </label>
          <label className="field">
            <span className="label">Again, to be sure</span>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
          </label>
          <div className="sheet-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setStep("intro")}>Back</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Making your vault…" : "Create vault"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
