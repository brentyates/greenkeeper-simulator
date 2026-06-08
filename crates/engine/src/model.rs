//! World state: plain data, no behavior beyond simple derived queries.

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
    pub name: &'static str,
    pub population: f64,       // potential visitors per turn at full appeal
    pub base_wtp: f64,         // willingness to pay at neutral appeal
    pub wtp_spread: f64,       // price range over which participation falls to zero
    pub spend_propensity: f64, // secondary $ per round at full amenities
}

/// The default market: bargain-hunters through affluent members.
pub fn default_segments() -> Vec<Segment> {
    vec![
        Segment {
            name: "bargain",
            population: 30.0,
            base_wtp: 25.0,
            wtp_spread: 15.0,
            spend_propensity: 4.0,
        },
        Segment {
            name: "regular",
            population: 20.0,
            base_wtp: 45.0,
            wtp_spread: 20.0,
            spend_propensity: 8.0,
        },
        Segment {
            name: "avid",
            population: 10.0,
            base_wtp: 80.0,
            wtp_spread: 30.0,
            spend_propensity: 14.0,
        },
        Segment {
            name: "affluent",
            population: 5.0,
            base_wtp: 140.0,
            wtp_spread: 50.0,
            spend_propensity: 25.0,
        },
    ]
}

#[derive(Clone, Debug)]
pub struct World {
    pub turn: u32,
    pub cash: f64,
    pub prestige: f64, // 0..1000 (200 per ★)
    pub price: f64,    // current green fee
    pub regions: Vec<Region>,
    pub staff_capacity: f64, // maintenance points available per turn
    pub amenity_level: f64,  // multiplier on secondary spend (capex unlocks this)
    pub segments: Vec<Segment>,
    pub treatment_resistance: f64, // 0..1, builds with treatment overuse, decays when idle
    // Prestige's slow-moving inputs (0..100 each), updated from play each turn:
    pub historical_excellence: f64, // smoothed track record of conditions
    pub reputation: f64,            // smoothed golfer satisfaction (word of mouth)
    pub exclusivity: f64,           // how high-end the clientele/pricing is
    pub bankrupt: bool,
    pub rng: Rng,
}

impl World {
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

    /// Prestige tier as a 0-based index (0 = ★1 … 4 = ★5).
    pub fn tier(&self) -> u32 {
        ((self.prestige / 200.0).floor() as u32).min(4)
    }

    /// How appealing the course is right now, 0..1 — drives both how many golfers
    /// consider visiting and how much they perceive a round to be worth.
    pub fn appeal(&self) -> f64 {
        (0.5 * (self.prestige / 1000.0) + 0.5 * (self.avg_health() / 100.0)).clamp(0.0, 1.0)
    }

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
            cash: 2000.0,
            prestige: 200.0,
            price: 35.0,
            regions,
            staff_capacity: 20.0,
            amenity_level: 1.0,
            segments: default_segments(),
            treatment_resistance: 0.0,
            historical_excellence: 60.0,
            reputation: 55.0,
            exclusivity: 20.0,
            bankrupt: false,
            rng: Rng::new(seed),
        }
    }
}
