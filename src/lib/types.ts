export type FixedPlayer = {
  id: string;
  name: string;
  defense: number;
  passing: number;
  attack: number;
  fitness: number;
  overall_score: number;
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
