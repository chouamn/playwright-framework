// Cucumber's functions for defining Given / When / Then steps.
import { Given, When, Then } from '@cucumber/cucumber';
// Our World type, so `this.actions` is known to TypeScript.
import { CustomWorld } from '../gov.census.isr.utils/customWorld';

// Each step below: the text in quotes must match the line in the .feature file exactly.
// `async function (this: CustomWorld)` (not an arrow function) so Cucumber can pass the scenario's World as `this`.

// Matches "Given the respondent is on the 2026 Census Test welcome page".
Given('the respondent is on the 2026 Census Test welcome page', async function (this: CustomWorld) {
  // Open the login page.
  await this.actions.login.openLoginPage();
});

// Matches "When the respondent enters a valid Census ID".
When('the respondent enters a valid Census ID', async function (this: CustomWorld) {
  // Type the valid Census ID from .env.uat.
  await this.actions.login.enterValidCensusId();
});

// Matches "When the respondent enters an invalid Census ID".
When('the respondent enters an invalid Census ID', async function (this: CustomWorld) {
  // Type the invalid Census ID from .env.uat.
  await this.actions.login.enterInvalidCensusId();
});

// Matches "When/And the respondent clicks the Log In button".
When('the respondent clicks the Log In button', async function (this: CustomWorld) {
  // Click Log In.
  await this.actions.login.submitLogin();
});

// Matches "Then the respondent sees the questionnaire landing page".
Then('the respondent sees the questionnaire landing page', async function (this: CustomWorld) {
  // Check the first questionnaire screen is shown.
  await this.actions.login.verifyLoginSuccess();
});

// Matches "Then the respondent sees a warning validation error".
Then('the respondent sees a warning validation error', async function (this: CustomWorld) {
  // TODO: verify the exact warning text against the live UAT page, then update expectedText.xlsx
  // Check the warning is shown with the wording from Excel.
  await this.actions.login.verifyValidationWarning();
});
