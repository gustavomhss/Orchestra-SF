/** Controls of the concrete adapter's admission decisions, not live host/identity attestations. */
import { expect, test } from "bun:test"
import { decodeOriginalCurrentInstallation, requireObservedActorIndices, chooseOriginalSourceRow } from "./host-adapter.ts"
import { parseRegistrationArguments, validateU15RegisteredEnvironment } from "./execute-registration.ts"
import { validateNativeTarget } from "../../../../packages/app-shell/e2e/sucafina/native/fixture/manifest-contract.ts"

const actors = { requester: "33333333-3333-4333-8333-333333333333", holder: "44444444-4444-4444-8444-444444444444",
  denied: "55555555-5555-4555-8555-555555555555", dashboardAdmin: "66666666-6666-4666-8666-666666666666" }
const target = validateNativeTarget({ serverKey: "https://native.example.test", discoveryOrigin: "https://native.example.test",
  shellOrigin: "https://native.example.test", publicOrigin: "https://native.example.test", installationId: "metadata-only",
  tenantId: "11111111-1111-4111-8111-111111111111", teamObjectId: "22222222-2222-4222-8222-222222222222",
  projectId: "technical-only", hostId: "host-only", mount: "/sucafina",
  chapterHref: "/orchestra/sf-procurement/contracts?" + new URLSearchParams({ contractRevision: "sf-team-profile/1",
    server: "https://native.example.test", installationId: "metadata-only",
    tenantId: "11111111-1111-4111-8111-111111111111", teamObjectId: "22222222-2222-4222-8222-222222222222" }) })
const descriptor = { contractRevision: "sf-team-profile/1", authMode: "microsoft", installationId: target.installationId,
  tenantId: target.tenantId, projectId: target.projectId, hostId: target.hostId, publicOrigin: target.publicOrigin, mount: target.mount } as const
test("adapter accepts only the original single current Microsoft descriptor with complete reserved placement", () => {
  expect(decodeOriginalCurrentInstallation({ installations: [descriptor] }, target)).toEqual(descriptor)
  for (const field of ["installationId", "tenantId", "projectId", "hostId", "publicOrigin", "mount", "authMode"] as const)
    expect(() => decodeOriginalCurrentInstallation({ installations: [{ ...descriptor, [field]: "different" }] }, target)).toThrow()
  expect(() => decodeOriginalCurrentInstallation({ installations: [] }, target)).toThrow()
  expect(() => decodeOriginalCurrentInstallation({ installations: [descriptor, descriptor] }, target)).toThrow()
  expect(() => decodeOriginalCurrentInstallation({ installations: [descriptor], approved: true }, target)).toThrow()
})
test("four actors require four observed Microsoft contexts and refuse missing, duplicated or reused context", () => {
  const observed = Object.values(actors).map((principalRef) => ({ principalRef, microsoft: true, context: {} }))
  expect(requireObservedActorIndices(actors, observed)).toEqual({ requester: 0, holder: 1, denied: 2, dashboardAdmin: 3 })
  expect(() => requireObservedActorIndices(actors, observed.slice(0, 3))).toThrow()
  expect(() => requireObservedActorIndices(actors, [...observed, observed[0]!])).toThrow()
  expect(() => requireObservedActorIndices(actors, observed.map((row) => ({ ...row, context: observed[0]!.context })))).toThrow()
  expect(() => requireObservedActorIndices(actors, observed.map((row, index) => ({ ...row, microsoft: index !== 2 })))).toThrow()
  expect(() => requireObservedActorIndices({ ...actors, holder: actors.requester }, observed)).toThrow()
})
test("source selection follows exact rendered producer IDs and original CAS, never a label or table index", () => {
  const rows = [{ id: "private-a", vendor: "Original A" }, { id: 7, vendor: "Original B" }]
  const versions = { "contracts:private-a": 8, "contracts:7": 3 }
  expect(chooseOriginalSourceRow(rows, versions, ["missing", "7", "private-a"], "CAP14"))
    .toEqual({ recordId: "7", label: "Original B", version: 3, versionKey: "contracts:7" })
  expect(() => chooseOriginalSourceRow(rows, versions, ["Original A", "0"], "CAP14")).toThrow()
  expect(() => chooseOriginalSourceRow(rows, versions, ["private-a", "private-a"], "CAP14")).toThrow()
  expect(() => chooseOriginalSourceRow([...rows, rows[0]!], versions, ["private-a"], "CAP14")).toThrow()
  expect(() => chooseOriginalSourceRow(rows, {}, ["private-a"], "CAP14")).toThrow()
})
test("ambiguous vendor and invalid version cannot select a U15 edit target or a budget source", () => {
  for (const version of [-1, 1.5, "1", null, undefined])
    expect(() => chooseOriginalSourceRow([{ id: "x", vendor: "Vendor" }], { "contracts:x": version }, ["x"], "CAP14")).toThrow()
  expect(() => chooseOriginalSourceRow([{ id: "x", vendor: "Vendor" }, { id: "y", vendor: "Vendor" }],
    { "contracts:x": 1, "contracts:y": 2 }, ["x", "y"], "CAP14")).toThrow()
  expect(chooseOriginalSourceRow([{ id: "line", name: "Actual line" }], { "opexOwners:line": 4 }, ["line"], "CAP04").version).toBe(4)
  expect(() => chooseOriginalSourceRow([{ id: "line", name: "Actual line" }],
    { "opexOwners:line": 4 }, ["line"], "CAP05")).toThrow()
})
test("registration CLI has only four explicit kinds and cannot load an adapter, command or environment file", () => {
  for (const kind of ["U15", "U39", "U40", "F04"] as const) expect(parseRegistrationArguments([kind])).toBe(kind)
  for (const args of [[], ["u15"], ["ALL"], ["U15", "extra"], ["--adapter", "/tmp/code.ts"], ["F04; echo bad"]])
    expect(() => parseRegistrationArguments(args)).toThrow()
})
test("U15 environment exposes only the five URLs already registered and rejects extra executable values", () => {
  // This function does not admit a manifest; the real CLI first consumes the complete original selected installation.
  const selection = { suite: "U15" as const, selections: (["list", "editable", "denied", "stale", "lost"] as const).map((caseId) => ({
    caseId, href: "https://native.example.test/observed-" + caseId,
  })) }
  const expected = { SF_NATIVE_U15_LIST_URL: selection.selections[0]!.href,
    SF_NATIVE_U15_EDIT_URL: selection.selections[1]!.href, SF_NATIVE_U15_DENIED_URL: selection.selections[2]!.href,
    SF_NATIVE_U15_STALE_URL: selection.selections[3]!.href, SF_NATIVE_U15_LOST_RESPONSE_URL: selection.selections[4]!.href }
  expect(validateU15RegisteredEnvironment(expected, selection)).toEqual(expected)
  expect(() => validateU15RegisteredEnvironment({ ...expected, NODE_OPTIONS: "--import=/tmp/code.mjs" }, selection)).toThrow()
  expect(() => validateU15RegisteredEnvironment({ ...expected, SF_NATIVE_U15_EDIT_URL: "https://foreign.example.test" }, selection)).toThrow()
  expect(() => validateU15RegisteredEnvironment({}, selection)).toThrow()
  expect(() => validateU15RegisteredEnvironment(JSON.stringify(expected), selection)).toThrow()
})
