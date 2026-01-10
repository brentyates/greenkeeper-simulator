# Economy System Design Specification

## Overview

The Economy System manages all financial aspects of the golf course operation. Inspired by RollerCoaster Tycoon's financial model, players balance revenue streams against operating costs while making strategic investments for growth.

### Core Philosophy

**"Money is tight at first, then it's all about what you do with it."**

- Early game: Survival mode, every dollar counts
- Mid game: Breaking even, investing in growth
- Late game: Profitable, choosing expansion paths
- End game: Wealthy, legacy building

---

## Financial State ✅ IMPLEMENTED

```typescript
interface EconomyState {
  // Current position
  cash: number;                    // Available funds
  loans: Loan[];                   // Outstanding debt

  // Transaction history
  transactions: Transaction[];     // All recorded transactions

  // Lifetime totals
  totalEarned: number;            // All-time income
  totalSpent: number;             // All-time expenses
}
```

**Status:** Fully implemented in `src/core/economy.ts`

---

## Bankruptcy System 🔨 IN SCOPE

### Critical Thresholds

```typescript
const BANKRUPTCY_WARNING_THRESHOLD = -7500;  // First warning
const BANKRUPTCY_GAME_OVER_THRESHOLD = -10000; // Hard game over
```

### Warning at -$7,500

When cash first crosses below -$7,500:
- Show modal warning: **"⚠️ CRITICAL CASH WARNING"**
- Display current cash balance and debt status
- Suggest actions: fire employees, take loan, reduce spending
- Only shown **once per crossing** (track with flag that resets when back above threshold)
- Game continues after dismissing modal

```
┌─────────────────────────────────────────────────────────────┐
│  ⚠️  CRITICAL CASH WARNING                                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Cash Balance: -$7,850                                      │
│  You're running out of money!                               │
│                                                              │
│  If you reach -$10,000 you will go bankrupt.               │
│                                                              │
│  Consider:                                                   │
│  • Fire unnecessary employees                               │
│  • Take out a loan                                          │
│  • Reduce research funding                                  │
│  • Increase green fees                                      │
│                                                              │
│  [Understood]                                               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Game Over at -$10,000

When cash drops below -$10,000:
- **Immediate game over** (pause game)
- Show bankruptcy modal with final statistics
- **Do NOT clear autosave** - player can reload from last autosave
- No scenario completion/failure (just stops)

```
┌─────────────────────────────────────────────────────────────┐
│  💀 BANKRUPTCY                                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  You ran out of money!                                      │
│                                                              │
│  Final Cash: -$10,240                                       │
│  Total Earned: $45,230                                      │
│  Total Spent: $55,470                                       │
│  Net Loss: -$10,240                                         │
│                                                              │
│  Days Survived: 42                                          │
│                                                              │
│  [Reload Last Save]  [Return to Menu]                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Implementation Notes:**
- Track `bankruptcyWarningShown` flag (resets when cash > -$7,500)
- Check thresholds after every expense transaction
- Autosave continues normally, bankruptcy doesn't wipe it
- Player can load autosave from 1 hour before bankruptcy

---

## Transaction Categories ✅ IMPLEMENTED

### Income Categories

| Category | Description | Status |
|----------|-------------|--------|
| green_fees | Golfer payments | ✅ Implemented |
| loan_received | Borrowed funds | ✅ Implemented |
| other_income | Tips, misc | ✅ Implemented |

### Expense Categories

| Category | Description | Status |
|----------|-------------|--------|
| employee_wages | Staff payroll | ✅ Implemented |
| equipment_purchase | New equipment | ✅ Implemented |
| equipment_maintenance | Repairs, upkeep | ✅ Implemented |
| research | R&D investment | ✅ Implemented |
| supplies | Consumables (fuel, fertilizer, etc.) | ✅ Implemented |
| loan_payment | Principal repayment | ✅ Implemented |
| loan_interest | Interest charges | ✅ Implemented |
| construction | Building/terrain changes | ✅ Implemented |
| marketing | Advertising | ✅ Implemented |
| utilities | Water, electric | ✅ Implemented |
| other_expense | Miscellaneous | ✅ Implemented |

**Deferred Categories (not in economy.ts):**
- ⏸️ membership_dues, pro_shop_sales, food_beverage, tournament_revenue
- ⏸️ cart_rentals, driving_range, lessons, sponsorships
- ⏸️ insurance, property_tax

---

## Transaction Recording ✅ IMPLEMENTED

```typescript
interface Transaction {
  id: string;
  amount: number;           // Positive = income, Negative = expense
  category: TransactionCategory;
  description: string;
  timestamp: number;        // Game time
}

function addIncome(
  state: EconomyState,
  amount: number,
  category: TransactionCategory,
  description: string,
  timestamp: number
): EconomyState;

function addExpense(
  state: EconomyState,
  amount: number,
  category: TransactionCategory,
  description: string,
  timestamp: number,
  force: boolean = false  // Bypasses affordability check
): EconomyState | null;
```

