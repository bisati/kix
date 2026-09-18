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
 * Every check is recomputed from the final assignments — the generator is
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

  // 3. Skill totals within 2 — or at this pool's tier-forced minimum.
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
        ? " — minimum possible for these tiers)"
        : gap > 2
        ? `; minimum possible is ${feas.minGap})`
        : ")"),
  });

  // 4. Tier spread ≤ 1 per tier.
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

  // 6. Controllers split ≤ 1, midfield control balanced.
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

  // 7. Odd headcount: the bigger team must not be stronger per player.
  // Raw totals can't be compared across unequal sizes — the extra body
  // inflates the bigger team's total by construction.
  if (s.A.count !== s.B.count) {
    const larger = s.A.count > s.B.count ? "A" : "B";
    const largerStats = larger === "A" ? s.A : s.B;
    const smallerStats = larger === "A" ? s.B : s.A;
    const perManOk =
      largerStats.skillTotal * smallerStats.count <=
      smallerStats.skillTotal * largerStats.count;
    const unavoidable = !perManOk && !feas.perManAchievable;
    const avg = (t: typeof largerStats) => (t.skillTotal / t.count).toFixed(2);
    checks.push({
      id: "odd-count",
      label: "Bigger team isn't stronger per player",
      pass: perManOk || unavoidable,
      detail:
        `Team ${larger} has ${largerStats.count} players at ${avg(largerStats)} avg vs ${smallerStats.count} at ${avg(smallerStats)}` +
        (unavoidable
          ? " — unavoidable: this pool's tiers force the extra onto the stronger side"
          : ""),
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
      flags.push(`Team ${team} has no keeper — rotates in goal.`);
    }
  }
  const secondaries = assignments.filter((a) => a.isSecondary);
  for (const a of secondaries) {
    const p = byId.get(a.playerId)!;
    flags.push(
      `${p.name} plays ${a.position} (primary: ${p.primary}) — Team ${a.team}`
    );
  }
  if (players.length % 2 === 1) {
    flags.push(`Odd headcount (${players.length}) — teams differ by one player.`);
  }
  return flags;
}
