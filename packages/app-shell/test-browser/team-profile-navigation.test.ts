import { expect, test } from "bun:test"
import { Schema } from "effect"
import { Session } from "@orchestra/schema/session"
import { SfTeamInstallationDescriptor } from "@orchestra/schema/sucafina/context"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import { readTeamNavigationIntent, readTeamSessionNavigation, teamNavigationReturnTo, teamNavigationURL,
  teamSessionNavigationURL } from "../src/context/team-profile-navigation"

const binding = Schema.decodeUnknownSync(SfTeamInstallationDescriptor)({
  installationId: "installation-one",
  tenantId: "11111111-2222-4333-8444-555555555555",
  projectId: "technical-project", hostId: "teams-host",
  publicOrigin: "https://teams.example.test", mount: "/sucafina",
  contractRevision: "sf-team-profile/1", authMode: "microsoft",
})
const teamA = Schema.decodeUnknownSync(TeamProfile.Ref)({
  installationId: binding.installationId, tenantId: binding.tenantId,
  teamObjectId: "a1111111-2222-4333-8444-555555555555",
})
const teamB = Schema.decodeUnknownSync(TeamProfile.Ref)({
  ...teamA, teamObjectId: "b1111111-2222-4333-8444-555555555555",
})
function target(teamObjectId?: string) {
  const url = new URL("/orchestra/sf-home", binding.publicOrigin)
  url.search = new URLSearchParams({
    contractRevision: "sf-team-profile/1", server: binding.publicOrigin,
    installationId: binding.installationId, tenantId: binding.tenantId,
    ...(teamObjectId === undefined ? {} : { teamObjectId }),
  }).toString()
  return url
}

test("the three context entry paths retain their closed selection and Team intent contract", () => {
  for (const pathname of ["/", "/orchestra/sf-home", "/orchestra/sf-home/context"]) {
    const empty = new URL(pathname, binding.publicOrigin)
    expect(readTeamNavigationIntent(empty, binding)).toEqual({
      contractRevision: "sf-team-profile/1", kind: "selection",
      installationId: binding.installationId, tenantId: binding.tenantId,
    })
    const selection = target()
    selection.pathname = pathname
    expect(readTeamNavigationIntent(selection, binding)?.kind).toBe("selection")
    const selected = target(teamA.teamObjectId)
    selected.pathname = pathname
    expect(readTeamNavigationIntent(selected, binding)).toEqual({
      contractRevision: "sf-team-profile/1", kind: "team", profile: teamA,
    })
    expect(teamNavigationReturnTo(selected, binding)).toBe(selected.pathname + selected.search)
  }
})

test("foreign, duplicate, partial, legacy and malformed Team URLs are refused without a default intent", () => {
  const invalid: URL[] = []
  for (const [key, value] of [
    ["contractRevision", "sf-native-ui/1"], ["server", "https://foreign.example.test"],
    ["installationId", "installation-other"], ["tenantId", "21111111-2222-4333-8444-555555555555"],
    ["teamObjectId", ""], ["teamObjectId", "not-a-guid"], ["teamObjectId", teamA.teamObjectId.toUpperCase()],
  ]) {
    const url = target(teamA.teamObjectId)
    url.searchParams.set(key!, value!)
    invalid.push(url)
  }
  for (const key of ["contractRevision", "server", "installationId", "tenantId"]) {
    const url = target(teamA.teamObjectId)
    url.searchParams.delete(key)
    invalid.push(url)
  }
  for (const key of ["contractRevision", "server", "installationId", "tenantId", "teamObjectId"]) {
    const url = target(teamA.teamObjectId)
    url.searchParams.append(key, url.searchParams.get(key)!)
    invalid.push(url)
  }
  for (const key of ["projectId", "hostId", "directory", "kind", "role", "principalRef", "accessRevision"]) {
    const url = target(teamA.teamObjectId)
    url.searchParams.set(key, "injected")
    invalid.push(url)
  }
  for (const pathname of ["/orchestra/sf-home/administration", "/orchestra/sf-sessions", "/orchestra/sf-home/", "/unknown"]) {
    const url = target(teamA.teamObjectId)
    url.pathname = pathname
    invalid.push(url)
  }
  const foreign = target(teamA.teamObjectId)
  foreign.hostname = "foreign.example.test"
  invalid.push(foreign)
  const insecure = target(teamA.teamObjectId)
  insecure.protocol = "http:"
  invalid.push(insecure)
  const credentials = target(teamA.teamObjectId)
  credentials.username = "injected"
  invalid.push(credentials)
  const fragment = target(teamA.teamObjectId)
  fragment.hash = "teamObjectId=" + teamB.teamObjectId
  invalid.push(fragment)
  invalid.push(new URL(target(teamA.teamObjectId).href + "&installation%49d=installation-one"))
  invalid.push(new URL(target(teamA.teamObjectId).href.replace("installation-one", "installation%")))
  for (const url of invalid) {
    expect(readTeamNavigationIntent(url, binding)).toBeUndefined()
    expect(teamNavigationReturnTo(url, binding)).toBeUndefined()
    expect(teamNavigationURL(url, binding, teamB)).toBeUndefined()
  }
})

