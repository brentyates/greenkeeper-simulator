//! Run the demo scenario and print its trace.
//! Usage:
//!   cli [price] [capacity] [seed] [turns]   run the demo
//!   cli dump-config                         print the default balance as TOML
//!
//! Balance is loaded from the TOML file at `$GK_BALANCE` (default
//! `config/balance.toml`); if absent, the built-in defaults are used.

use engine::{
    campaign, run, Balance, Event, LossReason, Objective, Outcome, PlanStrategy, ScenarioStrategy,
    Strategy, TournamentStrategy, World,
};

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();

    if args.first().map(String::as_str) == Some("dump-config") {
        print!("{}", toml::to_string_pretty(&Balance::default()).unwrap());
        return;
    }

    if args.first().map(String::as_str) == Some("scenario") {
        run_scenario(&args);
        return;
    }

    // `cli host [capacity] [seed] [turns]` chases tournaments; otherwise a plain
    // `cli [price] [capacity] [seed] [turns]` runs a fixed plan.
    let host_mode = args.first().map(String::as_str) == Some("host");
    let (mut strategy, seed, turns): (Box<dyn Strategy>, u64, u32) = if host_mode {
        let capacity: f64 = args.get(1).and_then(|s| s.parse().ok()).unwrap_or(35.0);
        let seed: u64 = args.get(2).and_then(|s| s.parse().ok()).unwrap_or(1);
        let turns: u32 = args.get(3).and_then(|s| s.parse().ok()).unwrap_or(60);
        (Box::new(TournamentStrategy { capacity }), seed, turns)
    } else {
        let price: f64 = args.first().and_then(|s| s.parse().ok()).unwrap_or(45.0);
        let capacity: f64 = args.get(1).and_then(|s| s.parse().ok()).unwrap_or(40.0);
        let seed: u64 = args.get(2).and_then(|s| s.parse().ok()).unwrap_or(1);
        let turns: u32 = args.get(3).and_then(|s| s.parse().ok()).unwrap_or(30);
        let s = PlanStrategy { price, capacity };
        (Box::new(s), seed, turns)
    };

    let mut world = World::demo(seed).with_balance(load_balance());
    let trace = run(&mut world, strategy.as_mut(), turns);

    for event in &trace {
        println!("{}", render(event));
    }

    println!("{}", "-".repeat(60));
    println!(
        "after {} turns:  cash ${:.0}   prestige {:.0} (★{})   health {:.1}   wear {:.1}{}",
        world.turn,
        world.finances.cash,
        world.standing.prestige,
        world.standing.tier() + 1,
        world.course.avg_health(&world.balance.conditions),
        world.course.avg_wear(),
        if world.finances.bankrupt {
            "   [BANKRUPT]"
        } else {
            ""
        },
    );
}

/// Load tuning from TOML (`$GK_BALANCE`, default `config/balance.toml`). Falls
/// back to built-in defaults if the file is missing or unparseable.
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

/// `cli scenario [index] [seed]` — play a campaign scenario to its outcome,
/// staffing to the course size, and report WON/LOST.
fn run_scenario(args: &[String]) {
    let idx: usize = args.get(1).and_then(|s| s.parse().ok()).unwrap_or(0);
    let seed: u64 = args.get(2).and_then(|s| s.parse().ok()).unwrap_or(1);
    let scenarios = campaign();
    let scenario = scenarios[idx.min(scenarios.len() - 1)].clone();
    let name = scenario.name.clone();

    // Only chase tournaments when the objective demands it. (A real player picks
    // their own plan.)
    let needs_tournaments = matches!(scenario.objective, Objective::HostBy { .. });

    let mut world = World::demo(seed)
        .with_balance(load_balance())
        .with_scenario(scenario);
    // Staff and fund research in proportion to the course size — the "upgrade as
    // you grow" levers that let a big course be held.
    let regions = world.course.regions.len() as f64;
    let mut strategy = ScenarioStrategy {
        capacity: regions * 4.5,
        research_funding: regions * 1.5,
        host: needs_tournaments,
    };
    let trace = run(&mut world, &mut strategy, 400);

    for event in &trace {
        if matches!(
            event,
            Event::TournamentScheduled { .. }
                | Event::TournamentResult { .. }
                | Event::ScenarioWon { .. }
                | Event::ScenarioLost { .. }
                | Event::Bankrupt { .. }
        ) {
            println!("{}", render(event));
        }
    }

    let result = match world.outcome {
        Outcome::Won => "WON",
        Outcome::Lost(LossReason::Bankruptcy) => "LOST (bankrupt)",
        Outcome::Lost(LossReason::Deadline) => "LOST (deadline)",
        Outcome::Running => "unresolved",
    };
    println!("{}", "-".repeat(60));
    println!(
        "{name} [{} regions]: {result} — turn {}, cash ${:.0}, prestige {:.0} (★{}), health {:.1}",
        world.course.regions.len(),
        world.turn,
        world.finances.cash,
        world.standing.prestige,
        world.standing.tier() + 1,
        world.course.avg_health(&world.balance.conditions),
    );
}

fn render(event: &Event) -> String {
    match event {
        Event::TurnStarted { turn } => format!("\n── turn {turn} ──"),
        Event::Weather { dryness } => format!("  weather    dryness +{dryness:.1}"),
        Event::Maintenance {
            regions_serviced,
            capacity_used,
        } => {
            format!("  crew       serviced {regions_serviced} regions (used {capacity_used:.0})")
        }
        Event::Conditions {
            avg_health,
            avg_wear,
        } => {
            format!("  conditions health {avg_health:.1}   wear {avg_wear:.1}")
        }
        Event::Prestige { value, delta } => format!("  prestige   {value:.0} ({delta:+.1})"),
        Event::Demand {
            interested,
            golfers,
            turned_away,
            price,
        } => format!(
            "  demand     {golfers}/{interested} played @ ${price:.0}  ({turned_away} balked)"
        ),
        Event::GreenFees { amount } => format!("  green fees +${amount:.0}"),
        Event::Secondary { amount } => format!("  secondary  +${amount:.0}"),
        Event::TechUnlocked { name } => format!("  ++ researched: {name}"),
        Event::TournamentScheduled { tier, starts_in } => {
            format!("  >> {tier} tournament booked (starts in {starts_in})")
        }
        Event::TournamentPrep { task, optional } => {
            let tag = if *optional { " (optional boost!)" } else { "" };
            format!("  >> prep done: {task}{tag}")
        }
        Event::TournamentStarted {
            tier,
            readiness,
            optional_done,
        } => format!(
            "  >> {tier} underway — readiness {:.0}%{}",
            readiness * 100.0,
            if *optional_done { " + boost" } else { "" }
        ),
        Event::TournamentResult {
            tier,
            grade,
            payout,
            prestige_delta,
        } => format!(
            "  >> {tier} result: grade {:.0}%  payout +${payout:.0}  prestige {prestige_delta:+.0}",
            grade * 100.0
        ),
        Event::Cash { value, delta } => format!("  cash       ${value:.0} ({delta:+.0})"),
        Event::Bankrupt { turn } => format!("  ** BANKRUPT on turn {turn} **"),
        Event::ScenarioWon { scenario } => format!("  ✓ WON: {scenario}"),
        Event::ScenarioLost { scenario, reason } => format!("  ✗ LOST: {scenario} ({reason})"),
    }
}
