// Leitura e tecto do dashboard. O buraco do elo não se fecha aqui. leaderId não é actor.id.

import { computeBudgetTotals } from "./dashboard-accounts.ts"
import type { BudgetData, BudgetTotals } from "./dashboard-accounts.ts"

const CONTRACT_CAP = 25 * 1024 * 1024

export type Member = {
  id: string
  leaderId?: string
  cls?: string
  outlook?: string
  notes?: string
} & Record<string, unknown>

export type AuditLine = { who: string; at: string; member: string }

export type LeaderJoin = { directoryId: string; leaderId: string }

export function readMember(
  member: Member,
  actor: { id: string; roles: string[] },
  at: string,
  audit: AuditLine[],
  join: LeaderJoin[] = [],
): Member {
  audit.push({ who: actor.id, at, member: member.id })
  if (seesTalent(actor, member, join)) return { ...member }
  const { cls: _cls, outlook: _outlook, notes: _notes, ...rest } = member
  return rest
}

function seesTalent(actor: { id: string; roles: string[] }, member: Member, join: LeaderJoin[]): boolean {
  if (actor.roles.includes("admin")) return true
  if (!actor.roles.includes("domain leader") || !member.leaderId) return false
  return join.some((row) => row.directoryId === actor.id && row.leaderId === member.leaderId && row.directoryId !== row.leaderId)
}

const SEED_FLAGS = ["_budget2026Loaded", "_hotTopicsSeeded", "_stakeholdersSeeded", "_projectsReplacedJuly2026"]
const NOT_LIVE = ["slaEntries", "slaConfig", "hwAssetTypes", "hwEntries", "swAssets", "swEntries", "watchList"]

export function migrateDashboard(
  data: BudgetData & Record<string, unknown> & { members?: Member[]; projects?: Record<string, unknown>[] },
  actor: { canWrite: boolean; roles: string[] },
  confirmed: boolean,
  year: number,
): { ok: false } | { ok: true; data: BudgetData & Record<string, unknown> & { members?: Member[]; projects?: Record<string, unknown>[] }; totals: BudgetTotals; flags: string[] } {
  if (!actor.canWrite || !actor.roles.includes("admin") || confirmed !== true) return { ok: false }
  const next = { ...data }
  for (const key of NOT_LIVE) delete next[key]
  const flags = SEED_FLAGS.filter((flag) => Object.prototype.hasOwnProperty.call(data, flag))
  for (const flag of flags) delete next[flag]
  next.migration = { flags }
  return { ok: true, data: next, totals: computeBudgetTotals(next, year), flags }
}

export function exportBackup(data: unknown, actor: { roles: string[] }): { ok: true; data: unknown } | { ok: false } {
  if (!actor.roles.includes("admin")) return { ok: false }
  return { ok: true, data }
}

// Secção 7.8. O ficheiro leva Classification e Outlook. Quem não vê talento não o gera. Até o elo da secção 11, só admin.
export function exportAllMembers(
  members: Member[],
  actor: { roles: string[] },
): { ok: false } | { ok: true; file: true; live: false; rows: Record<string, string>[] } {
  if (!actor.roles.includes("admin")) return { ok: false }
  return {
    ok: true,
    file: true,
    live: false,
    rows: members.map((member) => ({
      Name: text(member.name),
      Title: text(member.title),
      Type: text(member.type),
      Leader: text(member.leader),
      Location: text(member.location),
      Start: text(member.start),
      End: text(member.end),
      Status: text(member.status),
      Classification: text(member.cls),
      Outlook: text(member.outlook),
    })),
  }
}

function text(value: unknown): string {
  return typeof value === "string" ? value : ""
}

// Secção 6. contracts.vendor é texto. Não é suppliers.id. Nome igual é coincidência.
export function contractVendor(vendor: string): { vendor: string; supplierId: null } {
  return { vendor, supplierId: null }
}

export function utilization(actual: number, effectiveBudget: number): number {
  return Math.min((actual / effectiveBudget) * 100, 100)
}

export function budgetVariance(spent: number, budget: number): number | null {
  if (!budget || !spent) return null
  return ((spent - budget) / budget) * 100
}

export function budgetCard(total: number): { total: number; label: string } {
  return { total, label: "12 months" }
}

export function contractUpload(bytes: number, canWrite: boolean): { ok: true; available: false } | { ok: false } {
  if (!canWrite) return { ok: false }
  if (bytes > CONTRACT_CAP) return { ok: false }
  return { ok: true, available: false }
}

export function contractCap(): number {
  return CONTRACT_CAP
}

export function deleteContract(contracts: Record<string, unknown>, blobs: Record<string, unknown>, id: string, canWrite: boolean) {
  if (!canWrite) return { ok: false as const }
  delete contracts[id]
  delete blobs[id]
  return { ok: true as const }
}

export type QuoteAttachment = { id: string; name: string; key: string }

// Secção 9.6. O upload existe: metadata e chave, fora do JSON do pedido. Sem tecto, o ficheiro não se aceita. 25 não é o número.
export function quoteUpload(
  attachments: Record<string, QuoteAttachment>,
  blobs: Record<string, unknown>,
  request: Record<string, unknown>,
  meta: { id: string; name: string },
  bytes: number,
  canWrite: boolean,
): { ok: false; upload: false } | { ok: false; upload: true; attachment: QuoteAttachment; request: Record<string, unknown> } {
  if (!canWrite) return { ok: false, upload: false }
  const attachment = { id: meta.id, name: meta.name, key: `blob/${meta.id}` }
  attachments[meta.id] = attachment
  void bytes
  void blobs
  return { ok: false, upload: true, attachment, request }
}
