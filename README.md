# census-login-kt

BDD test suite for the **2026 Census Test** respondent login flow, covering the
"enter a 12-digit Census ID" screen and the questionnaire screens that follow, in the UAT test environment.

**New to the framework?** Read the KT guide in [`docs/Census-Automation-Framework-KT-Guide.docx`](docs/Census-Automation-Framework-KT-Guide.docx).

Built with **Cucumber.js** + **Playwright** + **TypeScript**.

## Stack

| Tool | Role |
|---|---|
| [Cucumber.js](https://github.com/cucumber/cucumber-js) | Runs Gherkin `.feature` files against TypeScript step definitions |
| [Playwright](https://playwright.dev/) | Drives a real browser (headed Chromium by default) and provides `expect` assertions |
| TypeScript + `ts-node` | Steps/pages/config are written in TS and run directly, no build step |
| `dotenv` | Loads test data from `.env.uat` into `process.env` |

## Project layout

```
census-login-kt/
├── .env.uat                                   # your test data: URL, Census IDs (gitignored — never commit)
├── .env.uat.example                           # committed template for .env.uat
├── cucumber.json                               # wires everything together + report output
├── playwright.config.ts                        # browser/context settings, read by hook.ts
├── docs/                                       # KT guide (architecture, class reference, setup)
├── reports/                                    # generated per run, gitignored (HTML/JSON report, traces)
├── resources/
│   ├── gov.census.isr.feature/
│   │   ├── login.feature                       # the spec, in plain English
│   │   ├── confirm.feature                     # CONFIRM (address) screen, reached after a valid login
│   │   └── verifyAddress.feature               # VERIFY ADDRESS screen, reached by answering Yes on Confirm
│   └── gov.census.isr.testdata/
│       └── expectedText.xlsx                   # expected help text + error messages, per screen
└── src/
    ├── gov.census.isr.pages/
    │   ├── loginPage.ts                         # Page Object — private locators + raw interactions + assertions
    │   ├── baseQuestionPage.ts                  # shared base (not a screen): heading, question, Help popup, Yes/No, Next
    │   ├── confirmPage.ts                       # CONFIRM screen (extends BaseQuestionPage)
    │   └── verifyAddressPage.ts                 # VERIFY ADDRESS screen (extends BaseQuestionPage)
    ├── gov.census.isr.actions/
    │   ├── loginActions.ts                      # business-logic layer — composes LoginPage calls, owns test-data lookup
    │   ├── baseQuestionActions.ts               # shared base (not a screen): select Yes/No, Next, check screen text against Excel
    │   ├── confirmActions.ts                    # Confirm screen (Screen = "Confirm" in Excel)
    │   └── verifyAddressActions.ts              # Verify Address screen (Screen = "Verify Address" in Excel)
    ├── gov.census.isr.steps/
    │   ├── loginSteps.ts                        # step definitions — glue between feature and actions
    │   ├── confirmSteps.ts                      # Confirm screen step definitions
    │   └── verifyAddressSteps.ts                # Verify Address screen step definitions
    └── gov.census.isr.utils/
        ├── actionContext.ts                     # groups every Action class (this.actions) + the StepLogger type
        ├── hook.ts                              # hooks — browser/context lifecycle, failure screenshot + trace, step logging
        ├── configReader.ts                      # reads .env.uat, one method per value
        ├── customWorld.ts                       # per-scenario state container (Cucumber World)
        ├── excelReader.ts                       # reads expectedText.xlsx: ExcelReader.get(screen, key)
        ├── reportPdf.ts                         # `npm run report:pdf` — PDF summary built from the Cucumber JSON report
        └── timeouts.ts                          # every timeout in one place + the shared `expect`
```

The `gov.census.isr.*` folder naming follows a reverse-DNS convention (mirroring the
Java package style used elsewhere in the Census test tooling), not a TypeScript default.

## How it fits together

```
login.feature  →  loginSteps.ts  →  loginActions.ts  →  loginPage.ts  →  configReader.ts  →  .env.uat
   (spec)          (glue)            (business logic)    (page object)    (config reader)    (data)
```

1. **`login.feature`** describes the two scenarios (valid ID → landing page, invalid ID →
   warning) in Gherkin. Cucumber matches each line to a step definition by text.
2. **`hook.ts`** holds the hooks. The browser is launched once (`BeforeAll`); every
   scenario gets a fresh, isolated browser context and page stored on `this` (the scenario's
   `CustomWorld`), with Playwright tracing running. After each step the current URL is logged
   into the report. When a scenario fails, a full-page screenshot is attached to the report
   and the trace is saved to `reports/traces/`. The context is always closed afterward.
3. **`loginSteps.ts`** implements each Given/When/Then. It never touches Playwright or
   `LoginPage` directly — it only calls methods on `this.actions.login`.
4. **`loginActions.ts`** is the business-logic layer: it owns a `LoginPage` instance internally
   and exposes workflow-level methods (`enterValidCensusId`, `submitLogin`, `verifyLoginSuccess`,
   `verifyValidationWarning`). This is also where test data gets pulled from `ConfigReader` and
   handed to the page object — steps never see `ConfigReader` either. It also logs the data it
   used into the report (the valid Census ID is masked to its last 4 digits). If a scenario later needs
   a multi-step workflow (e.g. "log in and submit the first questionnaire page"), it gets named
   once here and reused, instead of being assembled inline in a step.
5. **`loginPage.ts`** is the Page Object: it owns every locator (all `private`) and exposes raw
   actions (`enterCensusId`, `clickLogin`, `goto`) and assertions
   (`assertQuestionnaireLandingVisible`, `assertWarningVisible`, `assertWarningMessage`).
   If a selector ever changes, this is the only file that needs to change. Assertions use
   Playwright's web-first `expect` (imported from `timeouts.ts`), which retries until the
   condition is met — never `isVisible()`/`isEnabled()` snapshots, which don't wait.
6. **`configReader.ts`** is the single place that knows the `.env.uat` key names. `LoginActions`
   asks it for a value (`ConfigReader.getBaseUrl()`, `.getValidCensusId()`, etc.) instead of
   hardcoding strings.
7. **`.env.uat`** holds the actual values. It is **not committed** (it's in `.gitignore`): each
   person creates their own from `.env.uat.example`. Update a Census ID or point the suite at a
   different URL there, with no code change required.

Three layers, three jobs — each only talks to the one directly below it:

| Layer | Knows about | Never touches |
|---|---|---|
| `loginSteps.ts` | `LoginActions` | Playwright, `LoginPage`, `ConfigReader` |
| `loginActions.ts` | `LoginPage`, `ConfigReader` | Playwright locators directly |
| `loginPage.ts` | Playwright locators | `ConfigReader` (except `goto()`'s base URL) |

## Why a `CustomWorld`

Cucumber creates a fresh **World** instance per scenario and binds it as `this` inside every
step (using `function`, not arrow functions, so `this` binds correctly). `CustomWorld`
(`customWorld.ts`) extends that World to hold `context`, `page`, and `actions` (an
`ActionContext` that groups every Action class, e.g. `this.actions.login`).

Before this was added, the browser `page` lived in a single module-level `let page` shared by
every scenario. `CustomWorld` fixes that:

- Each scenario gets its **own** context/`page`/`actions` — no shared state between scenarios
  (cookies, storage and sessions are isolated per context).
- It's safe to run scenarios in **parallel** later; a shared module-level variable is not.
- State lives in one typed place (`this.page`, `this.actions`) instead of scattered imports.
- Adding a new Action class means adding one property to `ActionContext` — `CustomWorld`
  itself doesn't grow.

## Setup

```bash
npm install
npx playwright install chromium   # downloads the browser binary; one-time
```

## Configuration (`.env.uat`)

Create your own `.env.uat` from the committed template, then fill in the values from the team lead:

```powershell
Copy-Item .env.uat.example .env.uat    # PowerShell (macOS / Git Bash: cp .env.uat.example .env.uat)
```

```
BASE_URL=<UAT login URL>
CENSUS_ID_VALID=<12-digit test Census ID>
CENSUS_ID_INVALID=000000000000
```

Never commit `.env.uat` or post real Census IDs in chat, email or tickets.

`ConfigReader` throws a clear error naming the missing key if any of these aren't set, so a
misconfigured environment fails fast instead of silently using `undefined`. The file is
resolved from the project root, so the suite can be started from any directory.

On-screen text (help text, error messages) is not kept here. It lives in the Excel workbook below.

## Expected text (`expectedText.xlsx`)

`resources/gov.census.isr.testdata/expectedText.xlsx`, sheet **`ExpectedText`**, one row per text:

| Screen | Key | Type | Text | Format |
|---|---|---|---|---|
| Login | Invalid Census ID warning | Error | Please enter a valid 12-digit Census ID | |
| Verify Address | Heading | Label | VERIFY ADDRESS | Bold |
| Verify Address | Help text 4 | Help | Why do we ask about December 31, 1969? | Bold |

- `Screen` + `Key` identify the row (case and surrounding spaces are ignored). Each pair must be unique.
- `Text` is the expected wording. For the Login warning the page text must *contain* it.
- `Format` (optional): `Bold`, `Italic`, `Underline`, combined with commas (`Bold, Underline`), or
  `Normal`. Listed styles must be on, the others off. Empty means formatting is not checked.
- `Type` (Help, Error, Label …) is for people filtering the sheet. The code ignores it, as it does any
  extra column you add. Columns are found by their header text, so their order doesn't matter.

**Question screens** (`BaseQuestionActions.verifyScreenText()`) check text *exactly as the user sees it*:

- Each row must match a whole rendered line: same words, punctuation, quote style and spaces. CSS
  uppercase is applied first, so a heading styled uppercase is typed in capitals.
- Lines must appear in order: Heading → Question + Help link (same line) → Yes → No → Next, then in
  the popup Help title → `Help text 1`, `Help text 2`… → Close.
- One row per Help paragraph, keyed `Help text 1`, `Help text 2`… in sheet order. They must follow
  each other directly, so a merged or split paragraph fails.
- The size of the gap between paragraphs is not checked (that needs screenshot comparison).

An Actions class reads a value with `await ExcelReader.get('Login', 'Invalid Census ID warning')`.
A missing sheet, column or row fails the step with an error naming exactly what is missing. The
workbook is read once per run.

Optional settings (set in `.env.uat` or in the shell — the shell wins):

| Key | Default | Values |
|---|---|---|
| `HEADLESS` | `false` | `true` / `false` |
| `BROWSER` | `chromium` | `chromium`, `firefox`, `webkit` |

### `playwright.config.ts`

Cucumber stays the test runner (`npm test`); Playwright's own runner is not used. The config's
`use` block is where browser and context settings live (browser, headless, `baseURL`, viewport,
action/navigation timeouts). `hook.ts` launches the browser and creates each scenario's
context from it, so a setting changed there applies to every scenario. Its values still come from
`.env.uat` and `timeouts.ts`. `testDir: './tests'` only matters if Playwright-native `*.spec.ts`
files are ever added and run with `npx playwright test`.

## Running the tests

```powershell
npm test                                                     # whole suite, headed Chromium
npm test -- --tags "@smoke"                                  # by tag (once scenarios are tagged)
npm test -- resources/gov.census.isr.feature/login.feature:10  # one scenario, by line
$env:HEADLESS='true'; npm test                               # headless (PowerShell)
$env:BROWSER='firefox'; npm test                             # another browser
npm run test:rerun                                           # only the scenarios that failed last run
npm run report                                               # build the Allure report + PDF after a run
npm run report:open                                          # serve the Allure report in the browser
npm run typecheck                                            # TypeScript check, no test run
```

Runs against the live UAT site defined in `.env.uat`. This requires network access to the UAT
environment (VPN / Census network as required).

## Reports and debugging

Every run writes to `reports/` (gitignored):

- `reports/cucumber-report.html` — open in a browser. Each step shows its logs (URL after the
  step, test data used); failed scenarios include a full-page screenshot.
- `reports/cucumber-report.json` — machine-readable results.
- `reports/cucumber-report.xml` — JUnit XML for CI (Jenkins, Azure DevOps, GitLab).
- `@rerun.txt` (project root, gitignored) — the scenarios that did not pass. `npm run test:rerun`
  runs only those. The `@` prefix is how Cucumber recognises a rerun file, so keep the name.
- `reports/allure-results/` — raw Allure data, cleared automatically before each `npm test`.
- `reports/traces/<scenario>-<timestamp>.zip` — saved only for failed scenarios. Open with
  `npx playwright show-trace <file>` to replay every action with DOM snapshots, network and console.

After a run, `npm run report` builds two more:

- `reports/allure-report/index.html` — Allure 3 dashboard (charts, step details, attachments,
  trends). A single file, so it opens straight from disk. Settings are in `allurerc.mjs`.
  Trends come from `reports/allure-history.jsonl`, which each `npm run report` appends to. Keep that
  file between runs, or the trends start over.
- `reports/test-report.pdf` — a summary to email or attach: logo, totals, pass/fail chart, one row per
  scenario, and the error and screenshot for each failure. Built by `src/gov.census.isr.utils/reportPdf.ts` from
  `cucumber-report.json`.

Both reports use `assets/logo.png`. Replace that file with the company logo; no code change is
needed. A square image fits Allure's header best.

Other debugging aids, no code change needed:

- `$env:PWDEBUG='1'; npm test -- <feature>:<line>` — step through with the Playwright Inspector.
- `$env:DEBUG='pw:api'; npm test` — verbose Playwright action log in the console.

Timeouts are defined once in `timeouts.ts`: Cucumber step 60 s, navigation 30 s, actions
15 s, assertions 10 s. The step timeout must stay larger than the Playwright ones so failures
report Playwright's error instead of a generic Cucumber timeout.

## Known gaps / TODOs

These are flagged inline in the code and should be verified against the real UAT page before
relying on this suite for CI:

- **`loginPage.ts`** — `authCodeInput` is assumed to be the accessible name of the Census ID
  field; `page.getByLabel('Census ID (12-digit)')` may be more reliable. `#component54` (the
  questionnaire-landing locator) is a placeholder — confirm whether the real page uses an ID,
  class, or `data-testid`.
- **`expectedText.xlsx`** — the `Login` / `Invalid Census ID warning` text is a placeholder. Update
  it once someone confirms the exact warning shown on the live UAT page, or the invalid-ID
  scenario's message assertion will fail.
- **`baseQuestionPage.ts`** — assumes `Help` is a link, the popup has `role="dialog"`, and Yes/No are
  real radio inputs. The `Confirm` and `Verify Address` rows in `expectedText.xlsx` were typed from
  screenshots, so check the quotes (curly vs straight) and the year against the live page.
- Tests run **headed** by default — useful while selectors are unverified. Set
  `HEADLESS=true` once the suite is stable.

## Adding a new scenario

1. Add the Gherkin scenario to `login.feature`.
2. Add any new step text to `loginSteps.ts`, calling a method on `this.actions.login` — steps
   should never import `LoginPage`, `ConfigReader`, or Playwright itself. Type `this` as
   `CustomWorld` (`async function (this: CustomWorld)`) so mistakes are caught at compile time.
3. If the step needs a new business workflow (e.g. combining several page actions into one
   named operation), add a method to `loginActions.ts`. Log the data it uses with `this.log(...)`.
4. If that workflow needs a new raw interaction or assertion, add a method to `loginPage.ts`
   rather than exposing a new locator. Assert with `expect` from `timeouts.ts`.
5. For a new screen, give it its own `.feature` file. If it has the usual question layout, its page
   object extends `BaseQuestionPage` and its Action class extends `BaseQuestionActions` (copy
   `verifyAddressPage.ts` / `verifyAddressActions.ts`), then add the Action class as a property in
   `actionContext.ts` and add the screen's rows to `expectedText.xlsx`.
6. If the step needs new test data, add a key to `.env.uat` and a matching getter to
   `configReader.ts`, then call it from `loginActions.ts` — not from the step.
7. If the step checks on-screen wording (help text, an error message), add a row to
   `expectedText.xlsx` and read it in the Actions class with `ExcelReader.get(screen, key)`.
