import {
  Assignment,
  Check,
  Constraints,
  Player,
  Position,
  POSITIONS,
  TeamView,
} from "../types";
import { computeStats, poolFeasibility } from "./cost";

const POSITION_ORDER: Record<Position, number> = {
  GK: 0,
  Defence: 1,
  "Full-back": 2,
  Midfield: 3,
  Winger: 4,
  Striker: 5,
};

export function buildTeamViews(
  assignments: Assignment[],
  byId: Map<string, Player>
): { A: TeamView; B: TeamView } {
  const make = (team: "A" | "B"): TeamView => {
    const rows = assignments
      .filter((a) => a.team === team)
      .map((a) => ({
        player: byId.get(a.playerId)!,
        position: a.position,
        isSecondary: a.isSecondary,
      }))
      .sort(
        (x, y) =>
          POSITION_ORDER[x.position] - POSITION_ORDER[y.position] ||
          y.player.skill - x.player.skill ||
          x.player.name.localeCompare(y.player.name)
      );
    const skillTotal = rows.reduce((s, r) => s + r.player.skill, 0);
    return {
      team,
      rows,
      skillTotal,
      skillAvg: rows.length ? skillTotal / rows.length : 0,
      runningTotal: rows.reduce((s, r) => s + r.player.running, 0),
      controllers: rows.filter((r) => r.player.control).length,
    };
  };
  return { A: make("A"), B: make("B") };
}

/**
 * The verify step from the original agent prompt, as data the UI renders.
 * Every check is recomputed from the final assignments. The generator is
 * never trusted to grade itself.
 */
