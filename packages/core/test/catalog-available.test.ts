import { describe, expect } from "bun:test"
import { Cause, Effect, Exit, Layer } from "effect"
import { Catalog } from "@orchestra/core/catalog"
import { Credential } from "@orchestra/core/credential"
import { Integration } from "@orchestra/core/integration"
import { AppNodeBuilder } from "@orchestra/core/effect/app-node-builder"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { EventV2 } from "@orchestra/core/event"
import { Location } from "@orchestra/core/location"
import { ModelV2 } from "@orchestra/core/model"
import { Policy } from "@orchestra/core/policy"
import { ProviderV2 } from "@orchestra/core/provider"
import { AbsolutePath } from "@orchestra/core/schema"
import { location } from "./fixture/location"
import { testEffect } from "./lib/effect"

function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("Expected value")
  return value
}

const locationLayer = Layer.succeed(
  Location.Service,
  Location.Service.of(location({ directory: AbsolutePath.make("catalog-available-test") })),
)
const catalogLayer = Layer.fresh(AppNodeBuilder.build(
  LayerNode.group([Catalog.node, EventV2.node, Credential.node, Integration.node, Policy.node]),
  [[Location.node, locationLayer]],
))
const it = testEffect(catalogLayer)

describe("Catalog available model metadata", () => {
  it.effect("validates hidden metadata immediately when a credential makes its provider available", () =>
    Effect.gen(function* () {
      const catalog = yield* Catalog.Service
      const credentials = yield* Credential.Service
      const integrations = yield* Integration.Service
      const providerID = ProviderV2.ID.make("metadata-gateway")
      const integrationID = Integration.ID.make("metadata-gateway")
      const modelID = ModelV2.ID.make("invalid-limit")
      yield* integrations.transform((draft) => draft.update(integrationID, () => {}))
      yield* catalog.transform((draft) => {
        draft.provider.update(providerID, (provider) => { provider.integrationID = integrationID })
        draft.model.update(providerID, modelID, (model) => { model.limit.context = 0.5 })
      })

      expect(yield* catalog.provider.available()).toEqual([])
      expect(yield* catalog.model.available()).toEqual([])
      expect(Exit.isFailure(yield* Effect.exit(catalog.model.all()))).toBe(true)
      expect(Exit.isFailure(yield* Effect.exit(catalog.model.get(providerID, modelID)))).toBe(true)

      const credential = yield* credentials.create({
        integrationID,
        label: "default",
        value: Credential.Key.make({ type: "key", key: "synthetic-metadata-key" }),
      })
      // No catalog reload: each read must observe the current credential state.
      expect((yield* catalog.provider.available()).map((provider) => provider.id)).toEqual([providerID])
      expect(Exit.isFailure(yield* Effect.exit(catalog.model.available()))).toBe(true)
      yield* credentials.remove(credential.id)
      expect(yield* catalog.model.available()).toEqual([])
      expect(Exit.isFailure(yield* Effect.exit(catalog.model.all()))).toBe(true)
      expect(Exit.isFailure(yield* Effect.exit(catalog.model.get(providerID, modelID)))).toBe(true)
    }),
  )

  it.effect("validates a disabled model before filtering it from an available provider", () =>
    Effect.gen(function* () {
      const catalog = yield* Catalog.Service
      const providerID = ProviderV2.ID.make("configured-models")
      const modelID = ModelV2.ID.make("disabled-invalid")
      const configuration = { context: 0.5, enabled: false }
      yield* catalog.transform((draft) => {
        draft.provider.update(providerID, () => {})
        draft.model.update(providerID, modelID, (model) => {
          model.enabled = configuration.enabled
          model.limit.context = configuration.context
        })
      })
      expect((yield* catalog.provider.available()).map((provider) => provider.id)).toEqual([providerID])
      expect(Exit.isFailure(yield* Effect.exit(catalog.model.available()))).toBe(true)

      configuration.context = 4096
      yield* catalog.reload()
      expect(yield* catalog.model.available()).toEqual([])
      expect(required(yield* catalog.model.get(providerID, modelID)).enabled).toBe(false)
      configuration.enabled = true
      yield* catalog.reload()
      expect((yield* catalog.model.available()).map((model) => model.id)).toEqual([modelID])
    }),
  )

  it.effect("omits hidden projection getters and observes them immediately after credential activation", () =>
    Effect.gen(function* () {
      const catalog = yield* Catalog.Service
      const credentials = yield* Credential.Service
      const integrations = yield* Integration.Service
      const providerID = ProviderV2.ID.make("getter-projection")
      const integrationID = Integration.ID.make("getter-projection")
      const modelID = ModelV2.ID.make("observed")
      const fault = { site: "" }
      const observed: string[] = []
      const read = <T>(site: string, value: T): T => {
        observed.push(site)
        if (fault.site === site) throw new Error("projection-getter-" + site)
        return value
      }
      yield* integrations.transform((draft) => draft.update(integrationID, () => {}))
      yield* catalog.transform((draft) => {
        draft.provider.update(providerID, (provider) => {
          provider.integrationID = integrationID
          provider.api = { type: "aisdk", package: "@ai-sdk/openai-compatible", settings: {} }
          Object.defineProperty(provider.api.settings, "observed-provider-setting", {
            enumerable: true, get: () => read("provider-setting", "provider"),
          })
          Object.defineProperty(provider.request.headers, "observed-provider-header", {
            enumerable: true, get: () => read("provider-header", "provider"),
          })
          Object.defineProperty(provider.request.body, "observed-provider-body", {
            enumerable: true, get: () => read("provider-body", true),
          })
        })
        draft.model.update(providerID, modelID, (model) => {
          model.api = { id: modelID, type: "aisdk", package: "@ai-sdk/openai-compatible", settings: {} }
          const api = model.api, request = model.request, name = model.name
          Object.defineProperty(api.settings, "observed-model-setting", {
            enumerable: true, get: () => read("model-setting", "model"),
          })
          Object.defineProperty(request.headers, "observed-model-header", {
            enumerable: true, get: () => read("model-header", "model"),
          })
          Object.defineProperty(request.body, "observed-model-body", {
            enumerable: true, get: () => read("model-body", true),
          })
          Object.defineProperties(model, {
            api: { enumerable: true, configurable: true, get: () => read("model-api", api) },
            request: { enumerable: true, configurable: true, get: () => read("model-request", request) },
            name: { enumerable: true, configurable: true, get: () => read("model-property", name) },
          })
        })
      })

      // Provider discovery still reads its own authentication metadata. These
      // nine sites are projection-only fields, outside that discovery decision.
      const sites = [
        "model-api", "model-request", "model-property", "provider-setting", "model-setting",
        "provider-header", "model-header", "provider-body", "model-body",
      ]
      observed.length = 0
      expect(yield* catalog.model.available()).toEqual([])
      expect(observed).toEqual([])
      for (const site of sites) {
        fault.site = site
        observed.length = 0
        expect(yield* catalog.model.available()).toEqual([])
        expect(observed).toEqual([])
        for (const effect of [
          catalog.model.all().pipe(Effect.asVoid),
          catalog.model.get(providerID, modelID).pipe(Effect.asVoid),
        ]) {
          const result = yield* Effect.exit(effect)
          expect(Exit.isFailure(result)).toBe(true)
          if (Exit.isFailure(result))
            expect(Cause.prettyErrors(result.cause).map((error) => error.message)).toContain("projection-getter-" + site)
        }
      }

      fault.site = ""
      const credential = yield* credentials.create({
        integrationID,
        label: "default",
        value: Credential.Key.make({ type: "key", key: "synthetic-projection-key" }),
      })
      // No catalog reload: current credentials select the same metadata now.
      for (const site of sites) {
        fault.site = site
        observed.length = 0
        const result = yield* Effect.exit(catalog.model.available())
        expect(Exit.isFailure(result)).toBe(true)
        expect(observed).toContain(site)
        if (Exit.isFailure(result))
          expect(Cause.prettyErrors(result.cause).map((error) => error.message)).toContain("projection-getter-" + site)
      }
      fault.site = ""
      const selected = yield* catalog.model.available()
      expect(selected.map((model) => model.id)).toEqual([modelID])
      yield* credentials.remove(credential.id)
      fault.site = "model-api"
      observed.length = 0
      expect(yield* catalog.model.available()).toEqual([])
      expect(observed).toEqual([])
    }),
  )

  it.effect("requires identity before hidden metadata while all and get retain original error precedence", () =>
    Effect.gen(function* () {
      const catalog = yield* Catalog.Service
      const providerID = ProviderV2.ID.make("identity-first")
      const modelID = ModelV2.ID.make("identity-error")
      yield* catalog.transform((draft) => {
        draft.provider.update(providerID, (provider) => { provider.disabled = true })
        draft.model.update(providerID, modelID, () => {})
        const model = required(draft.model.get(providerID, modelID))
        // Install after update, which assigns the ordinary identity itself.
        Object.defineProperties(model, {
          providerID: {
            enumerable: true, configurable: true,
            get() { throw new Error("eligibility-identity") },
          },
          api: {
            enumerable: true, configurable: true,
            get() { throw new Error("projection-metadata") },
          },
        })
      })

      const available = yield* Effect.exit(catalog.model.available())
      expect(Exit.isFailure(available)).toBe(true)
      if (Exit.isFailure(available))
        expect(Cause.prettyErrors(available.cause).map((error) => error.message)).toContain("eligibility-identity")
      for (const effect of [
        catalog.model.all().pipe(Effect.asVoid),
        catalog.model.get(providerID, modelID).pipe(Effect.asVoid),
      ]) {
        const result = yield* Effect.exit(effect)
        expect(Exit.isFailure(result)).toBe(true)
        if (Exit.isFailure(result))
          expect(Cause.prettyErrors(result.cause).map((error) => error.message)).toContain("projection-metadata")
      }
    }),
  )

  it.effect("selects each base model by its effective provider rather than its parent record", () =>
    Effect.gen(function* () {
      const catalog = yield* Catalog.Service
      const hidden = ProviderV2.ID.make("hidden-parent")
      const visible = ProviderV2.ID.make("visible-parent")
      const selectedID = ModelV2.ID.make("selected-from-hidden-parent")
      const omittedID = ModelV2.ID.make("omitted-from-visible-parent")
      let omittedReads = 0
      yield* catalog.transform((draft) => {
        draft.provider.update(hidden, (provider) => {
          provider.disabled = true
          provider.api = {
            type: "aisdk", package: "@ai-sdk/openai-compatible",
            url: "https://hidden-parent.example.com", settings: { owner: "hidden-parent" },
          }
        })
        draft.provider.update(visible, () => {})
        draft.model.update(hidden, selectedID, () => {})
        draft.model.update(visible, omittedID, () => {})
        // The draft exposes mutable records. Later transform work can change
        // identity after model.update assigned its parent ID.
        const selected = required(required(draft.provider.get(hidden)).models.get(selectedID))
        const omitted = required(required(draft.provider.get(visible)).models.get(omittedID))
        selected.providerID = visible
        omitted.providerID = hidden
        Object.defineProperty(omitted, "name", {
          enumerable: true, configurable: true,
          get() { omittedReads++; throw new Error("unavailable-effective-provider") },
        })
      })

      const models = yield* catalog.model.available()
      expect(models.map((model) => model.id)).toEqual([selectedID])
      const selected = required(models[0])
      expect(selected.providerID).toBe(visible)
      expect(selected.api.url).toBe("https://hidden-parent.example.com")
      expect(selected.api.settings.owner).toBe("hidden-parent")
      expect(omittedReads).toBe(0)
      expect(Exit.isFailure(yield* Effect.exit(catalog.model.get(visible, omittedID)))).toBe(true)
      expect(omittedReads).toBeGreaterThan(0)
    }),
  )

  it.effect("filters the actual projected identity after metadata changes an eligibility ID", () =>
    Effect.gen(function* () {
      const catalog = yield* Catalog.Service
      const visible = ProviderV2.ID.make("changing-visible")
      const hidden = ProviderV2.ID.make("changing-hidden")
      const modelID = ModelV2.ID.make("changing-identity")
      const state = { current: visible, next: hidden, projections: 0 }
      yield* catalog.transform((draft) => {
        draft.provider.update(visible, () => {})
        draft.provider.update(hidden, (provider) => { provider.disabled = true })
        draft.model.update(visible, modelID, () => {})
        const model = required(draft.model.get(visible, modelID)), api = model.api
        Object.defineProperties(model, {
          providerID: { enumerable: true, configurable: true, get: () => state.current },
          api: {
            enumerable: true, configurable: true,
            get() {
              state.projections++
              state.current = state.next
              return api
            },
          },
        })
      })

      // Eligibility sees visible; the original projection later produces hidden.
      expect(yield* catalog.model.available()).toEqual([])
      expect(state.projections).toBeGreaterThan(0)
      expect(state.current).toBe(hidden)
      state.current = visible
      expect(required(yield* catalog.model.get(visible, modelID)).providerID).toBe(hidden)

      // Hidden metadata cannot make itself eligible as a side effect of a read
      // that available() no longer performs.
      state.current = hidden
      state.next = visible
      state.projections = 0
      expect(yield* catalog.model.available()).toEqual([])
      expect(state.projections).toBe(0)
      expect(required(yield* catalog.model.get(visible, modelID)).providerID).toBe(visible)
    }),
  )

  it.effect("uses the current virtual credential identity instead of the base model identity", () =>
    Effect.gen(function* () {
      const catalog = yield* Catalog.Service
      const credentials = yield* Credential.Service
      const integrations = yield* Integration.Service
      const providerID = ProviderV2.ID.make("virtual-parent")
      const integrationID = Integration.ID.make("virtual-parent")
      const hiddenID = ProviderV2.ID.make("hidden-model-identity")
      const modelID = ModelV2.ID.make("virtual-override")
      yield* integrations.transform((draft) => draft.update(integrationID, () => {}))
      yield* catalog.transform((draft) => {
        draft.provider.update(providerID, (provider) => { provider.integrationID = integrationID })
        draft.provider.update(hiddenID, (provider) => { provider.disabled = true })
        draft.model.update(providerID, modelID, () => {})
        required(required(draft.provider.get(providerID)).models.get(modelID)).providerID = hiddenID
      })
      expect(yield* catalog.model.available()).toEqual([])

      const credential = yield* credentials.create({
        integrationID,
        label: "Work",
        value: Credential.Key.make({ type: "key", key: "synthetic-virtual-override-key" }),
      })
      const virtualID = ProviderV2.ID.make(providerID + "#" + credential.id)
      expect((yield* catalog.provider.available()).map((provider) => provider.id)).toEqual([providerID, virtualID])
      const models = yield* catalog.model.available()
      expect(models.map((model) => model.providerID)).toEqual([virtualID])
      expect(models.map((model) => model.id)).toEqual([modelID])
      expect(required(yield* catalog.model.get(providerID, modelID)).providerID).toBe(hiddenID)
      expect(required(yield* catalog.model.get(virtualID, modelID)).providerID).toBe(virtualID)

      yield* credentials.remove(credential.id)
      expect(yield* catalog.model.available()).toEqual([])
      expect(yield* catalog.model.get(virtualID, modelID)).toBeUndefined()
    }),
  )

  it.effect("omits nested hidden metadata reads only in available and restores them when visible", () =>
    Effect.gen(function* () {
      const catalog = yield* Catalog.Service
      const providerID = ProviderV2.ID.make("nested-metadata")
      const modelID = ModelV2.ID.make("guarded-limit")
      const configuration = { disabled: true, reads: 0 }
      yield* catalog.transform((draft) => {
        draft.provider.update(providerID, (provider) => { provider.disabled = configuration.disabled })
        draft.model.update(providerID, modelID, (model) => {
          Object.defineProperty(model.limit, "context", {
            enumerable: true,
            configurable: true,
            get() {
              configuration.reads += 1
              throw new Error("nested-limit-read")
            },
          })
        })
      })

      configuration.reads = 0
      expect(yield* catalog.model.available()).toEqual([])
      expect(configuration.reads).toBe(0)
      expect(Exit.isFailure(yield* Effect.exit(catalog.model.all()))).toBe(true)
      expect(configuration.reads).toBeGreaterThan(0)
      configuration.reads = 0
      expect(Exit.isFailure(yield* Effect.exit(catalog.model.get(providerID, modelID)))).toBe(true)
      expect(configuration.reads).toBeGreaterThan(0)

      configuration.disabled = false
      yield* catalog.reload()
      configuration.reads = 0
      expect(Exit.isFailure(yield* Effect.exit(catalog.model.available()))).toBe(true)
      expect(configuration.reads).toBeGreaterThan(0)
    }),
  )

  it.effect("keeps fresh virtual providers, merged metadata and release ordering", () =>
    Effect.gen(function* () {
      const catalog = yield* Catalog.Service
      const credentials = yield* Credential.Service
      const integrations = yield* Integration.Service
      const providerID = ProviderV2.ID.make("remote-models")
      const integrationID = Integration.ID.make("remote-integration")
      const older = ModelV2.ID.make("older"), newer = ModelV2.ID.make("newer")
      const configuration = { release: 200, output: 2048 }
      yield* integrations.transform((draft) => draft.update(integrationID, () => {}))
      yield* catalog.transform((draft) => {
        draft.provider.update(providerID, (provider) => {
          provider.integrationID = integrationID
          provider.api = {
            type: "aisdk",
            package: "@ai-sdk/openai-compatible",
            url: "https://provider.example.com",
            settings: { region: "provider", shared: "provider" },
          }
          provider.request.headers.provider = "provider"
          provider.request.headers.shared = "provider"
          provider.request.body.provider = true
          provider.request.body.shared = "provider"
        })
        draft.model.update(providerID, older, (model) => { model.time.released = 100 })
        draft.model.update(providerID, newer, (model) => {
          model.time.released = configuration.release
          model.limit.output = configuration.output
          model.api = {
            id: newer,
            type: "aisdk",
            package: "@ai-sdk/openai-compatible",
            settings: { shared: "model", model: true },
          }
          model.request.headers.model = "model"
          model.request.headers.shared = "model"
          model.request.body.model = true
          model.request.body.shared = "model"
        })
        draft.model.update(providerID, ModelV2.ID.make("disabled"), (model) => {
          model.time.released = 300
          model.enabled = false
        })
      })
      expect(yield* catalog.model.available()).toEqual([])

      const first = yield* credentials.create({
        integrationID,
        label: "Work",
        value: Credential.Key.make({ type: "key", key: "synthetic-work-key" }),
      })
      const firstID = ProviderV2.ID.make(providerID + "#" + first.id)
      const firstRead = yield* catalog.model.available()
      expect(firstRead.map((model) => model.id)).toEqual([newer, newer, older, older])
      expect(firstRead.filter((model) => model.id === newer).map((model) => model.providerID)).toEqual([providerID, firstID])
      const projected = required(firstRead.find((model) => model.providerID === firstID && model.id === newer))
      expect(projected.api).toEqual({
        id: newer,
        type: "aisdk",
        package: "@ai-sdk/openai-compatible",
        url: "https://provider.example.com",
        settings: { region: "provider", shared: "model", model: true },
      })
      expect(projected.request.headers).toEqual({ provider: "provider", shared: "model", model: "model" })
      expect(projected.request.body).toEqual({ provider: true, shared: "model", model: true })
      expect(projected.limit.output).toBe(2048)

      const second = yield* credentials.create({
        integrationID,
        label: "Personal",
        value: Credential.Key.make({ type: "key", key: "synthetic-personal-key" }),
      })
      const secondID = ProviderV2.ID.make(providerID + "#" + second.id)
      const secondRead = yield* catalog.model.available()
      expect(secondRead.map((model) => model.id)).toEqual([newer, newer, newer, older, older, older])
      expect(new Set(secondRead.map((model) => model.providerID))).toEqual(new Set([providerID, firstID, secondID]))
      yield* credentials.remove(first.id)
      expect(new Set((yield* catalog.model.available()).map((model) => model.providerID))).toEqual(new Set([providerID, secondID]))
      expect(yield* catalog.model.get(firstID, newer)).toBeUndefined()

      configuration.release = 50
      configuration.output = 4096
      yield* catalog.reload()
      const changed = yield* catalog.model.available()
      expect(changed.map((model) => model.id)).toEqual([older, older, newer, newer])
      expect(changed.filter((model) => model.id === newer).map((model) => model.limit.output)).toEqual([4096, 4096])
      yield* credentials.remove(second.id)
      expect(yield* catalog.model.available()).toEqual([])
      // Full discovery still includes the base provider and its disabled model.
      expect((yield* catalog.model.all()).map((model) => model.id)).toEqual([ModelV2.ID.make("disabled"), older, newer])
    }),
  )
})
