import { canonicalSfValue, digestSfValue, sfCanonicalSerializerUnhooked } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { DomainPortHost, PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { SfProductState, SfProductStatePort, SfStateAuthority } from "../../../../modules/sucafina/Sucafinav1/product/contracts/state.ts"
import type { StoredDecisionResult } from "../../../../modules/sucafina/Sucafinav1/product/decisions/result-store.ts"
import type { createScenarioRequestStore } from "../../../../modules/sucafina/Sucafinav1/product/decisions/scenario-request-store.ts"
import { isSfProductStateReader } from "../../../../modules/sucafina/Sucafinav1/product/host-binding/state-provider.ts"
import { currentSfReadonlyAuthorityData, currentSfReadonlySnapshotScope } from "../../../../modules/sucafina/Sucafinav1/product/integration/source-lifecycle.ts"
import { beginSfReadonlyDiagnostic, endSfReadonlyDiagnostic, countSfReadonlyDiagnostic } from "../../../../modules/sucafina/Sucafinav1/product/portfolio/diagnostic-timing.ts"
import { roleMap } from "../../../../modules/sucafina/Sucafinav1/runtime/admin.ts"

type StoredScenario = Extract<StoredDecisionResult, { kind: "scenario" }>
type StoredRequest = Extract<Awaited<ReturnType<ReturnType<typeof createScenarioRequestStore>["read"]>>, { status: "ok" }>["value"]
type Selection = { stored: StoredScenario; request: unknown }
export type SfCalculationObservedReads = { request: StoredRequest; stored: StoredScenario }
type Sources = Record<"dashboard" | "planner" | "procurement", string>

/** Observe actual canonical reader outputs; never replace a reader or share its Promise. */
export function createSfPlannerCalculationReadScope(input: {
  host: DomainPortHost
  state: SfProductStatePort
  lockedSourceFences: () => Sources | undefined
}) {
  const sealedStateDigests = new WeakMap<object, string>()
  const select = async (runId: string, call: TrustedDomainContext): Promise<PortResult<Selection>> => {
    const request = input.host.requestFor(call), binding = digestSfValue([call.kind, call.binding])
    const headers = request && plannerRequestIdentity(request)
    const current = () => !!request && !request.signal.aborted && input.host.requestFor(call) === request &&
      plannerRequestIdentity(request) === headers && digestSfValue([call.kind, call.binding]) === binding
    if (!request || !current() || !await input.host.revalidate(call) || !current())
      return { status: "denied", reason: "calculation-authority-unavailable" }
    // This is only the authenticated store selector. The producer still reads
    // and validates the canonical request and result twice before issuance.
    const found = await input.state.read(request, "cases", (state, actor) => {
      countSfReadonlyDiagnostic("read-scope.c08.select.cases", "dashboard")
      if (!sameAuthority(actor, call) || !current()) return undefined
      const stored = state.decisionResults?.[runId]
      const decision = stored && state.cases[stored.caseRef.id]
      if (!stored || stored.kind !== "scenario" || stored.resultRef !== runId || !decision || decision.id !== stored.caseRef.id ||
        decision.incarnation !== stored.caseRef.incarnation || decision.version !== stored.caseRef.version || !decision.participants.includes(actor.principalRef)) return undefined
      return structuredClone(stored)
    })
    if (!current() || !await input.host.revalidate(call) || !current()) return { status: "denied", reason: "calculation-authority-unavailable" }
    if (found.status !== "ok" || !found.value) return { status: "unavailable", reason: "scenario-request-unavailable" }
    const selected = found.value
    const preferences = await input.state.read(request, "preferences", (state, actor) => {
      countSfReadonlyDiagnostic("read-scope.c08.select.preferences", "dashboard")
      if (!sameAuthority(actor, call) || !current()) return undefined
      const stored = state.decisionResults?.[runId], decision = state.cases[selected.caseRef.id]
      const bound = state.preferences[requestKey(runId)]
      if (!stored || digestSfValue(stored) !== digestSfValue(selected) || !bound || typeof bound !== "object" ||
        !decision || decision.id !== selected.caseRef.id || decision.incarnation !== selected.caseRef.incarnation ||
        decision.version !== selected.caseRef.version || !decision.participants.includes(actor.principalRef)) return undefined
      return { stored: structuredClone(selected), request: structuredClone(bound) }
    })
    if (!current() || !await input.host.revalidate(call) || !current()) return { status: "denied", reason: "calculation-authority-unavailable" }
    return preferences.status === "ok" && preferences.value ? { status: "ok", value: preferences.value }
      : { status: "unavailable", reason: "scenario-request-unavailable" }
  }
  const open = async (selected: Selection, call: TrustedDomainContext, owns: () => boolean) => {
    const request = input.host.requestFor(call), binding = digestSfValue([call.kind, call.binding])
    const headers = request && plannerRequestIdentity(request), selectedDigest = digestSfValue(selected)
    const captured = structuredClone(selected), runId = captured.stored.resultRef
    let closed = false, invalid = false
    const requests: StoredRequest[] = [], results: StoredScenario[] = []
    const current = () => !closed && !invalid && owns() && call.kind === "ui" && !!request && !request.signal.aborted &&
      input.host.requestFor(call) === request && plannerRequestIdentity(request) === headers &&
      digestSfValue([call.kind, call.binding]) === binding && digestSfValue(selected) === selectedDigest
    const environment = async () => {
      if (!request) return undefined
      const value = await input.host.environment(request), at = Date.parse(value.at)
      return Number.isFinite(at) ? { day: new Date(at).toISOString().slice(0, 10), directory: structuredClone(value.directory),
        bankKey: value.bankKey ? Array.from(value.bankKey) : undefined } : undefined
    }
    const snapshot = async () => {
      if (!request || !current() || !await input.host.revalidate(call) || !current()) return undefined
      const observe = async (state: Readonly<SfProductState>, actor: SfStateAuthority, reader?: { port: SfProductStatePort; persistence: DomainPortHost["persistence"] }) => {
        if (!sameAuthority(actor, call) || !current()) return undefined
        const stored = state.decisionResults?.[runId], bound = state.preferences[requestKey(runId)]
        const decision = state.cases[captured.stored.caseRef.id]
        if (!stored || digestSfValue(stored) !== digestSfValue(captured.stored) || digestSfValue(bound) !== digestSfValue(captured.request) ||
          !decision || decision.id !== captured.stored.caseRef.id || decision.incarnation !== captured.stored.caseRef.incarnation ||
          decision.version !== captured.stored.caseRef.version || !decision.participants.includes(actor.principalRef)) return undefined
        const persistence = input.host.persistence
        const sealed = sfCanonicalSerializerUnhooked() ? currentSfReadonlySnapshotScope(persistence) : undefined
        const acl = sealed && currentSfReadonlyAuthorityData(persistence, ["planner"])
        const stateSeal = sealed && reader?.persistence === persistence ? sealed : undefined
        countSfReadonlyDiagnostic(!sealed ? "read-scope.sealed.absent" : !reader ? "read-scope.reader.absent"
          : !stateSeal ? "read-scope.reader.persistence-mismatch" : "read-scope.state-seal.matched", "dashboard")
        const locked = acl ? undefined : persistence.currentSnapshots?.()
        const sources = input.lockedSourceFences()
        const planner = acl?.snapshots.planner ?? locked?.planner
        if (!planner || !sources || acl && (!sealed?.current() || !acl.current())) return undefined
        const product = locked && digestSfValue(locked.dashboard.data.__sfProductV1)
        const sameProduct = () => acl ? input.host.persistence === persistence && sfCanonicalSerializerUnhooked() && sealed?.current() && acl.current()
          : product === digestSfValue(input.host.persistence.currentSnapshots?.()?.dashboard.data.__sfProductV1)
        const before = await environment()
        const principal = structuredClone(await input.host.authenticate(request, { surface: "planner", roleMap: roleMap(planner, "planner") }))
        if (!before || !principal || principal.id !== actor.principalRef || principal.id.startsWith("local:") || !current()) return undefined
        const after = await environment()
        const again = await input.host.authenticate(request, { surface: "planner", roleMap: roleMap(planner, "planner") })
        if (!after || digestSfValue(after) !== digestSfValue(before) || digestSfValue(again) !== digestSfValue(principal) ||
          !await input.host.revalidate(call) || !current() || !sameProduct() ||
          digestSfValue(sources) !== digestSfValue(input.lockedSourceFences())) return undefined
        // The snapshot driver identifies an immutable root. Only the original
        // C08 reader can supply its unprojected, detached state for this memo.
        let stateDigest: string
        if (stateSeal) {
          if (!reader || input.state !== reader.port || input.host.persistence !== persistence || !sfCanonicalSerializerUnhooked() ||
            !stateSeal.current() || !isSfProductStateReader(reader.port, persistence)) {
            countSfReadonlyDiagnostic("read-scope.memo.guard-refused", "dashboard")
            return undefined
          }
          const identity = stateSeal.bytesIdentity ?? stateSeal.identity
          const sfDiagnosticMemo = sealedStateDigests.get(identity)
          countSfReadonlyDiagnostic((sfDiagnosticMemo ?? null) === null ? "read-scope.memo.miss" : "read-scope.memo.hit", "dashboard")
          stateDigest = sfDiagnosticMemo ?? digestSfValue(state)
          sealedStateDigests.set(identity, stateDigest)
        } else {
          countSfReadonlyDiagnostic("read-scope.digest.unsealed", "dashboard")
          stateDigest = digestSfValue(state)
        }
        // Full C08 includes originals, captures, receipts, ledger, preferences
        // and grants; source fences alone intentionally exclude __sfProductV1.
        return digestSfValue({ stateDigest, sources, principal, environment: after, request: headers, binding, selected: captured })
      }
      // A cases grant does not authorize preferences. Both are real C08 reads;
      // its final reauthorization remains inside the held SQLite snapshot.
      const read = (namespace: "preferences" | "cases") => {
        const port = input.state, persistence = input.host.persistence
        const reader = isSfProductStateReader(port, persistence) ? { port, persistence } : undefined
        return port.read(request, namespace, (state, actor) => {
          countSfReadonlyDiagnostic(namespace === "preferences" ? "read-scope.c08.snapshot.preferences" : "read-scope.c08.snapshot.cases", "dashboard")
          return observe(state, actor, reader)
        })
      }
      const preferences = await read("preferences")
      const cases = await read("cases")
      return current() && preferences.status === "ok" && cases.status === "ok" && preferences.value && preferences.value === cases.value
        ? cases.value : undefined
    }
    const sfDiagnosticOpen = beginSfReadonlyDiagnostic("read-scope.snapshot.open", "dashboard")
    try {
      const baseline = await snapshot()
      endSfReadonlyDiagnostic(sfDiagnosticOpen)
      if (!baseline) return undefined
      return {
        current,
        request(value: StoredRequest) {
          if (!current() || value.resultRef !== runId || digestSfValue(value) !== digestSfValue(captured.request) || requests.length >= 2) { invalid = true; return }
          requests.push(structuredClone(value))
        },
        result(value: StoredScenario) {
          if (!current() || value.resultRef !== runId || digestSfValue(value) !== digestSfValue(captured.stored) || results.length >= 2) { invalid = true; return }
          results.push(structuredClone(value))
        },
        completed(): SfCalculationObservedReads | undefined {
          if (!current() || requests.length !== 2 || results.length !== 2 || digestSfValue(requests[0]) !== digestSfValue(requests[1]) ||
            digestSfValue(results[0]) !== digestSfValue(results[1])) return undefined
          return { request: structuredClone(requests[1]!), stored: structuredClone(results[1]!) }
        },
        async verify() {
          const sfDiagnosticVerify = beginSfReadonlyDiagnostic("read-scope.snapshot.verify", "dashboard")
          try {
            const latest = await snapshot()
            endSfReadonlyDiagnostic(sfDiagnosticVerify)
            if (!latest || latest !== baseline || !current()) { invalid = true; return false }
            return true
          } finally { endSfReadonlyDiagnostic(sfDiagnosticVerify) }
        },
        close() { closed = true; requests.length = 0; results.length = 0 },
      }
    } finally { endSfReadonlyDiagnostic(sfDiagnosticOpen) }
  }
  return { select, open }
}

function requestKey(runId: string) { return `sf:proposal-coverage:scenario-request:${digestSfValue(runId)}` }
export function plannerRequestIdentity(request: Request) { return canonicalSfValue([request.method, request.url, [...request.headers.entries()]]) }
function sameAuthority(actor: SfStateAuthority, call: TrustedDomainContext) {
  return actor.principalRef === call.binding.principalRef && actor.accessRevision === call.binding.accessRevision && actor.policyVersion === call.binding.policyVersion
}