**Status:** Fully implemented in `src/core/economy.ts`

**Important:** `force: true` bypasses bankruptcy checks - used for mandatory expenses like payroll and utilities.

---

## Revenue Streams

### Green Fees ✅ IMPLEMENTED (Basic)

Primary income source, currently using static pricing from golfer system.

```typescript
// Current: Static fees from tee-times.ts
interface GreenFeeStructure {
  weekday9Holes: number;     // $35 default
  weekday18Holes: number;    // $55 default
  weekend9Holes: number;     // $45 default
  weekend18Holes: number;    // $75 default
  twilight9Holes: number;    // $25 default
  twilight18Holes: number;   // $40 default
}
```

**Status:** Basic implementation exists in `tee-times.ts` and `golfers.ts`

### Prestige-Based Pricing 🔨 IN SCOPE (Simplified)

**Simple automatic pricing** - base rates adjusted by course prestige.

```typescript
function getAdjustedGreenFee(baseRate: number, prestigeStars: number): number {
  // 3-star = baseline (1.0x)
  // 4-star = +10% (1.1x)
  // 5-star = +20% (1.2x)
  const prestigeMultiplier = 1 + Math.max(0, (prestigeStars - 3) * 0.1);
  return Math.round(baseRate * prestigeMultiplier);
}
```

**Examples:**
- 3-star course: Weekday 18 = $55 (baseline)
- 4-star course: Weekday 18 = $61 (+10%)
- 5-star course: Weekday 18 = $66 (+20%)

**What's cut:**
- ❌ Complex demand multipliers
- ❌ Price elasticity calculations
- ❌ Seasonal modifiers
- ❌ Time-of-day dynamic adjustments

### Membership Program 🔨 IN SCOPE (Simplified)

**Simple single-tier membership** - predictable monthly income without complex management.

```typescript
interface SimpleMembership {
  unlockPrestige: 4;              // Requires 4-star prestige
  monthlyDue: 200;                // $200/month per member
  greenFeeDiscount: 0.25;         // 25% off green fees
  maxMembers: 100;                // Cap to prevent revenue cannibalization
  automaticFilling: true;         // Slowly fills based on prestige/satisfaction
}
```

**Mechanics:**
- Unlocks at 4-star prestige
- Members join automatically (1-3 per week) when prestige/satisfaction high
- Guaranteed monthly income: $200 × member count
- Members play regularly, pay 25% less per round
- Simple trade-off: Stable income vs. higher per-round revenue

**What's cut:**
- ❌ Multiple membership tiers (basic/premium/elite)
- ❌ Guest passes tracking
- ❌ Member satisfaction systems
- ❌ Priority booking complexity

### Pro Shop Revenue 🔨 IN SCOPE (Simplified)

**Simple per-golfer revenue** - scales with course traffic and pro shop quality.

```typescript
interface ProShopRevenue {
  // Revenue per golfer visit (when pro shop exists)
  tier1: 15;    // Basic Pro Shop: $15/golfer
  tier2: 25;    // Full Pro Shop: $25/golfer
  tier3: 40;    // Premium Pro Shop: $40/golfer

  // Staff efficiency modifier
  staffed: 1.0;     // 100% revenue with staff
  unstaffed: 0.5;   // 50% revenue without staff
}
```

**Mechanics:**
- Build pro shop (see PLACEABLE_ASSETS_SPEC.md for costs)
- Automatically earn revenue per golfer who visits
- Hire Pro Shop Staff (see EMPLOYEE_SYSTEM_SPEC.md) to unlock full revenue
- No inventory management, no category tracking

**Examples:**
- 50 golfers/day × $25 (tier 2) × 0.5 (unstaffed) = $625/day
- 50 golfers/day × $25 (tier 2) × 1.0 (staffed) = $1,250/day
- Staff wages: $10/hr × 8hr = $80/day
- Net benefit of hiring staff: +$545/day

**What's cut:**
- ❌ Merchandise categories (apparel/equipment/accessories)
- ❌ Inventory management
- ❌ Markup percentages
- ❌ Prestige-based spending multipliers

### ⏸️ DEFERRED: Tournament Revenue

**Dependent on Tournament System** - see TOURNAMENT_SYSTEM_SPEC.md

Won't implement until tournament hosting is added (if ever).

### Revenue by Game Stage 🔨 IN SCOPE (Simplified)

