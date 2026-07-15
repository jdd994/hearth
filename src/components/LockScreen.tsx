// LockScreen.tsx
// The vault is closed. Nothing about what you eat is in memory until the
// passphrase (or a biometric shortcut to the same key) opens it.

import { useEffect, useState } from "react";

export function LockScreen({
  onUnlock, onBiometric, hasBiometric, error, busy,
}: {
  onUnlock: (p: string) => Promise<boolean>;
  onBiometric: () => Promise<boolean>;
  hasBiometric: boolean;
  error: string | null;
  busy: boolean;
}) {
  const [pass, setPass] = useState("");

  useEffect(() => {
    if (hasBiometric) void onBiometric();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!(await onUnlock(pass))) setPass("");
  }

  return (
    <div className="gate">
      <div className="gate-card">
        <h1 className="gate-brand">Hearth<span>.</span></h1>
        <h2>Welcome back.</h2>
        <p>Your passphrase unlocks the vault on this device.</p>
        <form onSubmit={submit}>
          {error ? <div className="error">{error}</div> : null}
          <label className="field">
            <span className="label">Passphrase</span>
            <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} autoFocus autoComplete="current-password" />
          </label>
          <button type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={busy || !pass}>
            {busy ? "Unlocking…" : "Unlock"}
          </button>
          {hasBiometric ? (
            <button type="button" className="btn btn-ghost" style={{ width: "100%", marginTop: 9 }} onClick={() => void onBiometric()}>
              Use biometrics instead
            </button>
          ) : null}
        </form>
      </div>
    </div>
  );
}
