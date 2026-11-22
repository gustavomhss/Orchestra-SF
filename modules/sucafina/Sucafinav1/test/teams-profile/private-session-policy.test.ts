import { expect, test } from "bun:test"
import { SessionAccess } from "@orchestra/schema/session-access"
import { emptyMap } from "../../src/identity.ts"
import { teamSessionPolicy } from "../../runtime/team-session-policy.ts"
import { group, principalId } from "./admin-policy-fixture.ts"

const groups = { dashboard: { viewer: "group:" + group }, planner: {}, procurement: {} }
const grant = { principalRef: principalId, namespaces: [], operations: [] }

test("private-session-policy: omitted capabilities are empty, frozen and independent of all existing business roles", () => {
  const before = emptyMap()
  const policy = teamSessionPolicy({ groups, grants: [grant] })
  expect(policy.grants).toEqual([{
    ...grant, humanActions: [], sessionActions: [], referenceActions: [], migrationActions: [],
    connectionActions: [], connectionResources: [], providerBindings: [],
  }])
  expect(emptyMap()).toEqual(before)
  expect(before).toHaveLength(15)
  for (const value of [policy.groups, policy.groups.dashboard, policy.grants, policy.grants[0],
    policy.grants[0]?.sessionActions, policy.grants[0]?.connectionResources, policy.grants[0]?.providerBindings])
    expect(Object.isFrozen(value)).toBe(true)
})

test("private-session-policy: current explicit action sets normalize without accepting aliases or duplicate permissions", () => {
  const policy = teamSessionPolicy({ groups, grants: [{
    ...grant, sessionActions: SessionAccess.Actions.toReversed(), referenceActions: ["list"],
    migrationActions: ["recover", "map", "cut"], connectionActions: ["remove", "read", "create", "update"],
    connectionResources: [{ category: "integration", resourceId: "synthetic-provider" }],
  }] })
  expect(policy.grants[0]?.sessionActions).toEqual([...SessionAccess.Actions].toSorted())
  expect(policy.grants[0]?.migrationActions).toEqual(["cut", "map", "recover"])
  const invalid: readonly [string, unknown][] = [
    ["sessionActions", null], ["sessionActions", "read"], ["sessionActions", ["read", "read"]],
    ["sessionActions", ["Read"]], ["sessionActions", ["replay"]], ["referenceActions", ["write"]],
    ["migrationActions", ["restore"]], ["connectionActions", ["all"]], ["connectionActions", ["read", "read"]],
    ["connectionResources", [{ category: "integration", resourceId: "*" }, { category: "integration", resourceId: "*" }]],
    ["connectionResources", [{ category: "integration", resourceId: "provider", owner: principalId }]],
    ["providerBindings", null], ["wildcard", true],
  ]
  for (const [key, value] of invalid)
    expect(() => teamSessionPolicy({ groups, grants: [{ ...grant, [key]: value }] })).toThrow()
})

test("private-session-policy: duplicate principals, unknown roles and nonimmutable group aliases fail closed", () => {
  expect(() => teamSessionPolicy({ groups, grants: [grant, { ...grant, principalRef: principalId.toUpperCase() }] })).toThrow()
  expect(() => teamSessionPolicy({ groups, grants: [{ ...grant, principalRef: "local:admin" }] })).toThrow()
  expect(() => teamSessionPolicy({ groups: { ...groups, dashboard: { administrator: "group:" + group } }, grants: [grant] })).toThrow()
  expect(() => teamSessionPolicy({ groups: { ...groups, dashboard: { viewer: "Finance" } }, grants: [grant] })).toThrow()
  expect(() => teamSessionPolicy({ groups: { dashboard: {}, planner: {} }, grants: [grant] })).toThrow()
  expect(() => teamSessionPolicy({ groups: { ...groups, teams: {} }, grants: [grant] })).toThrow()
})

test("private-session-policy: minimal checkpoint and recovery grants remain independent and confer no Session or business authority", () => {
  const scenarios = [
    { input: ["checkpoint"], expected: ["checkpoint"] },
    { input: ["recover"], expected: ["recover"] },
    { input: ["recover", "checkpoint"], expected: ["checkpoint", "recover"] },
  ] as const
  for (const scenario of scenarios) {
    const policy = teamSessionPolicy({ groups, grants: [{
      principalRef: principalId, migrationActions: scenario.input,
    }] })
    const actual = policy.grants[0]
    expect(actual).toEqual({
      principalRef: principalId, namespaces: [], operations: [], humanActions: [],
      sessionActions: [], referenceActions: [], migrationActions: scenario.expected,
      connectionActions: [], connectionResources: [], providerBindings: [],
    })
    expect(Object.isFrozen(actual)).toBe(true)
    for (const key of ["namespaces", "operations", "humanActions", "sessionActions", "referenceActions",
      "migrationActions", "connectionActions", "connectionResources", "providerBindings"] as const)
      expect(Object.isFrozen(actual?.[key])).toBe(true)
  }
  expect(teamSessionPolicy({ groups, grants: [{ principalRef: principalId }] }).grants)
    .toEqual(teamSessionPolicy({ groups, grants: [grant] }).grants)
})

test("private-session-policy: checkpoint aliases and malformed optional authority remain rejected", () => {
  const minimal = { principalRef: principalId, migrationActions: ["checkpoint"] }
  const invalid: readonly [string, unknown][] = [
    ["migrationActions", ["checkpoint", "checkpoint"]], ["migrationActions", ["Checkpoint"]],
    ["migrationActions", ["backup"]], ["migrationActions", ["*"]], ["migrationActions", null],
    ["namespaces", null], ["namespaces", "documents"], ["namespaces", ["documents", "documents"]],
    ["operations", null], ["operations", "sf_import_apply"], ["operations", ["*"]],
    ["sessionActions", ["checkpoint"]], ["humanActions", ["checkpoint"]],
  ]
  for (const [key, value] of invalid)
    expect(() => teamSessionPolicy({ groups, grants: [{ ...minimal, [key]: value }] })).toThrow()
})