| Stage | Primary Revenue | Monthly Range | Notes |
|-------|-----------------|---------------|-------|
| Starter (3-hole) | Green fees only | $2,000-5,000 | Low prestige, few golfers |
| Growing (9-hole) | Green fees + tips + pro shop | $8,000-20,000 | Building reputation, optional pro shop |
| Established (18-hole) | Green fees + tips + pro shop | $25,000-60,000 | 15-25% utilization, staffed pro shop |
| Premium (18-hole 4★) | All + memberships | $60,000-120,000 | Membership unlocks, higher pricing |
| Championship (18-hole 5★) | All sources | $100,000-200,000 | 30-40% utilization, full amenities |

**Revenue sources breakdown:**
- **Green fees:** Primary income, scales with golfer volume and prestige pricing
- **Tips:** Golfer satisfaction-based, small but consistent
- **Pro shop:** $15-40 per golfer (if built and staffed)
- **Memberships:** $200/month × member count (unlocks at 4-star)

**Revenue factors:**
- Tee time utilization (see TEE_TIME_SYSTEM_SPEC.md)
- Prestige/star rating - affects pricing and volume (see PRESTIGE_SYSTEM_SPEC.md)
- Marketing campaigns (see TEE_TIME_SYSTEM_SPEC.md)
- Day of week (weekends busier)
- Pro shop tier and staffing
- Member count (4-star+)

---

## Operating Costs

### Fixed Costs 🔨 IN SCOPE (Simplified)

Daily recurring expenses (simplified from monthly):

| Cost | Small Course | Medium Course | Large Course |
|------|--------------|---------------|--------------|
| Utilities | $50/day | $100/day | $200/day |
| **TOTAL DAILY** | **$50** | **$100** | **$200** |

**Deferred:**
- ⏸️ Insurance (monthly)
- ⏸️ Property Tax (monthly/yearly)

**Note:** Simplified to daily utilities only. Insurance/tax may be added later if needed.

**Status:** Utilities partially implemented ($50/day in BabylonMain.ts)

### Variable Costs 🔨 IN SCOPE

Scale with operations:

```typescript
interface VariableCosts {
  // Per refill - 🔨 TO IMPLEMENT
  fuelCost: 10;           // $10 per mower refill
  waterCost: 5;           // $5 per sprinkler refill
  fertilizerCost: 15;     // $15 per spreader refill

  // Per employee-hour - ✅ IMPLEMENTED
  wageRates: Record<EmployeeRole, number>;
}
```

**Currently Implemented:**
- ✅ Employee wages (hourly, processed each game hour)

**To Implement:**
- 🔨 Refill costs (immediate feedback when refilling at station)

**Deferred:**
- ⏸️ Per-golfer services cost (towels, tees)
- ⏸️ Equipment depreciation/maintenance cost per hour

### Cost Breakdown Example

Monthly costs for established 18-hole course:

| Category | Amount | % of Total |
|----------|--------|------------|
| Employee Wages | $15,000 | 71% |
| Utilities | $3,000 | 14% |
| Research Funding | $2,400 | 11% |
| Loan Payments | $800 | 4% |
| **TOTAL** | **$21,200** | 100% |

**Note:** Simplified from original spec - focuses on implemented systems.

---

## Loan System ✅ IMPLEMENTED

### Loan Tiers

```typescript
const LOAN_OPTIONS = {
  small: {
    principal: 5000,
    interestRate: 0.08,    // 8% annual
    termMonths: 12,
    monthlyPayment: 435
  },
  medium: {
    principal: 25000,
    interestRate: 0.10,    // 10% annual
    termMonths: 24,
    monthlyPayment: 1152
  },
  large: {
    principal: 100000,
    interestRate: 0.12,    // 12% annual
    termMonths: 36,
    monthlyPayment: 3321
  }
};
```

### Loan Mechanics ✅ IMPLEMENTED

```typescript
interface Loan {
  id: string;
  principal: number;
  remainingBalance: number;
  interestRate: number;
  monthlyPayment: number;
  startTime: number;
  termMonths: number;
}

const MAX_LOANS = 3;
```

**Implemented Functions:**
- ✅ `takeLoan()` - Borrow money
- ✅ `makeLoanPayment()` - Monthly payment (splits interest + principal)
- ✅ `payOffLoan()` - Early payoff
- ✅ Interest calculation (amortization schedule)

### Loan Strategy

**When to take loans:**
- Equipment purchase (immediate ROI)
- Emergency cash flow (avoid bankruptcy)
- Research acceleration
- Hiring employees when cash-strapped

**Loan risks:**
- Interest eats into profits
- Monthly payment obligations increase expenses
- **Bankruptcy risk if you can't afford payments**

---

## ❌ CUT: Financial Reports

**Removed from scope** - too much accounting complexity.

~~Income Statements, Balance Sheets~~

Players can see transaction history and categories, that's sufficient.

---

## ❌ CUT: Investment ROI Calculations

**Removed from scope** - overly complex financial modeling.

