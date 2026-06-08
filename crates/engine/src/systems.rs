//! Systems: pure functions that advance world state one turn, in a fixed order.
//! Tuning is read from `world.balance` (data), never hardcoded here. Systems are
//! `pub(crate)` so only `step` can orchestrate them — preserving the fixed order.

use crate::event::{Event, Trace};
use crate::model::{
    DiseasePolicy, LossReason, Objective, Outcome, PrepTask, TournamentPhase, TournamentState,
    TournamentTier, World,
};

/// Outcome of the demand system for one turn.
pub(crate) struct DemandOutcome {
    pub revenue: f64,
    pub golfers: f64,
    pub satisfaction: f64,  // 0..100, feeds reputation
    pub premium_share: f64, // 0..1, feeds exclusivity
}

/// Weather for the turn: returns extra moisture loss (rng-driven, so seeded).
pub(crate) fn weather(world: &mut World, trace: &mut Trace) -> f64 {
    let dryness = world.rng.range(0.0, 6.0);
    trace.push(Event::Weather { dryness });
    dryness
}

/// Turf decays and grows. Lush turf grows faster — the decay treadmill.
pub(crate) fn agronomy(world: &mut World, extra_dryness: f64) {
    let nutrient_decay = world.balance.economy.nutrient_decay;
    for r in world.course.regions.iter_mut() {
        r.moisture = (r.moisture - r.kind.moisture_decay() - extra_dryness).clamp(0.0, 100.0);
        r.nutrients = (r.nutrients - nutrient_decay).clamp(0.0, 100.0);
        let mut growth = r.kind.growth_rate();
        if r.moisture > 50.0 && r.nutrients > 50.0 {
            growth *= 1.5;
        }
        r.growth = (r.growth + growth).clamp(0.0, 100.0);
    }
}

/// Limited crew capacity fully services the neediest regions first (restoring
/// moisture, mowing, fertilizing, repairing wear). When needy regions outnumber
/// capacity, conditions slip — the core allocation tension.
pub(crate) fn maintenance(world: &mut World, capacity: f64, trace: &mut Trace) {
    let service_cost = world.balance.economy.service_cost;

    let mut order: Vec<usize> = (0..world.course.regions.len()).collect();
    order.sort_by(|&a, &b| {
        world.course.regions[a]
            .health()
            .total_cmp(&world.course.regions[b].health())
    });

    let mut budget = capacity;
    let mut serviced = 0u32;
    for i in order {
        if budget < service_cost {
            break;
        }
        let r = &mut world.course.regions[i];
        r.moisture = 70.0;
        r.growth = 5.0;
        r.nutrients = 80.0;
        r.wear = 0.0;
        budget -= service_cost;
        serviced += 1;
    }
    trace.push(Event::Maintenance {
        regions_serviced: serviced,
        capacity_used: capacity - budget,
    });
}

/// How prone a region is to an outbreak, 0..1 — driven mostly by wear (stressed
/// turf), with lush growth and dry/heat stress adding to it. Never surfaced as a
/// number; learned by playing (DESIGN §7).
fn susceptibility(r: &crate::model::Region, dryness: f64) -> f64 {
    (0.75 * (r.wear / 100.0) + 0.15 * (r.growth / 100.0) + 0.10 * (dryness / 6.0)).clamp(0.0, 1.0)
}

/// Treat active disease if chosen: clears infection, but each turn of use breeds
/// resistance that saps effectiveness — overtreating a chronically sick course
/// eventually stops working. Idle turns let resistance fade.
pub(crate) fn treatment(world: &mut World, policy: DiseasePolicy, trace: &mut Trace) {
    let d = &world.balance.disease;
    let any_infected = world.course.regions.iter().any(|r| r.infection > 0.0);
    if policy == DiseasePolicy::Ignore || !any_infected {
        world.treatment_resistance = (world.treatment_resistance - d.resist_decay).max(0.0);
        return;
    }
    let effectiveness = d.treat_power * (1.0 - world.treatment_resistance);
    let mut treated = 0u32;
    for r in world.course.regions.iter_mut() {
        if r.infection > 0.0 {
            r.infection = (r.infection - effectiveness).max(0.0);
            treated += 1;
        }
    }
    let cost = treated as f64 * d.treat_cost;
    world.finances.cash -= cost;
    world.treatment_resistance = (world.treatment_resistance + d.resist_gain).min(d.resist_max);
    trace.push(Event::Treated {
        regions: treated,
        cost,
    });
}

