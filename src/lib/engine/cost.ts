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
  /** Smallest total-skill gap any tier-legal split of this pool can achieve. */
  minGap: number;
  /**
   * Odd pools: can any tier-legal split make the bigger team no stronger
   * per player than the smaller one? (Even pools: trivially true.)
   */
  perManAchievable: boolean;
}

/**
 * What the pool's tier structure allows, independent of any split. Under
 * tier-legality (gap ≤ 1 per tier), per-team totals are fully determined by
 * which side each odd tier's extra player lands on — so enumerating those
 * ≤ 2^5 assignments gives exact bounds. Checks use this to grade the engine
 * against what is achievable, never against impossible arithmetic.
 */
export function poolFeasibility(players: Player[]): PoolFeasibility {
  let base = 0; // per-side total from evenly split tiers
  let K = 0; // per-side player count from evenly split tiers
  const extras: number[] = []; // one entry (the skill value) per odd tier
  for (const tier of [5, 4, 3, 2, 1]) {
    const c = players.filter((p) => p.skill === tier).length;
    const k = Math.floor(c / 2);
    K += k;
    base += k * tier;
    if (c % 2 === 1) extras.push(tier);
  }
  const m = extras.length;
  if (m === 0) return { minGap: 0, perManAchievable: true };

  const extrasSum = extras.reduce((s, e) => s + e, 0);
  let minGap = Infinity;
  let perManAchievable = false;
  for (let mask = 0; mask < 1 << m; mask++) {
    let s1 = 0;
    let c1 = 0;
    for (let i = 0; i < m; i++) {
      if (mask & (1 << i)) {
        s1 += extras[i];
        c1++;
      }
    }
    const c2 = m - c1;
    if (Math.abs(c1 - c2) > 1) continue; // headcount must stay within 1
    const t1 = base + s1;
    const t2 = base + (extrasSum - s1);
    minGap = Math.min(minGap, Math.abs(t1 - t2));
    if (c1 === c2) {
      perManAchievable = true; // even headcount: per-man rule not in play
    } else {
      const [bt, bn, st, sn] =
        c1 > c2 ? [t1, K + c1, t2, K + c2] : [t2, K + c2, t1, K + c1];
      if (bt * sn <= st * bn) perManAchievable = true;
    }
  }
  return { minGap, perManAchievable };
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

  // Odd headcount: the bigger team must not be stronger PER PLAYER — the
  // extra body compensates the weaker side (raw totals can't be compared
  // across unequal team sizes; the extra body inflates them by construction).
  let oddPlacement = 0;
  if (s.A.count !== s.B.count) {
    const larger = s.A.count > s.B.count ? s.A : s.B;
    const smaller = s.A.count > s.B.count ? s.B : s.A;
    if (larger.skillTotal * smaller.count > smaller.skillTotal * larger.count)
      oddPlacement = 1;
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
    ...tierViolations,
    controllerGap,
    midControllerGap,
    midSkillExcess,
    totalExcess,
    oddPlacement, // per-man fairness outranks shaving the raw gap
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
