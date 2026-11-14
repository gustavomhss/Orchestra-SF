import type { ConfirmationScope, ConfirmationValidityProjection } from "../contracts/context.ts"
import type { ForecastCompareRequest } from "../contracts/operations.ts"
import type { PlannerPort, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { ForecastReviewHost } from "./forecast.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import { isSfPeriod } from "../contracts/validation.ts"

export type ForecastConfirmationCoverage = {
  scopes: readonly { scope: ConfirmationScope; confirmation: ConfirmationValidityProjection | null }[]
}

type ConfirmationIndex = ((request: ForecastCompareRequest, context: TrustedDomainContext) => Promise<PortResult<readonly string[]>>) & {
  /** A list of present IDs alone never proves coverage of the selected scopes. */
  readCoverage?: (request: ForecastCompareRequest, context: TrustedDomainContext) => Promise<PortResult<ForecastConfirmationCoverage>>
}

/** Ask C06 for confirmations of the exact authorized scopes supplied by the host. */
export function createScopedConfirmationIndex(input: {
  resolveScopes: (request: ForecastCompareRequest, context: TrustedDomainContext) => Promise<PortResult<readonly ConfirmationScope[]>>
  confirmation: {
    find: (scope: ConfirmationScope, context: TrustedDomainContext) => Promise<PortResult<{ confirmationIds: readonly string[] }>>
    readScope?: (scope: ConfirmationScope, context: TrustedDomainContext) => Promise<PortResult<ConfirmationValidityProjection | null>>
  }
  revalidate: (request: ForecastCompareRequest, context: TrustedDomainContext) => Promise<boolean>
}): ConfirmationIndex {
  const readCoverage = async (request: ForecastCompareRequest, context: TrustedDomainContext): Promise<PortResult<ForecastConfirmationCoverage>> => {
    if (!input.confirmation.readScope) return { status: "unavailable", reason: "confirmation-scope-reader-unavailable" }
    if (!await input.revalidate(request, context)) return { status: "denied", reason: "confirmation-access-unavailable" }
    const selected = await input.resolveScopes(request, context)
    if (selected.status !== "ok") return selected
    const scopes = uniqueScopes(selected.value)
    if (!scopes) return { status: "unavailable", reason: "confirmation-scopes-invalid" }
    const read = async (values: readonly ConfirmationScope[]) => Promise.all(values.map((scope) => input.confirmation.readScope!(structuredClone(scope), context)))
    const found = await read(scopes)
    const error = found.find((result) => result.status !== "ok")
    if (error) return error
    if (found.some((result) => result.status === "ok" && result.value?.state === "unavailable")) return { status: "unavailable", reason: "confirmation-source-unavailable" }
    if (found.some((result) => result.status === "ok" && result.value !== null && !validConfirmation(result.value))) return { status: "unavailable", reason: "confirmation-projection-invalid" }
    const coverage: ForecastConfirmationCoverage = { scopes: found.flatMap((result, index) => result.status === "ok" ? [{ scope: scopes[index]!, confirmation: structuredClone(result.value) }] : []) }
    const current = await input.resolveScopes(request, context)
    if (current.status !== "ok") return current
    const currentScopes = uniqueScopes(current.value)
    if (!currentScopes || digestSfValue(currentScopes.map(forecastConfirmationScopeIdentity)) !== digestSfValue(scopes.map(forecastConfirmationScopeIdentity))) return { status: "stale", reason: "confirmation-scope-changed" }
    const again = await read(currentScopes)
    const changed = again.find((result) => result.status !== "ok")
    if (changed) return changed
    if (again.some((result) => result.status === "ok" && result.value?.state === "unavailable")) return { status: "unavailable", reason: "confirmation-source-unavailable" }
    if (again.some((result) => result.status === "ok" && result.value !== null && !validConfirmation(result.value))) return { status: "unavailable", reason: "confirmation-projection-invalid" }
    const currentCoverage: ForecastConfirmationCoverage = { scopes: again.flatMap((result, index) => result.status === "ok" ? [{ scope: currentScopes[index]!, confirmation: structuredClone(result.value) }] : []) }
    if (forecastConfirmationCoverageDigest(currentCoverage) !== forecastConfirmationCoverageDigest(coverage)) return { status: "stale", reason: "confirmation-source-changed" }
    if (!await input.revalidate(request, context)) return { status: "denied", reason: "confirmation-access-unavailable" }
    return { status: "ok", value: coverage }
  }
  const index = async (request: ForecastCompareRequest, context: TrustedDomainContext): Promise<PortResult<readonly string[]>> => {
    if (input.confirmation.readScope) {
      const covered = await readCoverage(request, context)
      return covered.status === "ok" ? { status: "ok", value: [...new Set(covered.value.scopes.flatMap((entry) => entry.confirmation ? [entry.confirmation.confirmationId] : []))] } : covered
    }
    if (!await input.revalidate(request, context)) return { status: "denied", reason: "confirmation-access-unavailable" }
    const scopes = await input.resolveScopes(request, context)
    if (scopes.status !== "ok") return scopes
    const found = await Promise.all(scopes.value.map((scope) => input.confirmation.find(scope, context)))
    const error = found.find((result) => result.status !== "ok")
    if (error) return error
    const current = await input.resolveScopes(request, context)
    if (current.status !== "ok") return current
    if (digestSfValue(current.value) !== digestSfValue(scopes.value)) return { status: "stale", reason: "confirmation-scope-changed" }
    if (!await input.revalidate(request, context)) return { status: "denied", reason: "confirmation-access-unavailable" }
    return { status: "ok", value: [...new Set(found.flatMap((result) => result.status === "ok" ? result.value.confirmationIds : []))] }
  }
  return Object.assign(index, input.confirmation.readScope ? { readCoverage } : {})
}

/** The index selects confirmation IDs for this exact authorized scope; it cannot assert validity. */
export function createForecastConfirmationHost(input: {
  planner: PlannerPort
  confirmation?: { project: (id: string, context: TrustedDomainContext) => Promise<PortResult<ConfirmationValidityProjection>> }
  listConfirmationIds: ConfirmationIndex
  revalidate: (request: ForecastCompareRequest, context: TrustedDomainContext) => Promise<boolean>
  responsibles?: ForecastReviewHost["responsibles"]
  recordedReasons?: ForecastReviewHost["recordedReasons"]
  facts?: ForecastReviewHost["facts"]
  revalidateFacts?: ForecastReviewHost["revalidateFacts"]
}): ForecastReviewHost {
  return {
    planner: input.planner,
    revalidate: input.revalidate,
    responsibles: input.responsibles,
    recordedReasons: input.recordedReasons,
    facts: input.facts,
    revalidateFacts: input.revalidateFacts,
    confirmationCoverage: input.listConfirmationIds.readCoverage,
    confirmations: async (request, context) => {
      if (input.listConfirmationIds.readCoverage) {
        const covered = await input.listConfirmationIds.readCoverage(request, context)
        return covered.status === "ok" ? { status: "ok", value: covered.value.scopes.flatMap((entry) => entry.confirmation ? [entry.confirmation] : []) } : covered
      }
      if (!input.confirmation) return { status: "unavailable", reason: "confirmation-producer-unavailable" }
      if (!await input.revalidate(request, context)) return { status: "denied", reason: "confirmation-access-unavailable" }
      const selected = await input.listConfirmationIds(request, context)
      if (selected.status !== "ok") return selected
      const ids = [...new Set(selected.value)]
      if (ids.some((id) => !id.trim())) return { status: "unavailable", reason: "confirmation-index-invalid" }
      const projected = await Promise.all(ids.map((id) => input.confirmation!.project(id, context)))
      if (projected.some((result, index) => result.status !== "ok" || result.value.confirmationId !== ids[index] || result.value.state === "unavailable")) return { status: "unavailable", reason: "confirmation-source-unavailable" }
      const current = await input.listConfirmationIds(request, context)
      if (current.status !== "ok") return current
      if (digestSfValue([...new Set(current.value)].sort()) !== digestSfValue(ids.sort())) return { status: "stale", reason: "confirmation-selection-changed" }
      if (!await input.revalidate(request, context)) return { status: "denied", reason: "confirmation-access-unavailable" }
      return { status: "ok", value: projected.flatMap((result) => result.status === "ok" ? [result.value] : []) }
    },
  }
}

/** Scope identity excludes audit clocks/versions; C06 fingerprints still decide material validity. */
export function forecastConfirmationScopeIdentity(scope: ConfirmationScope) {
  return { sourceRef: scope.sourceRef, fields: [...scope.fields].sort(), period: scope.period, scopeDefinitionVersion: scope.scopeDefinitionVersion,
    materialDependencies: scope.materialDependencies.map((source) => ({ surface: source.surface, type: source.type, id: source.id, incarnation: source.incarnation, fields: [...source.fields].sort(), period: source.period })).sort((left, right) => digestSfValue(left).localeCompare(digestSfValue(right))) }
}

export function forecastConfirmationCoverageDigest(coverage: ForecastConfirmationCoverage) {
  return digestSfValue(coverage.scopes.map(({ scope, confirmation }) => ({ scope: forecastConfirmationScopeIdentity(scope), confirmation: confirmation ? {
    confirmationId: confirmation.confirmationId, state: confirmation.state, reason: confirmation.reason,
    ...("scopeFingerprint" in confirmation ? { scopeFingerprint: confirmation.scopeFingerprint } : {}),
  } : null })).sort((left, right) => digestSfValue(left.scope).localeCompare(digestSfValue(right.scope))))
}

function uniqueScopes(scopes: readonly ConfirmationScope[]): ConfirmationScope[] | undefined {
  if (!Array.isArray(scopes) || scopes.some((scope: ConfirmationScope) => !keys(scope, ["sourceRef", "fields", "period", "materialDependencies", "scopeDefinitionVersion"]) || !keys(scope.sourceRef, ["surface", "type", "id", "incarnation"]) || !["dashboard", "planner", "procurement"].includes(scope.sourceRef.surface) ||
    ![scope.sourceRef.type, scope.sourceRef.id, scope.sourceRef.incarnation, scope.scopeDefinitionVersion].every((part) => typeof part === "string" && !!part.trim()) ||
    !Array.isArray(scope.fields) || !scope.fields.length || scope.fields.some((field) => typeof field !== "string" || !field.trim()) || new Set(scope.fields).size !== scope.fields.length || !keys(scope.period, ["start", "end"]) || !isSfPeriod(scope.period) ||
    !Array.isArray(scope.materialDependencies) || scope.materialDependencies.some((source: ConfirmationScope["materialDependencies"][number]) => !keys(source, ["surface", "type", "id", "incarnation", "version", "fields", "period", "observedAt"]) || !["dashboard", "planner", "procurement"].includes(source.surface) || ![source.type, source.id, source.incarnation].every((part) => typeof part === "string" && !!part.trim()) ||
      !Number.isSafeInteger(source.version) || source.version < 1 || typeof source.observedAt !== "string" || !Number.isFinite(Date.parse(source.observedAt)) ||
      !Array.isArray(source.fields) || source.fields.some((field) => typeof field !== "string" || !field.trim()) || new Set(source.fields).size !== source.fields.length || !keys(source.period, ["start", "end"]) || !isSfPeriod(source.period)))) return undefined
  return [...new Map(scopes.map((scope) => [digestSfValue(forecastConfirmationScopeIdentity(scope)), structuredClone(scope)])).entries()]
    .sort(([left], [right]) => left.localeCompare(right)).map(([, scope]) => scope)
}

function validConfirmation(value: ConfirmationValidityProjection) {
  return keys(value, ["confirmationId", "evaluatedSourceVersion", "evaluatedAt", "reason", "state", "scopeFingerprint"]) && typeof value.confirmationId === "string" && !!value.confirmationId.trim() &&
    Number.isSafeInteger(value.evaluatedSourceVersion) && value.evaluatedSourceVersion >= 0 && typeof value.evaluatedAt === "string" && Number.isFinite(Date.parse(value.evaluatedAt)) &&
    (value.state === "valid" && value.reason === "unchanged-scope" && typeof value.scopeFingerprint === "string" && !!value.scopeFingerprint.trim() ||
      value.state === "stale" && ["material-change", "dependency-change", "source-removed", "source-replaced"].includes(value.reason) && (value.scopeFingerprint === undefined || typeof value.scopeFingerprint === "string" && !!value.scopeFingerprint.trim()))
}

function keys(value: unknown, allowed: readonly string[]): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value)) &&
    Reflect.ownKeys(value).every((key) => typeof key === "string" && allowed.includes(key))
}

