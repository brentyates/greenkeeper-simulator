//! Decisions are what the player (or an automated strategy) commits each turn:
//! the levers that let you commit to and execute a strategy (a "path").

use crate::model::{TournamentPhase, World};

#[derive(Clone, Debug)]
pub struct Decisions {
    pub price: f64,
    /// Crew capacity to run this turn — more staff maintains more ground (mowing,
    /// watering, feeding), but costs wages.
    pub target_capacity: f64,
    /// Commit to hosting a tournament of this tier index, if eligible and none is
    /// already booked. `None` means don't commit this turn.
    pub accept_tournament: Option<usize>,
    /// Capacity to divert to tournament prep this turn — stolen from maintenance
    /// unless you've staffed up for it.
    pub prep_effort: f64,
    /// Cash to spend on research this turn (accrues points toward the next tech).
    pub research_funding: f64,
    /// Install the course-wide irrigation system this turn (capital). No effect if
    /// already installed or unaffordable.
    pub buy_irrigation: bool,
    /// Buy this many robot units this turn (capital), affordability permitting.
    pub buy_robots: u32,
}

impl Decisions {
    /// A do-nothing-but-price baseline, for strategies that only set a few levers.
    fn priced(price: f64, target_capacity: f64) -> Self {
        Decisions {
            price,
            target_capacity,
            accept_tournament: None,
            prep_effort: 0.0,
            research_funding: 0.0,
            buy_irrigation: false,
            buy_robots: 0,
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

/// A full operating plan: a price point and a staffing level. Expresses a *path*
/// (budget / value / premium, well- or ill-staffed). Hosts no tournaments, funds
/// no research.
pub struct PlanStrategy {
    pub price: f64,
    pub capacity: f64,
}

impl Strategy for PlanStrategy {
    fn decide(&mut self, _world: &World) -> Decisions {
        Decisions::priced(self.price, self.capacity)
    }
}

/// Earns its way up: prices at the sweet spot for the *current* prestige tier.
pub struct RampStrategy {
    pub capacity: f64,
}

impl Strategy for RampStrategy {
    fn decide(&mut self, world: &World) -> Decisions {
        Decisions::priced(sweet_spot(world.standing.tier()), self.capacity)
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

/// The do-it-all policy for scenario play: ramp pricing, staff to size, fund
/// research, and (optionally) chase tournaments with paced prep.
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
            accept_tournament: accept,
            prep_effort,
            research_funding: self.research_funding,
            buy_irrigation: false,
            buy_robots: 0,
        }
    }
}

/// Trades labor for capital: ramp pricing, installing the irrigation system and
/// buying robot units (one at a time, as cash allows) up to a target fleet. Crew
/// size *tracks what's still done by hand* — a full crew while saving up, shedding
/// wages as each automation comes online, staffing back up when robots are down
/// for repair. The automation path: a capital bet that pays off by shedding labor,
/// most at scale.
pub struct InvestStrategy {
    /// The hands-on crew you'd run with no automation; automation scales it down.
    pub base_capacity: f64,
    pub irrigation: bool,
    pub robot_target: u32,
}

impl Strategy for InvestStrategy {
    fn decide(&mut self, world: &World) -> Decisions {
        let a = &world.balance.automation;
        let agro = &world.balance.agronomy;
        let buy_irrigation = self.irrigation && !world.irrigation;
        // One unit at a time, keeping a cash cushion so a purchase never bankrupts,
        // and not in the same turn we're paying for the irrigation install.
        let want_more = (world.robots.len() as u32) < self.robot_target;
        let buy_robots =
            if want_more && !buy_irrigation && world.finances.cash >= a.robot_price * 2.0 {
                1
            } else {
                0
            };

        // Size the crew to the maintenance still done by hand. Irrigation removes
        // watering from every region the crew touches (a proportional saving);
        // each operational robot offloads a fixed slab of mowing+fertilizing
        // (its throughput), so the crew staffs back up when units are down.
        let full = agro.mow_cost + agro.water_cost + agro.fertilize_cost;
        let working = world.robots.iter().filter(|&&d| d == 0).count() as f64;
        let mut target_capacity = self.base_capacity;
        if world.irrigation {
            target_capacity *= (full - agro.water_cost) / full;
        }
        target_capacity -= working * a.robot_throughput * (agro.mow_cost + agro.fertilize_cost);
        // Keep a skeleton crew on hand to patch the ground robots can't reach and
        // to cover breakdown slack — never fully hollow out the payroll.
        let floor = if self.robot_target > 0 || self.irrigation {
            self.base_capacity * 0.15
        } else {
            0.0
        };
        let target_capacity = target_capacity.max(floor);

        Decisions {
            price: sweet_spot(world.standing.tier()),
            target_capacity,
            accept_tournament: None,
            prep_effort: 0.0,
            research_funding: 0.0,
            buy_irrigation,
            buy_robots,
        }
    }
}

/// Holds a flat green fee and keeps staffing unchanged.
pub struct FixedPricing {
    pub price: f64,
}

impl Strategy for FixedPricing {
    fn decide(&mut self, world: &World) -> Decisions {
        Decisions::priced(self.price, world.ops.staff_capacity)
    }
}
