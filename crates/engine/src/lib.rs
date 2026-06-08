//! Greenkeeper simulation engine.
//!
//! A deterministic, library-first core: explicit `World` state advanced by pure
//! `systems` one turn at a time, producing a structured `Trace`. No I/O.

pub mod decision;
pub mod event;
pub mod model;
pub mod rng;
pub mod systems;

pub use decision::{
    sweet_spot, Decisions, FixedPricing, PlanStrategy, RampStrategy, ScenarioStrategy, Strategy,
    TournamentStrategy,
};
pub use event::{Event, Trace};
pub use model::{
    campaign, default_segments, AgronomyBalance, Balance, Course, CourseSpec, CourseType,
    EconomyBalance, Finances, KindRates, LossReason, MarketBalance, Objective, Operations, Outcome,
    PrepTask, PrestigeBalance, Region, RegionKind, Research, ResearchBalance, Scenario, Segment,
    Standing, Tech, TournamentBalance, TournamentPhase, TournamentState, TournamentTier, World,
};
pub use rng::Rng;

/// Advance the world by one turn, running every system in fixed order and
/// appending the resulting events to `trace`.
pub fn step(world: &mut World, decisions: &Decisions, trace: &mut Trace) {
    if !world.outcome.is_running() {
        return;
    }
    world.turn += 1;
    trace.push(Event::TurnStarted { turn: world.turn });

    world.ops.staff_capacity = decisions.target_capacity.max(0.0);
    systems::research_tick(world, decisions.research_funding, trace);

    let dryness = systems::weather(world, trace);
    systems::agronomy(world, dryness);
    // Tournament prep steals capacity from maintenance unless you've staffed up.
    let prep_request = decisions.prep_effort.clamp(0.0, world.ops.staff_capacity);
    let prep_spent = systems::tournament_prep(world, prep_request, trace);
    systems::maintenance(
        world,
        (world.ops.staff_capacity - prep_spent).max(0.0),
        trace,
    );
    systems::prestige_update(world, trace);
    let attention = systems::tournament_tick(world, trace);
    systems::tournament_accept(world, decisions.accept_tournament, trace);
    let outcome = systems::demand_and_revenue(world, decisions.price, dryness, attention, trace);
    systems::wear_from_traffic(world, outcome.golfers);
    systems::standing_update(world, &outcome);
    systems::economy(world, outcome.revenue, outcome.golfers, trace);
    systems::objective_check(world, trace);
}

/// Run `turns` turns, letting `strategy` choose decisions each turn. Stops early
/// on bankruptcy. Returns the full trace.
pub fn run(world: &mut World, strategy: &mut dyn Strategy, turns: u32) -> Trace {
    let mut trace = Trace::new();
    for _ in 0..turns {
        if !world.outcome.is_running() {
            break;
        }
        let decisions = strategy.decide(world);
        step(world, &decisions, &mut trace);
    }
    trace
}
