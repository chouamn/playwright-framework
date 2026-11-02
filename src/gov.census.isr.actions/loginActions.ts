// Type of the browser tab.
import { Page } from '@playwright/test';
// The page object for the login screen.
import { LoginPage } from '../gov.census.isr.pages/loginPage';
// Gives us test data (Census IDs) from .env.uat.
import { ConfigReader } from '../gov.census.isr.utils/configReader';
// Gives us expected wording from expectedText.xlsx.
import { ExcelReader } from '../gov.census.isr.utils/excelReader';
// `import type` is erased at compile time, so this does not create a runtime cycle with ActionContext
import type { StepLogger } from '../gov.census.isr.utils/actionContext';

// Business workflows for the Census ID login screen. Steps call these; these call LoginPage.
export class LoginActions {
  // The page object this class drives. `private readonly`: set once, used only here.
  private readonly loginPage: LoginPage;
  // Function that writes a line into the report under the current step.
  private readonly log: StepLogger;

  // Created once per scenario by ActionContext.
  constructor(page: Page, log: StepLogger) {
    // Create the login page object on this scenario's browser tab.
    this.loginPage = new LoginPage(page);
    // Remember the report logger.
    this.log = log;
  }

  // Opens the login page.
  async openLoginPage(): Promise<void> {
    // Ask the page object to navigate to BASE_URL.
    await this.loginPage.goto();
  }

  // Types the valid Census ID from .env.uat.
  async enterValidCensusId(): Promise<void> {
    // Read the valid Census ID.
    const censusId = ConfigReader.getValidCensusId();
    // A valid Census ID logs into a real questionnaire, so only the last 4 digits are reported
    // `slice(-4)` takes the last 4 characters.
    this.log(`Census ID (valid): ********${censusId.slice(-4)}`);
    // Type it into the Census ID field.
    await this.loginPage.enterCensusId(censusId);
  }

  // Types the invalid Census ID from .env.uat.
  async enterInvalidCensusId(): Promise<void> {
    // Read the invalid Census ID.
    const censusId = ConfigReader.getInvalidCensusId();
    // Write it into the report (it is not a real ID, so it is not masked).
    this.log(`Census ID (invalid): ${censusId}`);
    // Type it into the Census ID field.
    await this.loginPage.enterCensusId(censusId);
  }

  // Submits the login form.
  async submitLogin(): Promise<void> {
    // Click the Log In button.
    await this.loginPage.clickLogin();
  }

  // Confirms the respondent got into the questionnaire.
  async verifyLoginSuccess(): Promise<void> {
    // Check the first questionnaire screen is visible.
    await this.loginPage.assertQuestionnaireLandingVisible();
  }

  // Confirms the invalid-ID warning is shown with the expected wording.
  async verifyValidationWarning(): Promise<void> {
    // Read the expected warning from Excel (Screen "Login", Key "Invalid Census ID warning").
    const expectedMessage = await ExcelReader.get('Login', 'Invalid Census ID warning');
    // Write the expected text into the report.
    this.log(`Expected warning: "${expectedMessage}"`);
    // Check the warning is visible.
    await this.loginPage.assertWarningVisible();
    // Check its text contains the expected message.
    await this.loginPage.assertWarningMessage(expectedMessage);
  }
}
