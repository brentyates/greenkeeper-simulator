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

#[derive(Clone, Debug, PartialEq, serde::Serialize, serde::Deserialize)]
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

#[derive(Clone, Debug, PartialEq, serde::Serialize, serde::Deserialize)]
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

#[derive(Clone, Debug, PartialEq, serde::Serialize, serde::Deserialize)]
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

/// A single prep job before a tournament. Mandatory ones build *readiness*;
/// the one optional one grants a bonus if you can also fit it in.
#[derive(Clone, Debug, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct PrepTask {
    pub name: String,
    pub effort: f64, // capacity-turns to complete (used as remaining once committed)
    pub optional: bool,
}

/// One tier of tournament. Bigger tiers gate behind prestige (hard) and pay far
/// more — the staircase to "heaps". Tuning, so it lives in `Balance`.
#[derive(Clone, Debug, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct TournamentTier {
    pub name: String,
    pub prestige_required: f64, // hard eligibility gate
    pub prep_turns: u32,        // lead time after committing
    pub prep_task_count: u32,   // how many mandatory prep tasks are drawn
    pub optional_bonus: f64,    // payout multiplier added if the optional task is done
    pub duration: u32,          // event length in turns
    pub entry_cost: f64,
    pub payout: f64,         // at top grade
    pub attention: f64,      // demand surge during the event (>1) — the spotlight
    pub prestige_swing: f64, // max +/- prestige at resolution (amplified spotlight)
    pub residual: f64,       // lasting demand modifier (+ on success, - on failure)
    pub fail_floor: f64,     // avg event condition at/below which grade = 0
    pub target: f64,         // avg event condition at/above which grade = 1
}

#[derive(Clone, Debug, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct TournamentBalance {
    pub tiers: Vec<TournamentTier>,
    pub prep_tasks: Vec<PrepTask>,     // mandatory pool
    pub optional_tasks: Vec<PrepTask>, // optional (boost) pool
}

impl Default for TournamentBalance {
    fn default() -> Self {
        #[allow(clippy::too_many_arguments)]
        let t = |name: &str,
                 prestige_required,
                 prep_turns,
                 prep_task_count,
                 optional_bonus,
                 duration,
                 entry_cost,
                 payout,
                 attention,
                 prestige_swing,
                 residual,
                 fail_floor,
                 target| TournamentTier {
            name: name.to_string(),
            prestige_required,
            prep_turns,
            prep_task_count,
            optional_bonus,
            duration,
            entry_cost,
            payout,
            attention,
            prestige_swing,
            residual,
            fail_floor,
            target,
        };
        let task = |name: &str, effort, optional| PrepTask {
            name: name.to_string(),
            effort,
            optional,
        };
        TournamentBalance {
            tiers: vec![
                t(
                    "Local", 0.0, 3, 2, 0.15, 2, 200.0, 2_000.0, 1.3, 30.0, 0.10, 50.0, 80.0,
                ),
                t(
                    "Regional", 400.0, 4, 3, 0.20, 3, 1_000.0, 12_000.0, 1.6, 50.0, 0.15, 60.0,
                    85.0,
                ),
                t(
                    "State", 600.0, 5, 3, 0.25, 3, 4_000.0, 50_000.0, 2.0, 80.0, 0.20, 65.0, 88.0,
                ),
                t(
                    "National", 800.0, 6, 4, 0.30, 4, 15_000.0, 200_000.0, 2.5, 120.0, 0.25, 70.0,
                    90.0,
                ),
                t(
                    "Major", 900.0, 8, 5, 0.35, 4, 50_000.0, 800_000.0, 3.0, 200.0, 0.30, 75.0,
                    92.0,
                ),
            ],
            prep_tasks: vec![
                task("install grandstands", 18.0, false),
                task("put up sponsor signage", 10.0, false),
                task("grow out the rough", 14.0, false),
                task("double-cut & roll the greens", 16.0, false),
                task("narrow the fairways", 12.0, false),
                task("firm up the bunkers", 11.0, false),
                task("set championship pins", 9.0, false),
                task("lay spectator pathways", 13.0, false),
            ],
            optional_tasks: vec![
                task("premium hospitality village", 20.0, true),
                task("broadcast & media compound", 22.0, true),
                task("host a pro-am charity day", 16.0, true),
            ],
        }
    }
}

