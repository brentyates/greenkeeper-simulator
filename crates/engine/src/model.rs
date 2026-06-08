//! World state: plain data, grouped by concern. No behavior beyond simple
//! derived queries. Tuning lives in `Balance` (data), not in code.

use crate::rng::Rng;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum RegionKind {
    Green,
    Fairway,
    Tee,
    Rough,
}

impl RegionKind {
    /// Grass length gained per turn (higher = needs mowing sooner).
    pub fn growth_rate(self) -> f64 {
        match self {
            RegionKind::Green => 8.0,
            RegionKind::Tee => 6.0,
            RegionKind::Fairway => 5.0,
            RegionKind::Rough => 3.0,
        }
    }

    /// Moisture lost per turn before weather.
    pub fn moisture_decay(self) -> f64 {
        match self {
            RegionKind::Green => 12.0,
            RegionKind::Tee => 10.0,
            RegionKind::Fairway => 9.0,
            RegionKind::Rough => 7.0,
        }
    }

    /// How fast golfer traffic wears this kind (greens/tees take the brunt).
    pub fn wear_rate(self) -> f64 {
        match self {
            RegionKind::Green => 1.4,
            RegionKind::Tee => 1.2,
            RegionKind::Fairway => 1.0,
            RegionKind::Rough => 0.6,
        }
    }

    pub fn label(self) -> &'static str {
        match self {
            RegionKind::Green => "green",
            RegionKind::Fairway => "fairway",
            RegionKind::Tee => "tee",
            RegionKind::Rough => "rough",
        }
    }
}

/// Whether to treat active turf disease this turn.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum DiseasePolicy {
    Treat,
    Ignore,
}

/// A maintainable feature of the course. State is aggregate, not per-point.
#[derive(Clone, Debug, PartialEq)]
pub struct Region {
    pub id: u32,
    pub kind: RegionKind,
    pub moisture: f64,  // 0..100, ideal ~60
    pub nutrients: f64, // 0..100, higher is better
    pub growth: f64,    // 0..100, lower (freshly mown) is better
    pub wear: f64,      // 0..100, foot/cart traffic damage, higher is worse
    pub infection: f64, // 0..100, active turf disease severity (0 = healthy)
}

impl Region {
    /// Condition of this region, 0..100, derived from its agronomic state.
    pub fn health(&self) -> f64 {
        let moisture_score = (100.0 - (self.moisture - 60.0).abs() * 1.4).clamp(0.0, 100.0);
        let growth_score = (100.0 - self.growth).clamp(0.0, 100.0);
        let nutrient_score = self.nutrients.clamp(0.0, 100.0);
        // Turf fails fast once badly worn: wear compounds steeply past a threshold.
        let wear_penalty = self.wear + (self.wear - 40.0).max(0.0) * 2.0;
        let wear_score = (100.0 - wear_penalty).clamp(0.0, 100.0);
        let base =
            0.25 * moisture_score + 0.20 * growth_score + 0.20 * nutrient_score + 0.35 * wear_score;
        // Active disease drags condition down hard — a crisis you must respond to.
        (base - self.infection * 0.7).clamp(0.0, 100.0)
    }
}

/// A slice of the golfer market: how many consider visiting, what they'll pay,
/// and how much they spend beyond the green fee. Demand emerges from the mix.
#[derive(Clone, Debug, PartialEq)]
pub struct Segment {
    pub name: String,
    pub premium: bool,         // high-end clientele — drives exclusivity
    pub population: f64,       // potential visitors per turn at full appeal
    pub base_wtp: f64,         // willingness to pay at neutral appeal
    pub wtp_spread: f64,       // price range over which participation falls to zero
    pub spend_propensity: f64, // secondary $ per round at full amenities
}

/// The default market: bargain-hunters through affluent members.
pub fn default_segments() -> Vec<Segment> {
    let s = |name: &str, premium, population, base_wtp, wtp_spread, spend_propensity| Segment {
        name: name.to_string(),
        premium,
        population,
        base_wtp,
        wtp_spread,
        spend_propensity,
    };
    vec![
        s("bargain", false, 30.0, 25.0, 15.0, 4.0),
        s("regular", false, 20.0, 45.0, 20.0, 8.0),
        s("avid", false, 10.0, 80.0, 30.0, 14.0),
        s("affluent", true, 5.0, 140.0, 50.0, 25.0),
    ]
}

// ===========================================================================
// Balance — all tuning as data, so scenarios can vary it and the sweep can tune
// it without recompiling. `Default` is the current baseline.
// ===========================================================================

#[derive(Clone, Debug, PartialEq)]
pub struct EconomyBalance {
    pub service_cost: f64,             // capacity to fully service one region
    pub nutrient_decay: f64,           // per turn
    pub wear_per_golfer: f64,          // wear points added per golfer, spread by traffic
    pub wage_per_capacity: f64,        // wage cost per unit of staff capacity
    pub fixed_overhead: f64,           // per-turn fixed cost
    pub variable_cost_per_golfer: f64, // upkeep/supplies per round — caps volume profit
    pub bankruptcy_floor: f64,         // cash below this ends the run
}

impl Default for EconomyBalance {
    fn default() -> Self {
        EconomyBalance {
            service_cost: 10.0,
            nutrient_decay: 2.0,
            wear_per_golfer: 2.5,
            wage_per_capacity: 6.0,
            fixed_overhead: 400.0,
            variable_cost_per_golfer: 15.0,
            bankruptcy_floor: -1000.0,
        }
    }
}

