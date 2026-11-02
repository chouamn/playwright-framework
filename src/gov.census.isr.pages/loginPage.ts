// `Page` is a browser tab; `Locator` describes how to find an element on the page.
import { Page, Locator } from '@playwright/test';
// Gives us the BASE_URL from .env.uat.
import { ConfigReader } from '../gov.census.isr.utils/configReader';
// Our `expect`, pre-configured with the framework's assertion timeout.
import { expect } from '../gov.census.isr.utils/timeouts';

// Page object for the Census ID login screen: the only place that knows how to find its elements.
export class LoginPage {
  // The browser tab this page object works in. `readonly` means it is set once and never replaced.
  readonly page: Page;
  // The 12-digit Census ID text box. `private`: only this class may use the locators.
  private readonly censusIdInputBoxLocator: Locator;
  // The Log In button.
  private readonly loginButtonLocator: Locator;
  // An element that only exists on the first questionnaire screen, used to prove login worked.
  private readonly gqConfirmTextLocator: Locator;
  // The warning message shown for an invalid Census ID.
  private readonly warningLocator: Locator;

  // Runs when an Action class does `new LoginPage(page)`.
  constructor(page: Page) {
    // Remember the browser tab.
    this.page = page;
    // NOTE: 'authCodeInput' is treated as the field's accessible name — verify against the DOM;
    // page.getByLabel('Census ID (12-digit)') may be more reliable.
    // Find the text box by its role and accessible name.
    this.censusIdInputBoxLocator = page.getByRole('textbox', { name: 'authCodeInput' });
    // Find the Log In button by its aria-label attribute (a CSS attribute selector).
    this.loginButtonLocator = page.locator('[aria-label="auth submit button"]');
    // Find the landing-page marker by its HTML id.
    this.gqConfirmTextLocator = page.locator('#component54'); // verify: #id vs .class vs testid
    // Find the warning by its ARIA role "alert".
    this.warningLocator = page.getByRole('alert'); // added so the invalid-ID scenario can assert
  }

  // Opens the login page.
  async goto(): Promise<void> {
    // Navigate the tab to BASE_URL from .env.uat and wait for it to load.
    await this.page.goto(ConfigReader.getBaseUrl());
  }

  // Types a Census ID into the text box.
  async enterCensusId(censusId: string): Promise<void> {
    // Click the field first so it has focus.
    await this.censusIdInputBoxLocator.click();
    // Type the ID one key at a time, like a real user (fires the page's key events).
    await this.censusIdInputBoxLocator.pressSequentially(censusId);
  }

  // Submits the login form.
  async clickLogin(): Promise<void> {
    // click() auto-waits for the button to be visible, enabled and stable
    await this.loginButtonLocator.click();
  }

  // Checks that login succeeded.
  async assertQuestionnaireLandingVisible(): Promise<void> {
    // Wait (up to the assertion timeout) for the landing-page marker to be visible; fail with this message if not.
    await expect(this.gqConfirmTextLocator, 'The questionnaire landing page was not displayed.').toBeVisible();
  }

  // Checks that the invalid-ID warning appeared.
  async assertWarningVisible(): Promise<void> {
    // Wait for the warning to be visible; fail with this message if not.
    await expect(this.warningLocator, 'The warning validation error was not displayed.').toBeVisible();
  }

  // Checks the warning's wording.
  async assertWarningMessage(expectedMessage: string): Promise<void> {
    // Wait until the warning's text contains the expected message (from Excel); fail with this message if not.
    await expect(this.warningLocator, 'The warning validation error text did not match.').toContainText(expectedMessage);
  }
}
