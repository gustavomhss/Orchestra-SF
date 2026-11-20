import { expect, test } from "bun:test"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { DomainProjection, PreservedReview } from "../../../product/contracts/context.ts"
import type { ThreadSourceContext } from "../../../product/collaboration/thread-context.ts"
import type { ReviewAgendaCatalog } from "../../../product/reviews/agenda-picker.ts"
import type { ReviewAgendaPreview } from "../../../product/reviews/selection.ts"
import { reviewProjectionEvidence } from "../../../product/reviews/port.ts"
import { withSfScopedSourceChecks } from "../../../product/integration/source-lifecycle.ts"
import { createDashboardSourceIssuer } from "../../../product/integration/dashboard-sources.ts"
import { object } from "../../../runtime/contract.ts"
import { createSfExtendedBusinessServices } from "../../../../../../apps/cli/src/sucafina-product/extended-business-services.ts"
import { createSfMemoryServices } from "../../../../../../apps/cli/src/sucafina-product/memory-services.ts"
import { createSfReviewCollaboration } from "../../../../../../apps/cli/src/sucafina-product/review-collaboration.ts"
import { createSfResidentReviewReaders, sfResidentReviewSnapshotReaders } from "../../../../../../apps/cli/src/sucafina-product/review-resident-readers.ts"
import { createSfReviewServices } from "../../../../../../apps/cli/src/sucafina-product/review-services.ts"
import { createSfReviewAgendaServices } from "../../../../../../apps/cli/src/sucafina-product/review-agenda-services.ts"
import { sourceRevalidationFixture } from "./source-revalidation-fixture.ts"

type Fixture = Awaited<ReturnType<typeof sourceRevalidationFixture>>
type Options = Parameters<typeof sourceRevalidationFixture>[0]
type Prepared = Awaited<ReturnType<typeof prepare>>
const period = { start: "2026-01-01", end: "2026-12-31" }

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => { resolve = done })
  return { promise, resolve: () => resolve() }
}

async function prepare(fixture: Fixture, afterCompose?: () => void) {
  const resident = createSfResidentReviewReaders({ authority: fixture.authority, business: fixture.business })
  const extended = createSfExtendedBusinessServices({ authority: fixture.authority, business: fixture.business,
    persistence: fixture.persistence, ...fixture.guards, origin: "https://example.test", reviewReaders: resident.readers })
  const memory = createSfMemoryServices({ authority: fixture.authority,
    business: { ...fixture.business, planner: extended.portfolioServices.planner }, signalRegistryWrites: new WeakSet<object>() })
  resident.bindOutcome(memory.reviewOutcome)
  try {
    afterCompose?.()
    const result = async (response: Response | undefined) => {
      if (!response) throw new Error("Actual Review route unavailable")
      expect(response.status).toBe(200)
      const body = object(await response.json())
      expect(body.status).toBe("ok")
      return body.value
    }
    const post = (mode: string, payload: unknown) => extended.productHttp(new Request("https://example.test/dashboard?sf=" + mode, {
      method: "POST", headers: { origin: "https://example.test", "content-type": "application/json" }, body: JSON.stringify(payload),
    }), "dashboard")
    const query = new URLSearchParams({ sf: "review-agenda", domain: "dashboard", start: period.start,
      end: period.end, dashboardTopics: JSON.stringify(["budget"]) })
    const catalog = await result(await extended.productHttp(new Request("https://example.test/dashboard?" + query), "dashboard")) as ReviewAgendaCatalog
    expect(catalog.options).toHaveLength(1)
    const preview = await result(await post("review-agenda", { items: catalog.options.map((option) => option.item) })) as ReviewAgendaPreview
    const saved = await result(await post("review-preserve", { selectionRef: preview.selectionRef, sectionRefs: preview.sectionRefs })) as PreservedReview
    const application = extended.reviews
    if (!application?.readScope) throw new Error("Actual Review scope unavailable")
    const scope = application.readScope
    const call = await fixture.read()
    const request = fixture.authority.host.requestFor(call)
    if (!request) throw new Error("Actual authenticated Request unavailable")
    const section = saved.sections[0]
    if (!section) throw new Error("Actual preserved Budget section unavailable")
    const source = reviewProjectionEvidence(section.content as DomainProjection).find((ref) => ref.kind === "record" &&
      ref.target.period && ref.target.period.start <= section.period.start && ref.target.period.end >= section.period.end)
    if (!source || source.kind !== "record") throw new Error("Actual preserved C17 basis unavailable")
    const basis: ThreadSourceContext = { sourceRef: source.refId, sourceIncarnation: source.target.incarnation,
      observedVersion: source.target.version, period: section.period, evidenceRefs: [source] }
    const collaboration = createSfReviewCollaboration({ authority: fixture.authority, application, evidence: fixture.business.context,
      readerCurrent: sfResidentReviewSnapshotReaders(resident.readers, fixture.authority.host) })
    const snapshots = () => fixture.persistence.transactionAll!(async (current) => ({ commit: false, value: digestSfValue(current) }))
    return { fixture, application, scope, call, request, saved, basis, section, collaboration, resident, extended, snapshots,
      dispose: () => { fixture.authority.ui.finish(call); extended.dispose() } }
  } catch (error) { extended.dispose(); throw error }
}

