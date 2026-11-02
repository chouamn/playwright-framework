// Type of the browser tab every Action class works with.
import { Page } from '@playwright/test';
// One import per screen's Action class.
import { LoginActions } from '../gov.census.isr.actions/loginActions';
import { ConfirmActions } from '../gov.census.isr.actions/confirmActions';
import { VerifyAddressActions } from '../gov.census.isr.actions/verifyAddressActions';

// Writes a line into the Cucumber report under the current step (backed by World.log()).
// Action classes receive it so they can log the data they resolve without depending on the World.
// It is a function type: it takes a message (text) and returns nothing.
export type StepLogger = (message: string) => void;

// Groups every Action class so steps can write this.actions.<screen>.<method>().
// A new screen adds exactly one property and one line in the constructor.
export class ActionContext {
  // Workflows for the Census ID login screen.
  login: LoginActions;
  // Workflows for the CONFIRM screen.
  confirm: ConfirmActions;
  // Workflows for the VERIFY ADDRESS screen.
  verifyAddress: VerifyAddressActions;

  // Called once per scenario in the Before hook, with that scenario's page and report logger.
  constructor(page: Page, log: StepLogger) {
    // Create the login workflows for this scenario's page.
    this.login = new LoginActions(page, log);
    // Create the Confirm screen workflows for this scenario's page.
    this.confirm = new ConfirmActions(page, log);
    // Create the Verify Address screen workflows for this scenario's page.
    this.verifyAddress = new VerifyAddressActions(page, log);
  }
}
