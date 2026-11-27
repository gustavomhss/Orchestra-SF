import { expect, test } from "bun:test"
import { solidToolchain, identifierSpan, parseIdentifiers } from "./g09-recover-solid.mjs"
import { semanticTree, linkSemanticTrees, originForToken, firstSemanticDifference } from "./g09-solid-origin.mjs"
import { createRequire } from "node:module"

if (!process.env.G09_CANDIDATE) throw new Error("G09_CANDIDATE is required")
const toolchain = await solidToolchain(process.env.G09_CANDIDATE)
const require = createRequire(toolchain.transform)
const coreRequire = createRequire(require.resolve("@babel/core"))
const fields = coreRequire("@babel/types").NODE_FIELDS
const parse = (text) => toolchain.babel.parseSync(text, { configFile: false, babelrc: false, sourceType: "module" })

test("ordinary rvalue parentheses preserve the projected structure", () => {
  const left = parse("const object = (alpha)")
  const right = parse("const object = alpha")
  expect(() => linkSemanticTrees(left, right, fields)).not.toThrow()
})

test("module topLevelAwait is a required boolean and remains part of semantic equality", () => {
  const left = parse("const x = alpha")
  const right = parse("const x = alpha")
  right.program.extra.topLevelAwait = !left.program.extra.topLevelAwait
  expect(() => linkSemanticTrees(left, right, fields)).toThrow("G09_ORIGIN_SEMANTIC_TREE_DIFFER")
  for (const value of [0, "false", null]) {
    const item = parse("const x = alpha")
    item.program.extra.topLevelAwait = value
    expect(() => semanticTree(item, fields)).toThrow("G09_ORIGIN_TOP_LEVEL_AWAIT_TYPE")
  }
  const missing = parse("const x = alpha")
  delete missing.program.extra.topLevelAwait
  expect(() => semanticTree(missing, fields)).toThrow("G09_ORIGIN_TOP_LEVEL_AWAIT_FLAG_REQUIRED")
})

test("topLevelAwait metadata is accepted only on a module Program", () => {
  const wrongNode = parse("const x = alpha")
  wrongNode.program.body[0].declarations[0].init.extra = { topLevelAwait: false }
  expect(() => semanticTree(wrongNode, fields)).toThrow("G09_ORIGIN_TOP_LEVEL_AWAIT_CONTEXT")
  const wrongMode = parse("const x = alpha")
  wrongMode.program.sourceType = "script"
  expect(() => semanticTree(wrongMode, fields)).toThrow("G09_ORIGIN_TOP_LEVEL_AWAIT_CONTEXT")
})

test("legacy method and null id fields have only their type-specific parser meaning", () => {
  const left = parse("const object = { key: 1, method() {}, get value() { return 1 }, set value(x) {} }; const arrow = () => 1")
  const right = parse("const object = { key: 1, method() {}, get value() { return 1 }, set value(x) {} }; const arrow = () => 1")
  for (const property of right.program.body[0].declarations[0].init.properties) {
    delete property.method
    delete property.id
  }
  delete right.program.body[1].declarations[0].init.id
  expect(() => linkSemanticTrees(left, right, fields)).not.toThrow()
  for (const replacement of [true, "false", null]) {
    const item = parse("const object = { key: 1 }")
    item.program.body[0].declarations[0].init.properties[0].method = replacement
    expect(() => semanticTree(item, fields)).toThrow("G09_ORIGIN_LEGACY_METHOD_DIFFER")
  }
  for (const source of ["const object = { method() {} }", "const object = { get value() {} }"]) {
    const item = parse(source)
    const method = item.program.body[0].declarations[0].init.properties[0]
    method.method = method.kind !== "method"
    expect(() => semanticTree(item, fields)).toThrow("G09_ORIGIN_LEGACY_METHOD_DIFFER")
  }
  const named = parse("const arrow = () => 1")
  named.program.body[0].declarations[0].init.id = parse("name").program.body[0].expression
  expect(() => semanticTree(named, fields)).toThrow("G09_ORIGIN_UNSUPPORTED_FUNCTION_ID")
})

