// Cucumber's functions for defining When / Then steps.
import { When, Then } from '@cucumber/cucumber';
// Our World type, so `this.actions` is known to TypeScript.
import { CustomWorld } from '../gov.census.isr.utils/customWorld';

// Matches "When the respondent selects Yes to confirm the address".
When('the respondent selects Yes to confirm the address', async function (this: CustomWorld) {
  // Select "Yes" on the Confirm screen and check it is selected.
  await this.actions.confirm.selectYes();
});

// Matches "When/And the respondent clicks Next on the Confirm screen".
When('the respondent clicks Next on the Confirm screen', async function (this: CustomWorld) {
  // Click Next to go to the following screen.
  await this.actions.confirm.clickNext();
});

// Matches "Then the Confirm screen text matches the expected text in Excel".
Then('the Confirm screen text matches the expected text in Excel', async function (this: CustomWorld) {
  // Check every text, its order and formatting, including the Help popup, against Excel.
  await this.actions.confirm.verifyScreenText();
});
