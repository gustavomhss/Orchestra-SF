import type { LayoutRoute } from "../context/layout-route"

// Sidebar destinations. Primary items stay visible, Settings keeps the last place, and the entries
// between them sit in one collapsible Advanced group. `wip` marks screens the owner approved as they are but wants
// revisited before production. The mark is for developers: `showWip` hides it in production builds, while `isWip`
// stays the plain data lookup. Every id here has a page in chapterPages, except maestro, which opens a dialog.
export const primaryNavigation = [
  { id: "home", label: "home.title" },
  { id: "chat", label: "orchestra.nav.chat" },
  { id: "inbox", label: "orchestra.inbox.title" },
  // The Projects board Maestro keeps (docs/specs/projects-board), read only for now.
  { id: "board", label: "orchestra.nav.board", wip: true },
  { id: "agents", label: "orchestra.nav.agents", wip: true },
  // Named Actions in the UI (the owner reverted the Checks rename, 2026-10-27); the id stays `cicd`.
  { id: "cicd", label: "orchestra.actions.title", wip: true },
] as const

export const advancedNavigation = [
  // Sucafina F01 native entry routes; still subject to installed owner/context admission.
  { id: "sf-home", label: "sf.ui29.title" },
  { id: "sf-decisions", label: "sf.ui33.title" },
  { id: "sf-dashboard", label: "sf.cap01.title" },
  { id: "sf-people", label: "sf.cap06.title" },
  { id: "sf-operations", label: "sf.cap11.title" },
  { id: "sf-portfolio", label: "sf.cap09.title" },
  { id: "sf-procurement", label: "sf.cap25.title" },
  { id: "sf-planner", label: "sf.cap17.title" },
  { id: "sf-work", label: "sf.ui30.title" },
  { id: "sf-bi", label: "sf.ui45.title" },
  { id: "sf-reviews", label: "sf.ui47.title" },
  { id: "sf-imports", label: "sf.ui55.title" },
  { id: "sf-documents", label: "sf.ui58.title" },
  { id: "sf-memory", label: "sf.ui61.title" },
  { id: "sf-routines", label: "sf.ui64.title" },
  // Session-relative governance (S20), opened as a dialog over the current session; not a route.
  { id: "maestro", label: "orchestra.nav.maestro" },
  // Relay workflows sit next to Maestro, which runs them (owner decision, 2026-10-06).
  { id: "flight-engineer", label: "orchestra.nav.flightEngineer" },
  { id: "workflows", label: "orchestra.nav.workflows" },
  { id: "atlas", label: "orchestra.nav.atlas" },
  { id: "rag-studio", label: "orchestra.nav.ragStudio", wip: true },
  { id: "mcp", label: "orchestra.nav.mcp", wip: true },
  { id: "integrations", label: "orchestra.integrations.title" },
  { id: "skills", label: "orchestra.nav.skills" },
  { id: "plugins", label: "orchestra.nav.plugins" },
  { id: "hooks", label: "orchestra.nav.hooks" },
  { id: "lean", label: "orchestra.nav.lean" },
  { id: "schedule", label: "orchestra.nav.schedule" },
  { id: "env", label: "orchestra.nav.env", wip: true },
  { id: "dock", label: "orchestra.nav.dock" },
  { id: "workspaces", label: "orchestra.nav.workspaces", wip: true },
  { id: "search", label: "orchestra.nav.search" },
] as const

export const settingsNavigation = [{ id: "settings", label: "sidebar.settings" }] as const

export const navigation = [...primaryNavigation, ...advancedNavigation, ...settingsNavigation]

// Capability pages without an entry here use their navigation label, as the reference does.
const crumbs = {
  // The Actions page is mounted as both `cicd` (its navigation entry) and `actions` (its chapter route).
  actions: "orchestra.actions.title",
  agents: "orchestra.shell.crumb.agents",
  dock: "orchestra.shell.crumb.dock",
  workspaces: "orchestra.shell.crumb.workspaces",
  plugins: "orchestra.shell.crumb.plugins",
  settings: "orchestra.shell.crumb.settings",
  // Settings holds both pages now, but their routes still open (chat and provider prompts link there).
  providers: "orchestra.shell.crumb.providers",
  shortcuts: "orchestra.shell.crumb.shortcuts",
} as const

export function isWip(id: string) {
  return navigation.some((item) => item.id === id && "wip" in item && item.wip)
}

export function showWip(id: string) {
  return import.meta.env.DEV && isWip(id)
}

export function breadcrumbLabel(route: LayoutRoute) {
  // Session and draft pages sit under Home: "home / <project> / <session title>".
  if (route.type !== "chapter") return "orchestra.shell.crumb.home"
  if (Object.hasOwn(crumbs, route.chapter)) return crumbs[route.chapter as keyof typeof crumbs]
  return navigation.find((item) => item.id === route.chapter)?.label ?? "orchestra.shell.crumb.home"
}
