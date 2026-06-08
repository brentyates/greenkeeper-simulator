//! Decisions are what the player (or an automated strategy) commits each turn:
//! the levers that let you commit to and execute a strategy (a "path").

use crate::model::World;
use crate::systems::sweet_spot;

#[derive(Clone, Debug)]
pub struct Decisions {
    pub price: f64,
    /// Crew capacity to run this turn — more staff maintains more ground and
    /// fights disease, but costs wages. The lever that makes a busy budget course
    /// viable, or keeps a premium course lean.
    pub target_capacity: f64,
    /// Whether to treat active turf disease this turn.
    pub treat: bool,
}

/// A decision policy that can drive a run without a human — for testing and for
/// balance sweeps. Real play will replace this with player input on top.
pub trait Strategy {
    fn decide(&mut self, world: &World) -> Decisions;
}

/// A full operating plan: a price point, a staffing level, and a disease policy.
/// Expresses a *path* (budget / value / premium / elite, well- or ill-run).
pub struct PlanStrategy {
    pub price: f64,
    pub capacity: f64,
    pub treat: bool,
}

impl Strategy for PlanStrategy {
    fn decide(&mut self, _world: &World) -> Decisions {
        Decisions {
            price: self.price,
            target_capacity: self.capacity,
            treat: self.treat,
        }
    }
}

/// Earns its way up: prices at the sweet spot for the *current* prestige tier, so
/// the fee rises as the course's reputation grows. Staffs to the chosen level.
pub struct RampStrategy {
    pub capacity: f64,
}

impl Strategy for RampStrategy {
    fn decide(&mut self, world: &World) -> Decisions {
        Decisions {
            price: sweet_spot(world.tier()),
            target_capacity: self.capacity,
            treat: true,
        }
    }
}

/// Holds a flat green fee, keeps staffing unchanged, and treats outbreaks.
pub struct FixedPricing {
    pub price: f64,
}

impl Strategy for FixedPricing {
    fn decide(&mut self, world: &World) -> Decisions {
        Decisions {
            price: self.price,
            target_capacity: world.staff_capacity,
            treat: true,
        }
    }
}

/// Like `FixedPricing` but never treats disease — to measure the cost of neglect.
pub struct NeglectfulPricing {
    pub price: f64,
}

impl Strategy for NeglectfulPricing {
    fn decide(&mut self, world: &World) -> Decisions {
        Decisions {
            price: self.price,
            target_capacity: world.staff_capacity,
            treat: false,
        }
    }
}

/// Prices at the sweet spot for the current prestige tier.
pub struct SweetSpotPricing;

impl Strategy for SweetSpotPricing {
    fn decide(&mut self, world: &World) -> Decisions {
        Decisions {
            price: sweet_spot(world.tier()),
            target_capacity: world.staff_capacity,
            treat: true,
        }
    }
}

/// Prices above the tier's sweet spot, gambling margin against lost golfers.
pub struct GreedyPricing {
    pub multiplier: f64,
}

impl Strategy for GreedyPricing {
    fn decide(&mut self, world: &World) -> Decisions {
        Decisions {
            price: sweet_spot(world.tier()) * self.multiplier,
            target_capacity: world.staff_capacity,
            treat: true,
        }
    }
}
