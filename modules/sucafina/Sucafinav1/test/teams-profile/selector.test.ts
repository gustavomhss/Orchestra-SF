import { describe, expect, test } from "bun:test"
import { Schema } from "effect"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import { readTeamContextQuery, readTeamProfileSelector } from "../../runtime/team-profile-selector"

const binding = {
  installationId: "installation-one", tenantId: "11111111-2222-4333-8444-555555555555",
  origin: "https://sf.example.test", mount: "/sucafina",
}
const profile = Schema.decodeUnknownSync(TeamProfile.Ref)({ installationId: binding.installationId, tenantId: binding.tenantId,
  teamObjectId: "a1111111-2222-4333-8444-555555555555" })
const intent = Schema.decodeUnknownSync(TeamProfile.Selector)({ contractRevision: "sf-team-profile/1", kind: "team", profile })
const query = Schema.decodeUnknownSync(TeamProfile.ContextQuery)({ contractRevision: "sf-team-profile/1", installationId: binding.installationId,
  tenantId: binding.tenantId, hostId: "host-one", kind: "team", teamObjectId: profile.teamObjectId })
const url = (values: Readonly<Record<string, string | undefined>> = query) => {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) if (value !== undefined) params.append(key, value)
  return binding.origin + binding.mount + "/api/ui/context?" + params
}
const business = (text = JSON.stringify(intent)) =>
  new Request(binding.origin + binding.mount + "/api/ui/decisions", {
    headers: { "x-sf-team-profile": text },
  })

describe("Teams intent parser is not an authority", () => {
  test("explicit Team header returns only the validated intent", () => {
    expect(readTeamProfileSelector(business(), binding)).toEqual(intent)
  })
  test("versioned query accepts only the complete bound Team intent", () => {
    const request = new Request(url())
    expect(readTeamContextQuery(request, binding)).toEqual(query)
    expect(readTeamProfileSelector(request, binding)).toEqual(intent)
    expect(request.url).toBe(url())
    expect(request.headers.has("x-sf-team-profile")).toBe(false)
  })
  test("zero/one/many selection and administration are explicit context intents", () => {
    for (const kind of ["selection", "administration"] as const) {
      const { teamObjectId, ...fields } = query
      const request = new Request(url({ ...fields, kind }))
      expect(readTeamProfileSelector(request, binding)).toEqual(Schema.decodeUnknownSync(TeamProfile.Selector)({
        contractRevision: "sf-team-profile/1", kind,
        installationId: binding.installationId, tenantId: binding.tenantId,
      }))
      expect(readTeamProfileSelector(business(JSON.stringify({
        contractRevision: "sf-team-profile/1", kind,
        installationId: binding.installationId, tenantId: binding.tenantId,
      })), binding)).toBeUndefined()
    }
  })
  test("missing, legacy and malformed selectors never mean auto selection", () => {
    for (const request of [
      new Request(binding.origin + binding.mount + "/api/ui/decisions"),
      new Request(binding.origin + binding.mount + "/api/ui/context"),
      new Request(binding.origin + binding.mount + "/api/ui/context?installationId=installation-one&projectId=technical-project&hostId=host-one"),
      business("{}"), business("null"), business("[]"), business("malformed"),
      business(JSON.stringify({ ...intent, contractRevision: "sf-native-ui/1" })),
    ]) expect(readTeamProfileSelector(request, binding)).toBeUndefined()
  })
  test("header and context query cannot supply competing intents", () => {
    expect(readTeamProfileSelector(new Request(url(), { headers: { "x-sf-team-profile": JSON.stringify(intent) } }), binding)).toBeUndefined()
    expect(readTeamProfileSelector(new Request(binding.origin + binding.mount + "/api/ui/decisions?teamObjectId=" + profile.teamObjectId, {
      headers: { "x-sf-team-profile": JSON.stringify(intent) },
    }), binding)).toBeUndefined()
  })
  test("raw duplicate and escaped duplicate header keys are refused", () => {
    for (const text of [
      '{"contractRevision":"sf-team-profile/1","kind":"team","kind":"team","profile":' + JSON.stringify(profile) + '}',
      '{"contractRevision":"sf-team-profile/1","kind":"team","\\u006bind":"team","profile":' + JSON.stringify(profile) + '}',
      '{"contractRevision":"sf-team-profile/1","kind":"team","profile":{"installationId":"installation-one","tenantId":"' +
        profile.tenantId + '","teamObjectId":"' + profile.teamObjectId + '","teamObjectId":"' + profile.teamObjectId + '"}}',
      JSON.stringify(intent) + ", " + JSON.stringify(intent),
    ]) expect(readTeamProfileSelector(business(text), binding)).toBeUndefined()
  })
  test("prototype-bearing, extra authority and unbounded headers are refused", () => {
    for (const text of [
      '{"contractRevision":"sf-team-profile/1","kind":"team","__proto__":{},"profile":' + JSON.stringify(profile) + '}',
      JSON.stringify({ ...intent, principal: { principalObjectId: "caller" } }),
      JSON.stringify({ ...intent, accessRevision: "caller" }),
      JSON.stringify({ ...intent, groups: [] }),
      JSON.stringify({ ...intent, profile: { ...profile, directory: "/work" } }),
      JSON.stringify({ ...intent, profile: { ...profile, teamObjectId: "x".repeat(2048) } }),
    ]) expect(readTeamProfileSelector(business(text), binding)).toBeUndefined()
  })
  test("query duplicate, unknown, escaped duplicate and malformed percent keys are refused", () => {
    for (const suffix of [
      "&hostId=host-one", "&%68ostId=host-one", "&principalRef=caller", "&accessRevision=caller",
      "&directory=%2Fwork", "&projectId=technical-project", "&%ZZ=x",
    ]) expect(readTeamProfileSelector(new Request(url() + suffix), binding)).toBeUndefined()
    expect(readTeamProfileSelector(new Request(url({ ...query, teamObjectId: "" })), binding)).toBeUndefined()
  })
  test("cross-installation and cross-tenant selectors are refused before admission", () => {
    for (const key of ["installationId", "tenantId"] as const) {
      const patch = { [key]: key === "installationId" ? "installation-two" : "b1111111-2222-4333-8444-555555555555" }
      expect(readTeamProfileSelector(business(JSON.stringify({ ...intent, profile: { ...profile, ...patch } })), binding)).toBeUndefined()
      expect(readTeamProfileSelector(new Request(url({ ...query, ...patch })), binding)).toBeUndefined()
    }
  })
  test("wrong origin, cross-site and aborted original requests are refused", () => {
    const abort = new AbortController()
    abort.abort()
    for (const request of [
      new Request(url().replace(binding.origin, "https://foreign.example.test")),
      new Request(url(), { headers: { origin: "https://foreign.example.test" } }),
      new Request(url(), { headers: { "sec-fetch-site": "cross-site" } }),
      new Request(url(), { signal: abort.signal }),
      new Request(url().replace(binding.mount, "/other")),
    ]) expect(readTeamProfileSelector(request, binding)).toBeUndefined()
  })
  test("a parsed selector contains no authenticated state, grant or revision", () => {
    const parsed = readTeamProfileSelector(business(), binding)
    expect(parsed).toEqual(intent)
    expect(Object.keys(parsed ?? {})).toEqual(["contractRevision", "kind", "profile"])
  })
})
