// `Page` is a browser tab; `Locator` describes how to find an element on the page.
import { Page, Locator } from '@playwright/test';
// Our `expect`, pre-configured with the framework's assertion timeout.
import { expect } from '../gov.census.isr.utils/timeouts';
// The bold/italic/underline type from the Excel reader. `import type` brings in the type only, no code.
import type { TextFormat } from '../gov.census.isr.utils/excelReader';

// Not a screen in the application: the shared base for every questionnaire screen (Confirm, Verify Address …).
// Holds their common layout: heading, question + "Help" link, Yes/No radios, Next button,
// and a Help popup with a Close button. Each screen's page object extends this and adds what is unique to it.
// Role checks find elements by role + accessible name, so they also catch a wrong screen-reader label.
export class BaseQuestionPage {
  // The browser tab this page object works in.
  readonly page: Page;
  // The whole page body: used to read every line of text the user sees.
  private readonly screenLocator: Locator;
  // The "Yes" radio button.
  private readonly yesRadioLocator: Locator;
  // The "No" radio button.
  private readonly noRadioLocator: Locator;
  // The "Next" button.
  private readonly nextButtonLocator: Locator;
  // The "Help" link next to the question.
  private readonly helpLinkLocator: Locator;
  // The Help popup window.
  private readonly helpDialogLocator: Locator;

  // Runs when a screen's page object is created, e.g. `new ConfirmPage(page)`.
  constructor(page: Page) {
    // Remember the browser tab.
    this.page = page;
    // The <body> element: everything on the page.
    this.screenLocator = page.locator('body');
    // A radio button whose accessible name is exactly "Yes".
    this.yesRadioLocator = page.getByRole('radio', { name: 'Yes', exact: true });
    // A radio button whose accessible name is exactly "No".
    this.noRadioLocator = page.getByRole('radio', { name: 'No', exact: true });
    // A button whose accessible name is exactly "Next".
    this.nextButtonLocator = page.getByRole('button', { name: 'Next', exact: true });
    // NOTE: assumes "Help" is a link (it is underlined) — verify against the DOM; it may be a button.
    // A link whose accessible name is exactly "Help".
    this.helpLinkLocator = page.getByRole('link', { name: 'Help', exact: true });
    // An element with the ARIA role "dialog" (the popup window).
    this.helpDialogLocator = page.getByRole('dialog');
  }

  // Answers "Yes".
  async selectYes(): Promise<void> {
    // Select the Yes radio button (waits until it can be clicked).
    await this.yesRadioLocator.check();
    // Confirm it really is selected; fail with this message if not.
    await expect(this.yesRadioLocator, 'The "Yes" option was not selected.').toBeChecked();
  }

  // Answers "No".
  async selectNo(): Promise<void> {
    // Select the No radio button.
    await this.noRadioLocator.check();
    // Confirm it really is selected.
    await expect(this.noRadioLocator, 'The "No" option was not selected.').toBeChecked();
  }

  // Moves on to the next screen.
  async clickNext(): Promise<void> {
    // Click Next (waits until the button is visible, enabled and stable).
    await this.nextButtonLocator.click();
  }

  // Opens the Help popup.
  async openHelp(): Promise<void> {
    // Click the Help link.
    await this.helpLinkLocator.click();
    // Wait for the popup to appear; fail with this message if it does not.
    await expect(this.helpDialogLocator, 'The Help popup did not open.').toBeVisible();
  }

  // Closes the Help popup with its text button (e.g. "Close").
  async closeHelp(closeText: string): Promise<void> {
    // The header "X" is usually also named "Close", so pick the button whose visible text is closeText.
    // Inside the popup, take the buttons, keep the one whose visible text contains closeText, and click it.
    await this.helpDialogLocator.getByRole('button').filter({ hasText: closeText }).click();
    // Wait for the popup to disappear; fail with this message if it stays open.
    await expect(this.helpDialogLocator, 'The Help popup did not close.').toBeHidden();
  }

  // Checks the screen heading.
  async assertHeading(expectedText: string): Promise<void> {
    // Accessible-name matching ignores case, so a CSS-uppercased "Confirm" still matches "CONFIRM".
    // Wait for a heading with that name to be visible; fail with this message if not.
    await expect(this.page.getByRole('heading', { name: expectedText }), `Heading "${expectedText}" not found.`).toBeVisible();
  }

