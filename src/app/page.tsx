"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  fetchFixedPlayers,
  fetchLatestTeamDraw,
  fetchRegistrations,
  registerFixedPlayer,
  registerGuest,
  removeRegistration,
  resetRegistrations,
  saveTeamDraw,
} from "@/lib/queries";
import { FixedPlayer, MAX_CONFIRMED, MAX_SLOTS, Registration } from "@/lib/types";
import { buildBalancedTeams, Team } from "@/lib/teamBalancer";
import { toErrorMessage } from "@/lib/errors";

const GUEST_SCORES = [50, 60, 65, 70, 75, 80, 85, 90, 95, 100];
const MIN_PLAYERS_FOR_TEAMS = 3;

export default function HomePage() {
  const [fixedPlayers, setFixedPlayers] = useState<FixedPlayer[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [mode, setMode] = useState<"fixed" | "guest">("fixed");
  const [selectedFixedId, setSelectedFixedId] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestScore, setGuestScore] = useState(70);

  const [teams, setTeams] = useState<Team[] | null>(null);
  const [copied, setCopied] = useState(false);

  async function loadAll() {
    const [players, regs, latestDraw] = await Promise.all([
      fetchFixedPlayers(),
      fetchRegistrations(),
      fetchLatestTeamDraw(),
    ]);
    setFixedPlayers(players);
    setRegistrations(regs);
    if (latestDraw?.teams) setTeams(latestDraw.teams as Team[]);
    setLoading(false);
  }

  useEffect(() => {
    loadAll()
      .catch((e) => setError(toErrorMessage(e)))
      .finally(() => setLoading(false));

    const channel = supabase
      .channel("registrations-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "registrations" },
        () => {
          fetchRegistrations().then(setRegistrations).catch(() => {});
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const confirmed = useMemo(
    () => registrations.filter((r) => r.status === "confirmed"),
    [registrations]
  );
  const standby = useMemo(
    () => registrations.filter((r) => r.status === "standby"),
    [registrations]
  );

  const registeredFixedIds = useMemo(
    () => new Set(registrations.map((r) => r.fixed_player_id).filter(Boolean)),
    [registrations]
  );
  const availableFixedPlayers = fixedPlayers.filter(
    (p) => !registeredFixedIds.has(p.id)
  );

  async function handleRegister() {
    setError(null);
    setBusy(true);
    try {
      if (registrations.length >= MAX_SLOTS) {
        throw new Error("כל 25 המקומות תפוסים");
      }
      if (mode === "fixed") {
        const player = fixedPlayers.find((p) => p.id === selectedFixedId);
        if (!player) throw new Error("בחר שחקן קבוע");
        await registerFixedPlayer(player);
        setSelectedFixedId("");
      } else {
        if (!guestName.trim()) throw new Error("הזן שם");
        await registerGuest(guestName.trim(), guestScore);
        setGuestName("");
      }
      await loadAll();
    } catch (e) {
      setError(toErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(reg: Registration) {
    setBusy(true);
    setError(null);
    try {
      await removeRegistration(reg);
      await loadAll();
    } catch (e) {
      setError(toErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleReset() {
    if (!confirm("לאפס את כל רשימת ההרשמה לשבת הקרובה? הפעולה בלתי הפיכה.")) return;
    setBusy(true);
    setError(null);
    try {
      await resetRegistrations();
      setTeams(null);
      await loadAll();
    } catch (e) {
      setError(toErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleShuffle() {
    setBusy(true);
    setError(null);
    try {
      const newTeams = buildBalancedTeams(confirmed, 3);
      setTeams(newTeams);
      setCopied(false);
      await saveTeamDraw(newTeams);
    } catch (e) {
      setError(toErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function teamsToWhatsAppText(teams: Team[]) {
    return teams
      .map(
        (team) =>
          `*${team.name}*\n` +
          team.players.map((p) => `• ${p.player_name}`).join("\n")
      )
      .join("\n\n");
  }

  async function handleCopy() {
    if (!teams) return;
    await navigator.clipboard.writeText(teamsToWhatsAppText(teams));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) return <p className="text-slate-400">טוען...</p>;

  return (
    <div className="flex flex-col gap-8">
      {error && (
        <div className="rounded-md bg-red-950 border border-red-800 px-4 py-2 text-red-200 text-sm">
          {error}
        </div>
      )}

      <section className="rounded-lg border border-slate-800 bg-slate-900 p-4">
        <h2 className="mb-3 text-lg font-bold">הרשמה למשחק הקרוב</h2>

        <div className="mb-3 flex gap-2">
          <button
            onClick={() => setMode("fixed")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              mode === "fixed" ? "bg-emerald-600" : "bg-slate-800 text-slate-300"
            }`}
          >
            שחקן קבוע
          </button>
          <button
            onClick={() => setMode("guest")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              mode === "guest" ? "bg-emerald-600" : "bg-slate-800 text-slate-300"
            }`}
          >
            אורח
          </button>
        </div>

        {mode === "fixed" ? (
          <div className="flex flex-wrap gap-2">
            <select
              value={selectedFixedId}
              onChange={(e) => setSelectedFixedId(e.target.value)}
              className="flex-1 min-w-[160px] rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            >
              <option value="">בחר שם...</option>
              {availableFixedPlayers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <button
              onClick={handleRegister}
              disabled={busy || !selectedFixedId}
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              הרשמה
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <input
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="שם מלא"
              className="flex-1 min-w-[140px] rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            />
            <select
              value={guestScore}
              onChange={(e) => setGuestScore(Number(e.target.value))}
              className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            >
              {GUEST_SCORES.map((s) => (
                <option key={s} value={s}>
                  ציון {s}
                </option>
              ))}
            </select>
            <button
              onClick={handleRegister}
              disabled={busy || !guestName.trim()}
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              הרשמה
            </button>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-900 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">
            רשומים ({confirmed.length}/{MAX_CONFIRMED})
          </h2>
          <button
            onClick={handleReset}
            disabled={busy}
            className="rounded-md bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-red-900 hover:text-red-200"
          >
            איפוס שבועי
          </button>
        </div>
        <PlayerList items={confirmed} onRemove={handleRemove} busy={busy} />
      </section>

      {standby.length > 0 && (
        <section className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <h2 className="mb-3 text-lg font-bold">
            רשימת המתנה ({standby.length}/{MAX_SLOTS - MAX_CONFIRMED})
          </h2>
          <PlayerList items={standby} onRemove={handleRemove} busy={busy} standby />
        </section>
      )}

      <section className="rounded-lg border border-slate-800 bg-slate-900 p-4">
        <h2 className="mb-3 text-lg font-bold">חלוקה לקבוצות</h2>
        <button
          onClick={handleShuffle}
          disabled={busy || confirmed.length < MIN_PLAYERS_FOR_TEAMS}
          className="w-full rounded-md bg-amber-500 py-3 text-base font-bold text-slate-950 disabled:opacity-40"
        >
          🎲 יאללה בלגן
        </button>
        {confirmed.length < MIN_PLAYERS_FOR_TEAMS ? (
          <p className="mt-2 text-xs text-slate-400">
            צריך לפחות {MIN_PLAYERS_FOR_TEAMS} שחקנים מאושרים כדי לחלק לקבוצות (יש כרגע{" "}
            {confirmed.length}).
          </p>
        ) : (
          <p className="mt-2 text-xs text-slate-400">
            אפשר ללחוץ שוב כמה פעמים שרוצים כדי לקבל חלוקה אחרת, עדיין מאוזנת.
          </p>
        )}

        {teams && (
          <div className="mt-5 flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-3">
              {teams.map((team) => (
                <div
                  key={team.name}
                  className="rounded-md border border-slate-700 bg-slate-950 p-3"
                >
                  <h3 className={`mb-2 font-bold ${teamColor(team.name)}`}>{team.name}</h3>
                  <ul className="mb-2 flex flex-col gap-1 text-sm">
                    {team.players.map((p) => (
                      <li key={p.id}>{p.player_name}</li>
                    ))}
                  </ul>
                  <p className="text-xs text-slate-400">
                    ציון ממוצע: {(team.totals.overall_score / team.players.length).toFixed(1)}
                  </p>
                </div>
              ))}
            </div>
            <button
              onClick={handleCopy}
              className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium hover:bg-slate-700"
            >
              {copied ? "הועתק! ✅" : "📋 העתק טקסט לוואטסאפ"}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function teamColor(teamName: string) {
  if (teamName.includes("כתומה")) return "text-orange-400";
  if (teamName.includes("סגולה")) return "text-purple-400";
  if (teamName.includes("צהובה")) return "text-yellow-300";
  return "text-emerald-400";
}

function PlayerList({
  items,
  onRemove,
  busy,
  standby = false,
}: {
  items: Registration[];
  onRemove: (r: Registration) => void;
  busy: boolean;
  standby?: boolean;
}) {
  if (items.length === 0)
    return <p className="text-sm text-slate-500">אין רשומים עדיין.</p>;

  return (
    <ul className="flex flex-col gap-2">
      {items.map((r, i) => (
        <li
          key={r.id}
          className="flex items-center justify-between rounded-md bg-slate-950 px-3 py-2 text-sm"
        >
          <span>
            {standby && <span className="text-slate-500 me-2">#{i + 1}</span>}
            {r.player_name}{" "}
            {!r.is_fixed && (
              <span className="text-xs text-slate-500">(אורח, {r.overall_score})</span>
            )}
          </span>
          <button
            onClick={() => onRemove(r)}
            disabled={busy}
            className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
          >
            הסר
          </button>
        </li>
      ))}
    </ul>
  );
}
