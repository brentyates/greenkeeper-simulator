//! Systems: pure functions that advance world state one turn, in a fixed order.
//! All balance constants here are placeholders to be tuned.

use crate::event::{Event, Trace};
use crate::model::World;

// --- placeholder balance ---
const MAX_PRESTIGE_UP: f64 = 5.0; // years to build...
const MAX_PRESTIGE_DOWN: f64 = 15.0; // ...moments to destroy
const SERVICE_COST: f64 = 10.0; // capacity to fully service one region
const NUTRIENT_DECAY: f64 = 2.0;
const POTENTIAL_GOLFERS: f64 = 40.0; // at perfect condition and full demand
const WAGE_PER_CAPACITY: f64 = 2.0;
const FIXED_OVERHEAD: f64 = 50.0;
const BANKRUPTCY_FLOOR: f64 = -1000.0;

/// Green-fee sweet spot by prestige tier (0-based): max demand at/below this.
pub fn sweet_spot(tier: u32) -> f64 {
    match tier {
        0 => 15.0,
        1 => 35.0,
        2 => 65.0,
        3 => 120.0,
        _ => 200.0,
    }
}

/// How demand scales with price relative to the tier's tolerance. 1.0 at/below
/// the sweet spot; falls off to a floor as price approaches the tolerance ceiling.
pub fn demand_multiplier(price: f64, tier: u32) -> f64 {
    let sweet = sweet_spot(tier);
    if price <= sweet {
        return 1.0;
    }
    let ceiling = sweet * 1.8;
    if price >= ceiling {
        return 0.05;
    }
    let t = (price - sweet) / (ceiling - sweet);
    1.0 - t * 0.8
}

/// Weather for the turn: returns extra moisture loss (rng-driven, so seeded).
pub fn weather(world: &mut World, trace: &mut Trace) -> f64 {
    let dryness = world.rng.range(0.0, 6.0);
    trace.push(Event::Weather { dryness });
    dryness
}

/// Turf decays and grows. Lush turf grows faster — the decay treadmill.
pub fn agronomy(world: &mut World, extra_dryness: f64) {
    for r in world.regions.iter_mut() {
        r.moisture = (r.moisture - r.kind.moisture_decay() - extra_dryness).clamp(0.0, 100.0);
        r.nutrients = (r.nutrients - NUTRIENT_DECAY).clamp(0.0, 100.0);
        let mut growth = r.kind.growth_rate();
        if r.moisture > 50.0 && r.nutrients > 50.0 {
            growth *= 1.5;
        }
        r.growth = (r.growth + growth).clamp(0.0, 100.0);
    }
}

/// Limited crew capacity services the neediest regions first. When there are more
/// needy regions than capacity, conditions slip — the core allocation tension.
pub fn maintenance(world: &mut World, trace: &mut Trace) {
    let mut order: Vec<usize> = (0..world.regions.len()).collect();
    order.sort_by(|&a, &b| {
        world.regions[a]
            .health()
            .partial_cmp(&world.regions[b].health())
            .unwrap()
    });

    let mut budget = world.staff_capacity;
    let mut serviced = 0u32;
    for i in order {
        if budget < SERVICE_COST {
            break;
        }
        let r = &mut world.regions[i];
        r.moisture = 70.0;
        r.growth = 5.0;
        r.nutrients = 80.0;
        budget -= SERVICE_COST;
        serviced += 1;
    }
    trace.push(Event::Maintenance {
        regions_serviced: serviced,
        capacity_used: world.staff_capacity - budget,
    });
}

/// Conditions drive prestige, which moves toward its target asymmetrically.
pub fn conditions_and_prestige(world: &mut World, trace: &mut Trace) {
    let avg = world.avg_health();
    trace.push(Event::Conditions { avg_health: avg });

    let target = avg * 10.0; // 0..100 health → 0..1000 prestige
    let diff = target - world.prestige;
    let delta = if diff >= 0.0 {
        diff.min(MAX_PRESTIGE_UP)
    } else {
        diff.max(-MAX_PRESTIGE_DOWN)
    };
    world.prestige = (world.prestige + delta).clamp(0.0, 1000.0);
    trace.push(Event::Prestige { value: world.prestige, delta });
}

/// Prestige and conditions set how many golfers come; price sets how many of them
/// actually play. Returns revenue for the turn.
pub fn demand_and_revenue(world: &mut World, price: f64, trace: &mut Trace) -> f64 {
    world.price = price;
    let tier = world.tier();
    let condition = world.avg_health() / 100.0;
    let potential = (POTENTIAL_GOLFERS * condition).round();
    let golfers = (potential * demand_multiplier(price, tier)).round();
    let turned_away = (potential - golfers).max(0.0);
    let revenue = golfers * price;

    trace.push(Event::Demand {
        potential: potential as u32,
        golfers: golfers as u32,
        turned_away: turned_away as u32,
        price,
    });
    trace.push(Event::Revenue { amount: revenue });
    revenue
}

/// Revenue in, wages and overhead out. Bankruptcy ends the run.
pub fn economy(world: &mut World, revenue: f64, trace: &mut Trace) {
    let expenses = world.staff_capacity * WAGE_PER_CAPACITY + FIXED_OVERHEAD;
    let delta = revenue - expenses;
    world.cash += delta;
    trace.push(Event::Cash { value: world.cash, delta });
    if world.cash < BANKRUPTCY_FLOOR {
        world.bankrupt = true;
        trace.push(Event::Bankrupt { turn: world.turn });
    }
}
