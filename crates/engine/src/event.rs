//! The trace: a structured, ordered log of what happened in a run. The engine
//! never prints — it only produces these. Readers (CLI, tests, analysis) decide
//! how to render or aggregate them.

#[derive(Clone, Debug, PartialEq)]
pub enum Event {
    TurnStarted { turn: u32 },
    Weather { dryness: f64 },
    Maintenance { regions_serviced: u32, capacity_used: f64 },
    Conditions { avg_health: f64 },
    Prestige { value: f64, delta: f64 },
    Demand { potential: u32, golfers: u32, turned_away: u32, price: f64 },
    Revenue { amount: f64 },
    Cash { value: f64, delta: f64 },
    Bankrupt { turn: u32 },
}

pub type Trace = Vec<Event>;
