# Greenkeeper Simulator - Game Overview

## Core Philosophy

**"From pushing a mower to running a resort."**

Greenkeeper Simulator is a first-person management game where you begin as a hands-on course greenkeeper and grow into a golf resort tycoon. Unlike god-game management sims, you start at ground level - literally mowing grass yourself - and progressively delegate responsibilities as your operation scales.

---

## Game Time Scale

**Critical Foundation:** All game systems use a unified time scale with variable speed controls.

### Base Time Rate (1x Speed)
```
1 real-world second = 1 game minute (at 1x speed)
```

At 1x speed:
- 1 real second = 1 game minute
- 1 real minute = 1 game hour
- 24 real minutes = 1 game day (24 hours)
- 12 real hours = 1 game month (30 days)

### Speed Controls
Like RollerCoaster Tycoon, players can control game speed:

| Speed | Real → Game Time | 1 Game Day | 1 Game Month | Use Case |
|-------|------------------|------------|--------------|----------|
| Pause | 0x | - | - | Planning, menus, precision work |
| 1x | 1 sec = 1 min | 24 min | 12 hours | Manual mowing, hands-on work |
| 2x | 1 sec = 2 min | 12 min | 6 hours | Supervised delegation |
| 3x | 1 sec = 3 min | 8 min | 4 hours | Watching employees work |
| 5x | 1 sec = 5 min | 4.8 min | 2.4 hours | Fast-forwarding routine days |

**Design Philosophy:**
- **1x speed** for active player work (mowing, equipment operation, course inspection)
- **2-3x speed** for delegated operations (watching employees, monitoring course)
- **5x speed** for "auto-pilot" moments (overnight, waiting for research, time-gated objectives)
- **Pause** automatically when critical events occur (golfer complaints, equipment breakdown, tournament offer)

### Milestone Time-to-Complete (Real Time)

With speed controls, major milestones are achievable in reasonable play sessions:

| Milestone | Game Time | Real Time at Speed |
|-----------|-----------|-------------------|
| Complete 30-day scenario | 30 days | 12 hrs (1x), 6 hrs (2x), 2.4 hrs (5x) |
| Research mid-tier tech | 600 points at Normal funding | 3.3 hrs (1x), 1.7 hrs (2x), 40 min (5x) |
| Unlock first tournament | 30 consecutive days at 4★ | 12 hrs (1x), 6 hrs (2x), 2.4 hrs (5x) |
| Unlock Tour event | 365 consecutive days at 5★ | 6 days (1x), 3 days (2x), 1.2 days (5x) |
| Full major championship prep | 14 days | 5.6 hrs (1x), 2.8 hrs (2x), 1.1 hrs (5x) |

**Key Insight:** Tournament unlocks requiring "365 consecutive days" = ~29 hours at 5x speed = achievable over a weekend of dedicated play.

### Time-Based Rates in Specifications

All numeric rates in specs use **game time** (not real time):
- Growth rates: "0.1 per minute" = 0.1 per game minute
- Equipment consumption: "0.5 per second" = 0.5 per game minute (since 1 game minute = smallest unit)
- Research funding: "3 points per minute" = 3 points per game minute
- Employee wages: "$12 per hour" = $12 per game hour
- Economic reports: "Monthly" = every 30 game days

**Speed-Independent Behavior:**
All calculations use game time, so 2x speed makes everything happen twice as fast in real time, but the same in game time. This ensures:
- Grass grows at the same rate relative to game days
- Research completes in the same number of game hours
- Revenue and expenses scale proportionally
- Tournaments still require the same number of game days of preparation

**Note:** All specifications (COURSE_MAINTENANCE_SPEC, EQUIPMENT_SYSTEM_SPEC, RESEARCH_TREE_SPEC, etc.) define rates in game time. The speed multiplier is applied uniformly across all systems.

---

## The Greenkeeper's Journey

