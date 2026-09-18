import {
  Assignment,
  Constraints,
  Player,
  Position,
  POSITIONS,
  TeamId,
  ageLower,
} from "../types";

export interface TeamStats {
  count: number;
  posCount: Record<Position, number>;
  tierCount: Record<number, number>; // skill 1..5
  skillTotal: number;
  runningTotal: number;
  lowRunners: number; // running <= 2
  over40: number;
  controllers: number;
  midControllers: number;
  midSkill: number;
  secondaryCount: number;
}

export interface SplitStats {
  A: TeamStats;
  B: TeamStats;
}

function emptyStats(): TeamStats {
  const posCount = Object.fromEntries(POSITIONS.map((p) => [p, 0])) as Record<
    Position,
    number
  >;
  return {
    count: 0,
    posCount,
    tierCount: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    skillTotal: 0,
    runningTotal: 0,
    lowRunners: 0,
    over40: 0,
    controllers: 0,
    midControllers: 0,
    midSkill: 0,
    secondaryCount: 0,
  };
}

export function computeStats(
  assignments: Assignment[],
  byId: Map<string, Player>
): SplitStats {
  const stats = { A: emptyStats(), B: emptyStats() };
  for (const a of assignments) {
    const p = byId.get(a.playerId);
    if (!p) continue;
    const t = stats[a.team];
    t.count++;
    t.posCount[a.position]++;
    t.tierCount[p.skill]++;
    t.skillTotal += p.skill;
    t.runningTotal += p.running;
    if (p.running <= 2) t.lowRunners++;
    if (ageLower(p.ageBand) >= 40) t.over40++;
    if (p.control) t.controllers++;
    if (a.position === "Midfield") {
      t.midSkill += p.skill;
      if (p.control) t.midControllers++;
    }
    if (a.isSecondary) t.secondaryCount++;
  }
  return stats;
}

/** How many players in the pool could legally play `pos` (primary or secondary). */
function poolFor(pos: Position, players: Player[]): number {
  return players.filter((p) => p.primary === pos || p.secondary === pos).length;
}

export interface PoolFeasibility {
  /** Smallest total-skill gap any legal split of this pool can achieve. */
  minGap: number;
  /**
   * Odd pools: the smallest achievable (bigger-team total − smaller-team
   * total) over ALL size-legal splits. ≤ 0 means the smaller side CAN be
   * made at least as strong (compensation is possible). Even pools: 0.
   */
  minBigExcess: number;
}

/**
 * What this pool allows, independent of any particular split. Checks use it
 * to grade the engine against what is achievable, never against impossible
 * arithmetic.
 *
 * Odd pools: tier mirroring is deliberately relaxed for compensation, so the
 * bound ranges over ALL big-side subsets (exact subset-sum DP). Even pools:
 * tier spread is cardinal, so totals are determined by which side each odd
 * tier's extra lands on — enumerate those ≤ 2^5 assignments.
 */
export function poolFeasibility(players: Player[]): PoolFeasibility {
  const n = players.length;
  if (n < 2) return { minGap: 0, minBigExcess: 0 };
  const total = players.reduce((s, p) => s + p.skill, 0);

  if (n % 2 === 1) {
    const bigCount = Math.ceil(n / 2);
    // dp[c][s] = a c-player subset with skill sum s exists
    const dp: boolean[][] = Array.from({ length: bigCount + 1 }, () =>
      new Array(total + 1).fill(false)
    );
    dp[0][0] = true;
    for (const p of players) {
      for (let c = bigCount; c >= 1; c--) {
        for (let s = total; s >= p.skill; s--) {
          if (dp[c - 1][s - p.skill]) dp[c][s] = true;
        }
      }
    }
    let minGap = Infinity;
    let minBigExcess = Infinity;
    for (let s = 0; s <= total; s++) {
      if (!dp[bigCount][s]) continue;
      const excess = s - (total - s); // bigTotal − smallTotal
      minGap = Math.min(minGap, Math.abs(excess));
      minBigExcess = Math.min(minBigExcess, excess);
    }
    return { minGap, minBigExcess };
  }

  // Even pool: floor under tier-legality via odd-tier extras enumeration.
  let base = 0;
  const extras: number[] = [];
  for (const tier of [5, 4, 3, 2, 1]) {
    const c = players.filter((p) => p.skill === tier).length;
    base += Math.floor(c / 2) * tier;
    if (c % 2 === 1) extras.push(tier);
  }
  const m = extras.length;
  if (m === 0) return { minGap: 0, minBigExcess: 0 };
  const extrasSum = extras.reduce((s, e) => s + e, 0);
  let minGap = Infinity;
  for (let mask = 0; mask < 1 << m; mask++) {
    let s1 = 0;
    let c1 = 0;
    for (let i = 0; i < m; i++) {
      if (mask & (1 << i)) {
        s1 += extras[i];
        c1++;
      }
    }
    if (Math.abs(c1 - (m - c1)) > 1) continue;
    minGap = Math.min(minGap, Math.abs(base + s1 - (base + extrasSum - s1)));
  }
  return { minGap, minBigExcess: 0 };
}