test("the URL writer changes only the admitted profile intent and never shares state between window URLs", () => {
  const left = target(teamA.teamObjectId)
  const right = target(teamA.teamObjectId)
  const changed = teamNavigationURL(left, binding, teamB)
  expect(changed?.searchParams.get("teamObjectId")).toBe(teamB.teamObjectId)
  expect(left.searchParams.get("teamObjectId")).toBe(teamA.teamObjectId)
  expect(right.searchParams.get("teamObjectId")).toBe(teamA.teamObjectId)
  expect(changed && teamNavigationURL(changed, binding, teamA)?.href).toBe(left.href)
  expect(changed?.searchParams.size).toBe(5)
  expect(changed?.searchParams.has("principalRef")).toBe(false)
  expect(changed?.searchParams.has("accessRevision")).toBe(false)
  const foreign = Schema.decodeUnknownSync(TeamProfile.Ref)({ ...teamA, installationId: "foreign" })
  expect(teamNavigationURL(left, binding, foreign)).toBeUndefined()
})

test("native new-chat and Session ID paths require complete same-origin Team intent across login return URLs", () => {
  for (const id of [undefined, Session.ID.create()]) {
    const url = teamSessionNavigationURL(binding, teamA, id)
    expect(url).toBeDefined()
    if (!url) throw new Error("Expected supported Session URL")
    expect(url.pathname).toBe("/orchestra/sf-sessions/" + (id ?? "new"))
    expect(url.searchParams.size).toBe(5)
    expect(readTeamNavigationIntent(url, binding)).toEqual({
      contractRevision: "sf-team-profile/1", kind: "team", profile: teamA,
    })
    expect(readTeamSessionNavigation(url, binding)).toEqual({
      kind: "session", profile: teamA, ...(id ? { sessionID: id } : {}),
    })
    expect(teamNavigationReturnTo(url, binding)).toBe(url.pathname + url.search)
    expect(readTeamNavigationIntent(new URL(url.pathname, binding.publicOrigin), binding)).toBeUndefined()
    const invalid: URL[] = []
    for (const key of ["contractRevision", "server", "installationId", "tenantId", "teamObjectId"]) {
      const partial = new URL(url); partial.searchParams.delete(key); invalid.push(partial)
      const duplicate = new URL(url); duplicate.searchParams.append(key, duplicate.searchParams.get(key)!); invalid.push(duplicate)
    }
    for (const [key, value] of [
      ["server", "https://foreign.example.test"], ["installationId", "foreign"],
      ["tenantId", "21111111-2222-4333-8444-555555555555"], ["principalObjectId", "injected"],
      ["authorityGeneration", "1"], ["directory", "/technical"],
    ]) {
      const foreign = new URL(url); foreign.searchParams.set(key!, value!); invalid.push(foreign)
    }
    const foreignOrigin = new URL(url); foreignOrigin.hostname = "foreign.example.test"; invalid.push(foreignOrigin)
    const fragment = new URL(url); fragment.hash = "ignored"; invalid.push(fragment)
    invalid.push(new URL(url.href.replace("installation-one", "installation%")))
    invalid.push(new URL(url.href + "&installation%49d=installation-one"))
    for (const candidate of invalid) {
      expect(readTeamNavigationIntent(candidate, binding)).toBeUndefined()
      expect(readTeamSessionNavigation(candidate, binding)).toBeUndefined()
      expect(teamNavigationReturnTo(candidate, binding)).toBeUndefined()
    }
  }
  const valid = teamSessionNavigationURL(binding, teamA, "ses_url")!
  for (const path of ["/orchestra/sf-sessions/other", "/orchestra/sf-sessions/new/",
    "/orchestra/sf-sessions/ses_a%2Fb", "/orchestra/sf-sessions/ses_a%5Cb", "/orchestra/sf-sessions/ses_a/extra"]) {
    const invalid = new URL(valid); invalid.pathname = path
    expect(readTeamNavigationIntent(invalid, binding)).toBeUndefined()
    expect(teamNavigationReturnTo(invalid, binding)).toBeUndefined()
  }
  expect(teamSessionNavigationURL(binding, teamA, "../sf-home")).toBeUndefined()
  const foreign = Schema.decodeUnknownSync(TeamProfile.Ref)({ ...teamA, installationId: "foreign" })
  expect(teamSessionNavigationURL(binding, foreign)).toBeUndefined()
})
