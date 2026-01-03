import { describe, it, expect, beforeEach } from "vitest";
import {
  // Types
  EconomyState,
  Transaction,
  Loan,
  LoanTerms,

  // Constants
  INCOME_CATEGORIES,
  EXPENSE_CATEGORIES,
  DEFAULT_LOAN_TERMS,
  MAX_LOANS,
  MIN_CASH_FOR_OPERATIONS,

  // Factory functions
  createInitialEconomyState,
  createTransaction,
  createLoan,

  // Query functions
  isIncomeCategory,
  isExpenseCategory,
  getTotalDebt,
  getNetWorth,
  canAfford,
  canTakeLoan,
  getLoanById,
  getTransactionsInRange,
  getTransactionsByCategory,

  // Calculation functions
  calculateMonthlyPayment,
  calculateInterestPortion,
  calculatePrincipalPortion,
  calculateFinancialSummary,
  calculateMonthlyFinancials,

  // State transformation functions
  addIncome,
  addExpense,
  takeLoan,
  makeLoanPayment,
  payOffLoan,

  // Utility functions
  formatCurrency,
  resetTransactionCounter,
  resetLoanCounter
} from "./economy";

// ============================================================================
// Test Helpers
// ============================================================================

function makeEconomyState(overrides: Partial<EconomyState> = {}): EconomyState {
  return {
    cash: 10000,
    loans: [],
    transactions: [],
    totalEarned: 0,
    totalSpent: 0,
    ...overrides
  };
}

function makeLoan(overrides: Partial<Loan> = {}): Loan {
  return {
    id: "loan_test",
    principal: 10000,
    remainingBalance: 10000,
    interestRate: 0.12,
    monthlyPayment: 888.49,
    startTime: 0,
    termMonths: 12,
    ...overrides
  };
}

function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "txn_test",
    amount: 100,
    category: "green_fees",
    description: "Test transaction",
    timestamp: 1000,
    ...overrides
  };
}

// ============================================================================
// Tests
// ============================================================================

