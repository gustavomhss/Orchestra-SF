import { expect, test } from "bun:test"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { withSfScopedSourceChecks } from "../../../product/integration/source-lifecycle.ts"
import { createDashboardSourceIssuer } from "../../../product/integration/dashboard-sources.ts"
import { prepare, prepareLease, sourceRevalidationFixture, withReview } from "./source-revalidation-fixture.ts"

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => { resolve = done })
  return { promise, resolve: () => resolve() }
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
        source.type === "dashboard-page" && source.id === "Budget Overview" && source.fields?.includes("budgetMetrics"))
      if (!page?.fields) throw new Error("Actual preserved Dashboard page source unavailable")
      const issue = createDashboardSourceIssuer({ host: value.fixture.authority.host, scopedSources: value.fixture.persistence })
      // Budget metrics require complete years. The real fixture materialized
      // 2026; these other supported annual scopes have not been issued yet.
      const selection = { page: page.id, fields: page.fields, period: { start: "2025-01-01", end: "2025-12-31" } }
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
      const unmaterialized = { ...selection, period: { start: "2024-01-01", end: "2024-12-31" } }
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
      // The refused cold scope is valid and can be created outside readonly C08.
      expect((await issue(unmaterialized, value.call)).status).toBe("ok")
      expect(await value.snapshots()).not.toBe(warm)
    })
  }, 120_000)
}
