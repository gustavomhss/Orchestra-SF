import { expect, test } from "bun:test"
import { Schema } from "effect"
import { ConnectionAccess } from "../src/connection-access"

test("connection access accepts only explicit verbs, closed personal resources and revisioned commands", () => {
  const key = { category: "integration", resourceId: "synthetic-provider", id: "personal-id" }
  const input = { key, label: "Personal", encodedValue: '{"secret":"synthetic"}', expectedRevision: 0, action: "create" }
  expect(Schema.decodeUnknownSync(ConnectionAccess.Write)(input)).toEqual(input)
  expect(Schema.is(ConnectionAccess.Write)({ ...input, action: "admin" })).toBe(false)
  expect(Schema.is(ConnectionAccess.Write)({ ...input, expectedRevision: -1 })).toBe(false)
  expect(Schema.is(ConnectionAccess.Write)({ ...input, expectedRevision: 1.5 })).toBe(false)
  expect(Schema.is(ConnectionAccess.Write)({ ...input, owner: {} })).toBe(false)
  expect(Schema.is(ConnectionAccess.Key)({ ...key, tenantId: "client-supplied" })).toBe(false)
  expect(Schema.is(ConnectionAccess.Key)({ ...key, category: "global" })).toBe(false)
  expect(Schema.is(ConnectionAccess.Key)({ ...key, resourceId: " provider " })).toBe(false)
  expect(Schema.is(ConnectionAccess.Key)({ ...key, id: "line\nbreak" })).toBe(false)
  expect(Schema.is(ConnectionAccess.Resources)([key])).toBe(false)
  expect(Schema.is(ConnectionAccess.Resources)([{ category: key.category, resourceId: key.resourceId }])).toBe(true)
  expect(Schema.is(ConnectionAccess.Resources)(Array.from({ length: 2 }, () => ({ category: key.category, resourceId: key.resourceId })))).toBe(false)
  expect(Schema.is(ConnectionAccess.Remove)({ key, expectedRevision: 0 })).toBe(false)
})

test("connection metadata cannot carry secret values or authority labels", () => {
  const metadata = { key: { category: "mcp", resourceId: "synthetic-server", id: "primary" }, label: "Personal", revision: 1, state: "active" }
  expect(Schema.decodeUnknownSync(ConnectionAccess.Metadata)(metadata)).toEqual(metadata)
  expect(Schema.is(ConnectionAccess.Metadata)({ ...metadata, encodedValue: '{"secret":"no"}' })).toBe(false)
  expect(Schema.is(ConnectionAccess.Metadata)({ ...metadata, owner: {} })).toBe(false)
  expect(Schema.is(ConnectionAccess.Metadata)({ ...metadata, revision: Number.MAX_SAFE_INTEGER + 1 })).toBe(false)
})
