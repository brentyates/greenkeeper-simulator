# Greenkeeper — Tech & Architecture

> Implementation decisions. Pairs with `DESIGN.md` (the *what*); this is the
> *how*. Decisions are marked **[decided]**, **[recommended]** (a default open to
> override), or **[open]** (still needs a call).

---

## 1. Principles

1. **Deterministic & reproducible. [decided]** A single seed drives all
   randomness. Same seed + same inputs → identical run, every time. Required for
   "hidden but learnable" risk (the model must be consistent) and for replaying
   many runs to tune balance.
2. **Library-first. [decided]** The engine is a pure library with a clean API and
   *no* I/O, no globals, no clock. Anything that drives it (CLI, tests, a future
   UI) sits on top and is disposable.
3. **State + systems. [decided]** Explicit data structures hold world state; pure
   functions ("systems") advance it one turn at a time in a fixed order. No
   hidden mutable object graphs.
4. **Data-driven scenarios. [decided]** Scenarios are authored as data files, not
   code. The engine reads a scenario, runs it, emits a trace.
5. **Readable traces. [decided]** A run produces a structured, ordered event log.
   It is how you *see* the hidden model's effects — for reading, debugging, and
   tuning.
6. **Finishable & testable.** Every system is unit-tested; full runs are locked
   with snapshot tests; invariants are property-tested. Green means correct.

---

## 2. Language: Rust [decided]

Chosen for compiler-enforced correctness, speed for large balance sweeps, and a
clean WASM path if a UI is ever added. The edit-run loop is slower than a dynamic
language; we accept that for the guardrails.

---

## 3. Project shape [recommended]

A Cargo **workspace** of small crates, so the pure core can't accidentally depend
on I/O or presentation:

```
greenkeeper/
├─ crates/
│  ├─ engine/        # pure simulation library: state, systems, rules. No I/O.
│  ├─ cli/           # binary: load scenario file → run engine → render trace
│  └─ scenarios/     # scenario data files (+ loader types) — the campaign
├─ Cargo.toml        # workspace manifest
└─ docs/
```

- `engine` depends on nothing but `serde` + the RNG. It accepts a seed and a
  scenario config, exposes `step`/`run`, and returns state + a trace.
- `cli` owns all reading/writing and human-facing formatting.
- A `balance`/sweep tool can be added later as another binary over `engine`.

---

## 4. Architecture: state + systems [decided]

- **World state** is a plain data tree: course → regions (with agronomic state),
  economy, staff, prestige, demand, weather, research, scenario progress, and the
  seeded RNG state.
- **A turn** runs systems in a fixed, documented order (e.g. weather → agronomy
  decay/growth → maintenance/staff → golfers/demand → revenue → prestige → risk
  events → objective check), each a pure `fn(&mut World)`.
- **Fixed cadence, interruptible** (DESIGN §5): a turn resolves a period, but a
  system can raise an *interrupt* (a crisis/threshold) that surfaces a required
  decision before time continues.
- **No randomness outside the seeded RNG**, which is threaded through state.
- **Tuning is data, not code:** all balance lives in a `Balance` struct on
  `World` (defaulted to the baseline), grouped by system (economy/prestige/
  conditions) — ready to vary per scenario and tune via the sweep without
  recompiling. World state is grouped into `course / finances / ops / standing`.

---

## 5. Determinism & RNG [decided]

- A small hand-rolled **SplitMix64** PRNG (`engine::rng`), kept dependency-free
  and identical on every platform. The seed lives in `World`, threaded through
  systems, so runs and replays are exact. (Chosen over `rand`/`rand_chacha` to
  keep the engine zero-dependency; determinism is the only contract that matters.)
- Float ordering uses `total_cmp` (never `partial_cmp().unwrap()`) so no NaN can
  panic the sort.

---

## 6. Scenario & balance data (input) [format decided: TOML]

