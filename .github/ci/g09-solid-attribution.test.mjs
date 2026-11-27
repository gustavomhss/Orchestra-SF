import { expect, test } from "bun:test"
import {
  exactPoint, identifierSpan, mapPoints, offsetAt, parseIdentifiers, sha256,
  solidToolchain, verifyHash, verifyMappedSource,
} from "./g09-recover-solid.mjs"

if (!process.env.G09_CANDIDATE) throw new Error("G09_CANDIDATE is required; use the pinned installed checkout")
const toolchain = await solidToolchain(process.env.G09_CANDIDATE)

test("exact map lookup accepts both literal boundaries and never interpolates a missing endpoint", () => {
  const complete = mapPoints("AAAA,QAAQ")
  expect(exactPoint(complete, 0, 0, [0, 0, 0])).toBe(true)
  expect(exactPoint(complete, 0, 8, [0, 0, 8])).toBe(true)
  const missing = mapPoints("AAAA,SAAS")
  expect(exactPoint(missing, 0, 8, [0, 0, 8])).toBe(false)
})

test("a point at the literal end with another source coordinate does not qualify", () => {
  expect(exactPoint(mapPoints("AAAA,QAAC"), 0, 8, [0, 0, 8])).toBe(false)
  expect(exactPoint(mapPoints("AAAA,QAAQ"), 0, 8, [1, 0, 8])).toBe(false)
})

test("an unmapped segment at the same coordinate prevents an ambiguous attribution", () => {
  expect(exactPoint(mapPoints("AAAA,QAAQ,A"), 0, 8, [0, 0, 8])).toBe(false)
})

test("malformed source-map segments fail closed", () => {
  expect(() => mapPoints("g")).toThrow("G09_MAP_SEGMENT_INVALID")
  expect(() => mapPoints("!")).toThrow("G09_MAP_VLQ_INVALID")
})

test("real Babel identifier ranges distinguish a complete token from its matching prefix", () => {
  const text = "const worktreeSuffix = 1; const worktree = 2"
  const bytes = Buffer.from(text)
  const identifiers = parseIdentifiers(toolchain.babel, text)
  expect(() => identifierSpan(bytes, identifiers, bytes.indexOf("worktree"), "worktree"))
    .toThrow("G09_IDENTIFIER_TOKEN_BOUNDARY_DIFFER")
  const span = identifierSpan(bytes, identifiers, bytes.lastIndexOf("worktree"), "worktree")
  expect(span.byteEnd - span.byteStart).toBe(8)
})

test("UTF-8 byte offsets are converted to UTF-16 parser coordinates without ASCII assumptions on preceding text", () => {
  const text = "const café = '😀'; const worktree = 2"
  const bytes = Buffer.from(text)
  const span = identifierSpan(bytes, parseIdentifiers(toolchain.babel, text), bytes.indexOf("worktree"), "worktree")
  expect(span.byteStart).toBeGreaterThan(span.utf16Start)
  expect(text.slice(span.utf16Start, span.utf16End)).toBe("worktree")
  expect(bytes.subarray(span.byteStart, span.byteEnd).toString()).toBe("worktree")
})

test("substring text in a string literal is not accepted as an identifier", () => {
  const text = "const value = 'worktree'"
  const bytes = Buffer.from(text)
  expect(() => identifierSpan(bytes, parseIdentifiers(toolchain.babel, text), bytes.indexOf("worktree"), "worktree"))
    .toThrow("G09_IDENTIFIER_TOKEN_BOUNDARY_DIFFER")
})

test("raw JSX attribute names have exact JSXIdentifier bounds distinct from their expression values", () => {
  const text = "const jsx = <DialogMoveSession projectID={projectID} />"
  const bytes = Buffer.from(text)
  const identifiers = parseIdentifiers(toolchain.babel, text, true)
  const attribute = identifierSpan(bytes, identifiers, bytes.indexOf("projectID"), "projectID")
  const expression = identifierSpan(bytes, identifiers, bytes.lastIndexOf("projectID"), "projectID")
  expect(attribute.astNodeTypes).toEqual(["JSXIdentifier"])
  expect(expression.astNodeTypes).toEqual(["Identifier"])
  expect(attribute.byteEnd - attribute.byteStart).toBe(9)
})

test("JSX identifier support rejects matching prefixes and attribute string contents", () => {
  const text = 'const jsx = <DialogMoveSession projectIDSuffix="projectID" />'
  const bytes = Buffer.from(text)
  const identifiers = parseIdentifiers(toolchain.babel, text, true)
  expect(() => identifierSpan(bytes, identifiers, bytes.indexOf("projectID"), "projectID"))
    .toThrow("G09_IDENTIFIER_TOKEN_BOUNDARY_DIFFER")
  expect(() => identifierSpan(bytes, identifiers, bytes.lastIndexOf("projectID"), "projectID"))
    .toThrow("G09_IDENTIFIER_TOKEN_BOUNDARY_DIFFER")
})

test("source-map coordinates outside the actual intermediate are rejected", () => {
  expect(() => offsetAt("x\nz", 1, 2)).toThrow("G09_SOURCE_COORDINATE_INVALID")
  expect(() => offsetAt("x\nz", 2, 0)).toThrow("G09_SOURCE_COORDINATE_INVALID")
})

test("modified intermediate bytes cannot use an original intermediate hash", () => {
  const expected = sha256(Buffer.from("const worktree = 1"))
  expect(() => verifyHash(Buffer.from("const worktree = 2"), expected, "intermediate"))
    .toThrow("G09_HASH_MISMATCH")
})

test("supplementary Babel maps must bind exactly one original filename and its exact source bytes", () => {
  const correct = { version: 3, sources: ["/fixed/a.tsx"], sourcesContent: ["const worktree = 1"] }
  expect(() => verifyMappedSource(correct, "/fixed/a.tsx", "const worktree = 1")).not.toThrow()
  expect(() => verifyMappedSource({ ...correct, sources: ["/other/a.tsx"] }, "/fixed/a.tsx", "const worktree = 1"))
    .toThrow("G09_BABEL_SOURCE_BINDING_DIFFER")
  expect(() => verifyMappedSource(correct, "/fixed/a.tsx", "const worktree = 2"))
    .toThrow("G09_BABEL_SOURCE_BINDING_DIFFER")
})
