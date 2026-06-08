//! Balance-sweep harness.
//!
//! Runs a scan of fixed green-fee prices across many seeds and aggregates the
//! outcomes, so the emergent demand curve and the conditions/wear tradeoff are
//! measurable.
//!
//! Usage: `sweep [--csv] [seeds] [turns]`
//!   seeds  number of seeds per price (default 200)
//!   turns  turns per run (default 60)
//!   --csv  emit per-run rows as CSV instead of the summary table

use engine::{run, Event, FixedPricing, World};

struct RunResult {
    final_cash: f64,
    final_prestige: f64,
    final_health: f64,
    final_wear: f64,
    bankrupt: bool,
    total_golfers: u64,
    total_turned_away: u64,
    total_green: f64,
    total_secondary: f64,
}

fn run_one(price: f64, seed: u64, turns: u32) -> RunResult {
    let mut world = World::demo(seed);
    let mut strategy = FixedPricing { price };
    let trace = run(&mut world, &mut strategy, turns);

    let mut total_golfers = 0u64;
    let mut total_turned_away = 0u64;
    let mut total_green = 0.0;
    let mut total_secondary = 0.0;
    for event in &trace {
        match event {
            Event::Demand { golfers, turned_away, .. } => {
                total_golfers += *golfers as u64;
                total_turned_away += *turned_away as u64;
            }
            Event::GreenFees { amount } => total_green += amount,
            Event::Secondary { amount } => total_secondary += amount,
            _ => {}
        }
    }

    RunResult {
        final_cash: world.cash,
        final_prestige: world.prestige,
        final_health: world.avg_health(),
        final_wear: world.avg_wear(),
        bankrupt: world.bankrupt,
        total_golfers,
        total_turned_away,
        total_green,
        total_secondary,
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
    let args: Vec<String> = std::env::args().skip(1).collect();
    let csv = args.iter().any(|a| a == "--csv");
    let nums: Vec<u64> = args.iter().filter_map(|a| a.parse().ok()).collect();
    let seeds = nums.first().copied().unwrap_or(200).max(1);
    let turns = nums.get(1).copied().unwrap_or(60) as u32;

    let prices = [20.0, 30.0, 40.0, 55.0, 70.0, 90.0, 120.0, 160.0];

    if csv {
        println!("price,seed,final_cash,final_prestige,final_health,final_wear,bankrupt,golfers,turned_away,green,secondary");
        for &price in &prices {
            for seed in 1..=seeds {
                let r = run_one(price, seed, turns);
                println!(
                    "{price:.0},{seed},{:.0},{:.0},{:.1},{:.1},{},{},{},{:.0},{:.0}",
                    r.final_cash, r.final_prestige, r.final_health, r.final_wear, r.bankrupt as u8,
                    r.total_golfers, r.total_turned_away, r.total_green, r.total_secondary,
                );
            }
        }
        return;
    }

    println!("Balance sweep — {seeds} seeds x {turns} turns, demo course (fixed-price scan)\n");
    println!(
        "{:>6} {:>6} {:>10} {:>8} {:>7} {:>6} {:>8} {:>7} {:>9} {:>9}",
        "fee", "bust%", "mean $", "prestige", "health", "wear", "golfers", "balked", "green $", "secd $",
    );
    println!("{}", "-".repeat(86));

    for &price in &prices {
        let results: Vec<RunResult> = (1..=seeds).map(|s| run_one(price, s, turns)).collect();
        let n = results.len() as f64;
        let bust = results.iter().filter(|r| r.bankrupt).count() as f64 / n * 100.0;
        let mean_cash = mean(results.iter().map(|r| r.final_cash));
        let mean_prestige = mean(results.iter().map(|r| r.final_prestige));
        let mean_health = mean(results.iter().map(|r| r.final_health));
        let mean_wear = mean(results.iter().map(|r| r.final_wear));
        let mean_golfers = mean(results.iter().map(|r| r.total_golfers as f64));
        let mean_turned = mean(results.iter().map(|r| r.total_turned_away as f64));
        let mean_green = mean(results.iter().map(|r| r.total_green));
        let mean_secondary = mean(results.iter().map(|r| r.total_secondary));

        println!(
            "{:>6.0} {:>5.0}% {:>10.0} {:>8.0} {:>7.1} {:>6.1} {:>8.0} {:>7.0} {:>9.0} {:>9.0}",
            price, bust, mean_cash, mean_prestige, mean_health, mean_wear, mean_golfers, mean_turned, mean_green, mean_secondary,
        );
    }
}
