import { expect, test } from "bun:test"
import { Schema } from "effect"
import { SfTeamInstallationDescriptor } from "@orchestra/schema/sucafina/context"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import { readTeamNavigationIntent, teamNavigationReturnTo, teamNavigationURL } from "../src/context/team-profile-navigation"

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

test("only the three supported same-origin Team entry paths carry a closed selection or Team intent", () => {
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
  for (const pathname of ["/orchestra/sf-home/administration", "/orchestra/sf-sessions/new", "/orchestra/sf-home/", "/unknown"]) {
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