async function withReview(options: Options, before: ((fixture: Fixture) => void) | undefined, work: (prepared: Prepared) => Promise<void>) {
  const fixture = await sourceRevalidationFixture(options)
  try {
    before?.(fixture)
    const prepared = await prepare(fixture)
    try { await work(prepared) } finally { prepared.dispose() }
  } finally { await fixture.dispose() }
}

async function prepareLease(value: Prepared) {
  const pin = await value.application.threadContext.prepare({ reviewRef: value.saved.id, sectionId: value.section.id }, value.basis, value.call)
  expect(pin.status).toBe("ok")
  if (pin.status !== "ok") throw new Error(pin.reason)
  expect(await value.collaboration.authorizeReviewThreadContext(pin.value, value.basis, value.call)).toBe(true)
  const checked = await value.fixture.persistence.transactionAll!(async () => ({ commit: false,
    value: await value.collaboration.authorizeReviewThreadContext(pin.value, value.basis, value.call) }))
  expect(checked).toBe(true)
  return pin.value
}

// Every variant uses one source port for host, business, Review and Memory.
// The projector's body stays the real product projector; only its availability
// changes. Opaque configuration must retain the same real callback semantics.
for (const shape of ["own", "config-proxy", "config-accessor", "config-prototype", "driver-prototype"] as const) {
  test(`shared ${shape} source projector is reobserved by scoped Review and the final C05 fence`, async () => {
    const projected = { available: true, calls: 0, refused: 0 }
    await withReview({ sources: (input) => {
      const real = input.projectScope
      if (!real) throw new Error("Actual source projector missing")
      const projectScope: NonNullable<typeof real> = (...args) => {
        projected.calls++
        if (!projected.available) { projected.refused++; return undefined }
        return real(...args)
      }
      const configured = { ...input, projectScope }
      if (shape === "config-proxy") return new Proxy(configured, {})
      if (shape === "config-accessor") {
        Object.defineProperty(configured, "projectScope", { configurable: true, enumerable: true, get: () => projectScope })
        return configured
      }
      if (shape === "config-prototype") return Object.assign(Object.create({ sourceConfiguration: true }), configured)
      if (shape === "driver-prototype") return { ...configured, persistence: Object.create(input.persistence) }
      return configured
    } }, undefined, async (value) => {
      expect(value.fixture.authority.host.persistence).toBe(value.fixture.persistence)
      expect(value.fixture.business.host.persistence).toBe(value.fixture.persistence)
      let failure: Awaited<ReturnType<typeof value.application.reviews.read>> | undefined
      await value.scope.run(value.request, async () => {
        expect(await value.application.reviews.read(value.saved.id, value.call)).toEqual({ status: "ok", value: value.saved })
        const pin = await prepareLease(value)
        const before = await value.snapshots()
        const calls = projected.calls
        expect(await value.application.reviews.read(value.saved.id, value.call)).toEqual({ status: "ok", value: value.saved })
        expect(projected.calls).toBeGreaterThan(calls)
        projected.available = false
        const beforeRefusal = projected.refused
        // The prepared lease is challenged first, while its prior read proof
        // still exists; a preceding failed body read cannot explain this refusal.
        const final = await value.fixture.persistence.transactionAll!(async () => ({ commit: false,
          value: await value.collaboration.authorizeReviewThreadContext(pin, value.basis, value.call) }))
        expect(final).toBe(false)
        expect(projected.refused).toBeGreaterThan(beforeRefusal)
        failure = await value.application.reviews.read(value.saved.id, value.call)
        expect(failure).toEqual({ status: "unavailable", reason: "review-read-unavailable" })
        expect(await value.snapshots()).toBe(before)
      })
      const calls = projected.calls
      const control = await value.scope.run(value.request, () => value.application.reviews.read(value.saved.id, value.call))
      expect(control).toEqual(failure)
      expect(projected.calls).toBeGreaterThan(calls)
    })
  }, 120_000)
}

