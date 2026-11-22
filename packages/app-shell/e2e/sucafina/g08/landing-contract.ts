// Selectors for the actual SfTeamWebApp and native Chat. Locators never supply authorization.
export const landing = Object.freeze({
  shell: "[data-sf-teams-shell]",
  picker: "[data-sf-teams-shell] [data-sf-team-picker]",
  dashboard: '[data-sf-teams-shell] main a[href$="/dashboard"]',
  refresh: "[data-sf-teams-shell] main > button:not([data-sf-admin-toggle])",
  logout: "[data-sf-teams-shell] > header > button",
  adminToggle: "[data-sf-admin-toggle]",
  administration: "[data-sf-team-administration]",
  adminRead: "[data-sf-admin-read]",
  newChat: "[data-sf-new-chat]",
  workspace: "[data-sf-session-workspace]",
  composer: ".sf-team-session-compose",
  transcript: "[data-sf-session-transcript]",
  draftGuard: "[data-sf-draft-guard]",
  keepEditing: "[data-sf-keep-editing]",
  discard: "[data-sf-confirm-discard]",
})
