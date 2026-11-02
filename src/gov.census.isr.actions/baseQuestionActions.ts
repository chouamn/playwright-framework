// The shared page object every questionnaire screen extends.
import { BaseQuestionPage } from '../gov.census.isr.pages/baseQuestionPage';
// Reads expected wording/formatting from Excel; ExpectedEntry is the type of one Excel row.
import { ExcelReader, ExpectedEntry } from '../gov.census.isr.utils/excelReader';
// `import type` is erased at compile time, so this does not create a runtime cycle with ActionContext
import type { StepLogger } from '../gov.census.isr.utils/actionContext';

// Not a screen in the application: workflows shared by every questionnaire screen's Action class.
// `screen` is the value in the Screen column of expectedText.xlsx.
export class BaseQuestionActions {
  // The screen's page object (e.g. a ConfirmPage). `protected`: this class and its subclasses can use it.
  protected readonly questionPage: BaseQuestionPage;
  // Function that writes a line into the report under the current step.
  protected readonly log: StepLogger;
  // The screen's name in Excel, e.g. "Verify Address". `private`: only this class uses it.
  private readonly screen: string;

  // Called by each screen's Action class through `super(...)`.
  constructor(questionPage: BaseQuestionPage, log: StepLogger, screen: string) {
    // Remember the page object.
    this.questionPage = questionPage;
    // Remember the report logger.
    this.log = log;
    // Remember the Excel screen name.
    this.screen = screen;
  }

  // Confirms we are on this screen.
  async verifyDisplayed(): Promise<void> {
    // Read the screen's Heading from Excel, then check a heading with that text is visible.
    await this.questionPage.assertHeading(await ExcelReader.get(this.screen, 'Heading'));
  }

  // Answers "Yes".
  async selectYes(): Promise<void> {
    // Select Yes and check it is selected.
    await this.questionPage.selectYes();
  }

  // Answers "No".
  async selectNo(): Promise<void> {
    // Select No and check it is selected.
    await this.questionPage.selectNo();
  }

  // Moves on to the next screen.
  async clickNext(): Promise<void> {
    // Click the Next button.
    await this.questionPage.clickNext();
  }

  // Checks the screen's wording, spacing, line breaks, order and formatting against Excel,
  // then opens the Help popup and checks the same there.
  async verifyScreenText(): Promise<void> {
    // Read (and log) the expected heading.
    const heading = await this.entry('Heading');
    // Read (and log) the expected question.
    const question = await this.entry('Question');
    // Read (and log) the expected Help link text.
    const helpLink = await this.entry('Help link');
    // Read (and log) the expected "Yes" label.
    const yes = await this.entry('Yes option');
    // Read (and log) the expected "No" label.
    const no = await this.entry('No option');
    // Read (and log) the expected Next button text.
    const next = await this.entry('Next button');

    // Check a heading with that name is visible.
    await this.questionPage.assertHeading(heading.text);
    // Check a link with that name is visible.
    await this.questionPage.assertHelpLink(helpLink.text);
    // Check the "Yes" radio button is visible.
    await this.questionPage.assertRadioOption(yes.text);
    // Check the "No" radio button is visible.
    await this.questionPage.assertRadioOption(no.text);
    // Check the Next button is visible.
    await this.questionPage.assertButton(next.text);
    // The Help link sits at the end of the question's line.
    // Check every line exactly and in order: heading, question + Help, Yes, No, Next.
    await this.questionPage.assertScreenLines([heading.text, `${question.text} ${helpLink.text}`, yes.text, no.text, next.text]);
    // For each of those texts…
    for (const entry of [heading, question, helpLink, yes, no, next]) {
      // …if Excel gives a Format for it…
      if (entry.format) {
        // …check its bold/italic/underline on the page.
        await this.questionPage.assertScreenFormat(entry.text, entry.format);
      }
    }

    // Read (and log) the expected popup title.
    const helpTitle = await this.entry('Help title');
    // Read every "Help text 1", "Help text 2"… row, in order.
    const paragraphs = await ExcelReader.list(this.screen, 'Help text');
    // Write each paragraph into the report.
    paragraphs.forEach((paragraph) => this.logEntry(paragraph));
    // Read (and log) the expected Close button text.
    const close = await this.entry('Help close button');

    // Click Help and wait for the popup.
    await this.questionPage.openHelp();
    // Just the paragraph texts, without key/format.
    const paragraphTexts = paragraphs.map((paragraph) => paragraph.text);
    // Check the popup shows title, paragraphs and Close in this order (other lines may sit between).
    await this.questionPage.assertHelpDialogLines([helpTitle.text, ...paragraphTexts, close.text], false);
    // Check the paragraphs follow each other directly (catches merged or split paragraphs).
    await this.questionPage.assertHelpDialogLines(paragraphTexts, true);
    // For the title, every paragraph and the Close button…
    for (const entry of [helpTitle, ...paragraphs, close]) {
      // …if Excel gives a Format for it…
      if (entry.format) {
        // …check its bold/italic/underline inside the popup.
        await this.questionPage.assertHelpDialogFormat(entry.text, entry.format);
      }
    }
    // Close the popup and check it is gone.
    await this.questionPage.closeHelp(close.text);
  }

  // Reads one Excel row of this screen and writes it into the report.
  private async entry(key: string): Promise<ExpectedEntry> {
    // Read the row for this screen and key.
    const entry = await ExcelReader.getEntry(this.screen, key);
    // Write it into the report.
    this.logEntry(entry);
    // Hand it back.
    return entry;
  }

  // Writes one Excel row into the report, e.g. `Verify Address / Heading: "VERIFY ADDRESS" (format: bold)`.
  private logEntry(entry: ExpectedEntry): void {
    // Describe the format: the names of the styles that are on, "normal" if none, or "not checked" if Format is empty.
    const format = entry.format
      ? Object.entries(entry.format).filter(([, on]) => on).map(([style]) => style).join(', ') || 'normal'
      : 'not checked';
    // Write the line into the report.
    this.log(`${this.screen} / ${entry.key}: "${entry.text}" (format: ${format})`);
  }
}
