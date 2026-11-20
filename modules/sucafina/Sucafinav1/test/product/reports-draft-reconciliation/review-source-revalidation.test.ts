import { expect, test } from "bun:test"
import { createSfReviewServices } from "../../../../../../apps/cli/src/sucafina-product/review-services.ts"
import { createSfReviewAgendaServices } from "../../../../../../apps/cli/src/sucafina-product/review-agenda-services.ts"
import { prepareLease, withReview } from "./source-revalidation-fixture.ts"

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
      if (!failure) throw new Error("Actual shared-projector refusal was not observed")
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

for (const owner of ["persistence", "evidence", "agenda", "authority-state", "state-read", "atlas-provider", "atlas-resolve", "host-persistence", "host-snapshots", "host-authenticate", "host-environment", "host-request", "host-revalidate"] as const) {
  test(`a ${owner} owner/method swap during await refuses reuse and preserves the next actual read`, async () => {
    const hooks: { environment?: () => void } = {}
    let projections = 0
    await withReview({ beforeEnvironment: async () => { hooks.environment?.() }, sources: (input) => {
      const real = input.projectScope
      if (!real) throw new Error("Actual source projector missing")
      return { ...input, projectScope: (...args) => { projections++; return real(...args) } }
    } }, undefined, async (value) => {
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
        const host = value.fixture.authority.host, persistence = host.persistence
        const snapshots = persistence.currentSnapshots, authenticate = host.authenticate
        const environment = host.environment, requestFor = host.requestFor, revalidate = host.revalidate
        let swaps = 0, delegated = 0
        hooks.environment = () => {
          hooks.environment = undefined
          swaps++
          if (owner === "persistence") input.persistence = { ...value.fixture.persistence }
          if (owner === "host-persistence") host.persistence = { ...persistence,
            transaction: (surface, work, options) => { delegated++; return persistence.transaction(surface, work, options) } }
          if (owner === "host-snapshots") persistence.currentSnapshots = () => { delegated++; return snapshots?.() }
          if (owner === "host-authenticate") host.authenticate = (...args) => { delegated++; return authenticate(...args) }
          if (owner === "host-environment") host.environment = (...args) => { delegated++; return environment(...args) }
          if (owner === "host-request") host.requestFor = (...args) => { delegated++; return requestFor(...args) }
          if (owner === "host-revalidate") host.revalidate = (...args) => { delegated++; return revalidate(...args) }
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
        const beforeProducer = projections
        expect(await service.reviews.read(value.saved.id, value.call)).toEqual({ status: "ok", value: value.saved })
        expect(projections).toBeGreaterThan(beforeProducer)
        // The legacy reader may retain its original persistence owner; it must
        // still execute the real producer. Other replaced callbacks are observed.
        if (owner !== "host-persistence") {
          if (owner !== "persistence") expect(delegated).toBeGreaterThan(0)
        }
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

for (const replacement of ["projector", "evidence", "authority-state", "state-read", "atlas-provider", "atlas-resolve", "host-persistence", "host-snapshots", "host-authenticate", "host-environment", "host-request", "host-revalidate"] as const) {
  test(`C05 structural egress rejects a synchronous ${replacement} replacement after the real async fence`, async () => {
    await withReview({}, undefined, async (value) => {
      await value.scope.run(value.request, async () => {
        const pin = await prepareLease(value)
        const basis = { ...value.basis, reviewContext: pin }
        expect(await value.collaboration.reviewRecipientAuthority.authorize(value.call.binding.principalRef, basis, value.call)).toBe(true)
        const before = await value.snapshots()
        const result = await value.fixture.persistence.transactionAll!(async () => {
          expect(await value.collaboration.authorizeReviewThreadContext(pin, value.basis, value.call)).toBe(true)
          expect(value.collaboration.reviewRecipientAuthority.checkAtCommit(value.call.binding.principalRef, basis, value.call)).toBe(true)
          const originalProjector = value.fixture.sourceInput.projectScope
          const originalResolve = value.fixture.business.context.resolve
          const state = value.fixture.authority.state, readState = state.read
          const provider = value.fixture.business.evidence.current
          if (!provider) throw new Error("Actual Atlas provider unavailable")
          const resolveProvider = provider.resolve
          const host = value.fixture.authority.host, persistence = host.persistence
          const snapshots = persistence.currentSnapshots, authenticate = host.authenticate
          const environment = host.environment, requestFor = host.requestFor, revalidate = host.revalidate
          if (replacement === "projector") value.fixture.sourceInput.projectScope = (...args) => originalProjector!(...args)
          if (replacement === "evidence") value.fixture.business.context.resolve = (...args) => originalResolve(...args)
          if (replacement === "authority-state") value.fixture.authority.state = { ...state, read: (request, namespace, read) => readState(request, namespace, read) }
          if (replacement === "state-read") state.read = (request, namespace, read) => readState(request, namespace, read)
          if (replacement === "atlas-provider") value.fixture.business.evidence.current = { ...provider, resolve: (...args) => resolveProvider(...args) }
          if (replacement === "atlas-resolve") provider.resolve = (...args) => resolveProvider(...args)
          if (replacement === "host-persistence") host.persistence = { ...persistence }
          if (replacement === "host-snapshots") persistence.currentSnapshots = () => snapshots?.()
          if (replacement === "host-authenticate") host.authenticate = (...args) => authenticate(...args)
          if (replacement === "host-environment") host.environment = (...args) => environment(...args)
          if (replacement === "host-request") host.requestFor = (...args) => requestFor(...args)
          if (replacement === "host-revalidate") host.revalidate = (...args) => revalidate(...args)
          try {
            return { commit: false, value: value.collaboration.reviewRecipientAuthority.checkAtCommit(value.call.binding.principalRef, basis, value.call) }
          } finally {
            value.fixture.sourceInput.projectScope = originalProjector
            value.fixture.business.context.resolve = originalResolve
            value.fixture.authority.state = state
            state.read = readState
            value.fixture.business.evidence.current = provider
            provider.resolve = resolveProvider
            host.persistence = persistence
            persistence.currentSnapshots = snapshots
            host.authenticate = authenticate
            host.environment = environment
            host.requestFor = requestFor
            host.revalidate = revalidate
          }
        })
        expect(result).toBe(false)
        expect(await value.snapshots()).toBe(before)
      })
    })
  }, 120_000)
}

