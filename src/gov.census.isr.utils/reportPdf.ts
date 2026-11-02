// Chromium is used to turn the HTML summary into a PDF ("print to PDF").
import { chromium } from '@playwright/test';
// Node's file-system module: check, read and write files.
import * as fs from 'fs';
// Node's `path` module builds file paths that work on Windows and macOS.
import * as path from 'path';

// Builds reports/test-report.pdf from the Cucumber JSON report: logo, totals, pass/fail chart,
// one row per scenario, and the error + screenshot for each failure.
// Run after a test run: `npm run report:pdf` (or `npm run report`, which also builds Allure).

// The project root: two folders up from this file (src/gov.census.isr.utils).
const ROOT = path.resolve(__dirname, '../..');
// Input: the JSON results Cucumber writes on every run.
const JSON_REPORT = path.join(ROOT, 'reports/cucumber-report.json');
// Output: the PDF this script creates.
const PDF_REPORT = path.join(ROOT, 'reports/test-report.pdf');
// Logo printed at the top of the PDF (optional; skipped if the file is missing).
const LOGO = path.join(ROOT, 'assets/logo.png');

// Every result status Cucumber can give a step.
type Status = 'passed' | 'failed' | 'skipped' | 'undefined' | 'pending' | 'ambiguous';

// The parts of one step in Cucumber's JSON report that we use.
interface JsonStep {
  // "Given", "When", "Then", "And" …
  keyword: string;
  // The step text (missing for hook entries).
  name?: string;
  // true for hook entries (Before/After), which are not real steps.
  hidden?: boolean;
  // Pass/fail status, duration in nanoseconds, and the error text if it failed.
  result: { status: Status; duration?: number; error_message?: string };
  // Attachments, e.g. the failure screenshot as base64 text.
  embeddings?: { data: string; mime_type: string }[];
}

// The parts of one feature in Cucumber's JSON report that we use.
interface JsonFeature {
  // Feature name, e.g. "Census Confirm Address".
  name: string;
  // Its scenarios (and backgrounds), each with its steps.
  elements: { name: string; type: string; steps: JsonStep[] }[];
}

// One row of the PDF's scenario table.
interface ScenarioRow {
  // Feature name.
  feature: string;
  // Scenario name.
  name: string;
  // Overall status of the scenario.
  status: Status;
  // Total duration in milliseconds.
  durationMs: number;
  // Failed step and its error message (only for failed scenarios).
  error?: string;
  // Base64 PNG screenshots attached to the scenario.
  screenshots: string[];
}

// Colour of each status in the chart and the status pills.
const STATUS_COLORS: Record<string, string> = { passed: '#1d6b42', failed: '#b42318', other: '#8a94a6' };

