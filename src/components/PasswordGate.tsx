"use client";

import { useEffect, useState } from "react";

// Lightweight front-door lock: keeps casual visitors out of the admin page.
// The password ships inside the client bundle, so anyone determined to read
// the JS can find it — this is a "keep honest people out" gate, not real auth.
export default function PasswordGate({
  password,
  storageKey,
  children,
}: {
  password: string;
  storageKey: string;
  children: React.ReactNode;
}) {
  const [unlocked, setUnlocked] = useState(false);
  const [checked, setChecked] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(storageKey) === "true") setUnlocked(true);
    setChecked(true);
  }, [storageKey]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (input === password) {
      sessionStorage.setItem(storageKey, "true");
      setUnlocked(true);
      setError(false);
    } else {
      setError(true);
    }
  }

  if (!checked) return null;

  if (!unlocked) {
    return (
      <div className="mx-auto max-w-sm rounded-lg border border-slate-800 bg-slate-900 p-6">
        <h2 className="mb-3 text-lg font-bold">גישה מוגבלת</h2>
        <p className="mb-3 text-sm text-slate-400">יש להזין סיסמה כדי לצפות בעמוד זה.</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <input
            type="password"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoFocus
            placeholder="סיסמה"
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          />
          {error && <p className="text-xs text-red-400">סיסמה שגויה</p>}
          <button
            type="submit"
            className="rounded-md bg-emerald-600 py-2 text-sm font-medium"
          >
            כניסה
          </button>
        </form>
      </div>
    );
  }

  return <>{children}</>;
}
