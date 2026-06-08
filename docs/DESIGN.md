# Greenkeeper — Design

> The single source of truth for the game's design. Implementation-agnostic on
> purpose — no language, runtime, or rendering decisions live here (those live in
> `TECH.md`).

---

## 1. What this is

A **management simulation** of running a golf course. You are not an avatar on
the grounds — you are the person making the decisions: what to charge, where to
spend scarce money and labor, what to invest in, and how much risk to carry.

The course is a **living system** that decays without attention and is buffeted
by things you don't control (weather, disease, the market). The game is the
ongoing tension between **keeping it alive** and **making it pay** — under
uncertainty, with never quite enough resources.

You begin **hands-on**, making the direct operational calls on a small course,
and earn your way to **delegation** — setting policy and trusting a crew — as you
scale. The game is as much about *learning to let go* as about growing.

The fantasy: *grow a neglected course into a championship club through smart,
risky decisions — and live with the consequences of each one.*

---

## 2. Design principles

Hard constraints, not aspirations.

1. **Strategy is the foundation, not a future layer.** Risk/reward and
   meaningful decisions are built *first*. The simulation exists to make those
   decisions bite — not the other way around.
2. **Every system must create a real decision with an upside *and* a downside.**
   If a system has an obviously-correct action, it's not strategy — cut it or
   add the tradeoff.
3. **Deterministic base, reactive risk.** The core is predictable enough to plan
   around; managed uncertainty forces you to adapt.
4. **Model the course as features, not geometry.** The unit of state is a
   *region* (a green, a fairway, a bunker), not a tile or a coordinate.
5. **Depth through interaction.** Richness comes from systems feeding each other,
   not from more systems. One loop with five consequences over five loops with
   one each.
6. **Finishable scope.** Every system, and this document, has a definition of
   done. Vertical slices that are fully playable, then depth — never broad
   half-built layers.

---

## 3. The heart: the interlock

One reinforcing loop drives everything. Conditions and money are not separate
games; they are the same flywheel.

```
   maintenance & investment
            │
            ▼
     course conditions ──► prestige ──► pricing power (fee tolerance)
            ▲                                   │
            │                                   ▼
     reinvestment ◄──────── revenue ◄──── demand (golfers who'll pay)
```

**Reinforcing:** a healthy course earns prestige, prestige lets you charge more
without losing golfers, that revenue funds the maintenance and investment that
keep it healthy. Once it catches, it compounds.

**Balancing forces that keep it honest (and make it a game):**

- **The decay treadmill.** Conditions degrade continuously, and a *bigger,
  better* course is *more* to maintain — success raises the burden.
- **Asymmetric prestige.** Reputation builds slowly and collapses fast
  ("years to build, moments to destroy"). One neglected stretch can erase weeks.
- **Overreach penalties.** Squeezing the loop for short-term cash (packing the
  schedule, deferring care, over-pricing) damages the very thing the loop runs
  on. Greed is self-correcting — eventually.

The strategy lives in the gap between the reinforcing loop and the balancing
forces: how hard do you push, and when do you ease off?

---

## 4. The decision space (what the player actually does)

Everything below is a recurring decision with a genuine tradeoff. This list *is*
the game.

- **Pricing.** Charge toward the top of what your prestige tolerates → more per
  golfer but more turned away and reputation drag. Charge low → volume and
  goodwill but thin margins.
- **Marketing bets.** Optional campaigns that *gamble* on boosting demand — they
  can underperform or backfire. A financial risk you choose to take, never a
  guaranteed "spend money → get golfers" shortcut. Baseline demand stays organic
  (prestige, price, reputation, weather); marketing only tilts the odds.
- **Allocation.** Limited labor/attention/money across competing regions and
  needs. The 4th green is failing *and* payroll is due *and* research is mid-fund
  — what gives?
- **Capital vs. labor.** Substitute money for ongoing labor: hire staff → install
  irrigation → buy robots → plant elite turf. Each is a capital bet with a
  break-even and a failure mode (breakdowns, leaks, establishment penalties).
