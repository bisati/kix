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
   * Odd pools: can some tier-legal extras assignment make the man-down team
   * at least as strong per head as the bigger one? Even pools: true.
   */
  smallLeanAchievable: boolean;
}

/**
 * What this pool's tier structure allows, independent of any split. Tier
 * caps (±1) are hard for every headcount, so per-team totals are fully
 * determined by which side each odd tier's extra lands on — enumerating
 * those ≤ 2^5 assignments gives exact bounds. Checks use this to grade the
 * engine against what is achievable, never against impossible arithmetic.
 */
export function poolFeasibility(players: Player[]): PoolFeasibility {
  const n = players.length;
  if (n < 2) return { minGap: 0, smallLeanAchievable: true };

  let base = 0; // per-side total from evenly split tiers
  let K = 0; // per-side player count from evenly split tiers
  const extras: number[] = [];
  for (const tier of [5, 4, 3, 2, 1]) {
    const c = players.filter((p) => p.skill === tier).length;
    const k = Math.floor(c / 2);
    K += k;
    base += k * tier;
    if (c % 2 === 1) extras.push(tier);
  }
  const m = extras.length;
  if (m === 0) return { minGap: 0, smallLeanAchievable: true };

  const extrasSum = extras.reduce((s, e) => s + e, 0);
  let minGap = Infinity;
  let smallLeanAchievable = n % 2 === 0;
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
    if (Math.abs(c1 - c2) > 1) continue;
    const t1 = base + s1;
    const t2 = base + (extrasSum - s1);
    minGap = Math.min(minGap, Math.abs(t1 - t2));
    if (c1 !== c2) {
      const [bt, bn, st, sn] =
        c1 > c2 ? [t1, K + c1, t2, K + c2] : [t2, K + c2, t1, K + c1];
      // small per-head >= big per-head, in integers
      if (st * bn >= bt * sn) smallLeanAchievable = true;
    }
  }
  return { minGap, smallLeanAchievable };
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

  // Football shape: each team fields a keeper, >=1 Defence and >=1 Midfield
  // whenever the pool allows. A keeper counts here and not among the mobility
  // tiebreaks because an empty goal changes the game, not the margins — and
  // "allows" means two people who can keep, by primary OR secondary, so a
  // squad with no specialist still gets both goals filled by its deputies.
  let shape = 0;
  for (const pos of ["GK", "Defence", "Midfield"] as Position[]) {
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

  // Odd headcount — "pricing the extra man". Tier caps stay hard (the terms
  // above); compensation happens only in the margins inside them:
  //   oddTierLean:  each tier's odd extra should sit with the BIGGER team
  //                 when it's a low tier, i.e. the ceil-side-on-big penalty
  //                 is the tier's value — so quality extras lean man-down.
  //   passengerLean/runHeadLean: the man-down team gets the legs; slow
  //                 players hide where there's cover.
  //   gkStructural: a lone fixed keeper belongs to the short side; the
  //                 extra-man side can afford to rotate.
  let oddTierLean = 0;
  let passengerLean = 0;
  let runHeadLean = 0;
  let gkStructural = 0;
  if (s.A.count !== s.B.count) {
    const big = s.A.count > s.B.count ? s.A : s.B;
    const small = s.A.count > s.B.count ? s.B : s.A;
    for (const tier of [5, 4, 3, 2, 1]) {
      if (big.tierCount[tier] > small.tierCount[tier]) oddTierLean += tier;
    }
    // Absolute, not relative: every slow pair of legs on the man-down side
    // costs — passengers hide on the bigger team where there's cover.
    passengerLean = small.lowRunners;
    runHeadLean = Math.max(
      0,
      big.runningTotal * small.count - small.runningTotal * big.count
    );
    if (big.posCount.GK + small.posCount.GK === 1 && big.posCount.GK === 1)
      gkStructural = 1;
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
    ...tierViolations, // hard for ALL headcounts — quality can never be hoarded
    controllerGap,
    midControllerGap,
    midSkillExcess,
    totalExcess,
    oddTierLean, // inside the caps: quality extras lean to the man-down team
    totalGap,
    passengerLean,
    runHeadLean,
    gkStructural,
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
