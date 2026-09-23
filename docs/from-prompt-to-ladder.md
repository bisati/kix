# From prompt to ladder

Kix started as a 79-line prompt that a language model read every Sunday. Turning it into code was not a port. It was an interrogation, and the prompt turned out to contain a rule that could never be obeyed.

---

## The starting point: a prompt already trying to be a program

The original Team Builder prompt was not vague. It had a numbered priority ladder with the instruction *"when rules conflict, the higher rung wins"*. It had exact tolerances in places, counts differing *"by at most 1"*, totals within *"2 or less"*. It had a procedure headed *"run in this order every time"*, and a verification step demanding the model recount the totals *"digit by digit"* before replying. Six changelog entries at the bottom recorded a year of Sunday arguments.

That is a specification written in the only language available at the time. The conversion to code did not need to invent the logic. It needed to find every place where prose had let a decision stay unmade, and make it.

Three kinds of gap showed up, and they need different fixes: rules the prose stated but never ordered against each other, rules written as a *process* that a scoring function can't express, and one rule that was flatly impossible.

## Step one: sort every instruction by what kind of thing it is

Before writing any code, every sentence in the prompt was put into one of five buckets. The bucket decides the implementation, and two of the five never reach the optimiser at all.

| Bucket | Example | Becomes |
|---|---|---|
| **Make it impossible** | "Every player appears exactly one time; never invent, drop or alter a player." | The data model, not a rule |
| **Hard constraint** | The user's explicit instructions for this game | Rung 1, must be zero |
| **Ordered preference** | Positions, keepers, tier spread, controllers, midfield control, totals | Rungs 2 to 20 |
| **Tiebreak** | Running totals, low-runner counts, age 40+ | Rungs 21 to 24 |
| **Not the engine's job** | Parsing messy input, asking clarifying questions, the output layout | The CSV parser and the UI |

The first bucket is the one people skip, and it's the most valuable. The prompt spent its entire top rung on integrity, *never drop a player, never duplicate one, never alter a name*, because a language model genuinely can do all three. In code, assignments are produced by mapping over the player list, so a dropped or cloned player isn't a rule that might be broken. It's a state that cannot be constructed. An entire rung of the prompt evaporated into a type.

The last bucket matters for a different reason. The prompt said: if a field is missing, *"ask one clarifying question listing all problems at once"*. An engine mid-build can't ask anyone anything. That instruction became a CSV parser that reports every problem row at once, and a roster form where the fields can't be left blank. The same intention, relocated to the only place that can act on it.

## Step two: eight sentences, and what each one became

The prompt carried its rules in two places: a five-rung ladder, and a longer prose section where several rules outranked things on that ladder without saying so. Flattening both into one strict order is where most of the real decisions got made.

**1. Tier spread.**
> "For every skill level (5, 4, 3, 2, 1), the per-team counts differ by at most 1. Split top-down. High-skill players define the game, so a stacked tier is a failed split even when totals match."

Five separate rungs, read 5s first. Because the comparison is lexicographic, "even when totals match" is enforced structurally: totals sit four rungs lower and are never reached while a tier is stacked. *(Rungs 7 to 11.)*

**2. Midfield control.**
> "Midfield runs the game, so it can never be one-sided. Each team's midfield must contain a similar number of controllers and the two midfields' skill totals must be within 2 points."

Two rungs, placed *above* overall skill totals. The prompt never said where this sat on its five-rung ladder, because it wasn't on it at all. Writing the code forced the ranking: a balanced midfield beats a balanced scoreboard. *(Rungs 13 and 14.)*

**3. Out-of-position burden.**
> "Playing out of position is a hidden cost. Never stack all out-of-position players on one team. Do NOT contort the split to minimize secondary placements: a sound football shape beats fewer placements."

Two terms at opposite ends of the ladder. Sharing the burden is near the top; preferring fewer placements overall is the very last rung, where it can only break ties. The prompt's "do NOT contort" is exactly that distance. *(Rung 6 and rung 24.)*

**4. Game controllers.**
> "The flag is authoritative, never infer control from rating. A 5 without the flag is a weapon, not a controller. If the flag is missing from the data entirely, fall back to: outfield 4-5s excluding goalkeepers and pure-pace wingers."

A boolean on the player record, and no fallback at all. The heuristic existed only because pasted text might omit the field. Once the app owns the roster, the field always exists. A whole paragraph of hedging became a schema decision. *(Rung 12.)*

**5. The snake draft.**
> "Sort the group by skill descending and assign in snake order (A, B, B, A, ...), continuing the snake across groups."

Kept almost verbatim, but demoted. In the prompt this was *the algorithm*. In the engine it is the starting position for a search that will then improve on it, because a snake draft knows about skill order and nothing else. *(The seed stage, not a rung.)*

**6. The repair step.**
> "Swap a same-position pair between teams (or use a legal secondary-position move) that fixes it without breaking position or tier balance."