/// Outbreaks ignite on stressed turf, worsen if untreated, and spread to other
/// regions — the calculated-risk layer that makes a worn course dangerous.
pub(crate) fn disease_tick(world: &mut World, dryness: f64, trace: &mut Trace) {
    let d = world.balance.disease.clone();
    let n = world.course.regions.len();

    for i in 0..n {
        let infection = world.course.regions[i].infection;
        if infection > 0.0 {
            world.course.regions[i].infection = (infection + d.infection_growth).min(100.0);
        } else {
            let susc = susceptibility(&world.course.regions[i], dryness);
            if world.rng.next_f64() < susc * d.outbreak_rate {
                world.course.regions[i].infection = d.outbreak_severity;
                trace.push(Event::Outbreak {
                    region: world.course.regions[i].id,
                });
            }
        }
    }

    let infected: Vec<usize> = (0..n)
        .filter(|&i| world.course.regions[i].infection > 0.0)
        .collect();
    for _ in infected {
        if world.rng.next_f64() >= d.spread_chance {
            continue;
        }
        let healthy: Vec<usize> = (0..n)
            .filter(|&i| world.course.regions[i].infection <= 0.0)
            .collect();
        if healthy.is_empty() {
            break;
        }
        let pick = ((world.rng.next_f64() * healthy.len() as f64) as usize).min(healthy.len() - 1);
        let idx = healthy[pick];
        world.course.regions[idx].infection = d.spread_severity;
        trace.push(Event::Spread {
            region: world.course.regions[idx].id,
        });
    }
}

/// Amenities prestige component (0..100), derived from capex (amenity_level).
pub(crate) fn amenities_score(world: &World) -> f64 {
    (world.ops.amenity_level * 25.0).clamp(0.0, 100.0)
}

/// Prestige is the holistic experience: a weighted blend of current conditions,
/// historical track record, amenities, reputation, and exclusivity. It moves
/// toward that blend asymmetrically — slow to build, fast to fall — and it is what
/// sets pricing power in `demand_and_revenue`.
pub(crate) fn prestige_update(world: &mut World, trace: &mut Trace) {
    let p = &world.balance.prestige;
    let conditions = world.course.avg_health();
    trace.push(Event::Conditions {
        avg_health: conditions,
        avg_wear: world.course.avg_wear(),
    });

    let target_score = p.w_conditions * conditions
        + p.w_historical * world.standing.historical_excellence
        + p.w_amenities * amenities_score(world)
        + p.w_reputation * world.standing.reputation
        + p.w_exclusivity * world.standing.exclusivity;
    let target = target_score * 10.0; // 0..100 → 0..1000

    let diff = target - world.standing.prestige;
    let delta = if diff >= 0.0 {
        diff.min(p.max_up)
    } else {
        diff.max(-p.max_down)
    };
    world.standing.prestige = (world.standing.prestige + delta).clamp(0.0, 1000.0);
    trace.push(Event::Prestige {
        value: world.standing.prestige,
        delta,
    });
}