export function buildChecks(
  assignments: Assignment[],
  players: Player[],
  byId: Map<string, Player>,
  constraints: Constraints
): Check[] {
  const checks: Check[] = [];
  const s = computeStats(assignments, byId);

  // 1. Every player appears exactly once.
  const seen = new Map<string, number>();
  for (const a of assignments)
    seen.set(a.playerId, (seen.get(a.playerId) ?? 0) + 1);
  const missing = players.filter((p) => !seen.has(p.id)).map((p) => p.name);
  const duped = players.filter((p) => (seen.get(p.id) ?? 0) > 1).map((p) => p.name);
  checks.push({
    id: "integrity",
    label: "Every player on exactly one team",
    pass: missing.length === 0 && duped.length === 0,
    detail:
      missing.length || duped.length
        ? [
            missing.length ? `missing: ${missing.join(", ")}` : "",
            duped.length ? `duplicated: ${duped.join(", ")}` : "",
          ]
            .filter(Boolean)
            .join(" · ")
        : `${players.length} in, ${assignments.length} placed`,
  });

  // 2. Position gaps ≤ 1.
  const posGaps = POSITIONS.map((pos) => ({
    pos,
    a: s.A.posCount[pos],
    b: s.B.posCount[pos],
  }));
  const badPos = posGaps.filter((g) => Math.abs(g.a - g.b) > 1);
  checks.push({
    id: "positions",
    label: "Per-position count gap ≤ 1",
    pass: badPos.length === 0,
    detail: posGaps
      .filter((g) => g.a + g.b > 0)
      .map((g) => `${g.pos} ${g.a}v${g.b}`)
      .join(" · "),
  });

  // 2b. Keepers. "Possible" means two players who can keep at all, by primary
  // or secondary, the same bar the shape rung uses, so the check never asks
  // for a keeper the squad cannot produce.
  const canKeep = players.filter(
    (p) => p.primary === "GK" || p.secondary === "GK"
  );
  const keeperNames = (team: "A" | "B") =>
    assignments
      .filter((a) => a.team === team && a.position === "GK")
      .map((a) => byId.get(a.playerId)?.name)
      .filter(Boolean)
      .join(", ");
  const namesA = keeperNames("A");
  const namesB = keeperNames("B");
  const goalsFilled =
    (s.A.posCount.GK > 0 ? 1 : 0) + (s.B.posCount.GK > 0 ? 1 : 0);
  const goalsWanted = Math.min(2, canKeep.length);
  const lone = namesA || namesB;
  checks.push({
    id: "keepers",
    label: "Every available keeper is in goal",
    pass: goalsFilled >= goalsWanted,
    detail:
      goalsWanted === 0
        ? "nobody here keeps, so both teams rotate in goal"
        : goalsFilled < goalsWanted
        ? `${goalsFilled} of ${goalsWanted} goals filled, though ${canKeep.length} here can keep`
        : goalsWanted === 1
        ? `${lone} keeps for Team ${namesA ? "A" : "B"}. Team ${
            namesA ? "B" : "A"
          } rotates in goal`
        : `${namesA} (A) · ${namesB} (B)`,
  });

  // 3. Skill totals within 2, or at this pool's tier-forced minimum.
  const feas = poolFeasibility(players);
  const gap = Math.abs(s.A.skillTotal - s.B.skillTotal);
  const atFloor = gap === feas.minGap;
  checks.push({
    id: "totals",
    label: "Skill totals as close as this pool allows",
    pass: gap <= 2 || atFloor,
    detail:
      `${s.A.skillTotal} v ${s.B.skillTotal} (gap ${gap}` +
      (gap > 2 && atFloor
        ? ", the minimum possible for these tiers)"
        : gap > 2
        ? `; minimum possible is ${feas.minGap})`
        : ")"),
  });

  // 4. Tier spread ≤ 1 per tier, hard for EVERY headcount. The structural
  // guardrail: the man-down team can never hoard quality wholesale.
  const tierDetail = [5, 4, 3, 2, 1]
    .filter((t) => s.A.tierCount[t] + s.B.tierCount[t] > 0)
    .map((t) => `${t}s ${s.A.tierCount[t]}v${s.B.tierCount[t]}`)
    .join(" · ");
  const badTier = [5, 4, 3, 2, 1].filter(
    (t) => Math.abs(s.A.tierCount[t] - s.B.tierCount[t]) > 1
  );
  checks.push({
    id: "tiers",
    label: "Every skill tier split evenly (gap ≤ 1)",
    pass: badTier.length === 0,
    detail: tierDetail,
  });

  // 5. Secondary placements spread ≤ 1.
  checks.push({
    id: "secondaries",
    label: "Out-of-position burden shared (gap ≤ 1)",
    pass: Math.abs(s.A.secondaryCount - s.B.secondaryCount) <= 1,
    detail: `${s.A.secondaryCount} v ${s.B.secondaryCount} secondary placements`,
  });

  // 6. Controllers split ≤ 1, hard for every headcount.
  checks.push({
    id: "controllers",
    label: "Game-controllers split evenly (gap ≤ 1)",
    pass: Math.abs(s.A.controllers - s.B.controllers) <= 1,
    detail: `${s.A.controllers} v ${s.B.controllers} controllers`,
  });
  checks.push({
    id: "mid-control",
    label: "Midfield control balanced (controllers ≤ 1 apart, skill within 2)",
    pass:
      Math.abs(s.A.midControllers - s.B.midControllers) <= 1 &&
      Math.abs(s.A.midSkill - s.B.midSkill) <= 2,
    detail: `mid controllers ${s.A.midControllers}v${s.B.midControllers} · mid skill ${s.A.midSkill}v${s.B.midSkill}`,
  });

  // 7. Odd headcount: with equal averages the bigger team simply wins, so
  // the smaller team must carry at least as much total skill. The missing
  // body is paid for in quality.
  if (s.A.count !== s.B.count) {
    const larger = s.A.count > s.B.count ? "A" : "B";
    const largerStats = larger === "A" ? s.A : s.B;
    const smallerStats = larger === "A" ? s.B : s.A;
    // The bigger team may hold the higher TOTAL (tier caps force it, and that
    // paper number is correct, not a bug); what must lean man-down is
    // quality PER HEAD.
    const smallLeads =
      smallerStats.skillTotal * largerStats.count >=
      largerStats.skillTotal * smallerStats.count;
    const unavoidable = !smallLeads && !feas.smallLeanAchievable;
    const avg = (t: typeof largerStats) => (t.skillTotal / t.count).toFixed(2);
    checks.push({
      id: "odd-count",
      label: "Man-down team is better per head",
      pass: smallLeads || unavoidable,
      detail:
        `${smallerStats.count} players at ${avg(smallerStats)} avg vs ${largerStats.count} at ${avg(largerStats)} (totals ${smallerStats.skillTotal} v ${largerStats.skillTotal}${largerStats.skillTotal > smallerStats.skillTotal ? ", bigger side higher on paper is the tier caps working" : ""})` +
        (unavoidable
          ? ". Unavoidable: no tier-legal split leans quality man-down here"
          : ""),
    });

    // Legs: the man-down team covers more ground per player, so passengers
    // (running ≤ 2) hide on the bigger team where there's cover.
    checks.push({
      id: "legs",
      label: "Bigger team carries the slower legs",
      pass: largerStats.lowRunners >= smallerStats.lowRunners,
      detail: `slow legs (run ≤ 2): ${largerStats.lowRunners} on the bigger team, ${smallerStats.lowRunners} on the man-down team · running per head ${(smallerStats.runningTotal / smallerStats.count).toFixed(1)} v ${(largerStats.runningTotal / largerStats.count).toFixed(1)}`,
    });
  }

  // 8. Explicit user constraints.
  if (constraints.apart.length || constraints.together.length) {
    const teamOf = new Map(assignments.map((a) => [a.playerId, a.team]));
    const broken: string[] = [];
    for (const [x, y] of constraints.apart) {
      if (teamOf.get(x) === teamOf.get(y))
        broken.push(`${byId.get(x)?.name} & ${byId.get(y)?.name} together (should be apart)`);
    }
    for (const [x, y] of constraints.together) {
      if (teamOf.get(x) !== teamOf.get(y))
        broken.push(`${byId.get(x)?.name} & ${byId.get(y)?.name} apart (should be together)`);
    }
    checks.push({
      id: "constraints",
      label: "Your pinned constraints honored",
      pass: broken.length === 0,
      detail: broken.length ? broken.join(" · ") : "all honored",
    });
  }

  return checks;
}