### Stage 1: The Solo Greenkeeper
*"It's just you, a mower, and a dream."*

You start as the head (and only) greenkeeper of a small course. Every task is done by your own hands:
- Push the mower across fairways
- Drag the sprinkler to dry patches
- Spread fertilizer where it's needed

**Why it works:**
- Your character is **faster and more efficient** than any employee you'll hire
- You learn every inch of the course intimately
- You understand what each job requires before delegating it

**The limitation:**
- A single person can't maintain a full course
- As the course grows, so does the maintenance burden
- The repetitive work becomes tedious

### Stage 2: First Employees
*"Help arrives, but you're still in the weeds."*

You hire your first groundskeepers. Now the dynamic shifts:
- Assign employees to areas or tasks
- They work while you work - parallel progress
- But they're slower and less skilled than you
- You still jump in for critical areas (greens, tournament prep)

**The tradeoff:**
- Employees cost money (wages eat into profits)
- They're less efficient (novice skill levels)
- But they scale your capability
- You're still the most valuable worker on the course

### Stage 3: The Working Manager
*"You're everywhere at once, putting out fires."*

Your course is growing. You have a small team:
- Multiple groundskeepers handling different areas
- A mechanic keeping equipment running
- Maybe an irrigator managing water systems

**Your role evolves:**
- Train and supervise employees
- Handle the critical jobs yourself (greens, problem areas)
- Step in when someone calls in sick or equipment breaks
- Start thinking about efficiency and coverage

**The tension:**
- You're still the best at every job
- But your time is increasingly valuable
- Administrative tasks compete with hands-on work

### Stage 4: The Course Superintendent
*"The course runs, but you're watching everything."*

You've built a competent team:
- Experienced employees who know their jobs
- Specialists handling specific systems
- A manager or two boosting efficiency

**Your role shifts:**
- Morning walk-through inspection
- Prioritize problem areas for crews
- Occasional hands-on intervention for quality
- Focus on standards and consistency

**The satisfaction:**
- Watch your well-oiled machine operate
- Step in occasionally just because you enjoy it
- Pride in the course you've built

### Stage 5: The Resort Director
*"You're building an empire now."*

Multiple courses, tournament hosting, five-star prestige:
- Department heads run day-to-day operations
- You focus on strategy and growth
- Facility expansion, research investment, tournament bids

**Your role becomes:**
- High-level decision making
- Resource allocation across departments
- Reputation and prestige management
- Special event oversight (tournaments, VIPs)

**The culmination:**
- Host a major championship
- Operate a world-renowned resort
- Step onto the course occasionally, just to remember where you started

---

## Core Design Principles

### 1. First-Person Perspective

Unlike RollerCoaster Tycoon's god-view, you experience the course at ground level:
- Walk the fairways yourself
- See the grass quality up close
- Feel the scale of the maintenance challenge
- Personal connection to your creation

**Camera options:**
- Third-person follow (default)
- First-person view (immersive)
- Overview mode (for planning, unlocked later)

### 2. Player Character Advantages

Your character is always the best worker on the course:

| Attribute | Player | Novice Employee | Expert Employee |
|-----------|--------|-----------------|-----------------|
| Movement Speed | 1.5x | 0.7x | 1.0x |
| Work Efficiency | 1.5x | 0.5x | 1.0x |
| Quality | 1.2x | 0.7x | 1.0x |
| Availability | Manual | 8-hour shifts | 8-hour shifts |

**Why this matters:**
- Doing it yourself is always faster (per task)
- But you can only be in one place at a time
- Employees multiply your presence
- The math favors delegation at scale

### 3. Natural Delegation Pressure

The game naturally pushes you toward delegation:

**Course growth:**
- Starter course: 3 holes, ~500 tiles (manageable solo)
- Standard course: 9 holes, ~1500 tiles (needs 2-3 crew)
- Championship course: 18 holes, ~3000 tiles (needs 6-10 crew)
- Resort complex: 27+ holes (department structure)

