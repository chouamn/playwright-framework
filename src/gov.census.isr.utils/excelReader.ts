// `Workbook` from the exceljs library opens and reads .xlsx files.
import { Workbook } from 'exceljs';
// Node's `path` module builds file paths that work on Windows and macOS.
import * as path from 'path';

// Expected on-screen text (help text, error messages, labels) lives in one Excel workbook,
// so the wording can be updated without touching code or .env.uat.
// Full path to the workbook, built from this file's folder up to the project root.
const WORKBOOK_FILE = path.resolve(__dirname, '../../resources/gov.census.isr.testdata/expectedText.xlsx');
// Name of the sheet (tab) inside the workbook that holds the rows.
const SHEET_NAME = 'ExpectedText';
// Columns are found by their header text, so they can be reordered or extra columns added in Excel.
// Header of the column with the screen name, e.g. "Verify Address".
const SCREEN_HEADER = 'Screen';
// Header of the column with the key, e.g. "Heading".
const KEY_HEADER = 'Key';
// Header of the column with the expected wording.
const TEXT_HEADER = 'Text';
// Optional column: "Bold", "Italic", "Underline" (comma-separated to combine) or "Normal". Empty = not checked.
const FORMAT_HEADER = 'Format';
// The only words allowed in the Format column (compared in lower case).
const FORMAT_WORDS = ['bold', 'italic', 'underline', 'normal'];

// Which text styles must be on (true) or off (false). `export` lets page objects use this type.
export interface TextFormat {
  // Font weight 600 or more.
  bold: boolean;
  // Italic or oblique font style.
  italic: boolean;
  // Underlined text (on the element itself or an ancestor).
  underline: boolean;
}

// One row of the workbook, as the rest of the framework sees it.
export interface ExpectedEntry {
  // The Key column, e.g. "Help text 2".
  key: string;
  // The Text column: the exact expected wording.
  text: string;
  // undefined when the Format cell is empty, meaning the formatting is not checked
  // (the `?` makes the property optional).
  format?: TextFormat;
}

// Loaded once per test run and shared by every scenario; the sheet does not change during a run.
// A Map keeps insertion order, so entries stay in sheet row order.
// Holds the *promise* of the loaded rows: undefined until the first read, then reused by every later read.
let entries: Promise<Map<string, ExpectedEntry & { screen: string }>> | undefined;

// Builds the look-up id for a row: "screen|key", trimmed and in lower case, so case and spaces don't matter.
function entryId(screen: string, key: string): string {
  // e.g. ("Verify Address", " Heading ") → "verify address|heading".
  return `${screen.trim().toLowerCase()}|${key.trim().toLowerCase()}`;
}

// Turns a Format cell like "Bold, Underline" into { bold: true, italic: false, underline: true }.
function parseFormat(value: string, rowNumber: number): TextFormat | undefined {
  // Split on commas, trim each word, lower-case it, and drop empty pieces.
  const words = value.split(',').map((word) => word.trim().toLowerCase()).filter(Boolean);
  // An empty cell…
  if (words.length === 0) {
    // …means "do not check formatting".
    return undefined;
  }
  // Find the first word that is not one of the allowed words.
  const unknown = words.find((word) => !FORMAT_WORDS.includes(word));
  // If there is one (e.g. a typo like "Bld")…
  if (unknown) {
    // …stop and say which word and which row are wrong.
    throw new Error(`Unknown Format "${unknown}" at row ${rowNumber} of ${WORKBOOK_FILE}. Use Bold, Italic, Underline or Normal.`);
  }
  // Each style is on only if its word is listed. "Normal" lists none, so all three are off.
  return { bold: words.includes('bold'), italic: words.includes('italic'), underline: words.includes('underline') };
}

