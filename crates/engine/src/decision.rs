//! Decisions are what the player (or an automated strategy) commits each turn.
//! For the first slice the only lever is price; more will join it as systems grow.

use crate::model::World;
use crate::systems::sweet_spot;

#[derive(Clone, Debug)]
pub struct Decisions {
    pub price: f64,
}

/// A decision policy that can drive a run without a human — for testing and for
/// balance sweeps. Real play will replace this with player input on top.
pub trait Strategy {
    fn decide(&mut self, world: &World) -> Decisions;
}

/// Prices at the sweet spot for the current prestige tier: maximum demand.
pub struct SweetSpotPricing;

impl Strategy for SweetSpotPricing {
    fn decide(&mut self, world: &World) -> Decisions {
        Decisions { price: sweet_spot(world.tier()) }
    }
}

/// Prices above the sweet spot, gambling higher margin against lost golfers.
pub struct GreedyPricing {
    pub multiplier: f64,
}

impl Strategy for GreedyPricing {
    fn decide(&mut self, world: &World) -> Decisions {
        Decisions { price: sweet_spot(world.tier()) * self.multiplier }
    }
}