test("an unchanged custom evidence resolver can revoke both reused bodies and a prepared C05 lease", async () => {
  const evidence = { allowed: true, calls: 0 }
  await withReview({}, (fixture) => {
    const resolve = fixture.business.context.resolve
    fixture.business.context.resolve = async (ref, call) => {
      const result = await resolve(ref, call)
      evidence.calls++
      return evidence.allowed ? result : { ...result, state: "revoked" as const }
    }
  }, async (value) => {
    await value.scope.run(value.request, async () => {
      expect(await value.application.reviews.read(value.saved.id, value.call)).toEqual({ status: "ok", value: value.saved })
      const pin = await prepareLease(value)
      const before = await value.snapshots(), calls = evidence.calls
      evidence.allowed = false
      const final = await value.fixture.persistence.transactionAll!(async () => ({ commit: false,
        value: await value.collaboration.authorizeReviewThreadContext(pin, value.basis, value.call) }))
      expect(final).toBe(false)
      expect(evidence.calls).toBeGreaterThan(calls)
      const result = await value.application.reviews.read(value.saved.id, value.call)
      expect(result).toEqual({ status: "denied", reason: "access-unavailable" })
      expect(await value.snapshots()).toBe(before)
    })
  })
}, 120_000)

test("a projector replacement during its real authorization await cannot escape the admitted source check", async () => {
  const hooks: { projected?: () => void; authenticate?: () => Promise<void> } = {}
  await withReview({ beforeAuthenticate: async () => { await hooks.authenticate?.() }, sources: (input) => {
    const real = input.projectScope
    if (!real) throw new Error("Actual source projector missing")
    return { ...input, projectScope: (...args) => { const result = real(...args); hooks.projected?.(); return result } }
  } }, undefined, async (value) => {
    await value.scope.run(value.request, async () => {
      expect(await value.application.reviews.read(value.saved.id, value.call)).toEqual({ status: "ok", value: value.saved })
      const before = await value.snapshots(), original = value.fixture.sourceInput.projectScope
      let swaps = 0
      hooks.projected = () => {
        hooks.projected = undefined
        hooks.authenticate = async () => {
          hooks.authenticate = undefined
          value.fixture.sourceInput.projectScope = (...args) => original!(...args)
          swaps++
          await Promise.resolve()
        }
      }
      const result = await value.application.reviews.read(value.saved.id, value.call)
      expect(swaps).toBe(1)
      expect(result.status).toBe("unavailable")
      expect(result).not.toHaveProperty("value")
      expect(await value.snapshots()).toBe(before)
      value.fixture.sourceInput.projectScope = original
    })
  })
}, 120_000)

