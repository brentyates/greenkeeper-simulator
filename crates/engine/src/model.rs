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
}

impl Region {
    /// Condition of this region, 0..100, derived from its agronomic state.
    pub fn health(&self) -> f64 {
        let moisture_score = (100.0 - (self.moisture - 60.0).abs() * 1.4).clamp(0.0, 100.0);
        let growth_score = (100.0 - self.growth).clamp(0.0, 100.0);
        let nutrient_score = self.nutrients.clamp(0.0, 100.0);
        (0.40 * moisture_score + 0.35 * growth_score + 0.25 * nutrient_score).clamp(0.0, 100.0)
    }
}

#[derive(Clone, Debug)]
pub struct World {
    pub turn: u32,
    pub cash: f64,
    pub prestige: f64, // 0..1000 (200 per ★)
    pub price: f64,    // current green fee
    pub regions: Vec<Region>,
    pub staff_capacity: f64, // maintenance points available per turn
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

    /// Prestige tier as a 0-based index (0 = ★1 … 4 = ★5).
    pub fn tier(&self) -> u32 {
        ((self.prestige / 200.0).floor() as u32).min(4)
    }

    /// A small starter course used for the first slice and tests.
    pub fn demo(seed: u64) -> World {
        use RegionKind::*;
        let kinds = [Green, Green, Green, Fairway, Fairway, Fairway, Tee, Rough, Rough];
        let regions = kinds
            .iter()
            .enumerate()
            .map(|(i, &kind)| Region {
                id: i as u32,
                kind,
                moisture: 65.0,
                nutrients: 75.0,
                growth: 10.0,
            })
            .collect();
        World {
            turn: 0,
            cash: 2000.0,
            prestige: 200.0,
            price: 35.0,
            regions,
            staff_capacity: 40.0,
            bankrupt: false,
            rng: Rng::new(seed),
        }
    }
}
