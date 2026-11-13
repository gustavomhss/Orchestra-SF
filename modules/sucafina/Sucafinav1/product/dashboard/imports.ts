import type { Actor, Command, Environment, Snapshot } from "../../runtime/contract.ts"
import { applyDashboardPreview, simulateDashboardCommand } from "./commands.ts"

export type DashboardImportFormat = "all-members" | "all-projects" | "ticket-register"

// WP06 supplies already parsed commands; no workbook parsing or private JSON preparation occurs here.
export function previewDashboardImport(format: string, snapshot: Snapshot, actor: Actor, command: Command, environment: Environment) {
  if (!isSupportedFormat(format)) return { status: "invalid" as const, reason: "format-unsupported" as const }
  if (!matches(format, command)) return { status: "invalid" as const, reason: "format-command-mismatch" }
  return simulateDashboardCommand(snapshot, actor, command, environment)
}

export function applyDashboardImport(format: string, snapshot: Snapshot, actor: Actor, command: Command, environment: Environment, baseDigest: string, commandDigest: string) {
  if (!isSupportedFormat(format)) return { ok: false as const, status: 400 as const, errors: ["Format is not a supported Dashboard import"] }
  if (!matches(format, command)) return { ok: false as const, status: 400 as const, errors: ["Format and domain command do not match"] }
  return applyDashboardPreview(snapshot, actor, command, environment, baseDigest, commandDigest)
}

function matches(format: DashboardImportFormat, command: Command) {
  if (format === "all-members") return command.page === "Talent Review" && command.action === "import"
  if (format === "all-projects") return command.page === "All Projects" && command.action === "import"
  if (format === "ticket-register") return command.page === "IT Operations" && command.action === "import-month"
  return false
}

function isSupportedFormat(format: string): format is DashboardImportFormat {
  return format === "all-members" || format === "all-projects" || format === "ticket-register"
}
