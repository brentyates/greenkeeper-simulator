//! Systems: pure functions that advance world state one turn, in a fixed order.
//! Tuning is read from `world.balance` (data), never hardcoded here. Systems are
//! `pub(crate)` so only `step` can orchestrate them — preserving the fixed order.

use crate::event::{Event, Trace};
use crate::model::{
    LossReason, Objective, Outcome, PrepTask, TournamentPhase, TournamentState, TournamentTier,
    World,
};

/// Outcome of the demand system for one turn.
pub(crate) struct DemandOutcome {
    pub revenue: f64,
    pub golfers: f64,
    pub satisfaction: f64,  // 0..100, feeds reputation
    pub premium_share: f64, // 0..1, feeds exclusivity
}

/// Cumulative passive bonuses from unlocked tech: (mower_efficiency, irrigation),
/// each a 0..0.85 fraction. These are how research lets a player cope with
/// scaling up to bigger courses.
pub(crate) fn tech_bonuses(world: &World) -> (f64, f64) {
    let n = world.research.unlocked as usize;
    let mut mow = 0.0;
    let mut irr = 0.0;
    for tech in world.balance.research.techs.iter().take(n) {
        mow += tech.mower_efficiency;
        irr += tech.irrigation;
    }
    (mow.min(0.85), irr.min(0.85))
}

/// Fund research: spend cash, accrue points, unlock the next tech(s) in order.
pub(crate) fn research_tick(world: &mut World, funding: f64, trace: &mut Trace) {
    let spend = funding.max(0.0).min(world.finances.cash.max(0.0));
    if spend <= 0.0 {
        return;
    }
    world.finances.cash -= spend;
    world.research.points += spend * world.balance.research.funding_to_points;
    while (world.research.unlocked as usize) < world.balance.research.techs.len() {
        let idx = world.research.unlocked as usize;
        let next = world.balance.research.techs[idx].clone();
        if world.research.points >= next.cost {
            world.research.points -= next.cost;
            world.research.unlocked += 1;
            trace.push(Event::TechUnlocked { name: next.name });
        } else {
            break;
        }
    }
}

/// Weather for the turn: returns extra moisture loss (rng-driven, so seeded).
pub(crate) fn weather(world: &mut World, trace: &mut Trace) -> f64 {
    let dryness = world.rng.range(0.0, world.balance.weather.dryness_max);
    trace.push(Event::Weather { dryness });
    dryness
}

/// Turf decays and grows. Lush turf grows faster — the decay treadmill.
pub(crate) fn agronomy(world: &mut World, extra_dryness: f64) {
    let nutrient_decay = world.balance.economy.nutrient_decay;
    let irrigation = tech_bonuses(world).1; // research cuts moisture loss
    let agro = world.balance.agronomy.clone();
    for r in world.course.regions.iter_mut() {
        let rates = agro.rates(r.kind);
        let moisture_loss = rates.moisture_decay * (1.0 - irrigation) + extra_dryness;
        r.moisture = (r.moisture - moisture_loss).clamp(0.0, 100.0);
        r.nutrients = (r.nutrients - nutrient_decay).clamp(0.0, 100.0);
        let mut growth = rates.growth;
        if r.moisture > agro.lush_threshold && r.nutrients > agro.lush_threshold {
            growth *= agro.lush_multiplier;
        }
        r.growth = (r.growth + growth).clamp(0.0, 100.0);
    }
}

/// Process automation capital: buy the irrigation system / robot units, pay
/// running costs, and run breakdown + repair-downtime on the robot fleet. The
/// turf work the automation does is applied in `maintenance`; this is the money
/// and machinery bookkeeping.
pub(crate) fn automation(
    world: &mut World,
    buy_irrigation: bool,
    buy_robots: u32,
    trace: &mut Trace,
) {
    let a = world.balance.automation.clone();
    // Both automations are research-gated: the irrigation system mid-tree, robots
    // as the elite endgame unlock.
    if buy_irrigation
        && world.irrigation_unlocked()
        && !world.irrigation
        && world.finances.cash >= a.irrigation_install
    {
        world.finances.cash -= a.irrigation_install;
        world.irrigation = true;
        trace.push(Event::IrrigationInstalled {
            cost: a.irrigation_install,
        });
    }
    if world.robots_unlocked() {
        for _ in 0..buy_robots {
            if world.finances.cash < a.robot_price {
                break;
            }
            world.finances.cash -= a.robot_price;
            world.robots.push(0);
            trace.push(Event::RobotPurchased {
                cost: a.robot_price,
                owned: world.robots.len() as u32,
            });
        }
    }

    // Running costs for installed/owned kit.
    if world.irrigation {
        world.finances.cash -= a.irrigation_upkeep;
    }
    world.finances.cash -= a.robot_upkeep * world.robots.len() as f64;

    // Mechanics keep the fleet running: one mechanic covers many robots
    // (`robots_per_mechanic`), pushing their breakdown rate to the floor. Robots
    // beyond what the mechanics can cover run at the penalty rate. So a small
    // mechanic crew protects a large fleet cheaply — skimping entirely is what
    // hurts.
    let n_robots = world.robots.len();
    let coverage = if n_robots == 0 {
        0.0
    } else {
        (world.ops.mechanics as f64 * a.robots_per_mechanic / n_robots as f64).clamp(0.0, 1.0)
    };
    let factor =
        a.breakdown_no_mechanic - (a.breakdown_no_mechanic - a.breakdown_floor) * coverage;
    let breakdown = a.robot_breakdown * factor;

    // Recover units mid-repair; roll breakdowns on the operational ones.
    for i in 0..n_robots {
        if world.robots[i] > 0 {
            world.robots[i] -= 1;
        } else if world.rng.next_f64() < breakdown {
            world.robots[i] = a.robot_repair_turns;
            world.finances.cash -= a.robot_repair_cost;
            trace.push(Event::RobotBrokeDown {
                repair_cost: a.robot_repair_cost,
            });
        }
    }
}

