// Selectors for the actual SfTeamWebApp. The component contract control renders the real page.
// These are DOM locators only; neither this module nor a visible link supplies authorization.
export const landing = Object.freeze({
  shell: "[data-sf-teams-shell]",
  picker: "[data-sf-teams-shell] main select",
  dashboard: '[data-sf-teams-shell] main a[href$="/dashboard"]',
  refresh: "[data-sf-teams-shell] main > button",
  logout: "[data-sf-teams-shell] header button",
})