for (const owner of ["persistence", "evidence", "agenda", "authority-state", "state-read", "atlas-provider", "atlas-resolve"] as const) {
  test(`a ${owner} owner/method swap during await refuses reuse and preserves the next actual read`, async () => {
    const hooks: { environment?: () => void } = {}
    await withReview({ beforeEnvironment: async () => { hooks.environment?.() } }, undefined, async (value) => {
      const agenda = createSfReviewAgendaServices({ authority: value.fixture.authority, business: value.fixture.business,
        persistence: value.fixture.persistence })
      const input: Parameters<typeof createSfReviewServices>[0] = { authority: value.fixture.authority, business: value.fixture.business,
        portfolio: value.extended.portfolioServices, bi: value.extended.bi, persistence: value.fixture.persistence,
        origin: "https://example.test", readers: value.resident.readers, agenda }
      const service = createSfReviewServices(input).application
      if (!service?.readScope) throw new Error("Actual alternate Review composition unavailable")
      const scope = service.readScope
      await scope.run(value.request, async () => {
        expect(await service.reviews.read(value.saved.id, value.call)).toEqual({ status: "ok", value: value.saved })
        const state = value.fixture.authority.state, readState = state.read
        const provider = value.fixture.business.evidence.current
        if (!provider) throw new Error("Actual Atlas provider unavailable")
        const resolveProvider = provider.resolve
        let swaps = 0, delegated = 0
        hooks.environment = () => {
          hooks.environment = undefined
          swaps++
          if (owner === "persistence") input.persistence = { ...value.fixture.persistence }
          if (owner === "authority-state") value.fixture.authority.state = { ...state,
            read: (request, namespace, read) => { delegated++; return readState(request, namespace, read) } }
          if (owner === "state-read") state.read = (request, namespace, read) => { delegated++; return readState(request, namespace, read) }
          if (owner === "atlas-provider") value.fixture.business.evidence.current = { ...provider,
            resolve: (...args) => { delegated++; return resolveProvider(...args) } }
          if (owner === "atlas-resolve") provider.resolve = (...args) => { delegated++; return resolveProvider(...args) }
          if (owner === "agenda") input.agenda = { ...agenda, resolveEvidence: (...args) => { delegated++; return agenda.resolveEvidence(...args) } }
          if (owner === "evidence") {
            const resolve = value.fixture.business.context.resolve
            value.fixture.business.context.resolve = (...args) => { delegated++; return resolve(...args) }
          }
        }
        const interrupted = await service.reviews.read(value.saved.id, value.call)
        expect(swaps).toBe(1)
        expect(interrupted.status).toBe("denied")
        expect(interrupted).not.toHaveProperty("value")
        expect(await service.reviews.read(value.saved.id, value.call)).toEqual({ status: "ok", value: value.saved })
        if (owner !== "persistence") expect(delegated).toBeGreaterThan(0)
      })
    })
  }, 120_000)
}

test("a shared projector revocation during the final C05 authorization await is observed", async () => {
  const hooks: { projected?: () => void; authenticate?: () => Promise<void> } = {}
  const projected = { available: true, refused: 0 }
  await withReview({ beforeAuthenticate: async () => { await hooks.authenticate?.() }, sources: (input) => {
    const real = input.projectScope
    if (!real) throw new Error("Actual source projector missing")
    return { ...input, projectScope: (...args) => {
      if (!projected.available) { projected.refused++; return undefined }
      const result = real(...args); hooks.projected?.(); return result
    } }
  } }, undefined, async (value) => {
    await value.scope.run(value.request, async () => {
      const pin = await prepareLease(value)
      const before = await value.snapshots(), method = value.fixture.sourceInput.projectScope
      let revocations = 0
      hooks.projected = () => {
        hooks.projected = undefined
        hooks.authenticate = async () => {
          hooks.authenticate = undefined
          projected.available = false; revocations++
          await Promise.resolve()
        }
      }
      const final = await value.fixture.persistence.transactionAll!(async () => ({ commit: false,
        value: await value.collaboration.authorizeReviewThreadContext(pin, value.basis, value.call) }))
      expect(final).toBe(false)
      expect(revocations).toBe(1)
      expect(projected.refused).toBeGreaterThan(0)
      expect(value.fixture.sourceInput.projectScope).toBe(method)
      expect(await value.snapshots()).toBe(before)
    })
  })
}, 120_000)

