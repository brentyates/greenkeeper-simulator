use engine::{run, GreedyPricing, Strategy, SweetSpotPricing, World};

fn sweet_run(seed: u64, turns: u32) -> engine::Trace {
    let mut world = World::demo(seed);
    let mut strat = SweetSpotPricing;
    run(&mut world, &mut strat, turns)
}

#[test]
fn same_seed_is_identical() {
    assert_eq!(sweet_run(42, 40), sweet_run(42, 40));
}

#[test]
fn different_seed_differs() {
    assert_ne!(sweet_run(1, 40), sweet_run(2, 40));
}

#[test]
fn greedy_pricing_turns_more_golfers_away() {
    fn turned_away(strategy: &mut dyn Strategy) -> u32 {
        let mut world = World::demo(7);
        run(&mut world, strategy, 40)
            .iter()
            .map(|e| match e {
                engine::Event::Demand { turned_away, .. } => *turned_away,
                _ => 0,
            })
            .sum()
    }
    let sweet = turned_away(&mut SweetSpotPricing);
    let greedy = turned_away(&mut GreedyPricing { multiplier: 1.6 });
    assert!(
        greedy > sweet,
        "greedy pricing should turn away more golfers (greedy={greedy}, sweet={sweet})"
    );
}