test("legacy shorthand metadata must agree with the compared property flag", () => {
  const left = parse("const object = { projectID }")
  const right = parse("const object = { projectID }")
  delete right.program.body[0].declarations[0].init.properties[0].extra.shorthand
  expect(() => linkSemanticTrees(left, right, fields)).not.toThrow()
  const contradictory = parse("const object = { projectID: projectID }")
  contradictory.program.body[0].declarations[0].init.properties[0].extra = { shorthand: true }
  expect(() => semanticTree(contradictory, fields)).toThrow("G09_ORIGIN_LEGACY_SHORTHAND_DIFFER")
  const wrongType = parse("const object = { projectID }")
  wrongType.program.body[0].declarations[0].init.properties[0].extra.shorthand = "true"
  expect(() => semanticTree(wrongType, fields)).toThrow("G09_ORIGIN_LEGACY_SHORTHAND_DIFFER")
})

test("ordinary module kind has only the three documented value/null equivalences", () => {
  const source = 'import { item } from "pkg"; export const value = item'
  const left = parse(source)
  const right = parse(source)
  left.program.body[0].importKind = "value"
  left.program.body[0].specifiers[0].importKind = "value"
  left.program.body[1].exportKind = "value"
  expect(() => linkSemanticTrees(left, right, fields)).not.toThrow()
  for (const kind of ["type", "typeof"]) {
    for (const specifier of [false, true]) {
      const item = parse(source)
      const node = specifier ? item.program.body[0].specifiers[0] : item.program.body[0]
      node.importKind = kind
      expect(() => linkSemanticTrees(item, parse(source), fields)).toThrow("G09_ORIGIN_SEMANTIC_TREE_DIFFER")
    }
  }
  const typeExport = parse(source)
  typeExport.program.body[1].exportKind = "type"
  expect(() => linkSemanticTrees(typeExport, parse(source), fields)).toThrow("G09_ORIGIN_SEMANTIC_TREE_DIFFER")
  const invalidImport = parse(source)
  invalidImport.program.body[0].importKind = false
  expect(() => semanticTree(invalidImport, fields)).toThrow("G09_ORIGIN_IMPORT_KIND_INVALID")
  const invalidExport = parse(source)
  invalidExport.program.body[1].exportKind = "typeof"
  expect(() => semanticTree(invalidExport, fields)).toThrow("G09_ORIGIN_EXPORT_KIND_INVALID")
})

test("module normalization does not extend to other node types or fields", () => {
  const all = parse('export * from "pkg"')
  all.program.body[0].exportKind = "value"
  expect(() => linkSemanticTrees(all, parse('export * from "pkg"'), fields)).toThrow("G09_ORIGIN_SEMANTIC_TREE_DIFFER")
  const specifier = parse("const item = 1; export { item }")
  specifier.program.body[1].specifiers[0].exportKind = "value"
  expect(() => linkSemanticTrees(specifier, parse("const item = 1; export { item }"), fields))
    .toThrow("G09_ORIGIN_SEMANTIC_TREE_DIFFER")
  const named = parse("export const item = 1")
  named.program.body[0].attributes = null
  expect(() => linkSemanticTrees(named, parse("export const item = 1"), fields)).toThrow("G09_ORIGIN_SEMANTIC_TREE_DIFFER")
  const wrongNode = parse("const item = 1")
  wrongNode.program.body[0].declarations[0].importKind = "value"
  expect(() => semanticTree(wrongNode, fields)).toThrow("G09_ORIGIN_UNKNOWN_FIELD")
})

test("only empty ImportDeclaration attributes are equivalent to null", () => {
  const source = 'import data from "pkg"'
  const empty = parse(source)
  empty.program.body[0].attributes = null
  expect(() => linkSemanticTrees(empty, parse(source), fields)).not.toThrow()
  expect(() => linkSemanticTrees(parse(source), parse('import data from "pkg" with { type: "json" }'), fields))
    .toThrow("G09_ORIGIN_SEMANTIC_TREE_DIFFER")
  const invalid = parse(source)
  invalid.program.body[0].attributes = "empty"
  expect(() => semanticTree(invalid, fields)).toThrow("G09_ORIGIN_IMPORT_ATTRIBUTES_INVALID")
})