// Makes text safe to put inside HTML (so "<" in an error message is shown, not treated as a tag).
function escapeHtml(text: string): string {
  // Replace the four characters that have a special meaning in HTML.
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Works out one status for a whole scenario from its steps' statuses.
function scenarioStatus(steps: JsonStep[]): Status {
  // List the status of every step.
  const statuses = steps.map((step) => step.result.status);
  // Check the "bad" statuses in order of importance…
  for (const status of ['failed', 'ambiguous', 'undefined', 'pending'] as const) {
    // …and if any step has this status…
    if (statuses.includes(status)) {
      // …that is the scenario's status.
      return status;
    }
  }
  // No bad status: "passed" if every step passed, otherwise "skipped".
  return statuses.every((status) => status === 'passed') ? 'passed' : 'skipped';
}

// Reads Cucumber's JSON report and turns it into one row per scenario.
function readScenarios(): ScenarioRow[] {
  // If the tests have not been run yet, there is no report to read…
  if (!fs.existsSync(JSON_REPORT)) {
    // …so stop and say what to do.
    throw new Error(`No Cucumber JSON report at ${JSON_REPORT}. Run the tests first: npm test`);
  }
  // Read the report file and parse the JSON into objects.
  const features: JsonFeature[] = JSON.parse(fs.readFileSync(JSON_REPORT, 'utf-8'));
  // For every feature, produce its scenario rows, and join them all into one list.
  return features.flatMap((feature) =>
    feature.elements
      // Keep real scenarios only (drop "background" entries).
      .filter((element) => element.type === 'scenario')
      // Turn each scenario into a ScenarioRow.
      .map((scenario) => {
        // The first failed step, if any.
        const failedStep = scenario.steps.find((step) => step.result.status === 'failed');
        // Build the row.
        return {
          // Feature name.
          feature: feature.name,
          // Scenario name.
          name: scenario.name,
          // One status for the whole scenario.
          status: scenarioStatus(scenario.steps),
          // Cucumber reports durations in nanoseconds
          // Add up every step's duration and convert nanoseconds to milliseconds.
          durationMs: scenario.steps.reduce((total, step) => total + (step.result.duration ?? 0), 0) / 1e6,
          // For a failure: "Then <step text>" followed by the error message on the next line.
          error: failedStep && `${failedStep.keyword.trim()} ${failedStep.name ?? ''}\n${failedStep.result.error_message ?? ''}`,
          // Collect every attachment from every step…
          screenshots: scenario.steps
            .flatMap((step) => step.embeddings ?? [])
            // …keep only PNG images…
            .filter((embedding) => embedding.mime_type === 'image/png')
            // …and take their base64 data.
            .map((embedding) => embedding.data),
        };
      }),
  );
}

// Donut chart of passed / failed / other, drawn as SVG circle segments
// Returns the chart as SVG markup (text), which is placed inside the report's HTML.
function donut(counts: { passed: number; failed: number; other: number }, total: number): string {
  // Radius of the ring, in SVG units.
  const radius = 54;
  // Length of the ring's outline (2πr); each status gets a share of it.
  const circumference = 2 * Math.PI * radius;
  // How far round the ring the next segment starts.
  let offset = 0;
  // Build one ring segment per status…
  const segments = (['passed', 'failed', 'other'] as const)
    // …skipping statuses with no scenarios…
    .filter((key) => counts[key] > 0)
    .map((key) => {
      // This status's share of the ring.
      const length = (counts[key] / total) * circumference;
      // An SVG circle whose dashed outline draws only this share, starting at `offset`, rotated to start at 12 o'clock.
      const segment =`<circle r="${radius}" cx="70" cy="70" fill="none" stroke="${STATUS_COLORS[key]}" stroke-width="22"
        stroke-dasharray="${length} ${circumference - length}" stroke-dashoffset="${-offset}" transform="rotate(-90 70 70)"/>`;
      // The next segment starts where this one ends.
      offset += length;
      // Hand back this segment's markup.
      return segment;
    });
  // Percentage of scenarios that passed, rounded (0 when there are no scenarios, to avoid dividing by zero).
  const passRate = total ? Math.round((counts.passed / total) * 100) : 0;
  // The SVG: a grey background ring, the coloured segments on top, and the pass rate written in the middle.
  return `<svg width="140" height="140" viewBox="0 0 140 140" role="img" aria-label="${passRate}% passed">
    <circle r="${radius}" cx="70" cy="70" fill="none" stroke="#e6e9ef" stroke-width="22"/>${segments.join('')}
    <text x="70" y="68" text-anchor="middle" font-size="24" font-weight="700" fill="#18212e">${passRate}%</text>
    <text x="70" y="88" text-anchor="middle" font-size="11" fill="#556173">passed</text></svg>`;
}

// Builds the full HTML page of the report; main() prints it to PDF.
function buildHtml(scenarios: ScenarioRow[]): string {
  // How many scenarios have each status.
  const counts = {
    // Number that passed.
    passed: scenarios.filter((s) => s.status === 'passed').length,
    // Number that failed.
    failed: scenarios.filter((s) => s.status === 'failed').length,
    // Number with any other status (skipped, undefined, pending, ambiguous).
    other: scenarios.filter((s) => s.status !== 'passed' && s.status !== 'failed').length,
  };
  // Total run time: the sum of every scenario's duration, in milliseconds.
  const totalMs = scenarios.reduce((total, s) => total + s.durationMs, 0);
  // If the logo file exists, embed it in the HTML as base64 text; otherwise show no logo.
  const logo = fs.existsSync(LOGO) ? `<img class="logo" src="data:image/png;base64,${fs.readFileSync(LOGO).toString('base64')}" alt="Company logo">` : '';
  // Today's date and time in US format, e.g. "November 2, 2026 at 1:11 PM".
  const generated = new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' });

  // One HTML table row per scenario: feature, scenario, coloured status pill, duration in seconds.
  const rows = scenarios
    .map((s) => `<tr><td>${escapeHtml(s.feature)}</td><td>${escapeHtml(s.name)}</td>
      <td><span class="pill ${s.status}">${s.status}</span></td><td class="num">${(s.durationMs / 1000).toFixed(1)} s</td></tr>`)
    // Join the rows into one block of HTML.
    .join('');

  // One HTML section per failed scenario: its name, the first 12 lines of the error, and its screenshots.
  const failures = scenarios
    // Only failed scenarios.
    .filter((s) => s.status === 'failed')
    .map((s) => `<section class="failure"><h3>${escapeHtml(s.name)}</h3>
      <pre>${escapeHtml((s.error ?? '').split('\n').slice(0, 12).join('\n'))}</pre>
      ${s.screenshots.map((data) => `<img src="data:image/png;base64,${data}" alt="Screenshot at failure">`).join('')}</section>`)
    // Join the sections into one block of HTML.
    .join('');

  // The complete page. Inside the template: <style> holds the CSS (fonts, colours, table and pill styles);
  // <header> shows the title, generated date and logo; .summary shows the donut chart and the totals;
  // then the scenario table, then the Failures section (only if something failed).
  // `${...}` inserts the values calculated above.
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Census Login test report</title><style>
    body { font: 13px/1.5 "Segoe UI", Arial, sans-serif; color: #18212e; margin: 0; }
    header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #1d4f91; padding-bottom: 12px; }
    h1 { font-size: 22px; margin: 0; } h2 { font-size: 16px; margin: 24px 0 8px; } h3 { font-size: 14px; margin: 0 0 6px; }
    .logo { max-height: 56px; max-width: 220px; }
    .meta { color: #556173; margin: 4px 0 0; }
    .summary { display: flex; gap: 32px; align-items: center; margin-top: 16px; }
    .totals { display: grid; grid-template-columns: repeat(4, auto); gap: 4px 28px; }
    .totals b { display: block; font-size: 22px; }
    .totals span { color: #556173; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; }
    table { width: 100%; border-collapse: collapse; } th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #dbe1ea; }
    th { font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: #556173; background: #f1f4f8; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .pill { font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 2px 8px; border-radius: 10px; color: #fff; background: ${STATUS_COLORS.other}; }
    .pill.passed { background: ${STATUS_COLORS.passed}; } .pill.failed { background: ${STATUS_COLORS.failed}; }
    .failure { break-inside: avoid; border: 1px solid #f0c7c2; border-left: 4px solid ${STATUS_COLORS.failed}; padding: 10px 12px; margin-bottom: 12px; }
    .failure pre { white-space: pre-wrap; font: 11px/1.4 Consolas, monospace; background: #fbf3f2; padding: 8px; margin: 0 0 8px; }
    .failure img { max-width: 100%; border: 1px solid #dbe1ea; }
  </style></head><body>
    <header><div><h1>Census Login test report</h1><p class="meta">Generated ${escapeHtml(generated)}</p></div>${logo}</header>
    <div class="summary">${donut(counts, scenarios.length)}
      <div class="totals"><div><b>${scenarios.length}</b><span>Scenarios</span></div><div><b>${counts.passed}</b><span>Passed</span></div>
      <div><b>${counts.failed}</b><span>Failed</span></div><div><b>${(totalMs / 1000).toFixed(1)} s</b><span>Duration</span></div></div></div>
    <h2>Scenarios</h2>
    <table><thead><tr><th>Feature</th><th>Scenario</th><th>Status</th><th class="num">Duration</th></tr></thead><tbody>${rows}</tbody></table>
    ${failures ? `<h2>Failures</h2>${failures}` : ''}
  </body></html>`;
}

// Reads the results, builds the HTML, and prints it to reports/test-report.pdf.
async function main(): Promise<void> {
  // Read the scenarios from Cucumber's JSON report and build the report page.
  const html = buildHtml(readScenarios());
  // Start a hidden Chromium browser (needed to print HTML to PDF).
  const browser = await chromium.launch();
  // `try … finally` makes sure the browser is closed even if printing fails.
  try {
    // Open a blank tab.
    const page = await browser.newPage();
    // Load our HTML into the tab and wait until it (including images) has loaded.
    await page.setContent(html, { waitUntil: 'load' });
    // Print the tab to PDF.
    await page.pdf({
      // Where to save the PDF.
      path: PDF_REPORT,
      // Paper size.
      format: 'A4',
      // Keep background colours (status pills, chart).
      printBackground: true,
      // Page margins.
      margin: { top: '16mm', bottom: '16mm', left: '14mm', right: '14mm' },
      // Turn on the header/footer area so we can add page numbers.
      displayHeaderFooter: true,
      // Empty header.
      headerTemplate: '<span></span>',
      // Footer: "Page X of Y", centred, small grey text.
      footerTemplate: '<div style="font-size:9px;color:#8a94a6;width:100%;text-align:center">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>',
    });
  } finally {
    // Close the browser.
    await browser.close();
  }
  // Print where the PDF was saved.
  console.log(`PDF report: ${PDF_REPORT}`);
}

// Cucumber loads every file in this folder before a test run (see cucumber.json), so only build the PDF
// when this file is started directly, not when it is merely loaded.
// `require.main === module` is true only when this file was started directly (npm run report:pdf).
if (require.main === module) {
  // Build the PDF; if anything goes wrong…
  main().catch((error) => {
    // …print the error…
    console.error(error);
    // …and exit with code 1, so the command is reported as failed.
    process.exit(1);
  });
}
