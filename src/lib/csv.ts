import { Player, Position } from "./types";

/** Normalize the position labels people actually type to the six canon values. */
export function normalizePosition(raw: string): Position | null {
  const s = raw.trim().toLowerCase().replace(/[_-]/g, " ");
  if (["gk", "goalkeeper", "keeper", "goalie"].includes(s)) return "GK";
  if (["defence", "defense", "def", "cb", "centre back", "center back"].includes(s))
    return "Defence";
  if (["full back", "fullback", "fb", "rb", "lb"].includes(s)) return "Full-back";
  if (["mid", "midfield", "midfielder", "cm", "cdm", "cam"].includes(s))
    return "Midfield";
  if (["winger", "wing", "rw", "lw"].includes(s)) return "Winger";
  if (["striker", "st", "forward", "cf"].includes(s)) return "Striker";
  return null;
}

export interface CsvParseResult {
  players: Player[];
  errors: string[];
}

/**
 * Parses the roster CSV format:
 * Name,Primary Position,Secondary Position,Skill Level,Running Ability,Game Control,Age
 * Running Ability and Game Control are optional columns (older rosters lack them).
 */
export function parseRosterCsv(text: string): CsvParseResult {
  const errors: string[] = [];
  const players: Player[] = [];
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return { players, errors: ["Empty file."] };

  const header = lines[0].toLowerCase();
  const startAt = header.includes("name") && header.includes("position") ? 1 : 0;

  const clampRating = (raw: string, fallback: number): number => {
    const n = parseInt(raw, 10);
    if (Number.isNaN(n)) return fallback;
    return Math.min(5, Math.max(1, n));
  };

  for (let i = startAt; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim());
    if (cols.length < 4) {
      errors.push(`Line ${i + 1}: expected at least 4 columns.`);
      continue;
    }
    const [name, primaryRaw, secondaryRaw, skillRaw, runningRaw, controlRaw, age] =
      [cols[0], cols[1], cols[2], cols[3], cols[4] ?? "", cols[5] ?? "", cols[6] ?? ""];
    const primary = normalizePosition(primaryRaw);
    const secondary = normalizePosition(secondaryRaw) ?? primary;
    if (!name || !primary) {
      errors.push(`Line ${i + 1}: bad name or position ("${lines[i]}").`);
      continue;
    }
    players.push({
      id: name, // names are unique in this workflow ("Alex Sr." vs "Alex Jr." are distinct rows)
      name,
      primary,
      secondary: secondary!,
      skill: clampRating(skillRaw, 3) as Player["skill"],
      running: clampRating(runningRaw, 3) as Player["running"],
      control: controlRaw.trim().toLowerCase().startsWith("y"),
      ageBand: age || "unknown",
    });
  }

  const names = new Set<string>();
  for (const p of players) {
    if (names.has(p.name)) errors.push(`Duplicate player name: ${p.name}`);
    names.add(p.name);
  }
  return { players, errors };
}

export function serializeRosterCsv(players: Player[]): string {
  const header =
    "Name,Primary Position,Secondary Position,Skill Level,Running Ability,Game Control,Age";
  const rows = players.map((p) =>
    [
      p.name,
      p.primary,
      p.secondary,
      p.skill,
      p.running,
      p.control ? "Yes" : "No",
      p.ageBand,
    ].join(",")
  );
  return [header, ...rows].join("\n");
}
