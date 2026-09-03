export type FixedPlayer = {
  id: string;
  name: string;
  defense: number;
  passing: number;
  attack: number;
  fitness: number;
  overall_score: number;
  // Manual draft tier (1 = strongest, 6 = weakest), used to steer team balancing.
  pick_tier: number | null;
  created_at: string;
};

export type RegistrationStatus = "confirmed" | "standby";

export type Registration = {
  id: string;
  player_name: string;
  is_fixed: boolean;
  fixed_player_id: string | null;
  defense: number;
  passing: number;
  attack: number;
  fitness: number;
  overall_score: number;
  pick_tier: number | null;
  status: RegistrationStatus;
  created_at: string;
};

export type PlayerStats = {
  defense: number;
  passing: number;
  attack: number;
  fitness: number;
  overall_score: number;
};

export const MAX_CONFIRMED = 18;
export const MAX_SLOTS = 25;
