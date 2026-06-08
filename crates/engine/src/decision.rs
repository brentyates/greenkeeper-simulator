//! Decisions are what the player (or an automated strategy) commits each turn:
//! the levers that let you commit to and execute a strategy (a "path").

use crate::model::{DiseasePolicy, World};

#[derive(Clone, Debug)]
pub struct Decisions {
    pub price: f64,
    /// Crew capacity to run this turn — more staff maintains more ground and
    /// fights disease, but costs wages.
    pub target_capacity: f64,
    pub disease: DiseasePolicy,
}

/// Green-fee sweet spot by prestige tier (0-based): the price tier-relative
/// strategies aim for. The segmented demand model is what actually prices play.
pub fn sweet_spot(tier: u32) -> f64 {
    match tier {
        0 => 15.0,
        1 => 35.0,
        2 => 65.0,
        3 => 120.0,
        _ => 200.0,
    }
}

/// A decision policy that can drive a run without a human — for testing and for
/// balance sweeps. Real play will replace this with player input on top.
pub trait Strategy {
    fn decide(&mut self, world: &World) -> Decisions;
}

/// A full operating plan: a price point, a staffing level, and a disease policy.
/// Expresses a *path* (budget / value / premium, well- or ill-run).
pub struct PlanStrategy {
    pub price: f64,
    pub capacity: f64,
    pub disease: DiseasePolicy,
}

impl Strategy for PlanStrategy {
    fn decide(&mut self, _world: &World) -> Decisions {
        Decisions {
            price: self.price,
            target_capacity: self.capacity,
            disease: self.disease,
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
            price: sweet_spot(world.standing.tier()),
            target_capacity: self.capacity,
            disease: DiseasePolicy::Treat,
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
            target_capacity: world.ops.staff_capacity,
            disease: DiseasePolicy::Treat,
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
            target_capacity: world.ops.staff_capacity,
            disease: DiseasePolicy::Ignore,
        }
    }
}
