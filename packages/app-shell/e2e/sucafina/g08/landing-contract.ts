// Selectors for the actual SfTeamWebApp. The component contract control renders the real page.
// These are DOM locators only; neither this module nor a visible link supplies authorization.
export const landing = Object.freeze({
  shell: "[data-sf-teams-shell]",
  picker: "[data-sf-teams-shell] main select",
  dashboard: '[data-sf-teams-shell] main a[href$="/dashboard"]',
  refresh: "[data-sf-teams-shell] main > button:not([data-sf-admin-toggle])",
  adminToggle: "[data-sf-admin-toggle]",
  administration: "[data-sf-team-administration]",
  adminRead: "[data-sf-admin-read]",
  adminRow: "[data-sf-admin-team]",
  newChat: "[data-sf-new-chat]",
  workspace: "[data-sf-session-workspace]",
  editor: '[data-component="prompt-input-v2"] [data-component="prompt-input"]',
  discardDialog: "dialog[data-sf-draft-guard]",
  keepEditing: "[data-sf-keep-editing]",
  confirmDiscard: "[data-sf-confirm-discard]",
  logout: "[data-sf-teams-shell] header button",
})
