import {
  Assignment,
  Constraints,
  Player,
  Position,
  SplitResult,
  TeamId,
} from "../types";
import { compareCost, costVector } from "./cost";
import { buildChecks, buildFlags, buildTeamViews } from "./verify";

/** Deterministic PRNG so a given seed always produces the same split. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GROUP_ORDER: Position[] = [
  "Defence",
  "Full-back",
  "Midfield",
  "Winger",
  "Striker",
];

/** GK rule first, then a skill-descending snake draft across position groups. */
function seedAssignments(
  players: Player[],
  rng: () => number
): Assignment[] {
  const assignments: Assignment[] = [];
  const assigned = new Set<string>();
  let counts: Record<TeamId, number> = { A: 0, B: 0 };

  const place = (p: Player, team: TeamId, position: Position) => {
    assignments.push({
      playerId: p.id,
      team,
      position,
      isSecondary: position !== p.primary,
    });
    assigned.add(p.id);
    counts[team]++;
  };

  const bySkillDesc = (a: Player, b: Player) =>
    b.skill - a.skill || b.running - a.running || rng() - 0.5;

  // --- Settle goalkeepers ---
  const gks = players.filter((p) => p.primary === "GK").sort(bySkillDesc);
  if (gks.length >= 2) {
    place(gks[0], "A", "GK");
    place(gks[1], "B", "GK");
  } else if (gks.length === 1) {
    place(gks[0], "A", "GK");
    const donor = players
      .filter((p) => !assigned.has(p.id) && p.secondary === "GK")
      .sort(bySkillDesc)[0];
    if (donor) {
      place(donor, "B", "GK");
    }
  } else {
    // No specialist at all. Every deputy we have goes in goal, up to one per
    // team: two means both goals are covered, one means that deputy keeps and
    // the other team rotates. A kept goal beats an empty one even when the
    // keeper would rather be playing out.
    const deputies = players
      .filter((p) => p.secondary === "GK")
      .sort(bySkillDesc);
    if (deputies.length >= 2) {
      place(deputies[0], "A", "GK");
      place(deputies[1], "B", "GK");
    } else if (deputies.length === 1) {
      place(deputies[0], "A", "GK");
    }
  }

  // --- Snake draft the rest, primary positions, snake continuing across groups ---
  const remaining = players.filter((p) => !assigned.has(p.id));
  const extraGks = remaining.filter((p) => p.primary === "GK"); // 3rd+ keeper case
  const first: TeamId = counts.A <= counts.B ? "A" : "B";
  const second: TeamId = first === "A" ? "B" : "A";
  let picksMade = 0;

  const draft = (p: Player, position: Position) => {
    // Classic snake A B B A A B B A...: positions 0,3,4,7,8,... go to `first`.
    let team: TeamId =
      Math.floor((picksMade + 1) / 2) % 2 === 0 ? first : second;
    // Keep headcounts within 1 no matter what the snake says.
    if (counts.A - counts.B >= 1) team = "B";
    else if (counts.B - counts.A >= 1) team = "A";
    place(p, team, position);
    picksMade++;
  };

  for (const group of GROUP_ORDER) {
    const groupPlayers = remaining
      .filter((p) => p.primary === group)
      .sort(bySkillDesc);
    for (const p of groupPlayers) draft(p, group);
  }
  // Any leftover GK-primaries (3+ keepers): outfield via secondary if they have
  // one, otherwise they stay GK (never an illegal position) and get flagged.
  for (const p of extraGks.sort(bySkillDesc)) {
    draft(p, p.secondary !== "GK" ? p.secondary : "GK");
  }

  return assignments;
}

type Move =
  | { kind: "swap"; i: number; j: number; reposI?: boolean; reposJ?: boolean }
  | { kind: "shift"; i: number; reposI?: boolean }
  | { kind: "repos"; i: number };

function togglePosition(a: Assignment, byId: Map<string, Player>) {
  const p = byId.get(a.playerId)!;
  const other = a.position === p.primary ? p.secondary : p.primary;
  a.position = other;
  a.isSecondary = other !== p.primary;
}

