// `defineConfig` gives type-checking and auto-complete for Playwright settings.
import { defineConfig } from '@playwright/test';
// Reads browser name, headless mode and base URL from .env.uat.
import { ConfigReader } from './src/gov.census.isr.utils/configReader';
// All framework timeouts.
import { Timeouts } from './src/gov.census.isr.utils/timeouts';

// Cucumber is the test runner (`npm test`); this file holds the Playwright browser settings.
// hook.ts launches the browser and creates every scenario's context from `use` below,
// so a setting changed here applies to every Cucumber scenario.
// Values still come from .env.uat (via ConfigReader) and timeouts.ts, so nothing is duplicated.
export default defineConfig({
  // Only used by `npx playwright test`, for Playwright-native *.spec.ts files if any are added.
  testDir: './tests',
  // Where `npx playwright test` would put its output (not used by Cucumber runs).
  outputDir: './test-results',
  // Per-test timeout for `npx playwright test` (same value as the Cucumber step timeout).
  timeout: Timeouts.step,
  // Assertion timeout for `npx playwright test`.
  expect: { timeout: Timeouts.assertion },
  // Browser and context settings — read by hook.ts for every Cucumber scenario.
  use: {
    // Which browser to launch: chromium, firefox or webkit (BROWSER in .env.uat).
    browserName: ConfigReader.getBrowserName(),
    // true = no visible window (HEADLESS in .env.uat).
    headless: ConfigReader.isHeadless(),
    // Base URL of the environment under test (BASE_URL in .env.uat).
    baseURL: ConfigReader.getBaseUrl(),
    // Browser window size in pixels.
    viewport: { width: 1280, height: 720 },
    // How long clicks/typing may wait.
    actionTimeout: Timeouts.action,
    // How long page loads may wait.
    navigationTimeout: Timeouts.navigation,
  },
});
