// The shared base class with everything a standard questionnaire screen needs.
import { BaseQuestionPage } from './baseQuestionPage';

// "VERIFY ADDRESS" screen, reached by answering Yes on Confirm: "On <Census Day>, will you be living or staying at <address>?"
// Everything it needs is in BaseQuestionPage; add Verify Address-only locators and methods here.
// `extends` means VerifyAddressPage inherits every method of BaseQuestionPage; `{}` means it adds nothing yet.
export class VerifyAddressPage extends BaseQuestionPage {}