/**
 * Lexicographic cost vector, lower is better. Order mirrors the priority
 * ladder: constraints > position balance & shape > secondary spread >
 * tier spread (5s..1s) > controllers > midfield control > totals >
 * odd-count placement > mobility tiebreaks > fewest secondaries.
 */
export function costVector(
  assignments: Assignment[],
  byId: Map<string, Player>,
  players: Player[],
  constraints: Constraints
): number[] {
  const s = computeStats(assignments, byId);
  const teamOf = new Map<string, TeamId>();
  for (const a of assignments) teamOf.set(a.playerId, a.team);

  let constraintViolations = 0;
  for (const [x, y] of constraints.apart) {
    if (teamOf.has(x) && teamOf.has(y) && teamOf.get(x) === teamOf.get(y))
      constraintViolations++;
  }
  for (const [x, y] of constraints.together) {
    if (teamOf.has(x) && teamOf.has(y) && teamOf.get(x) !== teamOf.get(y))
      constraintViolations++;
  }

  const headcount = Math.max(0, Math.abs(s.A.count - s.B.count) - 1);

  let posImbalance = 0;
  for (const pos of POSITIONS) {
    posImbalance += Math.max(
      0,
      Math.abs(s.A.posCount[pos] - s.B.posCount[pos]) - 1
    );
  }

  // Football shape: each team fields >=1 Defence and >=1 Midfield whenever the pool allows.
  let shape = 0;
  for (const pos of ["Defence", "Midfield"] as Position[]) {
    if (poolFor(pos, players) >= 2) {
      if (s.A.posCount[pos] === 0) shape++;
      if (s.B.posCount[pos] === 0) shape++;
    }
  }

  const secondarySpread = Math.max(
    0,
    Math.abs(s.A.secondaryCount - s.B.secondaryCount) - 1
  );

  const tierViolations = [5, 4, 3, 2, 1].map((tier) =>
    Math.max(0, Math.abs(s.A.tierCount[tier] - s.B.tierCount[tier]) - 1)
  );

  const controllerGap = Math.max(
    0,
    Math.abs(s.A.controllers - s.B.controllers) - 1
  );
  const midControllerGap = Math.max(
    0,
    Math.abs(s.A.midControllers - s.B.midControllers) - 1
  );
  const midSkillExcess = Math.max(0, Math.abs(s.A.midSkill - s.B.midSkill) - 2);

  const totalGap = Math.abs(s.A.skillTotal - s.B.skillTotal);
  const totalExcess = Math.max(0, totalGap - 2);

  // Odd headcount: with equal averages the bigger team simply wins, so the
  // smaller team must carry MORE total skill — the missing body is paid for
  // in quality. Bigger side ahead = penalized (oddDirection); smaller side
  // ahead by more than 2 = over-compensation (smallLeadExcess).
  let oddDirection = 0;
  let smallLeadExcess = 0;
  if (s.A.count !== s.B.count) {
    const larger = s.A.count > s.B.count ? s.A : s.B;
    const smaller = s.A.count > s.B.count ? s.B : s.A;
    oddDirection = Math.max(0, larger.skillTotal - smaller.skillTotal);
    smallLeadExcess = Math.max(
      0,
      smaller.skillTotal - larger.skillTotal - 2
    );
  }

  const runningGap = Math.abs(s.A.runningTotal - s.B.runningTotal);
  const lowRunnerGap = Math.abs(s.A.lowRunners - s.B.lowRunners);
  const over40Gap = Math.abs(s.A.over40 - s.B.over40);
  const totalSecondaries = s.A.secondaryCount + s.B.secondaryCount;

  return [
    constraintViolations,
    headcount,
    posImbalance,
    shape,
    secondarySpread,
    // Odd-game compensation outranks tier mirroring: the smaller team takes
    // the stronger players (with the minimum stacking the terms below allow).
    oddDirection,
    smallLeadExcess,
    ...tierViolations,
    controllerGap,
    midControllerGap,
    midSkillExcess,
    totalExcess,
    totalGap,
    runningGap,
    lowRunnerGap,
    over40Gap,
    totalSecondaries,
  ];
}

/** Lexicographic compare: negative if a is better (lower) than b. */
export function compareCost(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}
