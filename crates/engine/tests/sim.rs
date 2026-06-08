use engine::{
    run, Balance, CourseSpec, CourseType, Event, FixedPricing, LossReason, Objective, Outcome,
    PlanStrategy, RampStrategy, Scenario, ScenarioStrategy, TournamentStrategy, Trace, World,
};

fn run_at(price: f64, seed: u64, turns: u32) -> Trace {
    let mut world = World::demo(seed);
    let mut strat = FixedPricing { price };
    run(&mut world, &mut strat, turns)
}

fn run_plan(price: f64, capacity: f64, seed: u64, turns: u32) -> (World, Trace) {
    let mut world = World::demo(seed);
    let mut strat = PlanStrategy { price, capacity };
    let trace = run(&mut world, &mut strat, turns);
    (world, trace)
}

fn sum_golfers(trace: &Trace) -> u64 {
    trace
        .iter()
        .map(|e| match e {
            Event::Demand { golfers, .. } => *golfers as u64,
            _ => 0,
        })
        .sum()
}

fn sum_turned_away(trace: &Trace) -> u64 {
    trace
        .iter()
        .map(|e| match e {
            Event::Demand { turned_away, .. } => *turned_away as u64,
            _ => 0,
        })
        .sum()
}

// --- determinism & core demand tradeoffs ---

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
    assert!(
        cheap > dear,
        "cheap should draw more golfers (cheap={cheap}, dear={dear})"
    );
}

#[test]
fn pricier_turns_more_golfers_away() {
    let cheap = sum_turned_away(&run_at(30.0, 7, 40));
    let dear = sum_turned_away(&run_at(120.0, 7, 40));
    assert!(
        dear > cheap,
        "high price should turn more away (dear={dear}, cheap={cheap})"
    );
}

#[test]
fn worn_courses_lose_health() {
    // A cheap, crowded course wears harder and ends in worse condition than a
    // premium, lightly-trafficked one — the agronomy treadmill is the core
    // pressure now that disease is gone.
    let cheap: f64 = (1..=40)
        .map(|s| {
            run_plan(25.0, 30.0, s, 80)
                .0
                .course
                .avg_health(&Balance::default().conditions)
        })
        .sum();
    let premium: f64 = (1..=40)
        .map(|s| {
            run_plan(120.0, 30.0, s, 80)
                .0
                .course
                .avg_health(&Balance::default().conditions)
        })
        .sum();
    assert!(
        cheap < premium,
        "worn cheap courses should end less healthy (cheap={cheap:.0}, premium={premium:.0})"
    );
}

#[test]
fn understaffing_a_busy_course_is_a_mistake() {
    // Same bargain price and traffic; a crew big enough to hold the greens earns
    // more than one too thin to. Demand keys off the worst-maintained green, so a
    // skeleton crew can't monetize the wages it saves — it lets a green die and
    // sheds the play that pays for itself. Guards the agronomy/greens coupling.
    fn total_cash(capacity: f64) -> f64 {
        (1..=40)
            .map(|s| run_plan(25.0, capacity, s, 120).0.finances.cash)
            .sum()
    }
    let staffed = total_cash(55.0);
    let thin = total_cash(20.0);
    assert!(
        staffed > thin,
        "holding the greens should out-earn understaffing (staffed={staffed:.0}, thin={thin:.0})"
    );
}

// --- invariants (guard against NaN, out-of-bounds, broken couplings) ---

#[test]
fn state_stays_finite() {
    for &price in &[20.0, 45.0, 90.0, 200.0] {
        for seed in 1..=20 {
            let (world, trace) = run_plan(price, 40.0, seed, 80);
            assert!(world.finances.cash.is_finite());
            assert!(world.standing.prestige.is_finite());
            assert!(world
                .course
                .avg_health(&world.balance.conditions)
                .is_finite());
            for e in &trace {
                if let Event::Cash { value, delta } = e {
                    assert!(
                        value.is_finite() && delta.is_finite(),
                        "non-finite cash at price {price}"
                    );
                }
            }
        }
    }
}

#[test]
fn prestige_stays_in_bounds() {
    for seed in 1..=20 {
        let (_w, trace) = run_plan(35.0, 40.0, seed, 120);
        for e in &trace {
            if let Event::Prestige { value, .. } = e {
                assert!(
                    (0.0..=1000.0).contains(value),
                    "prestige out of bounds: {value}"
                );
            }
        }
    }
}

#[test]
fn premium_pricing_builds_exclusivity() {
    // High-end pricing/clientele should accrue more exclusivity than a cheap,
    // crowded course — this also guards the typed `premium` segment flag.
    let premium: f64 = (1..=30)
        .map(|s| run_plan(90.0, 28.0, s, 100).0.standing.exclusivity)
        .sum();
    let budget: f64 = (1..=30)
        .map(|s| run_plan(25.0, 55.0, s, 100).0.standing.exclusivity)
        .sum();
    assert!(
        premium > budget,
        "premium should build more exclusivity (premium={premium:.0}, budget={budget:.0})"
    );
}

#[test]
fn balance_toml_round_trips() {
    // The tuning serializes to TOML and back losslessly — the editable config path.
    let b = Balance::default();
    let text = toml::to_string(&b).unwrap();
    let back: Balance = toml::from_str(&text).unwrap();
    assert_eq!(b, back);
}

#[test]
fn balance_is_data_driven() {
    // Same seed and strategy; only a balance parameter differs → the outcome
    // differs. This is the property an automated/ML tuner relies on: vary the
    // data, re-measure, optimize.
    fn final_cash(balance: Balance) -> f64 {
        let mut world = World::demo(5).with_balance(balance);
        let mut strat = PlanStrategy {
            price: 45.0,
            capacity: 40.0,
        };
        run(&mut world, &mut strat, 60);
        world.finances.cash
    }
    let base = final_cash(Balance::default());
    let mut dearer = Balance::default();
    dearer.economy.fixed_overhead += 200.0;
    let dearer_cash = final_cash(dearer);
    assert!(
        dearer_cash < base,
        "higher overhead should lower cash (base={base:.0}, dearer={dearer_cash:.0})"
    );
}

