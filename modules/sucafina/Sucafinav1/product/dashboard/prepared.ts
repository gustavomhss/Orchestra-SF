import type { Command } from "../../runtime/contract.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import type { SourceRef } from "../contracts/context.ts"
import type { PreparedDomainMutation } from "../contracts/ports.ts"
import type { JsonValue } from "../contracts/operations.ts"
import type { Actor, Environment, Snapshot } from "../../runtime/contract.ts"
import { sfSourceIdentity } from "../integration/source-lifecycle.ts"
import { applyDashboardPreview } from "./commands.ts"

// WP10 stores the receipt and this mutation in the same domain transaction; this factory does not persist either.
export function createDashboardPreparedMutation(input: { actorId: string; target: SourceRef; command: Command; baseDigest: string; previewDigest: string; idempotencyKey: string }): PreparedDomainMutation | undefined {
  if (!input.actorId.trim() || !input.idempotencyKey.trim() || input.target.surface !== "dashboard" || !input.target.incarnation || input.command.id !== input.target.id || input.command.confirmed === true || !/^[a-f0-9]{64}$/.test(input.baseDigest) || !/^[a-f0-9]{64}$/.test(input.previewDigest)) return undefined
  const collections: Record<string, string> = { "OPEX Detail": input.command.action === "save-entry" ? "opexEntries" : "opexOwners", "CAPEX Projects": input.command.action === "save-entry" ? "capexEntries" : "capexProjects", "Hot Topics & Actions": "hotTopics", "Talent Review": "members", "Portfolio Dashboard": "projects", "All Projects": "projects", "IT Risks": "risks", "Vendor Contracts": "contracts", "Stakeholder Management": "stakeholders" }
  if (!Object.hasOwn(collections, input.command.page) || collections[input.command.page] !== input.target.type || !Number.isSafeInteger(input.command.version) || input.command.version < 0) return undefined
  if (!["save", "delete", "save-entry", "annual-entry", "year-amount", "save-deviation", "save-milestone", "delete-milestone"].includes(input.command.action)) return undefined
  const year = input.command.values.year
  if (year !== undefined && (!/^\d{4}$/.test(String(year)) || !input.target.period.start.startsWith(String(year)) || !input.target.period.end.startsWith(String(year)))) return undefined
  const prepared = (() => {
    try { return structuredClone(input) } catch { return undefined }
  })()
  if (!prepared) return undefined
  const digest = (() => {
    try { return digestSfValue({ actorId: prepared.actorId, target: prepared.target, command: prepared.command, baseDigest: prepared.baseDigest, previewDigest: prepared.previewDigest }) } catch { return undefined }
  })()
  if (!digest) return undefined
  return {
    surface: "dashboard", idempotencyKey: prepared.idempotencyKey, commandDigest: digest, targetIncarnation: prepared.target.incarnation, expectedVersion: prepared.command.version,
    execute: (snapshot: Snapshot, actor: Actor, environment: Environment): { commit: boolean; value: JsonValue } => {
      if (actor.id !== prepared.actorId) return { commit: false, value: { status: "denied", reason: "actor-changed" } }
      const identity = (() => {
        try { return sfSourceIdentity(snapshot, prepared.target.type, prepared.target.id) } catch { return undefined }
      })()
      if (!identity || identity.incarnation !== prepared.target.incarnation || identity.version !== prepared.target.version) return { commit: false, value: { status: "conflict", reason: "source-replaced-or-changed" } }
      const result = applyDashboardPreview(snapshot, actor, prepared.command, environment, prepared.baseDigest, prepared.previewDigest)
      if (!result.ok) return { commit: false, value: { status: result.status === 403 ? "denied" : result.status === 409 ? "conflict" : "failed", reason: "command-rejected" } }
      return { commit: true, value: { status: "applied" } }
    },
  }
}
