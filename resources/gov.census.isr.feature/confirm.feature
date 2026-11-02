Feature: Census Confirm Address

  As a group quarters respondent
  I want to confirm the address shown after I log in
  So that I complete the 2026 Census Test questionnaire for the correct address

  Background:
    Given the respondent is on the 2026 Census Test welcome page
    When the respondent enters a valid Census ID
    And the respondent clicks the Log In button
    Then the respondent sees the questionnaire landing page

  Scenario: Respondent confirms the address and the Confirm screen text matches Excel
    When the respondent selects Yes to confirm the address
    Then the Confirm screen text matches the expected text in Excel
