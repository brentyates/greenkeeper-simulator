//! Decisions are what the player (or an automated strategy) commits each turn:
//! the levers that let you commit to and execute a strategy (a "path").

use crate::model::{DiseasePolicy, TournamentPhase, World};

#[derive(Clone, Debug)]
pub struct Decisions {
    pub price: f64,
    /// Crew capacity to run this turn — more staff maintains more ground and
    /// fights disease, but costs wages.
    pub target_capacity: f64,
    pub disease: DiseasePolicy,
    /// Commit to hosting a tournament of this tier index, if eligible and none is
    /// already booked. `None` means don't commit this turn.
    pub accept_tournament: Option<usize>,
    /// Capacity to divert to tournament prep this turn — stolen from maintenance
    /// unless you've staffed up for it.
    pub prep_effort: f64,
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
/// Expresses a *path* (budget / value / premium, well- or ill-run). Hosts no
/// tournaments.
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
            accept_tournament: None,
            prep_effort: 0.0,
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
            accept_tournament: None,
            prep_effort: 0.0,
        }
    }
}

/// Chases tournaments: books the biggest tier it's eligible for and can afford,
/// then during prep it paces the whole checklist (mandatory + optional) and
/// **staffs up to cover it**, so conditions don't slip. The path to heaps.
pub struct TournamentStrategy {
    pub capacity: f64,
}

impl Strategy for TournamentStrategy {
    fn decide(&mut self, world: &World) -> Decisions {
        let price = sweet_spot(world.standing.tier());
        match &world.tournament {
            // Prep window: pace remaining effort and staff up to cover it.
            Some(ts) => {
                let prep_effort = match &ts.phase {
                    TournamentPhase::Scheduled {
                        turns_until, tasks, ..
                    } => {
                        let remaining: f64 = tasks.iter().map(|t| t.effort).sum();
                        remaining / (*turns_until).max(1) as f64
                    }
                    TournamentPhase::Running { .. } => 0.0,
                };
                Decisions {
                    price,
                    target_capacity: self.capacity + prep_effort,
                    disease: DiseasePolicy::Treat,
                    accept_tournament: None,
                    prep_effort,
                }
            }
            // Idle: book the biggest eligible, affordable tier (tiers ascending).
            None => {
                let accept = world
                    .balance
                    .tournament
                    .tiers
                    .iter()
                    .enumerate()
                    .filter(|(_, t)| {
                        world.standing.prestige >= t.prestige_required
                            && world.finances.cash >= t.entry_cost
                    })
                    .map(|(i, _)| i)
                    .next_back();
                Decisions {
                    price,
                    target_capacity: self.capacity,
                    disease: DiseasePolicy::Treat,
                    accept_tournament: accept,
                    prep_effort: 0.0,
                }
            }
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
            accept_tournament: None,
            prep_effort: 0.0,
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
            accept_tournament: None,
            prep_effort: 0.0,
        }
    }
}