The vaguest line in the prompt, and the one that became the most code: a defined move set (swap, shift, reposition, and composites of them), scored exhaustively, best move taken, repeat until nothing improves. *(The search.)*

**7. Unavoidable imbalance.**
> "If no legal assignment balances a position, leave the imbalance and flag it instead."

A feasibility calculation that works out what the squad actually permits, so a flag only appears when a human could have done better. The prompt trusted the model to know the difference. The engine proves it. *(Checks and flags.)*

**8. Verification.**
> "Verify before replying: every input name appears exactly once, count them. Recompute both skill totals from the final tables, digit by digit."

A separate module that reads only the finished team sheet and recounts everything. The instruction survived intact. What changed is who executes it. The generator can no longer mark its own homework. *(The verifier.)*

## Step three: a rule about "at that point" has no meaning to a score

One prompt line resisted translation entirely:

> "Odd tiers offset each other: when a tier has an odd count, its extra player goes to the team that is **behind on total skill at that point**. Consecutive odd tiers must not pile onto the same team."

That rule describes a **process**. It only makes sense while you are dealing players out, tier by tier, with a running total in your head. The engine has no such moment. The cost function is handed a finished split and asked how good it is. There is no "at that point".

So the intent had to be re-expressed as a property of the final arrangement rather than a step in a procedure. What the rule was actually protecting against is spare bodies from several tiers all landing on the same side. Stated about a finished split, that becomes: each tier's spare body carries a cost when it sits with the team that is already ahead, weighted by how good that tier is. Same intention, no clock.

This is the single most common thing to get wrong when converting a prompt. Prompts are written as instructions to someone *doing* the task. Scoring functions describe a finished result. Anything phrased as "then", "next", or "at that point" has to be restated as a fact about the outcome, or it cannot be encoded at all.

## Step four: binary rules need a slope, or nothing can climb them

The prompt states rules as pass or fail: counts *"differ by at most 1"*. That's the right way to write a rule for a reader, and useless for a search. A move that takes a position gap from five down to three is an obvious improvement, but under a pass/fail test both states read identically as "fail", so the optimiser has no reason to prefer either and wanders.

Every tolerance therefore became a graded distance from the rule:

```js
// zero while the rule holds, then grows with the violation
max(0, Math.abs(teamA - teamB) - 1)
```

At a gap of one or zero this is `0`. The rule is satisfied and the engine gets no incentive to keep grinding. Above that it rises, giving the search a downhill direction to follow. The prompt's exact tolerances survive unchanged. They just gained a gradient.

## Step five: the rule that could never be obeyed

Procedure step 5 of the prompt handles odd headcounts. It reads as obvious common sense, and it had been in the prompt since v1.1. It has two clauses that cannot both hold:

- **Clause A.** *"Never even out headcount at the cost of tier spread: apply the tier rules as normal."* Every skill tier splits within one, no exceptions.
- **Clause B.** *"Make sure the team that ends up with the extra player is the one with the lower skill total."*

With tier caps held hard, each team's total is almost entirely fixed by the tier counts. The extra player is an extra *body*, and a body carries skill with it. Across the odd-sized squads tested from the real roster, **not one tier-legal split satisfied clause B.** Zero. The rule was unsatisfiable, and had been for months.

The model never reported this, because a model asked to satisfy two incompatible instructions does not stop and object. It silently picks one, a different one on different Sundays, and writes a confident team sheet either way. The contradiction was invisible precisely because the output always looked fine.

Code cannot fudge it. The cost function has to be told which clause wins, in a specific order, before it will run at all. That forced the question the prose had allowed everyone to dodge for six versions: *what are we actually paying the short-handed team with?*

## Step six: where philosophy had to replace the prompt

The first answer was the intuitive one. Pay them in skill. Give the four-player team enough quality to make up for the missing body, and let the tier caps bend to allow it.

That version shipped, and it was wrong in a way no rule caught. Freed to bend the caps, the engine did the arithmetically optimal thing: it put every 5 on the short-handed team and filled the other side with 3s. The totals balanced. The game was four stars toying with a crowd, precisely the split the prompt's own tier rule had existed to prevent, reintroduced by the rule meant to compensate for it.

The philosophy that replaced it:

**Tier caps never bend.** Not for odd headcounts, not for anything. Quality can't be hoarded, whatever the arithmetic claims it's owed.

**The extra man is paid for in the margins instead.** Spare bodies lean toward the short side, slow players hide on the bigger team where there's cover, a lone keeper goes to the side that can't afford to rotate. When the forced gap is still ugly, the app says so and suggests rotating a player off every ten minutes.

Note what this is: a decision the prompt never contained, in either direction. The conversion surfaced the question. The answer had to come from the person who plays the game every week. Determinism doesn't generate judgement. It just makes it impossible to keep avoiding.

## Step seven: the changelog was already a test suite