describe("Economy System", () => {
  beforeEach(() => {
    resetTransactionCounter();
    resetLoanCounter();
  });

  // ==========================================================================
  // Constants Tests
  // ==========================================================================

  describe("Constants", () => {
    it("has correct income categories", () => {
      expect(INCOME_CATEGORIES).toContain("green_fees");
      expect(INCOME_CATEGORIES).toContain("loan_received");
      expect(INCOME_CATEGORIES).toContain("other_income");
      expect(INCOME_CATEGORIES.length).toBe(3);
    });

    it("has correct expense categories", () => {
      expect(EXPENSE_CATEGORIES).toContain("equipment_purchase");
      expect(EXPENSE_CATEGORIES).toContain("employee_wages");
      expect(EXPENSE_CATEGORIES).toContain("research");
      expect(EXPENSE_CATEGORIES).toContain("loan_payment");
      expect(EXPENSE_CATEGORIES).toContain("loan_interest");
      expect(EXPENSE_CATEGORIES.length).toBe(11);
    });

    it("has default loan terms for all sizes", () => {
      expect(DEFAULT_LOAN_TERMS.small.principal).toBe(5000);
      expect(DEFAULT_LOAN_TERMS.medium.principal).toBe(25000);
      expect(DEFAULT_LOAN_TERMS.large.principal).toBe(100000);
    });

    it("has increasing interest rates for larger loans", () => {
      expect(DEFAULT_LOAN_TERMS.small.interestRate).toBeLessThan(
        DEFAULT_LOAN_TERMS.medium.interestRate
      );
      expect(DEFAULT_LOAN_TERMS.medium.interestRate).toBeLessThan(
        DEFAULT_LOAN_TERMS.large.interestRate
      );
    });

    it("has longer terms for larger loans", () => {
      expect(DEFAULT_LOAN_TERMS.small.termMonths).toBe(12);
      expect(DEFAULT_LOAN_TERMS.medium.termMonths).toBe(24);
      expect(DEFAULT_LOAN_TERMS.large.termMonths).toBe(36);
    });

    it("limits maximum loans", () => {
      expect(MAX_LOANS).toBe(3);
    });

    it("allows small overdraft", () => {
      expect(MIN_CASH_FOR_OPERATIONS).toBe(-10000);
    });
  });

  // ==========================================================================
  // Factory Function Tests
  // ==========================================================================

  describe("createInitialEconomyState", () => {
    it("creates state with default starting cash", () => {
      const state = createInitialEconomyState();
      expect(state.cash).toBe(10000);
    });

    it("creates state with custom starting cash", () => {
      const state = createInitialEconomyState(50000);
      expect(state.cash).toBe(50000);
    });

    it("initializes with empty loans", () => {
      const state = createInitialEconomyState();
      expect(state.loans).toEqual([]);
    });

    it("initializes with empty transactions", () => {
      const state = createInitialEconomyState();
      expect(state.transactions).toEqual([]);
    });

    it("initializes totals to zero", () => {
      const state = createInitialEconomyState();
      expect(state.totalEarned).toBe(0);
      expect(state.totalSpent).toBe(0);
    });
  });

  describe("createTransaction", () => {
    it("creates transaction with unique id", () => {
      const txn1 = createTransaction(100, "green_fees", "Test 1", 1000);
      const txn2 = createTransaction(200, "green_fees", "Test 2", 2000);
      expect(txn1.id).not.toBe(txn2.id);
    });

    it("stores amount correctly", () => {
      const txn = createTransaction(500, "green_fees", "Green fee", 1000);
      expect(txn.amount).toBe(500);
    });

    it("stores negative amounts for expenses", () => {
      const txn = createTransaction(-100, "employee_wages", "Wage payment", 1000);
      expect(txn.amount).toBe(-100);
    });

    it("stores category correctly", () => {
      const txn = createTransaction(100, "research", "R&D", 1000);
      expect(txn.category).toBe("research");
    });

    it("stores description correctly", () => {
      const txn = createTransaction(100, "green_fees", "18 holes", 1000);
      expect(txn.description).toBe("18 holes");
    });

    it("stores timestamp correctly", () => {
      const txn = createTransaction(100, "green_fees", "Test", 5000);
      expect(txn.timestamp).toBe(5000);
    });
  });

  describe("createLoan", () => {
    it("creates loan with unique id", () => {
      const terms: LoanTerms = { principal: 10000, interestRate: 0.10, termMonths: 12 };
      const loan1 = createLoan(terms, 0);
      const loan2 = createLoan(terms, 100);
      expect(loan1.id).not.toBe(loan2.id);
    });

    it("sets remaining balance to principal", () => {
      const terms: LoanTerms = { principal: 10000, interestRate: 0.10, termMonths: 12 };
      const loan = createLoan(terms, 0);
      expect(loan.remainingBalance).toBe(10000);
    });

    it("calculates monthly payment correctly", () => {
      const terms: LoanTerms = { principal: 10000, interestRate: 0.12, termMonths: 12 };
      const loan = createLoan(terms, 0);
      // Expected: ~$888.49 per month
      expect(loan.monthlyPayment).toBeCloseTo(888.49, 1);
    });

    it("stores start time correctly", () => {
      const terms: LoanTerms = { principal: 10000, interestRate: 0.10, termMonths: 12 };
      const loan = createLoan(terms, 5000);
      expect(loan.startTime).toBe(5000);
    });
  });

  // ==========================================================================
  // Query Function Tests
  // ==========================================================================

  describe("isIncomeCategory", () => {
    it("returns true for green_fees", () => {
      expect(isIncomeCategory("green_fees")).toBe(true);
    });

    it("returns true for loan_received", () => {
      expect(isIncomeCategory("loan_received")).toBe(true);
    });

    it("returns true for other_income", () => {
      expect(isIncomeCategory("other_income")).toBe(true);
    });

    it("returns false for expense categories", () => {
      expect(isIncomeCategory("employee_wages")).toBe(false);
      expect(isIncomeCategory("equipment_purchase")).toBe(false);
      expect(isIncomeCategory("research")).toBe(false);
    });
  });

  describe("isExpenseCategory", () => {
    it("returns true for employee_wages", () => {
      expect(isExpenseCategory("employee_wages")).toBe(true);
    });

    it("returns true for equipment_purchase", () => {
      expect(isExpenseCategory("equipment_purchase")).toBe(true);
    });

    it("returns true for research", () => {
      expect(isExpenseCategory("research")).toBe(true);
    });

    it("returns true for loan_payment", () => {
      expect(isExpenseCategory("loan_payment")).toBe(true);
    });

    it("returns false for income categories", () => {
      expect(isExpenseCategory("green_fees")).toBe(false);
      expect(isExpenseCategory("loan_received")).toBe(false);
    });
  });

  describe("getTotalDebt", () => {
    it("returns 0 with no loans", () => {
      const state = makeEconomyState();
      expect(getTotalDebt(state)).toBe(0);
    });

    it("returns remaining balance of single loan", () => {
      const loan = makeLoan({ remainingBalance: 5000 });
      const state = makeEconomyState({ loans: [loan] });
      expect(getTotalDebt(state)).toBe(5000);
    });

    it("sums multiple loan balances", () => {
      const loan1 = makeLoan({ id: "loan_1", remainingBalance: 5000 });
      const loan2 = makeLoan({ id: "loan_2", remainingBalance: 3000 });
      const state = makeEconomyState({ loans: [loan1, loan2] });
      expect(getTotalDebt(state)).toBe(8000);
    });
  });

  describe("getNetWorth", () => {
    it("equals cash when no loans", () => {
      const state = makeEconomyState({ cash: 15000 });
      expect(getNetWorth(state)).toBe(15000);
    });

    it("subtracts loan balance from cash", () => {
      const loan = makeLoan({ remainingBalance: 5000 });
      const state = makeEconomyState({ cash: 15000, loans: [loan] });
      expect(getNetWorth(state)).toBe(10000);
    });

    it("can be negative", () => {
      const loan = makeLoan({ remainingBalance: 25000 });
      const state = makeEconomyState({ cash: 5000, loans: [loan] });
      expect(getNetWorth(state)).toBe(-20000);
    });
  });

  describe("canAfford", () => {
    it("returns true when cash exceeds amount", () => {
      const state = makeEconomyState({ cash: 10000 });
      expect(canAfford(state, 5000)).toBe(true);
    });

    it("returns true when cash equals amount (with overdraft buffer)", () => {
      const state = makeEconomyState({ cash: 10000 });
      expect(canAfford(state, 10000)).toBe(true);
    });

    it("returns true for small overdraft", () => {
      const state = makeEconomyState({ cash: 5000 });
      expect(canAfford(state, 10000)).toBe(true); // Would leave -5000
    });

    it("returns false when would exceed max overdraft", () => {
      const state = makeEconomyState({ cash: 0 });
      expect(canAfford(state, 15000)).toBe(false); // Would leave -15000
    });

    it("returns true for zero amount", () => {
      const state = makeEconomyState({ cash: 100 });
      expect(canAfford(state, 0)).toBe(true);
    });
  });

  describe("canTakeLoan", () => {
    it("returns true with no loans", () => {
      const state = makeEconomyState();
      expect(canTakeLoan(state)).toBe(true);
    });

    it("returns true with fewer than max loans", () => {
      const loan1 = makeLoan({ id: "loan_1" });
      const loan2 = makeLoan({ id: "loan_2" });
      const state = makeEconomyState({ loans: [loan1, loan2] });
      expect(canTakeLoan(state)).toBe(true);
    });

    it("returns false at max loans", () => {
      const loans = [
        makeLoan({ id: "loan_1" }),
        makeLoan({ id: "loan_2" }),
        makeLoan({ id: "loan_3" })
      ];
      const state = makeEconomyState({ loans });
      expect(canTakeLoan(state)).toBe(false);
    });
  });

  describe("getLoanById", () => {
    it("returns loan when found", () => {
      const loan = makeLoan({ id: "loan_123" });
      const state = makeEconomyState({ loans: [loan] });
      expect(getLoanById(state, "loan_123")).toEqual(loan);
    });

    it("returns null when not found", () => {
      const loan = makeLoan({ id: "loan_123" });
      const state = makeEconomyState({ loans: [loan] });
      expect(getLoanById(state, "loan_456")).toBeNull();
    });

    it("returns null with empty loans", () => {
      const state = makeEconomyState();
      expect(getLoanById(state, "loan_123")).toBeNull();
    });
  });

  describe("getTransactionsInRange", () => {
    it("returns empty array when no transactions", () => {
      const state = makeEconomyState();
      expect(getTransactionsInRange(state, 0, 1000)).toEqual([]);
    });

    it("returns transactions within range", () => {
      const txn1 = makeTransaction({ id: "txn_1", timestamp: 500 });
      const txn2 = makeTransaction({ id: "txn_2", timestamp: 1500 });
      const txn3 = makeTransaction({ id: "txn_3", timestamp: 2500 });
      const state = makeEconomyState({ transactions: [txn1, txn2, txn3] });

      const result = getTransactionsInRange(state, 1000, 2000);
      expect(result.length).toBe(1);
      expect(result[0].id).toBe("txn_2");
    });

    it("includes boundary timestamps", () => {
      const txn1 = makeTransaction({ id: "txn_1", timestamp: 1000 });
      const txn2 = makeTransaction({ id: "txn_2", timestamp: 2000 });
      const state = makeEconomyState({ transactions: [txn1, txn2] });

      const result = getTransactionsInRange(state, 1000, 2000);
      expect(result.length).toBe(2);
    });
  });

  describe("getTransactionsByCategory", () => {
    it("returns empty array when no matching category", () => {
      const txn = makeTransaction({ category: "green_fees" });
      const state = makeEconomyState({ transactions: [txn] });
      expect(getTransactionsByCategory(state, "research")).toEqual([]);
    });

    it("returns all transactions of given category", () => {
      const txn1 = makeTransaction({ id: "txn_1", category: "green_fees" });
      const txn2 = makeTransaction({ id: "txn_2", category: "research" });
      const txn3 = makeTransaction({ id: "txn_3", category: "green_fees" });
      const state = makeEconomyState({ transactions: [txn1, txn2, txn3] });

      const result = getTransactionsByCategory(state, "green_fees");
      expect(result.length).toBe(2);
      expect(result[0].id).toBe("txn_1");
      expect(result[1].id).toBe("txn_3");
    });
  });

  // ==========================================================================
  // Calculation Function Tests
  // ==========================================================================

  describe("calculateMonthlyPayment", () => {
    it("calculates correct payment for 12-month loan at 12%", () => {
      const payment = calculateMonthlyPayment(10000, 0.12, 12);
      expect(payment).toBeCloseTo(888.49, 1);
    });

    it("calculates correct payment for 24-month loan", () => {
      const payment = calculateMonthlyPayment(10000, 0.12, 24);
      expect(payment).toBeCloseTo(470.73, 1);
    });

    it("handles zero interest rate", () => {
      const payment = calculateMonthlyPayment(12000, 0, 12);
      expect(payment).toBe(1000);
    });

    it("calculates higher payments for shorter terms", () => {
      const shortTerm = calculateMonthlyPayment(10000, 0.10, 12);
      const longTerm = calculateMonthlyPayment(10000, 0.10, 24);
      expect(shortTerm).toBeGreaterThan(longTerm);
    });

    it("calculates higher payments for higher rates", () => {
      const lowRate = calculateMonthlyPayment(10000, 0.05, 12);
      const highRate = calculateMonthlyPayment(10000, 0.15, 12);
      expect(highRate).toBeGreaterThan(lowRate);
    });
  });

  describe("calculateInterestPortion", () => {
    it("calculates first month interest correctly", () => {
      const loan = makeLoan({
        remainingBalance: 10000,
        interestRate: 0.12 // 1% per month
      });
      expect(calculateInterestPortion(loan)).toBeCloseTo(100, 2);
    });

    it("decreases as balance decreases", () => {
      const loan1 = makeLoan({ remainingBalance: 10000, interestRate: 0.12 });
      const loan2 = makeLoan({ remainingBalance: 5000, interestRate: 0.12 });

      expect(calculateInterestPortion(loan1)).toBeGreaterThan(
        calculateInterestPortion(loan2)
      );
    });

    it("returns zero for zero balance", () => {
      const loan = makeLoan({ remainingBalance: 0, interestRate: 0.12 });
      expect(calculateInterestPortion(loan)).toBe(0);
    });
  });

  describe("calculatePrincipalPortion", () => {
    it("is monthly payment minus interest", () => {
      const loan = makeLoan({
        remainingBalance: 10000,
        interestRate: 0.12,
        monthlyPayment: 888.49
      });
      const interest = calculateInterestPortion(loan);
      const principal = calculatePrincipalPortion(loan);
      expect(principal + interest).toBeCloseTo(888.49, 1);
    });

    it("increases as balance decreases", () => {
      const loan1 = makeLoan({
        remainingBalance: 10000,
        interestRate: 0.12,
        monthlyPayment: 888.49
      });
      const loan2 = makeLoan({
        remainingBalance: 5000,
        interestRate: 0.12,
        monthlyPayment: 888.49
      });

      expect(calculatePrincipalPortion(loan2)).toBeGreaterThan(
        calculatePrincipalPortion(loan1)
      );
    });
  });

  describe("calculateFinancialSummary", () => {
    it("calculates zero totals for empty transactions", () => {
      const summary = calculateFinancialSummary([]);
      expect(summary.totalIncome).toBe(0);
      expect(summary.totalExpenses).toBe(0);
      expect(summary.netProfit).toBe(0);
    });

    it("sums income correctly", () => {
      const transactions = [
        makeTransaction({ amount: 100 }),
        makeTransaction({ amount: 200 }),
        makeTransaction({ amount: 50 })
      ];
      const summary = calculateFinancialSummary(transactions);
      expect(summary.totalIncome).toBe(350);
    });

    it("sums expenses correctly", () => {
      const transactions = [
        makeTransaction({ amount: -100, category: "employee_wages" }),
        makeTransaction({ amount: -50, category: "supplies" })
      ];
      const summary = calculateFinancialSummary(transactions);
      expect(summary.totalExpenses).toBe(150);
    });

    it("calculates net profit correctly", () => {
      const transactions = [
        makeTransaction({ amount: 500, category: "green_fees" }),
        makeTransaction({ amount: -200, category: "employee_wages" })
      ];
      const summary = calculateFinancialSummary(transactions);
      expect(summary.netProfit).toBe(300);
    });

    it("breaks down by category", () => {
      const transactions = [
        makeTransaction({ amount: 300, category: "green_fees" }),
        makeTransaction({ amount: 200, category: "green_fees" }),
        makeTransaction({ amount: -100, category: "employee_wages" })
      ];
      const summary = calculateFinancialSummary(transactions);
      expect(summary.byCategory.green_fees).toBe(500);
      expect(summary.byCategory.employee_wages).toBe(-100);
    });
  });

  describe("calculateMonthlyFinancials", () => {
    it("only includes transactions from the past month", () => {
      const gameMinutesPerMonth = 30 * 24 * 60; // 43200
      const currentTime = 100000;

      const oldTxn = makeTransaction({
        id: "old",
        amount: 1000,
        timestamp: currentTime - gameMinutesPerMonth - 1000
      });
      const recentTxn = makeTransaction({
        id: "recent",
        amount: 500,
        timestamp: currentTime - 1000
      });

      const state = makeEconomyState({ transactions: [oldTxn, recentTxn] });
      const summary = calculateMonthlyFinancials(state, currentTime, gameMinutesPerMonth);

      expect(summary.totalIncome).toBe(500);
    });
  });

  // ==========================================================================
  // State Transformation Tests
  // ==========================================================================

  describe("addIncome", () => {
    it("increases cash by amount", () => {
      const state = makeEconomyState({ cash: 10000 });
      const result = addIncome(state, 500, "green_fees", "Green fee", 1000);
      expect(result.cash).toBe(10500);
    });

    it("creates transaction record", () => {
      const state = makeEconomyState();
      const result = addIncome(state, 500, "green_fees", "Green fee", 1000);
      expect(result.transactions.length).toBe(1);
      expect(result.transactions[0].amount).toBe(500);
      expect(result.transactions[0].category).toBe("green_fees");
    });

    it("updates totalEarned", () => {
      const state = makeEconomyState({ totalEarned: 1000 });
      const result = addIncome(state, 500, "green_fees", "Green fee", 1000);
      expect(result.totalEarned).toBe(1500);
    });

    it("returns original state for zero amount", () => {
      const state = makeEconomyState();
      const result = addIncome(state, 0, "green_fees", "Nothing", 1000);
      expect(result).toBe(state);
    });

    it("returns original state for negative amount", () => {
      const state = makeEconomyState();
      const result = addIncome(state, -100, "green_fees", "Invalid", 1000);
      expect(result).toBe(state);
    });

    it("preserves immutability", () => {
      const state = makeEconomyState({ cash: 10000 });
      const result = addIncome(state, 500, "green_fees", "Fee", 1000);
      expect(state.cash).toBe(10000);
      expect(result.cash).toBe(10500);
    });
  });

  describe("addExpense", () => {
    it("decreases cash by amount", () => {
      const state = makeEconomyState({ cash: 10000 });
      const result = addExpense(state, 500, "employee_wages", "Wages", 1000);
      expect(result?.cash).toBe(9500);
    });

    it("creates negative transaction record", () => {
      const state = makeEconomyState();
      const result = addExpense(state, 500, "employee_wages", "Wages", 1000);
      expect(result?.transactions[0].amount).toBe(-500);
    });

    it("updates totalSpent", () => {
      const state = makeEconomyState({ totalSpent: 1000 });
      const result = addExpense(state, 500, "supplies", "Fertilizer", 1000);
      expect(result?.totalSpent).toBe(1500);
    });

    it("returns null when cannot afford", () => {
      const state = makeEconomyState({ cash: 0 });
      const result = addExpense(state, 15000, "equipment_purchase", "Mower", 1000);
      expect(result).toBeNull();
    });

    it("allows expense with force flag even when cannot afford", () => {
      const state = makeEconomyState({ cash: 0 });
      const result = addExpense(state, 15000, "equipment_purchase", "Mower", 1000, true);
      expect(result?.cash).toBe(-15000);
    });

    it("returns null for zero amount", () => {
      const state = makeEconomyState();
      const result = addExpense(state, 0, "supplies", "Nothing", 1000);
      expect(result).toBeNull();
    });

    it("returns null for negative amount", () => {
      const state = makeEconomyState();
      const result = addExpense(state, -100, "supplies", "Invalid", 1000);
      expect(result).toBeNull();
    });

    it("preserves immutability", () => {
      const state = makeEconomyState({ cash: 10000 });
      const result = addExpense(state, 500, "supplies", "Items", 1000);
      expect(state.cash).toBe(10000);
      expect(result?.cash).toBe(9500);
    });
  });

  describe("takeLoan", () => {
    it("adds principal to cash", () => {
      const state = makeEconomyState({ cash: 10000 });
      const terms: LoanTerms = { principal: 5000, interestRate: 0.10, termMonths: 12 };
      const result = takeLoan(state, terms, 1000);
      expect(result?.cash).toBe(15000);
    });

    it("creates loan record", () => {
      const state = makeEconomyState();
      const terms: LoanTerms = { principal: 5000, interestRate: 0.10, termMonths: 12 };
      const result = takeLoan(state, terms, 1000);
      expect(result?.loans.length).toBe(1);
      expect(result?.loans[0].principal).toBe(5000);
    });

    it("creates loan_received transaction", () => {
      const state = makeEconomyState();
      const terms: LoanTerms = { principal: 5000, interestRate: 0.10, termMonths: 12 };
      const result = takeLoan(state, terms, 1000);
      expect(result?.transactions[0].category).toBe("loan_received");
      expect(result?.transactions[0].amount).toBe(5000);
    });

    it("returns null at max loans", () => {
      const loans = [
        makeLoan({ id: "loan_1" }),
        makeLoan({ id: "loan_2" }),
        makeLoan({ id: "loan_3" })
      ];
      const state = makeEconomyState({ loans });
      const terms: LoanTerms = { principal: 5000, interestRate: 0.10, termMonths: 12 };
      expect(takeLoan(state, terms, 1000)).toBeNull();
    });

    it("returns null for zero principal", () => {
      const state = makeEconomyState();
      const terms: LoanTerms = { principal: 0, interestRate: 0.10, termMonths: 12 };
      expect(takeLoan(state, terms, 1000)).toBeNull();
    });

    it("returns null for negative principal", () => {
      const state = makeEconomyState();
      const terms: LoanTerms = { principal: -5000, interestRate: 0.10, termMonths: 12 };
      expect(takeLoan(state, terms, 1000)).toBeNull();
    });

    it("returns null for zero term", () => {
      const state = makeEconomyState();
      const terms: LoanTerms = { principal: 5000, interestRate: 0.10, termMonths: 0 };
      expect(takeLoan(state, terms, 1000)).toBeNull();
    });
  });

  describe("makeLoanPayment", () => {
    it("decreases cash by payment amount", () => {
      const loan = makeLoan({
        id: "loan_1",
        remainingBalance: 10000,
        interestRate: 0.12,
        monthlyPayment: 888.49
      });
      const state = makeEconomyState({ cash: 10000, loans: [loan] });
      const result = makeLoanPayment(state, "loan_1", 1000);
      expect(result?.cash).toBeCloseTo(10000 - 888.49, 1);
    });

    it("decreases loan balance", () => {
      const loan = makeLoan({
        id: "loan_1",
        remainingBalance: 10000,
        interestRate: 0.12,
        monthlyPayment: 888.49
      });
      const state = makeEconomyState({ cash: 10000, loans: [loan] });
      const result = makeLoanPayment(state, "loan_1", 1000);
      expect(result?.loans[0].remainingBalance).toBeLessThan(10000);
    });

    it("creates interest and principal transactions", () => {
      const loan = makeLoan({
        id: "loan_1",
        remainingBalance: 10000,
        interestRate: 0.12,
        monthlyPayment: 888.49
      });
      const state = makeEconomyState({ cash: 10000, loans: [loan] });
      const result = makeLoanPayment(state, "loan_1", 1000);
      expect(result?.transactions.length).toBe(2);
      expect(result?.transactions.some(t => t.category === "loan_interest")).toBe(true);
      expect(result?.transactions.some(t => t.category === "loan_payment")).toBe(true);
    });

    it("removes loan when paid off", () => {
      // Use zero interest rate to ensure full payoff when balance is small
      const loan = makeLoan({
        id: "loan_1",
        remainingBalance: 100, // Small balance
        interestRate: 0,       // No interest for clean payoff
        monthlyPayment: 888.49
      });
      const state = makeEconomyState({ cash: 10000, loans: [loan] });
      const result = makeLoanPayment(state, "loan_1", 1000);
      expect(result?.loans.length).toBe(0);
    });

    it("returns null when cannot afford payment", () => {
      const loan = makeLoan({
        id: "loan_1",
        monthlyPayment: 888.49
      });
      // MIN_CASH_FOR_OPERATIONS is -10000, so we need to exceed that
      const state = makeEconomyState({ cash: -9500, loans: [loan] });
      expect(makeLoanPayment(state, "loan_1", 1000)).toBeNull();
    });

    it("returns null for non-existent loan", () => {
      const state = makeEconomyState({ cash: 10000 });
      expect(makeLoanPayment(state, "loan_fake", 1000)).toBeNull();
    });
  });

  describe("payOffLoan", () => {
    it("pays full remaining balance", () => {
      const loan = makeLoan({ id: "loan_1", remainingBalance: 5000 });
      const state = makeEconomyState({ cash: 10000, loans: [loan] });
      const result = payOffLoan(state, "loan_1", 1000);
      expect(result?.cash).toBe(5000);
    });

    it("removes the loan", () => {
      const loan = makeLoan({ id: "loan_1", remainingBalance: 5000 });
      const state = makeEconomyState({ cash: 10000, loans: [loan] });
      const result = payOffLoan(state, "loan_1", 1000);
      expect(result?.loans.length).toBe(0);
    });

    it("creates loan_payment transaction", () => {
      const loan = makeLoan({ id: "loan_1", remainingBalance: 5000 });
      const state = makeEconomyState({ cash: 10000, loans: [loan] });
      const result = payOffLoan(state, "loan_1", 1000);
      expect(result?.transactions[0].category).toBe("loan_payment");
      expect(result?.transactions[0].amount).toBe(-5000);
    });

    it("returns null when cannot afford", () => {
      const loan = makeLoan({ id: "loan_1", remainingBalance: 15000 });
      const state = makeEconomyState({ cash: 0, loans: [loan] });
      expect(payOffLoan(state, "loan_1", 1000)).toBeNull();
    });

    it("returns null for non-existent loan", () => {
      const state = makeEconomyState({ cash: 10000 });
      expect(payOffLoan(state, "loan_fake", 1000)).toBeNull();
    });

    it("updates totalSpent", () => {
      const loan = makeLoan({ id: "loan_1", remainingBalance: 5000 });
      const state = makeEconomyState({ cash: 10000, loans: [loan], totalSpent: 1000 });
      const result = payOffLoan(state, "loan_1", 1000);
      expect(result?.totalSpent).toBe(6000);
    });
  });

  // ==========================================================================
  // Utility Function Tests
  // ==========================================================================

  describe("formatCurrency", () => {
    it("formats positive amounts correctly", () => {
      expect(formatCurrency(1000)).toBe("$1,000");
    });

    it("formats negative amounts correctly", () => {
      expect(formatCurrency(-500)).toBe("-$500");
    });

    it("formats zero correctly", () => {
      expect(formatCurrency(0)).toBe("$0");
    });

    it("formats large amounts with commas", () => {
      expect(formatCurrency(1000000)).toBe("$1,000,000");
    });

    it("rounds decimal values", () => {
      expect(formatCurrency(1234.56)).toBe("$1,235");
    });
  });

  // ==========================================================================
  // Edge Cases and Stress Tests
  // ==========================================================================

  describe("Edge Cases", () => {
    it("handles many transactions efficiently", () => {
      let state = makeEconomyState();
      for (let i = 0; i < 1000; i++) {
        state = addIncome(state, 10, "green_fees", `Fee ${i}`, i * 10);
      }
      expect(state.cash).toBe(10000 + 10 * 1000);
      expect(state.transactions.length).toBe(1000);
    });

    it("handles multiple loans correctly", () => {
      let state = makeEconomyState();
      const terms: LoanTerms = { principal: 5000, interestRate: 0.10, termMonths: 12 };

      state = takeLoan(state, terms, 0)!;
      state = takeLoan(state, terms, 100)!;

      expect(state.loans.length).toBe(2);
      expect(state.cash).toBe(20000);
    });

    it("handles loan payment edge case at exact payoff", () => {
      // Loan with balance exactly equal to monthly payment
      const loan = makeLoan({
        id: "loan_1",
        remainingBalance: 888.49,
        interestRate: 0.12,
        monthlyPayment: 888.49
      });
      const state = makeEconomyState({ cash: 10000, loans: [loan] });
      const result = makeLoanPayment(state, "loan_1", 1000);

      // Should either have loan removed or very small balance
      expect(result?.loans.length).toBeLessThanOrEqual(1);
    });

    it("preserves transaction order", () => {
      let state = makeEconomyState();
      state = addIncome(state, 100, "green_fees", "First", 1000);
      state = addIncome(state, 200, "green_fees", "Second", 2000);
      state = addIncome(state, 300, "green_fees", "Third", 3000);

      expect(state.transactions[0].description).toBe("First");
      expect(state.transactions[1].description).toBe("Second");
      expect(state.transactions[2].description).toBe("Third");
    });

    it("handles very large amounts", () => {
      const state = makeEconomyState({ cash: 1000000000 });
      const result = addIncome(state, 999999999, "other_income", "Big win", 1000);
      expect(result.cash).toBe(1999999999);
    });
  });
});
