import { PlayerStats, Registration } from "./types";

export type DraftedPlayer = Registration;

export type Team = {
  name: string;
  players: DraftedPlayer[];
  totals: PlayerStats;
};

const STAT_KEYS: (keyof PlayerStats)[] = [
  "defense",
  "passing",
  "attack",
  "fitness",
  "overall_score",
];

function sumStats(players: DraftedPlayer[]): PlayerStats {
  const totals: PlayerStats = {
    defense: 0,
    passing: 0,
    attack: 0,
    fitness: 0,
    overall_score: 0,
  };
  for (const p of players) {
    for (const key of STAT_KEYS) totals[key] += p[key];
  }
  return totals;
}

// Per-player average per team for one stat, so teams of different sizes are
// compared fairly (a team of 6 isn't penalized for a bigger sum than a team of 5).
function teamAverage(team: DraftedPlayer[], key: keyof PlayerStats): number {
  return team.length ? team.reduce((acc, p) => acc + p[key], 0) / team.length : 0;
}

function statVariance(teams: DraftedPlayer[][], key: keyof PlayerStats): number {
  const averages = teams.map((t) => teamAverage(t, key));
  const mean = averages.reduce((a, b) => a + b, 0) / averages.length;
  return averages.reduce((acc, avg) => acc + (avg - mean) ** 2, 0);
}

function totalVariance(teams: DraftedPlayer[][]): number {
  return (
    statVariance(teams, "overall_score") * 2 +
    statVariance(teams, "defense") +
    statVariance(teams, "passing") +
    statVariance(teams, "attack") +
    statVariance(teams, "fitness")
  );
}

// e.g. 17 players / 3 teams -> [6, 6, 5]
function computeTeamSizes(playerCount: number, teamCount: number): number[] {
  const base = Math.floor(playerCount / teamCount);
  const remainder = playerCount % teamCount;
  return Array.from({ length: teamCount }, (_, i) => base + (i < remainder ? 1 : 0));
}

// Order in which team slots get filled, bouncing 0,1,2,2,1,0,0,1,2,...
// while skipping any team that has already reached its target size.
function buildSlotOrder(sizes: number[]): number[] {
  const remaining = [...sizes];
  const total = sizes.reduce((a, b) => a + b, 0);
  const order: number[] = [];
  let dir = 1;
  let idx = 0;
  while (order.length < total) {
    if (remaining[idx] > 0) {
      order.push(idx);
      remaining[idx]--;
    }
    if (dir === 1 && idx === sizes.length - 1) dir = -1;
    else if (dir === -1 && idx === 0) dir = 1;
    else idx += dir;
  }
  return order;
}

/**
 * Splits players into `teamCount` teams, as evenly sized as possible, and
 * balanced across all five stats.
 * 1) Snake draft by overall_score (with a touch of random jitter, so
 *    re-running this produces a genuinely different lineup each time) to get
 *    a strong, varied starting point.
 * 2) Randomized local search that swaps players between teams whenever a
 *    swap lowers the combined variance across all five stats.
 */
export function buildBalancedTeams(
  players: Registration[],
  teamCount = 3,
  teamNames = ["קבוצה כתומה", "קבוצה סגולה", "קבוצה צהובה"]
): Team[] {
  const jitter = 6; // small enough to keep strong players near the top, large enough to reshuffle ties and near-ties
  const sorted = [...players].sort(
    (a, b) => b.overall_score + Math.random() * jitter - (a.overall_score + Math.random() * jitter)
  );

  const sizes = computeTeamSizes(sorted.length, teamCount);
  const slotOrder = buildSlotOrder(sizes);
  const teams: DraftedPlayer[][] = Array.from({ length: teamCount }, () => []);
  sorted.forEach((player, i) => teams[slotOrder[i]].push(player));

  // Local search improvement: try swapping pairs of players across teams.
  let bestVariance = totalVariance(teams);
  const iterations = 3000;
  for (let i = 0; i < iterations; i++) {
    const teamA = Math.floor(Math.random() * teamCount);
    let teamB = Math.floor(Math.random() * teamCount);
    if (teamB === teamA) teamB = (teamB + 1) % teamCount;
    if (teams[teamA].length === 0 || teams[teamB].length === 0) continue;

    const posA = Math.floor(Math.random() * teams[teamA].length);
    const posB = Math.floor(Math.random() * teams[teamB].length);

    const tmp = teams[teamA][posA];
    teams[teamA][posA] = teams[teamB][posB];
    teams[teamB][posB] = tmp;

    const newVariance = totalVariance(teams);
    if (newVariance < bestVariance) {
      bestVariance = newVariance;
    } else {
      // revert the swap
      teams[teamB][posB] = teams[teamA][posA];
      teams[teamA][posA] = tmp;
    }
  }

  return teams.map((players, i) => ({
    name: teamNames[i] ?? `קבוצה ${i + 1}`,
    players,
    totals: sumStats(players),
  }));
}