/// Segmented, value-based demand. Pricing power is the holistic prestige
/// experience (with a little weight on today's conditions): a higher-prestige
/// course draws more golfers and commands more before they balk. Playing golfers
/// also generate secondary revenue and a satisfaction signal.
pub(crate) fn demand_and_revenue(
    world: &mut World,
    price: f64,
    dryness: f64,
    attention: f64,
    trace: &mut Trace,
) -> DemandOutcome {
    world.finances.price = price;
    let experience = (0.7 * (world.standing.prestige / 1000.0)
        + 0.3 * (world.course.avg_health() / 100.0))
        .clamp(0.0, 1.0);
    let amenity = world.ops.amenity_level;
    let weather_spend = 1.0 + dryness * 0.1;
    // Course size (throughput), tournament spotlight (attention), and residual draw.
    let demand_mult = (attention * (1.0 + world.demand_modifier)).max(0.0) * world.demand_scale;

    let mut interested_total = 0.0;
    let mut golfers_total = 0.0;
    let mut premium_golfers = 0.0;
    let mut secondary = 0.0;

    for s in &world.course.segments {
        let wtp = s.base_wtp * (0.5 + 1.0 * experience);
        let interested = s.population * (0.2 + 0.8 * experience) * demand_mult;
        let playing_fraction = (1.0 - (price - wtp).max(0.0) / s.wtp_spread).clamp(0.0, 1.0);
        let golfers = interested * playing_fraction;

        interested_total += interested;
        golfers_total += golfers;
        secondary += golfers * s.spend_propensity * amenity * weather_spend;
        if s.premium {
            premium_golfers += golfers;
        }
    }

    let golfers = golfers_total.round();
    let interested = interested_total.round();
    let turned_away = (interested - golfers).max(0.0);
    let green_fees = golfers * price;

    // Satisfaction: good conditions, uncrowded play. Feeds reputation next turn.
    let comfortable = world.balance.prestige.comfortable_golfers;
    let crowding_penalty = ((golfers_total - comfortable).max(0.0) * 2.0).clamp(0.0, 100.0);
    let satisfaction =
        (0.7 * world.course.avg_health() + 0.3 * (100.0 - crowding_penalty)).clamp(0.0, 100.0);
    let premium_share = if golfers_total > 0.0 {
        premium_golfers / golfers_total
    } else {
        0.0
    };

    trace.push(Event::Demand {
        interested: interested as u32,
        golfers: golfers as u32,
        turned_away: turned_away as u32,
        price,
    });
    trace.push(Event::GreenFees { amount: green_fees });
    trace.push(Event::Secondary { amount: secondary });

    DemandOutcome {
        revenue: green_fees + secondary,
        golfers,
        satisfaction,
        premium_share,
    }
}

/// Update prestige's slow-moving inputs from how the day actually went. Track
/// record and reputation build slowly and fall faster; exclusivity reflects how
/// high-end your pricing and clientele are. These shape *next* turn's prestige.
pub(crate) fn standing_update(world: &mut World, outcome: &DemandOutcome) {
    let conditions = world.course.avg_health();
    let h_rate = if conditions >= world.standing.historical_excellence {
        0.04
    } else {
        0.12
    };
    world.standing.historical_excellence +=
        (conditions - world.standing.historical_excellence) * h_rate;

    let r_rate = if outcome.satisfaction >= world.standing.reputation {
        0.08
    } else {
        0.15
    };
    world.standing.reputation += (outcome.satisfaction - world.standing.reputation) * r_rate;

    let price_factor = (world.finances.price / 200.0).clamp(0.0, 1.0) * 100.0;
    let target_excl =
        (0.6 * (outcome.premium_share * 100.0) + 0.4 * price_factor).clamp(0.0, 100.0);
    world.standing.exclusivity += (target_excl - world.standing.exclusivity) * 0.1;

    // Tournament residual demand fades back toward zero over time.
    world.demand_modifier *= 0.95;
}

/// Commit to hosting a tournament if one is requested, eligible (prestige gate),
/// and affordable. Pays the entry fee and draws the prep checklist (mandatory
/// tasks + one optional boost task).
pub(crate) fn tournament_accept(world: &mut World, tier_idx: Option<usize>, trace: &mut Trace) {
    let Some(idx) = tier_idx else {
        return;
    };
    if world.tournament.is_some() {
        return;
    }
    let tb = world.balance.tournament.clone();
    let Some(tier) = tb.tiers.get(idx).cloned() else {
        return;
    };
    if world.standing.prestige < tier.prestige_required || world.finances.cash < tier.entry_cost {
        return;
    }

    let mut tasks = pick_distinct(
        &tb.prep_tasks,
        tier.prep_task_count as usize,
        &mut world.rng,
    );
    tasks.extend(pick_distinct(&tb.optional_tasks, 1, &mut world.rng));
    let mandatory_total: f64 = tasks.iter().filter(|t| !t.optional).map(|t| t.effort).sum();

    world.finances.cash -= tier.entry_cost;
    world.tournament = Some(TournamentState {
        tier: idx,
        phase: TournamentPhase::Scheduled {
            turns_until: tier.prep_turns,
            tasks,
            mandatory_total,
        },
    });
    trace.push(Event::TournamentScheduled {
        tier: tier.name,
        starts_in: tier.prep_turns,
    });
}

