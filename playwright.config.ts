import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.COVERAGE
    ? [
        ['monocart-reporter', {
          name: 'Playwright E2E Coverage Report',
          outputFile: './coverage-e2e/report.html',
          coverage: {
            entryFilter: (entry: { url: string }) => {
              // Include source files and exclude node_modules vite deps
              const url = entry.url;
              if (url.includes('node_modules')) return false;
              if (url.includes('@vite')) return false;
              return url.includes('localhost:8080');
            },
            sourceFilter: (sourcePath: string) => {
              // Exclude Babylon.js source maps and node_modules
              if (sourcePath.includes('node_modules')) return false;
              if (sourcePath.includes('/dev/core/')) return false;
              if (sourcePath.includes('/dev/gui/')) return false;
              return true;
            },
            reports: [
              ['v8'],
              ['html', { subdir: 'html' }],
              ['json-summary', { file: 'coverage-summary.json' }],
              ['text-summary']
            ]
          }
        }]
      ]
    : 'html',
  use: {
    baseURL: 'http://localhost:8080',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
        },
      },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:8080',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
  // Screenshot configuration removed - we use state-based testing instead
});
