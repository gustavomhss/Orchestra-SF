import { object } from "../../runtime/contract.ts"
import type { ProductContext, SourceRef, Period } from "./context.ts"

/** Selectors are untrusted. The host supplies authority after registry admission and resolves every source. */
export function decodeProductContext(value: unknown, authority: Pick<ProductContext, "installationId" | "projectId" | "principalRef" | "accessRevision" | "policyVersion" | "capabilities">): { ok: true; value: ProductContext } | { ok: false; reason: string } {
  const input = object(value)
  if (Object.keys(input).some((key) => !["surface", "period", "currency", "sourceRefs"].includes(key)))
    return { ok: false, reason: "unexpected-context-field" }
  if (![authority.installationId, authority.projectId, authority.principalRef, authority.accessRevision, authority.policyVersion].every(nonempty))
    return { ok: false, reason: "missing-context-identity" }
  if (!surface(input.surface) || !isSfPeriod(input.period)) return { ok: false, reason: "invalid-surface-or-period" }
  if (typeof input.currency !== "string" || !/^[A-Z]{3}$/.test(input.currency)) return { ok: false, reason: "invalid-currency" }
  if (!Array.isArray(input.sourceRefs) || !input.sourceRefs.every(sourceRef)) return { ok: false, reason: "invalid-source-reference" }
  if (!strings(authority.capabilities)) return { ok: false, reason: "invalid-capabilities" }
  return { ok: true, value: structuredClone({ ...input, ...authority }) as ProductContext }
}

function nonempty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

function strings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(nonempty) && new Set(value).size === value.length
}

function surface(value: unknown): value is ProductContext["surface"] {
  return value === "dashboard" || value === "planner" || value === "procurement"
}

function calendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(value)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

export function isSfPeriod(value: unknown): value is Period {
  const input = object(value)
  return Object.keys(input).length === 2 && calendarDate(input.start) && calendarDate(input.end) && input.start <= input.end
}

function sourceRef(value: unknown): value is SourceRef {
  const input = object(value)
  return Object.keys(input).every((key) => ["surface", "type", "id", "incarnation", "version", "fields", "period", "observedAt"].includes(key)) &&
    surface(input.surface) && [input.type, input.id, input.incarnation, input.observedAt].every(nonempty) &&
    Number.isSafeInteger(input.version) && Number(input.version) >= 0 && strings(input.fields) && input.fields.length > 0 && isSfPeriod(input.period) &&
    typeof input.observedAt === "string" && Number.isFinite(Date.parse(input.observedAt))
}
