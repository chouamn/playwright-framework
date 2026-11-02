// `dotenv` reads a .env-style file and copies its KEY=value lines into `process.env`.
import * as dotenv from 'dotenv';
// Node's `path` module builds file paths that work on Windows and macOS.
import * as path from 'path';

// Resolve from the project root so the suite works no matter which directory it is started from.
// `__dirname` is the folder of this file (src/gov.census.isr.utils); '../..' goes up to the project root.
const ENV_FILE = path.resolve(__dirname, '../../.env.uat');

// Values already set in the shell win over the file, e.g. `$env:HEADLESS='true'; npm test`.
// Load .env.uat into process.env now, once, when this file is first imported. `quiet` hides dotenv's console message.
dotenv.config({ path: ENV_FILE, quiet: true });

// The only browser names Playwright supports. Used as the return type of getBrowserName().
export type BrowserName = 'chromium' | 'firefox' | 'webkit';

// The only class that knows the .env.uat key names. Everyone else calls these getters.
export class ConfigReader {
  // Returns a required value, or stops the run with a clear error if it is missing.
  // `private` means only this class can call it; `static` means no object has to be created (ConfigReader.x()).
  private static getEnvVar(key: string): string {
    // Read the value from the environment (filled from .env.uat or the shell).
    const value = process.env[key];
    // If the key is missing or empty…
    if (!value) {
      // …fail immediately and say exactly which key and which file to check.
      throw new Error(`Missing required environment variable: ${key}. Check ${ENV_FILE}.`);
    }
    // Otherwise hand the value back to the caller.
    return value;
  }

  // The login page URL of the environment under test (required).
  static getBaseUrl(): string {
    // Read BASE_URL from .env.uat.
    return ConfigReader.getEnvVar('BASE_URL');
  }

  // A 12-digit test Census ID that can log in (required).
  static getValidCensusId(): string {
    // Read CENSUS_ID_VALID from .env.uat.
    return ConfigReader.getEnvVar('CENSUS_ID_VALID');
  }

  // A Census ID that must be rejected (required).
  static getInvalidCensusId(): string {
    // Read CENSUS_ID_INVALID from .env.uat.
    return ConfigReader.getEnvVar('CENSUS_ID_INVALID');
  }

  // Optional: defaults to headed so selectors can be watched while they are being verified.
  static isHeadless(): boolean {
    // Use HEADLESS if set, otherwise 'false'; only the text "true" (any case) turns headless mode on.
    return (process.env.HEADLESS ?? 'false').toLowerCase() === 'true';
  }

  // Optional: defaults to chromium.
  static getBrowserName(): BrowserName {
    // Use BROWSER if set, otherwise 'chromium', in lower case so "Firefox" also works.
    const name = (process.env.BROWSER ?? 'chromium').toLowerCase();
    // Reject anything Playwright cannot launch…
    if (name !== 'chromium' && name !== 'firefox' && name !== 'webkit') {
      // …with a message listing the allowed values.
      throw new Error(`Unsupported BROWSER "${name}". Use chromium, firefox or webkit.`);
    }
    // At this point TypeScript knows `name` is one of the three allowed values.
    return name;
  }
}
