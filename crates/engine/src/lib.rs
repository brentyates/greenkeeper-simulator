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
    sweet_spot, Decisions, FixedPricing, NeglectfulPricing, PlanStrategy, RampStrategy, Strategy,
};
pub use event::{Event, Trace};
pub use model::{
    default_segments, Balance, Course, DiseaseBalance, DiseasePolicy, EconomyBalance, Finances,
    Operations, PrestigeBalance, Region, RegionKind, Segment, Standing, World,
};
pub use rng::Rng;

/// Advance the world by one turn, running every system in fixed order and
/// appending the resulting events to `trace`.
pub fn step(world: &mut World, decisions: &Decisions, trace: &mut Trace) {
    if world.finances.bankrupt {
        return;
    }
    world.turn += 1;
    trace.push(Event::TurnStarted { turn: world.turn });

    world.ops.staff_capacity = decisions.target_capacity.max(0.0);

    let dryness = systems::weather(world, trace);
    systems::agronomy(world, dryness);
    systems::maintenance(world, trace);
    systems::treatment(world, decisions.disease, trace);
    systems::disease_tick(world, dryness, trace);
    systems::prestige_update(world, trace);
    let outcome = systems::demand_and_revenue(world, decisions.price, dryness, trace);
    systems::wear_from_traffic(world, outcome.golfers);
    systems::standing_update(world, &outcome);
    systems::economy(world, outcome.revenue, outcome.golfers, trace);
}

/// Run `turns` turns, letting `strategy` choose decisions each turn. Stops early
/// on bankruptcy. Returns the full trace.
pub fn run(world: &mut World, strategy: &mut dyn Strategy, turns: u32) -> Trace {
    let mut trace = Trace::new();
    for _ in 0..turns {
        if world.finances.bankrupt {
            break;
        }
        let decisions = strategy.decide(world);
        step(world, &decisions, &mut trace);
    }
    trace
}
