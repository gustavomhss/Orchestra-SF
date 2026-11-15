import { expect, test } from "bun:test"
import { Schema, SchemaAST } from "effect"
import {
  SfInstallationQuery,
  SfInstallationSelector,
} from "../../../../../packages/schema/src/sucafina/context.ts"
import {
  SfInvalidInstallationSelector,
  parseSfInstallationSelector,
  readSfInstallations,
  type SfTrustedInstallationSource,
} from "../../../../../packages/server/src/sucafina-installations.ts"

const discoveryUrl = (query: string) => `https://selected.example/api/sucafina/installations?${query}`

test("SDK discovery query has the exact top-level Struct fields required by the real generator", () => {
  // Matches tooling/httpapi-codegen's inputFields: Schema.toType(schema).ast
  // must be Objects with no index signatures, not a top-level discriminated Union.
  const ast = Schema.toType(SfInstallationQuery).ast
  expect(SchemaAST.isObjects(ast)).toBe(true)
  if (!SchemaAST.isObjects(ast)) throw new Error("Discovery query must remain a Struct")
  expect(ast.indexSignatures).toHaveLength(0)
  expect(ast.propertySignatures.map((field) => field.name)).toEqual([
    "select", "installationId", "projectId", "location",
  ])
  expect(Schema.is(SfInstallationQuery)({
    select: "ids", installationId: "installation-A", projectId: "project-A",
  })).toBe(true)
  expect(Schema.is(SfInstallationQuery)({
    select: "location", location: { directory: "/work/a", workspace: "workspace-A" },
  })).toBe(true)
  expect(Schema.is(SfInstallationQuery)({ select: "other" })).toBe(false)
  // HTTP DTO is a Struct for codegen; semantic selection remains discriminated.
  expect(Schema.is(SfInstallationSelector)({
    select: "ids", installationId: "installation-A", projectId: "project-A",
  })).toBe(true)
  expect(Schema.is(SfInstallationSelector)({ select: "ids", location: { directory: "/work/a" } })).toBe(false)
})

test("raw URL parser retains both exact wire branches and rejects partial/mixed/duplicate/unknown selectors", () => {
  expect(parseSfInstallationSelector(discoveryUrl(
    "select=ids&installationId=installation-A&projectId=project-A",
  ))).toEqual({ select: "ids", installationId: "installation-A", projectId: "project-A" })
  expect(parseSfInstallationSelector(discoveryUrl(
    "select=location&location%5Bdirectory%5D=%2Fwork%2Fa",
  ))).toEqual({ select: "location", location: { directory: "/work/a" } })
  expect(parseSfInstallationSelector(discoveryUrl(
    "select=location&location%5Bdirectory%5D=%2Fwork%2Fa&location%5Bworkspace%5D=workspace-A",
  ))).toEqual({ select: "location", location: { directory: "/work/a", workspace: "workspace-A" } })

  const invalid = [
    "select=ids&installationId=installation-A",
    "select=ids&installationId=installation-A&projectId=",
    "select=ids&installationId=installation-A&projectId=project-A&hostId=host-B",
    "select=ids&installationId=installation-A&projectId=project-A&location%5Bdirectory%5D=%2Fwork%2Fb",
    "select=ids&installationId=installation-A&projectId=project-A&projectId=project-B",
    "select=ids&installationId=installation-A&projectId=project-A&unknown=x",
    "select=location&location%5Bworkspace%5D=workspace-A",
    "select=location&location%5Bdirectory%5D=%2Fwork%2Fa&projectId=project-B",
    "select=location&location%5Bdirectory%5D=%2Fwork%2Fa&location%5Bworkspace%5D=",
    "select=location&location%5Bdirectory%5D=%2Fwork%2Fa&location%5Bdirectory%5D=%2Fwork%2Fb",
    "select=ids&installationId=%&projectId=project-A",
    "select=other&installationId=installation-A&projectId=project-A",
  ]
  for (const query of invalid) {
    expect(() => parseSfInstallationSelector(discoveryUrl(query))).toThrow(SfInvalidInstallationSelector)
  }
})

test("IDs discovery compares only the selected already-loaded runtime and never consults Location", async () => {
  const calls = { current: 0, location: 0 }
  const runtime = {
    publicOrigin: "http://localhost:4096",
    mount: "/modules/Sucafinav1",
    authMode: "local-operator" as const,
    identity: () => ({
      installationId: "installation-B",
      projectId: "project-B",
      hostId: "host-B",
    }),
  }
  const source: SfTrustedInstallationSource = {
    current: async () => { calls.current++; return runtime },
    forAdmittedLocation: async () => { calls.location++; throw new Error("Location is not permitted for select=ids") },
  }
  const signal = new AbortController().signal
  const other = parseSfInstallationSelector(discoveryUrl(
    "select=ids&installationId=installation-A&projectId=project-A",
  ))
  expect(await readSfInstallations(source, other, signal)).toEqual({ installations: [] })
  const own = parseSfInstallationSelector(discoveryUrl(
    "select=ids&installationId=installation-B&projectId=project-B",
  ))
  expect(await readSfInstallations(source, own, signal)).toEqual({
    installations: [{
      installationId: "installation-B",
      projectId: "project-B",
      hostId: "host-B",
      publicOrigin: "http://localhost:4096",
      mount: "/modules/Sucafinav1",
      contractRevision: "sf-native-ui/1",
      authMode: "local-operator",
    }],
  })
  expect(calls).toEqual({ current: 2, location: 0 })
})

test("Location discovery uses only the admitted resolver with its exact directory/workspace", async () => {
  const calls: Array<{ directory: string; workspace?: string }> = []
  const source: SfTrustedInstallationSource = {
    current: async () => { throw new Error("Current is not permitted for select=location") },
    forAdmittedLocation: async (location) => { calls.push(location); return [] },
  }
  const selector = parseSfInstallationSelector(discoveryUrl(
    "select=location&location%5Bdirectory%5D=%2Fwork%2Fa&location%5Bworkspace%5D=workspace-A",
  ))
  expect(await readSfInstallations(source, selector, new AbortController().signal)).toEqual({ installations: [] })
  expect(calls).toEqual([{ directory: "/work/a", workspace: "workspace-A" }])
})