/// Pick `n` distinct tasks from a pool using the seeded RNG. Deterministic.
fn pick_distinct(pool: &[PrepTask], n: usize, rng: &mut crate::rng::Rng) -> Vec<PrepTask> {
    let mut idxs: Vec<usize> = (0..pool.len()).collect();
    let mut out = Vec::new();
    for _ in 0..n.min(pool.len()) {
        let k = ((rng.next_f64() * idxs.len() as f64) as usize).min(idxs.len() - 1);
        out.push(pool[idxs.remove(k)].clone());
    }
    out
}

/// Work the prep checklist with diverted capacity — mandatory tasks first, the
/// optional boost last (so it's only finished if you push extra effort in).
/// Returns effort actually spent. No-op outside the prep window.
pub(crate) fn tournament_prep(world: &mut World, prep_effort: f64, trace: &mut Trace) -> f64 {
    let Some(state) = world.tournament.as_mut() else {
        return 0.0;
    };
    let TournamentPhase::Scheduled { tasks, .. } = &mut state.phase else {
        return 0.0;
    };
    let mut budget = prep_effort.max(0.0);
    let mut spent = 0.0;
    for task in tasks.iter_mut() {
        if budget <= 0.0 {
            break;
        }
        if task.effort <= 0.0 {
            continue;
        }
        let apply = budget.min(task.effort);
        task.effort -= apply;
        budget -= apply;
        spent += apply;
        if task.effort <= 0.0 {
            trace.push(Event::TournamentPrep {
                task: task.name.clone(),
                optional: task.optional,
            });
        }
    }
    spent
}

/// Advance a booked tournament: count down prep, then run the event accumulating
/// conditions. Returns the demand-surge "attention" multiplier for this turn (1.0
/// when no event is live). Resolves and grades the event on its final day.
pub(crate) fn tournament_tick(world: &mut World, trace: &mut Trace) -> f64 {
    let conditions = world.course.avg_health();
    let Some(mut state) = world.tournament.take() else {
        return 1.0;
    };
    let tier = world.balance.tournament.tiers[state.tier].clone();
    let tier_idx = state.tier;
    let mut attention = 1.0;

    match &mut state.phase {
        TournamentPhase::Scheduled {
            turns_until,
            tasks,
            mandatory_total,
        } => {
            if *turns_until > 1 {
                *turns_until -= 1;
                world.tournament = Some(state);
            } else {
                // Lock readiness from how much of the mandatory checklist got done.
                let remaining_mandatory: f64 =
                    tasks.iter().filter(|t| !t.optional).map(|t| t.effort).sum();
                let readiness = if *mandatory_total > 0.0 {
                    (1.0 - remaining_mandatory / *mandatory_total).clamp(0.0, 1.0)
                } else {
                    1.0
                };
                let optional_done = tasks.iter().filter(|t| t.optional).all(|t| t.effort <= 0.0);
                trace.push(Event::TournamentStarted {
                    tier: tier.name.clone(),
                    readiness,
                    optional_done,
                });
                attention = tier.attention;
                if tier.duration <= 1 {
                    resolve_tournament(
                        world,
                        tier_idx,
                        &tier,
                        conditions,
                        readiness,
                        optional_done,
                        trace,
                    );
                } else {
                    state.phase = TournamentPhase::Running {
                        day: 1,
                        condition_sum: conditions,
                        readiness,
                        optional_done,
                    };
                    world.tournament = Some(state);
                }
            }
        }
        TournamentPhase::Running {
            day,
            condition_sum,
            readiness,
            optional_done,
        } => {
            *day += 1;
            *condition_sum += conditions;
            attention = tier.attention;
            if *day >= tier.duration {
                let avg = *condition_sum / *day as f64;
                let (r, od) = (*readiness, *optional_done);
                resolve_tournament(world, tier_idx, &tier, avg, r, od, trace);
            } else {
                world.tournament = Some(state);
            }
        }
    }
    attention
}