#[derive(Clone, Debug, Default, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct Balance {
    pub economy: EconomyBalance,
    pub prestige: PrestigeBalance,
    pub disease: DiseaseBalance,
    pub tournament: TournamentBalance,
}

/// A committed tournament's lifecycle: a prep window working a checklist, then the
/// event itself (accumulating conditions to grade at the end).
#[derive(Clone, Debug, PartialEq)]
pub enum TournamentPhase {
    /// Prep: `tasks` (effort = remaining) are worked down with diverted capacity.
    /// `mandatory_total` is the original mandatory effort, for the readiness ratio.
    Scheduled {
        turns_until: u32,
        tasks: Vec<PrepTask>,
        mandatory_total: f64,
    },
    /// The event: `readiness` (0..1, locked at start) scales the grade;
    /// `optional_done` grants the tier's bonus.
    Running {
        day: u32,
        condition_sum: f64,
        readiness: f64,
        optional_done: bool,
    },
}

#[derive(Clone, Debug, PartialEq)]
pub struct TournamentState {
    pub tier: usize,
    pub phase: TournamentPhase,
}

// ===========================================================================
// Scenarios — a run's objective and how it can be won or lost.
// ===========================================================================

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum LossReason {
    Bankruptcy,
    Deadline,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Default)]
pub enum Outcome {
    #[default]
    Running,
    Won,
    Lost(LossReason),
}

impl Outcome {
    pub fn is_running(self) -> bool {
        matches!(self, Outcome::Running)
    }
}

/// The style of a course, which sets how much *maintained* land sits beyond the
/// playing corridors — a big driver of upkeep for the same amount of play.
#[derive(Clone, Copy, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub enum CourseType {
    Desert,    // natural waste beyond the holes — least to maintain
    Heathland, // a standard amount of rough
    Parkland,  // acres of manicured rough — most to maintain
}

/// The shape of a course: hole count, par-3 vs full, and style. More holes scale
/// *play* (golfer throughput); fuller holes and parkland style scale *upkeep*.
#[derive(Clone, Debug, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct CourseSpec {
    pub holes: u32,
    pub par3: bool,
    pub course_type: CourseType,
}

impl CourseSpec {
    /// Build this course's regions. Par-3 holes are green + tee; full holes add a
    /// fairway plus rough that varies by style (desert none, heathland one,
    /// parkland two) — so style changes upkeep without changing play.
    pub fn build_regions(&self) -> Vec<Region> {
        use RegionKind::*;
        let mut per_hole: Vec<RegionKind> = if self.par3 {
            vec![Green, Tee]
        } else {
            vec![Green, Tee, Fairway]
        };
        if !self.par3 {
            match self.course_type {
                CourseType::Desert => {}
                CourseType::Heathland => per_hole.push(Rough),
                CourseType::Parkland => {
                    per_hole.push(Rough);
                    per_hole.push(Rough);
                }
            }
        }
        let mut regions = Vec::new();
        let mut id = 0u32;
        for _ in 0..self.holes {
            for &kind in &per_hole {
                regions.push(Region {
                    id,
                    kind,
                    moisture: 65.0,
                    nutrients: 75.0,
                    growth: 10.0,
                    wear: 0.0,
                    infection: 0.0,
                });
                id += 1;
            }
        }
        regions
    }
}

/// What a scenario asks of you. Each carries its own deadline (except `Survive`,
/// which is won by reaching the turn alive).
#[derive(Clone, Debug, PartialEq, serde::Serialize, serde::Deserialize)]
pub enum Objective {
    CashBy { amount: f64, by_turn: u32 },
    PrestigeBy { prestige: f64, by_turn: u32 },
    RestoreBy { health: f64, by_turn: u32 },
    HostBy { min_tier: usize, by_turn: u32 },
    Survive { turns: u32 },
}

