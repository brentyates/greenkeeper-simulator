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

## Financial State

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

---

## Transaction Categories

### Income Categories

| Category | Description | Example |
|----------|-------------|---------|
| green_fees | Golfer payments | $55 for 18 holes |
| membership_dues | Member subscriptions | $200/month |
| pro_shop_sales | Merchandise revenue | $25 polo shirt |
| food_beverage | Restaurant/snacks | $8 hot dog |
| tournament_revenue | Event hosting | $50,000 sponsorship |
| lessons | Instruction fees | $75/hour lesson |
| cart_rentals | Golf cart fees | $20/round |
| driving_range | Practice facility | $10 bucket |
| sponsorships | Advertising deals | $5,000/month sign |
| loan_received | Borrowed funds | $25,000 loan |
| other_income | Miscellaneous | Tips, etc. |

### Expense Categories

| Category | Description | Example |
|----------|-------------|---------|
| employee_wages | Staff payroll | $12/hr groundskeeper |
| equipment_purchase | New equipment | $5,000 mower |
| equipment_maintenance | Repairs, upkeep | $200 blade replacement |
| supplies | Consumables | $50 fertilizer |
| utilities | Water, electric | $500/month |
| research | R&D investment | $400/month funding |
| construction | Building projects | $10,000 shed |
| loan_payment | Principal repayment | $500/month |
| loan_interest | Interest charges | $50/month |
| marketing | Advertising | $200 newspaper ad |
| insurance | Liability coverage | $300/month |
| property_tax | Land taxes | $1,000/year |
| other_expense | Miscellaneous | Misc costs |

---

## Transaction Recording

```typescript
interface Transaction {
  id: string;
  amount: number;           // Positive = income, Negative = expense
  category: TransactionCategory;
  description: string;
  timestamp: number;        // Game time
}

function recordIncome(
  state: EconomyState,
  amount: number,
  category: TransactionCategory,
  description: string,
  timestamp: number
): EconomyState {
  const transaction = {
    id: generateId(),
    amount: amount,         // Positive
    category,
    description,
    timestamp
  };

  return {
    ...state,
    cash: state.cash + amount,
    transactions: [...state.transactions, transaction],
    totalEarned: state.totalEarned + amount
  };
}

function recordExpense(
  state: EconomyState,
  amount: number,
  category: TransactionCategory,
  description: string,
  timestamp: number,
  force: boolean = false
): EconomyState | null {
  if (!force && !canAfford(state, amount)) {
    return null; // Cannot afford
  }

  const transaction = {
    id: generateId(),
    amount: -amount,        // Negative
    category,
    description,
    timestamp
  };

  return {
    ...state,
    cash: state.cash - amount,
    transactions: [...state.transactions, transaction],
    totalSpent: state.totalSpent + amount
  };
}
```

---

## Revenue Streams

**Note on Memberships:** For detailed membership tiers, benefits, and pricing, see PRESTIGE_SYSTEM_SPEC.md - Component 5: Exclusivity section. Membership revenue is a significant income source for 4-5★ courses.

### Green Fees

Primary income source, scales with prestige and golfer volume.

```typescript
interface GreenFeeStructure {
  weekday9Holes: number;     // $35 default
  weekday18Holes: number;    // $55 default
  weekend9Holes: number;     // $45 default
  weekend18Holes: number;    // $75 default
  twilight9Holes: number;    // $25 default
  twilight18Holes: number;   // $40 default
}
```

**Dynamic pricing factors:**
- Base fee from structure
- Prestige modifier (+10% per star above 3)
- Demand modifier (crowded = higher prices acceptable)
- Seasonal modifier (peak season = higher rates)

### Membership Program

Unlocked at 4-star prestige:

```typescript
interface MembershipTiers {
  basic: {
    monthlyFee: 150;
    greenFeeDiscount: 0.20;     // 20% off
    maxMembers: 100;
  };
  premium: {
    monthlyFee: 300;
    greenFeeDiscount: 0.40;     // 40% off
    priorityBooking: true;
    guestPasses: 2;
    maxMembers: 50;
  };
  elite: {
    monthlyFee: 500;
    greenFeeDiscount: 0.60;     // 60% off
    priorityBooking: true;
    guestPasses: 4;
    lockerIncluded: true;
    maxMembers: 25;
  };
}
```

**Membership value:**
- Predictable monthly income
- Higher golfer loyalty
- Word-of-mouth prestige boost
- Lower per-round revenue but guaranteed volume

### Pro Shop Sales

Scales with golfer traffic and prestige:

```typescript
interface ProShopRevenue {
  averageSpendPerGolfer: number;  // $15 base
  prestigeMultiplier: number;      // Higher prestige = more spend
  merchandiseMarkup: number;       // 40% margin
  categories: {
    apparel: 0.40;      // 40% of sales
    equipment: 0.30;    // 30% of sales
    accessories: 0.20;  // 20% of sales
    snacks: 0.10;       // 10% of sales
  };
}
```

### Tournament Revenue

See [Tournament System Spec](TOURNAMENT_SYSTEM_SPEC.md) for full details:

| Tournament Tier | Gross Revenue | Net Profit |
|-----------------|---------------|------------|
| Local Amateur | $5,500 | $2,500 |
| Regional | $35,000 | $17,000 |
| State | $117,500 | $59,500 |
| National | $384,000 | $169,000 |
| PGA Tour | $1,500,000 | $845,000 |
| Major | $5,550,000 | $3,750,000 |

### Revenue by Game Stage

| Stage | Primary Revenue | Monthly Range | Notes |
|-------|-----------------|---------------|-------|
| Starter (3-hole) | Green fees only | $2,000-5,000 | Low prestige, few golfers |
| Growing (9-hole) | Green fees + pro shop | $8,000-15,000 | Building reputation |
| Established (18-hole) | Full operations | $25,000-50,000 | 15-25% utilization |
| Premium (18-hole 5★) | All + memberships | $60,000-100,000 | 30-40% utilization |
| Resort (27+ hole) | All + tournaments | $150,000-500,000 | Higher capacity + events |

**Understanding Utilization:**
- **Theoretical Maximum:** 60 tee times/day × 4 golfers × $55 fee × 30 days = $396,000/month
- **Actual Revenue:** Depends on tee time utilization rate (see TEE_TIME_SYSTEM_SPEC.md)
- **Typical Utilization:** 15-40% depending on prestige, marketing, and seasonality
- **Example (Established 18-hole):**
  - Available: 60 slots/day × 30 days = 1,800 slots/month
  - Filled: 20% utilization = 360 slots
  - Revenue: 360 slots × 3.5 avg players × $55 = $69,300 green fees
  - Plus pro shop, cart fees, F&B = $25k-50k total range

**Key Factors Affecting Utilization:**
- Prestige/star rating (see PRESTIGE_SYSTEM_SPEC.md)
- Marketing campaigns (see TEE_TIME_SYSTEM_SPEC.md - Marketing section)
- Pricing vs tolerance (overpriced courses see turn-aways)
- Season and weather
- Day of week (weekends fill better)
- Competition from nearby courses (future feature)

---

## Operating Costs

### Fixed Costs

Monthly recurring expenses:

| Cost | Small Course | Medium Course | Large Course |
|------|--------------|---------------|--------------|
| Utilities | $300 | $800 | $2,000 |
| Insurance | $200 | $500 | $1,200 |
| Property Tax | $100 | $400 | $1,000 |
| Loan Payments | Variable | Variable | Variable |

### Variable Costs

Scale with operations:

```typescript
interface VariableCosts {
  // Per refill
  fuelCost: 10;           // $10 per mower refill
  waterCost: 5;           // $5 per sprinkler refill
  fertilizerCost: 15;     // $15 per spreader refill

  // Per employee-hour
  wageRates: Record<EmployeeRole, number>;

  // Per golfer
  servicesCost: 2;        // Towels, tees, etc.

  // Per equipment-hour
  maintenanceCost: 0.50;  // Depreciation/wear
}
```