function applyMove(assignments: Assignment[], move: Move, byId: Map<string, Player>): Assignment[] {
  const next = assignments.map((a) => ({ ...a }));
  if (move.kind === "swap") {
    const t = next[move.i].team;
    next[move.i].team = next[move.j].team;
    next[move.j].team = t;
    if (move.reposI) togglePosition(next[move.i], byId);
    if (move.reposJ) togglePosition(next[move.j], byId);
  } else if (move.kind === "shift") {
    next[move.i].team = next[move.i].team === "A" ? "B" : "A";
    if (move.reposI) togglePosition(next[move.i], byId);
  } else {
    togglePosition(next[move.i], byId);
  }
  return next;
}

/** Best-improvement hill climbing over swaps, shifts, and primary<->secondary repositioning. */
function repair(
  start: Assignment[],
  players: Player[],
  byId: Map<string, Player>,
  constraints: Constraints,
  maxIters = 300,
  positionsOnly = false
): Assignment[] {
  let current = start;
  let currentCost = costVector(current, byId, players, constraints);

  for (let iter = 0; iter < maxIters; iter++) {
    let best: Assignment[] | null = null;
    let bestCost = currentCost;

    const moves: Move[] = [];
    const n = current.length;
    const canRepos = (idx: number) => {
      const p = byId.get(current[idx].playerId)!;
      return p.secondary !== p.primary;
    };
    for (let i = 0; i < n; i++) {
      if (canRepos(i)) moves.push({ kind: "repos", i });
      if (positionsOnly) continue;
      for (let j = i + 1; j < n; j++) {
        if (current[i].team !== current[j].team) {
          moves.push({ kind: "swap", i, j });
          // Composite swap+reposition variants cross ridges a plain swap
          // can't (e.g. a compensating trade that only works if one player
          // simultaneously covers a different position).
          if (canRepos(i)) moves.push({ kind: "swap", i, j, reposI: true });
          if (canRepos(j)) moves.push({ kind: "swap", i, j, reposJ: true });
          if (canRepos(i) && canRepos(j))
            moves.push({ kind: "swap", i, j, reposI: true, reposJ: true });
        }
      }
      moves.push({ kind: "shift", i });
      if (canRepos(i)) moves.push({ kind: "shift", i, reposI: true });
    }

    for (const move of moves) {
      const candidate = applyMove(current, move, byId);
      const cost = costVector(candidate, byId, players, constraints);
      if (compareCost(cost, bestCost) < 0) {
        best = candidate;
        bestCost = cost;
      }
    }

    if (!best) break;
    current = best;
    currentCost = bestCost;
  }
  return current;
}

