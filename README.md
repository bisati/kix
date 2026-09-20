# ⚽ Kix

Balanced football teams for a weekly friendly game, in 30 seconds, with the fairness proof on screen.

**Live at:** [kix-psi.vercel.app](https://kix-psi.vercel.app)

Every week the same argument: are the teams fair? This app ends it. Tap who showed up, get two teams that are balanced across positions, skill tiers, and game-controllers — and a verification panel that shows every fairness check computed from the final teams, so nobody has to take the algorithm's word for it.

## How it works

The balancing engine implements a strict priority ladder:

1. **Integrity** — everyone plays, exactly once, only in a position they actually play.
2. **Your pins** — "keep these two apart / together" overrides everything below.
3. **Position balance** — per-position counts differ by at most 1; out-of-position placements are legal only at a player's secondary position, flagged, and shared between teams. Keepers are settled before anything else: every available keeper goes in goal, up to one per team, counting deputies (GK as a secondary position). Two able keepers means both goals covered; one means that player keeps and the other team rotates; none means both rotate. Below that, each team fields a defender and a midfielder whenever the squad allows.
4. **Skill balance** — every skill tier (5s → 1s) splits evenly *before* totals are compared; game-controllers (playmakers) split evenly; midfields must be within 2 skill points of each other.
5. **Odd headcounts: price the extra man.** The spare body is a real advantage, so the man-down team is paid in the margins *inside* the caps above: the odd tier's extra player leans their way (the caps mean quality can never be hoarded — six 4s still go 3v3 in an 8v7), they get the runners while slow legs hide on the bigger team, and a lone fixed keeper goes to the short side. Paper totals often favor the bigger team — that's the tier caps working, and the report says so instead of breaking them; when the forced gap gets ugly, the app suggests the escape valve (bigger team rotates one player off every ten minutes).
6. **Mobility** — running ability and age only break ties between otherwise-equal options.

Under the hood: a goalkeeper-first snake draft seeds the split, then best-improvement hill climbing over player swaps repairs it against a lexicographic cost function that encodes the ladder. Twelve seeded restarts with increasing perturbation escape local optima. Everything is deterministic per seed — Re-roll is a new seed, not a shrug.

**The verify step is separate from the generator.** Once teams exist, an independent checker recomputes every claim — player integrity, position gaps, tier spread, controller splits, totals — and renders each as a pass/warn row. Manual swaps re-run the checker and show exactly what your override broke. The generator is never trusted to grade itself.

## Product decisions

- **Logic in code, not in an LLM.** This started as an agent prompt that split teams over chat. Six prompt versions in — each one patching a failure a player complained about (stacked out-of-position placements, one-sided midfields, controller pile-ups) — the rules were precise enough that an LLM added only latency and variance. The prompt's changelog became the engine's test suite: every historical failure is a regression test in [`engine.test.ts`](src/lib/engine/engine.test.ts).
- **Tier spread beats totals.** Two teams with equal totals can still be unfair — a team with both 5-star players wins even if totals match. Splitting each skill tier is the primary rule; totals are secondary. This came from a real bad Saturday, not from theory.
- **Odd games are balanced by making the teams different in ways that cancel.** Even games mirror; odd games price the extra man — bodies against quality, lungs against skill. The guardrail is structural: tier caps hold regardless of headcount, so "all the stars on the short side" is impossible by construction, and the compensation lives in the margins: which side the odd tier's extra leans, who gets the runners, who gets the fixed keeper. The panel reports the paper totals honestly instead of torturing the split to make them match.
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
