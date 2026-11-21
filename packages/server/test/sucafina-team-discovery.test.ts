import "./httpapi-exercise/environment"
import { describe, expect, test } from "bun:test"
import { Context, Layer, Schema } from "effect"
import { HttpRouter, HttpServer } from "effect/unstable/http"
import { createRoutes, type Options } from "../src/routes"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import { SfInstallationSelector } from "@orchestra/schema/sucafina/context"
import { parseSfInstallationSelector, readSfInstallations, SfInvalidInstallationSelector,
  type SfTrustedInstallationSource } from "../src/sucafina-installations"

const installationId = Schema.decodeUnknownSync(TeamProfile.InstallationId)("installation-one")
const tenantId = Schema.decodeUnknownSync(TeamProfile.TenantId)("11111111-2222-4333-8444-555555555555")
const query = "select=installation&contractRevision=sf-team-profile%2F1&installationId=" + installationId + "&tenantId=" + tenantId
const selected = Schema.decodeUnknownSync(SfInstallationSelector)({
  select: "installation", contractRevision: "sf-team-profile/1", installationId, tenantId,
})
const identity = { installationId, projectId: "technical-project", hostId: "host-one" }
const installed = { publicOrigin: "https://sf.example.test", mount: "/sucafina",
  authMode: "microsoft" as const, tenantId, identity: () => identity }
const signal = () => new AbortController().signal

describe("Microsoft installation discovery is placement metadata only", () => {
  test("strict versioned selector roundtrips without a Project or Location", () => {
    expect(parseSfInstallationSelector("/api/sucafina/installations?" + query)).toEqual(selected)
  })
  test("missing, duplicate, mixed and caller authority fields are rejected before lookup", () => {
    for (const suffix of ["&tenantId=" + tenantId, "&%74enantId=" + tenantId,
      "&projectId=technical-project", "&location[directory]=%2Fwork", "&hostId=host-one",
      "&principalRef=caller", "&accessRevision=caller", "&teamObjectId=" + tenantId, "&%ZZ=x"]) {
      expect(() => parseSfInstallationSelector("/api/sucafina/installations?" + query + suffix)).toThrow(SfInvalidInstallationSelector)
    }
    for (const field of ["contractRevision", "installationId", "tenantId"]) {
      const fields = new URLSearchParams(query)
      fields.delete(field)
      expect(() => parseSfInstallationSelector("/api/sucafina/installations?" + fields)).toThrow(SfInvalidInstallationSelector)
    }
    expect(() => parseSfInstallationSelector("/api/sucafina/installations?" +
      query.replace("sf-team-profile%2F1", "sf-native-ui%2F1"))).toThrow(SfInvalidInstallationSelector)
  })
  test("exact selected runtime reports configured resource tenant and separate placement", async () => {
    let locations = 0
    const source: SfTrustedInstallationSource = {
      current: async () => installed, forAdmittedLocation: async () => { locations++; return [installed] },
    }
    expect(await readSfInstallations(source, selected, signal())).toEqual({ installations: [{
      ...identity, tenantId, publicOrigin: installed.publicOrigin, mount: installed.mount,
      authMode: "microsoft", contractRevision: "sf-team-profile/1",
    }] })
    expect(locations).toBe(0)
  })
  test("legacy ID and directory selectors cannot discover a Microsoft business profile", async () => {
    const source: SfTrustedInstallationSource = { current: async () => installed, forAdmittedLocation: async () => [installed] }
    for (const selector of [
      Schema.decodeUnknownSync(SfInstallationSelector)({ select: "ids", installationId, projectId: identity.projectId }),
      Schema.decodeUnknownSync(SfInstallationSelector)({ select: "location", location: { directory: "/work" } }),
    ]) expect(await readSfInstallations(source, selector, signal())).toEqual({ installations: [] })
  })
  test("wrong tenant or installation never uses admitted Location or first-runtime fallback", async () => {
    let locations = 0
    const source: SfTrustedInstallationSource = {
      current: async () => installed, forAdmittedLocation: async () => { locations++; return [installed] },
    }
    for (const raw of [
      { select: "installation", contractRevision: "sf-team-profile/1", installationId: "installation-two", tenantId },
      { select: "installation", contractRevision: "sf-team-profile/1", installationId, tenantId: "b1111111-2222-4333-8444-555555555555" },
    ]) expect(await readSfInstallations(source, Schema.decodeUnknownSync(SfInstallationSelector)(raw), signal())).toEqual({ installations: [] })
    expect(locations).toBe(0)
  })
  test("Microsoft runtime with no configured tenant is unavailable rather than a legacy descriptor", async () => {
    const { tenantId: omitted, ...withoutTenant } = installed
    const source: SfTrustedInstallationSource = { current: async () => withoutTenant, forAdmittedLocation: async () => [withoutTenant] }
    expect(await readSfInstallations(source, selected, signal())).toEqual({ installations: [] })
    expect(await readSfInstallations(source, { select: "ids", installationId, projectId: identity.projectId }, signal())).toEqual({ installations: [] })
  })
  test("aborted read releases no late installation metadata", async () => {
    const aborted = new AbortController()
    const source: SfTrustedInstallationSource = { current: async () => { aborted.abort(); return installed },
      forAdmittedLocation: async () => [installed] }
    expect(await readSfInstallations(source, selected, aborted.signal)).toEqual({ installations: [] })
  })
  test("local technical operator descriptor cannot satisfy a corporate selector", async () => {
    const local = { ...installed, publicOrigin: "http://127.0.0.1:4096", authMode: "local-operator" as const }
    const source: SfTrustedInstallationSource = { current: async () => local, forAdmittedLocation: async () => [local] }
    expect(await readSfInstallations(source, selected, signal())).toEqual({ installations: [] })
    const legacy = await readSfInstallations(source, { select: "ids", installationId, projectId: identity.projectId }, signal())
    expect(legacy.installations[0]?.contractRevision).toBe("sf-native-ui/1")
    expect(legacy.installations[0]?.authMode).toBe("local-operator")
  })
})


