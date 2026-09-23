# Inside the Kix engine

How a football squad becomes two fair teams in about a second: one ordered ladder of priorities, a search that climbs it, and a verifier that grades the result without trusting the thing that produced it.

Everything here runs in the browser. No roster ever leaves the device.

---

## 1. The job

Kix takes the people who showed up and splits them into two teams nobody argues about. Each player carries seven attributes: a primary and a secondary position, a skill rating and a running rating on a 1 to 5 scale, a flag for whether they control the game, and an age band.

The original version of this was a prompt. A language model read the roster and wrote out two teams. The engine replaces it with code, which buys three things a model couldn't give: the same input always produces the same teams, the result arrives instantly and offline, and every decision can be traced to a rule you can read. What it costs is improvisation, which is the honest trade-off discussed at the end.

## 2. The core idea: priorities in strict order

The obvious way to score a split is to add up penalties. A bit for an uneven skill total, a bit for a lopsided midfield, a bit for stacking the good players. That approach quietly lets the engine sell you out: a large fairness violation becomes acceptable as long as it is offset by several small wins elsewhere, and nobody can see the exchange rate.

Kix scores a split as an **ordered list of 24 numbers** instead, each one counting how badly a single rule is broken. Splits are compared position by position. The first position where they differ decides the winner outright, and nothing after that position is ever read.

```js
// lower is better; first difference decides, full stop
for (let i = 0; i < Math.max(a.length, b.length); i++) {
  const d = (a[i] ?? 0) - (b[i] ?? 0);
  if (d !== 0) return d;
}
return 0;
```

A worked example. Two candidate splits, identical until rung 8:

| | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|
| Split A | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **1** | 0 | 0 |
| Split B | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **0** | 2 | 3 |

Split B wins at rung 8, where the 4-star players are split evenly, even though it is worse on every rung after it. A perfect running balance can never buy back a stacked skill tier, because the comparison stops before it gets there.

Most rungs are written as `max(0, |A - B| - 1)`. A gap of one is free, and only the excess counts. That tolerance is deliberate: real squads rarely divide perfectly, and an engine that chases a zero it cannot reach will wreck a more important rung trying.

## 3. The ladder in full

The bands are reading aids. The engine sees one flat ordered list, and the rung numbers *are* the priority.

### Non-negotiables (must be zero)

| Rung | Term | What it counts |
|---|---|---|
| 1 | `constraintViolations` | Your own pair instructions broken, two players kept apart who ended up together or the reverse. |
| 2 | `headcount` | Team sizes more than one player apart. |
| 3 | `posImbalance` | Per-position count gaps above one, summed across all six positions. |
| 4 | `keeperShortfall` | Goals left empty that the squad could have filled, one per team, counting deputies. |
| 5 | `shape` | A team fielding zero defenders or zero midfielders when the squad contains enough of them to avoid it. |
| 6 | `secondarySpread` | One team carrying more than its share of players stuck in their secondary position. |

### Quality can never be hoarded (hard at every headcount)

| Rung | Term | What it counts |
|---|---|---|
| 7 | tier 5s | For each skill tier, the number of players in it must differ by at most one between teams. Five separate rungs, read from the best players down, so a stack of 5s outranks a stack of 4s. |
| 8 | tier 4s | |
| 9 | tier 3s | |
| 10 | tier 2s | |
| 11 | tier 1s | |

### Who runs the game

| Rung | Term | What it counts |
|---|---|---|
| 12 | `controllerGap` | Players flagged as game-controllers, split more than one apart. |
| 13 | `midControllerGap` | The same, counting only controllers actually playing in midfield. |
| 14 | `midSkillExcess` | Midfield skill totals more than two apart, one side owning the middle of the park. |

### Totals, and the odd man

| Rung | Term | What it counts |
|---|---|---|
| 15 | `totalExcess` | Skill totals more than two apart. |
| 16 | `oddTierLean` | Odd games only. When a tier has an odd count, its spare body sitting with the *bigger* team costs that tier's value, so quality leans toward the short-handed side. |
| 17 | `totalGap` | The raw skill difference, tuning inside the tolerance above. |
| 18 | `passengerLean` | Odd games only. Every slow player (running 2 or less) left on the man-down team. |
| 19 | `runHeadLean` | Odd games only. The bigger team out-running the short side on a per-player basis. |
| 20 | `gkStructural` | Odd games only. A lone specialist keeper stuck on the bigger team, which can better afford to rotate. |

### Tiebreaks (only when everything above ties)

