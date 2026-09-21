export const POSITIONS = [
  "GK",
  "Defence",
  "Full-back",
  "Midfield",
  "Winger",
  "Striker",
] as const;

export type Position = (typeof POSITIONS)[number];

/** Short labels for badges and team sheets. */
export const POS_SHORT: Record<Position, string> = {
  GK: "GK",
  Defence: "DEF",
  "Full-back": "FB",
  Midfield: "MID",
  Winger: "WNG",
  Striker: "ST",
};

export interface Player {
  id: string;
  name: string;
  primary: Position;
  secondary: Position;
  skill: 1 | 2 | 3 | 4 | 5;
  running: 1 | 2 | 3 | 4 | 5;
  control: boolean;
  ageBand: string; // e.g. "26-30"
}

export type TeamId = "A" | "B";

export interface Assignment {
  playerId: string;
  team: TeamId;
  position: Position;
  isSecondary: boolean;
}

export interface Constraints {
  // pairs of player ids that must be on opposite teams
  apart: [string, string][];
  // pairs of player ids that must be on the same team
  together: [string, string][];
}

export interface Check {
  id: string;
  label: string;
  pass: boolean;
  detail: string;
}

export interface TeamView {
  team: TeamId;
  rows: { player: Player; position: Position; isSecondary: boolean }[];
  skillTotal: number;
  skillAvg: number;
  runningTotal: number;
  controllers: number;
}

export interface SplitResult {
  assignments: Assignment[];
  teams: { A: TeamView; B: TeamView };
  checks: Check[];
  flags: string[];
  seed: number;
}

/** Age band lower bound, used only for the 40+ mobility tiebreak. */
export function ageLower(band: string): number {
  const m = band.match(/^(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}
