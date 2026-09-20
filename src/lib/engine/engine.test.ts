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

describe("keepers — each goal filled whenever the squad allows", () => {
  const outfield = (
    id: string,
    primary: Player["primary"],
    secondary: Player["secondary"],
    skill: Player["skill"]
  ): Player => ({
    id, name: id, primary, secondary, skill, running: 3,
    control: false, ageBand: "26-30",
  });

  /** Reported 2026-09-18: nobody keeps for a living, two deputies available. */
  const DEPUTIES: Player[] = [
    outfield("Arun", "Defence", "GK", 3),
    outfield("Bilal", "Defence", "GK", 3),
    outfield("Chirag", "Defence", "Midfield", 4),
    outfield("Deepak", "Full-back", "Defence", 3),
    outfield("Farid", "Full-back", "Defence", 3),
    outfield("Gaurav", "Full-back", "Winger", 1),
    outfield("Imran", "Midfield", "Winger", 4),
    outfield("Karthik", "Midfield", "Defence", 3),
    outfield("Lokesh", "Midfield", "Striker", 5),
    outfield("Naveen", "Winger", "Striker", 3),
    outfield("Pritam", "Striker", "Winger", 3),
    outfield("Ravi", "Striker", "Midfield", 4),
  ];

  it("no specialist keeper but two deputies: both goals are filled", () => {
    for (const seed of [1, 4, 17, 33]) {
      const result = buildTeams(DEPUTIES, NO_CONSTRAINTS, seed);
      const s = statsOf(result, DEPUTIES);
      expect(s.A.posCount.GK, `seed ${seed} team A`).toBeGreaterThanOrEqual(1);
      expect(s.B.posCount.GK, `seed ${seed} team B`).toBeGreaterThanOrEqual(1);
      expect(result.checks.find((c) => c.id === "keepers")?.pass).toBe(true);
      expect(result.flags.join(" ")).not.toContain("no keeper");
    }
  });

  it("a lone deputy still keeps — one goal filled, the other team rotates", () => {
    const players = [
      outfield("OnlyKeeper", "Defence", "GK", 3),
      ...DEPUTIES.slice(2, 8),
    ];
    for (const seed of [2, 6, 21]) {
      const result = buildTeams(players, NO_CONSTRAINTS, seed);
      const s = statsOf(result, players);
      expect(s.A.posCount.GK + s.B.posCount.GK, `seed ${seed}`).toBe(1);
      const keeper = result.assignments.find((a) => a.position === "GK");
      expect(keeper?.playerId).toBe("OnlyKeeper");
      const check = result.checks.find((c) => c.id === "keepers");
      expect(check?.pass).toBe(true);
      expect(check?.detail).toContain("rotates in goal");
    }
  });

  it("a lone specialist keeps too, and the other team rotates", () => {
    const players = [
      { ...outfield("Sanjay", "GK", "GK", 3) },
      ...DEPUTIES.slice(2, 8),
    ];
    const result = buildTeams(players, NO_CONSTRAINTS, 4);
    const s = statsOf(result, players);
    expect(s.A.posCount.GK + s.B.posCount.GK).toBe(1);
    expect(result.checks.find((c) => c.id === "keepers")?.pass).toBe(true);
  });

  it("nobody able: both goals stay empty and the check says so", () => {
    const players = DEPUTIES.slice(2, 10);
    const result = buildTeams(players, NO_CONSTRAINTS, 5);
    const s = statsOf(result, players);
    expect(s.A.posCount.GK + s.B.posCount.GK).toBe(0);
    const check = result.checks.find((c) => c.id === "keepers");
    expect(check?.pass).toBe(true);
    expect(check?.detail).toContain("nobody here keeps");
  });

  it("two specialist keepers still take one goal each", () => {
    const players = pick([
      "Sanjay", "Omar", "Vikram", "Dev", "Arjun", "Rohan", "Ishan", "Farhan",
    ]);
    const result = buildTeams(players, NO_CONSTRAINTS, 2);
    const s = statsOf(result, players);
    expect(s.A.posCount.GK).toBe(1);
    expect(s.B.posCount.GK).toBe(1);
    expect(result.checks.find((c) => c.id === "keepers")?.pass).toBe(true);
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

describe("odd headcount — pricing the extra man (caps hard, margins lean small)", () => {
  it("tier caps hold REGARDLESS of headcount — the small team can never hoard quality", () => {
    // The reported bug: all 5s on one side, the other side all 4s and 3s.
    // Structural guardrail: every tier splits within ±1 even in odd games.
    for (const seed of [3, 7, 11]) {
      const players = DEMO_ROSTER.slice(0, 15);
      const result = buildTeams(players, NO_CONSTRAINTS, seed);
      const s = statsOf(result, players);
      for (const tier of [5, 4, 3, 2, 1]) {
        expect(
          Math.abs(s.A.tierCount[tier] - s.B.tierCount[tier]),
          `seed ${seed} tier ${tier}`
        ).toBeLessThanOrEqual(1);
      }
    }
  });

  it("inside the caps, quality leans to the man-down team (better per head)", () => {
    // Tiers 4s:2, 3s:6, 2s:1 → the lone 2 is the odd extra; it belongs to
    // the bigger team. Result: 13 v 15 — big side higher on paper, small
    // side better per head (3.25 v 3.00).
    const players = pick([
      "Dev", "Rohan", "Harsh", "Ritvik", "Kabir", "Sameer", "Manav", "Nikhil", "Zaid",
    ]);
    const result = buildTeams(players, NO_CONSTRAINTS, 7);
    const s = statsOf(result, players);
    const [big, small] = s.A.count > s.B.count ? [s.A, s.B] : [s.B, s.A];
    expect(small.skillTotal * big.count).toBeGreaterThanOrEqual(
      big.skillTotal * small.count
    ); // small avg >= big avg
    expect(result.checks.find((c) => c.id === "odd-count")?.pass).toBe(true);
    expect(result.checks.find((c) => c.id === "tiers")?.pass).toBe(true);
  });

  it("paper totals may look wrong — reported honestly, never fixed by breaking tiers", () => {
    // Pool {5,4,4,3,3}: caps force the 5 onto the 3-player side is illegal
    // (would stack a pair), so the big side carries 12 v 7. The engine must
    // keep tier caps, pass the check with an honest note, and offer the
    // rotation escape valve.
    const players = pick(["Vikram", "Dev", "Rohan", "Harsh", "Ritvik"]);
    const result = buildTeams(players, NO_CONSTRAINTS, 3);
    const s = statsOf(result, players);
    for (const tier of [5, 4, 3]) {
      expect(Math.abs(s.A.tierCount[tier] - s.B.tierCount[tier])).toBeLessThanOrEqual(1);
    }
    const odd = result.checks.find((c) => c.id === "odd-count");
    expect(odd?.pass).toBe(true);
    expect(odd?.detail).toContain("unavoidable");
    expect(result.flags.join(" ")).toContain("rotates one player off");
  });

  it("legs are a currency: passengers hide on the bigger team", () => {
    // Four equal 3s — two runners (5), two passengers (1) — plus a 2.
    // The man-down side should get runners; the extra-body side absorbs
    // the slow legs.
    const mk = (id: string, running: 1 | 5, primary: "Defence" | "Midfield"): Player => ({
      id, name: id, primary, secondary: primary === "Defence" ? "Full-back" : "Winger",
      skill: 3, running, control: false, ageBand: "26-30",
    });
    const players: Player[] = [
      mk("R1", 5, "Defence"), mk("R2", 5, "Midfield"),
      mk("P1", 1, "Defence"), mk("P2", 1, "Midfield"),
      { id: "X", name: "X", primary: "Striker", secondary: "Striker", skill: 2, running: 3, control: false, ageBand: "26-30" },
    ];
    const result = buildTeams(players, NO_CONSTRAINTS, 9);
    const s = statsOf(result, players);
    const small = s.A.count < s.B.count ? s.A : s.B;
    expect(small.lowRunners).toBe(0);
    expect(result.checks.find((c) => c.id === "legs")?.pass).toBe(true);
  });

  it("even pools are untouched: tier spread stays cardinal", () => {
    const result = buildTeams(DEMO_ROSTER, NO_CONSTRAINTS, 13);
    const s = statsOf(result, DEMO_ROSTER);
    for (const tier of [5, 4, 3, 2, 1]) {
      expect(
        Math.abs(s.A.tierCount[tier] - s.B.tierCount[tier]),
        `tier ${tier}`
      ).toBeLessThanOrEqual(1);
    }
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