test("module source, aliases, and specifier order remain exact", () => {
  for (const [left, right] of [
    ['import { item } from "one"', 'import { item } from "two"'],
    ['import { item as first } from "pkg"', 'import { item as second } from "pkg"'],
    ['import { first, second } from "pkg"', 'import { second, first } from "pkg"'],
  ]) expect(() => linkSemanticTrees(parse(left), parse(right), fields)).toThrow("G09_ORIGIN_SEMANTIC_TREE_DIFFER")
})

test("singleton template tail equivalence preserves raw/cooked and requires a boolean", () => {
  const source = "const text = `same text`"
  const left = parse(source)
  left.program.body[0].declarations[0].init.quasis[0].tail = false
  expect(() => linkSemanticTrees(left, parse(source), fields)).not.toThrow()
  for (const field of ["raw", "cooked"]) {
    const changed = parse(source)
    changed.program.body[0].declarations[0].init.quasis[0].value[field] = "different text"
    expect(() => linkSemanticTrees(changed, parse(source), fields)).toThrow("G09_ORIGIN_SEMANTIC_TREE_DIFFER")
  }
  for (const value of [undefined, null, "true", 1]) {
    const invalid = parse(source)
    invalid.program.body[0].declarations[0].init.quasis[0].tail = value
    expect(() => semanticTree(invalid, fields)).toThrow("G09_ORIGIN_TEMPLATE_TAIL_TYPE")
  }
})

test("interpolated, orphan, and malformed template contexts cannot borrow singleton equivalence", () => {
  const source = "const text = `before ${value} after`"
  for (const index of [0, 1]) {
    const item = parse(source)
    const quasi = item.program.body[0].declarations[0].init.quasis[index]
    quasi.tail = !quasi.tail
    expect(() => linkSemanticTrees(item, parse(source), fields)).toThrow("G09_ORIGIN_SEMANTIC_TREE_DIFFER")
  }
  const one = parse("const text = `same text`").program.body[0].declarations[0].init.quasis[0]
  const two = parse("const text = `same text`").program.body[0].declarations[0].init.quasis[0]
  one.tail = false
  expect(() => linkSemanticTrees(one, two, fields)).toThrow("G09_ORIGIN_SEMANTIC_TREE_DIFFER")
  const malformed = parse("const text = `same text`")
  malformed.program.body[0].declarations[0].init.expressions.push(parse("value").program.body[0].expression)
  expect(() => semanticTree(malformed, fields)).toThrow("G09_ORIGIN_TEMPLATE_ARITY_INVALID")
})

test("parenthesized assignment identifiers are outside the supported semantic projection", () => {
  for (const body of ["function () {}", "class {}", "() => {}"])
    expect(() => linkSemanticTrees(parse("(fn) = " + body), parse("fn = " + body), fields))
      .toThrow("G09_ORIGIN_PARENTHESIZED_LVALUE_UNSUPPORTED")
  const pattern = parse("function f(fn = function () {}) {}")
  pattern.program.body[0].params[0].left.extra = { parenthesized: true }
  expect(() => semanticTree(pattern, fields)).toThrow("G09_ORIGIN_PARENTHESIZED_LVALUE_UNSUPPORTED")
})

test("parenthesized optional-chain boundaries cannot collapse into another chain", () => {
  expect(() => linkSemanticTrees(parse("(object?.member).property"), parse("object?.member.property"), fields))
    .toThrow("G09_ORIGIN_SEMANTIC_TREE_DIFFER")
})

test("operator, sibling order, names, and node types are semantic", () => {
  for (const [left, right] of [
    ["const x = a + b", "const x = a - b"],
    ["f(a, b)", "f(b, a)"],
    ["const x = alpha", "const x = beta"],
    ["const x = alpha", "const x = 'alpha'"],
  ]) expect(() => linkSemanticTrees(parse(left), parse(right), fields)).toThrow("G09_ORIGIN_SEMANTIC_TREE_DIFFER")
})

