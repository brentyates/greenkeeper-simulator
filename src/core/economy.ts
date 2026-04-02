export type TransactionCategory =
  | "green_fees"
  | "equipment_purchase"
  | "equipment_maintenance"
  | "employee_wages"
  | "research"
  | "supplies"
  | "loan_received"
  | "loan_payment"
  | "loan_interest"
  | "construction"
  | "marketing"
  | "utilities"
  | "other_income"
  | "other_expense";

export interface Transaction {
  readonly id: string;
  readonly amount: number;
  readonly category: TransactionCategory;
  readonly description: string;
  readonly timestamp: number;
}

export interface Loan {
  readonly id: string;
  readonly principal: number;
  readonly remainingBalance: number;
  readonly interestRate: number;
  readonly monthlyPayment: number;
  readonly startTime: number;
  readonly termMonths: number;
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
  readonly totalEarned: number;
  readonly totalSpent: number;
}

interface LoanTerms {
  readonly principal: number;
  readonly interestRate: number;
  readonly termMonths: number;
}

const INCOME_CATEGORIES: readonly TransactionCategory[] = [
  "green_fees",
  "loan_received",
  "other_income"
] as const;

const EXPENSE_CATEGORIES: readonly TransactionCategory[] = [
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

const MAX_LOANS = 3;
const MIN_CASH_FOR_OPERATIONS = 0;

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

function createTransaction(
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

function createLoan(terms: LoanTerms, startTime: number): Loan {
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

function getLoanById(state: EconomyState, loanId: string): Loan | null {
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

function calculateMonthlyPayment(
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

function calculateInterestPortion(loan: Loan): number {
  const monthlyRate = loan.interestRate / 12;
  return Math.round(loan.remainingBalance * monthlyRate * 100) / 100;
}

export function calculateFinancialSummary(
  transactions: readonly Transaction[]
): FinancialSummary {
  const byCategory = {} as Record<TransactionCategory, number>;

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

export function addIncome(
  state: EconomyState,
  amount: number,
  category: TransactionCategory,
  description: string,
  timestamp: number
): EconomyState {
  if (amount <= 0) {
    return state;
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
    return null;
  }

  if (!force && !canAfford(state, amount)) {
    return null;
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
    return null;
  }

  if (terms.principal <= 0 || terms.termMonths <= 0) {
    return null;
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
    return null;
  }

  const paymentAmount = Math.min(loan.monthlyPayment, loan.remainingBalance);

  if (!canAfford(state, paymentAmount)) {
    return null;
  }

  const interestPortion = calculateInterestPortion(loan);
  const principalPortion = Math.min(
    paymentAmount - interestPortion,
    loan.remainingBalance
  );
  const actualInterest = paymentAmount - principalPortion;

  const newBalance = Math.round((loan.remainingBalance - principalPortion) * 100) / 100;

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

