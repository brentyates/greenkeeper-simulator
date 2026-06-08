//! The trace: a structured, ordered log of what happened in a run. The engine
//! never prints — it only produces these. Readers (CLI, tests, analysis) decide
//! how to render or aggregate them.

#[derive(Clone, Debug, PartialEq)]
pub enum Event {
    TurnStarted {
        turn: u32,
    },
    Weather {
        dryness: f64,
    },
    Maintenance {
        regions_serviced: u32,
        capacity_used: f64,
    },
    Conditions {
        avg_health: f64,
        avg_wear: f64,
    },
    Prestige {
        value: f64,
        delta: f64,
    },
    /// `interested` golfers considered a round; `golfers` actually played at
    /// `price`; the rest balked (`turned_away`).
    Demand {
        interested: u32,
        golfers: u32,
        turned_away: u32,
        price: f64,
    },
    GreenFees {
        amount: f64,
    },
    Secondary {
        amount: f64,
    },
    Outbreak {
        region: u32,
    },
    Spread {
        region: u32,
    },
    Treated {
        regions: u32,
        cost: f64,
    },
    TournamentScheduled {
        tier: String,
        starts_in: u32,
    },
    TournamentPrep {
        task: String,
        optional: bool,
    },
    TournamentStarted {
        tier: String,
        readiness: f64,
        optional_done: bool,
    },
    /// `grade` 0..1 = how well conditions held under the spotlight.
    TournamentResult {
        tier: String,
        grade: f64,
        payout: f64,
        prestige_delta: f64,
    },
    Cash {
        value: f64,
        delta: f64,
    },
    Bankrupt {
        turn: u32,
    },
}

pub type Trace = Vec<Event>;