~~Equipment ROI, Facility ROI calculations~~

Players can intuit value without spreadsheet-level analysis.

---

## Economic Stages 🔨 IN SCOPE (Simplified)

### Stage 1: Survival (Months 1-6)

**Characteristics:**
- Cash-strapped, every dollar matters
- Green fees are lifeline
- Player does most work (few/no employees)

**Goals:**
- Break even monthly
- Avoid bankruptcy
- Build small cash buffer ($5k+)

**Typical finances:**
- Revenue: $3,000-5,000/month
- Expenses: $2,000-4,000/month
- Cash reserve: $0-5,000

### Stage 2: Stability (Months 6-18)

**Characteristics:**
- Consistent profitability
- First employees hired
- Small loans for growth

**Goals:**
- $10,000+ cash buffer
- Hire core team (2-3 employees)
- Research basic upgrades

**Typical finances:**
- Revenue: $10,000-20,000/month
- Expenses: $8,000-15,000/month
- Cash reserve: $5,000-20,000

### Stage 3: Growth (Months 18-36)

**Characteristics:**
- Strong profits
- Larger employee roster
- Strategic investments

**Goals:**
- Expand to 18 holes
- Achieve 4+ star prestige
- Build cash reserves

**Typical finances:**
- Revenue: $30,000-60,000/month
- Expenses: $20,000-40,000/month
- Cash reserve: $20,000-100,000

### Stage 4: Prosperity (Year 3+)

**Characteristics:**
- Highly profitable
- Large employee team
- Minimal player maintenance work

**Goals:**
- 5-star prestige
- Large cash reserves
- Complete scenarios

**Typical finances:**
- Revenue: $80,000-150,000/month
- Expenses: $50,000-100,000/month
- Cash reserve: $100,000+

---

## UI Elements

### Economy HUD ✅ IMPLEMENTED

Simple HUD showing:
- Current cash (with color coding: green > $5k, yellow $0-5k, red < $0)
- Active golfer count

**Status:** Basic implementation in `UIManager.ts`

### ⏸️ DEFERRED: Financial Dashboard

**Not implementing now** - overly detailed UI.

~~Comprehensive finances panel with income breakdown, expense categories, profit margin~~

### Bankruptcy Warning Modal 🔨 IN SCOPE

See "Bankruptcy System" section above for full design.

---

## Implementation Priority

### ✅ Phase 1: Core Economy (COMPLETE)
1. ✅ Cash tracking
2. ✅ Transaction recording
3. ✅ Basic income/expense categories
4. ✅ Simple financial display

### ✅ Phase 2: Loans (COMPLETE)
1. ✅ Loan options
2. ✅ Taking loans
3. ✅ Monthly payments
4. ✅ Interest calculation
5. ✅ Early payoff

### 🔨 Phase 3: Bankruptcy & Costs (IN PROGRESS)
1. 🔨 Bankruptcy warning at -$7,500
2. 🔨 Game over at -$10,000
3. 🔨 Refill costs (fuel, water, fertilizer)
4. ⏸️ Fixed monthly costs (insurance, property tax) - deferred

### 🔨 Phase 4: Revenue Expansion (IN SCOPE - Simplified)
1. 🔨 Prestige-based pricing modifier (+10-20% at high prestige)
2. 🔨 Pro shop revenue (simple per-golfer, 3 tiers)
3. 🔨 Pro shop staffing (efficiency multiplier)
4. 🔨 Membership system (single tier, automatic filling)
5. ⏸️ Tournament economics (dependent on tournament system)

### ❌ Phase 5: Cut Features
1. ❌ Complex dynamic pricing with demand/seasonal modifiers
2. ❌ Price elasticity modeling
3. ❌ Multi-tier membership management
4. ❌ Pro shop inventory/categories
5. ❌ Income statements & balance sheets
6. ❌ ROI calculation systems

---

## Summary

The Economy System creates meaningful financial decisions:

1. **Early game tension**: Every dollar matters, bankruptcy is real threat
2. **Mid game investment**: Spend money to make money (loans, employees, research)
3. **Late game optimization**: Maximize efficiency and margins
4. **End game wealth**: Fund ambitious projects

**Key principles:**
- Revenue must exceed expenses for survival
- Bankruptcy at -$10,000 enforces discipline
- Investment in staff/equipment enables scaling
- Loans provide growth capital but increase risk
- Financial health enables ambition

**Simplified scope:**
- Focus on core cash management with meaningful depth
- Simple, clear costs (wages, utilities, research, refills)
- Multiple revenue streams: green fees (prestige-adjusted), tips, pro shop, memberships
- Strategic trade-offs without spreadsheet complexity
- Clear feedback loops (staff pro shop = more revenue, members = stable income)
- Player learns through consequences (bankruptcy) not accounting
