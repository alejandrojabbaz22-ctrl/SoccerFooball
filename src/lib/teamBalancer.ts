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

const WEAKEST_TIER = 6;
const STRONGEST_TIER = 1;
const TIER_PENALTY_WEIGHT = 5000;
const SPREAD_PENALTY_WEIGHT = 200;
// This specific player should never share a team with another tier-1 player.
const NEVER_PAIR_WITH_TIER1 = "חי";

// Soft preferences layered on top of the stat balance:
// - at most one tier-6 (weakest) player per team, so the weakest players are spread out
// - tier-1 (strongest) players get clustered together (up to 2 per team) instead of
//   spread one-per-team, per the user's request
// - NEVER_PAIR_WITH_TIER1 is the exception: he never teams up with another tier-1 player
function tierPenalty(teams: DraftedPlayer[][]): number {
  let penalty = 0;

  for (const team of teams) {
    const weakestCount = team.filter((p) => p.pick_tier === WEAKEST_TIER).length;
    if (weakestCount > 1) penalty += (weakestCount - 1) ** 2 * TIER_PENALTY_WEIGHT;

    const hasIsolatedPlayer = team.some((p) => p.player_name === NEVER_PAIR_WITH_TIER1);
    const otherStrongestCount = team.filter(
      (p) => p.pick_tier === STRONGEST_TIER && p.player_name !== NEVER_PAIR_WITH_TIER1
    ).length;

    if (hasIsolatedPlayer) {
      // Any other tier-1 teammate at all is a violation here.
      penalty += otherStrongestCount * TIER_PENALTY_WEIGHT;
    } else if (otherStrongestCount > 2) {
      penalty += (otherStrongestCount - 2) ** 2 * TIER_PENALTY_WEIGHT;
    }
  }

  // Nudge towards grouping the remaining strongest players into pairs rather than
  // spreading them singly (excluding NEVER_PAIR_WITH_TIER1's team, which should stay solo).
  const teamsWithOneStrongest = teams.filter((team) => {
    if (team.some((p) => p.player_name === NEVER_PAIR_WITH_TIER1)) return false;
    return team.filter((p) => p.pick_tier === STRONGEST_TIER).length === 1;
  }).length;
  penalty += teamsWithOneStrongest * SPREAD_PENALTY_WEIGHT;

  return penalty;
}

const REQUEST_PENALTY_WEIGHT = 150;

// Each special request is a group of 2-3 player names that want to play together.
// Costs one step per extra team the group is split across; names that are not
// among this week's confirmed players are ignored.
function requestPenalty(teams: DraftedPlayer[][], requests: string[][]): number {
  let penalty = 0;
  for (const group of requests) {
    const teamsUsed = new Set<number>();
    let present = 0;
    teams.forEach((team, ti) => {
      for (const p of team) {
        if (group.includes(p.player_name)) {
          present++;
          teamsUsed.add(ti);
        }
      }
    });
    if (present >= 2) penalty += (teamsUsed.size - 1) * REQUEST_PENALTY_WEIGHT;
  }
  return penalty;
}

// Teams may differ by up to GAP_LIMIT points (best team average minus worst, per
// stat) at no real cost, which leaves room for varied line-ups. Beyond that the
// penalty grows fast. Inside the limit a small variance term still prefers
// the more even split.
const GAP_LIMIT = 5;
const GAP_PENALTY_PER_POINT = 40;
const BALANCE_SCALE = 0.3;

const BALANCED_STATS: (keyof PlayerStats)[] = [
  "defense",
  "passing",
  "attack",
  "fitness",
  "overall_score",
];

function gapPenalty(teams: DraftedPlayer[][]): number {
  let penalty = 0;
  for (const key of BALANCED_STATS) {
    const averages = teams.map((t) => teamAverage(t, key));
    const gap = Math.max(...averages) - Math.min(...averages);
    if (gap > GAP_LIMIT) penalty += (gap - GAP_LIMIT) * GAP_PENALTY_PER_POINT;
  }
  return penalty;
}

