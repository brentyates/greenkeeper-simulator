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
    /// Mechanics on staff this turn — they keep the robot fleet running (fewer
    /// breakdowns), for a wage.
    pub mechanics: u32,
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
            mechanics: 0,
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
            mechanics: 0,
        }
    }
}

/// Trades labor for capital: ramp pricing, installing the irrigation system and
/// buying robot units (one at a time, as cash allows). Crew size *tracks what's
/// still done by hand* — a full crew while saving up, shedding wages as each
/// automation comes online, staffing back up when robots are down for repair. The
/// fleet auto-sizes to exactly replace the hand crew, so robots are never idle
/// capital. The automation path: a capital bet that pays off by shedding wages.
pub struct InvestStrategy {
    /// The hands-on crew you'd run with no automation; automation scales it down.
    pub base_capacity: f64,
    pub irrigation: bool,
    /// Upper cap on fleet ambition. The strategy buys only as many robots as it
    /// takes to replace the hand crew (auto-sized), never more than this. Set high
    /// (e.g. `u32::MAX`) to mean "fully automate".
    pub robot_target: u32,
}

impl Strategy for InvestStrategy {
    fn decide(&mut self, world: &World) -> Decisions {
        let a = &world.balance.automation;
        let agro = &world.balance.agronomy;
        let mowfert = a.robot_throughput * (agro.mow_cost + agro.fertilize_cost);

        // Automation is research-gated, so fund research until the wanted unlocks
        // land (robots are the elite endgame — it takes a while). Then stop.
        let need_irrigation_unlock = self.irrigation && !world.irrigation_unlocked();
        let need_robots_unlock = self.robot_target > 0 && !world.robots_unlocked();
        let research_funding = if need_irrigation_unlock || need_robots_unlock {
            (world.finances.cash * 0.5).clamp(0.0, 250.0)
        } else {
            0.0
        };

        // Keep a skeleton crew on hand to patch breakdown slack — a couple of
        // units' worth of work — but don't carry dead payroll once robots cover
        // the course.
        let floor = if self.robot_target > 0 {
            2.0 * mowfert
        } else {
            0.0
        };

        // The hand crew, scaled down by irrigation (which takes watering off every
        // region the crew would touch). This is the labor robots are bought to
        // replace.
        let full = agro.mow_cost + agro.water_cost + agro.fertilize_cost;
        let mut hand_crew = self.base_capacity;
        if self.irrigation {
            hand_crew *= (full - agro.water_cost) / full;
        }
        // Auto-size the fleet: buy robots only until they've shouldered the whole
        // hand crew down to the floor — past that, a robot is idle capital. The
        // caller's `robot_target` is just an upper cap on the ambition.
        let need_to_replace = (hand_crew - floor).max(0.0);
        let fleet_cap = (need_to_replace / mowfert).ceil() as u32;
        let target_fleet = self.robot_target.min(fleet_cap);

        // Buy once unlocked: irrigation first, then robots one at a time, always
        // keeping a cash cushion so a purchase never bankrupts.
        let buy_irrigation =
            self.irrigation && world.irrigation_unlocked() && !world.irrigation;
        let want_more = (world.robots.len() as u32) < target_fleet;
        let buy_robots = if want_more
            && world.robots_unlocked()
            && !buy_irrigation
            && world.finances.cash >= a.robot_price * 2.0
        {
            1
        } else {
            0
        };

        // Size the crew to the maintenance still done by hand: each operational
        // robot offloads a fixed slab of mowing+fertilizing (its throughput), so
        // the crew staffs back up when units are down for repair.
        let working = world.robots.iter().filter(|&&d| d == 0).count() as f64;
        let target_capacity = (hand_crew - working * mowfert).max(floor);

        // One mechanic covers many robots, so the mechanic crew is small and cheap
        // insurance — they earn their wage by keeping the fleet out of the shop.
        let owned = world.robots.len() as u32;
        let mechanics = if owned > 0 {
            ((owned as f64 / a.robots_per_mechanic).ceil() as u32).max(1)
        } else {
            0
        };

        Decisions {
            price: sweet_spot(world.standing.tier()),
            target_capacity,
            accept_tournament: None,
            prep_effort: 0.0,
            research_funding,
            buy_irrigation,
            buy_robots,
            mechanics,
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
