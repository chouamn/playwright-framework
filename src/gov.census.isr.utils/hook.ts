// The three browser engines Playwright can launch, plus the types for a running browser and a browser engine.
import { chromium, firefox, webkit, Browser, BrowserType } from '@playwright/test';
// Cucumber hook functions (run before/after the whole run, each scenario and each step), the scenario
// result status, the type of the data passed to After hooks, and the function that sets the step timeout.
import { Before, After, BeforeAll, AfterAll, AfterStep, Status, ITestCaseHookParameter, setDefaultTimeout } from '@cucumber/cucumber';
// Node's `path` module, used to build the trace folder path.
import * as path from 'path';
// The Playwright settings file; its `use` block holds browser and context settings.
import config from '../../playwright.config';
// Our per-scenario World type, so `this` is typed inside the hooks.
import { CustomWorld } from './customWorld';
// The class that creates every Action class for a scenario.
import { ActionContext } from './actionContext';
// All framework timeouts.
import { Timeouts } from './timeouts';

// Look-up table from a browser name in the config to the Playwright engine that launches it.
const browserTypes: Record<string, BrowserType> = { chromium, firefox, webkit };
// Folder where traces of failed scenarios are saved: <project root>/reports/traces.
const TRACE_DIR = path.resolve(__dirname, '../../reports/traces');
// Browser and context settings live in playwright.config.ts
// Take its `use` block; fall back to an empty object if it is missing.
const settings = config.use ?? {};

// Tell Cucumber the maximum time a step may take (60 s). Must be larger than any Playwright timeout.
setDefaultTimeout(Timeouts.step);

// One browser per Cucumber worker; every scenario gets its own isolated context below.
// Declared here, assigned in BeforeAll, closed in AfterAll.
let browser: Browser;

// Runs once, before the first scenario.
BeforeAll(async function () {
  // Pick the engine named in the config (default chromium) and launch it, headed or headless as configured.
  browser = await browserTypes[settings.browserName ?? 'chromium'].launch({ headless: settings.headless });
});

// Runs before every scenario. `this` is the scenario's CustomWorld.
Before(async function (this: CustomWorld) {
  // Open a fresh, isolated browser session (own cookies/storage) with the configured base URL and window size.
  this.context = await browser.newContext({ baseURL: settings.baseURL, viewport: settings.viewport });
  // Set how long clicks/typing may wait in this session (from the config, else Timeouts.action).
  this.context.setDefaultTimeout(settings.actionTimeout ?? Timeouts.action);
  // Set how long page loads may wait in this session (from the config, else Timeouts.navigation).
  this.context.setDefaultNavigationTimeout(settings.navigationTimeout ?? Timeouts.navigation);
  // Start recording a trace (screenshots, DOM snapshots, source) so a failure can be replayed later.
  await this.context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  // Open a browser tab in that session.
  this.page = await this.context.newPage();
  // Create every Action class for this scenario. The arrow function forwards report lines to Cucumber's this.log().
  this.actions = new ActionContext(this.page, (message) => this.log(message));
});

// Runs after every step.
AfterStep(async function (this: CustomWorld) {
  // Write the current page URL into the report under the step that just finished.
  this.log(`URL: ${this.page.url()}`);
});

// Runs after every scenario. `pickle` is the scenario (its name); `result` tells whether it passed or failed.
After(async function (this: CustomWorld, { pickle, result }: ITestCaseHookParameter) {
  // If the Before hook failed before creating a context, there is nothing to clean up.
  if (!this.context) {
    // Stop here.
    return;
  }

  // `try … finally` guarantees the context is closed even if saving the evidence throws an error.
  try {
    // Only collect evidence when the scenario failed.
    if (result?.status === Status.FAILED) {
      // If a page exists…
      if (this.page) {
        // …take a screenshot of the whole page (not just the visible part) and attach it to the report.
        this.attach(await this.page.screenshot({ fullPage: true }), 'image/png');
      }
      // Build the trace file name: scenario name with special characters replaced by '-', plus a timestamp.
      const traceFile = path.join(TRACE_DIR, `${pickle.name.replace(/[^a-z0-9]+/gi, '-')}-${Date.now()}.zip`);
      // Stop recording and save the trace to that file.
      await this.context.tracing.stop({ path: traceFile });
      // Tell the reader where the trace is and how to open it.
      this.log(`Trace saved: ${traceFile}\nOpen it with: npx playwright show-trace "${traceFile}"`);
    } else {
      // The scenario passed: stop recording without saving anything.
      await this.context.tracing.stop();
    }
  } finally {
    // Always release the context, even if capturing the failure evidence throws
    await this.context.close();
  }
});

// Runs once, after the last scenario.
AfterAll(async function () {
  // If the browser was launched…
  if (browser) {
    // …close it.
    await browser.close();
  }
});
