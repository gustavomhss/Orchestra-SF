// Snapshot-only public Context observation derived from the audited Preview JSC diagnostic. Never promote.
// bun:jsc.profile is confirmed at Bun 1.3.14/0d9b296 and 1.4.1/4661e49.
import { profile } from "bun:jsc"
import { setContextJscPulse } from "./context-jsc-pulse.ts"

const source = "97c921ab0054bd5154227593adcbcca56b0538c3"
const sourceTree = "3f04bc2f32be61ea4596b2d8c008c3f944e5841b"
const intervalUs = 10_000, requestedWindowMs = 45_000
const maximumTraces = 16_384, maximumSources = 4096, maximumFrames = 128
const maximumSites = 4096, maximumCriticalPaths = 2048, maximumPathDepth = 12
const maximumLines = 64, maximumLineBytes = 4096
const clock = performance.now.bind(performance), write = console.info.bind(console)
const categories = new Set(["LLInt", "Baseline", "DFG", "FTL", "js builtin", "IPInt", "BBQ", "OMG",
  "Wasm", "Host", "RegExp", "C/C++", "Unknown Frame", "Unknown Executable"])
const nativeNames = new Set([
  "structuredClone", "stringify", "parse", "sort", "map", "filter", "every", "some", "forEach", "reduce",
  "update", "digest", "get", "all", "run", "query", "prepare", "next", "finalize", "close",
  "getOwnPropertyDescriptor", "getOwnPropertyDescriptors", "getPrototypeOf", "hasOwn", "ownKeys",
  "isArray", "isProxy", "isFinite", "isSafeInteger", "charCodeAt", "indexOf", "includes", "slice",
  "push", "pop", "fromEntries", "defineProperty", "keys", "values", "entries", "lstatSync", "isFile",
  "has", "set", "add", "delete", "apply", "call", "resolve", "reject", "then", "getTime", "now",
])
let claimed = false

type Location = { path: string | null; mapping: "repository" | "builtin" | "bundle" | "unknown" }
type Frame = Location & { sourceId: number | null; line: number | null; column: number | null; name: string; category: string }
type Site = { path: string; line: number | null; column: number | null; name: string }
type SelfCount = Frame & { samples: number }
type InclusiveCount = Site & { samples: number }
type CriticalPath = { leaf: Frame; frames: Site[]; samples: number }
type NativeNearest = { leaf: Frame; site: Site; samples: number }

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}
function array(value: unknown): value is unknown[] { return Array.isArray(value) }
function coordinate(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 999999 ? value : null
}
function identifier(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null
}
function location(value: unknown): Location {
  if (typeof value !== "string" || value.length > 4096) return { path: null, mapping: "unknown" }
  if (value === "bun:sqlite" || value === "node:crypto") return { path: value, mapping: "builtin" }
  for (const marker of ["modules/", "apps/", "packages/"]) {
    const offset = value.lastIndexOf("/" + marker)
    const path = offset >= 0 ? value.slice(offset + 1) : value.startsWith(marker) ? value : ""
    if (path.length <= 160 && path.startsWith(marker) && /^[A-Za-z0-9_@./-]+$/.test(path) &&
      !path.split("/").some((part) => part === "..") && /\.(?:[cm]?[jt]sx?|zig|rs|cpp|h)$/.test(path))
      return { path, mapping: "repository" }
  }
  return { path: null, mapping: value.startsWith("/$bunfs/") || value.startsWith("file:///$bunfs/") ? "bundle" : "unknown" }
}
function frame(value: unknown, sources: Map<number, Location>): Frame | undefined {
  if (!record(value)) return undefined
  const sourceId = identifier(value.sourceID)
  const found = value.sourceURL !== undefined ? location(value.sourceURL)
    : sourceId === null ? { path: null, mapping: "unknown" } : sources.get(sourceId)
  const mapped: Location = found?.mapping === "repository" || found?.mapping === "builtin" || found?.mapping === "bundle"
    ? { path: found.path, mapping: found.mapping } : { path: null, mapping: "unknown" }
  const name = typeof value.name === "string" && /^[A-Za-z_$][A-Za-z0-9_$.]{0,63}$/.test(value.name) &&
    (mapped.mapping === "repository" || mapped.mapping === "bundle" || nativeNames.has(value.name)) ? value.name : "unknown"
  return { ...mapped, sourceId, line: coordinate(value.line), column: coordinate(value.column), name,
    category: typeof value.category === "string" && categories.has(value.category) ? value.category : "unrecognized" }
}
function siteKey(value: Site) { return JSON.stringify([value.path, value.line, value.column, value.name]) }
function selfKey(value: Frame) {
  return JSON.stringify([value.sourceId, value.path, value.line, value.column, value.name, value.category, value.mapping])
}