- **Risk posture.** How much to spend on *prevention* vs. *reaction*. Running
  lean invites rare catastrophes; over-insuring bleeds you slowly. (See §7.)
- **Pacing.** How tightly to pack play: revenue now vs. pace-of-play, wear, and
  reputation over time.
- **Delegation.** As you scale, hand work to a crew and to standing rules. *What*
  you delegate, *to whom*, and *how much you trust it* is itself a decision. (§6)
- **Progression bets.** Which research path, when to expand, and whether to
  accept a tournament you might not be able to keep pristine. (§6, §7)

---

## 5. Play structure (time, turns, feedback)

- **Turn/period-based, not a live clock.** You set decisions, advance time, and
  watch them resolve — then read the results and adapt. Pressure comes from
  *consequences*, not from reflexes or a ticking timer.
- **Plan → simulate → read → adjust** is the core rhythm.
- **Hard stakes.** A scenario can be *lost*: bankruptcy (cash past the floor with
  no way back) or failing the objective ends the run, and you retry with what you
  learned. No soft landing — the pressure is real, which is what makes a
  calculated risk an actual risk.
- **Fixed cadence, interruptible.** Each turn advances a fixed period, but a
  serious event (a crisis, a threshold crossed) can pause it and demand an
  immediate decision before time continues.
- **The period zooms with your role.** Early, hands-on play runs in fine grain
  (days). As you delegate and the course increasingly runs itself, the turn
  widens to weeks, then seasons — the time scale follows the doing→delegating
  arc. Zooming out is a *reward* for building a self-sustaining operation, and
  re-compressing (a crisis drags you back to daily firefighting) is a real cost.

---

## 6. Progression (what you climb, and what each tier unlocks)

Progression is not just bigger numbers — each tier opens *new decisions*. The
goal structure is a **scenario campaign** of hand-crafted, **self-contained**
levels — each its own course, fresh start, objective, and difficulty modifiers.
Money, staff, and research are **per-scenario**; what carries between levels is
*your* mastery, not in-game assets. Each scenario is therefore a complete run of
the doing→delegating arc in miniature: build up, then hold or hit a target — or
lose.

Scenarios span several **objective archetypes** — restoration (revive a ruined
course), economic targets (hit profit/cash by a deadline), survival (endure
stacked odds for a stretch), and tournaments (earn eligibility, then host). Some
are **fixed-size puzzles**; others center on **renovation/expansion** — adding
holes or rebuilding greens via phased closures, a capacity/prestige gain weighed
against revenue lost during construction.

The spine that runs through every scenario:

- **The role arc: doing → delegating.** You start making direct calls; as the
  course grows past what one person can hold, you shift to hiring, trusting, and
  setting policy. Delegation deepens in layers as you scale: **assign people to
  duties → write standing orders the crew follows → promote department heads who
  manage others.** Each layer is unlocked by growth and lets the turn zoom out.
  This *is* the difficulty curve and the emotional arc.
- **Staff as investment.** Crew are individuals with skill, experience, and
  reliability you develop over time. A great hire is a compounding asset; a key
  departure hurts. Good help is genuinely hard to find — recruiting, training,
  and *trusting* them is the substrate of delegation. A pure simulation can
  afford this depth; there's no character art to maintain.
