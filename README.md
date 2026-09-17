# ⚽ Fair Teams

Balanced football teams for a weekly friendly game, in 30 seconds, with the fairness proof on screen.

**Live at:** _deploying soon_

Every week the same argument: are the teams fair? This app ends it. Tap who showed up, get two teams that are balanced across positions, skill tiers, and game-controllers — and a verification panel that shows every fairness check computed from the final teams, so nobody has to take the algorithm's word for it.

## How it works

The balancing engine implements a strict priority ladder:

1. **Integrity** — everyone plays, exactly once, only in a position they actually play.
2. **Your pins** — "keep these two apart / together" overrides everything below.
3. **Position balance** — per-position counts differ by at most 1; out-of-position placements are legal only at a player's secondary position, flagged, and shared between teams.
4. **Skill balance** — every skill tier (5s → 1s) splits evenly *before* totals are compared; game-controllers (playmakers) split evenly; midfields must be within 2 skill points of each other.
5. **Mobility** — running ability and age only break ties between otherwise-equal options.

Under the hood: a goalkeeper-first snake draft seeds the split, then best-improvement hill climbing over player swaps repairs it against a lexicographic cost function that encodes the ladder. Twelve seeded restarts with increasing perturbation escape local optima. Everything is deterministic per seed — Re-roll is a new seed, not a shrug.

**The verify step is separate from the generator.** Once teams exist, an independent checker recomputes every claim — player integrity, position gaps, tier spread, controller splits, totals — and renders each as a pass/warn row. Manual swaps re-run the checker and show exactly what your override broke. The generator is never trusted to grade itself.

## Product decisions

- **Logic in code, not in an LLM.** This started as an agent prompt that split teams over chat. Six prompt versions in — each one patching a failure a player complained about (stacked out-of-position placements, one-sided midfields, controller pile-ups) — the rules were precise enough that an LLM added only latency and variance. The prompt's changelog became the engine's test suite: every historical failure is a regression test in [`engine.test.ts`](src/lib/engine/engine.test.ts).
- **Tier spread beats totals.** Two teams with equal totals can still be unfair — a team with both 5-star players wins even if totals match. Splitting each skill tier is the primary rule; totals are secondary. This came from a real bad Saturday, not from theory.
- **The proof is the product.** The balance bars and checklist exist because "trust me, it's fair" doesn't survive contact with 15 opinionated friends. Showing the checks turned arguments about teams into arguments about ratings — a much better argument to have.
- **Your roster never leaves your phone.** Import a CSV once; it lives in localStorage. The repo and the live demo ship with fictional players. No accounts, no server, no analytics on your friends' skill ratings.

## Stack

Next.js (static export) · TypeScript · Tailwind CSS · Vitest. No backend, no dependencies at runtime.

## Run locally

```
npm install
npm run dev    # app
npm test       # engine test suite
```

## Roster CSV format

```
Name,Primary Position,Secondary Position,Skill Level,Running Ability,Game Control,Age
Arjun,Mid,Winger,4,3,Yes,26-30
```

Positions accept the labels people actually type (`Mid`, `Full back`, `GK`, `CB`, `ST`, …). Running Ability and Game Control columns are optional for older rosters.

## License

MIT
