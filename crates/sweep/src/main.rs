//! Balance-sweep harness.
//!
//! Runs a set of operating *paths* (price + staffing + disease policy) across many
//! seeds and aggregates the outcomes — so we can see whether multiple distinct
//! paths are viable, and which mistakes sink them.
//!
//! Usage: `sweep [seeds] [turns]`  (defaults: 150 seeds, 150 turns)

use engine::{
    run, Balance, DiseasePolicy, Event, PlanStrategy, RampStrategy, Strategy, TournamentStrategy,
    World,
};

/// Load tuning from TOML (`$GK_BALANCE`, default `config/balance.toml`); fall back
/// to defaults if absent or unparseable.
fn load_balance() -> Balance {
    let path = std::env::var("GK_BALANCE").unwrap_or_else(|_| "config/balance.toml".to_string());
    match std::fs::read_to_string(&path) {
        Ok(text) => toml::from_str(&text).unwrap_or_else(|e| {
            eprintln!("warning: could not parse {path}: {e}; using defaults");
            Balance::default()
        }),
        Err(_) => Balance::default(),
    }
}

type Factory = Box<dyn Fn() -> Box<dyn Strategy>>;

struct Path {
    name: &'static str,
    make: Factory,
}

fn plan(price: f64, capacity: f64, disease: DiseasePolicy) -> Factory {
    Box::new(move || {
        Box::new(PlanStrategy {
            price,
            capacity,
            disease,
        }) as Box<dyn Strategy>
    })
}

fn ramp(capacity: f64) -> Factory {
    Box::new(move || Box::new(RampStrategy { capacity }) as Box<dyn Strategy>)
}

fn host(capacity: f64) -> Factory {
    Box::new(move || Box::new(TournamentStrategy { capacity }) as Box<dyn Strategy>)
}

struct RunResult {
    final_cash: f64,
    final_prestige: f64,
    final_health: f64,
    bankrupt: bool,
    total_golfers: u64,
    total_outbreaks: u64,
    total_treatment: f64,
}

fn run_one(path: &Path, balance: &Balance, seed: u64, turns: u32) -> RunResult {
    let mut world = World::demo(seed).with_balance(balance.clone());
    let mut strategy = (path.make)();
    let trace = run(&mut world, strategy.as_mut(), turns);

    let mut total_golfers = 0u64;
    let mut total_outbreaks = 0u64;
    let mut total_treatment = 0.0;
    for event in &trace {
        match event {
            Event::Demand { golfers, .. } => total_golfers += *golfers as u64,
            Event::Outbreak { .. } => total_outbreaks += 1,
            Event::Treated { cost, .. } => total_treatment += cost,
            _ => {}
        }
    }

    RunResult {
        final_cash: world.finances.cash,
        final_prestige: world.standing.prestige,
        final_health: world.course.avg_health(&world.balance.conditions),
        bankrupt: world.finances.bankrupt,
        total_golfers,
        total_outbreaks,
        total_treatment,
    }
}

fn mean(xs: impl Iterator<Item = f64>) -> f64 {
    let (sum, n) = xs.fold((0.0, 0u64), |(s, n), x| (s + x, n + 1));
    if n == 0 {
        0.0
    } else {
        sum / n as f64
    }
}

fn main() {
    let nums: Vec<u64> = std::env::args()
        .skip(1)
        .filter_map(|a| a.parse().ok())
        .collect();
    let seeds = nums.first().copied().unwrap_or(150).max(1);
    let turns = nums.get(1).copied().unwrap_or(150) as u32;
    let balance = load_balance();

    use DiseasePolicy::{Ignore, Treat};
    let paths = [
        // Distinct, well-run paths — all should be viable.
        Path {
            name: "budget",
            make: plan(25.0, 55.0, Treat),
        },
        Path {
            name: "value",
            make: plan(45.0, 40.0, Treat),
        },
        Path {
            name: "premium",
            make: plan(90.0, 28.0, Treat),
        },
        Path {
            name: "ramp (earn up)",
            make: ramp(35.0),
        },
        Path {
            name: "tournament host",
            make: host(35.0),
        },
        // Run badly — these should fail.
        Path {
            name: "budget/understaffed",
            make: plan(25.0, 20.0, Treat),
        },
        Path {
            name: "premium/neglect",
            make: plan(90.0, 28.0, Ignore),
        },
        Path {
            name: "opened too rich",
            make: plan(140.0, 22.0, Treat),
        },
    ];

    println!("Balance sweep — {seeds} seeds x {turns} turns, demo course\n");
    println!(
        "{:<20} {:>6} {:>10} {:>8} {:>7} {:>8} {:>6} {:>8}",
        "path", "bust%", "mean $", "prestige", "health", "golfers", "sick", "treat $",
    );
    println!("{}", "-".repeat(80));

    for path in &paths {
        let results: Vec<RunResult> = (1..=seeds)
            .map(|s| run_one(path, &balance, s, turns))
            .collect();
        let n = results.len() as f64;
        let bust = results.iter().filter(|r| r.bankrupt).count() as f64 / n * 100.0;
        let mean_cash = mean(results.iter().map(|r| r.final_cash));
        let mean_prestige = mean(results.iter().map(|r| r.final_prestige));
        let mean_health = mean(results.iter().map(|r| r.final_health));
        let mean_golfers = mean(results.iter().map(|r| r.total_golfers as f64));
        let mean_outbreaks = mean(results.iter().map(|r| r.total_outbreaks as f64));
        let mean_treatment = mean(results.iter().map(|r| r.total_treatment));

        println!(
            "{:<20} {:>5.0}% {:>10.0} {:>8.0} {:>7.1} {:>8.0} {:>6.1} {:>8.0}",
            path.name,
            bust,
            mean_cash,
            mean_prestige,
            mean_health,
            mean_golfers,
            mean_outbreaks,
            mean_treatment,
        );
    }
}
