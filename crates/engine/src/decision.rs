//! Decisions are what the player (or an automated strategy) commits each turn.

use crate::model::World;
use crate::systems::sweet_spot;

#[derive(Clone, Debug)]
pub struct Decisions {
    pub price: f64,
    /// Whether to treat active turf disease this turn (costs money; overuse breeds
    /// resistance). Letting it go lets outbreaks worsen and spread.
    pub treat: bool,
}

/// A decision policy that can drive a run without a human — for testing and for
/// balance sweeps. Real play will replace this with player input on top.
pub trait Strategy {
    fn decide(&mut self, world: &World) -> Decisions;
}

/// Holds a flat green fee and treats outbreaks. The workhorse for sweeping price.
pub struct FixedPricing {
    pub price: f64,
}

impl Strategy for FixedPricing {
    fn decide(&mut self, _world: &World) -> Decisions {
        Decisions { price: self.price, treat: true }
    }
}

/// Like `FixedPricing` but never treats disease — to measure the cost of neglect.
pub struct NeglectfulPricing {
    pub price: f64,
}

impl Strategy for NeglectfulPricing {
    fn decide(&mut self, _world: &World) -> Decisions {
        Decisions { price: self.price, treat: false }
    }
}

/// Prices at the sweet spot for the current prestige tier.
pub struct SweetSpotPricing;

impl Strategy for SweetSpotPricing {
    fn decide(&mut self, world: &World) -> Decisions {
        Decisions { price: sweet_spot(world.tier()), treat: true }
    }
}

/// Prices above the tier's sweet spot, gambling margin against lost golfers.
pub struct GreedyPricing {
    pub multiplier: f64,
}

impl Strategy for GreedyPricing {
    fn decide(&mut self, world: &World) -> Decisions {
        Decisions { price: sweet_spot(world.tier()) * self.multiplier, treat: true }
    }
}
