import { Constraints, Player, Position } from "./types";

/**
 * Match-day instructions: deterministic tweaks the engine follows for one
 * game only. They never touch the engine itself. They compile into inputs
 * it already understands: constraint pairs and transformed player attributes.
 */

export type Severity = "mild" | "serious";

export interface OverrideValues {
  primary: Position;
  secondary: Position;
  skill: Player["skill"];
  running: Player["running"];
  control: boolean;
}

export type Instruction =
  | { kind: "pair"; mode: "apart" | "together"; a: string; b: string }
  | { kind: "injury"; playerId: string; severity: Severity }
  | { kind: "override"; playerId: string; values: OverrideValues };

const clampRating = (n: number) =>
  Math.min(5, Math.max(1, n)) as Player["skill"];

/**
 * Applies today's overrides and injuries to the player pool.
 * Order: a custom rating redefines the player's baseline for today,
 * then an injury reduction applies on top of that baseline.
 * Ratings clamp to the 1–5 scale.
 */
export function applyInstructions(
  players: Player[],
  instructions: Instruction[]
): Player[] {
  const overrides = new Map<string, OverrideValues>();
  const injuries = new Map<string, Severity>();
  for (const ins of instructions) {
    if (ins.kind === "override") overrides.set(ins.playerId, ins.values);
    if (ins.kind === "injury") injuries.set(ins.playerId, ins.severity);
  }

  return players.map((p) => {
    let out: Player = { ...p };
    const o = overrides.get(p.id);
    if (o) out = { ...out, ...o };
    const severity = injuries.get(p.id);
    if (severity === "mild") {
      out.running = clampRating(out.running - 1);
    } else if (severity === "serious") {
      out.running = clampRating(out.running - 2);
      out.skill = clampRating(out.skill - 1);
    }
    return out;
  });
}

export function toConstraints(instructions: Instruction[]): Constraints {
  const apart: [string, string][] = [];
  const together: [string, string][] = [];
  for (const ins of instructions) {
    if (ins.kind !== "pair") continue;
    (ins.mode === "apart" ? apart : together).push([ins.a, ins.b]);
  }
  return { apart, together };
}

/** Drop instructions that reference players no longer in the roster. */
export function pruneInstructions(
  instructions: Instruction[],
  validIds: Set<string>
): Instruction[] {
  return instructions.filter((ins) =>
    ins.kind === "pair"
      ? validIds.has(ins.a) && validIds.has(ins.b)
      : validIds.has(ins.playerId)
  );
}