function signature(assignments: Assignment[]): string {
  // Team-symmetric signature so A/B mirror images count as the same split.
  const a = assignments
    .filter((x) => x.team === "A")
    .map((x) => x.playerId)
    .sort()
    .join(",");
  const b = assignments
    .filter((x) => x.team === "B")
    .map((x) => x.playerId)
    .sort()
    .join(",");
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/**
 * Deterministic perturbation: `strength` random cross-team swaps so each
 * restart explores a different basin (restart 0 is the pure snake seed).
 */
function perturb(
  assignments: Assignment[],
  strength: number,
  rng: () => number,
  byId: Map<string, Player>
): Assignment[] {
  const next = assignments.map((a) => ({ ...a }));
  for (let k = 0; k < strength; k++) {
    const aIdx = next.map((x, i) => (x.team === "A" ? i : -1)).filter((i) => i >= 0);
    const bIdx = next.map((x, i) => (x.team === "B" ? i : -1)).filter((i) => i >= 0);
    if (!aIdx.length || !bIdx.length) break;
    const i = aIdx[Math.floor(rng() * aIdx.length)];
    const j = bIdx[Math.floor(rng() * bIdx.length)];
    next[i].team = "B";
    next[j].team = "A";
    // Also jitter positions, so restarts explore arrangements that need a
    // player covering their secondary role from the start.
    const r = next[Math.floor(rng() * next.length)];
    const p = byId.get(r.playerId)!;
    if (p.secondary !== p.primary && rng() < 0.5) togglePosition(r, byId);
  }
  return next;
}

/**
 * Small pools (≤13): enumerate EVERY size-legal team split and polish each
 * with position-only repair. Incremental search can miss arrangements that
 * need several coordinated position changes; with ≤1716 splits, checking
 * them all is cheap and deterministic.
 */
function exhaustiveSmall(
  players: Player[],
  byId: Map<string, Player>,
  constraints: Constraints
): { assignments: Assignment[]; cost: number[] } | null {
  const n = players.length;
  if (n < 2 || n > 13) return null;
  const bigCount = Math.ceil(n / 2);
  let best: { assignments: Assignment[]; cost: number[] } | null = null;
  for (let mask = 0; mask < 1 << n; mask++) {
    let cnt = 0;
    for (let i = 0; i < n; i++) if (mask & (1 << i)) cnt++;
    if (cnt !== bigCount) continue;
    const start: Assignment[] = players.map((p, i) => ({
      playerId: p.id,
      team: mask & (1 << i) ? "A" : "B",
      position: p.primary,
      isSecondary: false,
    }));
    const polished = repair(start, players, byId, constraints, 40, true);
    const cost = costVector(polished, byId, players, constraints);
    if (!best || compareCost(cost, best.cost) < 0) {
      best = { assignments: polished, cost };
    }
  }
  return best;
}

export function buildTeams(
  players: Player[],
  constraints: Constraints,
  seed = 1,
  restarts = 12
): SplitResult {
  const byId = new Map(players.map((p) => [p.id, p]));
  let best: { assignments: Assignment[]; cost: number[] } | null = null;

  for (let r = 0; r < restarts; r++) {
    const rng = mulberry32(seed * 1000003 + r * 97);
    const seeded = seedAssignments(players, rng);
    const start = perturb(seeded, Math.min(r, 6), rng, byId);
    const repaired = repair(start, players, byId, constraints);
    const cost = costVector(repaired, byId, players, constraints);
    if (!best || compareCost(cost, best.cost) < 0) {
      best = { assignments: repaired, cost };
    }
  }

  const exhaustive = exhaustiveSmall(players, byId, constraints);
  if (exhaustive && compareCost(exhaustive.cost, best!.cost) < 0) {
    best = exhaustive;
  }

  return finalize(best!.assignments, players, byId, constraints, seed);
}

function finalize(
  assignments: Assignment[],
  players: Player[],
  byId: Map<string, Player>,
  constraints: Constraints,
  seed: number
): SplitResult {
  const teams = buildTeamViews(assignments, byId);
  const checks = buildChecks(assignments, players, byId, constraints);
  const flags = buildFlags(assignments, players, byId);
  return { assignments, teams, checks, flags, seed };
}

/**
 * Manual override: swap two players across teams, then re-verify everything.
 * The checks panel shows exactly what the human's swap broke (or fixed).
 */
export function manualSwap(
  previous: SplitResult,
  players: Player[],
  constraints: Constraints,
  playerIdX: string,
  playerIdY: string
): SplitResult {
  const byId = new Map(players.map((p) => [p.id, p]));
  const next = previous.assignments.map((a) => ({ ...a }));
  const x = next.find((a) => a.playerId === playerIdX);
  const y = next.find((a) => a.playerId === playerIdY);
  if (!x || !y || x.team === y.team) return previous;
  const t = x.team;
  x.team = y.team;
  y.team = t;
  return finalize(next, players, byId, constraints, previous.seed);
}

/** A re-roll: find the best split whose composition differs from `avoid`. */
export function rerollTeams(
  players: Player[],
  constraints: Constraints,
  previous: SplitResult,
  attempts = 6
): SplitResult {
  const avoid = signature(previous.assignments);
  let fallback: SplitResult | null = null;
  for (let k = 1; k <= attempts; k++) {
    const result = buildTeams(players, constraints, previous.seed + k);
    if (signature(result.assignments) !== avoid) return result;
    fallback = result;
  }
  return fallback ?? previous;
}
