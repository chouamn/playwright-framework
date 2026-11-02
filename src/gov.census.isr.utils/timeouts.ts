// Import Playwright's `expect` under another name (`baseExpect`), so we can export our own configured `expect` below.
import { expect as baseExpect } from '@playwright/test';

// Single source of truth for every timeout in the framework.
// The Cucumber step timeout must stay larger than any single Playwright wait,
// otherwise Cucumber kills the step before Playwright can report a useful error.
// No Cucumber import here: playwright.config.ts loads this file outside a Cucumber run,
// so the step timeout is registered in hook.ts instead.
export const Timeouts = {
  // Maximum time one Cucumber step may take: 60 seconds (values are in milliseconds).
  step: 60_000,
  // Maximum time to wait for a page to load (page.goto, navigation after a click): 30 seconds.
  navigation: 30_000,
  // Maximum time for one action (click, type, check): 15 seconds.
  action: 15_000,
  // How long an `expect(...)` assertion keeps retrying before it fails: 10 seconds.
  assertion: 10_000,
  // `as const` makes these values read-only, so no code can change a timeout by accident.
} as const;

// Page objects import `expect` from here so every assertion uses the same timeout.
// `configure` returns a copy of Playwright's `expect` that waits `Timeouts.assertion` by default.
export const expect = baseExpect.configure({ timeout: Timeouts.assertion });
