//! Balance-sweep harness.
//!
//! Runs a set of operating *paths* (price + staffing + disease policy) across many
//! seeds and aggregates the outcomes — so we can see whether multiple distinct
//! paths are viable, and which mistakes sink them.
//!
//! Usage: `sweep [seeds] [turns]`  (defaults: 150 seeds, 150 turns)

use engine::{run, Event, PlanStrategy, World};

struct Path {
    name: &'static str,
    price: f64,
    capacity: f64,
    treat: bool,
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

fn run_one(path: &Path, seed: u64, turns: u32) -> RunResult {
    let mut world = World::demo(seed);
    let mut strategy = PlanStrategy { price: path.price, capacity: path.capacity, treat: path.treat };
    let trace = run(&mut world, &mut strategy, turns);

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
        final_cash: world.cash,
        final_prestige: world.prestige,
        final_health: world.avg_health(),
        bankrupt: world.bankrupt,
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
    let nums: Vec<u64> = std::env::args().skip(1).filter_map(|a| a.parse().ok()).collect();
    let seeds = nums.first().copied().unwrap_or(150).max(1);
    let turns = nums.get(1).copied().unwrap_or(150) as u32;

    let paths = [
        // Distinct, well-run paths — all should be viable.
        Path { name: "budget", price: 25.0, capacity: 55.0, treat: true },
        Path { name: "value", price: 45.0, capacity: 40.0, treat: true },
        Path { name: "premium", price: 90.0, capacity: 28.0, treat: true },
        Path { name: "elite", price: 140.0, capacity: 22.0, treat: true },
        // The same paths run badly — these should fail.
        Path { name: "budget/understaffed", price: 25.0, capacity: 20.0, treat: true },
        Path { name: "premium/neglect", price: 90.0, capacity: 28.0, treat: false },
        Path { name: "overpriced", price: 200.0, capacity: 22.0, treat: true },
    ];

    println!("Balance sweep — {seeds} seeds x {turns} turns, demo course\n");
    println!(
        "{:<20} {:>6} {:>10} {:>8} {:>7} {:>8} {:>6} {:>8}",
        "path", "bust%", "mean $", "prestige", "health", "golfers", "sick", "treat $",
    );
    println!("{}", "-".repeat(80));

    for path in &paths {
        let results: Vec<RunResult> = (1..=seeds).map(|s| run_one(path, s, turns)).collect();
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
            path.name, bust, mean_cash, mean_prestige, mean_health, mean_golfers, mean_outbreaks, mean_treatment,
        );
    }
}
