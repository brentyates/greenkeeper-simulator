/**
 * Economy System - Core money management for the golf course simulator
 *
 * Similar to RollerCoaster Tycoon's economy system:
 * - Track cash balance and loans
 * - Record all transactions with categories
 * - Calculate income/expenses over time periods
 * - Support for loans with interest
 */

// ============================================================================
// Types
// ============================================================================

export type TransactionCategory =
  | "green_fees"           // Income from golfers
  | "equipment_purchase"   // Buying new equipment
  | "equipment_maintenance"// Repairs and upkeep
  | "employee_wages"       // Paying staff
  | "research"             // R&D spending
  | "supplies"             // Fertilizer, fuel, seeds, etc.
  | "loan_received"        // Taking out a loan
  | "loan_payment"         // Paying back principal
  | "loan_interest"        // Interest payments
  | "construction"         // Building/terrain changes
  | "marketing"            // Advertising and promotions
  | "utilities"            // Water, electricity
  | "other_income"         // Misc income
  | "other_expense";       // Misc expenses

export interface Transaction {
  readonly id: string;
  readonly amount: number;        // Positive for income, negative for expense
  readonly category: TransactionCategory;
  readonly description: string;
  readonly timestamp: number;     // Game time in minutes
}

export interface Loan {
  readonly id: string;
  readonly principal: number;     // Original loan amount
  readonly remainingBalance: number;
  readonly interestRate: number;  // Annual rate as decimal (0.10 = 10%)
  readonly monthlyPayment: number;
  readonly startTime: number;     // Game time when loan was taken
  readonly termMonths: number;    // Loan duration
}

export interface FinancialSummary {
  readonly totalIncome: number;
  readonly totalExpenses: number;
  readonly netProfit: number;
  readonly byCategory: Record<TransactionCategory, number>;
}

export interface EconomyState {
  readonly cash: number;
  readonly loans: readonly Loan[];
  readonly transactions: readonly Transaction[];
  readonly totalEarned: number;   // Lifetime earnings
  readonly totalSpent: number;    // Lifetime spending
}

export interface LoanTerms {
  readonly principal: number;
  readonly interestRate: number;
  readonly termMonths: number;
}

// ============================================================================
// Constants
// ============================================================================

export const INCOME_CATEGORIES: readonly TransactionCategory[] = [
  "green_fees",
  "loan_received",
  "other_income"
] as const;

export const EXPENSE_CATEGORIES: readonly TransactionCategory[] = [
  "equipment_purchase",
  "equipment_maintenance",
  "employee_wages",
  "research",
  "supplies",
  "loan_payment",
  "loan_interest",
  "construction",
  "marketing",
  "utilities",
  "other_expense"
] as const;

export const DEFAULT_LOAN_TERMS: Record<"small" | "medium" | "large", LoanTerms> = {
  small: { principal: 5000, interestRate: 0.08, termMonths: 12 },
  medium: { principal: 25000, interestRate: 0.10, termMonths: 24 },
  large: { principal: 100000, interestRate: 0.12, termMonths: 36 }
};

export const MAX_LOANS = 3;
export const MIN_CASH_FOR_OPERATIONS = -10000; // Allow small overdraft

// ============================================================================
// Factory Functions
// ============================================================================

let transactionIdCounter = 0;
let loanIdCounter = 0;

export function createInitialEconomyState(startingCash: number = 10000): EconomyState {
  return {
    cash: startingCash,
    loans: [],
    transactions: [],
    totalEarned: 0,
    totalSpent: 0
  };
}

export function createTransaction(
  amount: number,
  category: TransactionCategory,
  description: string,
  timestamp: number
): Transaction {
  return {
    id: `txn_${++transactionIdCounter}`,
    amount,
    category,
    description,
    timestamp
  };
}

export function createLoan(terms: LoanTerms, startTime: number): Loan {
  const monthlyPayment = calculateMonthlyPayment(
    terms.principal,
    terms.interestRate,
    terms.termMonths
  );

  return {
    id: `loan_${++loanIdCounter}`,
    principal: terms.principal,
    remainingBalance: terms.principal,
    interestRate: terms.interestRate,
    monthlyPayment,
    startTime,
    termMonths: terms.termMonths
  };
}