### Cost Breakdown Example

Monthly costs for established 18-hole course:

| Category | Amount | % of Total |
|----------|--------|------------|
| Employee Wages | $15,000 | 50% |
| Supplies (fuel, fert, etc.) | $4,000 | 13% |
| Utilities | $2,000 | 7% |
| Equipment Maintenance | $3,000 | 10% |
| Insurance | $800 | 3% |
| Research Funding | $2,400 | 8% |
| Loan Payments | $2,000 | 7% |
| Other | $800 | 3% |
| **Total** | **$30,000** | 100% |

---

## Loan System

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

### Loan Mechanics

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

// Maximum concurrent loans
const MAX_LOANS = 3;

// Monthly payment splits into interest + principal
function processLoanPayment(loan: Loan): {
  interestPortion: number;
  principalPortion: number;
  newBalance: number;
} {
  const monthlyRate = loan.interestRate / 12;
  const interest = loan.remainingBalance * monthlyRate;
  const principal = loan.monthlyPayment - interest;

  return {
    interestPortion: interest,
    principalPortion: principal,
    newBalance: loan.remainingBalance - principal
  };
}
```

### Loan Strategy

**When to take loans:**
- Equipment purchase (immediate ROI)
- Facility expansion (enables growth)
- Emergency cash flow
- Research acceleration

**Loan risks:**
- Interest eats into profits
- Monthly payment obligations
- Bankruptcy risk if revenue drops

---

## Cash Flow Management

### Overdraft Protection

```typescript
const MIN_CASH_FOR_OPERATIONS = -10000; // Small overdraft allowed

function canAfford(state: EconomyState, amount: number): boolean {
  return state.cash - amount >= MIN_CASH_FOR_OPERATIONS;
}
```

### Cash Flow Projection

```typescript
interface CashFlowProjection {
  currentCash: number;
  projectedIncome: number;     // Next 30 days
  projectedExpenses: number;   // Next 30 days
  projectedBalance: number;
  warningLevel: 'healthy' | 'caution' | 'danger';
}

function projectCashFlow(
  state: EconomyState,
  dailyAverageIncome: number,
  dailyAverageExpense: number,
  days: number = 30
): CashFlowProjection {
  const projectedIncome = dailyAverageIncome * days;
  const projectedExpenses = dailyAverageExpense * days;
  const projectedBalance = state.cash + projectedIncome - projectedExpenses;

  let warningLevel: 'healthy' | 'caution' | 'danger';
  if (projectedBalance > 10000) {
    warningLevel = 'healthy';
  } else if (projectedBalance > 0) {
    warningLevel = 'caution';
  } else {
    warningLevel = 'danger';
  }

  return { currentCash: state.cash, projectedIncome, projectedExpenses, projectedBalance, warningLevel };
}
```

---

## Financial Reports

### Income Statement

```typescript
interface IncomeStatement {
  period: { start: number; end: number };

  revenue: {
    greenFees: number;
    proShop: number;
    memberships: number;
    tournaments: number;
    other: number;
    total: number;
  };

  expenses: {
    wages: number;
    supplies: number;
    utilities: number;
    maintenance: number;
    research: number;
    interest: number;
    other: number;
    total: number;
  };

  netIncome: number;
  profitMargin: number;
}
```

### Balance Sheet

```typescript
interface BalanceSheet {
  assets: {
    cash: number;
    equipment: number;       // Depreciated value
    facilities: number;      // Building value
    land: number;           // Course value
    total: number;
  };

  liabilities: {
    loans: number;          // Total debt
    accountsPayable: number;
    total: number;
  };

