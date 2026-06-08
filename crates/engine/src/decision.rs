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
    /// Cash to spend on research this turn (accrues points toward the next tech).
    pub research_funding: f64,
}

impl Decisions {
    /// A do-nothing-but-price baseline, for strategies that only set a few levers.
    fn priced(price: f64, target_capacity: f64, disease: DiseasePolicy) -> Self {
        Decisions {
            price,
            target_capacity,
            disease,
            accept_tournament: None,
            prep_effort: 0.0,
            research_funding: 0.0,
        }
    }
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
/// tournaments, funds no research.
pub struct PlanStrategy {
    pub price: f64,
    pub capacity: f64,
    pub disease: DiseasePolicy,
}

impl Strategy for PlanStrategy {
    fn decide(&mut self, _world: &World) -> Decisions {
        Decisions::priced(self.price, self.capacity, self.disease)
    }
}

/// Earns its way up: prices at the sweet spot for the *current* prestige tier.
pub struct RampStrategy {
    pub capacity: f64,
}

impl Strategy for RampStrategy {
    fn decide(&mut self, world: &World) -> Decisions {
        Decisions::priced(
            sweet_spot(world.standing.tier()),
            self.capacity,
            DiseasePolicy::Treat,
        )
    }
}

/// Chases tournaments: books the biggest eligible tier, then paces the prep
/// checklist while staffing up to cover it. The path to heaps.
pub struct TournamentStrategy {
    pub capacity: f64,
}

impl Strategy for TournamentStrategy {
    fn decide(&mut self, world: &World) -> Decisions {
        ScenarioStrategy {
            capacity: self.capacity,
            research_funding: 0.0,
            host: true,
        }
        .decide(world)
    }
}

/// The do-it-all policy for scenario play: ramp pricing, staff to size, treat
/// disease, fund research, and (optionally) chase tournaments with paced prep.
pub struct ScenarioStrategy {
    pub capacity: f64,
    pub research_funding: f64,
    pub host: bool,
}

impl Strategy for ScenarioStrategy {
    fn decide(&mut self, world: &World) -> Decisions {
        let price = sweet_spot(world.standing.tier());
        let (target_capacity, prep_effort, accept) = if self.host {
            match world.tournament.as_ref().map(|t| &t.phase) {
                Some(TournamentPhase::Scheduled {
                    turns_until, tasks, ..
                }) => {
                    let remaining: f64 = tasks.iter().map(|t| t.effort).sum();
                    let pace = remaining / (*turns_until).max(1) as f64;
                    (self.capacity + pace, pace, None)
                }
                Some(TournamentPhase::Running { .. }) => (self.capacity, 0.0, None),
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
                    (self.capacity, 0.0, accept)
                }
            }
        } else {
            (self.capacity, 0.0, None)
        };
        Decisions {
            price,
            target_capacity,
            disease: DiseasePolicy::Treat,
            accept_tournament: accept,
            prep_effort,
            research_funding: self.research_funding,
        }
    }
}

/// Holds a flat green fee, keeps staffing unchanged, and treats outbreaks.
pub struct FixedPricing {
    pub price: f64,
}

impl Strategy for FixedPricing {
    fn decide(&mut self, world: &World) -> Decisions {
        Decisions::priced(self.price, world.ops.staff_capacity, DiseasePolicy::Treat)
    }
}

/// Like `FixedPricing` but never treats disease — to measure the cost of neglect.
pub struct NeglectfulPricing {
    pub price: f64,
}

impl Strategy for NeglectfulPricing {
    fn decide(&mut self, world: &World) -> Decisions {
        Decisions::priced(self.price, world.ops.staff_capacity, DiseasePolicy::Ignore)
    }
}
