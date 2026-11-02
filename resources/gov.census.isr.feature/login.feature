Feature: Census Login

  As a group quarters respondent
  I want to enter my 12-digit Census ID
  So that I can access my 2026 Census Test questionnaire

  Background:
    Given the respondent is on the 2026 Census Test welcome page

  Scenario: Respondent logs in with a valid Census ID
    When the respondent enters a valid Census ID
    And the respondent clicks the Log In button
    Then the respondent sees the questionnaire landing page

  Scenario: Respondent is warned about an invalid Census ID
    When the respondent enters an invalid Census ID
    And the respondent clicks the Log In button
    Then the respondent sees a warning validation error