function totalVariance(teams: DraftedPlayer[][], requests: string[][]): number {
  const variance =
    statVariance(teams, "overall_score") * 2 +
    statVariance(teams, "defense") +
    statVariance(teams, "passing") +
    statVariance(teams, "attack") +
    statVariance(teams, "fitness");
  return (
    variance * BALANCE_SCALE +
    gapPenalty(teams) +
    tierPenalty(teams) +
    requestPenalty(teams, requests)
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

const RESTARTS = 14;
const ITERATIONS_PER_RESTART = 2500;
const START_TEMPERATURE = 40;
const END_TEMPERATURE = 0.3;

// How strongly we steer away from pairs that were together in recent draws.
// Each repeated pair costs this much; the most recent draw counts fully and
// older ones count less (see HISTORY_DECAY).
const NOVELTY_WEIGHT = 2;
const HISTORY_DECAY = 0.7;
// Any candidate close to the cheapest one may be picked, so the result is a
// random good split rather than always the single best one. "Close" is a fixed
// amount, or a share of the best cost when even the best split is far from
// ideal (e.g. very few players registered, where nothing fits in the gap limit).
const CANDIDATE_SLACK = 12;
const CANDIDATE_SLACK_RATIO = 0.35;

/**
 * Pair-repeat penalty from previous draws. `avoid` is a list of earlier draws
 * (most recent first); each draw is a list of teams, each team a list of names.
 */
function buildNoveltyMatrix(players: Registration[], avoid: string[][][]) {
  const n = players.length;
  const indexOf = new Map<Registration, number>();
  players.forEach((p, i) => indexOf.set(p, i));
  const byName = new Map<string, number>();
  players.forEach((p, i) => byName.set(p.player_name, i));

  const matrix = new Float64Array(n * n);
  let weight = 1;
  for (const draw of avoid) {
    for (const team of draw) {
      const ids = team
        .map((name) => byName.get(name))
        .filter((i): i is number => i !== undefined);
      for (let a = 0; a < ids.length; a++) {
        for (let b = a + 1; b < ids.length; b++) {
          matrix[ids[a] * n + ids[b]] += weight;
          matrix[ids[b] * n + ids[a]] += weight;
        }
      }
    }
    weight *= HISTORY_DECAY;
  }
  return { matrix, indexOf, n };
}

type Novelty = ReturnType<typeof buildNoveltyMatrix>;

function noveltyPenalty(teams: DraftedPlayer[][], novelty: Novelty): number {
  const { matrix, indexOf, n } = novelty;
  let total = 0;
  for (const team of teams) {
    for (let a = 0; a < team.length; a++) {
      const ia = indexOf.get(team[a])!;
      for (let b = a + 1; b < team.length; b++) {
        total += matrix[ia * n + indexOf.get(team[b])!];
      }
    }
  }
  return total * NOVELTY_WEIGHT;
}

type State = { teams: DraftedPlayer[][]; cost: number; rules: number };

function partitionKey(teams: DraftedPlayer[][]): string {
  return teams
    .map((t) => t.map((p) => p.player_name).sort().join(","))
    .sort()
    .join("|");
}

// Share of the annealing run after which good states start being collected
// (earlier on the search is still hot and wandering).
const RECORD_FROM = 0.4;

function searchOnce(
  players: Registration[],
  teamCount: number,
  requests: string[][],
  novelty: Novelty,
  visited: Map<string, State>
): void {
  const jitter = 6; // small enough to keep strong players near the top, large enough to reshuffle ties and near-ties
  const sorted = [...players].sort(
    (a, b) => b.overall_score + Math.random() * jitter - (a.overall_score + Math.random() * jitter)
  );

  const sizes = computeTeamSizes(sorted.length, teamCount);
  const slotOrder = buildSlotOrder(sizes);
  const teams: DraftedPlayer[][] = Array.from({ length: teamCount }, () => []);
  sorted.forEach((player, i) => teams[slotOrder[i]].push(player));

  const costOf = (t: DraftedPlayer[][]) =>
    totalVariance(t, requests) + noveltyPenalty(t, novelty);
  const remember = (t: DraftedPlayer[][], c: number) => {
    const key = partitionKey(t);
    if (!visited.has(key)) {
      visited.set(key, {
        teams: t.map((team) => [...team]),
        cost: c,
        rules: tierPenalty(t) + requestPenalty(t, requests),
      });
    }
  };

  // Simulated annealing over pairwise swaps: early on it may accept slightly
  // worse swaps (to move a whole requested group), then it settles down.
  // Every good state visited late in the run is kept as a candidate, so the
  // final pick has many near-equal splits to choose from, not just one.
  let cost = costOf(teams);
  let bestCost = cost;
  let bestTeams = teams.map((t) => [...t]);
  for (let i = 0; i < ITERATIONS_PER_RESTART; i++) {
    const temperature = START_TEMPERATURE * Math.pow(END_TEMPERATURE / START_TEMPERATURE, i / ITERATIONS_PER_RESTART);
    const teamA = Math.floor(Math.random() * teamCount);
    let teamB = Math.floor(Math.random() * teamCount);
    if (teamB === teamA) teamB = (teamB + 1) % teamCount;
    if (teams[teamA].length === 0 || teams[teamB].length === 0) continue;

    const posA = Math.floor(Math.random() * teams[teamA].length);
    const posB = Math.floor(Math.random() * teams[teamB].length);

    const tmp = teams[teamA][posA];
    teams[teamA][posA] = teams[teamB][posB];
    teams[teamB][posB] = tmp;

    const newCost = costOf(teams);
    const delta = newCost - cost;
    if (delta < 0 || Math.random() < Math.exp(-delta / temperature)) {
      cost = newCost;
      if (cost < bestCost) {
        bestCost = cost;
        bestTeams = teams.map((t) => [...t]);
      }
      if (
        i >= ITERATIONS_PER_RESTART * RECORD_FROM &&
        cost <= bestCost + Math.max(CANDIDATE_SLACK, bestCost * CANDIDATE_SLACK_RATIO)
      ) {
        remember(teams, cost);
      }
    } else {
      // revert the swap
      teams[teamB][posB] = teams[teamA][posA];
      teams[teamA][posA] = tmp;
    }
  }
  remember(bestTeams, bestCost);
}

/**
 * Splits players into `teamCount` teams, as evenly sized as possible, and
 * balanced across all five stats, while honoring tier rules and special
 * requests as soft preferences.
 *
 * To keep repeated presses of the shuffle button varied:
 * - `avoid` lists previous draws (most recent first); pairs that already
 *   shared a team there are discouraged.
 * - several independent searches run, and the result is picked at random from
 *   all candidates that are nearly as good as the best, not always the best.
 */
export function buildBalancedTeams(
  players: Registration[],
  teamCount = 3,
  teamNames = ["קבוצה כתומה", "קבוצה סגולה", "קבוצה צהובה"],
  requests: string[][] = [],
  avoid: string[][][] = []
): Team[] {
  const novelty = buildNoveltyMatrix(players, avoid);

  const visited = new Map<string, State>();
  for (let r = 0; r < RESTARTS; r++) {
    searchOnce(players, teamCount, requests, novelty, visited);
  }
  const candidates = [...visited.values()];
  // Tier rules and special requests are never traded away for variety: only
  // candidates that break them the least are considered.
  const fewestBroken = Math.min(...candidates.map((c) => c.rules));
  const respectful = candidates.filter((c) => c.rules === fewestBroken);
  const bestCost = Math.min(...respectful.map((c) => c.cost));
  const slack = Math.max(CANDIDATE_SLACK, bestCost * CANDIDATE_SLACK_RATIO);
  const eligible = respectful.filter((c) => c.cost <= bestCost + slack);
  const chosen = eligible[Math.floor(Math.random() * eligible.length)];

  return chosen.teams.map((players, i) => ({
    name: teamNames[i] ?? `קבוצה ${i + 1}`,
    players,
    totals: sumStats(players),
  }));
}