**Time pressure:**
- Grass grows continuously
- Golfers arrive on schedule
- Tournaments have preparation deadlines
- Weather events require rapid response

**Quality expectations:**
- Higher prestige requires better maintenance
- Golfer satisfaction affects revenue
- Tournament hosting demands perfection

### 4. Hands-On Always Available

Even at the highest level, you can always step in:
- Pick up a mower and cut the 18th green before the tournament
- Help the irrigation team during a drought emergency
- Personally inspect every bunker before a major event

**This creates moments:**
- Nostalgia for the early days
- Crisis intervention satisfaction
- Connection to your roots
- "Still got it" gameplay

### 5. Progressive Complexity

Systems unlock as you grow:

| Stage | Unlocked Systems |
|-------|-----------------|
| Solo | Basic equipment, core maintenance |
| First Hire | Employee management, scheduling |
| Growing Team | Training, specialization, areas |
| Superintendent | Research, upgrades, automation |
| Director | Tournaments, multi-course, prestige |

---

## Gameplay Loop Evolution

### Early Game Loop (Minutes)
```
Identify problem area → Walk there → Use equipment → Move on
```

### Mid Game Loop (Hours)
```
Review course status → Assign employees → Handle priorities yourself → Monitor progress
```

### Late Game Loop (Days)
```
Morning inspection → Department briefings → Resource allocation → Strategic planning → Special events
```

### End Game Loop (Seasons)
```
Annual budgeting → Tournament calendar → Expansion planning → Legacy building
```

---

## Emotional Journey

### Early Game Emotions
- **Pride**: "I mowed that fairway perfectly"
- **Exhaustion**: "I can't keep up with all this grass"
- **Relief**: "Thank god I hired someone"

### Mid Game Emotions
- **Frustration**: "Why did they miss that brown patch?"
- **Satisfaction**: "The team handled that well"
- **Growth**: "Remember when I did all this myself?"

### Late Game Emotions
- **Pride**: "Look at what we've built"
- **Nostalgia**: "Sometimes I miss pushing the mower"
- **Ambition**: "What if we hosted the Open?"

### End Game Emotions
- **Legacy**: "This is the finest course in the country"
- **Mastery**: "I could run three of these now"
- **Fulfillment**: "From one mower to this"

---

## Comparison to Other Games

### vs. RollerCoaster Tycoon
| Aspect | RCT | Greenkeeper Simulator |
|--------|-----|----------------------|
| Perspective | God view | First-person |
| Player role | Invisible hand | Physical character |
| Starting point | Build park | Maintain course |
| Early gameplay | Construction | Manual labor |
| Progression | Bigger parks | Bigger responsibility |

### vs. Farming Simulator
| Aspect | Farming Sim | Greenkeeper Simulator |
|--------|------------|----------------------|
| Core loop | Seasonal harvest | Continuous maintenance |
| Employees | Optional helpers | Essential for scale |
| Progression | Bigger farm | Management role change |
| End game | Farm empire | Resort/tournament hosting |

### vs. Two Point Hospital
| Aspect | TPH | Greenkeeper Simulator |
|--------|-----|----------------------|
| Perspective | Isometric overview | First-person on ground |
| Player actions | Placement/hiring | Physical work + management |
| Staff importance | Core mechanic | Progression unlock |
| Humor | Silly | Authentic (with charm) |

---

## Key Moments

### "I Need Help" Moment
The player realizes they physically cannot maintain course quality alone:
- Grass growing faster than they can mow
- Fairways browning while they water greens
- Golfer complaints about conditions

*This triggers first hire consideration.*

### "They're Not As Good" Moment
The player sees employee work quality lag behind their own:
- Missed spots, slower progress
- The temptation to do it yourself
- Learning to accept "good enough"

*This teaches delegation tolerance.*

