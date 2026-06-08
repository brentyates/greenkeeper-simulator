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
by things you don't control (weather, the market). The game is the ongoing
tension between **keeping it pristine** and **making it pay** — with never quite
enough resources.

The craft at the centre — your version of designing a thrilling ride — is
**finely curated course conditions**: the unglamorous, exacting pride of a
pristine, well-run course. You begin **hands-on** on a small course and earn your
way to **delegation** as you scale; the game is as much about *learning to let go*
as about growing.

Touchstones: the granular, value-driven economy of *RollerCoaster Tycoon*, and
the golfers-with-character soul of *Sid Meier's SimGolf* — but the latter is
delivered as **story, never spectacle** (§2, §9).

The fantasy: *grow a neglected course into a championship club through smart,
risky decisions — and live with the consequences of each one.*

---

## 2. Design principles

Hard constraints, not aspirations.

1. **Strategy is the foundation, not a future layer.** Risk/reward and
   meaningful decisions are built *first*. The simulation exists to make those
   decisions bite.
2. **Every system must create a real decision with an upside *and* a downside.**
   If a system has an obviously-correct action, it's not strategy — cut it or
   add the tradeoff.
3. **Deterministic base, reactive risk.** The core is predictable enough to plan
   around; managed uncertainty forces you to adapt.
4. **Model the course as features, not geometry.** The unit of state is a
   *region* (a green, a fairway, a bunker), not a tile or a coordinate.
5. **Depth through interaction.** Richness comes from systems feeding each other,
   not from more systems.
6. **Earned, never declared.** Quality, character, and reputation are *derived
   from simulation state and player decisions* — never authored attributes or
   canned flavor. The trace reports what was earned; it never invents it. If the
   systems can't produce it, the game doesn't claim it.
7. **Entertainment is narrative, not spectacle.** Character and story reach the
   player through the trace — events, reactions, word-of-mouth — never a rendered
   scene. The spatial/visual layer is out of scope by design.
8. **Finishable scope.** Every system, and this document, has a definition of
   done. Vertical slices that are fully playable, then depth.

---

## 3. The heart: the interlock

One reinforcing loop drives everything. Conditions and money are not separate
games; they are the same flywheel.

```
   maintenance & investment
            │
            ▼
     course conditions ──► prestige ──► pricing power & demand
            ▲                                   │
            │                                   ▼
     reinvestment ◄──── revenue (fees + secondary spend) ◄──── golfers
```

**Reinforcing:** a pristine course earns prestige; prestige draws golfers and
lets you charge more; their fees *and their secondary spend* fund the upkeep and
investment that keep it pristine. Once it catches, it compounds.

**The brake is the flywheel.** This is the core tension, and it is
self-generating: the very growth that makes money — more golfers, more amenities,
more play — **physically wears the course, crowds it, and slows pace**, degrading
the pristine conditions that create the value in the first place. Holding quality
*while* growing attendance and secondary spend is genuinely hard, because they
pull against each other. Add the slow forces — continuous decay (a bigger, better
course is *more* to maintain) and **asymmetric prestige** (years to build,
moments to destroy) — and the strategy is simply: how hard do you push, and when
do you ease off?

---

## 4. The decision space (what the player actually does)

Every item is a recurring decision with a genuine tradeoff. This list *is* the
game.

- **Pricing (per segment).** Set fees against what each golfer segment will pay;
  price up for margin and a quiet, pristine course, or down for volume you then
  monetize elsewhere. (§7)
- **Revenue mix.** Invest in and run secondary spend — F&B, carts, pro shop,
  lessons — which can rival green fees but adds load and complexity. (§7)
- **Marketing bets.** Optional, timed campaigns that *gamble* on boosting
  demand; they can underperform. Never a guaranteed "spend → golfers" shortcut.
- **Allocation.** Limited labor/attention/money across competing regions and
  needs. The 4th green is failing *and* payroll is due *and* research is mid-fund.
- **Capital vs. labor.** Substitute money for ongoing labor: hire → irrigation →
  robots → elite turf. Each is a capital bet with a break-even and a failure mode.
- **Risk posture.** How much to spend on prevention vs. reaction. (§8)
- **Pacing.** How tightly to pack play: revenue now vs. pace-of-play, wear, and
  reputation over time.
- **Delegation.** As you scale, hand work to a crew and to standing rules — *what*
  you delegate, *to whom*, and *how much you trust it*. (§6)
- **Progression bets.** Research path, when to expand, and whether to accept a
  tournament you might not be able to keep pristine. (§6, §8)

---

## 5. Play structure (time, turns, feedback)

- **Turn/period-based, not a live clock.** You set decisions, advance time, and
  watch them resolve — then read the results and adapt. Pressure comes from
  *consequences*, not reflexes.