Tuning and scenarios are serde-deserialized data: the `Balance` struct
(economy/prestige/conditions/tournament), plus starting conditions, course
definition (regions), objective + difficulty modifiers. **Format = TOML** —
purpose-built for config, comments, no whitespace footguns, best-maintained
crate, and it maps cleanly onto the grouped `Balance` (`[economy]` / `[prestige]`
/ …). (Chosen over YAML — whose `serde_yaml` is unmaintained and which has
type-coercion footguns — and RON.) File loading lives in the shell (`cli`/`sweep`/
a future tuner), keeping the engine pure; `Balance` is already injectable via
`World::with_balance`.

**Strategies** (a decision policy you run to test/tune — "price at sweet spot,
hire when backlog > N") start as small Rust code implementing a `Strategy` trait,
so we can drive runs without a human. They can move to data later if useful.

---

## 7. Trace / output [recommended]

- `engine` emits a `Vec` of structured, timestamped **events** (turn started,
  region watered, tournament booked, golfers turned away, objective met, …).
- `cli` renders that stream two ways: a **human-readable timeline** for reading a
  run, and **structured export** (JSON/CSV) for aggregating across many runs.
- The engine never prints; it only produces data.

---

## 8. Testing & tuning [recommended]

- **Unit tests** per system (the agronomy/economy/prestige rules).
- **Snapshot/golden tests** (`insta`) over full-run traces: lock a scenario+seed,
  diff the trace on every change. The regression net that keeps balance from
  silently drifting.
- **Property tests** (`proptest`) for invariants: cash accounting balances, state
  stays in bounds, no NaNs, determinism (same seed twice = identical trace).
- **Balance sweeps**: run many seeds × strategies, aggregate outcomes, surface
  whether decisions actually trade off as intended.

### Balance tuning & ML-readiness [decided]

If hand-tuning the balance becomes intractable, tuning escalates to automated
search — grid/evolutionary/Bayesian optimization over the parameter space, or RL
agents probing for dominant strategies. The architecture is built so that is a
*plug-in, not a rewrite*:

- **Balance is data and injectable.** `Balance` is a plain struct of ~25 `f64`s,
  set via `World::with_balance(..)`. An optimizer mutates it and re-measures in a
  loop — the property `balance_is_data_driven` proves the engine reads it.
- **Cheap, deterministic, headless evaluation.** Zero-dependency, seeded,
  no-I/O → millions of reproducible runs are feasible; identical seed+balance →
  identical trace, so results are comparable across the search.
- **A clear objective to optimize toward.** The fitness is the design's reward
  curve (DESIGN §7): *many paths survive, heaps only via the hard path.* A tuner
  scores a `Balance` by how well a panel of strategies × seeds reproduces that
  shape (viable mid paths, fatal extremes, premium-only riches).
- **Balance is editable as TOML** (done): `Balance` derives serde; the shell
  loads `config/balance.toml` (override via `$GK_BALANCE`) and injects it; an
  optimizer can persist/share candidates as TOML or build them in memory.
- **When pursued, add (not before):** a shared `evaluate(balance, strategies,
  seeds) -> Metrics` seam factored out of the sweep, and optionally
  `Balance ↔ Vec<f64>` for vectorized optimizers. Until then, YAGNI.

---

## 9. Dependencies (keep lean)

- **Engine:** `serde` (derive only) for tuning data; otherwise dependency-free
  (hand-rolled RNG). Pure — no file I/O.
- **Shell (`cli`/`sweep`):** `toml` for reading `config/balance.toml`.
- **Dev:** `toml` for the round-trip test. Consider `insta`/`proptest` later.
- Resist adding more without a reason.

---

## 10. Open

- **Strategies as code vs data:** start as code; revisit. (§6)

---

## 11. Definition of done (tech & first slice)

- **This doc:** done when §1–§8 are agreed and §10 has calls.
- **First slice:** the workspace exists with `engine` + `cli`; one scenario file
  loads; a run is deterministic; it emits a readable trace; one snapshot test and
  one determinism property test pass. Enough to prove the loop end-to-end before
  widening any system.
