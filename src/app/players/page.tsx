"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { FixedPlayer } from "@/lib/types";
import { toErrorMessage } from "@/lib/errors";
import PasswordGate from "@/components/PasswordGate";

const PLAYERS_PAGE_PASSWORD = "gueta123";

type FormState = {
  id: string | null;
  name: string;
  defense: number;
  passing: number;
  attack: number;
  fitness: number;
  overall_score: number;
  pick_tier: number;
};

const emptyForm: FormState = {
  id: null,
  name: "",
  defense: 50,
  passing: 50,
  attack: 50,
  fitness: 50,
  overall_score: 50,
  pick_tier: 3,
};

type SortKey =
  | "name"
  | "defense"
  | "passing"
  | "attack"
  | "fitness"
  | "overall_score"
  | "pick_tier";
type SortConfig = { key: SortKey; direction: "asc" | "desc" };

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "name", label: "שם" },
  { key: "defense", label: "הגנה" },
  { key: "passing", label: "קישור" },
  { key: "attack", label: "התקפה" },
  { key: "fitness", label: "כושר" },
  { key: "overall_score", label: "ציון" },
  { key: "pick_tier", label: "בחירה" },
];

export default function PlayersPageGate() {
  return (
    <PasswordGate password={PLAYERS_PAGE_PASSWORD} storageKey="players-page-unlocked">
      <PlayersPage />
    </PasswordGate>
  );
}

function PlayersPage() {
  const [players, setPlayers] = useState<FixedPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: "name", direction: "asc" });

  function handleSort(key: SortKey) {
    setSortConfig((prev) => {
      if (prev.key !== key) return { key, direction: key === "name" ? "asc" : "desc" };
      return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
    });
  }

  const sortedPlayers = useMemo(() => {
    const list = [...players];
    const { key, direction } = sortConfig;
    list.sort((a, b) => {
      const diff =
        key === "name"
          ? a.name.localeCompare(b.name, "he")
          : (a[key] ?? 99) - (b[key] ?? 99);
      return direction === "asc" ? diff : -diff;
    });
    return list;
  }, [players, sortConfig]);

  async function load() {
    try {
      const { data, error } = await supabase
        .from("fixed_players")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      setPlayers(data ?? []);
    } catch (e) {
      setError(toErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function startEdit(p: FixedPlayer) {
    setForm({
      id: p.id,
      name: p.name,
      defense: p.defense,
      passing: p.passing,
      attack: p.attack,
      fitness: p.fitness,
      overall_score: p.overall_score,
      pick_tier: p.pick_tier ?? 3,
    });
  }

  async function handleSave() {
    setError(null);
    if (!form.name.trim()) {
      setError("הזן שם שחקן");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        name: form.name.trim(),
        defense: form.defense,
        passing: form.passing,
        attack: form.attack,
        fitness: form.fitness,
        overall_score: form.overall_score,
        pick_tier: form.pick_tier,
      };
      if (form.id) {
        const { error } = await supabase
          .from("fixed_players")
          .update(payload)
          .eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("fixed_players").insert(payload);
        if (error) throw error;
      }
      setForm(emptyForm);
      await load();
    } catch (e) {
      setError(toErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("למחוק את השחקן הקבוע? הפעולה בלתי הפיכה.")) return;
    setBusy(true);
    setError(null);
    try {
      const { error } = await supabase.from("fixed_players").delete().eq("id", id);
      if (error) throw error;
      if (form.id === id) setForm(emptyForm);
      await load();
    } catch (e) {
      setError(toErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="text-slate-400">טוען...</p>;

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <div className="rounded-md bg-red-950 border border-red-800 px-4 py-2 text-red-200 text-sm">
          {error}
        </div>
      )}

      <section className="rounded-lg border border-slate-800 bg-slate-900 p-4">
        <h2 className="mb-3 text-lg font-bold">
          {form.id ? "עריכת שחקן" : "הוספת שחקן קבוע"}
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="שם"
            className="col-span-2 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm sm:col-span-3"
          />
          <RatingInput
            label="הגנה"
            value={form.defense}
            onChange={(v) => setForm({ ...form, defense: v })}
          />
          <RatingInput
            label="קישור"
            value={form.passing}
            onChange={(v) => setForm({ ...form, passing: v })}
          />
          <RatingInput
            label="התקפה"
            value={form.attack}
            onChange={(v) => setForm({ ...form, attack: v })}
          />
          <RatingInput
            label="כושר"
            value={form.fitness}
            onChange={(v) => setForm({ ...form, fitness: v })}
          />
          <RatingInput
            label="ציון משוכלל"
            value={form.overall_score}
            onChange={(v) => setForm({ ...form, overall_score: v })}
          />
          <label className="flex flex-col gap-1 text-xs text-slate-400">
            בחירה (1=חזק, 6=חלש)
            <select
              value={form.pick_tier}
              onChange={(e) => setForm({ ...form, pick_tier: Number(e.target.value) })}
              className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
            >
              {[1, 2, 3, 4, 5, 6].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={handleSave}
            disabled={busy}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {form.id ? "שמור שינויים" : "הוסף שחקן"}
          </button>
          {form.id && (
            <button
              onClick={() => setForm(emptyForm)}
              className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300"
            >
              ביטול
            </button>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-900 p-4">
        <h2 className="mb-3 text-lg font-bold">שחקנים קבועים ({players.length})</h2>
        {players.length === 0 ? (
          <p className="text-sm text-slate-500">עדיין לא הוזנו שחקנים קבועים.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400">
                  {COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      className={`cursor-pointer select-none p-2 hover:text-slate-200 ${
                        col.key === "name" ? "text-start" : ""
                      }`}
                    >
                      {col.label}
                      {sortConfig.key === col.key && (
                        <span className="ms-1">{sortConfig.direction === "asc" ? "▲" : "▼"}</span>
                      )}
                    </th>
                  ))}
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {sortedPlayers.map((p) => (
                  <tr key={p.id} className="border-t border-slate-800">
                    <td className="p-2 font-medium">{p.name}</td>
                    <td className="p-2 text-center">{p.defense}</td>
                    <td className="p-2 text-center">{p.passing}</td>
                    <td className="p-2 text-center">{p.attack}</td>
                    <td className="p-2 text-center">{p.fitness}</td>
                    <td className="p-2 text-center font-bold">{p.overall_score}</td>
                    <td className="p-2 text-center">{p.pick_tier ?? "-"}</td>
                    <td className="p-2 text-end whitespace-nowrap">
                      <button
                        onClick={() => startEdit(p)}
                        className="me-2 text-xs text-emerald-400 hover:text-emerald-300"
                      >
                        עריכה
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        מחיקה
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function RatingInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-slate-400">
      {label}
      <input
        type="number"
        min={1}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
      />
    </label>
  );
}