for (const replacement of ["projector", "evidence", "authority-state", "state-read", "atlas-provider", "atlas-resolve"] as const) {
  test(`C05 structural egress rejects a synchronous ${replacement} replacement after the real async fence`, async () => {
    await withReview({}, undefined, async (value) => {
      await value.scope.run(value.request, async () => {
        const pin = await prepareLease(value)
        const basis = { ...value.basis, reviewContext: pin }
        expect(await value.collaboration.reviewRecipientAuthority.authorize(value.call.binding.principalRef, basis, value.call)).toBe(true)
        const before = await value.snapshots()
        const result = await value.fixture.persistence.transactionAll!(async () => {
          expect(await value.collaboration.authorizeReviewThreadContext(pin, value.basis, value.call)).toBe(true)
          const originalProjector = value.fixture.sourceInput.projectScope
          const originalResolve = value.fixture.business.context.resolve
          const state = value.fixture.authority.state, readState = state.read
          const provider = value.fixture.business.evidence.current
          if (!provider) throw new Error("Actual Atlas provider unavailable")
          const resolveProvider = provider.resolve
          if (replacement === "projector") value.fixture.sourceInput.projectScope = (...args) => originalProjector!(...args)
          if (replacement === "evidence") value.fixture.business.context.resolve = (...args) => originalResolve(...args)
          if (replacement === "authority-state") value.fixture.authority.state = { ...state, read: (request, namespace, read) => readState(request, namespace, read) }
          if (replacement === "state-read") state.read = (request, namespace, read) => readState(request, namespace, read)
          if (replacement === "atlas-provider") value.fixture.business.evidence.current = { ...provider, resolve: (...args) => resolveProvider(...args) }
          if (replacement === "atlas-resolve") provider.resolve = (...args) => resolveProvider(...args)
          try {
            return { commit: false, value: value.collaboration.reviewRecipientAuthority.checkAtCommit(value.call.binding.principalRef, basis, value.call) }
          } finally {
            value.fixture.sourceInput.projectScope = originalProjector
            value.fixture.business.context.resolve = originalResolve
            value.fixture.authority.state = state
            state.read = readState
            value.fixture.business.evidence.current = provider
            provider.resolve = resolveProvider
          }
        })
        expect(result).toBe(false)
        expect(await value.snapshots()).toBe(before)
      })
    })
  }, 120_000)
}

test("the installed extended-before-Atlas order permits a real Review and final C05 read", async () => {
  const fixture = await sourceRevalidationFixture({ deferAtlasInitialization: true })
  try {
    expect(fixture.business.evidence.current).toBeUndefined()
    const value = await prepare(fixture, () => {
      expect(fixture.business.evidence.current).toBeUndefined()
      fixture.initializeAtlas()
      expect(fixture.business.evidence.current).toBeDefined()
    })
    try {
      await value.scope.run(value.request, async () => {
        expect(await value.application.reviews.read(value.saved.id, value.call)).toEqual({ status: "ok", value: value.saved })
        await prepareLease(value)
        expect(await value.application.reviews.read(value.saved.id, value.call)).toEqual({ status: "ok", value: value.saved })
      })
    } finally { value.dispose() }
  } finally { await fixture.dispose() }
}, 120_000)