- **Plan → simulate → read → adjust** is the core rhythm.
- **Hard stakes.** A scenario can be *lost*: bankruptcy or failing the objective
  ends the run, and you retry with what you learned.
- **Fixed cadence, interruptible.** Each turn advances a fixed period, but a
  serious event can pause it and demand an immediate decision.
- **The period zooms with your role.** Fine grain early (days, hands-on); as you
  delegate and the course runs itself, the turn widens to weeks, then seasons.
  Zooming out is a *reward*; a crisis dragging you back to daily firefighting is a
  real cost.

---

## 6. Progression (what you climb, and what each tier unlocks)

The goal structure is a **scenario campaign** of hand-crafted, **self-contained**
levels — each its own course, fresh start, objective, and difficulty modifiers.
Money, staff, and research are **per-scenario**; what carries between levels is
*your* mastery. Each scenario is a complete run of the doing→delegating arc in
miniature: build up, then hold or hit a target — or lose.

Scenarios span **objective archetypes** — restoration, economic targets,
survival, and tournaments — and are either **fixed-size puzzles** or
**renovation/expansion** challenges (adding holes or rebuilding greens via phased
closures: capacity/prestige gain vs. revenue lost during construction).

The spine that runs through every scenario:

- **The role arc: doing → delegating.** Delegation deepens in layers as you
  scale: **assign people → write standing orders → promote department heads.**
  Each layer is unlocked by growth and lets the turn zoom out.
- **Staff as investment.** Crew are individuals with skill, experience, and
  reliability you develop and learn to trust; a great hire compounds, a key
  departure hurts. Good help is hard to find.
- **Prestige tiers (★1–5).** The master gate: pricing power, memberships,
  tournament eligibility, amenities. Scored from conditions, *historical*
  excellence (no faking it for an inspection), reputation, amenities, exclusivity.
- **Research.** A branching tree of capital-vs-labor and quality-vs-cost
  tradeoffs, with distinct viable paths.
- **Course scale (3 → 9 → 18 → 27 holes).** More ground than a small crew can
  hold, forcing the hire-then-automate arc.
- **Tournaments — the apex bet.** Earned through *sustained* excellence; an
  optional high-risk play wherever eligible (and the objective of some scenarios).
  Huge gains on success, lasting setbacks on failure.

---

## 7. Economy & demand

The economic feel is granular and value-driven — the part of the game you fiddle
with and take pride in optimizing.

- **Segmented golfers.** Demand is not one number. Golfers come in segments
  (e.g. bargain-hunters, regulars, avid players, affluent members), each with its
  own **willingness-to-pay** and value sensitivity. A golfer plays only if the
  price sits under their **perceived value**, where value rises with prestige and
  conditions. Raise the fee and you shed the price-sensitive segments first; the
  demand curve **emerges from the mix**, and you can price to court or shed a
  segment deliberately.
- **Multiple revenue streams.** Green fees are primary, but **secondary spend** —
  beverage cart / F&B, pro shop, cart rental, lessons, the range — should be able
  to *rival* fees. A round is hours long: golfers get hungry, thirsty, tired, and
  spend, with weather amplifying it (a hot day sells drinks and carts). Each
  stream is a margin business with its own uptake.
- **Amenities as capex.** Amenities aren't just prestige trinkets — they
  **unlock and multiply** secondary spend, and add load and running cost. A real
  build-vs-wait investment decision.
- **Novelty premium.** A renovated hole or a hosted tournament grants a temporary
  demand/price bump that **decays** — a standing reason to keep investing.
- **Financial levers.** Open on a **loan** (interest, payments, bankruptcy risk);
  set a **research funding** rate; weigh **marketing** campaigns as timed bets.

The strategic space: chase a few affluent players at premium fees on a quiet,
pristine course, **or** pack the bargain crowd cheap — accepting wear, crowding,
and pace costs — and make it back on carts and the clubhouse. No single price or
mix dominates; that's the game.

**The reward curve is asymmetric by design — many paths *survive*, few get
*rich*.** A well-run course of almost any style should reliably **stay afloat**:
a sensible price, conditions held, staffed to match its traffic, disease managed.
That's a livable business — but it must **never make heaps**. Heaps are reserved
for the hard path: sustained **high prestige**, **tournaments pulled off**, and
the juggling of many staff and demanding high-end golfers. Big money is *earned
through difficulty and risk*, never handed to a safe mid operation. Mechanically:
green-fee volume is deliberately **thin-margin** (a per-round upkeep cost caps it),
so the fortunes live at the top — premium pricing power at high prestige, and
above all **tournament payouts**. Both honest failure and real riches are
possible; comfortable mediocrity is the default.

---

## 8. Risk & reward

