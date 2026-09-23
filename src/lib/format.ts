import { SplitResult } from "./types";

/**
 * Plain-text team sheet for WhatsApp. Deliberately rating-free: no skill
 * numbers and no primary/secondary markers. The group sees names and
 * positions, the ratings machinery stays inside the app.
 */
export function toShareText(result: SplitResult, date = new Date()): string {
  const d = date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const lines: string[] = [`⚽ Kix teams · ${d}`, ""];
  for (const team of [result.teams.A, result.teams.B]) {
    lines.push(`*Team ${team.team}*`);
    for (const row of team.rows) {
      lines.push(`${row.player.name} · ${row.position}`);
    }
    lines.push("");
  }
  // Keep only group-relevant notes (keeper rotation, odd headcount) and drop
  // anything that reveals primary/secondary placements.
  const notes = result.flags.filter((f) => !f.includes("primary:"));
  if (notes.length) {
    lines.push(`Notes: ${notes.join(" | ")}`);
  }
  return lines.join("\n").trimEnd() + "\n";
}
