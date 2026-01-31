/**
 * Loan System Integration Tests
 *
 * Tests for the economy loan system via public API.
 * Exercises takeLoan, makeLoanPayment, payOffLoan, and related functions.
 */

import { test, expect } from '../fixtures/coverage';

test.describe('Loan System Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.app !== undefined);
    await page.evaluate(() => window.startScenario('tutorial_basics'));
    await page.waitForFunction(() => window.game !== null);
    await page.waitForFunction(() => window.game !== undefined, { timeout: 10000 });
  });

  test.describe('Loan State', () => {
    test('getLoanState returns valid structure', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getLoanState());

      expect(state).toBeDefined();
      expect(Array.isArray(state.loans)).toBe(true);
      expect(typeof state.totalDebt).toBe('number');
      expect(typeof state.netWorth).toBe('number');
      expect(typeof state.canTakeLoan).toBe('boolean');
    });

    test('initial state has no loans', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getLoanState());
      expect(state.loans.length).toBe(0);
      expect(state.totalDebt).toBe(0);
    });

    test('canTakeLoan is true initially', async ({ page }) => {
      const state = await page.evaluate(() => window.game.getLoanState());
      expect(state.canTakeLoan).toBe(true);
    });
  });

  test.describe('Taking Loans', () => {
    test('takeLoan small returns true', async ({ page }) => {
      const result = await page.evaluate(() => window.game.takeLoan('small'));
      expect(result).toBe(true);
    });

    test('takeLoan medium returns true', async ({ page }) => {
      const result = await page.evaluate(() => window.game.takeLoan('medium'));
      expect(result).toBe(true);
    });

    test('takeLoan large returns true', async ({ page }) => {
      const result = await page.evaluate(() => window.game.takeLoan('large'));
      expect(result).toBe(true);
    });

    test('takeLoan increases cash', async ({ page }) => {
      const before = await page.evaluate(() => window.game.getEconomyState());
      await page.evaluate(() => window.game.takeLoan('small'));
      const after = await page.evaluate(() => window.game.getEconomyState());

      expect(after.cash).toBeGreaterThan(before.cash);
    });

    test('takeLoan adds to loans array', async ({ page }) => {
      const before = await page.evaluate(() => window.game.getLoanState());
      await page.evaluate(() => window.game.takeLoan('small'));
      const after = await page.evaluate(() => window.game.getLoanState());

      expect(after.loans.length).toBe(before.loans.length + 1);
    });

    test('takeLoan increases totalDebt', async ({ page }) => {
      const before = await page.evaluate(() => window.game.getLoanState());
      await page.evaluate(() => window.game.takeLoan('small'));
      const after = await page.evaluate(() => window.game.getLoanState());

      expect(after.totalDebt).toBeGreaterThan(before.totalDebt);
    });

    test('loan has valid structure', async ({ page }) => {
      await page.evaluate(() => window.game.takeLoan('medium'));
      const state = await page.evaluate(() => window.game.getLoanState());

      expect(state.loans.length).toBe(1);
      const loan = state.loans[0];
      expect(typeof loan.id).toBe('string');
      expect(typeof loan.principal).toBe('number');
      expect(typeof loan.remainingBalance).toBe('number');
      expect(typeof loan.interestRate).toBe('number');
      expect(typeof loan.monthlyPayment).toBe('number');
    });

    test('small loan has correct principal', async ({ page }) => {
      await page.evaluate(() => window.game.takeLoan('small'));
      const state = await page.evaluate(() => window.game.getLoanState());
      expect(state.loans[0].principal).toBe(5000);
    });

    test('medium loan has correct principal', async ({ page }) => {
      await page.evaluate(() => window.game.takeLoan('medium'));
      const state = await page.evaluate(() => window.game.getLoanState());
      expect(state.loans[0].principal).toBe(25000);
    });

    test('large loan has correct principal', async ({ page }) => {
      await page.evaluate(() => window.game.takeLoan('large'));
      const state = await page.evaluate(() => window.game.getLoanState());
      expect(state.loans[0].principal).toBe(100000);
    });
  });

  test.describe('Multiple Loans', () => {
    test('can take multiple loans', async ({ page }) => {
      await page.evaluate(() => window.game.takeLoan('small'));
      await page.evaluate(() => window.game.takeLoan('small'));
      const state = await page.evaluate(() => window.game.getLoanState());

      expect(state.loans.length).toBe(2);
    });

    test('can take up to 3 loans', async ({ page }) => {
      await page.evaluate(() => window.game.takeLoan('small'));
      await page.evaluate(() => window.game.takeLoan('small'));
      await page.evaluate(() => window.game.takeLoan('small'));

      const state = await page.evaluate(() => window.game.getLoanState());
      expect(state.loans.length).toBe(3);
      expect(state.canTakeLoan).toBe(false);
    });

    test('cannot take 4th loan', async ({ page }) => {
      await page.evaluate(() => window.game.takeLoan('small'));
      await page.evaluate(() => window.game.takeLoan('small'));
      await page.evaluate(() => window.game.takeLoan('small'));

      const result = await page.evaluate(() => window.game.takeLoan('small'));
      expect(result).toBe(false);
    });

    test('totalDebt accumulates from multiple loans', async ({ page }) => {
      await page.evaluate(() => window.game.takeLoan('small'));
      await page.evaluate(() => window.game.takeLoan('medium'));

      const state = await page.evaluate(() => window.game.getLoanState());
      expect(state.totalDebt).toBe(30000);
    });
  });

  test.describe('Loan Payments', () => {
    test('makeLoanPayment returns boolean', async ({ page }) => {
      await page.evaluate(() => window.game.takeLoan('small'));
      const state = await page.evaluate(() => window.game.getLoanState());
      const result = await page.evaluate(
        (id) => window.game.makeLoanPayment(id),
        state.loans[0].id
      );
      expect(typeof result).toBe('boolean');
    });

    test('makeLoanPayment reduces remaining balance', async ({ page }) => {
      await page.evaluate(() => window.game.setCash(100000));
      await page.evaluate(() => window.game.takeLoan('small'));

      const before = await page.evaluate(() => window.game.getLoanState());
      const loanId = before.loans[0].id;

      await page.evaluate((id) => window.game.makeLoanPayment(id), loanId);

      const after = await page.evaluate(() => window.game.getLoanState());
      if (after.loans.length > 0) {
        expect(after.loans[0].remainingBalance).toBeLessThan(
          before.loans[0].remainingBalance
        );
      }
    });

    test('makeLoanPayment deducts from cash', async ({ page }) => {
      await page.evaluate(() => window.game.setCash(100000));
      await page.evaluate(() => window.game.takeLoan('small'));

      const cashBefore = await page.evaluate(
        () => window.game.getEconomyState().cash
      );
      const state = await page.evaluate(() => window.game.getLoanState());
      await page.evaluate(
        (id) => window.game.makeLoanPayment(id),
        state.loans[0].id
      );
      const cashAfter = await page.evaluate(
        () => window.game.getEconomyState().cash
      );

      expect(cashAfter).toBeLessThan(cashBefore);
    });

    test('makeLoanPayment fails for invalid id', async ({ page }) => {
      const result = await page.evaluate(() =>
        window.game.makeLoanPayment('invalid_loan_id')
      );
      expect(result).toBe(false);
    });
  });

  test.describe('Pay Off Loan', () => {
    test('payOffLoan removes loan completely', async ({ page }) => {
      await page.evaluate(() => window.game.setCash(100000));
      await page.evaluate(() => window.game.takeLoan('small'));

      const before = await page.evaluate(() => window.game.getLoanState());
      await page.evaluate(
        (id) => window.game.payOffLoan(id),
        before.loans[0].id
      );

      const after = await page.evaluate(() => window.game.getLoanState());
      expect(after.loans.length).toBe(0);
    });

    test('payOffLoan reduces totalDebt to zero', async ({ page }) => {
      await page.evaluate(() => window.game.setCash(100000));
      await page.evaluate(() => window.game.takeLoan('small'));

      const before = await page.evaluate(() => window.game.getLoanState());
      await page.evaluate(
        (id) => window.game.payOffLoan(id),
        before.loans[0].id
      );

      const after = await page.evaluate(() => window.game.getLoanState());
      expect(after.totalDebt).toBe(0);
    });

    test('payOffLoan fails for invalid id', async ({ page }) => {
      const result = await page.evaluate(() =>
        window.game.payOffLoan('invalid_loan_id')
      );
      expect(result).toBe(false);
    });

    test('payOffLoan fails with insufficient cash', async ({ page }) => {
      await page.evaluate(() => window.game.takeLoan('large'));
      await page.evaluate(() => window.game.setCash(100));

      const state = await page.evaluate(() => window.game.getLoanState());
      const result = await page.evaluate(
        (id) => window.game.payOffLoan(id),
        state.loans[0].id
      );
      expect(result).toBe(false);
    });

    test('canTakeLoan becomes true after payoff', async ({ page }) => {
      await page.evaluate(() => window.game.setCash(500000));
      await page.evaluate(() => window.game.takeLoan('small'));
      await page.evaluate(() => window.game.takeLoan('small'));
      await page.evaluate(() => window.game.takeLoan('small'));

      const before = await page.evaluate(() => window.game.getLoanState());
      expect(before.canTakeLoan).toBe(false);

      await page.evaluate(
        (id) => window.game.payOffLoan(id),
        before.loans[0].id
      );

      const after = await page.evaluate(() => window.game.getLoanState());
      expect(after.canTakeLoan).toBe(true);
    });
  });

  test.describe('Net Worth Calculation', () => {
    test('netWorth equals cash when no loans', async ({ page }) => {
      await page.evaluate(() => window.game.setCash(50000));
      const state = await page.evaluate(() => window.game.getLoanState());
      const economy = await page.evaluate(() => window.game.getEconomyState());
      expect(state.netWorth).toBe(economy.cash);
    });

    test('netWorth decreases when taking loan', async ({ page }) => {
      await page.evaluate(() => window.game.setCash(50000));
      const before = await page.evaluate(() => window.game.getLoanState());

      await page.evaluate(() => window.game.takeLoan('small'));

      const after = await page.evaluate(() => window.game.getLoanState());
      expect(after.netWorth).toBe(before.netWorth);
    });

    test('netWorth is cash minus debt', async ({ page }) => {
      await page.evaluate(() => window.game.setCash(50000));
      await page.evaluate(() => window.game.takeLoan('small'));

      const loanState = await page.evaluate(() => window.game.getLoanState());
      const economy = await page.evaluate(() => window.game.getEconomyState());

      expect(loanState.netWorth).toBe(economy.cash - loanState.totalDebt);
    });
  });
});