| Rung | Term | What it counts |
|---|---|---|
| 21 | `runningGap` | Difference in total running. |
| 22 | `lowRunnerGap` | Difference in the count of slow players. |
| 23 | `over40Gap` | Difference in players aged 40 or over, the only use of the age band. |
| 24 | `totalSecondaries` | Total players out of their primary position. All else equal, more people play where they belong. |

## 4. Finding a split

The ladder only scores a split. Something still has to produce candidates. Four stages do that, and the best result any of them finds is the one that ships.

1. **Seed.** Keepers are settled first. Two specialists go one each, a lone keeper takes one goal and the best deputy takes the other, and a squad with no specialist at all promotes its deputies. Everyone else enters a skill-descending snake draft, run position group by position group.
2. **Climb.** Best-improvement hill climbing. Every legal move is scored, the single best one is taken, and this repeats until no move improves the vector.
3. **Restart.** Twelve runs. Each one perturbs the seed harder than the last with random cross-team swaps and position jitter, so the search starts in a different basin every time.
4. **Enumerate.** For squads of 13 or fewer, every size-legal split is generated and polished, at most 1,716 of them. Cheap, exhaustive, and immune to local optima.

### Why the snake draft isn't enough on its own

A snake draft gives a decent starting point and nothing more. It knows about skill order, not about midfield control, out-of-position burden, or who has to stand next to whom. The climb is what turns a decent draft into a defensible split. Three kinds of move are available to it:

- **Swap.** Two players trade teams.
- **Shift.** One player moves across, changing the team sizes.
- **Reposition.** A player switches between their primary and secondary position, staying put.

Crucially, swaps and shifts also come in **composite** forms that reposition one or both players in the same move. That detail matters more than it sounds. Plenty of good splits are only reachable if a trade and a position change happen together. Scored one at a time, each half looks like a step backwards, so a simple hill climber refuses both and stalls. Adding composites was the fix for exactly that failure.

### Why restarts, and why they're seeded

Hill climbing finds a local optimum, not the best possible split. Running it twelve times from twelve different starting arrangements and keeping the best result is a cheap, effective hedge. Every restart draws from a seeded generator, so a given seed always yields the same twelve starts, and therefore the same final teams.

## 5. Odd headcounts: pricing the extra man

Nine players means 4-v-5, and the extra body is a real advantage. The first version of this rule tried to pay for it by giving the short side more skill, which sounds right and is a trap. Left to that instruction, the engine stacked every 5 onto the small team and handed the other side a crowd of 3s. Technically balanced. Miserable to play in.

**Tier caps stay hard no matter the headcount.** Each skill tier is split within one, always. That is the structural guardrail: no team can ever hoard quality, whatever the arithmetic says it is owed.

**Compensation happens only in the margins.** Inside those caps, spare bodies from each tier lean toward the short side, the slow players hide on the bigger team where there is cover, and a lone keeper is given to the team that can least afford to rotate.

One consequence has to be stated plainly rather than engineered away. With tier caps locked, the bigger team will sometimes hold the higher skill total on paper. That number is correct, not a bug. It is what the caps cost. Kix reports it honestly and compares the teams *per head* instead, which is the number that describes the actual game.

When the forced gap gets genuinely ugly, three points or more, the app stops pretending and offers the practical fix instead: the bigger team rotates a player off every ten minutes, which turns an odd game into an even one with fresh legs.

## 6. Grading against what is possible, not what is ideal

Some squads simply cannot be split evenly. Five players rated {5, 4, 4, 3, 3} have no arrangement that puts the skill totals within two of each other. The arithmetic forbids it. An app that flags that as a problem is blaming the engine for the roster, and after a few false alarms people stop reading the warnings at all.

So before judging a split, Kix works out what the squad *allows*. Since tier caps are hard, each tier contributes a fixed amount to both sides plus at most one spare body. With at most five spare bodies, all their possible placements can be enumerated exhaustively, thirty-two cases at worst, which yields two exact facts:

- **The smallest skill gap any legal split can achieve.** If the engine hits that floor, the totals check passes and says so, even at a gap of four.
- **Whether leaning quality toward the short side is achievable at all.** If no legal split can do it, the odd-count check passes and explains that it was impossible, rather than demanding the impossible.

The result: a warning in Kix always means something a human could actually fix.

## 7. The verifier

The search optimises the cost vector. The checks panel is computed by completely separate code that reads only the final team assignments and recounts everything from scratch. It does not see the vector, the moves, or the reasoning that produced them.

