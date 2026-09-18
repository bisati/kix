import { SplitResult } from "./types";

/** Plain-text team sheet in the shape the group already shares on WhatsApp. */
export function toShareText(result: SplitResult, date = new Date()): string {
  const d = date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const lines: string[] = [`⚽ Kix teams — ${d}`, ""];
  for (const team of [result.teams.A, result.teams.B]) {
    lines.push(
      `*Team ${team.team}* — skill ${team.skillTotal} (avg ${team.skillAvg.toFixed(1)})`
    );
    for (const row of team.rows) {
      const pos = row.isSecondary ? `${row.position}*` : row.position;
      lines.push(`${pos} — ${row.player.name}`);
    }
    lines.push("");
  }
  const a = result.teams.A;
  const b = result.teams.B;
  lines.push(
    `Balance: skill ${a.skillTotal}v${b.skillTotal} · running ${a.runningTotal}v${b.runningTotal} · controllers ${a.controllers}v${b.controllers}`
  );
  if (result.flags.length) {
    lines.push(`Notes: ${result.flags.join(" | ")}`);
  }
  lines.push("", "_* = playing secondary position_");
  return lines.join("\n");
}