- **Prestige tiers (★1–5).** The master gate. Higher tiers raise pricing power
  and unlock memberships, tournament eligibility, and amenities. Scored from
  conditions, *historical* excellence (so you can't fake it for an inspection),
  reputation, amenities, exclusivity.
- **Research.** A branching tree of capital-vs-labor and quality-vs-cost
  tradeoffs. Distinct viable paths (automate vs. staff; efficiency vs. prestige),
  not one optimal order.
- **Course scale (3 → 9 → 18 → 27 holes).** More ground than a small crew can
  hold, forcing the hire-then-automate arc.
- **Tournaments — the apex bet.** Earned through *sustained* excellence, not
  bought. An **optional high-risk play available wherever you've earned
  eligibility** (and the explicit objective of some scenarios). Huge payouts and
  permanent gains on success; lasting setbacks on failure.

---

## 7. Risk & reward — calculated risk

Risk and the player's response to it are first-class — built into the core, not
bolted on.

**Stance: calculated risk.** Randomness is meaningful but manageable — you play
the odds, not chaos, through buffers, prevention, and insurance. A bad outcome
should feel like a bet that didn't land, not an arbitrary punishment.

**Legibility: hidden but learnable.** The odds are never shown as numbers. You
learn the model by living through it — reading qualitative cues and telegraphed
warning signs, building intuition for when a bet is worth taking. This obliges
the underlying model to be *consistent and discoverable*: risk must reward
pattern-learning and never feel arbitrary. Experienced staff are partly *how* you
read the danger — a seasoned crew notices what a novice misses.

Three candidate sources of uncertainty; **which one anchors the first slice is
still open** (§10):

- **Agronomic crises.** Disease/pests that favor certain conditions, spread
  between adjacent regions, and resist overused treatments. Cleanest expression
  of risk posture: *low-risk play = fewer but larger crises; high-risk play =
  more frequent, smaller ones.*
- **Weather & seasons.** Volatility plus seasonal cycles (growth/demand swings,
  renovation windows, off-season). Converts one-time optimization into recurring
  planning.
- **Market & competition.** Demand swings, rival courses applying pricing
  pressure, cash-runway/loan risk. Makes pricing and investment a contest.

---

## 8. The course model (domain, not implementation)

- **Course** → a set of **features/regions** (holes, greens, fairways, tees,
  roughs, bunkers, water, plus facilities/amenities).
- Each maintainable region carries **agronomic state**: turf health, moisture,
  nutrients, growth/length, and stress/disease load. Aggregate, not per-point.
- **Actors/systems** operate over regions and time: staff/automation (maintenance
  throughput), golfers (demand & revenue), weather, economy (cash, income,
  expenses, loans), prestige, research.
- **Time** advances in discrete turns/periods (§5). Determinism where possible;
  seeded randomness for risk events.

No meshes, tiles, or coordinates beyond what gameplay needs.

---

## 9. Decisions locked

- **Heart:** the interlock (agronomy ↔ economy as one flywheel). [§3]
- **Player role:** hands-on, evolving into delegation as you scale. [§1, §6]
- **Time:** turn/period-based, plan→simulate→adapt; *not* a live clock. Fixed
  cadence, interruptible by crises; the period **zooms** (days→weeks→seasons) as
  you delegate. [§5]
- **Goal:** scenario campaign of discrete, self-contained, *losable* levels;
  only player mastery carries between them. [§6]
- **Delegation:** layered and deepening — assign people → standing orders →
  department heads, each unlocked by growth. [§4, §6]
- **Failure:** hard game-over per scenario (bankruptcy or blown objective). [§5]
- **Staff:** individuals with progression — an investment you develop and trust;
  the substrate of delegation. [§6]
- **Risk stance:** calculated risk, **hidden but learnable** — no surfaced odds,
  a consistent model you learn by playing. [§7]
- **Demand:** organic (prestige/price/reputation/weather), plus optional
  **marketing bets** that can underperform. [§4]
- **Objectives:** restoration, economic, survival, and tournament archetypes. [§6]
- **Expansion:** both fixed-size puzzles and renovation-centered scenarios. [§6]
- **Tournaments:** optional high-risk play wherever eligible; sometimes the
  objective itself. [§6]
- **Course model:** features/regions with aggregate agronomic state. [§8]

---

## 10. Open decisions

- **First risk system** for the core slice (§7) — chosen when the first slice is
  built.

---

## 11. Definition of done

- **This design:** done when §1–§8 are agreed and §10 has calls. It is
  intentionally high-level; mechanics and numbers live in per-system docs.
- **Documentation set:** this design doc + one focused doc per core system
  (agronomy, economy & pricing, prestige & demand, risk events,
  progression/research, tournaments). Small and curated.
- **First playable slice:** one small course, a handful of regions, the §3
  interlock, the doing→delegating arc in miniature, and *one* §7 risk system —
  enough to prove the strategy is fun before anything is widened.
