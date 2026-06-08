//! Run the demo scenario and print its trace. Usage: `cli [seed] [turns]`.

use engine::{run, Event, SweetSpotPricing, World};

fn main() {
    let mut args = std::env::args().skip(1);
    let seed: u64 = args.next().and_then(|s| s.parse().ok()).unwrap_or(1);
    let turns: u32 = args.next().and_then(|s| s.parse().ok()).unwrap_or(30);

    let mut world = World::demo(seed);
    let mut strategy = SweetSpotPricing;
    let trace = run(&mut world, &mut strategy, turns);

    for event in &trace {
        println!("{}", render(event));
    }

    println!("{}", "-".repeat(60));
    println!(
        "after {} turns:  cash ${:.0}   prestige {:.0} (★{})   avg health {:.1}{}",
        world.turn,
        world.cash,
        world.prestige,
        world.tier() + 1,
        world.avg_health(),
        if world.bankrupt { "   [BANKRUPT]" } else { "" },
    );
}

fn render(event: &Event) -> String {
    match event {
        Event::TurnStarted { turn } => format!("\n── turn {turn} ──"),
        Event::Weather { dryness } => format!("  weather    dryness +{dryness:.1}"),
        Event::Maintenance { regions_serviced, capacity_used } => {
            format!("  crew       serviced {regions_serviced} regions (used {capacity_used:.0})")
        }
        Event::Conditions { avg_health } => format!("  conditions avg health {avg_health:.1}"),
        Event::Prestige { value, delta } => format!("  prestige   {value:.0} ({delta:+.1})"),
        Event::Demand { potential, golfers, turned_away, price } => format!(
            "  demand     {golfers}/{potential} played @ ${price:.0}  ({turned_away} turned away)"
        ),
        Event::Revenue { amount } => format!("  revenue    +${amount:.0}"),
        Event::Cash { value, delta } => format!("  cash       ${value:.0} ({delta:+.0})"),
        Event::Bankrupt { turn } => format!("  ** BANKRUPT on turn {turn} **"),
    }
}