// Reads the whole sheet once and returns every row, keyed by "screen|key".
async function loadEntries(): Promise<Map<string, ExpectedEntry & { screen: string }>> {
  // Create an empty workbook object.
  const workbook = new Workbook();
  // Load the .xlsx file from disk into it.
  await workbook.xlsx.readFile(WORKBOOK_FILE);
  // Get the sheet (tab) by its name.
  const sheet = workbook.getWorksheet(SHEET_NAME);
  // If the sheet does not exist…
  if (!sheet) {
    // …stop with a clear error.
    throw new Error(`Sheet "${SHEET_NAME}" not found in ${WORKBOOK_FILE}.`);
  }

  // Map from header text to column number, e.g. "Screen" → 1.
  const columns = new Map<string, number>();
  // Read row 1 (the headers) and remember the column number of each header.
  sheet.getRow(1).eachCell((cell, column) => columns.set(cell.text.trim(), column));
  // Find the column numbers of the three required headers…
  const [screenColumn, keyColumn, textColumn] = [SCREEN_HEADER, KEY_HEADER, TEXT_HEADER].map((header) => {
    // Look up this header's column number.
    const column = columns.get(header);
    // If the header is missing from row 1…
    if (!column) {
      // …stop and name the missing column.
      throw new Error(`Column "${header}" not found in row 1 of sheet "${SHEET_NAME}" in ${WORKBOOK_FILE}.`);
    }
    // Otherwise return its number.
    return column;
  });
  // The Format column is optional: undefined if the sheet has no "Format" header.
  const formatColumn = columns.get(FORMAT_HEADER);

  // The rows we will return, keyed by "screen|key".
  const result = new Map<string, ExpectedEntry & { screen: string }>();
  // Go through every row of the sheet.
  sheet.eachRow((row, rowNumber) => {
    // Read this row's Screen cell as text.
    const screen = row.getCell(screenColumn).text;
    // Read this row's Key cell as text.
    const key = row.getCell(keyColumn).text;
    // Skip the header row and any row with an empty Screen or Key.
    if (rowNumber === 1 || !screen.trim() || !key.trim()) {
      // Move on to the next row.
      return;
    }
    // Build the look-up id for this row.
    const id = entryId(screen, key);
    // If the same Screen + Key was already seen…
    if (result.has(id)) {
      // …stop: duplicates would make the expected text ambiguous.
      throw new Error(`Duplicate Screen "${screen}" + Key "${key}" at row ${rowNumber} of ${WORKBOOK_FILE}.`);
    }
    // Store the row.
    result.set(id, {
      // Screen name without surrounding spaces.
      screen: screen.trim(),
      // Key without surrounding spaces.
      key: key.trim(),
      // Expected wording without surrounding spaces.
      text: row.getCell(textColumn).text.trim(),
      // Parsed formatting, or undefined when the sheet has no Format column.
      format: formatColumn ? parseFormat(row.getCell(formatColumn).text, rowNumber) : undefined,
    });
  });
  // Hand back every row.
  return result;
}

// Public way to read expected text. All methods are `static`: call them as ExcelReader.get(...), no `new` needed.
export class ExcelReader {
  // Screen and Key are matched ignoring case and surrounding spaces.
  // Returns only the expected wording of one row.
  static async get(screen: string, key: string): Promise<string> {
    // Read the full row and return its text.
    return (await ExcelReader.getEntry(screen, key)).text;
  }

  // Returns the full row (key, text, format) for one Screen + Key.
  static async getEntry(screen: string, key: string): Promise<ExpectedEntry> {
    // Load the workbook on the first call only (`??=` assigns only if `entries` is still undefined).
    entries ??= loadEntries();
    // Wait for the rows, then look up this Screen + Key.
    const entry = (await entries).get(entryId(screen, key));
    // If there is no such row, or its Text is empty…
    if (!entry?.text) {
      // …stop and name the missing Screen and Key.
      throw new Error(`No expected text for Screen "${screen}", Key "${key}" in sheet "${SHEET_NAME}" of ${WORKBOOK_FILE}.`);
    }
    // Hand back the row.
    return entry;
  }

  // Every row of the screen whose Key starts with keyPrefix (e.g. "Help text" → "Help text 1", "Help text 2"…),
  // in sheet row order.
  static async list(screen: string, keyPrefix: string): Promise<ExpectedEntry[]> {
    // Load the workbook on the first call only.
    entries ??= loadEntries();
    // The id that every matching row's id starts with, e.g. "verify address|help text".
    const prefix = entryId(screen, keyPrefix);
    // Take all [id, row] pairs, keep those whose id starts with the prefix, and return just the rows.
    const found = [...(await entries).entries()].filter(([id]) => id.startsWith(prefix)).map(([, entry]) => entry);
    // If nothing matched…
    if (found.length === 0) {
      // …stop and say what was looked for.
      throw new Error(`No rows for Screen "${screen}" with a Key starting "${keyPrefix}" in sheet "${SHEET_NAME}" of ${WORKBOOK_FILE}.`);
    }
    // Hand back the matching rows, in sheet order.
    return found;
  }
}