test("a closed Review descendant cannot enter opaque fallback or open a replacement scope", async () => {
  await withReview({}, undefined, async (value) => {
    const release = deferred()
    let calls = 0
    let escaped!: Promise<{ read: Awaited<ReturnType<typeof value.application.reviews.read>>;
      revalidate: Awaited<ReturnType<typeof value.scope.revalidate>>; nested: string }>
    await value.scope.run(value.request, async () => {
      expect(await value.application.reviews.read(value.saved.id, value.call)).toEqual({ status: "ok", value: value.saved })
      escaped = (async () => {
        await release.promise
        const read = await value.application.reviews.read(value.saved.id, value.call)
        const revalidate = await value.scope.revalidate(value.saved.id, digestSfValue(value.saved), value.call)
        let nested = ""
        try { await value.scope.run(value.request, async () => { calls++; return undefined }) }
        catch (error) { nested = error instanceof Error ? error.message : String(error) }
        return { read, revalidate, nested }
      })()
    })
    const provider = value.fixture.business.evidence.current
    if (!provider) throw new Error("Actual Atlas provider unavailable")
    value.fixture.business.evidence.current = new Proxy({ ...provider,
      resolve: (...args: Parameters<typeof provider.resolve>) => { calls++; return provider.resolve(...args) } }, {})
    const before = await value.snapshots()
    release.resolve()
    const rejected = await escaped
    expect(rejected.read).toEqual({ status: "denied", reason: "review-integrity-unavailable" })
    expect(rejected.revalidate).toEqual(rejected.read)
    expect(rejected.nested).toBe("SF_REVIEW_READ_SCOPE_CLOSED")
    expect(calls).toBe(0)
    expect(await value.snapshots()).toBe(before)
    // A genuinely new scope reexecutes the now-opaque actual provider.
    expect(await value.scope.run(value.request, () => value.application.reviews.read(value.saved.id, value.call)))
      .toEqual({ status: "ok", value: value.saved })
    expect(calls).toBeGreaterThan(0)
  })
}, 120_000)

test("a Review scope that closes during a legacy authorization await refuses its result", async () => {
  const hooks: { authenticate?: () => Promise<void> } = {}
  await withReview({ beforeAuthenticate: async () => { await hooks.authenticate?.() } }, undefined, async (value) => {
    const provider = value.fixture.business.evidence.current
    if (!provider) throw new Error("Actual Atlas provider unavailable")
    let calls = 0
    value.fixture.business.evidence.current = new Proxy({ ...provider,
      resolve: (...args: Parameters<typeof provider.resolve>) => { calls++; return provider.resolve(...args) } }, {})
    const entered = deferred(), release = deferred()
    hooks.authenticate = async () => { hooks.authenticate = undefined; entered.resolve(); await release.promise }
    let pending!: ReturnType<typeof value.application.reviews.read>
    await value.scope.run(value.request, async () => {
      pending = value.application.reviews.read(value.saved.id, value.call)
      await entered.promise
    })
    release.resolve()
    expect(await pending).toEqual({ status: "denied", reason: "review-integrity-unavailable" })
    expect(calls).toBe(0)
    expect(await value.scope.run(value.request, () => value.application.reviews.read(value.saved.id, value.call)))
      .toEqual({ status: "ok", value: value.saved })
    expect(calls).toBeGreaterThan(0)
  })
}, 120_000)

test("an open Review scope cannot lend its Request to another authenticated call", async () => {
  await withReview({}, undefined, async (value) => {
    const other = await value.fixture.read()
    try {
      const before = await value.snapshots()
      await value.scope.run(value.request, async () => {
        expect(await value.application.reviews.read(value.saved.id, other))
          .toEqual({ status: "denied", reason: "review-integrity-unavailable" })
        expect(await value.scope.revalidate(value.saved.id, digestSfValue(value.saved), other))
          .toEqual({ status: "denied", reason: "review-integrity-unavailable" })
      })
      expect(await value.snapshots()).toBe(before)
    } finally { value.fixture.authority.ui.finish(other) }
  })
}, 120_000)

test("a closed source-check descendant cannot regain ordinary transaction materialization", async () => {
  await withReview({}, undefined, async (value) => {
    const release = deferred()
    let entered = 0
    let escaped!: Promise<string>
    const before = await value.snapshots()
    const observation = await withSfScopedSourceChecks({ owner: value.fixture.authority.host, request: value.request,
      current: () => value.fixture.authority.host.requestFor(value.call) === value.request }, async () => {
      await value.fixture.persistence.transaction("dashboard", async () => ({ commit: false, value: undefined }))
      escaped = (async () => {
        await release.promise
        await value.fixture.persistence.transaction("dashboard", async () => { entered++; return { commit: false, value: undefined } })
        return "unexpected"
      })().catch((error: unknown) => error instanceof Error ? error.message : String(error))
    })
    expect(observation.current()).toBe(true)
    release.resolve()
    expect(await escaped).toBe("SF_SOURCE_CHECK_SCOPE_CLOSED")
    expect(entered).toBe(0)
    expect(observation.current()).toBe(false)
    expect(await value.snapshots()).toBe(before)
    await value.fixture.persistence.transaction("dashboard", async () => { entered++; return { commit: false, value: undefined } })
    expect(entered).toBe(1)
  })
}, 120_000)

