use engine::{run, Event, FixedPricing, World};

fn run_at(price: f64, seed: u64, turns: u32) -> engine::Trace {
    let mut world = World::demo(seed);
    let mut strat = FixedPricing { price };
    run(&mut world, &mut strat, turns)
}

fn sum_golfers(trace: &engine::Trace) -> u64 {
    trace
        .iter()
        .map(|e| match e {
            Event::Demand { golfers, .. } => *golfers as u64,
            _ => 0,
        })
        .sum()
}

fn sum_turned_away(trace: &engine::Trace) -> u64 {
    trace
        .iter()
        .map(|e| match e {
            Event::Demand { turned_away, .. } => *turned_away as u64,
            _ => 0,
        })
        .sum()
}

#[test]
fn same_seed_is_identical() {
    assert_eq!(run_at(45.0, 42, 40), run_at(45.0, 42, 40));
}

#[test]
fn different_seed_differs() {
    assert_ne!(run_at(45.0, 1, 40), run_at(45.0, 2, 40));
}

#[test]
fn cheaper_draws_more_golfers() {
    let cheap = sum_golfers(&run_at(30.0, 7, 40));
    let dear = sum_golfers(&run_at(120.0, 7, 40));
    assert!(cheap > dear, "cheap should draw more golfers (cheap={cheap}, dear={dear})");
}

#[test]
fn pricier_turns_more_golfers_away() {
    let cheap = sum_turned_away(&run_at(30.0, 7, 40));
    let dear = sum_turned_away(&run_at(120.0, 7, 40));
    assert!(dear > cheap, "high price should turn more away (dear={dear}, cheap={cheap})");
}