// ============================================================================
// Query Functions
// ============================================================================

export function isIncomeCategory(category: TransactionCategory): boolean {
  return (INCOME_CATEGORIES as readonly string[]).includes(category);
}

export function isExpenseCategory(category: TransactionCategory): boolean {
  return (EXPENSE_CATEGORIES as readonly string[]).includes(category);
}

export function getTotalDebt(state: EconomyState): number {
  return state.loans.reduce((sum, loan) => sum + loan.remainingBalance, 0);
}

export function getNetWorth(state: EconomyState): number {
  return state.cash - getTotalDebt(state);
}

export function canAfford(state: EconomyState, amount: number): boolean {
  return state.cash - amount >= MIN_CASH_FOR_OPERATIONS;
}

export function canTakeLoan(state: EconomyState): boolean {
  return state.loans.length < MAX_LOANS;
}

export function getLoanById(state: EconomyState, loanId: string): Loan | null {
  return state.loans.find(l => l.id === loanId) ?? null;
}

export function getTransactionsInRange(
  state: EconomyState,
  startTime: number,
  endTime: number
): readonly Transaction[] {
  return state.transactions.filter(
    t => t.timestamp >= startTime && t.timestamp <= endTime
  );
}

export function getTransactionsByCategory(
  state: EconomyState,
  category: TransactionCategory
): readonly Transaction[] {
  return state.transactions.filter(t => t.category === category);
}

// ============================================================================
// Calculation Functions
// ============================================================================

export function calculateMonthlyPayment(
  principal: number,
  annualRate: number,
  termMonths: number
): number {
  if (annualRate === 0) {
    return principal / termMonths;
  }

  const monthlyRate = annualRate / 12;
  const numerator = principal * monthlyRate * Math.pow(1 + monthlyRate, termMonths);
  const denominator = Math.pow(1 + monthlyRate, termMonths) - 1;

  return Math.round((numerator / denominator) * 100) / 100;
}

export function calculateInterestPortion(loan: Loan): number {
  const monthlyRate = loan.interestRate / 12;
  return Math.round(loan.remainingBalance * monthlyRate * 100) / 100;
}

export function calculatePrincipalPortion(loan: Loan): number {
  const interest = calculateInterestPortion(loan);
  return Math.round((loan.monthlyPayment - interest) * 100) / 100;
}

export function calculateFinancialSummary(
  transactions: readonly Transaction[]
): FinancialSummary {
  const byCategory = {} as Record<TransactionCategory, number>;

  // Initialize all categories to 0
  for (const cat of [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES]) {
    byCategory[cat] = 0;
  }

  let totalIncome = 0;
  let totalExpenses = 0;

  for (const txn of transactions) {
    byCategory[txn.category] = (byCategory[txn.category] || 0) + txn.amount;

    if (txn.amount > 0) {
      totalIncome += txn.amount;
    } else {
      totalExpenses += Math.abs(txn.amount);
    }
  }

  return {
    totalIncome,
    totalExpenses,
    netProfit: totalIncome - totalExpenses,
    byCategory
  };
}

export function calculateMonthlyFinancials(
  state: EconomyState,
  currentGameTime: number,
  gameMinutesPerMonth: number = 30 * 24 * 60 // 30 days
): FinancialSummary {
  const monthStart = currentGameTime - gameMinutesPerMonth;
  const transactions = getTransactionsInRange(state, monthStart, currentGameTime);
  return calculateFinancialSummary(transactions);
}

// ============================================================================
// State Transformation Functions
// ============================================================================

export function addIncome(
  state: EconomyState,
  amount: number,
  category: TransactionCategory,
  description: string,
  timestamp: number
): EconomyState {
  if (amount <= 0) {
    return state; // Invalid income amount
  }

  const transaction = createTransaction(amount, category, description, timestamp);

  return {
    ...state,
    cash: state.cash + amount,
    transactions: [...state.transactions, transaction],
    totalEarned: state.totalEarned + amount
  };
}