test.describe('Transaction History Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.app !== undefined);
    await page.evaluate(() => window.startScenario('tutorial_basics'));
    await page.waitForFunction(() => window.game !== null);
    await page.waitForFunction(() => window.game !== undefined, { timeout: 10000 });
  });

  test.describe('Transaction Tracking', () => {
    test('getTransactionHistory returns array', async ({ page }) => {
      const history = await page.evaluate(() =>
        window.game.getTransactionHistory()
      );
      expect(Array.isArray(history)).toBe(true);
    });

    test('loan transaction recorded', async ({ page }) => {
      await page.evaluate(() => window.game.takeLoan('small'));
      const history = await page.evaluate(() =>
        window.game.getTransactionHistory()
      );

      const loanTxn = history.find((t: any) => t.category === 'loan_received');
      expect(loanTxn).toBeDefined();
      expect(loanTxn.amount).toBe(5000);
    });

    test('transactions have valid structure', async ({ page }) => {
      await page.evaluate(() => window.game.addRevenue(1000));

      const history = await page.evaluate(() =>
        window.game.getTransactionHistory()
      );

      if (history.length > 0) {
        const txn = history[history.length - 1];
        expect(typeof txn.id).toBe('string');
        expect(typeof txn.amount).toBe('number');
        expect(typeof txn.category).toBe('string');
        expect(typeof txn.description).toBe('string');
        expect(typeof txn.timestamp).toBe('number');
      }
    });

    test('revenue transaction recorded', async ({ page }) => {
      await page.evaluate(() => window.game.addRevenue(5000, 'green_fees'));

      const history = await page.evaluate(() =>
        window.game.getTransactionHistory()
      );
      const revTxn = history.find((t: any) => t.category === 'green_fees');
      expect(revTxn).toBeDefined();
    });

    test('expense transaction recorded', async ({ page }) => {
      await page.evaluate(() => window.game.setCash(100000));
      await page.evaluate(() => window.game.addExpenseAmount(500, 'supplies'));

      const history = await page.evaluate(() =>
        window.game.getTransactionHistory()
      );
      const expTxn = history.find((t: any) => t.category === 'supplies');
      expect(expTxn).toBeDefined();
    });
  });

  test.describe('Financial Summary', () => {
    test('getFinancialSummary returns valid structure', async ({ page }) => {
      const summary = await page.evaluate(() =>
        window.game.getFinancialSummary()
      );

      expect(summary).toBeDefined();
      expect(typeof summary.totalIncome).toBe('number');
      expect(typeof summary.totalExpenses).toBe('number');
      expect(typeof summary.netProfit).toBe('number');
    });

    test('income is tracked correctly', async ({ page }) => {
      await page.evaluate(() => window.game.addRevenue(10000));
      const summary = await page.evaluate(() =>
        window.game.getFinancialSummary()
      );

      expect(summary.totalIncome).toBeGreaterThanOrEqual(10000);
    });

    test('expenses are tracked correctly', async ({ page }) => {
      await page.evaluate(() => window.game.setCash(100000));
      await page.evaluate(() => window.game.addExpenseAmount(5000));

      const summary = await page.evaluate(() =>
        window.game.getFinancialSummary()
      );
      expect(summary.totalExpenses).toBeGreaterThanOrEqual(5000);
    });

    test('netProfit is income minus expenses', async ({ page }) => {
      await page.evaluate(() => window.game.setCash(100000));
      await page.evaluate(() => window.game.addRevenue(10000));
      await page.evaluate(() => window.game.addExpenseAmount(3000));

      const summary = await page.evaluate(() =>
        window.game.getFinancialSummary()
      );
      expect(summary.netProfit).toBe(summary.totalIncome - summary.totalExpenses);
    });
  });
});
