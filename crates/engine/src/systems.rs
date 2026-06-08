//! Systems: pure functions that advance world state one turn, in a fixed order.
//! All balance constants here are placeholders to be tuned against the sweep.

use crate::event::{Event, Trace};
use crate::model::World;

// --- placeholder balance ---
const MAX_PRESTIGE_UP: f64 = 5.0; // years to build...
const MAX_PRESTIGE_DOWN: f64 = 15.0; // ...moments to destroy
const SERVICE_COST: f64 = 10.0; // capacity to fully service one region
const NUTRIENT_DECAY: f64 = 2.0;
const WEAR_PER_GOLFER: f64 = 0.8; // wear points added per golfer, spread by traffic
const WAGE_PER_CAPACITY: f64 = 2.0;
const FIXED_OVERHEAD: f64 = 50.0;
const BANKRUPTCY_FLOOR: f64 = -1000.0;

/// Outcome of the demand system for one turn.
pub struct DemandOutcome {
    pub revenue: f64,
    pub golfers: f64,
}

/// Green-fee sweet spot by prestige tier (0-based). Kept for tier-relative
/// strategies; the segmented demand model (below) is what actually prices play.
pub fn sweet_spot(tier: u32) -> f64 {
    match tier {
        0 => 15.0,
        1 => 35.0,
        2 => 65.0,
        3 => 120.0,
        _ => 200.0,
    }
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

/// Limited crew capacity fully services the neediest regions first (restoring
/// moisture, mowing, fertilizing, repairing wear). When needy regions outnumber
/// capacity, conditions slip — the core allocation tension.
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
        r.wear = 0.0;
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
    trace.push(Event::Conditions { avg_health: avg, avg_wear: world.avg_wear() });

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

/// Segmented, value-based demand. Each segment considers a round based on the
/// course's appeal, then plays only if the price sits under what *that* segment
/// will pay. Playing golfers also spend on secondaries (scaled by amenities and
/// weather). The demand curve emerges from the segment mix.
pub fn demand_and_revenue(world: &mut World, price: f64, dryness: f64, trace: &mut Trace) -> DemandOutcome {
    world.price = price;
    let appeal = world.appeal();
    let amenity = world.amenity_level;
    let weather_spend = 1.0 + dryness * 0.1; // hot/dry rounds → more drinks & carts

    let mut interested_total = 0.0;
    let mut golfers_total = 0.0;
    let mut secondary = 0.0;

    for s in &world.segments {
        let wtp = s.base_wtp * (0.6 + 0.8 * appeal);
        let interested = s.population * (0.3 + 0.7 * appeal);
        let playing_fraction = (1.0 - (price - wtp).max(0.0) / s.wtp_spread).clamp(0.0, 1.0);
        let golfers = interested * playing_fraction;

        interested_total += interested;
        golfers_total += golfers;
        secondary += golfers * s.spend_propensity * amenity * weather_spend;
    }

    let golfers = golfers_total.round();
    let interested = interested_total.round();
    let turned_away = (interested - golfers).max(0.0);
    let green_fees = golfers * price;

    trace.push(Event::Demand {
        interested: interested as u32,
        golfers: golfers as u32,
        turned_away: turned_away as u32,
        price,
    });
    trace.push(Event::GreenFees { amount: green_fees });
    trace.push(Event::Secondary { amount: secondary });

    DemandOutcome { revenue: green_fees + secondary, golfers }
}

/// Golfer traffic wears the course — greens and tees most. This couples growth
/// back onto conditions: the more play you take, the harder it is to stay
/// pristine. The brake and the flywheel are the same mechanism.
pub fn wear_from_traffic(world: &mut World, golfers: f64) {
    let total_wear = golfers * WEAR_PER_GOLFER;
    let weight_sum: f64 = world.regions.iter().map(|r| r.kind.wear_rate()).sum();
    if weight_sum <= 0.0 {
        return;
    }
    for r in world.regions.iter_mut() {
        let share = r.kind.wear_rate() / weight_sum;
        r.wear = (r.wear + total_wear * share).clamp(0.0, 100.0);
    }
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
