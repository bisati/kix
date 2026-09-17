import { describe, expect, it } from "vitest";
import { DEMO_ROSTER } from "@/data/demo-roster";
import { buildTeams, rerollTeams } from "./index";
import { computeStats } from "./cost";
import { parseRosterCsv, serializeRosterCsv } from "../csv";
import { Player, POSITIONS } from "../types";

const NO_CONSTRAINTS = { apart: [], together: [] };

function statsOf(result: ReturnType<typeof buildTeams>, players: Player[]) {
  const byId = new Map(players.map((p) => [p.id, p]));
  return computeStats(result.assignments, byId);
}

function pick(names: string[]): Player[] {
  return names.map((n) => {
    const p = DEMO_ROSTER.find((x) => x.name === n);
    if (!p) throw new Error(`no demo player ${n}`);
    return p;
  });
}

describe("integrity (ladder rung 1)", () => {
  it("places every player exactly once, for many pool sizes", () => {
    for (const n of [6, 9, 12, 15, 22]) {
      const players = DEMO_ROSTER.slice(0, n);
      const result = buildTeams(players, NO_CONSTRAINTS, 7);
      const ids = result.assignments.map((a) => a.playerId).sort();
      expect(ids).toEqual(players.map((p) => p.id).sort());
      expect(
        result.checks.find((c) => c.id === "integrity")?.pass
      ).toBe(true);
    }
  });

  it("never assigns a position that is neither primary nor secondary", () => {
    const result = buildTeams(DEMO_ROSTER, NO_CONSTRAINTS, 3);
    const byId = new Map(DEMO_ROSTER.map((p) => [p.id, p]));
    for (const a of result.assignments) {
      const p = byId.get(a.playerId)!;
      expect([p.primary, p.secondary]).toContain(a.position);
    }
  });
});

describe("explicit constraints (rung 2)", () => {
  it("keeps an 'apart' pair on opposite teams", () => {
    const result = buildTeams(
      DEMO_ROSTER,
      { apart: [["Arjun", "Rohan"]], together: [] },
      11
    );
    const teamOf = new Map(result.assignments.map((a) => [a.playerId, a.team]));
    expect(teamOf.get("Arjun")).not.toBe(teamOf.get("Rohan"));
  });

  it("keeps a 'together' pair on the same team", () => {
    const result = buildTeams(
      DEMO_ROSTER,
      { apart: [], together: [["Ishan", "Aman"]] },
      11
    );
    const teamOf = new Map(result.assignments.map((a) => [a.playerId, a.team]));
    expect(teamOf.get("Ishan")).toBe(teamOf.get("Aman"));
  });
});

describe("position balance (rung 3)", () => {
  it("keeps every per-position gap ≤ 1 on the full demo roster", () => {
    const result = buildTeams(DEMO_ROSTER, NO_CONSTRAINTS, 5);
    const s = statsOf(result, DEMO_ROSTER);
    for (const pos of POSITIONS) {
      expect(
        Math.abs(s.A.posCount[pos] - s.B.posCount[pos]),
        `position ${pos}`
      ).toBeLessThanOrEqual(1);
    }
  });

  it("gives each team one keeper when two GKs play", () => {
    const players = pick([
      "Sanjay", "Omar", "Vikram", "Dev", "Arjun", "Rohan", "Ishan", "Farhan",
      "Aditya", "Rahul",
    ]);
    const result = buildTeams(players, NO_CONSTRAINTS, 2);
    const s = statsOf(result, players);
    expect(s.A.posCount.GK).toBe(1);
    expect(s.B.posCount.GK).toBe(1);
  });

  it("v1.3 regression: out-of-position burden is shared, never stacked (gap ≤ 1)", () => {
    const result = buildTeams(DEMO_ROSTER, NO_CONSTRAINTS, 9);
    const s = statsOf(result, DEMO_ROSTER);
    expect(Math.abs(s.A.secondaryCount - s.B.secondaryCount)).toBeLessThanOrEqual(1);
  });
});