#[derive(Clone, Debug, PartialEq)]
pub struct PrestigeBalance {
    pub max_up: f64,   // years to build...
    pub max_down: f64, // ...moments to destroy
    pub w_conditions: f64,
    pub w_historical: f64,
    pub w_amenities: f64,
    pub w_reputation: f64,
    pub w_exclusivity: f64,
    pub comfortable_golfers: f64, // beyond this, crowding hurts satisfaction
}

impl Default for PrestigeBalance {
    fn default() -> Self {
        PrestigeBalance {
            max_up: 5.0,
            max_down: 15.0,
            w_conditions: 0.25,
            w_historical: 0.25,
            w_amenities: 0.20,
            w_reputation: 0.20,
            w_exclusivity: 0.10,
            comfortable_golfers: 30.0,
        }
    }
}

#[derive(Clone, Debug, PartialEq)]
pub struct DiseaseBalance {
    pub outbreak_rate: f64, // scales susceptibility into a per-turn outbreak chance
    pub outbreak_severity: f64,
    pub infection_growth: f64, // per-turn worsening of an active infection
    pub spread_chance: f64,    // chance each infected region seeds another per turn
    pub spread_severity: f64,
    pub treat_power: f64,  // infection cleared per region at full effectiveness
    pub treat_cost: f64,   // $ per region treated
    pub resist_gain: f64,  // resistance gained per turn of treatment use (overuse cost)
    pub resist_decay: f64, // resistance lost per idle turn
    pub resist_max: f64,
}

impl Default for DiseaseBalance {
    fn default() -> Self {
        DiseaseBalance {
            outbreak_rate: 0.18,
            outbreak_severity: 30.0,
            infection_growth: 14.0,
            spread_chance: 0.22,
            spread_severity: 20.0,
            treat_power: 45.0,
            treat_cost: 140.0,
            resist_gain: 0.06,
            resist_decay: 0.02,
            resist_max: 0.85,
        }
    }
}

#[derive(Clone, Debug, Default, PartialEq)]
pub struct Balance {
    pub economy: EconomyBalance,
    pub prestige: PrestigeBalance,
    pub disease: DiseaseBalance,
}

// ===========================================================================
// World state, grouped by concern.
// ===========================================================================

/// The course itself: its maintainable regions and its golfer market.
#[derive(Clone, Debug)]
pub struct Course {
    pub regions: Vec<Region>,
    pub segments: Vec<Segment>,
}

impl Course {
    /// Average region condition, 0..100.
    pub fn avg_health(&self) -> f64 {
        if self.regions.is_empty() {
            return 0.0;
        }
        self.regions.iter().map(|r| r.health()).sum::<f64>() / self.regions.len() as f64
    }

    /// Average wear across regions, 0..100.
    pub fn avg_wear(&self) -> f64 {
        if self.regions.is_empty() {
            return 0.0;
        }
        self.regions.iter().map(|r| r.wear).sum::<f64>() / self.regions.len() as f64
    }
}

/// Money: cash on hand, the current green fee, and whether the run has ended.
#[derive(Clone, Debug)]
pub struct Finances {
    pub cash: f64,
    pub price: f64,
    pub bankrupt: bool,
}

/// Operating capacity the player commits: crew and amenity investment.
#[derive(Clone, Debug)]
pub struct Operations {
    pub staff_capacity: f64, // maintenance points available per turn
    pub amenity_level: f64,  // multiplier on secondary spend (capex unlocks this)
}

/// Prestige and its slow-moving inputs (0..100 each), the holistic reputation
/// that sets pricing power.
#[derive(Clone, Debug)]
pub struct Standing {
    pub prestige: f64,              // 0..1000 (200 per ★)
    pub historical_excellence: f64, // smoothed track record of conditions
    pub reputation: f64,            // smoothed golfer satisfaction (word of mouth)
    pub exclusivity: f64,           // how high-end the clientele/pricing is
}

impl Standing {
    /// Prestige tier as a 0-based index (0 = ★1 … 4 = ★5).
    pub fn tier(&self) -> u32 {
        ((self.prestige / 200.0).floor() as u32).min(4)
    }
}

#[derive(Clone, Debug)]
pub struct World {
    pub turn: u32,
    pub course: Course,
    pub finances: Finances,
    pub ops: Operations,
    pub standing: Standing,
    pub treatment_resistance: f64, // 0..resist_max, builds with treatment overuse
    pub rng: Rng,
    pub balance: Balance,
}

impl World {
    /// A small starter course used for the first slice and tests.
    pub fn demo(seed: u64) -> World {
        use RegionKind::*;
        let kinds = [
            Green, Green, Green, Fairway, Fairway, Fairway, Tee, Rough, Rough,
        ];
        let regions = kinds
            .iter()
            .enumerate()
            .map(|(i, &kind)| Region {
                id: i as u32,
                kind,
                moisture: 65.0,
                nutrients: 75.0,
                growth: 10.0,
                wear: 0.0,
                infection: 0.0,
            })
            .collect();
        World {
            turn: 0,
            course: Course {
                regions,
                segments: default_segments(),
            },
            finances: Finances {
                cash: 2000.0,
                price: 35.0,
                bankrupt: false,
            },
            ops: Operations {
                staff_capacity: 20.0,
                amenity_level: 1.0,
            },
            standing: Standing {
                prestige: 200.0,
                historical_excellence: 60.0,
                reputation: 55.0,
                exclusivity: 20.0,
            },
            treatment_resistance: 0.0,
            rng: Rng::new(seed),
            balance: Balance::default(),
        }
    }
}
