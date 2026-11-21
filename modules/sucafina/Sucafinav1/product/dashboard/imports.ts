import type { Actor, Command, Environment, Snapshot } from "../../runtime/contract.ts"
import { applyDashboardPreview, simulateDashboardCommand } from "./commands.ts"

export type DashboardImportFormat = "all-members" | "all-projects" | "ticket-register" | "backup"
export type DashboardBackupAdapter = {
  preview: (snapshot: Snapshot, actor: Actor, command: Command, environment: Environment) => ReturnType<typeof simulateDashboardCommand>
  apply: (snapshot: Snapshot, actor: Actor, command: Command, environment: Environment, baseDigest: string, commandDigest: string) => ReturnType<typeof applyDashboardPreview>
}

// WP06 supplies already parsed commands; no workbook parsing or private JSON preparation occurs here.
export function previewDashboardImport(format: string, snapshot: Snapshot, actor: Actor, command: Command, environment: Environment, backup?: DashboardBackupAdapter) {
  if (!isSupportedFormat(format)) return { status: "invalid" as const, reason: "format-unsupported" as const }
  if (format === "backup") {
    if (command.action !== "backup-import") return { status: "invalid" as const, reason: "format-command-mismatch" }
    return backup ? backup.preview(structuredClone(snapshot), actor, command, environment) : { status: "invalid" as const, reason: "backup-producer-unavailable" }
  }
  if (!matches(format, command)) return { status: "invalid" as const, reason: "format-command-mismatch" }
  return simulateDashboardCommand(snapshot, actor, command, environment)
}

export function applyDashboardImport(format: string, snapshot: Snapshot, actor: Actor, command: Command, environment: Environment, baseDigest: string, commandDigest: string, backup?: DashboardBackupAdapter) {
  if (!isSupportedFormat(format)) return { ok: false as const, status: 400 as const, errors: ["Format is not a supported Dashboard import"] }
  if (format === "backup") {
    if (command.action !== "backup-import") return { ok: false as const, status: 400 as const, errors: ["Format and domain command do not match"] }
    return backup ? backup.apply(snapshot, actor, command, environment, baseDigest, commandDigest) : { ok: false as const, status: 503 as const, errors: ["Backup producer unavailable"] }
  }
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
  return format === "all-members" || format === "all-projects" || format === "ticket-register" || format === "backup"
}