/** The observer promise never replaces or gates a product/test promise. */
export function beginContextJscDiagnostic() {
  try { return reserveObservation() }
  catch {
    try { write("SF_CONTEXT_JSC", JSON.stringify({ schema: "sf-context-jsc-v1", qualification: false, source, sourceTree, phase: "error", stage: "bootstrap" })) }
    catch { /* Reporting cannot replace the original test result. */ }
    return undefined
  }
}

function reserveObservation() {
  if (claimed) return undefined
  claimed = true
  const started = clock()
  let resolveSignal: (() => void) | undefined, callbackAt: number | undefined, signalAt: number | undefined
  let emitted = 0, dropped = 0, outputErrors = 0
  let stopped = false, timer: ReturnType<typeof setTimeout> | undefined
  const elapsed = () => Math.round(clock() - started)
  function emit(phase: string, fields: Record<string, unknown>) {
    try {
      if (emitted >= maximumLines) { dropped++; return false }
      const line = JSON.stringify({ schema: "sf-context-jsc-v1", qualification: false, source, sourceTree, phase, ...fields })
      if (line.length + "SF_CONTEXT_JSC ".length + 1 > maximumLineBytes || /[^\x20-\x7e]/.test(line)) { dropped++; return false }
      emitted++
      try { write("SF_CONTEXT_JSC", line); return true } catch { outputErrors++; return false }
    } catch { outputErrors++; return false }
  }
  function failure(stage: string) {
    try { emit("error", { stage, elapsedMs: elapsed(), signalMs: signalAt ?? null, dropped, outputErrors }) }
    catch { /* A diagnostic failure never replaces the original test result. */ }
  }
  function stop(reason: "diagnostic-window-timer" | "diagnostic-window-pulse" | "original-context-settled" | "setup-failed" | "profile-failed") {
    try {
      if (stopped) return
      stopped = true
      setContextJscPulse(undefined)
      if (timer !== undefined) clearTimeout(timer)
      signalAt = elapsed()
      resolveSignal?.()
      emit("signal", { reason, requestedWindowMs, signalMs: signalAt, effectiveNativeStopMs: null })
    } catch {
      setContextJscPulse(undefined)
      try { resolveSignal?.() } catch { /* Observer cleanup cannot replace the product outcome. */ }
      failure("signal")
    }
  }
  function emitRows(phase: string, columns: string[], rows: unknown[]) {
    let exported = 0
    for (let start = 0; start < rows.length; start += 5) {
      const part = rows.slice(start, start + 5)
      if (emit(phase, { part: start / 5 + 1, parts: Math.ceil(rows.length / 5), columns, rows: part })) exported += part.length
    }
    return exported
  }
  function summarize(value: unknown) {
    const deliveredAt = elapsed()
    emit("delivered", { requestedWindowMs, callbackStartMs: callbackAt ?? null, signalMs: signalAt ?? null, profileDeliveredMs: deliveredAt,
      signalToDeliveryMs: signalAt === undefined ? null : deliveredAt - signalAt,
      effectiveNativeStopMs: null, nativeReportStartMs: null })
    if (!record(value) || !record(value.stackTraces) || !array(value.stackTraces.traces) || !array(value.stackTraces.sources)) {
      failure("profile-shape")
      return
    }
    const stack = value.stackTraces, traces = value.stackTraces.traces, sources = value.stackTraces.sources
    const sourcePaths = new Map<number, Location>()
    let sourceMalformed = 0, sourceUnknown = 0, sourceAmbiguous = 0
    const sourceLimit = Math.min(sources.length, maximumSources)
    for (let index = 0; index < sourceLimit; index++) {
      const item = sources[index]
      if (!record(item)) { sourceMalformed++; continue }
      const id = identifier(item.sourceID)
      if (id === null) { sourceMalformed++; continue }
      const found = location(item.sourceURL !== undefined ? item.sourceURL : item.url)
      if (sourcePaths.has(id)) { sourceAmbiguous++; sourcePaths.set(id, { path: null, mapping: "unknown" }); continue }
      if (found.mapping === "unknown") sourceUnknown++
      sourcePaths.set(id, found)
    }
    const self = new Map<string, SelfCount>(), inclusive = new Map<string, InclusiveCount>()
    const critical = new Map<string, CriticalPath>(), categoryCounts = new Map<string, number>()
    const nativeNearest = new Map<string, NativeNearest>()
    let malformed = 0, empty = 0, parsed = 0, malformedFrames = 0, frameTruncated = 0
    let selfUnknown = 0, selfOverflow = 0, inclusiveOverflow = 0, pathOverflow = 0, pathTruncated = 0, pathUnknown = 0
    let nativeLeafSamples = 0, nativeNearestUnknown = 0, nativeNearestOverflow = 0
    let timestampCount = 0, minimumTime: number | undefined, maximumTime: number | undefined
    const traceLimit = Math.min(traces.length, maximumTraces)
    for (let index = 0; index < traceLimit; index++) {
      const trace = traces[index]
      if (!record(trace) || !array(trace.frames)) { malformed++; continue }
      if (!trace.frames.length) { empty++; continue }
      parsed++
      if (typeof trace.timestamp === "number" && Number.isFinite(trace.timestamp)) {
        timestampCount++
        minimumTime = minimumTime === undefined ? trace.timestamp : Math.min(minimumTime, trace.timestamp)
        maximumTime = maximumTime === undefined ? trace.timestamp : Math.max(maximumTime, trace.timestamp)
      }
      const leaf = frame(trace.frames[0], sourcePaths)
      if (!leaf) { malformedFrames++; continue }
      categoryCounts.set(leaf.category, (categoryCounts.get(leaf.category) ?? 0) + 1)
      if (leaf.mapping === "unknown" || leaf.name === "unknown") selfUnknown++
      const key = selfKey(leaf), prior = self.get(key)
      if (prior) prior.samples++
      else if (self.size < maximumSites) self.set(key, { ...leaf, samples: 1 })
      else selfOverflow++
      if (trace.frames.length > maximumFrames) frameTruncated++
      const seen = new Set<string>(), criticalFrames: Site[] = []
      let pathDepth = 0, nearestSite: Site | undefined
      for (let depth = 0; depth < Math.min(trace.frames.length, maximumFrames); depth++) {
        const current = frame(trace.frames[depth], sourcePaths)
        if (!current) { malformedFrames++; continue }
        if (current.mapping !== "repository" || current.path === null) continue
        const site = { path: current.path, line: current.line, column: current.column, name: current.name }
        nearestSite ??= site
        const identity = siteKey(site)
        if (seen.has(identity)) continue
        seen.add(identity)
        const priorSite = inclusive.get(identity)
        if (priorSite) priorSite.samples++
        else if (inclusive.size < maximumSites) inclusive.set(identity, { ...site, samples: 1 })
        else inclusiveOverflow++
        pathDepth++
        if (criticalFrames.length < maximumPathDepth) criticalFrames.push(site)
      }
      const nativeLeaf = leaf.mapping === "builtin" || leaf.category === "C/C++" || leaf.category === "Host" ||
        leaf.category === "js builtin" || (leaf.mapping !== "repository" && nativeNames.has(leaf.name))
      if (nativeLeaf) {
        nativeLeafSamples++
        if (!nearestSite) nativeNearestUnknown++
        else {
          // This aggregation is independent of the full-path retention/overflow cap.
          const nearestKey = key + siteKey(nearestSite), priorNearest = nativeNearest.get(nearestKey)
          if (priorNearest) priorNearest.samples++
          else if (nativeNearest.size < maximumSites) nativeNearest.set(nearestKey, { leaf, site: nearestSite, samples: 1 })
          else nativeNearestOverflow++
        }
      }
      if (pathDepth > maximumPathDepth) pathTruncated++
      if (!criticalFrames.length) { pathUnknown++; continue }
      const pathKey = key + JSON.stringify(criticalFrames), priorPath = critical.get(pathKey)
      if (priorPath) priorPath.samples++
      else if (critical.size < maximumCriticalPaths) critical.set(pathKey, { leaf, frames: criticalFrames, samples: 1 })
      else pathOverflow++
    }
    emit("samples", {
      intervalRequestedUs: intervalUs,
      intervalObservedUs: typeof stack.interval === "number" && Number.isFinite(stack.interval) ? Math.round(stack.interval * 1_000_000) : null,
      actualTraces: traces.length, inspectedTraces: traceLimit, parsedNonemptyTraces: parsed, malformedTraces: malformed,
      emptyTraces: empty, traceTruncated: traces.length - traceLimit, actualSources: sources.length,
      sourceTruncated: sources.length - sourceLimit, sourceMalformed, sourceUnknown, sourceAmbiguous,
      malformedFrames, frameTruncatedSamples: frameTruncated, selfUnknownSamples: selfUnknown, selfOverflowSamples: selfOverflow,
      inclusiveOverflowAttributions: inclusiveOverflow, criticalPathOverflowSamples: pathOverflow,
      nativeLeafSamples, nativeNearestUnknownSamples: nativeNearestUnknown, nativeNearestOverflowSamples: nativeNearestOverflow,
      criticalPathTruncatedSamples: pathTruncated, criticalPathUnknownSamples: pathUnknown, timestampCount,
      sampleTimestampSpanMs: minimumTime === undefined || maximumTime === undefined ? null : Math.round((maximumTime - minimumTime) * 1000),
      categoryCounts: [...categoryCounts], noSamples: parsed === 0,
      countBasis: "observed-stack-samples; not CPU or wall-time fractions",
    })
    const orderedSelf = [...self.values()].sort((left, right) => right.samples - left.samples)
    const orderedInclusive = [...inclusive.values()].sort((left, right) => right.samples - left.samples)
    const orderedCritical = [...critical.values()].sort((left, right) => right.samples - left.samples)
    const orderedNearest = [...nativeNearest.values()].sort((left, right) => right.samples - left.samples)
    const exportedSelfSites = emitRows("self", ["sourceId", "path", "line", "column", "name", "category", "mapping", "samples"],
      orderedSelf.slice(0, 60).map((item) => [item.sourceId, item.path, item.line, item.column, item.name, item.category, item.mapping, item.samples]))
    const exportedInclusiveSites = emitRows("inclusive", ["path", "line", "column", "name", "samples"],
      orderedInclusive.slice(0, 60).map((item) => [item.path, item.line, item.column, item.name, item.samples]))
    const exportedNativeNearestSites = emitRows("native-nearest",
      ["leafSourceId", "leafPath", "leafLine", "leafColumn", "leafName", "leafCategory", "leafMapping",
        "nearestRepositoryPath", "nearestLine", "nearestColumn", "nearestName", "samples"],
      orderedNearest.slice(0, 60).map((item) => [item.leaf.sourceId, item.leaf.path, item.leaf.line, item.leaf.column,
        item.leaf.name, item.leaf.category, item.leaf.mapping, item.site.path, item.site.line, item.site.column, item.site.name, item.samples]))
    let exportedCriticalPaths = 0
    for (const [index, item] of orderedCritical.slice(0, 20).entries()) {
      if (emit("critical", { rank: index + 1, samples: item.samples, frameOrder: "innermost repository site first; repeated sites collapsed",
        leaf: [item.leaf.path, item.leaf.line, item.leaf.column, item.leaf.name, item.leaf.category, item.leaf.mapping],
        frameColumns: ["path", "line", "column", "name"],
        frames: item.frames.map((site) => [site.path, site.line, site.column, site.name]) })) exportedCriticalPaths++
    }
    emit("complete", { summaryStartedMs: deliveredAt, summaryFinishedMs: elapsed(),
      retainedSelfSites: self.size, retainedInclusiveSites: inclusive.size, retainedCriticalPaths: critical.size,
      retainedNativeNearestSites: nativeNearest.size, exportedSelfSites, exportedInclusiveSites,
      exportedNativeNearestSites, exportedCriticalPaths,
      attemptedSelfSites: Math.min(self.size, 60), attemptedInclusiveSites: Math.min(inclusive.size, 60),
      attemptedNativeNearestSites: Math.min(nativeNearest.size, 60), attemptedCriticalPaths: Math.min(critical.size, 20),
      selfSamplesBeyondTop60: orderedSelf.slice(60).reduce((sum, item) => sum + item.samples, 0),
      inclusiveAttributionsBeyondTop60: orderedInclusive.slice(60).reduce((sum, item) => sum + item.samples, 0),
      nativeNearestSamplesBeyondTop60: orderedNearest.slice(60).reduce((sum, item) => sum + item.samples, 0),
      criticalSamplesBeyondTop20: orderedCritical.slice(20).reduce((sum, item) => sum + item.samples, 0),
      outputErrors, dropped, complete: true })
  }
  try {
    const completion = new Promise<void>((resolve) => { resolveSignal = resolve })
    const pending = profile(() => {
      callbackAt = elapsed()
      emit("start", { boundary: "first public ctx.context operational phase through original context settled; original calls/deadlines unchanged", scope: "whole-isolate",
        firstPublicContextMayNotBeUi56: true, concurrentIsolateTasksIncluded: true, initialAdmissionOutsideProfile: true,
        callbackStartMs: callbackAt, intervalRequestedUs: intervalUs, requestedWindowMs,
        stopTriggers: ["45s timer", "every 1024 active digest calls after 45s", "original context settled"],
        pulseEveryDigestCalls: 1024, inactivePulseReadsClock: false, diagnosticWindowChangesDomainDeadline: false,
        runtime: { version: Bun.version, revision: Bun.revision },
        normalRuntimeExact: Bun.version === "1.3.14" && Bun.revision === "0d9b296af33f2b851fcbf4df3e9ec89751734ba4",
        releaseRuntimeExact: Bun.version === "1.4.1" && Bun.revision === "4661e494f052c83c80dade1318e5710238340be6",
        maxTraces: maximumTraces, maxSources: maximumSources, maxFrames: maximumFrames, maxSitesPerView: maximumSites,
        maxCriticalPaths: maximumCriticalPaths, maxCriticalDepth: maximumPathDepth, maxNativeNearestSites: maximumSites,
        topSelf: 60, topInclusive: 60, topNativeNearest: 60, topCritical: 20, rowsPerLine: 5,
        maxLines: maximumLines, maxLineBytes: maximumLineBytes,
        nativeReportAllocationBounded: false, effectiveNativeStopMs: null, profilerPromiseGatesDomain: false,
        clock: "relative-performance-ms", sampleClock: "separate-monotonic-clock",
        selfAttribution: "innermost sampled frame", inclusiveAttribution: "each distinct repository site once per sample",
        nativeNearestAttribution: "native leaf to first repository frame within 128 frames; independent of critical map",
        nativeLeafDefinition: "builtin mapping, C/C++, Host, js builtin, or allowlisted non-repository native name",
        sourceMappingLimit: "no inferred source maps; bundle names retained but paths remain unknown",
        lineBasis: "JSC-reported-no-offset", sampleFractionsAreNotCpuOrWallFractions: true })
      return completion
    }, intervalUs)
    void pending.then((value: unknown) => { try { summarize(value) } catch { failure("summary") } },
      () => { stop("profile-failed"); failure("profile") })
    setContextJscPulse(() => {
      try { if (elapsed() >= requestedWindowMs) stop("diagnostic-window-pulse") }
      catch { stop("setup-failed") }
    })
    timer = setTimeout(() => { stop("diagnostic-window-timer") }, Math.max(0, requestedWindowMs - elapsed()))
    return { finish() { stop("original-context-settled") } }
  } catch {
    stop("setup-failed")
    failure("setup")
    return undefined
  }
}
