// `setWorldConstructor` tells Cucumber which class to use as `this`; `World` is Cucumber's base class;
// `IWorldOptions` is the type of the settings Cucumber passes when it creates a World.
import { setWorldConstructor, World, IWorldOptions } from '@cucumber/cucumber';
// Types for the browser session (BrowserContext) and the browser tab (Page).
import { BrowserContext, Page } from '@playwright/test';
// The class that groups every Action class (this.actions.login, this.actions.confirm …).
import { ActionContext } from './actionContext';

// Cucumber creates one CustomWorld per scenario and makes it `this` in every step and hook,
// so each scenario has its own browser session and nothing leaks between scenarios.
export class CustomWorld extends World {
  // The scenario's isolated browser session (own cookies and storage). Set in the Before hook.
  // `!` tells TypeScript "this is assigned later" (in hook.ts), not in the constructor.
  context!: BrowserContext;
  // The scenario's browser tab. Set in the Before hook.
  page!: Page;
  // Entry point to every Action class for this scenario. Set in the Before hook.
  actions!: ActionContext;

  // Cucumber calls this constructor at the start of every scenario.
  constructor(options: IWorldOptions) {
    // Let Cucumber's own World set itself up (this gives us this.log() and this.attach()).
    super(options);
  }
}

// Register CustomWorld with Cucumber, so every scenario gets one instead of the plain World.
setWorldConstructor(CustomWorld);
