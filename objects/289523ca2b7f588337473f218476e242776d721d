import { AsyncLocalStorage } from "node:async_hooks"
import { createHash } from "node:crypto"
import { Buffer } from "node:buffer"
import { closeSync, fstatSync, fsyncSync, lstatSync, openSync, readFileSync, realpathSync, writeSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const source = "ad3a4a7527baf1e092e87b5478626b2f0a3be57c"
const sourceTree = "11bf210f469be26630c39db586bcfcce87e0de1b"
const prefix = "SF_PREVIEW_E16_EVENT ", schema = "sf-preview-causal-e16-event-v1"
const maxEvents = 191, maxBytes = 191 * 1024, maxLineBytes = 1024, countCap = 65_535
const generalSlots = 17, unitSlots = 28, activeCompareSlots = 64, numberCap = 999_999_999
const directoryKey = "SF_PREVIEW_E16_EVENT_EVIDENCE_DIR", bindingKey = "SF_PREVIEW_E16_EVENT_EVIDENCE_BINDING"
const revision = "0d9b296af33f2b851fcbf4df3e9ec89751734ba4"
type Binding = { schema: string; source: string; sourceTree: string; snapshot: string; runId: string; attempt: string; nonce: string; launcherBytes: number; launcherSha256: string }
type UnitKind = "port" | "combination" | "analysis" | "analysis-revalidation" | "production-assess" | "production-revalidation"
type PhasePoint = "port-authority-initial" | "candidates-initial" | "combination-evaluate" | "port-authority-final" | "evaluations-recheck" | "candidates-final" |
  "analysis-select-initial" | "analysis-compare" | "analysis-persist" | "analysis-bind" | "analysis-select-final" | "analysis-revalidate" | "production-analysis" | "production-analysis-revalidate"
type HttpPoint = "body-returned" | "admit-returned" | "case-callback-entered" | "with-case-returned" | "egress-passed"
type Outcome = "await-returned" | "rejected" | "abrupt" | "abandoned"
type Payload = Readonly<Record<string, string | number | boolean | null | readonly number[]>>
type Frame = {
  handle: object; request: Request | undefined; binding: Binding; storage: AsyncLocalStorage<object>; root: Scope | undefined;
  start: number; last: number; fd: number | undefined; closed: boolean; pendingClose: boolean; closeRejected: boolean; events: number; bytes: number; dropped: number;
  nextUnit: number; nextPhase: number; nextCompare: number; openUnits: number; openPhases: number; openCompares: number; maxDepth: number;
  generalUsed: number; firstAnalysis: Unit | undefined; critical: boolean[]; checkpoints: boolean[]; totals: number[]; stages: number[]; lineage: number[]; untracked: number; saturated: boolean;
  overflowWritten: boolean; emissionFault: boolean; fileFault: boolean; scopeFault: boolean; scopeDisabled: boolean; clockFault: boolean; backpressure: boolean; emitting: boolean
  stdoutFailed: boolean; routeDisabled: boolean; routeScopes: number; routeOmitted: number; tailUsed: number;
  firstPort: Unit | undefined; firstProductionRevalidation: Unit | undefined; tailMask: number; validationState: ValidationState;
}
type Scope = { token: object; frame: Frame; parent: Scope | undefined; owner: Unit | undefined; phase: Phase | undefined; compare: Compare | undefined; stage: number; bindingScope: BindingScope | undefined; next: Scope | undefined }
type Unit = { handle: object; frame: Frame; birth: Scope; id: number; kind: UnitKind; parentUnit: number; parentPhase: number; phase: Phase | undefined; entryReserved: boolean; closed: boolean; next: Unit | undefined }
type Phase = { frame: Frame; owner: Unit; id: number; point: PhasePoint; scope: Scope; recordReserved: boolean; workReturned: boolean; workThrew: boolean; closed: boolean }
type Compare = { handle: object; frame: Frame; birth: Scope; scope: Scope; id: number; parentCompare: number; depth: number; stage: number; closed: boolean; next: Compare | undefined }
const neutralToken = {}
let selectionTried = false, selected: Frame | undefined, scopes: Scope | undefined, units: Unit | undefined, compares: Compare | undefined

// 32 detail places = five first critical pairs (10), four global checkpoints,
// the first analysis entry (1), and 17 general places. Pairs reserve both places
// at entry; critical phase IDs 1-5 also cannot be consumed by generic phases.
// Up to 28 admitted units each reserve one close outside those 32.
// Request enter/close and one overflow add three: 63 base rows.
// E16 reserves 12 tail, 8 canonical/Finance and 36 persistence rows. The old
// six lookup detail routes are neutral: 72 places are not admitted or emitted.
// Five validations reserve eight points each; two analysis binding reads add four.
// Thus 63+12+8+36+40+4 = 163 possible stream rows, within the unchanged hard
// 191 rows/191 KiB including prefix+LF. One BI-disabled row gives <=164 reserved
// campaign rows (the transport hard envelope remains <=192 rows/192 KiB),
// not a bound on the complete Actions log or its timestamp/ANSI encapsulation.
// A skip uses its critical pair reservation but emits only one decision row.
// Detail saturation never borrows a critical/checkpoint/unit-close reservation.
function whole(value: number) { return value - value % 1 }
function increment(value: number) { return value < countCap ? value + 1 : countCap }
function bump(frame: Frame, value: number) { if (value >= countCap) frame.saturated = true; return increment(value) }
function now() {
  try {
    const value = performance.now()
    if (typeof value === "number" && value >= 0 && value <= numberCap / 10) return value
  } catch { /* Observation is not a product operation. */ }
}
function elapsed(frame: Frame) {
  const value = now()
  if (value === undefined || value < frame.start || value < frame.last) { frame.clockFault = true; return null }
  frame.last = value
  return whole((value - frame.start) * 10)
}
function live(scope: Scope) {
  let depth = 0
  for (let at: Scope | undefined = scope; at; at = at.parent) {
    if (++depth > 128 || at.frame !== scope.frame || at.owner?.closed || at.phase?.closed || at.compare?.closed || at.bindingScope?.closed) return false
  }
  return true
}
function currentScope(): Scope | undefined {
  try {
    const frame = selected
    if (!frame || frame.closed || frame.scopeDisabled || frame.emitting) return
    const token = frame.storage.getStore()
    for (let scope = scopes; scope; scope = scope.next) if (scope.token === token && scope.frame === frame && live(scope)) return scope
  } catch { if (selected && !selected.closed) { selected.scopeFault = true; selected.scopeDisabled = true } }
}
function unitFor(handle: unknown): Unit | undefined {
  const scope = currentScope()
  if (!scope) return
  for (let unit = units; unit; unit = unit.next)
    if (unit.handle === handle && !unit.closed && unit.frame === scope.frame && unit.birth === scope) return unit
}
function compareFor(handle: unknown): Compare | undefined {
  const scope = currentScope()
  if (!scope) return
  for (let compare = compares; compare; compare = compare.next)
    if (compare.handle === handle && !compare.closed && compare.frame === scope.frame && compare.birth === scope) return compare
}
function forgetScope(scope: Scope) {
  let previous: Scope | undefined
  for (let at = scopes; at; at = at.next) {
    if (at === scope) { if (previous) previous.next = at.next; else scopes = at.next; return }
    previous = at
  }
}
function forgetCompare(compare: Compare) {
  let previous: Compare | undefined
  for (let at = compares; at; at = at.next) {
    if (at === compare) { if (previous) previous.next = at.next; else compares = at.next; return }
    previous = at
  }
}
function counters(frame: Frame): Payload {
  // Stages are a separate axis from explicit compare parent/depth. These are
  // E16 scoped-root/scoped-child/stage-unclassified counts, not E13 taxonomy.
  // compareBodies = [bodyEntered, bodyReturned, bodyThrew, open, maxDepth, untracked].
  // stages = eleven [entered, returned, threw] triples: unclassified, port,
  // combination, production-analysis, select-initial, analysis-compare, persist,
  // bind, select-final, analysis-revalidate, production-analysis-revalidate.
  // A body return does not attest to later async adoption or a caller clone/guard.
  return { compareBodies: [frame.totals[0] ?? 0, frame.totals[1] ?? 0, frame.totals[2] ?? 0, frame.openCompares, frame.maxDepth, frame.untracked],
    stages: frame.stages, lineage: frame.lineage, saturated: frame.saturated }
}
function append(frame: Frame, kind: string, payload: Payload) {
  const record = { schema, source, sourceTree, qualification: false, snapshot: frame.binding.snapshot, runId: frame.binding.runId,
    attempt: frame.binding.attempt, nonce: frame.binding.nonce, pid: process.pid, parentPid: process.ppid, request: 1,
    sequence: frame.events + 1, kind, elapsedTenthMs: elapsed(frame), ...payload }
  const line = prefix + JSON.stringify(record) + "\n", bytes = Buffer.byteLength(line, "utf8")
  if (bytes > maxLineBytes || !/^[\x20-\x7e]*\n$/.test(line)) { frame.emissionFault = true; return }
  if (frame.events >= maxEvents || frame.bytes + bytes > maxBytes) { frame.emissionFault = true; return }
  // Each admitted attempt consumes quota once, even on write(false), partial write or throw.
  frame.events++
  frame.bytes += bytes
  if (frame.fd !== undefined && !frame.fileFault) {
    try { if (writeSync(frame.fd, line, undefined, "utf8") !== bytes) frame.fileFault = true }
    catch { frame.fileFault = true }
  }
  // One synchronous attempt per line. A partial/zero write or throw permanently
  // disables this sink; no reconstruction/replay can turn a fragment into a row.
  if (!frame.stdoutFailed) {
    try { if (writeSync(1, line, undefined, "utf8") !== bytes) { frame.stdoutFailed = true; frame.emissionFault = true } }
    catch { frame.stdoutFailed = true; frame.emissionFault = true }
  }
}
function emit(frame: Frame, kind: string, payload: Payload) {
  if (frame.closed) return
  if (frame.emitting) { frame.emissionFault = true; return }
  frame.emitting = true
  try { append(frame, kind, payload) }
  catch { frame.emissionFault = true }
  finally { frame.emitting = false; if (frame.pendingClose) closeFrame(frame) }
}
function omit(frame: Frame, reason: "detail" | "unit" | "compare" | "phase") {
  if (frame.closed || frame.emitting) return
  frame.dropped = bump(frame, frame.dropped)
  if (!frame.overflowWritten) {
    frame.overflowWritten = true
    emit(frame, "overflow", { reason, generalUsed: frame.generalUsed, unitsAdmitted: frame.nextUnit, dropped: frame.dropped })
  }
}
function general(frame: Frame, places: 1 | 2) {
  if (frame.generalUsed + places > generalSlots) return false
  frame.generalUsed += places
  return true
}
function criticalIndex(point: PhasePoint) {
  if (point === "analysis-select-initial") return 0
  if (point === "analysis-select-final") return 1
  if (point === "analysis-revalidate") return 2
  if (point === "analysis-persist") return 3
  if (point === "analysis-bind") return 4
  return -1
}
function stageFor(point: PhasePoint) {
  if (point === "analysis-select-initial") return 4
  if (point === "analysis-compare") return 5
  if (point === "analysis-persist") return 6
  if (point === "analysis-bind") return 7
  if (point === "analysis-select-final") return 8
  if (point === "analysis-revalidate") return 9
  if (point === "production-analysis-revalidate") return 10
  if (point === "production-analysis") return 3
  if (point === "combination-evaluate") return 2
  return 1
}
function reservePhase(unit: Unit, point: PhasePoint) {
  const tail = tailIndex(unit, point)
  if (tail >= 0 && claimTail(unit.frame, tail)) return true
  const index = criticalIndex(point), frame = unit.frame
  if (frame.firstAnalysis === unit && index >= 0 && !frame.critical[index]) { frame.critical[index] = true; return true }
  return general(frame, 2)
}
// This thunk owns the only invocation. ALS return/error is never authoritative.
function runOnce<T>(frame: Frame | undefined, scope: Scope | undefined, work: () => T, phase?: Phase): T {
  let invoked = false, returned = false, threw = false
  let result!: T, thrown: unknown
  const once = () => {
    if (invoked) { if (threw) throw thrown; return result }
    invoked = true
    if (frame) {
      let installed = false
      try { installed = frame.storage.getStore() === (scope?.token ?? neutralToken) } catch { /* A missing guarantee disables attribution. */ }
      if (!installed) { frame.scopeFault = true; frame.scopeDisabled = true }
    }
    try {
      result = work()
      returned = true
      if (phase) phase.workReturned = true
      return result
    } catch (error) {
      threw = true
      thrown = error
      if (phase) phase.workThrew = true
      throw error
    }
  }
  if (frame) {
    try { frame.storage.run(scope?.token ?? neutralToken, once) }
    catch { if (!threw) { frame.scopeFault = true; frame.scopeDisabled = true } }
  }
  if (!invoked) {
    if (frame) { frame.scopeFault = true; frame.scopeDisabled = true }
    try { once() } catch { /* Rethrow only the value captured from work below. */ }
  }
  if (threw) throw thrown
  // returned is separate from result: undefined is a valid result and no thenable is assimilated.
  if (!returned && frame) frame.scopeFault = true
  return result
}
export function startSfE16Observation(request: Request): unknown {
  if (selectionTried) return undefined
  selectionTried = true
  let fd: number | undefined
  try {
    const start = now(), admitted = admit()
    if (start === undefined || !admitted) return undefined
    const storage = new AsyncLocalStorage<object>()
    fd = openSync(path.join(admitted.directory, "preview-events.jsonl"), "wx", 0o600)
    const frame: Frame = { handle: {}, request, binding: admitted.binding, storage, root: undefined, start, last: start, fd,
      closed: false, pendingClose: false, closeRejected: false, events: 0, bytes: 0, dropped: 0, nextUnit: 0, nextPhase: 0, nextCompare: 0,
      openUnits: 0, openPhases: 0, openCompares: 0, maxDepth: 0, generalUsed: 0, firstAnalysis: undefined,
      critical: [false, false, false, false, false], checkpoints: [false, false, false, false],
      totals: [0, 0, 0], stages: Array.from({ length: 33 }, () => 0), lineage: [0, 0, 0], untracked: 0, saturated: false,
      overflowWritten: false, emissionFault: false, fileFault: false, scopeFault: false, scopeDisabled: false, clockFault: false, backpressure: false, emitting: false,
      stdoutFailed: false, routeDisabled: false, routeScopes: 0, routeOmitted: 0, tailUsed: 0,
      firstPort: undefined, firstProductionRevalidation: undefined, tailMask: 0, validationState: newValidationState() }
    const scope: Scope = { token: {}, frame, parent: undefined, owner: undefined, phase: undefined, compare: undefined, stage: 0, bindingScope: undefined, next: undefined }
    frame.root = scope
    selected = frame
    scopes = scope
    fd = undefined
    emit(frame, "request-enter", { maxEvents, maxBytes, maxLineBytes, detailSlots: 32, unitCloseSlots: unitSlots, activeCompareSlots,
      reservedEvents: 163, lookupDetails: false, validationSlots: 5, validationPoints: 8, analysisBindingSlots: 4 })
    return frame.handle
  } catch {
    if (fd !== undefined) { try { closeSync(fd) } catch { /* Observer setup remains optional. */ } }
    return undefined
  }
}
export function markSfE16Http(handle: unknown, request: Request, point: HttpPoint) {
  try {
    const frame = selected
    if (!frame || frame.closed || frame.emitting || frame.handle !== handle || frame.request !== request ||
        !["body-returned", "admit-returned", "case-callback-entered", "with-case-returned", "egress-passed"].includes(point)) return
    const tail = point === "with-case-returned" ? 5 : point === "egress-passed" ? 6 : -1
    if (!(tail >= 0 && claimTail(frame, tail)) && !general(frame, 1)) { omit(frame, "detail"); return }
    emit(frame, "http-boundary", { point })
  } catch { /* No Request member, result or error is inspected. */ }
}
export function runSfE16Observation<T>(handle: unknown, request: Request, work: () => T): T {
  let frame: Frame | undefined, scope: Scope | undefined
  try {
    const candidate = selected
    if (candidate && !candidate.closed && candidate.handle === handle && candidate.request === request) { frame = candidate; scope = candidate.root }
  } catch { /* The exact work still executes once. */ }
  return runOnce(frame ?? selected, scope, work)
}
export function enterSfE16Unit(kind: UnitKind): unknown {
  try {
    const birth = currentScope()
    if (!birth || !["port", "combination", "analysis", "analysis-revalidation", "production-assess", "production-revalidation"].includes(kind)) return undefined
    const frame = birth.frame, firstAnalysis = kind === "analysis" && !frame.firstAnalysis
    // Reserve one admission and one detail entry for the first analysis even
    // after other units/general details have consumed their own places.
    if (frame.nextUnit >= unitSlots - (frame.firstAnalysis || firstAnalysis ? 0 : 1)) { omit(frame, "unit"); return undefined }
    const unit: Unit = { handle: {}, frame, birth, id: ++frame.nextUnit, kind, parentUnit: birth.owner?.id ?? 0,
      parentPhase: birth.phase?.id ?? 0, phase: undefined, entryReserved: firstAnalysis || general(frame, 1), closed: false, next: units }
    units = unit
    if (firstAnalysis) frame.firstAnalysis = unit
    if (kind === "port" && !frame.firstPort) frame.firstPort = unit
    if (kind === "production-revalidation" && !frame.firstProductionRevalidation) frame.firstProductionRevalidation = unit
    frame.openUnits++
    if (unit.entryReserved) emit(frame, "unit-enter", { unit: unit.id, unitKind: kind, parentUnit: unit.parentUnit, parentPhase: unit.parentPhase })
    else omit(frame, "detail")
    return unit.handle
  } catch { return undefined }
}
export function runSfE16Phase<T>(handle: unknown, point: PhasePoint, work: () => T): T {
  let frame: Frame | undefined, scope: Scope | undefined, phase: Phase | undefined
  try {
    const unit = unitFor(handle), critical = criticalIndex(point)
    const firstCritical = !!unit && unit.frame.firstAnalysis === unit && critical >= 0 && !unit.frame.critical[critical]
    if (unit && !unit.phase && (firstCritical || unit.frame.nextPhase < countCap - 5) &&
        ["port-authority-initial", "candidates-initial", "combination-evaluate", "port-authority-final", "evaluations-recheck", "candidates-final",
          "analysis-select-initial", "analysis-compare", "analysis-persist", "analysis-bind", "analysis-select-final", "analysis-revalidate", "production-analysis", "production-analysis-revalidate"].includes(point)) {
      frame = unit.frame
      const recordReserved = reservePhase(unit, point)
      scope = { token: {}, frame, parent: unit.birth, owner: unit, phase: undefined, compare: undefined, stage: stageFor(point), bindingScope: undefined, next: scopes }
      phase = { frame, owner: unit, id: firstCritical ? critical + 1 : ++frame.nextPhase + 5, point, scope, recordReserved, workReturned: false, workThrew: false, closed: false }
      scope.phase = phase
      scopes = scope
      unit.phase = phase
      frame.openPhases++
      if (recordReserved) emit(frame, "phase-enter", { unit: unit.id, phase: phase.id, point, stage: scope.stage, ...counters(frame) })
      else omit(frame, "detail")
    } else if (unit) omit(unit.frame, "phase")
  } catch { /* Do not replace or repeat the original expression. */ }
  return runOnce(frame ?? selected, scope, work, phase)
}
function detachPhase(unit: Unit) {
  const phase = unit.phase
  if (!phase || phase.closed) return undefined
  phase.closed = true
  unit.phase = undefined
  unit.frame.openPhases--
  forgetScope(phase.scope)
  return phase
}
function publishPhase(phase: Phase, outcome: Outcome) {
  if (phase.recordReserved) emit(phase.frame, "phase-close", { unit: phase.owner.id, phase: phase.id, point: phase.point, stage: phase.scope.stage, outcome, ...counters(phase.frame) })
}
export function returnedSfE16Await<T>(handle: unknown, value: T): T {
  try {
    const unit = unitFor(handle)
    if (unit) { const phase = detachPhase(unit); if (phase) publishPhase(phase, "await-returned") }
  } catch { /* This tap precedes any outer clone/guard and returns the exact value. */ }
  return value
}
export function markSfE16Branch(handle: unknown, point: "analysis-persist" | "analysis-bind", branch: "reuse-result" | "binding-present") {
  try {
    const unit = unitFor(handle)
    if (!unit || unit.kind !== "analysis" || unit.phase ||
        !(point === "analysis-persist" && branch === "reuse-result" || point === "analysis-bind" && branch === "binding-present")) return
    if (!reservePhase(unit, point)) { omit(unit.frame, "detail"); return }
    emit(unit.frame, "branch", { unit: unit.id, point, branch, ...counters(unit.frame) })
  } catch { /* Called only inside an already decided original branch; no predicate repeats. */ }
}
export function finishSfE16Unit(handle: unknown, rejected: boolean) {
  try {
    const unit = unitFor(handle)
    if (!unit) return
    // All close state precedes output, so a reentrant Request close sees one cut.
    const phase = detachPhase(unit)
    unit.closed = true
    unit.frame.openUnits--
    if (phase) publishPhase(phase, rejected ? phase.workThrew ? "abrupt" : phase.workReturned ? "rejected" : "abandoned" : "abandoned")
    emit(unit.frame, "unit-close", { unit: unit.id, unitKind: unit.kind, entryReserved: unit.entryReserved, outcome: rejected ? "body-threw" : "body-returned", ...counters(unit.frame) })
  } catch { /* No sibling is closed or classified by this unit's outcome. */ }
}
export function enterSfE16Compare(): unknown {
  try {
    const birth = currentScope()
    if (!birth) return undefined
    const frame = birth.frame
    let parent: Compare | undefined
    for (let at: Scope | undefined = birth; at; at = at.parent) if (at.compare) { parent = at.compare; break }
    const depth = parent ? parent.depth + 1 : 0, stage = birth.stage
    if (frame.openCompares >= activeCompareSlots || frame.nextCompare >= countCap || depth >= activeCompareSlots) {
      frame.untracked = bump(frame, frame.untracked); omit(frame, "compare"); return undefined
    }
    const scope: Scope = { token: {}, frame, parent: birth, owner: birth.owner, phase: undefined, compare: undefined, stage, bindingScope: undefined, next: scopes }
    const compare: Compare = { handle: {}, frame, birth, scope, id: ++frame.nextCompare, parentCompare: parent?.id ?? 0, depth, stage, closed: false, next: compares }
    scope.compare = compare
    scopes = scope
    compares = compare
    frame.openCompares++
    if (depth > frame.maxDepth) frame.maxDepth = depth
    frame.totals[0] = bump(frame, frame.totals[0] ?? 0)
    frame.stages[stage * 3] = bump(frame, frame.stages[stage * 3] ?? 0)
    const axis = stage === 0 ? 2 : parent ? 1 : 0
    frame.lineage[axis] = bump(frame, frame.lineage[axis] ?? 0)
    return compare.handle
  } catch { return undefined }
}
export function runSfE16Compare<T>(handle: unknown, work: () => T): T {
  let compare: Compare | undefined
  try { compare = compareFor(handle) } catch { /* No replacement invocation. */ }
  return runOnce(compare?.frame ?? selected, compare?.scope, work)
}
export function finishSfE16Compare(handle: unknown, rejected: boolean) {
  try {
    const compare = compareFor(handle)
    if (!compare) return
    const frame = compare.frame, outcome = rejected ? 2 : 1
    compare.closed = true
    frame.openCompares--
    forgetScope(compare.scope)
    forgetCompare(compare)
    frame.totals[outcome] = bump(frame, frame.totals[outcome] ?? 0)
    frame.stages[compare.stage * 3 + outcome] = bump(frame, frame.stages[compare.stage * 3 + outcome] ?? 0)
    const bodyExits = (frame.totals[1] ?? 0) + (frame.totals[2] ?? 0)
    const index = bodyExits === 1 ? 0 : bodyExits === 8 ? 1 : bodyExits === 32 ? 2 : bodyExits === 128 ? 3 : -1
    if (index >= 0 && !frame.checkpoints[index]) {
      frame.checkpoints[index] = true
      emit(frame, "compare-body-checkpoint", { bodyExits, compare: compare.id, parentCompare: compare.parentCompare, depth: compare.depth, stage: compare.stage, ...counters(frame) })
    }
  } catch { /* Counts body exit, not subsequent async adoption; no descendant microphase is emitted. */ }
}
function closeFrame(frame: Frame) {
  if (!frame.pendingClose || frame.emitting) return
  frame.pendingClose = false
  frame.emitting = true
  try {
    append(frame, "request-close", { outcome: frame.closeRejected ? "rejected" : "returned", eventsBefore: frame.events, bytesBefore: frame.bytes,
      dropped: frame.dropped, openUnits: frame.openUnits, openPhases: frame.openPhases, ...counters(frame),
      faultsBefore: [Number(frame.emissionFault), Number(frame.fileFault), Number(frame.scopeFault), Number(frame.scopeDisabled), Number(frame.clockFault), Number(frame.stdoutFailed)],
      routeCoverage: [canonicalRoute ? 1 : 0, preparedLookups, comparatorLookups, persistenceRoute ? 1 : 0, frame.routeOmitted, Number(frame.routeDisabled)] })
  } catch { frame.emissionFault = true }
  finally {
    const fd = frame.fd
    frame.fd = undefined
    if (fd !== undefined) {
      try { fsyncSync(fd); const info = fstatSync(fd); if (!info.isFile() || (!frame.fileFault && info.size !== frame.bytes)) frame.fileFault = true } catch { frame.fileFault = true }
      finally { try { closeSync(fd) } catch { frame.fileFault = true } }
    }
    frame.emitting = false
    scopes = undefined
    units = undefined
    compares = undefined
    routes = undefined
    routeScopes = undefined
    canonicalRoute = undefined
    persistenceRoute = undefined
    financeOwner = undefined
  }
  // This boundary does not attest to later fsync/close, censored units, or a missing terminal.
}
export function finishSfE16Observation(handle: unknown, request: Request, rejected: boolean) {
  try {
    const frame = selected
    if (!frame || frame.closed || frame.handle !== handle || frame.request !== request) return
    clearValidationState(frame)
    frame.closed = true
    frame.request = undefined
    frame.closeRejected = rejected
    frame.pendingClose = true
    closeFrame(frame)
  } catch { /* Preserve the HTTP return/rejection even if observation cannot close. */ }
}

type RouteKind = "canonical" | "lookup" | "persistence"
type RoutePhase = "preparation" | "comparator" | "candidate-read" | "persist-body" | "store-write" | "state-transaction"
type WorkLink = "provider-read" | "provider-write" | "source-work" | "choice-wrapped" | "local-operation"
type Layer = "source" | "choice" | "local" | "operation"
type Gate = "source-root-current" | "callback-equal" | "store-current" | "view-current" | "product-condition"
type FinancePoint = "entered" | "fallback-before-root" | "fallback-no-selection" | "prepare-refused" | "unsupported-criteria" | "witness-refused" | "witness-unsupported" | "owned-records" | "owned-direct" | "outside-root" | "work-enter" | "observation-returned" | "returned"
type RoutePoint =
  "source-enter" | "source-selection" | "choice-forward" | "local-enter" | "native-gates" | "copy-enter" | "copy-close" |
  "candidate-read-returned" | "prewrite" | "store-write-returned" | "state-transaction-enter" | "state-transaction-returned" |
  "queue-enter" | "queue-returned" | "begin-enter" | "begin-returned" | "materialize-enter" | "materialize-returned" |
  "source-work-enter" | "source-work-returned" | "source-finish-enter" | "source-finish-returned" |
  "source-dispose-enter" | "source-dispose-returned" | "local-scope-closed" |
  "encode-enter" | "encode-returned" | "decode-returned" | "sql-returned" | "commit-enter" | "commit-returned" |
  "local-returning" | "operation-returned" | "binding-enter" | "binding-returned" | "validation-enter" | "validation-returned" | "binding-read-returned"
type Route = {
  handle: object; frame: Frame; birth: Scope; kind: RouteKind; id: number; phase: RoutePhase; closed: boolean;
  points: number; phaseMask: number; providerWork: unknown; callback: unknown; sourceWork: unknown; forwardedWork: unknown; operationWork: unknown;
  sourceSeen: boolean; choiceSeen: boolean; localSeen: boolean; operationSeen: boolean; gates: number[]; next: Route | undefined
}
type RouteScope = { scope: Scope; route: Route | undefined; phase: RoutePhase; next: RouteScope | undefined }
const lookupPoints = ["lookup-enter", "candidate-read-enter", "source-enter", "source-selection", "choice-forward", "local-enter",
  "native-gates", "copy-enter", "copy-close", "provider-view", "candidate-read-returned", "lookup-close"]
const persistencePoints = ["persist-enter", "prewrite", "store-write-returned", "persist-close", "state-transaction-enter", "state-transaction-returned",
  "source-enter", "source-selection", "choice-forward", "local-enter", "queue-enter", "queue-returned", "begin-enter", "begin-returned",
  "materialize-enter", "materialize-returned", "source-work-enter", "source-work-returned", "source-finish-enter", "source-finish-returned",
  "source-dispose-enter", "source-dispose-returned", "local-scope-closed", "encode-enter", "encode-returned", "decode-returned",
  "sql-returned", "commit-enter", "commit-returned", "local-returning", "operation-returned", "binding-enter", "binding-returned",
  "validation-enter", "validation-returned", "binding-read-returned"]
const canonicalPoints = ["canonical-enter", "comparator-enter", "finance-enter", "finance-branch", "finance-work-enter", "finance-observation-returned", "finance-body-exit", "finance-outside-root"]
let routes: Route | undefined, routeScopes: RouteScope | undefined, canonicalRoute: Route | undefined, persistenceRoute: Route | undefined
let preparedLookups = 0, comparatorLookups = 0
let financeOwner: object | undefined

function tailIndex(unit: Unit, point: PhasePoint) {
  if (unit === unit.frame.firstAnalysis && point === "analysis-compare") return 0
  if (unit === unit.frame.firstProductionRevalidation && point === "production-analysis-revalidate") return 1
  if (unit !== unit.frame.firstPort) return -1
  return point === "port-authority-final" ? 2 : point === "evaluations-recheck" ? 3 : point === "candidates-final" ? 4 : -1
}
function claimTail(frame: Frame, index: number) {
  const bit = 2 ** index
  if (frame.tailMask % (bit * 2) >= bit) return false
  frame.tailMask += bit
  frame.tailUsed += index < 5 ? 2 : 1
  return true
}
function routeContext(birth = currentScope()): RouteScope | undefined {
  if (!birth || birth.frame.routeDisabled) return
  for (let at: Scope | undefined = birth; at; at = at.parent) {
    for (let item = routeScopes; item; item = item.next) {
      if (item.scope !== at) continue
      if (!item.route || item.route.closed || item.route.frame !== birth.frame) return
      return item
    }
  }
}
function routeFor(handle: unknown): Route | undefined {
  const birth = currentScope()
  if (!birth || birth.frame.routeDisabled) return
  for (let route = routes; route; route = route.next) {
    if (route.handle !== handle || route.closed || route.frame !== birth.frame) continue
    if (route.birth === birth || routeContext(birth)?.route === route) return route
  }
}
function routeScope(route: Route | undefined, phase: RoutePhase, birth: Scope) {
  const frame = birth.frame
  // Two canonical scopes, six read scopes and three persistence scopes fit.
  // Bounded neutral masks cover reentrancy; exhaustion disables attribution.
  if (frame.routeDisabled || frame.routeScopes >= 32) { frame.routeDisabled = true; frame.scopeFault = true; return undefined }
  frame.routeScopes++
  const scope: Scope = { token: {}, frame, parent: birth, owner: birth.owner, phase: undefined, compare: undefined, stage: birth.stage, bindingScope: undefined, next: scopes }
  const item: RouteScope = { scope, route, phase, next: routeScopes }
  scopes = scope
  routeScopes = item
  return scope
}
function selectedDetail(value: unknown) {
  if (value === undefined) return "none"
  if (value === true) return "true"
  if (value === false) return "false"
  if (typeof value !== "string") return "unknown"
  return ["cases", "preferences", "case-identities", "decisionResults", "direct", "wrapped", "child", "top-level", "projected", "full",
    "returned", "threw", "abandoned", "product-refused", "options-refused", "root-absent", "root-refused", "not-requested",
    "fallback-before-root", "fallback-no-selection", "prepare-refused", "unsupported-criteria", "witness-refused", "witness-unsupported",
    "owned-records", "owned-direct", "outside-root"].includes(value) ? value : "unknown"
}
function routeEmit(route: Route, point: string, detail?: unknown) {
  if (route.closed || route.frame.closed || route.frame.routeDisabled || route.frame.emitting) return
  const points = route.kind === "lookup" ? lookupPoints : route.kind === "persistence" ? persistencePoints : canonicalPoints
  const index = points.indexOf(point)
  if (index < 0) return
  const bit = 2 ** index
  if (route.points % (bit * 2) >= bit) return
  // Claim before serialization/clock/sink: reentrancy cannot reuse a place.
  route.points += bit
  emit(route.frame, "route", { routeKind: route.kind, route: route.id, routePhase: route.phase, point, detail: selectedDetail(detail),
    gates: route.gates, parentUnit: route.birth.owner?.id ?? 0, parentPhase: route.birth.phase?.id ?? 0 })
}
function newRoute(kind: RouteKind, phase: RoutePhase, birth: Scope, id: number) {
  const route: Route = { handle: {}, frame: birth.frame, birth, kind, id, phase, closed: false, points: 0, phaseMask: 0,
    providerWork: undefined, callback: undefined, sourceWork: undefined, forwardedWork: undefined, operationWork: undefined,
    sourceSeen: false, choiceSeen: false, localSeen: false, operationSeen: false, gates: [-1, -1, -1, -1, -1], next: routes }
  routes = route
  return route
}
export function enterSfE16Route(kind: RouteKind): unknown {
  try {
    const birth = currentScope()
    if (!birth || birth.frame.routeDisabled) return undefined
    const frame = birth.frame, context = routeContext(birth)
    if (kind === "canonical") {
      if (canonicalRoute) return undefined
      const route = newRoute(kind, "preparation", birth, 1)
      canonicalRoute = route
      routeEmit(route, "canonical-enter")
      return route.handle
    }
    if (kind === "lookup") return undefined
    if (kind === "persistence") {
      if (persistenceRoute) return undefined
      let owner = false
      for (let at: Scope | undefined = birth; at; at = at.parent)
        if (at.phase?.point === "analysis-persist" && at.owner === frame.firstAnalysis) { owner = true; break }
      if (!owner) return undefined
      const route = newRoute(kind, "persist-body", birth, 1)
      persistenceRoute = route
      routeEmit(route, "persist-enter")
      return route.handle
    }
  } catch { /* A diagnostic handle never grants product authority. */ }
  return undefined
}
export function currentSfE16Route(): unknown {
  try { return routeContext()?.route?.handle } catch { return undefined }
}
export function runSfE16Route<T>(handle: unknown, phase: RoutePhase, work: () => T): T {
  // Old lookup callers stay in place, but allocate no route metadata and cannot
  // borrow an ambient persistence route. The original work still runs once.
  if (phase === "candidate-read") return runOnce(selected, undefined, work)
  let frame: Frame | undefined, scope: Scope | undefined
  try {
    const birth = currentScope(), route = routeFor(handle)
    if (birth) {
      frame = birth.frame
      const index = ["preparation", "comparator", "candidate-read", "persist-body", "store-write", "state-transaction"].indexOf(phase)
      const context = routeContext(birth)
      const valid = route && index >= 0 && (route.kind === "canonical" && (phase === "preparation" || phase === "comparator") ||
        route.kind === "persistence" && (phase === "persist-body" || phase === "store-write" || phase === "state-transaction" && context?.phase === "store-write"))
      const bit = index >= 0 ? 2 ** index : 0
      if (valid && route.phaseMask % (bit * 2) < bit) {
        route.phaseMask += bit
        scope = routeScope(route, phase, birth)
        if (phase === "comparator") {
          routeEmit(route, "comparator-enter")
          if (financeOwner) routeEmit(route, "finance-work-enter")
        }
        if (phase === "store-write") routeEmit(route, "prewrite")
        if (phase === "state-transaction") routeEmit(route, "state-transaction-enter")
      } else {
        // Preserve E14's lexical stage while masking an ambient selected route.
        scope = context ? routeScope(undefined, phase, birth) : birth
      }
    }
  } catch { if (selected) { selected.scopeFault = true; selected.routeDisabled = true } }
  return runOnce(frame ?? selected, scope, work)
}
export function finishSfE16Route(handle: unknown, threw: boolean) {
  try {
    const route = routeFor(handle)
    if (!route) return
    if (route.kind === "persistence") clearValidationState(route.frame)
    if (route.kind !== "canonical") routeEmit(route, route.kind === "lookup" ? "lookup-close" : "persist-close", threw ? "threw" : "returned")
    if (route.frame.closed) return
    route.closed = true
    route.providerWork = undefined
    route.callback = undefined
    route.sourceWork = undefined
    route.forwardedWork = undefined
    route.operationWork = undefined
  } catch { /* The original caught/thrown value is not passed to the observer. */ }
}
export function linkSfE16Work<T>(handle: unknown, point: WorkLink, value: T, callback?: unknown): T {
  try {
    const route = routeFor(handle), context = routeContext()
    if (!route || context?.route !== route || typeof value !== "function") return value
    if (point === "provider-read" && route.kind === "lookup" && context.phase === "candidate-read" && route.providerWork === undefined) {
      route.providerWork = value
      route.callback = callback
    } else if (point === "provider-write" && route.kind === "persistence" && context.phase === "state-transaction" && route.providerWork === undefined) {
      route.providerWork = value
    } else if (point === "source-work" && route.sourceSeen && route.sourceWork === undefined) {
      route.sourceWork = value
    } else if (point === "choice-wrapped" && route.choiceSeen && route.forwardedWork === undefined) {
      route.forwardedWork = value
    } else if (point === "local-operation" && route.localSeen && route.operationWork === undefined) {
      route.operationWork = value
    }
  } catch { /* No original callback is wrapped, invoked, or inspected. */ }
  return value
}
export function enterSfE16Layer(layer: Layer, work: unknown): unknown {
  try {
    const context = routeContext(), route = context?.route
    if (!route || route.kind === "canonical" || typeof work !== "function") return undefined
    if (layer === "source" && !route.sourceSeen && work === route.providerWork) {
      route.sourceSeen = true
      routeEmit(route, "source-enter")
      return route.handle
    }
    if (layer === "choice" && !route.choiceSeen && route.sourceSeen && work === route.sourceWork) {
      route.choiceSeen = true
      return route.handle
    }
    if (layer === "local" && !route.localSeen && route.sourceSeen && work === (route.forwardedWork ?? route.sourceWork)) {
      route.localSeen = true
      return route.handle
    }
    if (layer === "operation" && !route.operationSeen && route.localSeen && work === route.operationWork) {
      route.operationSeen = true
      return route.handle
    }
  } catch { /* Unknown, reused, foreign and late work cannot join the selected chain. */ }
  return undefined
}
export function markSfE16Route(handle: unknown, point: RoutePoint, detail?: unknown) {
  try {
    const route = routeFor(handle)
    if (!route) return
    if (point === "choice-forward" && detail === "direct" && route.choiceSeen && route.forwardedWork === undefined)
      route.forwardedWork = route.sourceWork
    routeEmit(route, point, detail)
  } catch { /* Only bounded local facts are emitted. */ }
}
export function returnedSfE16Route<T>(handle: unknown, point: RoutePoint, value: T): T {
  markSfE16Route(handle, point, point === "copy-close" ? value : "returned")
  return value
}
export function tapSfE16Gate<T>(handle: unknown, gate: Gate, value: T): T {
  try {
    const route = routeFor(handle)
    if (route) {
      const index = ["source-root-current", "callback-equal", "store-current", "view-current", "product-condition"].indexOf(gate)
      // -1 means no tap evaluated; 2 means an evaluated nonboolean result.
      // Optional source-root absence is identified separately by its branch row.
      if (index >= 0 && route.gates[index] === -1) route.gates[index] = value === true ? 1 : value === false ? 0 : 2
    }
  } catch { /* A tap returns the original predicate result without coercing it. */ }
  return value
}
export function tapSfE16ProviderSelection<T>(callback: unknown, value: T): T {
  try {
    const route = routeContext()?.route
    if (route?.kind === "lookup" && typeof callback === "function" && callback === route.callback) routeEmit(route, "provider-view", value)
  } catch { /* Preserve the already performed optional selection lookup. */ }
  return value
}
export function markSfE16Finance(point: FinancePoint, owner?: unknown): unknown {
  try {
    const context = routeContext(), route = context?.route
    if (!route || route !== canonicalRoute) return undefined
    if (point === "entered") {
      if (context.phase !== "preparation" || financeOwner) return undefined
      financeOwner = {}
      routeEmit(route, "finance-enter")
      return financeOwner
    }
    if (!financeOwner || owner !== financeOwner) return undefined
    if (point === "returned") routeEmit(route, "finance-body-exit")
    else if (point === "work-enter") routeEmit(route, "finance-work-enter")
    else if (point === "observation-returned") routeEmit(route, "finance-observation-returned")
    else if (point === "outside-root") routeEmit(route, "finance-outside-root", point)
    else routeEmit(route, "finance-branch", point)
  } catch { /* Records an existing branch; it never reads a witness or grant. */ }
  return undefined
}

// The bridges feed decoded chunks here BEFORE their unchanged splitLines/readiness
// pipeline. Only observed LF completes a diagnostic row; EOF never invents one.

// E16 observes five fixed validation sites of one persistence. These private
// handles attribute work; they grant no product permission or native capability.
type BindingPhase = "persist-bind" | "persist-read"
type ValidationSite = "bind-prewrite" | "read-initial" | "read-final"
type ValidationPoint = "validate-enter" | "verify-comparison-enter" | "verify-await-returned" |
  "observer-enter" | "work-enter" | "criteria-await-returned" | "observer-await-returned" | "validate-await-returned"
type AnalysisBindingPoint = "initial" | "final"
type ValidationState = {
  owner: unknown; context: unknown; bind: BindingCall | undefined; read: BindingCall | undefined;
  methods: BindingMethod | undefined; scopes: number; disabled: boolean;
  analysisInitial: AnalysisBinding | undefined; analysisFinal: AnalysisBinding | undefined;
}
type BindingCall = {
  kind: "call"; handle: object; frame: Frame; route: Route; phase: BindingPhase; context: unknown;
  scope: Scope | undefined; started: boolean; method: BindingMethod | undefined; readback: BindingRead | undefined; closed: boolean;
}
type BindingRead = {
  kind: "read"; frame: Frame; call: BindingCall; scope: Scope | undefined;
  method: BindingMethod | undefined; closed: boolean;
}
type BindingMethod = {
  handle: object; frame: Frame; call: BindingCall; kind: "bind" | "read"; owner: unknown; context: unknown; birth: Scope;
  prewrite: Validation | undefined; initial: Validation | undefined; final: Validation | undefined;
  started: boolean; closed: boolean; next: BindingMethod | undefined;
}
type Validation = {
  kind: "validation"; handle: object; frame: Frame; method: BindingMethod; site: ValidationSite; id: number;
  binding: unknown; context: unknown; scope: Scope | undefined; started: boolean; entered: boolean;
  points: number; verifier: Verifier | undefined; closed: boolean;
}
type Verifier = {
  kind: "verifier"; handle: object; frame: Frame; validation: Validation; scope: Scope | undefined;
  started: boolean; entered: boolean; closed: boolean;
}
type BindingScope = BindingCall | BindingRead | Validation | Verifier
type AnalysisBinding = {
  handle: object; frame: Frame; owner: Unit; birth: Scope; point: AnalysisBindingPoint; closed: boolean;
}
function newValidationState(): ValidationState {
  return { owner: undefined, context: undefined, bind: undefined, read: undefined, methods: undefined,
    scopes: 0, disabled: false, analysisInitial: undefined, analysisFinal: undefined }
}
function bindingContext(birth = currentScope()): BindingScope | undefined {
  if (!birth || birth.frame.validationState.disabled) return undefined
  for (let at: Scope | undefined = birth; at; at = at.parent)
    if (at.bindingScope) return at.bindingScope.closed ? undefined : at.bindingScope
}
function unselectedBindingScope(birth: Scope | undefined) {
  return bindingContext(birth) ? undefined : birth
}
function createBindingScope(boundary: BindingScope, birth: Scope) {
  const frame = birth.frame, state = frame.validationState
  // This independent reserve cannot be spent by generic or old route scopes:
  // two calls + one internal read + five validations + five verifier calls.
  if (frame.closed || frame.emitting || state.disabled || state.scopes >= 13) {
    if (!frame.closed) { state.disabled = true; frame.scopeFault = true }
    return undefined
  }
  state.scopes++
  const scope: Scope = { token: {}, frame, parent: birth, owner: birth.owner, phase: undefined,
    compare: undefined, stage: birth.stage, bindingScope: boundary, next: scopes }
  boundary.scope = scope
  scopes = scope
  return scope
}
function bindingCallFor(handle: unknown): BindingCall | undefined {
  const birth = currentScope()
  if (!birth) return undefined
  const state = birth.frame.validationState
  const call = state.bind?.handle === handle ? state.bind : state.read?.handle === handle ? state.read : undefined
  return call && !call.closed && call.frame === birth.frame ? call : undefined
}
function bindingMethodFor(handle: unknown): BindingMethod | undefined {
  const birth = currentScope()
  if (!birth) return undefined
  for (let method = birth.frame.validationState.methods; method; method = method.next)
    if (method.handle === handle && !method.closed && !method.call.closed && method.birth === birth) return method
}
function validationFor(handle: unknown): Validation | undefined {
  const birth = currentScope()
  if (!birth) return undefined
  for (let method = birth.frame.validationState.methods; method; method = method.next) {
    const value = method.prewrite?.handle === handle ? method.prewrite :
      method.initial?.handle === handle ? method.initial : method.final?.handle === handle ? method.final : undefined
    if (value && !value.closed && !method.call.closed && value.frame === birth.frame) return value
  }
}
function verifierFor(handle: unknown): Verifier | undefined {
  const birth = currentScope()
  if (!birth) return undefined
  for (let method = birth.frame.validationState.methods; method; method = method.next) {
    const value = method.prewrite && method.prewrite.verifier?.handle === handle ? method.prewrite.verifier :
      method.initial && method.initial.verifier?.handle === handle ? method.initial.verifier :
      method.final && method.final.verifier?.handle === handle ? method.final.verifier : undefined
    if (value && !value.closed && !value.validation.closed && !method.call.closed && value.frame === birth.frame) return value
  }
}
function closeValidation(value: Validation) {
  value.closed = true
  value.binding = undefined
  value.context = undefined
  if (value.verifier) value.verifier.closed = true
}
function closeBindingCall(call: BindingCall) {
  call.closed = true
  call.context = undefined
  if (call.readback) call.readback.closed = true
  for (let method = call.frame.validationState.methods; method; method = method.next) {
    if (method.call !== call) continue
    method.closed = true
    method.owner = undefined
    method.context = undefined
    if (method.prewrite) closeValidation(method.prewrite)
    if (method.initial) closeValidation(method.initial)
    if (method.final) closeValidation(method.final)
  }
}
function clearValidationState(frame: Frame) {
  const state = frame.validationState
  if (state.bind) closeBindingCall(state.bind)
  if (state.read) closeBindingCall(state.read)
  state.owner = undefined
  state.context = undefined
  state.methods = undefined
  state.bind = undefined
  state.read = undefined
}
function validationIndex(point: ValidationPoint) {
  switch (point) {
    case "validate-enter": return 0
    case "verify-comparison-enter": return 1
    case "verify-await-returned": return 2
    case "observer-enter": return 3
    case "work-enter": return 4
    case "criteria-await-returned": return 5
    case "observer-await-returned": return 6
    case "validate-await-returned": return 7
  }
}
function validationEmit(value: Validation, point: ValidationPoint, closing = false) {
  const frame = value.frame, bit = 2 ** validationIndex(point)
  if (frame.closed || frame.emitting || frame.validationState.disabled || value.closed || !value.entered ||
      value.points % (bit * 2) >= bit) return
  value.points += bit
  // Close before clock or sink hooks. A refused sibling never reaches this row.
  if (closing) closeValidation(value)
  emit(frame, "binding-validation", { persistence: 1, bindingPhase: value.method.call.phase,
    validation: value.id, validationSite: value.site, point })
}
export function prepareSfE16Binding(handle: unknown, phase: BindingPhase, context: unknown): unknown {
  try {
    const birth = currentScope(), route = routeFor(handle)
    if (!birth || !route || route !== persistenceRoute || route.kind !== "persistence" || bindingContext(birth)) return undefined
    const current = routeContext(birth), state = birth.frame.validationState
    if (current?.route !== route || current.phase !== "persist-body" || state.disabled) return undefined
    if (phase === "persist-bind" ? state.bind !== undefined :
        phase !== "persist-read" || state.read !== undefined || !state.bind?.closed ||
        state.owner === undefined || state.context !== context) return undefined
    const call: BindingCall = { kind: "call", handle: {}, frame: birth.frame, route, phase, context,
      scope: undefined, started: false, method: undefined, readback: undefined, closed: false }
    if (phase === "persist-bind") state.bind = call
    else state.read = call
    return call.handle
  } catch { return undefined }
}
export function runSfE16Binding<T>(handle: unknown, work: () => T): T {
  let scope: Scope | undefined, frame: Frame | undefined
  try {
    const birth = currentScope()
    scope = unselectedBindingScope(birth)
    const call = bindingCallFor(handle)
    if (birth && call && !call.started && !bindingContext(birth) &&
        routeContext(birth)?.route === call.route) {
      call.started = true
      frame = call.frame
      scope = createBindingScope(call, birth)
    }
  } catch { /* Attribution cannot replace or repeat this original call. */ }
  return runOnce(frame ?? selected, scope, work)
}
export function returnedSfE16Binding<T>(handle: unknown, value: T): T {
  try {
    const call = bindingCallFor(handle), birth = currentScope()
    if (call?.started && call.scope?.parent === birth) closeBindingCall(call)
  } catch { /* The original await value is opaque and unchanged. */ }
  return value
}
export function enterSfE16BindingMethod(kind: "bind" | "read", owner: unknown, context: unknown): unknown {
  try {
    const birth = currentScope(), boundary = bindingContext(birth)
    if (!birth || !boundary || boundary.scope !== birth || typeof owner !== "function" ||
        boundary.kind !== "call" && boundary.kind !== "read" || boundary.method) return undefined
    const call = boundary.kind === "call" ? boundary : boundary.call
    const state = birth.frame.validationState
    if (call.closed || context !== call.context) return undefined
    if (kind === "bind") {
      if (boundary.kind !== "call" || call.phase !== "persist-bind" || state.owner !== undefined) return undefined
      state.owner = owner
      state.context = context
    } else if (kind !== "read" || boundary.kind === "call" && call.phase !== "persist-read" ||
        state.owner !== owner || state.context !== context) return undefined
    const method: BindingMethod = { handle: {}, frame: birth.frame, call, kind, owner, context, birth,
      prewrite: undefined, initial: undefined, final: undefined, started: false, closed: false, next: state.methods }
    boundary.method = method
    state.methods = method
    return method.handle
  } catch { return undefined }
}
export function runSfE16BindingMethod<T>(handle: unknown, work: () => T): T {
  let scope: Scope | undefined, frame: Frame | undefined
  try {
    const birth = currentScope()
    scope = unselectedBindingScope(birth)
    const method = bindingMethodFor(handle)
    if (birth && method && !method.started) {
      method.started = true
      frame = method.frame
      // Reuse the admitted call/read scope. Refused entire methods run neutrally,
      // including their preparatory callbacks before any validation is attempted.
      scope = birth
    }
  } catch { /* Diagnostic failure cannot replace or replay this original body. */ }
  return runOnce(frame ?? selected, scope, work)
}
export function runSfE16BindingRead<T>(handle: unknown, work: () => T): T {
  let scope: Scope | undefined, frame: Frame | undefined
  try {
    const birth = currentScope()
    scope = unselectedBindingScope(birth)
    const method = bindingMethodFor(handle)
    if (birth && method?.kind === "bind" && method.started && method.call.phase === "persist-bind" &&
        !method.call.readback && method.prewrite?.closed) {
      const child: BindingRead = { kind: "read", frame: method.frame, call: method.call,
        scope: undefined, method: undefined, closed: false }
      method.call.readback = child
      // The outer method cannot be reentered, but its call remains live until the
      // persistence's original await has adopted the Promise of this internal read.
      method.closed = true
      method.owner = undefined
      method.context = undefined
      frame = method.frame
      scope = createBindingScope(child, birth)
    }
  } catch { /* No await or settlement handler is added to the returned Promise. */ }
  return runOnce(frame ?? selected, scope, work)
}
export function prepareSfE16Validation(handle: unknown, site: ValidationSite, binding: unknown): unknown {
  try {
    const method = bindingMethodFor(handle)
    if (!method || !method.started || method.frame.validationState.disabled) return undefined
    const phase = method.call.phase
    const id = site === "bind-prewrite" && method.kind === "bind" && phase === "persist-bind" ? 1 :
      site === "read-initial" && method.kind === "read" ? phase === "persist-bind" ? 2 : 4 :
      site === "read-final" && method.kind === "read" ? phase === "persist-bind" ? 3 : 5 : 0
    if (!id || (site === "bind-prewrite" ? method.prewrite : site === "read-initial" ? method.initial : method.final)) return undefined
    const value: Validation = { kind: "validation", handle: {}, frame: method.frame, method, site, id, binding,
      context: method.context, scope: undefined, started: false, entered: false, points: 0, verifier: undefined, closed: false }
    if (site === "bind-prewrite") method.prewrite = value
    else if (site === "read-initial") method.initial = value
    else method.final = value
    return value.handle
  } catch { return undefined }
}
export function runSfE16Validation<T>(handle: unknown, work: () => T): T {
  let scope: Scope | undefined, frame: Frame | undefined
  try {
    const birth = currentScope()
    scope = unselectedBindingScope(birth)
    const value = validationFor(handle)
    if (birth && value && !value.started && !value.method.closed && value.method.birth === birth) {
      value.started = true
      frame = value.frame
      scope = createBindingScope(value, birth)
    }
  } catch { /* No validation or its input is invoked by diagnostic admission. */ }
  return runOnce(frame ?? selected, scope, work)
}
export function enterSfE16Validation(owner: unknown, binding: unknown, context: unknown) {
  try {
    const birth = currentScope(), value = bindingContext(birth)
    if (!birth || value?.kind !== "validation" || value.scope !== birth || value.entered ||
        value.method.owner !== owner || value.binding !== binding || value.context !== context) return
    value.entered = true
    validationEmit(value, "validate-enter")
  } catch { /* Only opaque identities are compared. */ }
}
export function returnedSfE16Validation<T>(handle: unknown, result: T): T {
  try {
    const value = validationFor(handle), birth = currentScope()
    if (value?.started && value.method.birth === birth) {
      if (value.entered) validationEmit(value, "validate-await-returned", true)
      else closeValidation(value)
    }
  } catch { /* Fulfillment says nothing about the original value's validity. */ }
  return result
}
export function currentSfE16Validation(binding: unknown, context: unknown): unknown {
  try {
    const value = bindingContext()
    if (value?.kind === "validation" && value.entered && value.binding === binding && value.context === context)
      return value.handle
  } catch { /* No input property is read. */ }
}
export function prepareSfE16Verifier(binding: unknown, context: unknown): unknown {
  try {
    const value = bindingContext(), birth = currentScope()
    if (value?.kind !== "validation" || !value.entered || value.scope !== birth || value.verifier ||
        value.binding !== binding || value.context !== context) return undefined
    const verifier: Verifier = { kind: "verifier", handle: {}, frame: value.frame, validation: value,
      scope: undefined, started: false, entered: false, closed: false }
    value.verifier = verifier
    return verifier.handle
  } catch { return undefined }
}
export function runSfE16Verifier<T>(handle: unknown, work: () => T): T {
  let scope: Scope | undefined, frame: Frame | undefined
  try {
    const birth = currentScope()
    scope = unselectedBindingScope(birth)
    const verifier = verifierFor(handle)
    if (birth && verifier && !verifier.started && verifier.validation.scope === birth) {
      verifier.started = true
      frame = verifier.frame
      scope = createBindingScope(verifier, birth)
    }
  } catch { /* Optional chaining and the original callee remain inside work. */ }
  return runOnce(frame ?? selected, scope, work)
}
export function enterSfE16Verifier(binding: unknown, context: unknown) {
  try {
    const birth = currentScope(), verifier = bindingContext(birth)
    if (!birth || verifier?.kind !== "verifier" || verifier.scope !== birth || verifier.entered ||
        verifier.validation.binding !== binding || verifier.validation.context !== context) return
    verifier.entered = true
    validationEmit(verifier.validation, "verify-comparison-enter")
  } catch { /* This point is the real verifier body, before its original work. */ }
}
export function returnedSfE16Verifier<T>(handle: unknown, result: T): T {
  try {
    const verifier = verifierFor(handle), birth = currentScope()
    if (verifier?.started && verifier.validation.scope === birth) {
      verifier.closed = true
      // An optional-chain fallback without a real verifier entry is not its return.
      if (verifier.entered) validationEmit(verifier.validation, "verify-await-returned")
    }
  } catch { /* Publication and finally already belong to the original awaited call. */ }
  return result
}
export function markSfE16Validation(handle: unknown, point: "observer-enter" | "work-enter") {
  try {
    const value = validationFor(handle), boundary = bindingContext()
    if (value && boundary === value && (point === "observer-enter" || point === "work-enter")) validationEmit(value, point)
  } catch { /* The callback and its already evaluated guards are not inspected. */ }
}
export function returnedSfE16ValidationPoint<T>(handle: unknown, point: "criteria-await-returned" | "observer-await-returned", result: T): T {
  try {
    const value = validationFor(handle), boundary = bindingContext()
    if (value && boundary === value && (point === "criteria-await-returned" || point === "observer-await-returned"))
      validationEmit(value, point)
  } catch { /* Preserve the exact Promise.all/observer fulfillment without cloning it. */ }
  return result
}
export function enterSfE16AnalysisBinding(handle: unknown, point: AnalysisBindingPoint): unknown {
  try {
    const owner = unitFor(handle)
    if (!owner || owner !== owner.frame.firstAnalysis || owner.phase || point !== "initial" && point !== "final") return undefined
    const frame = owner.frame, state = frame.validationState
    if (point === "initial" ? state.analysisInitial : state.analysisFinal) return undefined
    const value: AnalysisBinding = { handle: {}, frame, owner, birth: owner.birth, point, closed: false }
    if (point === "initial") state.analysisInitial = value
    else state.analysisFinal = value
    emit(frame, "analysis-binding", { unit: owner.id, point, boundary: "enter" })
    return value.handle
  } catch { return undefined }
}
export function returnedSfE16AnalysisBinding<T>(handle: unknown, result: T): T {
  try {
    const birth = currentScope()
    if (!birth) return result
    const state = birth.frame.validationState
    const value = state.analysisInitial?.handle === handle ? state.analysisInitial :
      state.analysisFinal?.handle === handle ? state.analysisFinal : undefined
    if (value && !value.closed && value.birth === birth && !value.owner.closed) {
      value.closed = true
      emit(value.frame, "analysis-binding", { unit: value.owner.id, point: value.point, boundary: "await-returned" })
    }
  } catch { /* This is an independent read boundary, not one of the five slots. */ }
  return result
}

export function createSfE16Forwarder(): (chunk: string) => string {
  const state = { tail: "", discarding: false, diagnostic: false, failed: false, events: 0, bytes: 0, mode: "" }
  return (chunk) => {
    try {
      if (state.failed || typeof chunk !== "string") return chunk
      for (let index = 0; index < chunk.length; index++) {
        const character = chunk[index]!
        if (character !== "\n") {
          if (character.charCodeAt(0) > 127) {
            if (state.diagnostic || state.tail.startsWith(prefix) || state.tail.startsWith("SF_PREVIEW_E16_LAUNCHER ")) { state.failed = true; break }
            state.tail = ""
            state.discarding = true
            continue
          }
          if (!state.discarding) {
            if (state.tail.length < maxLineBytes - 1) state.tail += character
            else {
              state.diagnostic = state.tail.startsWith(prefix) || state.tail.startsWith("SF_PREVIEW_E16_LAUNCHER ")
              state.tail = ""
              state.discarding = true
            }
          }
          continue
        }
        const line = state.tail
        const discarded = state.discarding, diagnostic = state.diagnostic
        state.tail = ""
        state.discarding = false
        state.diagnostic = false
        if (discarded) { if (diagnostic) { state.failed = true; break } else continue }
        const mode = line.startsWith(prefix) ? "events" : line.startsWith("SF_PREVIEW_E16_LAUNCHER ") ? "disabled" : ""
        if (!mode) continue
        if (!/^[\x20-\x7e]*$/.test(line) || state.mode && mode !== state.mode ||
            state.events >= (mode === "events" ? maxEvents : 1) || state.bytes + line.length + 1 > (mode === "events" ? maxBytes : maxLineBytes)) {
          state.failed = true
          break
        }
        state.mode = mode
        const complete = line + "\n", bytes = line.length + 1
        state.events++
        state.bytes += bytes
        try { if (writeSync(1, complete, undefined, "utf8") !== bytes) state.failed = true }
        catch { state.failed = true }
        if (state.failed) break
      }
    } catch { state.failed = true }
    return chunk
  }
}

function hash(value: string) { return createHash("sha256").update(value, "utf8").digest("hex") }
function within(parent: string, child: string) {
  const relative = path.relative(parent, child)
  return relative === "" || relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative)
}
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}
function admit(): { directory: string; binding: Binding } | undefined {
  const directory = process.env[directoryKey], encoded = process.env[bindingKey]
  if (!directory || !encoded) return undefined
  if (encoded.length > 4096 || process.platform !== "linux" || process.arch !== "x64" ||
      typeof Bun === "undefined" || Bun.version !== "1.3.14" || Bun.revision !== revision) throw new Error("cpu-runtime")
  const repository = realpathSync(fileURLToPath(new URL("../../../../", import.meta.url)))
  if (process.argv[1] !== path.join(repository, "apps/cli/src/index.ts") || process.argv[2] !== "serve")
    throw new Error("cpu-process")
  const base = path.join(repository, "test-ci-evidence"), value: unknown = JSON.parse(encoded)
  if (!object(value) || value.schema !== "sf-preview-e16-event-launch-v1" || value.source !== source ||
      value.sourceTree !== sourceTree || typeof value.snapshot !== "string" || !/^[a-f0-9]{40}$/.test(value.snapshot) ||
      typeof value.runId !== "string" || !/^[0-9]{1,20}$/.test(value.runId) || value.attempt !== "1" ||
      typeof value.nonce !== "string" || !/^sf613-e16-event-[A-Za-z0-9]{6}$/.test(value.nonce) ||
      typeof value.launcherBytes !== "number" || value.launcherBytes < 1 || value.launcherBytes > 8192 ||
      value.launcherBytes % 1 !== 0 || typeof value.launcherSha256 !== "string" || !/^[a-f0-9]{64}$/.test(value.launcherSha256))
    throw new Error("cpu-binding")
  if (!path.isAbsolute(directory) || path.dirname(directory) !== base || path.basename(directory) !== value.nonce ||
      realpathSync(base) !== base || realpathSync(directory) !== directory ||
      !lstatSync(directory).isDirectory() || lstatSync(directory).isSymbolicLink() || within(realpathSync(process.cwd()), directory))
    throw new Error("cpu-directory")
  const launcherPath = path.join(directory, "launcher.json"), info = lstatSync(launcherPath)
  if (!info.isFile() || info.isSymbolicLink() || info.size !== value.launcherBytes) throw new Error("cpu-launcher")
  const text = readFileSync(launcherPath, "utf8"), launcher: unknown = JSON.parse(text)
  if (Buffer.byteLength(text, "utf8") !== value.launcherBytes || hash(text) !== value.launcherSha256 || !object(launcher))
    throw new Error("cpu-launcher")
  for (const key of ["schema", "source", "sourceTree", "snapshot", "runId", "attempt", "nonce"] as const)
    if (launcher[key] !== value[key]) throw new Error("cpu-launcher-binding")
  if (launcher.processRole !== "native-cli" || launcher.streamName !== "preview-events.jsonl")
    throw new Error("cpu-launcher-role")
  return { directory, binding: value as Binding }
}