export function addExpense(
  state: EconomyState,
  amount: number,
  category: TransactionCategory,
  description: string,
  timestamp: number,
  force: boolean = false
): EconomyState | null {
  if (amount <= 0) {
    return null; // Invalid expense amount
  }

  if (!force && !canAfford(state, amount)) {
    return null; // Can't afford this expense
  }

  const transaction = createTransaction(-amount, category, description, timestamp);

  return {
    ...state,
    cash: state.cash - amount,
    transactions: [...state.transactions, transaction],
    totalSpent: state.totalSpent + amount
  };
}

export function takeLoan(
  state: EconomyState,
  terms: LoanTerms,
  timestamp: number
): EconomyState | null {
  if (!canTakeLoan(state)) {
    return null; // Already at max loans
  }

  if (terms.principal <= 0 || terms.termMonths <= 0) {
    return null; // Invalid loan terms
  }

  const loan = createLoan(terms, timestamp);
  const transaction = createTransaction(
    terms.principal,
    "loan_received",
    `Loan received: $${terms.principal} at ${(terms.interestRate * 100).toFixed(1)}% for ${terms.termMonths} months`,
    timestamp
  );

  return {
    ...state,
    cash: state.cash + terms.principal,
    loans: [...state.loans, loan],
    transactions: [...state.transactions, transaction],
    totalEarned: state.totalEarned + terms.principal
  };
}

export function makeLoanPayment(
  state: EconomyState,
  loanId: string,
  timestamp: number
): EconomyState | null {
  const loan = getLoanById(state, loanId);
  if (!loan) {
    return null; // Loan not found
  }

  const paymentAmount = Math.min(loan.monthlyPayment, loan.remainingBalance);

  if (!canAfford(state, paymentAmount)) {
    return null; // Can't afford payment
  }

  const interestPortion = calculateInterestPortion(loan);
  const principalPortion = Math.min(
    paymentAmount - interestPortion,
    loan.remainingBalance
  );
  const actualInterest = paymentAmount - principalPortion;

  const newBalance = Math.round((loan.remainingBalance - principalPortion) * 100) / 100;

  // Create transactions for interest and principal
  const interestTxn = createTransaction(
    -actualInterest,
    "loan_interest",
    `Loan interest payment`,
    timestamp
  );

  const principalTxn = createTransaction(
    -principalPortion,
    "loan_payment",
    `Loan principal payment`,
    timestamp
  );

  // Update or remove the loan
  let newLoans: readonly Loan[];
  if (newBalance <= 0) {
    newLoans = state.loans.filter(l => l.id !== loanId);
  } else {
    newLoans = state.loans.map(l =>
      l.id === loanId ? { ...l, remainingBalance: newBalance } : l
    );
  }

  return {
    ...state,
    cash: state.cash - paymentAmount,
    loans: newLoans,
    transactions: [...state.transactions, interestTxn, principalTxn],
    totalSpent: state.totalSpent + paymentAmount
  };
}

export function payOffLoan(
  state: EconomyState,
  loanId: string,
  timestamp: number
): EconomyState | null {
  const loan = getLoanById(state, loanId);
  if (!loan) {
    return null;
  }

  if (!canAfford(state, loan.remainingBalance)) {
    return null;
  }

  const transaction = createTransaction(
    -loan.remainingBalance,
    "loan_payment",
    `Loan paid off in full`,
    timestamp
  );

  return {
    ...state,
    cash: state.cash - loan.remainingBalance,
    loans: state.loans.filter(l => l.id !== loanId),
    transactions: [...state.transactions, transaction],
    totalSpent: state.totalSpent + loan.remainingBalance
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

export function formatCurrency(amount: number): string {
  const absAmount = Math.abs(amount);
  const formatted = absAmount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
  return amount < 0 ? `-${formatted}` : formatted;
}

export function resetTransactionCounter(): void {
  transactionIdCounter = 0;
}

export function resetLoanCounter(): void {
  loanIdCounter = 0;
}