describe("skill balance (rung 4)", () => {
  it("v1.1 regression: every skill tier splits with gap ≤ 1 — two 5s means one per team", () => {
    const result = buildTeams(DEMO_ROSTER, NO_CONSTRAINTS, 13);
    const s = statsOf(result, DEMO_ROSTER);
    for (const tier of [5, 4, 3, 2, 1]) {
      expect(
        Math.abs(s.A.tierCount[tier] - s.B.tierCount[tier]),
        `tier ${tier}`
      ).toBeLessThanOrEqual(1);
    }
  });

  it("keeps skill totals within 2 on the full demo roster", () => {
    const result = buildTeams(DEMO_ROSTER, NO_CONSTRAINTS, 17);
    const s = statsOf(result, DEMO_ROSTER);
    expect(Math.abs(s.A.skillTotal - s.B.skillTotal)).toBeLessThanOrEqual(2);
  });

  it("v1.6 regression: flagged game-controllers split with gap ≤ 1", () => {
    const result = buildTeams(DEMO_ROSTER, NO_CONSTRAINTS, 19);
    const s = statsOf(result, DEMO_ROSTER);
    expect(Math.abs(s.A.controllers - s.B.controllers)).toBeLessThanOrEqual(1);
  });

  it("v1.1 regression: with an odd headcount the extra player never lands on the stronger team", () => {
    // Pool chosen so tier extras CAN offset (5s 2v1, 3s 4v3, 2s 2v1 → 25 v 25):
    // the engine must find that split rather than leave the extra on a stronger side.
    const players = pick([
      "Sanjay", "Omar", // GKs (3, 2)
      "Vikram", "Arjun", "Ishan", // the three 5s
      "Dev", "Rohan", // two 4s
      "Harsh", "Ritvik", "Kabir", "Sameer", "Manav", "Nikhil", // six 3s
      "Zaid", "Tejas", // two 2s
    ]);
    const result = buildTeams(players, NO_CONSTRAINTS, 23);
    const s = statsOf(result, players);
    expect(Math.abs(s.A.count - s.B.count)).toBe(1);
    const larger = s.A.count > s.B.count ? s.A : s.B;
    const smaller = s.A.count > s.B.count ? s.B : s.A;
    expect(larger.skillTotal).toBeLessThanOrEqual(smaller.skillTotal);
    expect(Math.abs(s.A.skillTotal - s.B.skillTotal)).toBeLessThanOrEqual(2);
  });
});

describe("re-roll", () => {
  it("produces a different team composition than the previous split", () => {
    const first = buildTeams(DEMO_ROSTER, NO_CONSTRAINTS, 1);
    const second = rerollTeams(DEMO_ROSTER, NO_CONSTRAINTS, first);
    const sig = (r: typeof first) =>
      r.assignments.filter((a) => a.team === "A").map((a) => a.playerId).sort().join(",");
    expect(sig(second)).not.toBe(sig(first));
  });
});

describe("CSV", () => {
  it("parses the existing roster format, including 'Mid' and 'Full back' labels", () => {
    const csv = [
      "Name,Primary Position,Secondary Position,Skill Level,Running Ability,Game Control,Age",
      "Alpha,Mid,Winger,4,3,Yes,26-30",
      "Beta,Full back,GK,3,2,No,30-35",
      "Gamma,Gk,Full back,2,3,No,21-25",
    ].join("\n");
    const { players, errors } = parseRosterCsv(csv);
    expect(errors).toEqual([]);
    expect(players.map((p) => p.primary)).toEqual(["Midfield", "Full-back", "GK"]);
    expect(players[0].control).toBe(true);
    expect(players[1].control).toBe(false);
  });

  it("round-trips serialize → parse without loss", () => {
    const out = serializeRosterCsv(DEMO_ROSTER);
    const { players, errors } = parseRosterCsv(out);
    expect(errors).toEqual([]);
    expect(players).toEqual(DEMO_ROSTER.map((p) => ({ ...p, id: p.name })));
  });

  it("flags duplicate names instead of silently merging rows", () => {
    const csv = ["Name,Primary Position,Secondary Position,Skill Level", "X,Mid,Mid,3", "X,Mid,Mid,4"].join("\n");
    const { errors } = parseRosterCsv(csv);
    expect(errors.some((e) => e.includes("Duplicate"))).toBe(true);
  });
});