  equity: number;           // Assets - Liabilities
}
```

---

## Pricing Strategy

### Dynamic Pricing

```typescript
function calculateOptimalGreenFee(
  baseFee: number,
  prestige: number,           // 1-5 stars
  crowdingLevel: number,      // 0-100%
  dayType: 'weekday' | 'weekend',
  timeOfDay: 'peak' | 'offpeak' | 'twilight'
): number {
  let price = baseFee;

  // Prestige modifier (+10% per star above 3)
  const prestigeModifier = 1 + (Math.max(0, prestige - 3) * 0.10);
  price *= prestigeModifier;

  // Demand modifier
  const demandModifier = 1 + (crowdingLevel / 100) * 0.20;
  price *= demandModifier;

  // Day type
  if (dayType === 'weekend') {
    price *= 1.20;
  }

  // Time of day
  if (timeOfDay === 'twilight') {
    price *= 0.70;
  } else if (timeOfDay === 'offpeak') {
    price *= 0.90;
  }

  return Math.round(price);
}
```

### Price Elasticity

```typescript
// Higher prices = fewer golfers, but more revenue per golfer
function estimateGolferDemand(
  baseGolfers: number,
  priceVsAverage: number    // 1.0 = average, 1.2 = 20% above
): number {
  // Elasticity: 10% price increase = 8% demand decrease
  const elasticity = -0.8;
  const demandModifier = 1 + elasticity * (priceVsAverage - 1);

  return Math.max(0, baseGolfers * demandModifier);
}
```

---

## Investment Decisions

### Equipment ROI

```typescript
interface EquipmentInvestment {
  name: string;
  purchaseCost: number;
  monthlyMaintenance: number;
  laborSavings: number;       // Reduced employee hours
  qualityImprovement: number; // Prestige boost
  lifespan: number;          // Months before replacement
}

