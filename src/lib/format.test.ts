import { describe, expect, it } from "vitest";
import { DEMO_ROSTER } from "@/data/demo-roster";
import { buildTeams } from "./engine";
import { toShareText } from "./format";

describe("WhatsApp share text", () => {
  const result = buildTeams(DEMO_ROSTER, { apart: [], together: [] }, 42);
  const text = toShareText(result, new Date("2026-09-18"));

  it("never mentions skill or ratings", () => {
    expect(text.toLowerCase()).not.toContain("skill");
    expect(text.toLowerCase()).not.toContain("avg");
    expect(text.toLowerCase()).not.toContain("controller");
    expect(text.toLowerCase()).not.toContain("running");
  });

  it("lists name first, position after", () => {
    for (const row of [...result.teams.A.rows, ...result.teams.B.rows]) {
      expect(text).toContain(`${row.player.name} — ${row.position}`);
    }
  });

  it("never marks primary/secondary placements", () => {
    expect(text).not.toContain("*\n"); // no position asterisks at line ends
    expect(text).not.toContain("secondary");
    expect(text).not.toContain("primary:");
    for (const line of text.split("\n")) {
      expect(line.endsWith("*")).toBe(false);
    }
  });

  it("keeps every player exactly once", () => {
    for (const p of DEMO_ROSTER) {
      const occurrences = text.split(`${p.name} — `).length - 1;
      expect(occurrences, p.name).toBe(1);
    }
  });
});
