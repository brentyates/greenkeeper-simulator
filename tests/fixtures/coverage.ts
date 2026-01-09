import { test as base, expect } from '@playwright/test';
import { addCoverageReport } from 'monocart-reporter';

const test = base.extend<{
  autoCollectCoverage: void;
}>({
  autoCollectCoverage: [async ({ page }, use) => {
    if (!process.env.COVERAGE) {
      await use();
      return;
    }

    // Start collecting JS coverage
    await page.coverage.startJSCoverage({
      resetOnNavigation: false,
    });

    await use();

    // Collect and add coverage data
    const coverage = await page.coverage.stopJSCoverage();
    await addCoverageReport(coverage, test.info());
  }, { auto: true }],
});

export { test, expect };