This is not ceremony. It is what makes a manual swap safe: when you move a player across, the checks re-run against the arrangement you made, so the panel tells you exactly what your change fixed or broke. It also means a bug in the optimiser shows up as a visible red flag rather than a quietly wrong team sheet.

The checks:

- Every player on exactly one team
- Per-position count gap of one or less
- Every available keeper is in goal, naming them, or explaining that too few people here can keep
- Skill totals as close as this squad allows, passing within two or at the proven floor
- Every skill tier split evenly, the anti-hoarding guarantee
- Out-of-position burden shared
- Game-controllers split evenly, and separately, midfield control balanced
- Man-down team is better per head (odd games), with an honest note when it is unachievable
- Bigger team carries the slower legs (odd games)
- Your pinned constraints honored

Alongside them sit flags: a team with no keeper, each out-of-position placement by name, the odd-headcount warning, and the rotation suggestion when the gap is large.

## 8. Match-day instructions compile into inputs

Before building, you can tell Kix about today: keep two players apart or together, mark someone injured, or override a player's ratings for this game only. None of this reaches the engine as a new rule. It is compiled into the two things the engine already understands, constraint pairs and a transformed player pool, which is why the optimiser has never needed a line of code for any of it.

- **Pairs** become `apart` and `together` constraints, sitting on rung 1.
- **Mild injury** lowers running by one. **Serious** lowers running by two and skill by one.
- **Today's rating** replaces a player's attributes for this match, and an injury then applies on top of that new baseline. Ratings clamp to 1 through 5.

The saved roster is never touched. Reload the page and every player is back to their real numbers. Instructions naming someone who has since left the roster are dropped automatically rather than failing the build.

## 9. Determinism, re-roll, manual swap

All randomness comes from one small seeded generator. A given seed produces the same twelve starting arrangements, the same climb, and therefore the same teams, every time, on every device. That is what makes the engine testable at all.

**Re-roll** exploits that directly. It rebuilds with a fresh seed, then compares the resulting squad composition against the one you already have using a team-symmetric fingerprint, so a split that merely swaps the A and B labels is correctly recognised as the same teams rather than a new suggestion. It retries up to six times before conceding that it has run out of genuinely different options.

**Manual swap** is deliberately not re-optimised. You picked those two players, and the engine does not quietly undo your call. It moves them, re-runs every check, and shows you what changed, including an undo if the trade turned out worse than it looked.

## 10. What the engine gives up

The prompt this replaced could improvise. Asked to build a control-first team against a pace-and-attack team, or handed a constraint nobody anticipated, a model would attempt it and explain itself. The engine cannot. It optimises the ladder it was given, and nothing else.

- **It can't invent a new criterion mid-game.** Anything outside the 24 rungs is invisible to it. New ideas mean new code, not a new sentence.
- **It can't justify a choice in words.** The checks panel shows what holds and what doesn't, but no engine output ever explains *why* a particular pairing felt right.
- **Optimality is only guaranteed for small squads.** Thirteen players or fewer are solved exhaustively. Above that, multi-restart hill climbing finds a very good split, not a provably perfect one.
- **It is only as good as the ratings.** Skill and running are human judgements, entered once and rarely revised. Nothing in the system notices that someone has got fitter since March.

The trade was made knowingly. For a weekly game among the same fifty-odd people, consistency and speed beat improvisation, and the one thing a model could never offer is the guarantee that the same squad always produces the same teams, which is what actually ends the arguments.

## Where the logic lives

| File | What's in it |
|---|---|
| [`src/lib/engine/cost.ts`](../src/lib/engine/cost.ts) | The ladder itself: team statistics, the 24-term vector, the lexicographic comparison, and the squad feasibility calculation. |
| [`src/lib/engine/index.ts`](../src/lib/engine/index.ts) | The search: seeded generator, snake draft, hill climbing, restarts, small-squad enumeration, re-roll and manual swap. |
| [`src/lib/engine/verify.ts`](../src/lib/engine/verify.ts) | The independent grader: team views, every check, every flag. |
| [`src/lib/instructions.ts`](../src/lib/instructions.ts) | Compiles pairs, injuries and one-day overrides into engine inputs. |

Thirty-six unit tests cover the ladder rung by rung, including named regression tests for bugs the original prompt shipped: a stacked skill tier, an out-of-position burden landing entirely on one team, and an odd game where the extra player joined the stronger side.

See also: [From prompt to ladder](from-prompt-to-ladder.md), on how the original agent prompt became this.
