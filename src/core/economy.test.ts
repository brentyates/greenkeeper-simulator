import { describe, it, expect } from "vitest";
import {
  EconomyState,
  Transaction,
  Loan,

  DEFAULT_LOAN_TERMS,

  createInitialEconomyState,

  getTotalDebt,
  getNetWorth,
  canAfford,
  canTakeLoan,
  getTransactionsInRange,

  calculateFinancialSummary,

  addIncome,
  addExpense,
  takeLoan,
  makeLoanPayment,
  payOffLoan,
} from "./economy";

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

describe("Economy System", () => {

  describe("DEFAULT_LOAN_TERMS", () => {
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
  });

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

    it("returns true when cash equals amount", () => {
      const state = makeEconomyState({ cash: 10000 });
      expect(canAfford(state, 10000)).toBe(true);
    });

    it("returns false when expense would overdraw cash", () => {
      const state = makeEconomyState({ cash: 5000 });
      expect(canAfford(state, 10000)).toBe(false);
    });

    it("returns false when cash is insufficient", () => {
      const state = makeEconomyState({ cash: 0 });
      expect(canAfford(state, 15000)).toBe(false);
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
      const terms ={ principal: 5000, interestRate: 0.10, termMonths: 12 };
      const result = takeLoan(state, terms, 1000);
      expect(result?.cash).toBe(15000);
    });

    it("creates loan record", () => {
      const state = makeEconomyState();
      const terms ={ principal: 5000, interestRate: 0.10, termMonths: 12 };
      const result = takeLoan(state, terms, 1000);
      expect(result?.loans.length).toBe(1);
      expect(result?.loans[0].principal).toBe(5000);
    });

    it("creates loan_received transaction", () => {
      const state = makeEconomyState();
      const terms ={ principal: 5000, interestRate: 0.10, termMonths: 12 };
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
      const terms ={ principal: 5000, interestRate: 0.10, termMonths: 12 };
      expect(takeLoan(state, terms, 1000)).toBeNull();
    });

    it("returns null for zero principal", () => {
      const state = makeEconomyState();
      const terms ={ principal: 0, interestRate: 0.10, termMonths: 12 };
      expect(takeLoan(state, terms, 1000)).toBeNull();
    });

    it("returns null for negative principal", () => {
      const state = makeEconomyState();
      const terms ={ principal: -5000, interestRate: 0.10, termMonths: 12 };
      expect(takeLoan(state, terms, 1000)).toBeNull();
    });

    it("returns null for zero term", () => {
      const state = makeEconomyState();
      const terms ={ principal: 5000, interestRate: 0.10, termMonths: 0 };
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
      const loan = makeLoan({
        id: "loan_1",
        remainingBalance: 100,
        interestRate: 0,
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
      const state = makeEconomyState({ cash: -9500, loans: [loan] });
      expect(makeLoanPayment(state, "loan_1", 1000)).toBeNull();
    });

    it("returns null for non-existent loan", () => {
      const state = makeEconomyState({ cash: 10000 });
      expect(makeLoanPayment(state, "loan_fake", 1000)).toBeNull();
    });

    it("preserves other loans when paying one", () => {
      const loan1 = makeLoan({ id: "loan_1", remainingBalance: 10000, interestRate: 0.12, monthlyPayment: 888.49 });
      const loan2 = makeLoan({ id: "loan_2", remainingBalance: 5000, interestRate: 0.10, monthlyPayment: 500 });
      const state = makeEconomyState({ cash: 10000, loans: [loan1, loan2] });
      const result = makeLoanPayment(state, "loan_1", 1000);
      expect(result?.loans.length).toBe(2);
      expect(result?.loans.find(l => l.id === "loan_2")?.remainingBalance).toBe(5000);
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
      const terms ={ principal: 5000, interestRate: 0.10, termMonths: 12 };

      state = takeLoan(state, terms, 0)!;
      state = takeLoan(state, terms, 100)!;

      expect(state.loans.length).toBe(2);
      expect(state.cash).toBe(20000);
    });

    it("handles loan payment edge case at exact payoff", () => {
      const loan = makeLoan({
        id: "loan_1",
        remainingBalance: 888.49,
        interestRate: 0.12,
        monthlyPayment: 888.49
      });
      const state = makeEconomyState({ cash: 10000, loans: [loan] });
      const result = makeLoanPayment(state, "loan_1", 1000);

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