**The sharpest risk is intrinsic** (§3): keeping conditions pristine *while*
growing attendance and secondary spend, which fight each other through wear,
crowding, and pace. That tension alone, under managed uncertainty, is the core
risk/reward — no crisis system required to make the game tense.

**Stance: calculated risk, hidden but learnable.** Randomness is meaningful but
manageable (buffers, prevention, pacing); a bad outcome feels like a bet that
didn't land, not an arbitrary punishment. The odds are never shown as numbers —
you learn the model by living it, reading cues and telegraphed signs, and a
seasoned crew reads danger a novice misses. This obliges the model to be
*consistent and discoverable*.

**Optional named risk layers** can deepen specific scenarios later, on top of the
intrinsic tension — agronomic crises (disease/pests with prevention-vs-reaction
spread), punishing weather & seasons, or market/competition pressure. None is
required for the first playable slice.

---

## 9. Character & story (the entertainment layer)

The soul of a course-management game is golfers reacting to *your* course —
delivered, per principle 6, as **narrative in the trace, not a rendered round**.

- **Golfers are segments with occasional named vignettes.** The population is
  aggregate, but the trace surfaces the occasional character moment — a regular
  raving about a green, a group grumbling about pace, a notable visitor's review —
  that gives a run personality and texture.
- **Holes are maintenance regions for now** — reputation and character live at
  the **course** level. This is a *current default, open to revisit* (§12):
  per-hole *character* (a signature hole golfers fear or adore) is achievable
  headlessly as attributes + narrative; per-hole *design* (shaping and seeing a
  hole) is the part that genuinely wants visuals, and that stays out of scope.
- Every story beat is **earned** (principle 6): it reports a real simulation
  outcome — a genuine pace jam, a true condition peak, an actual lost golfer —
  never an authored adjective. If the systems can't produce it, the trace doesn't
  claim it.

---

## 10. The course model (domain, not implementation)

- **Course** → a set of **features/regions** (holes, greens, fairways, tees,
  roughs, bunkers, water) plus facilities/amenities.
- Each maintainable region carries **agronomic state**: turf health, moisture,
  nutrients, growth/length, and stress/wear. Aggregate, not per-point.
- **Actors/systems** operate over regions and time: staff/automation, golfers
  (segmented demand & spend), weather, economy (cash, income, expenses, loans),
  prestige, research.
- **Time** advances in discrete turns/periods (§5). Determinism where possible;
  seeded randomness for variability and risk.

No meshes, tiles, or coordinates beyond what gameplay needs.

---

## 11. Decisions locked

- **Heart:** the interlock; its brake (growth wears/crowds the course) is the
  intrinsic risk. [§3, §8]
- **Craft:** finely curated conditions are the central pursuit. [§1]
- **Economy:** RCT-style — segmented golfers paying on perceived value; secondary
  revenue streams that can rival green fees; amenities as capex; novelty premium;
  loans, research dial, marketing bets. [§7]
- **Reward curve:** many paths *survive* (livable floor), few get *rich*; heaps
  require the hard path — high prestige, tournaments, complexity. Volume is
  thin-margin by design. [§7]
- **Player role:** hands-on, evolving into layered delegation. [§1, §6]
- **Time:** turn/period-based; fixed cadence, interruptible; zooms days→weeks→
  seasons as you delegate. [§5]
- **Goal:** scenario campaign of discrete, self-contained, *losable* levels. [§6]
- **Failure:** hard game-over per scenario (bankruptcy or blown objective). [§5]
- **Staff:** individuals with progression — the substrate of delegation. [§6]
- **Risk:** intrinsic-first; calculated, hidden but learnable; named risk layers
  optional later. [§8]
- **Entertainment:** narrative only — segmented golfers + named vignettes in the
  trace. Holes are maintenance regions *for now* (per-hole character revisitable;
  see §12). [§6, §9]
- **Course model:** features/regions with aggregate agronomic state. [§10]

---

## 12. Open decisions

- **Optional named risk layer(s)** to add to specific scenarios later (§8) — not
  needed for the first playable.
- **Hole character:** maintenance regions (current default) vs. attribute-driven
  signature holes. Leaning regions; revisit if a light hole layer earns its keep.
  Full spatial hole *design* needs visuals and remains out of scope. (§9)
- **Scenario file format** (RON vs TOML) — tracked in `TECH.md`.

---

## 13. Definition of done

- **This design:** done when §1–§10 are agreed and §12 has owners. It is
  intentionally high-level; mechanics and numbers live in per-system docs.
- **Documentation set:** this design doc + one focused doc per core system
  (agronomy, economy & demand, prestige, progression/research, tournaments).
- **First playable slice:** one small course, a handful of regions, the §3
  interlock with the §7 segmented economy and its intrinsic risk, and the
  doing→delegating arc in miniature — enough to prove the strategy is fun before
  anything is widened.
