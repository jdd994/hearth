// Sync.tsx
// Turning on cross-device sync — and the one thing that has to be said plainly:
// the account and the passphrase are two different secrets doing two different
// jobs.
//
//   • The account (an email + a password) answers "whose ciphertext is this?".
//     The server checks it and hands back opaque blobs.
//   • The passphrase decrypts those blobs, and it NEVER leaves the device — it
//     isn't sent here and it isn't stored on the server.
//
// So a breach of the sync server yields nothing but noise. Sync moves
// ciphertext; it does not move the key. This screen is where the user opts into
// it, so it says so.

import { useEffect, useState } from "react";

type Mode = "signin" | "create";

export function Sync({
  account,
  syncing,
  syncError,
  canCreate,
  onCreate,
  onSignIn,
  onDisconnect,
  onSyncNow,
  onClose,
}: {
  account: string | null;
  syncing: boolean;
  syncError: string | null;
  // A vault exists on this device (so it can be connected to a new account).
  canCreate: boolean;
  onCreate: (email: string, password: string) => Promise<boolean>;
  onSignIn: (email: string, password: string) => Promise<boolean>;
  onDisconnect: () => Promise<void>;
  onSyncNow: () => Promise<void>;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<Mode>(canCreate ? "create" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const ok = mode === "create" ? await onCreate(email, password) : await onSignIn(email, password);
      if (ok) onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h3>Sync across devices</h3>

        {account ? (
          <>
            <p>
              Connected as <strong>{account}</strong>. Your log syncs quietly in the
              background — nothing is lost if you're offline, it catches up next time.
            </p>
            <p className="hint">
              Only encrypted blobs leave this device. Your passphrase, and the key made from it,
              never do — so the server stores noise it can't read.
            </p>

            {syncError ? <div className="error">{syncError}</div> : null}

            <div className="sheet-actions">
              <button className="btn btn-ghost" onClick={() => void onDisconnect()}>
                Disconnect
              </button>
              <button className="btn btn-primary" onClick={() => void onSyncNow()} disabled={syncing}>
                {syncing ? "Syncing…" : "Sync now"}
              </button>
            </div>
          </>
        ) : (
          <>
            <p>
              Keep the same log on your phone and your laptop. This is separate from your
              passphrase: you make an <strong>account</strong> so the server knows which
              encrypted blobs are yours — but it only ever sees ciphertext.
            </p>

            {canCreate ? (
              <div className="seg">
                <button type="button" className="seg-btn" aria-pressed={mode === "create"} onClick={() => setMode("create")}>
                  New account
                </button>
                <button type="button" className="seg-btn" aria-pressed={mode === "signin"} onClick={() => setMode("signin")}>
                  Sign in
                </button>
              </div>
            ) : null}

            <form onSubmit={submit}>
              {syncError ? <div className="error">{syncError}</div> : null}

              <label className="field">
                <span className="label">Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                  autoComplete="email"
                  placeholder="you@example.com"
                />
              </label>

              <label className="field">
                <span className="label">Account password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === "create" ? "new-password" : "current-password"}
                />
                <span className="hint">
                  Not your passphrase — a separate secret, just for signing in. Your passphrase
                  never leaves this device.
                </span>
              </label>

              {mode === "signin" && !canCreate ? (
                <p className="hint">
                  Signing in downloads your log to this device. You'll open it with the same
                  passphrase you set on the first one.
                </p>
              ) : null}

              <div className="sheet-actions">
                <button type="button" className="btn btn-ghost" onClick={onClose}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={busy || !email || !password}>
                  {busy ? "Working…" : mode === "create" ? "Create account & sync" : "Sign in"}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
