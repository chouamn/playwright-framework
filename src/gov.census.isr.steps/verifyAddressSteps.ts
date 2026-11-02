// Cucumber's function for defining Then steps.
import { Then } from '@cucumber/cucumber';
// Our World type, so `this.actions` is known to TypeScript.
import { CustomWorld } from '../gov.census.isr.utils/customWorld';

// Matches "Then the respondent sees the Verify Address screen".
Then('the respondent sees the Verify Address screen', async function (this: CustomWorld) {
  // Check the Verify Address heading (from Excel) is visible.
  await this.actions.verifyAddress.verifyDisplayed();
});

// Matches "Then the Verify Address screen text matches the expected text in Excel".
Then('the Verify Address screen text matches the expected text in Excel', async function (this: CustomWorld) {
  // Check every text, its order and formatting, including the Help popup, against Excel.
  await this.actions.verifyAddress.verifyScreenText();
});