export function buildFlags(
  assignments: Assignment[],
  players: Player[],
  byId: Map<string, Player>
): string[] {
  const flags: string[] = [];
  // GK situation, derived from the final assignments.
  for (const team of ["A", "B"] as const) {
    const teamAssignments = assignments.filter((a) => a.team === team);
    if (
      teamAssignments.length > 0 &&
      !teamAssignments.some((a) => a.position === "GK")
    ) {
      flags.push(`Team ${team} has no keeper, so it rotates in goal.`);
    }
  }
  const secondaries = assignments.filter((a) => a.isSecondary);
  for (const a of secondaries) {
    const p = byId.get(a.playerId)!;
    flags.push(
      `${p.name} plays ${a.position} (primary: ${p.primary}) on Team ${a.team}`
    );
  }
  if (players.length % 2 === 1) {
    flags.push(`Odd headcount (${players.length}): teams differ by one player.`);
    // Escape valve: when the tier-forced gap gets ugly, offer the rotation
    // option that turns an odd game into an even one with rolling fresh legs.
    const s = computeStats(assignments, byId);
    const big = s.A.count > s.B.count ? s.A : s.B;
    const small = s.A.count > s.B.count ? s.B : s.A;
    if (big.skillTotal - small.skillTotal >= 3) {
      flags.push(
        "Forced gap is large today. One option: the bigger team rotates one player off every ten minutes for an even game with fresh legs."
      );
    }
  }
  return flags;
}