  // Checks there is a link with exactly this name.
  async assertHelpLink(expectedText: string): Promise<void> {
    // Wait for the link to be visible; fail with this message if not.
    await expect(this.page.getByRole('link', { name: expectedText, exact: true }), `Link "${expectedText}" not found.`).toBeVisible();
  }

  // Checks there is a radio button with exactly this name.
  async assertRadioOption(expectedText: string): Promise<void> {
    // Wait for the radio button to be visible; fail with this message if not.
    await expect(this.page.getByRole('radio', { name: expectedText, exact: true }), `Option "${expectedText}" not found.`).toBeVisible();
  }

  // Checks there is a button with exactly this name.
  async assertButton(expectedText: string): Promise<void> {
    // Wait for the button to be visible; fail with this message if not.
    await expect(this.page.getByRole('button', { name: expectedText, exact: true }), `Button "${expectedText}" not found.`).toBeVisible();
  }

  // Exact wording, spacing and line breaks: each expected line must be a whole line of the text the user sees,
  // in the given order. With `adjacent`, no other line may sit between them (e.g. Help paragraphs).
  async assertScreenLines(expectedLines: string[]): Promise<void> {
    // Check the lines against the whole page; other lines may sit between them.
    await this.assertLines(this.screenLocator, expectedLines, false, 'Screen');
  }

  // Same line check, but inside the Help popup only.
  async assertHelpDialogLines(expectedLines: string[], adjacent: boolean): Promise<void> {
    // Check the lines against the popup's text.
    await this.assertLines(this.helpDialogLocator, expectedLines, adjacent, 'Help popup');
  }

  // Checks bold/italic/underline of a text on the page.
  async assertScreenFormat(text: string, format: TextFormat): Promise<void> {
    // Look for the text anywhere on the page.
    await this.assertFormat(this.screenLocator, text, format);
  }

  // Checks bold/italic/underline of a text inside the Help popup.
  async assertHelpDialogFormat(text: string, format: TextFormat): Promise<void> {
    // Look for the text inside the popup only.
    await this.assertFormat(this.helpDialogLocator, text, format);
  }

  // Shared logic of the two line checks above. `where` is used in the failure message.
  private async assertLines(container: Locator, expectedLines: string[], adjacent: boolean, where: string): Promise<void> {
    // `expect.poll` keeps re-running the function until it returns '' (no problem) or the timeout is reached.
    await expect
      // Each attempt: read the lines shown now and describe the first mismatch ('' if none).
      .poll(async () => findLineProblem(await renderedLines(container), expectedLines, adjacent), {
        // Headline of the failure message; the problem description is shown below it.
        message: `${where} text, spacing or line breaks did not match expectedText.xlsx.`,
      })
      // Pass when there is no problem.
      .toBe('');
  }

  // Shared logic of the two format checks above.
  private async assertFormat(container: Locator, text: string, format: TextFormat): Promise<void> {
    // Prefer the element whose whole text is `text`; fall back to the element that contains it
    // (e.g. a question followed by an inline "Help" link).
    // Visible elements whose full text is exactly `text`.
    const exactMatch = container.getByText(text, { exact: true }).filter({ visible: true });
    // Use the first exact match if there is one, otherwise the first visible element that contains `text`.
    const element = (await exactMatch.count()) > 0 ? exactMatch.first() : container.getByText(text).filter({ visible: true }).first();
    // Keep reading the element's styles in the browser until they match Excel, or time out.
    await expect
      // Run readFormat (below) inside the browser on that element.
      .poll(() => element.evaluate(readFormat, text), { message: `Formatting of "${text}" did not match expectedText.xlsx.` })
      // Pass when { bold, italic, underline } equals the Format from Excel.
      .toEqual(format);
  }
}