for (const mismatch of ["owner", "request"] as const) {
  test(`a caught source-check ${mismatch} mismatch remains sticky at outer egress`, async () => {
    await withReview({}, undefined, async (value) => {
      const before = await value.snapshots()
      let inner = "", entered = 0
      const binding = { owner: value.fixture.authority.host, request: value.request,
        current: () => value.fixture.authority.host.requestFor(value.call) === value.request }
      await expect(withSfScopedSourceChecks(binding, async () => {
        try {
          await withSfScopedSourceChecks({ ...binding,
            ...(mismatch === "owner" ? { owner: {} } : { request: new Request(value.request.url) }) },
          async () => { entered++; return undefined })
        } catch (error) { inner = error instanceof Error ? error.message : String(error) }
      })).rejects.toThrow("SF_SOURCE_CHECK_SCOPE_CLOSED")
      expect(inner).toBe("SF_SOURCE_CHECK_SCOPE_MISMATCH")
      expect(entered).toBe(0)
      expect(await value.snapshots()).toBe(before)
    })
  }, 120_000)
}

for (const shape of ["own", "opaque"] as const) {
  test(`source-check ${shape} admission preserves real scope creation and C08 write refusal`, async () => {
    await withReview({ sources: (input) => shape === "opaque" ? new Proxy(input, {}) : input }, undefined, async (value) => {
      const page = value.saved.sourceRefs.find((source) => source.surface === "dashboard" &&
        source.type === "dashboard-page" && source.fields?.length)
      if (!page?.fields) throw new Error("Actual preserved Dashboard page source unavailable")
      const issue = createDashboardSourceIssuer({ host: value.fixture.authority.host, scopedSources: value.fixture.persistence })
      const selection = { page: page.id, fields: page.fields, period: { start: "2026-01-01", end: "2026-01-31" } }
      const binding = { owner: value.fixture.authority.host, request: value.request,
        current: () => value.fixture.authority.host.requestFor(value.call) === value.request }
      const before = await value.snapshots()
      const checked = await withSfScopedSourceChecks(binding, () => issue(selection, value.call))
      if (shape === "own") {
        expect(checked.value).toEqual({ status: "denied", reason: "source-unavailable" })
        expect(await value.snapshots()).toBe(before)
      } else {
        // Opaque initial composition uses the unchanged real materializing path.
        expect(checked.value.status).toBe("ok")
        expect(await value.snapshots()).not.toBe(before)
      }
      const opened = await issue(selection, value.call)
      expect(opened.status).toBe("ok")
      const warm = await value.snapshots()
      expect((await withSfScopedSourceChecks(binding, () => issue(selection, value.call))).value).toEqual(opened)
      expect(await value.snapshots()).toBe(warm)
      const unmaterialized = { ...selection, period: { start: "2026-02-01", end: "2026-02-28" } }
      let entered = 0
      const final = value.fixture.authority.state.read(value.request, "reviews", async () => {
        entered++
        return (await withSfScopedSourceChecks(binding, () => issue(unmaterialized, value.call))).value
      })
      if (shape === "opaque") {
        // The legacy source attempted a write; the real local C08 root remains
        // poisoned even when the issuer catches the inner write refusal.
        await expect(final).rejects.toThrow("Nested local write attempted")
      } else {
        const checked = await final
        expect(checked.status).toBe("ok")
        if (checked.status !== "ok") throw new Error("Actual C08 read group unavailable")
        expect(checked.value).toEqual({ status: "denied", reason: "source-unavailable" })
      }
      expect(entered).toBe(1)
      expect(await value.snapshots()).toBe(warm)
    })
  }, 120_000)
}
