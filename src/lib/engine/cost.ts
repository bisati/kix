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

  // Odd headcount: the extra player must sit on the team with the LOWER total.
  let oddPlacement = 0;
  if (s.A.count !== s.B.count) {
    const larger = s.A.count > s.B.count ? s.A : s.B;
    const smaller = s.A.count > s.B.count ? s.B : s.A;
    if (larger.skillTotal > smaller.skillTotal) oddPlacement = 1;
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
    totalGap,
    oddPlacement,
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