Every version comment at the bottom of the prompt records a real Sunday complaint, and each one is a behaviour that must never come back. In the prompt they were sentences a model might or might not honour. In the engine each became a named test that fails loudly.

| Version | What changed, and why | The test it became |
|---|---|---|
| v1.1 | Tier spread became primary, totals secondary. Odd counts stopped being resolved at the cost of tier spread. | "every skill tier splits with gap of 1 or less, so two 5s means one per team" |
| v1.2 | Running ability added as an input; the mobility tiebreak moved from age to running totals and low-runner counts. | The mobility rungs and the odd-game legs test |
| v1.3 | Out-of-position burden must be spread. Reported after all four secondary placements landed on one team. | "out-of-position burden is shared, never stacked" |
| v1.4 | Shape beats fewer placements. Reported after a team took the pitch with no centre-back, and controllers stacked 5-3. | The shape rung, plus the controller split test |
| v1.5 | Midfield control can't be one-sided. Reported after one midfield was two out-of-position 3s against a 5 and a 4. | The mid-control check |
| v1.6 | Game Control became an explicit flag. The owner names who controls a game; rating no longer implies it. | "flagged game-controllers split with gap of 1 or less" |

Thirty-six tests now cover the ladder. Six of them exist only because somebody was annoyed on a Sunday, and they are the ones most worth keeping. A fairness rule nobody has complained about is a rule you don't yet know you need.

## Postscript: a rule can go stale without anyone editing it

Two days after the engine shipped, a twelve-a-side game produced a team with nobody in goal. The cause was the same species as the contradiction above, and just as invisible.

The prompt's keeper rule covers three cases: two keepers, one keeper, and none. The last one reads *"0 GKs, flag that both teams rotate."* A flag, not a fix. The engine implemented that faithfully, and because nothing on the ladder rewarded having a keeper, while the final rung actively penalised putting an outfielder out of position, the engine's cheapest option was an empty goal. It was obeying the specification exactly.

What changed wasn't the rule. It was **who supplies the input**. The prompt was always handed the full roster, which contains real keepers, so the zero-keeper branch almost never fired. The app is handed whoever showed up tonight, and squads with no specialist keeper turn out to be routine. Sampling 220 random squads, **112 of them had an empty goal** despite containing two people who could keep.

The fix was one rung, not a patch. Keepers became rung 4, with deputies counting toward whether the squad can field one at all. Same sample afterwards: zero empty goals, at a cost of three extra amber warnings across all 220 squads, the price of the constraint, reported rather than hidden.

**The lesson to carry:** a rule written against one input distribution can become a gap without a single word changing, because the product changed who fills in the input. Worth re-reading the branches nobody expected to hit whenever a prompt moves behind an interface.

## The method, for any prompt

Nothing here is specific to football. The same sequence applies to any prompt iterated enough to contain real institutional knowledge.

1. **Inventory every instruction**, including the ones buried in prose rather than the numbered list. The prose ones are usually the load-bearing ones.
2. **Sort each into a bucket.** Impossible-by-construction, hard constraint, ordered preference, tiebreak, or not-the-engine's-job. Two of those never become rules.
3. **Put every preference in one total order.** This is where the arguments happen. Prose lets two rules both be "important". A lexicographic comparison does not.
4. **Restate process rules as properties.** Anything containing "then" or "at that point" describes a procedure and must be re-expressed as a fact about the finished result.
5. **Give every binary rule a gradient**, so the search can tell "nearly right" from "badly wrong" while it's climbing.
6. **Brute-force the small cases.** Enumerate every legal answer for small inputs and check the rules against them. This is how a contradiction that survived six versions gets caught in an afternoon.
7. **Take the unanswerable questions back to the owner.** When two rules genuinely conflict, that's a judgement call, not a bug. Code can only insist that someone make it.
8. **Convert the changelog into regression tests.** Every past complaint is a behaviour that must never return.
9. **Separate the grader from the generator.** Keep the prompt's verification step, but give it to different code than the one being verified.
10. **Write down what you lost.** The engine can't improvise or explain itself. Saying so plainly is part of the deliverable.

## What it cost

Asked for a control-first team against a pace-and-attack team, the prompt would have attempted it and explained its reasoning. Handed a constraint nobody anticipated, someone's brother-in-law visiting, two players who fell out last week, it would have improvised something sensible. The engine optimises the twenty-four rungs it was given and is blind to everything else.

What it gets in exchange is that the same squad always produces the same teams, instantly, offline, with every decision traceable to a rule anyone can read, and that a contradiction sitting quietly in the rules for six versions gets found instead of averaged over. For a weekly game among the same fifty people, that trade is worth making. The place to keep a model is where improvisation actually helps: reading a messy WhatsApp list of who's coming, not deciding who plays with whom.

See also: [Inside the Kix engine](engine.md), on the finished ladder rung by rung.
