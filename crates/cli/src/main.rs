//! Run the demo scenario and print its trace.
//! Usage:
//!   cli [price] [capacity] [seed] [turns]   run the demo
//!   cli dump-config                         print the default balance as TOML
//!
//! Balance is loaded from the TOML file at `$GK_BALANCE` (default
//! `config/balance.toml`); if absent, the built-in defaults are used.

use engine::{run, Balance, DiseasePolicy, Event, PlanStrategy, World};

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();

    if args.first().map(String::as_str) == Some("dump-config") {
        print!("{}", toml::to_string_pretty(&Balance::default()).unwrap());
        return;
    }

    let price: f64 = args.first().and_then(|s| s.parse().ok()).unwrap_or(45.0);
    let capacity: f64 = args.get(1).and_then(|s| s.parse().ok()).unwrap_or(40.0);
    let seed: u64 = args.get(2).and_then(|s| s.parse().ok()).unwrap_or(1);
    let turns: u32 = args.get(3).and_then(|s| s.parse().ok()).unwrap_or(30);

    let mut world = World::demo(seed).with_balance(load_balance());
    let mut strategy = PlanStrategy {
        price,
        capacity,
        disease: DiseasePolicy::Treat,
    };
    let trace = run(&mut world, &mut strategy, turns);

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
        world.course.avg_health(),
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
        Event::Outbreak { region } => format!("  !! disease outbreak on region {region}"),
        Event::Spread { region } => format!("  !! disease spread to region {region}"),
        Event::Treated { regions, cost } => {
            format!("  treatment  {regions} regions (-${cost:.0})")
        }
        Event::TournamentScheduled { tier, starts_in } => {
            format!("  >> {tier} tournament booked (starts in {starts_in})")
        }
        Event::TournamentStarted { tier } => {
            format!("  >> {tier} tournament underway — all eyes on the course")
        }
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
    }
}
