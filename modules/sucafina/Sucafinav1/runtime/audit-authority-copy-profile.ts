// CI-only numeric observations. This module never receives a snapshot or Request.
type RootKind = 1 | 2 | 3
type SurfaceCode = 0 | 1 | 2 | 3
type Origin = Readonly<{ kind: 0 | RootKind; target: SurfaceCode }>
type CopyCaller = 1 | 2
type CopyMethod = 1 | 2 | 3
const origins = new WeakMap<object, Origin>()
const unknownOrigin: Origin = { kind: 0, target: 0 }
const roots = new Float64Array(16)
const copies = new Float64Array(384)
const timedCopies = new Float64Array(384)
const copyMilliseconds = new Float64Array(384)
const authority = new Float64Array(32)
const diagnostics = { starts: 0, ends: 0, failures: 0, flushed: false }

// Strict equality never coerces an unexpected argument or inspects its fields.
function surfaceCode(surface: unknown): SurfaceCode {
  return surface === "dashboard" ? 1 : surface === "planner" ? 2 : surface === "procurement" ? 3 : 0
}

export function profileAuthorityRoot(root: object, kind: RootKind, surface?: unknown): void {
  try {
    const target = surfaceCode(surface)
    origins.set(root, { kind, target })
    const index = kind * 4 + target
    roots[index] = (roots[index] ?? 0) + 1
  } catch { diagnostics.failures++ }
}

export function profileAuthorityCopyStart(): number | undefined {
  try {
    diagnostics.starts++
    const started = performance.now()
    if (Number.isFinite(started)) return started
    diagnostics.failures++
  } catch { diagnostics.failures++ }
}

export function profileAuthorityCopyEnd(started: number | undefined, root: object,
  caller: CopyCaller, surface: unknown, method: CopyMethod): void {
  let elapsed: number | undefined
  try {
    if (started !== undefined) {
      diagnostics.ends++
      const duration = performance.now() - started
      if (Number.isFinite(duration) && duration >= 0) elapsed = duration
      else diagnostics.failures++
    }
  } catch { diagnostics.failures++ }
  try {
    const origin = origins.get(root) ?? unknownOrigin
    const index = (((caller - 1) * 4 + origin.kind) * 4 + origin.target) * 12 + surfaceCode(surface) * 3 + method - 1
    copies[index] = (copies[index] ?? 0) + 1
    if (elapsed !== undefined) {
      timedCopies[index] = (timedCopies[index] ?? 0) + 1
      copyMilliseconds[index] = (copyMilliseconds[index] ?? 0) + elapsed
    }
  } catch { diagnostics.failures++ }
}

export function profileAuthorityProjection(root: object, event: 1 | 2): void {
  try {
    const origin = origins.get(root) ?? unknownOrigin
    const index = (event - 1) * 16 + origin.kind * 4 + origin.target
    authority[index] = (authority[index] ?? 0) + 1
  } catch { diagnostics.failures++ }
}

/** One aggregate after the original test's cleanup; no timer, retry or per-call log. */
export function flushAuthorityCopyProfile(): void {
  if (diagnostics.flushed) return
  diagnostics.flushed = true
  try {
    const rootRows: number[][] = [], copyRows: number[][] = [], authorityRows: number[][] = []
    for (let index = 0; index < roots.length; index++) {
      const count = roots[index] ?? 0
      if (count) rootRows.push([Math.floor(index / 4), index % 4, count])
    }
    for (let index = 0; index < copies.length; index++) {
      const count = copies[index] ?? 0
      if (!count) continue
      const method = index % 3 + 1
      const surface = Math.floor(index / 3) % 4
      const target = Math.floor(index / 12) % 4
      const kind = Math.floor(index / 48) % 4
      const caller = Math.floor(index / 192) + 1
      copyRows.push([caller, kind, target, surface, method, count, timedCopies[index] ?? 0,
        Number((copyMilliseconds[index] ?? 0).toFixed(3))])
    }
    for (let index = 0; index < authority.length; index++) {
      const count = authority[index] ?? 0
      if (count) authorityRows.push([Math.floor(index / 16) + 1, Math.floor(index / 4) % 4, index % 4, count])
    }
    console.info("SF_AUTHORITY_COPY_PROFILE", JSON.stringify({ schemaVersion: 1,
      roots: rootRows, copies: copyRows, authority: authorityRows,
      clock: [diagnostics.starts, diagnostics.ends, diagnostics.failures] }))
  } catch { diagnostics.failures++ }
}