#[test]
fn hosting_tournaments_pays_heaps() {
    // The same course, hosting tournaments vs never hosting: the hard path (clear
    // the prestige gate, deliver under the spotlight) pays vastly more. This is the
    // reward curve — heaps only via tournaments.
    fn total_cash(host: bool) -> f64 {
        (1..=20)
            .map(|s| {
                let mut world = World::demo(s);
                if host {
                    run(&mut world, &mut TournamentStrategy { capacity: 35.0 }, 150);
                } else {
                    run(&mut world, &mut RampStrategy { capacity: 35.0 }, 150);
                }
                world.finances.cash
            })
            .sum()
    }
    let hosting = total_cash(true);
    let not_hosting = total_cash(false);
    assert!(
        hosting > not_hosting * 3.0,
        "hosting should pay far more (hosting={hosting:.0}, not={not_hosting:.0})"
    );
}

#[test]
fn tournament_eligibility_is_gated() {
    // A fresh, low-prestige course cannot book a top-tier tournament: the hard gate
    // holds even when the player keeps trying to commit to the Major (tier 4).
    struct AlwaysBookMajor;
    impl engine::Strategy for AlwaysBookMajor {
        fn decide(&mut self, _world: &World) -> engine::Decisions {
            engine::Decisions {
                price: 45.0,
                target_capacity: 40.0,
                accept_tournament: Some(4),
                prep_effort: 0.0,
                research_funding: 0.0,
            }
        }
    }
    let mut world = World::demo(1);
    assert!(world.standing.prestige < world.balance.tournament.tiers[4].prestige_required);
    let trace = run(&mut world, &mut AlwaysBookMajor, 10);
    let booked_major = trace
        .iter()
        .any(|e| matches!(e, Event::TournamentScheduled { tier, .. } if tier == "Major"));
    assert!(
        !booked_major,
        "should not be able to book Major at low prestige"
    );
}

fn scenario(holes: u32, par3: bool, objective: Objective, neglect: f64) -> Scenario {
    Scenario {
        name: "Test".to_string(),
        course: CourseSpec {
            holes,
            par3,
            course_type: CourseType::Heathland,
        },
        objective,
        start_neglect: neglect,
    }
}

#[test]
fn scenario_can_be_won() {
    let sc = scenario(9, true, Objective::Survive { turns: 30 }, 0.0);
    let mut world = World::demo(1).with_scenario(sc);
    let cap = world.course.regions.len() as f64 * 4.5;
    run(&mut world, &mut RampStrategy { capacity: cap }, 400);
    assert_eq!(world.outcome, Outcome::Won);
}

#[test]
fn scenario_can_be_lost_on_deadline() {
    let sc = scenario(
        9,
        true,
        Objective::CashBy {
            amount: 10_000_000.0,
            by_turn: 20,
        },
        0.0,
    );
    let mut world = World::demo(1).with_scenario(sc);
    let cap = world.course.regions.len() as f64 * 4.5;
    run(&mut world, &mut RampStrategy { capacity: cap }, 400);
    assert_eq!(world.outcome, Outcome::Lost(LossReason::Deadline));
}

#[test]
fn course_size_scales_regions_and_demand() {
    let small =
        World::demo(1).with_scenario(scenario(9, true, Objective::Survive { turns: 10 }, 0.0));
    let big =
        World::demo(1).with_scenario(scenario(27, false, Objective::Survive { turns: 10 }, 0.0));
    assert!(big.course.regions.len() > small.course.regions.len());
    assert!(big.demand_scale > small.demand_scale);
}

#[test]
fn research_unlocks_techs() {
    let mut world = World::demo(1);
    let mut st = ScenarioStrategy {
        capacity: 40.0,
        research_funding: 200.0,
        host: false,
    };
    run(&mut world, &mut st, 60);
    assert!(
        world.research.unlocked >= 1,
        "funding research should unlock techs"
    );
}

#[test]
fn research_improves_conditions() {
    // Funding research (sharper blades, drip irrigation, etc.) lets the same crew
    // hold the turf in better condition — the advanced inputs that help a course
    // cope at scale.
    fn mean_health(funding: f64) -> f64 {
        let total: f64 = (1..=20)
            .map(|s| {
                let mut w = World::demo(s);
                let mut st = ScenarioStrategy {
                    capacity: 30.0,
                    research_funding: funding,
                    host: false,
                };
                run(&mut w, &mut st, 100);
                w.course.avg_health(&w.balance.conditions)
            })
            .sum();
        total / 20.0
    }
    let researched = mean_health(80.0);
    let none = mean_health(0.0);
    assert!(
        researched > none,
        "research should improve conditions (researched={researched:.1}, none={none:.1})"
    );
}

#[test]
fn bankruptcy_is_terminal() {
    // Pricing into an empty course bankrupts; once bankrupt, no further turns run.
    let (world, trace) = run_plan(220.0, 22.0, 1, 200);
    assert!(world.finances.bankrupt, "expected bankruptcy");
    let bankrupt_at = trace
        .iter()
        .position(|e| matches!(e, Event::Bankrupt { .. }))
        .unwrap();
    let turns_after = trace[bankrupt_at + 1..]
        .iter()
        .filter(|e| matches!(e, Event::TurnStarted { .. }))
        .count();
    assert_eq!(turns_after, 0, "no turns should start after bankruptcy");
}