// innerText is what the user sees: CSS uppercase applied, runs of spaces collapsed as rendered, one line per
// rendered line or block. Blank lines (paragraph gaps) are dropped; their size is not checked here.
async function renderedLines(container: Locator): Promise<string[]> {
  // Ask the browser for the text exactly as displayed.
  const text = await container.innerText();
  // Split into lines, turn non-breaking spaces into normal spaces, trim each line, and drop empty lines.
  return text.split(/\r?\n/).map((line) => line.replace(/ /g, ' ').trim()).filter(Boolean);
}

// Returns '' when every expected line is found in order, otherwise a description of the first problem.
function findLineProblem(actualLines: string[], expectedLines: string[], adjacent: boolean): string {
  // Where in the page's lines to start looking for the next expected line.
  let searchFrom = 0;
  // Position where the previous expected line was found (-1 = none yet).
  let previousIndex = -1;
  // Go through the expected lines in order; `i` is the position, `expected` the text.
  for (const [i, expected] of expectedLines.entries()) {
    // Find this exact line, searching only after the previous match (this enforces the order).
    const index = actualLines.indexOf(expected, searchFrom);
    // Empty means "no problem with this line".
    let problem = '';
    // Not found after the previous line…
    if (index === -1) {
      // …if it exists earlier on the page it is out of order; otherwise its wording/spacing/breaks differ.
      problem = actualLines.includes(expected)
        ? `"${expected}" is out of order (expected after "${expectedLines[i - 1]}").`
        : `"${expected}" is not shown as its own line (check wording, spacing and line breaks).`;
      // Found, but lines must be adjacent and something sits between it and the previous one…
    } else if (adjacent && i > 0 && index !== previousIndex + 1) {
      // …so it does not directly follow the previous expected line.
      problem = `"${expected}" does not directly follow "${expectedLines[i - 1]}".`;
    }
    // If this line has a problem…
    if (problem) {
      // …return it together with every line actually shown, so the tester can compare.
      return `${problem}\nLines shown:\n${actualLines.map((line) => `  | ${line}`).join('\n')}`;
    }
    // Remember where this line was found.
    previousIndex = index;
    // The next expected line must come after it.
    searchFrom = index + 1;
  }
  // Every line was found, in order: no problem.
  return '';
}

// Runs in the browser. A style counts only if every text node belonging to `expected` has it.
// Underline is inherited visually but not in computed style, so ancestors are checked too.
function readFormat(element: Element, expected: string): { bold: boolean; italic: boolean; underline: boolean } {
  // Helper: collapse runs of whitespace into one space and trim, so texts can be compared.
  const normalize = (value: string) => value.replace(/\s+/g, ' ').trim();
  // A walker that visits every text node (piece of text) inside the element.
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  // The non-empty text nodes found.
  const allNodes: Text[] = [];
  // Visit each text node in turn.
  while (walker.nextNode()) {
    // If it contains visible characters (not just spaces)…
    if (normalize(walker.currentNode.textContent ?? '')) {
      // …keep it.
      allNodes.push(walker.currentNode as Text);
    }
  }
  // Keep only the text nodes that belong to the expected text (e.g. skip the "Help" link inside a question).
  const ownNodes = allNodes.filter((node) => normalize(expected).includes(normalize(node.textContent ?? '')));
  // Use those; if none matched, fall back to every text node.
  const nodes = ownNodes.length > 0 ? ownNodes : allNodes;

  // Helper: true if this element or any parent element is styled with an underline.
  const isUnderlined = (start: Element | null): boolean => {
    // Walk up from the element to the top of the page.
    for (let current = start; current; current = current.parentElement) {
      // If this element's computed style includes an underline…
      if (getComputedStyle(current).textDecorationLine.includes('underline')) {
        // …the text is underlined.
        return true;
      }
    }
    // No element on the way up is underlined.
    return false;
  };
  // Report each style as true only if every relevant text node has it.
  return {
    // Bold: the font weight of each text's element is 600 or more.
    bold: nodes.every((node) => parseInt(getComputedStyle(node.parentElement!).fontWeight, 10) >= 600),
    // Italic: the font style is anything other than "normal" (italic or oblique).
    italic: nodes.every((node) => getComputedStyle(node.parentElement!).fontStyle !== 'normal'),
    // Underline: the text's element or one of its parents is underlined.
    underline: nodes.every((node) => isUnderlined(node.parentElement)),
  };
}