describe("current installed Microsoft bootstrap", () => {
  const current = { select: "current", contractRevision: "sf-team-profile/1" } as const
  test("closed current selector returns only the already-loaded runtime metadata", async () => {
    let reads = 0, locations = 0
    const source: SfTrustedInstallationSource = {
      current: async () => { reads++; return installed },
      forAdmittedLocation: async () => { locations++; throw new Error("Location must not be consulted") },
    }
    expect(parseSfInstallationSelector("/api/sucafina/installations?select=current&contractRevision=sf-team-profile%2F1")).toEqual(current)
    expect(await readSfInstallations(source, current, signal())).toEqual({ installations: [{
      ...identity, tenantId, publicOrigin: installed.publicOrigin, mount: installed.mount,
      authMode: "microsoft", contractRevision: "sf-team-profile/1",
    }] })
    expect(reads).toBe(1)
    expect(locations).toBe(0)
  })
  test("current never accepts an owner, legacy protocol, partial or mixed selector", () => {
    for (const query of [
      "select=current", "select=current&contractRevision=sf-native-ui%2F1",
      "select=current&contractRevision=sf-team-profile%2F1&select=current",
      "select=current&contractRevision=sf-team-profile%2F1&%63ontractRevision=sf-team-profile%2F1",
      ...["installationId", "tenantId", "projectId", "teamObjectId", "principalRef", "accessRevision", "location[directory]"]
        .map((key) => "select=current&contractRevision=sf-team-profile%2F1&" + key + "=caller"),
    ]) expect(() => parseSfInstallationSelector("/api/sucafina/installations?" + query)).toThrow(SfInvalidInstallationSelector)
  })
  test("missing, local, incomplete or aborted runtime cannot become corporate bootstrap", async () => {
    for (const runtime of [undefined, { ...installed, tenantId: undefined },
      { ...installed, publicOrigin: "http://127.0.0.1:4096", authMode: "local-operator" as const }]) {
      const source: SfTrustedInstallationSource = { current: async () => runtime, forAdmittedLocation: async () => [installed] }
      expect(await readSfInstallations(source, current, signal())).toEqual({ installations: [] })
    }
    const abort = new AbortController()
    const source: SfTrustedInstallationSource = { current: async () => { abort.abort(); return installed }, forAdmittedLocation: async () => [installed] }
    expect(await readSfInstallations(source, current, abort.signal)).toEqual({ installations: [] })
  })
})

test("the mounted discovery route requires authorization and reads only the supplied installation", async () => {
  const password = "sucafina-discovery-fixture"
  const auth = { authorization: "Basic " + Buffer.from("orchestra:" + password).toString("base64") }
  const route = "http://localhost/api/sucafina/installations?select=location&location%5Bdirectory%5D=%2Fwork"
  const runtime = { ...installed, publicOrigin: "http://127.0.0.1:4096", authMode: "local-operator" as const }
  const source: SfTrustedInstallationSource = {
    current: async () => runtime,
    forAdmittedLocation: async (location) => location.directory === "/work" && !location.workspace ? [runtime] : [],
  }
  const create = (options: Options) => HttpRouter.toWebHandler(
    createRoutes(options).pipe(Layer.provide(HttpServer.layerServices)),
    { disableLogger: true, memoMap: Layer.makeMemoMapUnsafe() },
  )
  const defaults = create({ password })
  const configured = create({ password, sucafinaInstallations: source })
  const context = Context.makeUnsafe<unknown>(new Map())
  try {
    expect((await configured.handler(new Request(route), context)).status).toBe(401)
    const empty = await defaults.handler(new Request(route, { headers: auth }), context)
    expect(empty.status).toBe(200)
    expect(await empty.json()).toEqual({ installations: [] })
    const selected = await configured.handler(new Request(route, { headers: auth }), context)
    expect(selected.status).toBe(200)
    expect(await selected.json()).toEqual({ installations: [{
      ...identity, publicOrigin: runtime.publicOrigin, mount: runtime.mount,
      authMode: "local-operator", contractRevision: "sf-native-ui/1",
    }] })
  } finally {
    await Promise.all([defaults.dispose(), configured.dispose()])
  }
})
