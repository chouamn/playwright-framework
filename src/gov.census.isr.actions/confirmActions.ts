// Type of the browser tab.
import { Page } from '@playwright/test';
// The page object for the Confirm screen.
import { ConfirmPage } from '../gov.census.isr.pages/confirmPage';
// The shared workflows every questionnaire screen inherits.
import { BaseQuestionActions } from './baseQuestionActions';
// `import type` is erased at compile time, so this does not create a runtime cycle with ActionContext
import type { StepLogger } from '../gov.census.isr.utils/actionContext';

// Shared workflows come from BaseQuestionActions; add Confirm-only workflows here.
export class ConfirmActions extends BaseQuestionActions {
  // Created once per scenario by ActionContext.
  constructor(page: Page, log: StepLogger) {
    // Hand the base class this screen's page object, the report logger, and its name in Excel ("Confirm").
    super(new ConfirmPage(page), log, 'Confirm');
  }
}
