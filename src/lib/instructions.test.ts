import { describe, expect, it } from "vitest";
import { Player } from "./types";
import {
  applyInstructions,
  pruneInstructions,
  toConstraints,
} from "./instructions";

const player = (over: Partial<Player>): Player => ({
  id: "X",
  name: "X",
  primary: "Midfield",
  secondary: "Midfield",
  skill: 4,
  running: 3,
  control: false,
  ageBand: "26-30",
  ...over,
});

describe("injuries", () => {
  it("mild: running −1, skill untouched", () => {
    const [p] = applyInstructions(
      [player({})],
      [{ kind: "injury", playerId: "X", severity: "mild" }]
    );
    expect(p.running).toBe(2);
    expect(p.skill).toBe(4);
  });

  it("serious: running −2 and skill −1", () => {
    const [p] = applyInstructions(
      [player({})],
      [{ kind: "injury", playerId: "X", severity: "serious" }]
    );
    expect(p.running).toBe(1);
    expect(p.skill).toBe(3);
  });

  it("never drops a rating below 1", () => {
    const [p] = applyInstructions(
      [player({ skill: 1, running: 1 })],
      [{ kind: "injury", playerId: "X", severity: "serious" }]
    );
    expect(p.running).toBe(1);
    expect(p.skill).toBe(1);
  });
});

describe("today's custom rating", () => {
  it("replaces attributes for the day without touching the base object", () => {
    const base = player({});
    const [p] = applyInstructions(
      [base],
      [
        {
          kind: "override",
          playerId: "X",
          values: {
            primary: "Striker",
            secondary: "Winger",
            skill: 2,
            running: 5,
            control: true,
          },
        },
      ]
    );
    expect(p.primary).toBe("Striker");
    expect(p.skill).toBe(2);
    expect(p.control).toBe(true);
    expect(base.skill).toBe(4); // roster itself untouched
  });

  it("injury applies on top of today's override baseline", () => {
    const [p] = applyInstructions(
      [player({})],
      [
        {
          kind: "override",
          playerId: "X",
          values: {
            primary: "Midfield",
            secondary: "Midfield",
            skill: 5,
            running: 4,
            control: false,
          },
        },
        { kind: "injury", playerId: "X", severity: "serious" },
      ]
    );
    expect(p.running).toBe(2); // 4 − 2
    expect(p.skill).toBe(4); // 5 − 1
  });
});

describe("pairs and pruning", () => {
  it("compiles pair instructions into engine constraints", () => {
    const c = toConstraints([
      { kind: "pair", mode: "apart", a: "X", b: "Y" },
      { kind: "pair", mode: "together", a: "P", b: "Q" },
      { kind: "injury", playerId: "X", severity: "mild" },
    ]);
    expect(c.apart).toEqual([["X", "Y"]]);
    expect(c.together).toEqual([["P", "Q"]]);
  });

  it("prunes instructions referencing departed players", () => {
    const pruned = pruneInstructions(
      [
        { kind: "pair", mode: "apart", a: "X", b: "GONE" },
        { kind: "injury", playerId: "X", severity: "mild" },
        { kind: "injury", playerId: "GONE", severity: "mild" },
      ],
      new Set(["X"])
    );
    expect(pruned).toEqual([{ kind: "injury", playerId: "X", severity: "mild" }]);
  });
});
