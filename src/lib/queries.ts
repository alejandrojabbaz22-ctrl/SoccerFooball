import { supabase } from "./supabase";
import { FixedPlayer, MAX_CONFIRMED, Registration } from "./types";

export async function fetchFixedPlayers(): Promise<FixedPlayer[]> {
  const { data, error } = await supabase
    .from("fixed_players")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchRegistrations(): Promise<Registration[]> {
  const { data, error } = await supabase
    .from("registrations")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function countConfirmed(): Promise<number> {
  const { count, error } = await supabase
    .from("registrations")
    .select("*", { count: "exact", head: true })
    .eq("status", "confirmed");
  if (error) throw error;
  return count ?? 0;
}

export async function registerFixedPlayer(player: FixedPlayer) {
  const confirmedCount = await countConfirmed();
  const status = confirmedCount < MAX_CONFIRMED ? "confirmed" : "standby";

  const { error } = await supabase.from("registrations").insert({
    player_name: player.name,
    is_fixed: true,
    fixed_player_id: player.id,
    defense: player.defense,
    passing: player.passing,
    attack: player.attack,
    fitness: player.fitness,
    overall_score: player.overall_score,
    pick_tier: player.pick_tier,
    status,
  });
  if (error) throw error;
}

export async function registerGuest(name: string, overallScore: number) {
  const confirmedCount = await countConfirmed();
  const status = confirmedCount < MAX_CONFIRMED ? "confirmed" : "standby";

  const { error } = await supabase.from("registrations").insert({
    player_name: name,
    is_fixed: false,
    fixed_player_id: null,
    defense: overallScore,
    passing: overallScore,
    attack: overallScore,
    fitness: overallScore,
    overall_score: overallScore,
    pick_tier: null,
    status,
  });
  if (error) throw error;
}

// Removing a confirmed player frees a slot, so the earliest standby player
// (first to register) is promoted automatically.
export async function removeRegistration(registration: Registration) {
  const { error } = await supabase
    .from("registrations")
    .delete()
    .eq("id", registration.id);
  if (error) throw error;

  if (registration.status === "confirmed") {
    const { data: nextStandby, error: standbyError } = await supabase
      .from("registrations")
      .select("*")
      .eq("status", "standby")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (standbyError) throw standbyError;

    if (nextStandby) {
      const { error: promoteError } = await supabase
        .from("registrations")
        .update({ status: "confirmed" })
        .eq("id", nextStandby.id);
      if (promoteError) throw promoteError;
    }
  }
}

export async function resetRegistrations() {
  const { error } = await supabase
    .from("registrations")
    .delete()
    .not("id", "is", null);
  if (error) throw error;
}

export async function saveTeamDraw(teams: unknown) {
  const { error } = await supabase.from("team_draws").insert({ teams });
  if (error) throw error;
}

export async function fetchLatestTeamDraw() {
  const { data, error } = await supabase
    .from("team_draws")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}