/// Grade the event by how well conditions held under the spotlight, scaled by
/// prep readiness (showing up half-built tanks it); the optional task adds a
/// payout bonus. Then pay out, swing prestige (amplified), and set a residual.
fn resolve_tournament(
    world: &mut World,
    tier_idx: usize,
    tier: &TournamentTier,
    avg_condition: f64,
    readiness: f64,
    optional_done: bool,
    trace: &mut Trace,
) {
    let condition_grade =
        ((avg_condition - tier.fail_floor) / (tier.target - tier.fail_floor)).clamp(0.0, 1.0);
    let grade = condition_grade * readiness;
    if grade >= 0.5 {
        world.best_hosted_tier = Some(world.best_hosted_tier.map_or(tier_idx, |b| b.max(tier_idx)));
    }
    let bonus = if optional_done {
        1.0 + tier.optional_bonus
    } else {
        1.0
    };
    let payout = tier.payout * grade * bonus;
    world.finances.cash += payout;
    let prestige_delta = tier.prestige_swing * (2.0 * grade - 1.0);
    world.standing.prestige = (world.standing.prestige + prestige_delta).clamp(0.0, 1000.0);
    world.demand_modifier += tier.residual * (2.0 * grade - 1.0);
    world.tournament = None;
    trace.push(Event::TournamentResult {
        tier: tier.name.clone(),
        grade,
        payout,
        prestige_delta,
    });
}

/// Golfer traffic wears the course — greens and tees most. This couples growth
/// back onto conditions: the more play you take, the harder it is to stay
/// pristine. The brake and the flywheel are the same mechanism.
pub(crate) fn wear_from_traffic(world: &mut World, golfers: f64) {
    let total_wear = golfers * world.balance.economy.wear_per_golfer;
    let weight_sum: f64 = world
        .course
        .regions
        .iter()
        .map(|r| r.kind.wear_rate())
        .sum();
    if weight_sum <= 0.0 {
        return;
    }
    for r in world.course.regions.iter_mut() {
        let share = r.kind.wear_rate() / weight_sum;
        r.wear = (r.wear + total_wear * share).clamp(0.0, 100.0);
    }
}

/// Revenue in; wages, fixed overhead, and per-golfer upkeep out. Bankruptcy ends
/// the run. The per-golfer cost is what keeps high-volume play thin-margin.
pub(crate) fn economy(world: &mut World, revenue: f64, golfers: f64, trace: &mut Trace) {
    let e = &world.balance.economy;
    let expenses = world.ops.staff_capacity * e.wage_per_capacity
        + e.fixed_overhead
        + golfers * e.variable_cost_per_golfer;
    let floor = e.bankruptcy_floor;
    let delta = revenue - expenses;
    world.finances.cash += delta;
    trace.push(Event::Cash {
        value: world.finances.cash,
        delta,
    });
    if world.finances.cash < floor {
        world.finances.bankrupt = true;
        world.outcome = Outcome::Lost(LossReason::Bankruptcy);
        trace.push(Event::Bankrupt { turn: world.turn });
    }
}

/// Evaluate the scenario objective (if any): win when met, lose when the deadline
/// passes unmet. Bankruptcy is handled in `economy`; `Survive` only loses that way.
pub(crate) fn objective_check(world: &mut World, trace: &mut Trace) {
    if !world.outcome.is_running() {
        return;
    }
    let Some(scenario) = world.scenario.clone() else {
        return;
    };
    let (met, deadline) = match scenario.objective {
        Objective::CashBy { amount, by_turn } => (world.finances.cash >= amount, Some(by_turn)),
        Objective::PrestigeBy { prestige, by_turn } => {
            (world.standing.prestige >= prestige, Some(by_turn))
        }
        Objective::RestoreBy { health, by_turn } => {
            (world.course.avg_health() >= health, Some(by_turn))
        }
        Objective::HostBy { min_tier, by_turn } => (
            world.best_hosted_tier.is_some_and(|t| t >= min_tier),
            Some(by_turn),
        ),
        Objective::Survive { turns } => (world.turn >= turns, None),
    };

    if met {
        world.outcome = Outcome::Won;
        trace.push(Event::ScenarioWon {
            scenario: scenario.name.clone(),
        });
    } else if deadline.is_some_and(|d| world.turn >= d) {
        world.outcome = Outcome::Lost(LossReason::Deadline);
        trace.push(Event::ScenarioLost {
            scenario: scenario.name.clone(),
            reason: "deadline".to_string(),
        });
    }
}
