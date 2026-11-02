// The shared base class with everything a standard questionnaire screen needs.
import { BaseQuestionPage } from './baseQuestionPage';

// "CONFIRM" screen shown right after login: "Are you completing the ... questionnaire for the address below?"
// Everything it needs is in BaseQuestionPage; add Confirm-only locators and methods here.
// `extends` means ConfirmPage inherits every method of BaseQuestionPage; `{}` means it adds nothing yet.
export class ConfirmPage extends BaseQuestionPage {}
