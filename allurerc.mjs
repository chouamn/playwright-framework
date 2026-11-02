// Node's function to read a file from disk.
import { readFileSync } from 'node:fs';
// `defineConfig` gives type-checking and auto-complete for Allure settings.
import { defineConfig } from 'allure';

// Replace assets/logo.png with the company logo; no code change is needed.
// Embedded as a data URI so the single-file report shows it when opened straight from disk.
// Read the logo and turn it into base64 text that can be placed directly in the HTML.
const logo = `data:image/png;base64,${readFileSync('./assets/logo.png').toString('base64')}`;

// The Allure report settings, used by `npm run report:allure` and `npm run report:open`.
export default defineConfig({
  // Report title.
  name: 'Census Login',
  // Where Cucumber's Allure reporter writes the raw results during `npm test`.
  resultsDir: './reports/allure-results',
  // Where the generated HTML report goes.
  output: './reports/allure-report',
  // Every `npm run report` appends this run here; the Trends charts are drawn from it.
  // Keep this file between runs (it lives in the gitignored reports/ folder) or the trends start over.
  historyPath: './reports/allure-history.jsonl',
  // Report plugins (the visual theme).
  plugins: {
    // "Awesome" is Allure 3's standard report theme.
    awesome: {
      // Settings for that theme.
      options: {
        // Name shown in the report header.
        reportName: 'Census Login',
        // Build one self-contained HTML file that opens straight from disk.
        singleFile: true,
        // The logo prepared above.
        logo,
        // Report language.
        reportLanguage: 'en',
      },
    },
  },
});
