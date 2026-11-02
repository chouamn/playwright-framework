Feature: Census Verify Address

  As a group quarters respondent
  I want to say whether I will be living or staying at my address on Census Day
  So that I am counted where I live and sleep most of the time

  Background:
    Given the respondent is on the 2026 Census Test welcome page
    When the respondent enters a valid Census ID
    And the respondent clicks the Log In button
    Then the respondent sees the questionnaire landing page
    When the respondent selects Yes to confirm the address
    And the respondent clicks Next on the Confirm screen
    Then the respondent sees the Verify Address screen

  Scenario: Verify Address screen text matches Excel
    Then the Verify Address screen text matches the expected text in Excel