/// Maintenance has three jobs per region — mow (resets growth, grooms wear), water
/// (restores moisture), fertilize (restores nutrients) — each costing crew
/// capacity. Automation takes jobs off the crew: an irrigation system waters every
/// region automatically, and operational robots mow+fertilize the neediest regions
/// up to their throughput. The crew then covers whatever's left, neediest-first,
/// within `capacity`. When needs outrun what crew + machines can reach, conditions
/// slip — the core allocation tension.
pub(crate) fn maintenance(world: &mut World, capacity: f64, trace: &mut Trace) {
    let c = world.balance.conditions.clone();
    let agro = world.balance.agronomy.clone();
    // Better mowers/equipment make the mowing job cheaper.
    let mow_cost = agro.mow_cost * (1.0 - tech_bonuses(world).0);
    let n = world.course.regions.len();

    // Irrigation waters the whole course automatically.
    if world.irrigation {
        for r in world.course.regions.iter_mut() {
            r.moisture = agro.serviced_moisture;
        }
    }

    // Robots mow + fertilize the neediest regions, up to fleet throughput.
    let working = world.robots.iter().filter(|&&d| d == 0).count() as f64;
    let robot_reach = (working * world.balance.automation.robot_throughput).floor() as usize;
    let mut robot_done = vec![false; n];
    if robot_reach > 0 {
        let mut order: Vec<usize> = (0..n).collect();
        order.sort_by(|&a, &b| {
            world.course.regions[a]
                .health(&c)
                .total_cmp(&world.course.regions[b].health(&c))
        });
        for &i in order.iter().take(robot_reach) {
            let r = &mut world.course.regions[i];
            r.growth = agro.serviced_growth;
            r.nutrients = agro.serviced_nutrients;
            r.wear = 0.0;
            robot_done[i] = true;
        }
    }

    // Crew covers the remaining jobs, neediest-first, within capacity.
    let mut order: Vec<usize> = (0..n).collect();
    order.sort_by(|&a, &b| {
        world.course.regions[a]
            .health(&c)
            .total_cmp(&world.course.regions[b].health(&c))
    });
    let mut budget = capacity;
    let mut serviced = 0u32;
    for i in order {
        let need_water = !world.irrigation;
        let need_mowfert = !robot_done[i];
        let cost = if need_water { agro.water_cost } else { 0.0 }
            + if need_mowfert {
                mow_cost + agro.fertilize_cost
            } else {
                0.0
            };
        if cost <= 0.0 || budget < cost {
            continue;
        }
        let r = &mut world.course.regions[i];
        if need_water {
            r.moisture = agro.serviced_moisture;
        }
        if need_mowfert {
            r.growth = agro.serviced_growth;
            r.nutrients = agro.serviced_nutrients;
            r.wear = 0.0;
        }
        budget -= cost;
        serviced += 1;
    }
    trace.push(Event::Maintenance {
        regions_serviced: serviced,
        capacity_used: capacity - budget,
    });
}

/// Amenities prestige component (0..100), derived from capex (amenity_level).
pub(crate) fn amenities_score(world: &World) -> f64 {
    (world.ops.amenity_level * world.balance.prestige.amenity_per_level).clamp(0.0, 100.0)
}

