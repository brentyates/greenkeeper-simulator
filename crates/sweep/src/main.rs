//! Balance-sweep harness.
//!
//! Runs each strategy across many seeds and aggregates the outcomes, so you can
//! see — quantitatively — whether decisions trade off the way the design intends.
//!
//! Usage: `sweep [--csv] [seeds] [turns]`
//!   seeds  number of seeds per strategy (default 200)
//!   turns  turns per run (default 60)
//!   --csv  emit per-run rows as CSV instead of the summary table

use engine::{run, Event, GreedyPricing, Strategy, SweetSpotPricing, World};

type StrategyFactory = Box<dyn Fn() -> Box<dyn Strategy>>;

struct RunResult {
    final_cash: f64,
    final_prestige: f64,
    final_health: f64,
    bankrupt: bool,
    total_golfers: u64,
    total_turned_away: u64,
}

fn run_one(make: &StrategyFactory, seed: u64, turns: u32) -> RunResult {
    let mut world = World::demo(seed);
    let mut strategy = make();
    let trace = run(&mut world, strategy.as_mut(), turns);

    let mut total_golfers = 0u64;
    let mut total_turned_away = 0u64;
    for event in &trace {
        if let Event::Demand { golfers, turned_away, .. } = event {
            total_golfers += *golfers as u64;
            total_turned_away += *turned_away as u64;
        }
    }

    RunResult {
        final_cash: world.cash,
        final_prestige: world.prestige,
        final_health: world.avg_health(),
        bankrupt: world.bankrupt,
        total_golfers,
        total_turned_away,
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

    let strategies: Vec<(String, StrategyFactory)> = vec![
        ("underpriced x0.6".into(), Box::new(|| Box::new(GreedyPricing { multiplier: 0.6 }) as Box<dyn Strategy>)),
        ("sweet-spot".into(), Box::new(|| Box::new(SweetSpotPricing) as Box<dyn Strategy>)),
        ("greedy x1.3".into(), Box::new(|| Box::new(GreedyPricing { multiplier: 1.3 }) as Box<dyn Strategy>)),
        ("greedy x1.6".into(), Box::new(|| Box::new(GreedyPricing { multiplier: 1.6 }) as Box<dyn Strategy>)),
        ("greedy x2.0".into(), Box::new(|| Box::new(GreedyPricing { multiplier: 2.0 }) as Box<dyn Strategy>)),
    ];

    if csv {
        println!("strategy,seed,final_cash,final_prestige,final_health,bankrupt,golfers,turned_away");
        for (name, make) in &strategies {
            for seed in 1..=seeds {
                let r = run_one(make, seed, turns);
                println!(
                    "{name},{seed},{:.0},{:.0},{:.1},{},{},{}",
                    r.final_cash, r.final_prestige, r.final_health, r.bankrupt as u8,
                    r.total_golfers, r.total_turned_away,
                );
            }
        }
        return;
    }

    println!("Balance sweep — {seeds} seeds x {turns} turns, demo course\n");
    println!(
        "{:<18} {:>5} {:>6} {:>10} {:>9} {:>9} {:>8} {:>7} {:>8} {:>7}",
        "strategy", "runs", "bust%", "mean $", "min $", "max $", "prestige", "health", "golfers", "turned",
    );
    println!("{}", "-".repeat(96));

    for (name, make) in &strategies {
        let results: Vec<RunResult> = (1..=seeds).map(|s| run_one(make, s, turns)).collect();
        let n = results.len() as f64;
        let bust = results.iter().filter(|r| r.bankrupt).count() as f64 / n * 100.0;
        let mean_cash = mean(results.iter().map(|r| r.final_cash));
        let min_cash = results.iter().map(|r| r.final_cash).fold(f64::INFINITY, f64::min);
        let max_cash = results.iter().map(|r| r.final_cash).fold(f64::NEG_INFINITY, f64::max);
        let mean_prestige = mean(results.iter().map(|r| r.final_prestige));
        let mean_health = mean(results.iter().map(|r| r.final_health));
        let mean_golfers = mean(results.iter().map(|r| r.total_golfers as f64));
        let mean_turned = mean(results.iter().map(|r| r.total_turned_away as f64));

        println!(
            "{:<18} {:>5} {:>5.0}% {:>10.0} {:>9.0} {:>9.0} {:>8.0} {:>7.1} {:>8.0} {:>7.0}",
            name, seeds, bust, mean_cash, min_cash, max_cash, mean_prestige, mean_health, mean_golfers, mean_turned,
        );
    }
}