function calculateEquipmentROI(investment: EquipmentInvestment): {
  paybackMonths: number;
  totalReturn: number;
  roi: number;
} {
  const monthlyBenefit = investment.laborSavings - investment.monthlyMaintenance;
  const paybackMonths = investment.purchaseCost / monthlyBenefit;
  const totalReturn = (monthlyBenefit * investment.lifespan) - investment.purchaseCost;
  const roi = totalReturn / investment.purchaseCost;

  return { paybackMonths, totalReturn, roi };
}
```

### Facility ROI

| Facility | Cost | Monthly Revenue/Savings | Payback |
|----------|------|------------------------|---------|
| Pro Shop | $15,000 | +$2,000 revenue | 8 months |
| Driving Range | $25,000 | +$3,000 revenue | 8 months |
| Staff Building | $10,000 | +$500 savings (efficiency) | 20 months |
| Training Center | $20,000 | +$800 savings (faster training) | 25 months |
| Restaurant | $50,000 | +$5,000 revenue | 10 months |

### Research ROI

Research investments have long-term payoffs:

| Research | Cost (Points) | Funding Cost | Benefit |
|----------|---------------|--------------|---------|
| Riding Mower | 1,500 pts | $7,500 | 3x mowing speed |
| Robot Mower | 6,000 pts | $30,000 | Autonomous, 24/7 |
| Smart Irrigation | 2,000 pts | $10,000 | 40% water savings |

---

## Economic Stages

### Stage 1: Survival (Months 1-6)

**Characteristics:**
- Cash-strapped
- Every expense scrutinized
- Green fees are lifeline
- Player does most work (no wages)

**Goals:**
- Break even monthly
- Build cash buffer
- Avoid loans if possible

**Typical finances:**
- Revenue: $3,000-5,000/month
- Expenses: $2,000-4,000/month
- Cash reserve: $0-5,000

### Stage 2: Stability (Months 6-18)

**Characteristics:**
- Consistent profitability
- First employees hired
- Equipment investments
- Small loans acceptable

**Goals:**
- $10,000+ cash buffer
- Hire core team
- Research basic upgrades

**Typical finances:**
- Revenue: $10,000-20,000/month
- Expenses: $8,000-15,000/month
- Cash reserve: $5,000-20,000

### Stage 3: Growth (Months 18-36)

**Characteristics:**
- Strong profits
- Facility expansion
- Staff specialization
- Strategic loans for growth

**Goals:**
- Expand to 18 holes
- Achieve 4+ star prestige
- Build secondary revenue streams

**Typical finances:**
- Revenue: $30,000-60,000/month
- Expenses: $20,000-40,000/month
- Cash reserve: $20,000-100,000

### Stage 4: Prosperity (Year 3+)

**Characteristics:**
- Highly profitable
- Multiple revenue streams
- Minimal player work
- Tournament opportunities

**Goals:**
- 5-star prestige
- Host major events
- Consider expansion/second course

**Typical finances:**
- Revenue: $80,000-200,000/month
- Expenses: $50,000-100,000/month
- Cash reserve: $100,000+

---

## UI Elements

### Financial Dashboard

```
┌─────────────────────────────────────────────────────────────────────────┐
│  FINANCES                                              March, Year 2    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  CASH BALANCE                                                            │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │              $47,250                                             │   │
│  │              ▲ $3,420 from last month                           │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  THIS MONTH                                                              │
│  ┌───────────────────────────┐  ┌───────────────────────────────────┐ │
│  │  INCOME        $28,450    │  │  EXPENSES         $25,030         │ │
│  │  ─────────────────────    │  │  ────────────────────────         │ │
│  │  Green Fees    $18,200    │  │  Wages            $12,800         │ │
│  │  Pro Shop       $4,800    │  │  Supplies          $3,200         │ │
│  │  Memberships    $3,600    │  │  Utilities         $1,800         │ │
│  │  Driving Range  $1,850    │  │  Maintenance       $2,400         │ │
│  │                           │  │  Research          $2,400         │ │
│  │                           │  │  Loan Payment      $1,150         │ │
│  │                           │  │  Other             $1,280         │ │
│  └───────────────────────────┘  └───────────────────────────────────┘ │
│                                                                          │
│  NET PROFIT: $3,420   ████████████░░░░░░░░  Margin: 12%                │
│                                                                          │
│  LOANS                                                                   │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Medium Loan: $18,400 remaining  │  $1,150/month  │  16 mo left │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  [View Full Report]  [Take Loan]  [Pay Off Early]  [Set Prices]        │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Cash Flow Warning

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ⚠️  CASH FLOW WARNING                                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Projected cash balance in 30 days: -$2,450                             │
│                                                                          │
│  Your expenses are exceeding income. Consider:                          │
│  • Reducing staff hours                                                 │
│  • Raising green fees                                                   │
│  • Taking a loan                                                        │
│  • Reducing research funding                                            │
│                                                                          │
│  [View Details]  [Take Loan]  [Dismiss]                                │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Priority

### Phase 1: Core Economy
1. Cash tracking
2. Transaction recording
3. Basic income/expense categories
4. Simple financial display

### Phase 2: Loans
1. Loan options
2. Taking loans
3. Monthly payments
4. Interest calculation
5. Early payoff

### Phase 3: Revenue Streams
1. Green fee calculation
2. Pro shop integration
3. Dynamic pricing
4. Membership system

### Phase 4: Financial Intelligence
1. Income statements
2. Cash flow projection
3. Warning systems
4. ROI calculations

### Phase 5: Advanced Features
1. Budget planning
2. Investment analysis
3. Multiple course portfolio
4. Tournament economics

---

## Summary

The Economy System creates meaningful financial decisions:

1. **Early game tension**: Every dollar matters, survival focus
2. **Mid game investment**: Spend money to make money
3. **Late game optimization**: Maximize efficiency and margins
4. **End game wealth**: Fund ambitious projects and legacy

Key principles:
- Revenue must exceed expenses for survival
- Investment in staff/equipment enables scaling
- Multiple revenue streams reduce risk
- Financial health enables ambition
