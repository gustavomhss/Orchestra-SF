import { expect, test } from "bun:test"
import { Schema } from "effect"
import { HttpApi, HttpApiEndpoint, HttpApiGroup, HttpApiMiddleware, HttpApiSchema } from "effect/unstable/httpapi"
import { compile, compileImported, emitEffect, emitEffectImported, emitPromise } from "../src"

const Pair = Schema.Struct({ first: Schema.String, second: Schema.String }).check(
  Schema.makeFilter((value) => value.first === value.second, { message: "Both values must match" }),
)
const Api = HttpApi.make("refinement").add(
  HttpApiGroup.make("probe").add(HttpApiEndpoint.get("read", "/probe", { success: Pair })),
)
const source = { module: "./authoritative-api", api: "Api" }

test("ordinary and standalone compilation still refuse a nonportable runtime refinement", () => {
  expect(() => compile(Api)).toThrow("Unportable schema: probe.read.success")
  const contract = compileImported(Api, source)
  expect(() => emitEffect(contract)).toThrow("Effect schema requires its bound authoritative API import")
  expect(() => emitEffectImported(contract, source)).not.toThrow()
})

test("an import-only contract cannot be cloned, retargeted, or reconstructed as endpoint projections", () => {
  const contract = compileImported(Api, source)
  for (const target of [
    { module: "./different-api", api: "Api" },
    { module: source.module, api: "DifferentApi" },
    { module: source.module, group: "ProbeGroup" },
    { module: source.module, endpoints: { "probe.read": "Read" } },
  ]) expect(() => emitEffectImported(contract, target)).toThrow("Authoritative API import does not match")
  expect(() => emitEffectImported({ ...contract }, source)).toThrow("Authoritative API import does not match")
  expect(Object.isFrozen(contract)).toBe(true)
})

test("the authoritative export is captured before caller options can change", () => {
  const target = { ...source }
  const contract = compileImported(Api, target)
  target.module = "./replacement"
  target.api = "Replacement"
  expect(() => emitEffectImported(contract, target)).toThrow("Authoritative API import does not match")
  expect(() => emitEffectImported(contract, source)).not.toThrow()
  expect(() => compileImported(Api, { module: " ", api: "Api" })).toThrow("Invalid authoritative API import")
  expect(() => compileImported(Api, { module: "./api", api: "Api.member" })).toThrow("Invalid authoritative API import")
})

test("Promise declarations describe shape without claiming runtime refinement validation", () => {
  const output = emitPromise(compileImported(Api, source))
  const types = output.files.find((file) => file.path === "types.ts")?.content
  expect(types).toContain('readonly "first": string')
  expect(types).toContain('readonly "second": string')
  expect(types).not.toContain("makeFilter")
})

test("stream refinements require the same authoritative API and cannot reach standalone emission", () => {
  const events = HttpApi.make("stream-refinement").add(
    HttpApiGroup.make("probe").add(HttpApiEndpoint.get("events", "/event", {
      success: HttpApiSchema.StreamSse({ data: Pair }),
    })),
  )
  expect(() => compile(events)).toThrow("Unportable schema: probe.events.success.data")
  const contract = compileImported(events, source)
  expect(() => emitEffect(contract)).toThrow("Effect schema requires its bound authoritative API import")
  expect(() => emitEffectImported(contract, source)).not.toThrow()
})

test("authoritative mode retains required client middleware and structural validation", () => {
  class Required extends HttpApiMiddleware.Service<Required>()("RefinementAdapter", { requiredForClient: true }) {}
  expect(() => compileImported(Api.middleware(Required), source)).toThrow("Client middleware requires adapter: RefinementAdapter")
  const colliding = HttpApi.make("collision").add(
    HttpApiGroup.make("probe").add(HttpApiEndpoint.post("write", "/probe/:id", {
      params: { id: Schema.String }, payload: Schema.Struct({ id: Schema.String }), success: Pair,
    })),
  )
  expect(() => compileImported(colliding, source)).toThrow("Input field collision: id")
})