test("a semantic mismatch reports its exact field path and both values", () => {
  const left = semanticTree(parse("a + b"), fields)
  const right = semanticTree(parse("a - b"), fields)
  const difference = firstSemanticDifference(left.projection, right.projection)
  expect(difference.structuralPath).toEqual(["program", "body", 0, "expression", "operator"])
  expect(difference.transformed).toEqual({ kind: "string", value: "+" })
  expect(difference.reparsed).toEqual({ kind: "string", value: "-" })
  try {
    linkSemanticTrees(parse("a + b"), parse("a - b"), fields)
    throw new Error("expected the differing tree to reject")
  } catch (error) {
    expect(error.semanticDiagnostic.firstDifference).toEqual(difference)
    expect(error.semanticProjections.transformed).toEqual(left.projection)
    expect(error.semanticProjections.reparsed).toEqual(right.projection)
  }
})

test("computed member access cannot match a noncomputed property", () => {
  expect(() => linkSemanticTrees(parse("object.property"), parse("object[property]"), fields))
    .toThrow("G09_ORIGIN_SEMANTIC_TREE_DIFFER")
})

test("template raw text is semantic data and is not discarded as formatting", () => {
  const left = parse("tag`value`")
  const right = parse("tag`value`")
  right.program.body[0].expression.quasi.quasis[0].value.raw = "changed"
  expect(() => linkSemanticTrees(left, right, fields)).toThrow("G09_ORIGIN_SEMANTIC_TREE_DIFFER")
})

test("unreviewed extra metadata and unknown fields fail closed", () => {
  const extra = parse("const x = alpha")
  extra.program.body[0].declarations[0].init.extra = { unreviewedFlag: true }
  expect(() => semanticTree(extra, fields)).toThrow("G09_ORIGIN_UNREVIEWED_EXTRA")
  const field = parse("const x = alpha")
  field.program.body[0].declarations[0].init.unreviewedField = true
  expect(() => semanticTree(field, fields)).toThrow("G09_ORIGIN_UNKNOWN_FIELD")
  expect(() => semanticTree(parse('"use strict"; statement()'), fields)).toThrow("G09_ORIGIN_UNREVIEWED_EXTRA")
})

function shorthand() {
  const raw = "const projectID = 1; const object = {projectID};"
  const bytes = Buffer.from(raw)
  const token = identifierSpan(bytes, parseIdentifiers(toolchain.babel, raw), bytes.lastIndexOf("projectID"), "projectID")
  return { raw, token, transformed: parse(raw), reparsed: parse(raw) }
}

test("shorthand key and value may agree on one exact complete origin", () => {
  const item = shorthand()
  const link = linkSemanticTrees(item.transformed, item.reparsed, fields)
  const origin = originForToken(link, item.token, item.token, "projectID", item.raw, "/fixed.tsx")
  expect(origin.generatedAstPaths).toBe(2)
  expect(origin.uniqueOriginalRanges).toBe(1)
})

test("one shorthand path with another origin rejects despite semantic equality", () => {
  const item = shorthand()
  const declaration = item.transformed.program.body[0].declarations[0].id
  const value = item.transformed.program.body[1].declarations[0].init.properties[0].value
  value.loc = declaration.loc
  value.start = declaration.start
  value.end = declaration.end
  const link = linkSemanticTrees(item.transformed, item.reparsed, fields)
  expect(() => originForToken(link, item.token, item.token, "projectID", item.raw, "/fixed.tsx"))
    .toThrow("G09_ORIGIN_FULL_TOKEN_DIFFER")
})

test("missing or partial source origin cannot borrow the parser token end", () => {
  for (const kind of ["missing", "partial"]) {
    const item = shorthand()
    const value = item.transformed.program.body[1].declarations[0].init.properties[0].value
    if (kind === "missing") delete value.loc
    else value.loc = { ...value.loc, end: { ...value.loc.end, column: value.loc.end.column - 1 } }
    const link = linkSemanticTrees(item.transformed, item.reparsed, fields)
    expect(() => originForToken(link, item.token, item.token, "projectID", item.raw, "/fixed.tsx"))
      .toThrow(kind === "missing" ? "G09_ORIGIN_LOCATION_MISSING" : "G09_ORIGIN_FULL_TOKEN_DIFFER")
  }
})
