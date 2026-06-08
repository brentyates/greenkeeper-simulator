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
    Decisions, FixedPricing, GreedyPricing, NeglectfulPricing, PlanStrategy, Strategy,
    SweetSpotPricing,
};
pub use event::{Event, Trace};
pub use model::{default_segments, Region, RegionKind, Segment, World};
pub use rng::Rng;

/// Advance the world by one turn, running every system in fixed order and
/// appending the resulting events to `trace`.
pub fn step(world: &mut World, decisions: &Decisions, trace: &mut Trace) {
    if world.bankrupt {
        return;
    }
    world.turn += 1;
    trace.push(Event::TurnStarted { turn: world.turn });

    world.staff_capacity = decisions.target_capacity.max(0.0);

    let dryness = systems::weather(world, trace);
    systems::agronomy(world, dryness);
    systems::maintenance(world, trace);
    systems::treatment(world, decisions.treat, trace);
    systems::disease_tick(world, dryness, trace);
    systems::conditions_and_prestige(world, trace);
    let outcome = systems::demand_and_revenue(world, decisions.price, dryness, trace);
    systems::wear_from_traffic(world, outcome.golfers);
    systems::economy(world, outcome.revenue, outcome.golfers, trace);
}

/// Run `turns` turns, letting `strategy` choose decisions each turn. Stops early
/// on bankruptcy. Returns the full trace.
pub fn run(world: &mut World, strategy: &mut dyn Strategy, turns: u32) -> Trace {
    let mut trace = Trace::new();
    for _ in 0..turns {
        if world.bankrupt {
            break;
        }
        let decisions = strategy.decide(world);
        step(world, &decisions, &mut trace);
    }
    trace
}