/// A self-contained challenge: a course, an objective, and how run-down it starts.
#[derive(Clone, Debug, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct Scenario {
    pub name: String,
    pub course: CourseSpec,
    pub objective: Objective,
    pub start_neglect: f64, // 0..1, how run-down the course begins (for restorations)
}

/// The starter campaign — varied sizes/styles, one scenario per objective type.
pub fn campaign() -> Vec<Scenario> {
    let s = |name: &str, holes, par3, course_type, objective, start_neglect| Scenario {
        name: name.to_string(),
        course: CourseSpec {
            holes,
            par3,
            course_type,
        },
        objective,
        start_neglect,
    };
    use CourseType::{Desert, Heathland, Parkland};
    vec![
        s(
            "Par-3 Starter",
            9,
            true,
            Desert,
            Objective::CashBy {
                amount: 12_000.0,
                by_turn: 60,
            },
            0.0,
        ),
        s(
            "Build a Reputation",
            9,
            false,
            Heathland,
            Objective::PrestigeBy {
                prestige: 700.0,
                by_turn: 90,
            },
            0.0,
        ),
        s(
            "Restore the Parkland",
            9,
            false,
            Parkland,
            Objective::RestoreBy {
                health: 85.0,
                by_turn: 60,
            },
            0.8,
        ),
        s(
            "Host a Championship",
            18,
            false,
            Heathland,
            Objective::HostBy {
                min_tier: 2,
                by_turn: 200,
            },
            0.0,
        ),
        s(
            "Grand Resort Survival",
            27,
            false,
            Heathland,
            Objective::Survive { turns: 80 },
            0.3,
        ),
    ]
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
    pub tournament: Option<TournamentState>,
    pub demand_modifier: f64, // residual demand swing from tournaments; decays to 0
    pub demand_scale: f64,    // golfer throughput vs the 9-region baseline (course size)
    pub best_hosted_tier: Option<usize>, // highest tier successfully hosted (grade ≥ 0.5)
    pub scenario: Option<Scenario>,
    pub outcome: Outcome,
    pub rng: Rng,
    pub balance: Balance,
}

impl World {
    /// Override the tuning. This is the seam for per-scenario configs and for
    /// automated/ML balance search, which mutates `Balance` and re-measures in a
    /// loop — only possible because tuning is data, not compiled-in constants.
    pub fn with_balance(mut self, balance: Balance) -> Self {
        self.balance = balance;
        self
    }

    /// Set up a scenario run: build its course (replacing the sandbox course),
    /// degrade it by `start_neglect`, and attach the objective to win or lose.
    pub fn with_scenario(mut self, scenario: Scenario) -> Self {
        let mut regions = scenario.course.build_regions();
        let n = scenario.start_neglect.clamp(0.0, 1.0);
        if n > 0.0 {
            for r in regions.iter_mut() {
                r.wear = (r.wear + n * 60.0).clamp(0.0, 100.0);
                r.growth = (r.growth + n * 50.0).clamp(0.0, 100.0);
                r.moisture = (r.moisture - n * 40.0).clamp(0.0, 100.0);
                r.nutrients = (r.nutrients - n * 40.0).clamp(0.0, 100.0);
            }
        }
        // Demand scales with *play* (holes), not upkeep — so a parkland course is
        // more crew for the same golfers as a desert one of equal hole count. The
        // ×4/9 baseline keeps a standard ~4-region/hole course balanced like the
        // 9-region sandbox.
        self.demand_scale = (scenario.course.holes as f64 * 4.0 / 9.0).max(0.1);
        self.course.regions = regions;
        self.scenario = Some(scenario);
        self
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
            tournament: None,
            demand_modifier: 0.0,
            demand_scale: 1.0,
            best_hosted_tier: None,
            scenario: None,
            outcome: Outcome::Running,
            rng: Rng::new(seed),
            balance: Balance::default(),
        }
    }
}