### "It's Running Itself" Moment
The player watches the course operate smoothly without intervention:
- Morning inspection shows everything green
- Employees handling their areas
- Time to think about what's next

*This rewards good management.*

### "Bigger Dreams" Moment
The player realizes the current course is mastered:
- Five-star prestige achieved
- Staff is expert-level
- Systems are optimized

*This triggers expansion/tournament ambitions.*

---

## Revenue and Growth Model

### Revenue Sources (Progressive Unlock)

| Stage | Primary Revenue | Secondary Revenue |
|-------|-----------------|-------------------|
| Starter | Green fees | - |
| Growing | Green fees | Pro shop |
| Established | Green fees, Memberships | Events, Lessons |
| Premium | All above | Tournaments, Hospitality |
| Resort | All above | Hotel, Restaurants, Sponsorships |

### Cost Scaling

| Stage | Primary Costs | Challenge |
|-------|--------------|-----------|
| Starter | Supplies only | Profit margin thin |
| Growing | Supplies + 1-2 wages | Break-even struggle |
| Established | Full payroll | Efficiency crucial |
| Premium | Payroll + Facilities | Revenue must scale |
| Resort | Major operations | Portfolio management |

### Profit Curve

```
      Profit
        │
        │                              ╭───── Resort Director
        │                         ╭────╯
        │                    ╭────╯
        │               ╭────╯
        │          ╭────╯
        │     ╭────╯
        │╭────╯
    ────┼─────────────────────────────────► Scale
        │
   Solo │ First │ Team │ Super │ Director
        │ Hire  │      │ intendent │
```

Each stage has an initial dip (investment) followed by growth (returns).

---

## Controls & Input

The game supports keyboard, mouse, and touch input. All menus and UI elements can be navigated using any input method.

### Keyboard Controls

**Movement & Equipment:**
| Key | Action |
|-----|--------|
| WASD / Arrow Keys | Move player |
| 1, 2, 3 | Select equipment (mower, sprinkler, spreader) |
| Space | Toggle equipment on/off |
| E | Refill at station |

**Camera & Display:**
| Key | Action |
|-----|--------|
| Tab | Cycle overlay modes (normal/moisture/nutrients/height) |
| [ / ] | Zoom out/in |
| Mouse Wheel | Zoom in/out |

**Time & Game:**
| Key | Action |
|-----|--------|
| + / - | Speed up/slow down time |
| P / Escape | Pause game |
| M | Mute audio |

**Panels:**
| Key | Action |
|-----|--------|
| H | Employee panel |
| Y | Research panel |
| G | Tee sheet panel |
| K | Marketing panel |
| B | Equipment store |
| U | Amenities panel |
| T | Toggle terrain editor |

**Menu Navigation:**
- **Tab / Arrow Keys**: Navigate through menu options
- **Enter / Space**: Activate selected button
- **Escape**: Close menu / return

### Mouse Controls

- **Click**: Select/activate elements
- **Hover**: Visual feedback on interactive elements
- **Scroll**: Navigate through scrollable lists
- **Mouse Wheel**: Zoom in/out

### Touch Controls (Mobile/Tablet)

- **Tap**: Click/select elements
- **Swipe**: Move player (directional swipes, 50px threshold)
- **Pinch**: Zoom in/out
- **Touch & Drag**: Pan camera

### Accessibility

- All interactive elements reachable via keyboard
- Tab order follows visual layout
- Visual focus indicators (white border on focused elements)
- Minimum button size: 45px (touch-friendly)
- No reliance on hover states for critical functionality

---

## Summary

Greenkeeper Simulator is about **personal growth through professional growth**:

1. **Start small**: You are the greenkeeper
2. **Learn by doing**: Every job is your job first
3. **Grow the team**: Delegate what you've mastered
4. **Elevate your role**: From worker to manager to director
5. **Build your legacy**: From a mower to a resort empire

The core fantasy: *"I built this. I know every blade of grass because I once cut each one myself."*
