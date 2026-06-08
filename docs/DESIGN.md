# Greenkeeper — Design (v0.1 draft)

> Status: working draft for discussion. This is the single source of truth for
> the *strategy-first rebuild*. It is implementation-agnostic on purpose — no
> language, runtime, or rendering decisions live here. It supersedes the legacy
> docs (now reference only); where it conflicts with them, this doc wins.

---

## 1. What this is

A **management simulation** of running a golf course. You are not an avatar on
the grounds — you are the person making the decisions: what to charge, where to
spend scarce money and labor, what to invest in, and how much risk to carry.

The course is a **living system** that decays without attention and is buffeted
by things you don't control (weather, disease, the market). The game is the
ongoing tension between **keeping it alive** and **making it pay** — under
uncertainty, with never quite enough resources.

The fantasy: *grow a neglected course into a championship club through smart,
risky decisions — and live with the consequences of each one.*

---

## 2. Design principles (the lessons, made into rules)

These exist because the previous attempt died of them. They are constraints, not
aspirations.

1. **Strategy is the foundation, not a future layer.** Risk/reward and
   meaningful decisions are built *first*. The simulation exists to make those
   decisions bite — not the other way around. (Last time, strategy was always
   "next," and "next" never came.)
2. **Every system must create a real decision with an upside *and* a downside.**
   If a system has an obviously-correct action, it's not strategy — cut it or
   add the tradeoff.
3. **Deterministic base, reactive risk.** The core is predictable enough to plan
   around; uncertainty forces you to adapt. A plan you never have to change isn't
   a strategy game.
4. **Model the course as features, not geometry.** The unit of state is a
   *region* (a green, a fairway, a bunker), not a tile or a triangle. Geometry
   was a rendering artifact; it has no place in the simulation.
5. **Depth through interaction.** Difficulty and richness come from systems
   feeding each other, not from more systems. Prefer one loop with five
   consequences over five loops with one each.
6. **Finishable scope.** Every system, and this document, has a definition of
   done. We build vertical slices that are fully playable, then add depth — never
   broad half-built layers.

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
- **Allocation.** Limited labor/attention/money across competing regions and
  needs. The 4th green is failing *and* payroll is due *and* research is mid-fund
  — what gives?
- **Capital vs. labor.** Substitute money for ongoing labor: hire staff → install
  irrigation → buy robots → plant elite turf. Each is a capital bet with a
  break-even and a failure mode (breakdowns, leaks, establishment penalties).
- **Risk posture.** How much to spend on *prevention* vs. *reaction*. Running
  lean invites rare catastrophes; over-insuring bleeds you slowly. (See §6.)
- **Pacing.** How tightly to pack play: revenue now vs. pace-of-play, wear, and
  reputation over time.
- **Progression bets.** Which research path, when to expand, and whether to
  accept a tournament you might not be able to keep pristine. (See §5, §6.)

---

## 5. Progression (what you climb, and what each tier unlocks)

Progression is not just bigger numbers — each tier opens *new decisions*.

- **Prestige tiers (★1–5).** The master gate. Higher tiers raise pricing power
  and unlock memberships, tournament eligibility, and amenities. Scored from
  conditions, *historical* excellence (so you can't fake it for an inspection),
  reputation, amenities, exclusivity.
- **Research.** A branching tree of capital-vs-labor and quality-vs-cost
  tradeoffs (irrigation, turf science, robotics, facilities). Distinct viable
  paths (automate vs. staff; efficiency vs. prestige), not one optimal order.
- **Course scale (3 → 9 → 18 → 27 holes).** The primary difficulty driver: more
  ground than a small crew can hold, forcing the hire-then-automate arc. Possibly
  earned via renovation rather than just "buy the next level."
- **Tournaments — the apex bet.** Earned through *sustained* excellence, not
  bought. Huge payouts and permanent prestige/demand gains on success; lasting
  setbacks on failure. The legacy layer the old game specced but never built.

---

## 6. Risk & reward (the core, not the "future")

This is the depth the original design named and never shipped — graded in its own
notes as *"Risk Management: Low, Adaptation: Low."* It is now first-class. Three
candidate sources of uncertainty; **which one anchors the first slice is still
open** (decision deferred):

- **Agronomic crises.** Disease/pests that favor certain conditions, spread
  between adjacent regions, and resist overused treatments. Cleanest expression
  of risk posture: *low-risk play = fewer but larger crises; high-risk play =
  more frequent, smaller ones.*
- **Weather & seasons.** Volatility plus seasonal cycles (growth/demand swings,
  renovation windows, off-season). Converts one-time optimization into recurring
  planning.
- **Market & competition.** Demand swings, rival courses applying pricing
  pressure, cash-runway/loan risk. Makes pricing and investment a contest, not a
  solitaire optimization.

Whichever leads, the principle holds: **the player chooses how much risk to
carry, and the sim makes them live with it.**

---

## 7. The course model (domain, not implementation)

- **Course** → a set of **features/regions** (holes, greens, fairways, tees,
  roughs, bunkers, water, plus facilities/amenities).
- Each maintainable region carries **agronomic state**: turf health, moisture,
  nutrients, growth/length, and stress/disease load. Aggregate, not per-point.
- **Actors/systems** operate over regions and time: staff/automation (maintenance
  throughput), golfers (demand & revenue), weather, economy (cash, income,
  expenses, loans), prestige, research.
- **Time** advances in discrete ticks (day-level, with finer intra-day steps
  where a system needs them). Determinism where possible; seeded randomness for
  risk events.

No meshes, tiles, triangles, or coordinates beyond what gameplay needs.

---

## 8. Open decisions (tracked, not yet made)

- **First risk system** for the core slice (§6) — deferred by choice.
- **Runtime/language** — explicitly parked.
- **Marketing/demand:** keep demand purely *organic* (prestige/price/reputation/
  weather), or reintroduce marketing campaigns as a risk/ROI decision? (The
  legacy docs contradict themselves here.)
- **Employee depth:** disposable "staff as throughput," or revive the deleted
  V1 progression (skill tiers, experience, "good help is hard to find") as an
  investment system? In a sim with no character art to maintain, the depth is
  nearly free — worth reconsidering.
- **Expansion:** scenario-selected vs. in-world renovation with phased closures.

---

## 9. Definition of done (so this can be finished)

- **This doc (the vision):** done when §1–§7 are agreed and §8 has owners. It is
  intentionally high-level; mechanics and numbers live in per-system docs.
- **Documentation set overall:** this vision doc + one focused doc per core
  system (agronomy, economy & pricing, prestige & demand, risk events,
  progression/research, tournaments). Small and curated — legacy specs are
  reference, not part of the canon.
- **First playable slice (later):** one small course, a handful of regions, the
  §3 interlock, and *one* §6 risk system — enough to prove the strategy is fun in
  numbers before anything is widened.