/// Prestige is the holistic experience: a weighted blend of current conditions,
/// historical track record, amenities, reputation, and exclusivity. It moves
/// toward that blend asymmetrically — slow to build, fast to fall — and it is what
/// sets pricing power in `demand_and_revenue`.
pub(crate) fn prestige_update(world: &mut World, trace: &mut Trace) {
    let p = world.balance.prestige.clone();
    let conditions = world.course.avg_health(&world.balance.conditions);
    trace.push(Event::Conditions {
        avg_health: conditions,
        avg_wear: world.course.avg_wear(),
    });

    let target_score = p.w_conditions * conditions
        + p.w_historical * world.standing.historical_excellence
        + p.w_amenities * amenities_score(world)
        + p.w_reputation * world.standing.reputation
        + p.w_exclusivity * world.standing.exclusivity;
    let target = target_score * p.prestige_scale; // 0..100 → 0..1000

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
    let dm = world.balance.demand.clone();
    let avg_health = world.course.avg_health(&world.balance.conditions);
    let worst_green = world.course.worst_green_health(&world.balance.conditions);
    // Perceived conditions: the worst green drags the signal down, so neglecting
    // the surfaces golfers judge by repels play even on an otherwise tidy course.
    let condition_signal = (1.0 - dm.greens_weight) * avg_health + dm.greens_weight * worst_green;
    let experience = (dm.experience_prestige * (world.standing.prestige / 1000.0)
        + dm.experience_conditions * (condition_signal / 100.0))
        .clamp(0.0, 1.0);
    let amenity = world.ops.amenity_level;
    let weather_spend = 1.0 + dryness * dm.secondary_weather_factor;
    // Course size (throughput), tournament spotlight (attention), and residual draw.
    let demand_mult = (attention * (1.0 + world.demand_modifier)).max(0.0) * world.demand_scale;

    let mut interested_total = 0.0;
    let mut golfers_total = 0.0;
    let mut premium_golfers = 0.0;
    let mut secondary = 0.0;

    for s in &world.balance.market.segments {
        let wtp = s.base_wtp * (dm.wtp_base + dm.wtp_slope * experience);
        let interested =
            s.population * (dm.interest_base + dm.interest_slope * experience) * demand_mult;
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
    let crowding_penalty =
        ((golfers_total - comfortable).max(0.0) * dm.crowding_penalty).clamp(0.0, 100.0);
    let satisfaction = (dm.satisfaction_conditions * condition_signal
        + (1.0 - dm.satisfaction_conditions) * (100.0 - crowding_penalty))
        .clamp(0.0, 100.0);
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
    let p = world.balance.prestige.clone();
    let conditions = world.course.avg_health(&world.balance.conditions);
    let h_rate = if conditions >= world.standing.historical_excellence {
        p.hist_up_rate
    } else {
        p.hist_down_rate
    };
    world.standing.historical_excellence +=
        (conditions - world.standing.historical_excellence) * h_rate;

    let r_rate = if outcome.satisfaction >= world.standing.reputation {
        p.rep_up_rate
    } else {
        p.rep_down_rate
    };
    world.standing.reputation += (outcome.satisfaction - world.standing.reputation) * r_rate;

    let price_factor = (world.finances.price / p.excl_price_ref).clamp(0.0, 1.0) * 100.0;
    let target_excl = (p.excl_share_weight * (outcome.premium_share * 100.0)
        + p.excl_price_weight * price_factor)
        .clamp(0.0, 100.0);
    world.standing.exclusivity += (target_excl - world.standing.exclusivity) * p.excl_smoothing;

    // Tournament residual demand fades back toward zero over time.
    world.demand_modifier *= p.demand_modifier_decay;
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
    let conditions = world.course.avg_health(&world.balance.conditions);
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
    if grade >= world.balance.tournament.success_threshold {
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
    let agro = world.balance.agronomy.clone();
    let total_wear = golfers * world.balance.economy.wear_per_golfer;
    let weight_sum: f64 = world
        .course
        .regions
        .iter()
        .map(|r| agro.rates(r.kind).wear)
        .sum();
    if weight_sum <= 0.0 {
        return;
    }
    for r in world.course.regions.iter_mut() {
        let share = agro.rates(r.kind).wear / weight_sum;
        r.wear = (r.wear + total_wear * share).clamp(0.0, 100.0);
    }
}

/// Revenue in; wages, fixed overhead, and per-golfer upkeep out. Bankruptcy ends
/// the run. The per-golfer cost is what keeps high-volume play thin-margin.
pub(crate) fn economy(world: &mut World, revenue: f64, golfers: f64, trace: &mut Trace) {
    let e = &world.balance.economy;
    let expenses = world.ops.staff_capacity * e.wage_per_capacity
        + world.ops.mechanics as f64 * world.balance.automation.mechanic_wage
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
        Objective::RestoreBy { health, by_turn } => (
            world.course.avg_health(&world.balance.conditions) >= health,
            Some(by_turn),
        ),
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
