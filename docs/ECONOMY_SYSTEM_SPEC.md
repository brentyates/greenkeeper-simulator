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

### ❌ CUT: Dynamic Pricing

**Removed from scope** - too complex for marginal gameplay benefit.

Static pricing is sufficient. Prestige already affects golfer volume organically.

~~Dynamic pricing factors:~~
~~- Base fee from structure~~
~~- Prestige modifier (+10% per star above 3)~~
~~- Demand modifier (crowded = higher prices acceptable)~~
~~- Seasonal modifier (peak season = higher rates)~~

### ❌ CUT: Price Elasticity

**Removed from scope** - statistical modeling not needed.

~~Higher prices = fewer golfers calculation~~

### ⏸️ DEFERRED: Membership Program

**Not implementing now** - adds complexity without clear value.

May reconsider for late-game content if needed.

~~Unlocked at 4-star prestige with Basic/Premium/Elite tiers~~

### ⏸️ DEFERRED: Pro Shop Sales

**Not implementing now** - passive income that doesn't add strategic depth.

~~Scales with golfer traffic~~

### ⏸️ DEFERRED: Tournament Revenue

**Dependent on Tournament System** - see TOURNAMENT_SYSTEM_SPEC.md

Won't implement until tournament hosting is added (if ever).

### Revenue by Game Stage 🔨 IN SCOPE (Simplified)

| Stage | Primary Revenue | Monthly Range | Notes |
|-------|-----------------|---------------|-------|
| Starter (3-hole) | Green fees only | $2,000-5,000 | Low prestige, few golfers |
| Growing (9-hole) | Green fees + tips | $8,000-15,000 | Building reputation |
| Established (18-hole) | Green fees + tips | $25,000-50,000 | 15-25% utilization |
| Premium (18-hole 5★) | Green fees + tips | $60,000-100,000 | 30-40% utilization |

**Revenue factors:**
- Tee time utilization (see TEE_TIME_SYSTEM_SPEC.md)
- Prestige/star rating (see PRESTIGE_SYSTEM_SPEC.md)
- Marketing campaigns (see TEE_TIME_SYSTEM_SPEC.md)
- Day of week (weekends busier)

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

### ⏸️ Phase 4: Advanced Revenue (DEFERRED)
1. ⏸️ Pro shop sales
2. ⏸️ Membership system
3. ⏸️ Tournament economics

### ❌ Phase 5: Cut Features
1. ❌ Dynamic pricing
2. ❌ Price elasticity
3. ❌ Income statements
4. ❌ Balance sheets
5. ❌ ROI calculations

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
- Focus on core cash management
- Simple, clear costs (wages, utilities, research)
- Predictable revenue (green fees, tips)
- No complex financial modeling
- Player learns through clear consequences (bankruptcy)
