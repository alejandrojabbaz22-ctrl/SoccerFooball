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

// Squared-difference spread across the 3 teams for one stat, used as the
// thing we try to minimize so no team ends up stacked on one attribute.
function statVariance(teams: DraftedPlayer[][], key: keyof PlayerStats): number {
  const sums = teams.map((t) => t.reduce((acc, p) => acc + p[key], 0));
  const mean = sums.reduce((a, b) => a + b, 0) / sums.length;
  return sums.reduce((acc, s) => acc + (s - mean) ** 2, 0);
}

function totalVariance(teams: DraftedPlayer[][]): number {
  // overall_score matters most for a "fair" game, the individual attributes
  // matter too but weighted a bit lower so we don't fight the primary balance.
  return (
    statVariance(teams, "overall_score") * 2 +
    statVariance(teams, "defense") +
    statVariance(teams, "passing") +
    statVariance(teams, "attack") +
    statVariance(teams, "fitness")
  );
}

/**
 * Splits players into `teamCount` balanced teams.
 * 1) Snake draft by overall_score to get a strong starting point.
 * 2) Randomized local search that swaps players between teams whenever a
 *    swap lowers the combined variance across all five stats.
 */
export function buildBalancedTeams(
  players: Registration[],
  teamCount = 3,
  teamNames = ["קבוצה כתומה", "קבוצה סגולה", "קבוצה צהובה"]
): Team[] {
  const sorted = [...players].sort((a, b) => b.overall_score - a.overall_score);
  const teams: DraftedPlayer[][] = Array.from({ length: teamCount }, () => []);

  // Snake draft: 0,1,2,2,1,0,0,1,2,...
  let dir = 1;
  let idx = 0;
  for (const player of sorted) {
    teams[idx].push(player);
    if (dir === 1 && idx === teamCount - 1) dir = -1;
    else if (dir === -1 && idx === 0) dir = 1;
    else idx += dir;
  }

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
