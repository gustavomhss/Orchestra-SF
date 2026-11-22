import { readFile, mkdir, realpath, writeFile } from "node:fs/promises"
import { createRequire } from "node:module"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { check, sha256, verifyHash, solidToolchain, parseIdentifiers, identifierSpan, offsetAt } from "./g09-recover-solid.mjs"

const pins = {
  source: "3ef84da65d6b8ad7cd3250412bbcabdf90924172",
  tree: "48d57887656fd2e325dee97a7c066bcb8e84bbc8",
  fixture: "226e5b05d09a6755e2ddcc971cacce9986057969aff40275ecf3396503813a8b",
  ledger: "3921b2dd5d7df9ac9aa979264cff827901b5da162dd2976f00105bc92775cde9",
  elf: "ff145b04dc0897b32b7cdd904cf3bba7d793cf4a391d3c02325d3c6125006a9f",
  lock: "1397aec462767ce4692561bc8d443cf4761181dd8920b30c146538c1b7da09f9",
}
const targetIds = [
  "18a091809496a9d5162a36c494b35ee590557c3729af4e738aa9cb214ad45b1a",
  "98e5517da30a5e6b8a3ae98596e9ed9f4d079db4f84785e8d8b8060edc26ae43",
  "cac015cc219832e7b4ac54953d561a981962fc106781d788766660822726c568",
  "1fc85caa720b5b14efca68ac644f48366a10c555d2f1d1a1ae503ab3d0313c11",
  "376ceed62f07f09b65bf8a00538895654f87c95096cb2ca80bac2f59286f580b",
]
const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true })
// Only parser locations, comments, formatting, and an already-applied ordering
// hint are omitted. Body/argument/property order remains part of the tree.
// A parenthesized Identifier on an assignment LHS is unsupported: `(fn) =
// function () {}` can differ from `fn = function () {}` in name inference.
const metadata = new Set(["start", "end", "loc", "range", "leadingComments", "innerComments", "trailingComments", "comments", "tokens", "errors", "extra", "_blockHoist", "_compact"])
const extraMetadata = new Set(["parenthesized", "parenStart", "raw", "rawValue", "trailingComma"])
const absent = ["absent"]

function parserCompatibility(node, fields) {
  const values = {}
  if (node.type === "ObjectProperty" || node.type === "ObjectMethod") {
    const kind = node.kind === undefined ? fields.kind?.default : node.kind
    if (node.type === "ObjectMethod") check(["method", "get", "set"].includes(kind), "G09_ORIGIN_METHOD_KIND_INVALID")
    const expected = node.type === "ObjectMethod" && kind === "method"
    check(node.method === undefined || node.method === expected, "G09_ORIGIN_LEGACY_METHOD_DIFFER", node.type + ".method")
    values.method = expected
  }
  if (["ArrowFunctionExpression", "ObjectMethod"].includes(node.type)) {
    check(node.id === undefined || node.id === null, "G09_ORIGIN_UNSUPPORTED_FUNCTION_ID", node.type)
    values.id = null
  }
  return values
}

export function semanticTree(root, nodeFields) {
  const nodes = new Map()
  function visit(value, at, parentNode = null, parentField = null) {
    if (value === undefined) return absent
    if (value === null) return ["null"]
    if (Array.isArray(value)) return ["array", value.map((item, index) => visit(item, [...at, index], parentNode, parentField))]
    if (typeof value === "number") {
      check(Number.isFinite(value), "G09_ORIGIN_NONFINITE_VALUE")
      return ["number", Object.is(value, -0) ? "-0" : String(value)]
    }
    if (typeof value === "string" || typeof value === "boolean") return [typeof value, value]
    check(typeof value === "object", "G09_ORIGIN_UNSUPPORTED_VALUE")
    if (typeof value.type !== "string")
      return ["record", Object.keys(value).sort().map((key) => [key, visit(value[key], [...at, key])])]
    const fields = nodeFields[value.type]
    check(fields, "G09_ORIGIN_UNKNOWN_NODE", value.type)
    const compatibility = parserCompatibility(value, fields)
    for (const key of Object.keys(value)) {
      check(key === "type" || metadata.has(key) || Object.hasOwn(fields, key) || Object.hasOwn(compatibility, key),
        "G09_ORIGIN_UNKNOWN_FIELD", value.type + "." + key + " at " + JSON.stringify(at))
    }
    if (value.extra != null) {
      check(typeof value.extra === "object" && !Array.isArray(value.extra), "G09_ORIGIN_EXTRA_INVALID")
      for (const key of Object.keys(value.extra)) {
        if (key === "topLevelAwait") {
          check(value.type === "Program" && value.sourceType === "module", "G09_ORIGIN_TOP_LEVEL_AWAIT_CONTEXT")
          check(typeof value.extra[key] === "boolean", "G09_ORIGIN_TOP_LEVEL_AWAIT_TYPE")
        } else if (key === "shorthand") {
          check(value.type === "ObjectProperty" && value.shorthand === true && value.extra[key] === true,
            "G09_ORIGIN_LEGACY_SHORTHAND_DIFFER")
        } else check(extraMetadata.has(key), "G09_ORIGIN_UNREVIEWED_EXTRA", key + " at " + JSON.stringify(at))
      }
    }
    if (value.type === "Program" && value.sourceType === "module")
      check(typeof value.extra?.topLevelAwait === "boolean", "G09_ORIGIN_TOP_LEVEL_AWAIT_FLAG_REQUIRED")
    check(value.extra?.parenthesized === undefined || typeof value.extra.parenthesized === "boolean",
      "G09_ORIGIN_PARENTHESIS_FLAG_INVALID")
    check(!(value.type === "Identifier" && value.extra?.parenthesized && parentField === "left" &&
      ["AssignmentExpression", "AssignmentPattern"].includes(parentNode?.type)),
      "G09_ORIGIN_PARENTHESIZED_LVALUE_UNSUPPORTED")
    check(value.errors == null || (Array.isArray(value.errors) && value.errors.length === 0), "G09_ORIGIN_PARSE_ERRORS")
    if (value._blockHoist != null) check(Number.isFinite(value._blockHoist), "G09_ORIGIN_HOIST_INVALID")
    if (value._compact != null) check(typeof value._compact === "boolean", "G09_ORIGIN_COMPACT_INVALID")
    nodes.set(JSON.stringify(at), { path: at, node: value })
    const semanticFields = Object.keys(fields).filter((key) => !metadata.has(key)).sort().map((key) => {
      const field = value[key] === undefined ? fields[key].default : value[key]
      return [key, visit(field, [...at, key], value, key)]
    })
    for (const key of Object.keys(compatibility).sort())
      semanticFields.push(["@parser:" + key, visit(compatibility[key], [...at, key], value, key)])
    if (value.type === "Program" && value.sourceType === "module")
      semanticFields.push(["@parser:topLevelAwait", ["boolean", value.extra.topLevelAwait]])
    return ["node", value.type, semanticFields]
  }
  const projection = visit(root, [])
  const canonical = JSON.stringify(projection)
  return { projection, canonical, nodes, sha256: sha256(canonical) }
}

export function firstSemanticDifference(left, right, at = []) {
  const summary = (value) => value[0] === "node" ? { kind: "node", type: value[1] }
    : value[0] === "array" ? { kind: "array", length: value[1].length }
      : value[0] === "record" ? { kind: "record", keys: value[1].map(([key]) => key) }
        : typeof value[1] === "string" && value[1].length > 512
          ? { kind: value[0], valuePrefix: value[1].slice(0, 512), valueLength: value[1].length, valueSha256: sha256(value[1]) }
          : { kind: value[0], value: value[1] ?? null }
  const mismatch = (reason) => ({ structuralPath: at, reason, transformed: summary(left), reparsed: summary(right) })
  if (left[0] !== right[0]) return mismatch("value-kind")
  if (left[0] === "node" && left[1] !== right[1]) return mismatch("node-type")
  if (left[0] === "node" || left[0] === "record") {
    const a = left[left[0] === "node" ? 2 : 1]
    const b = right[right[0] === "node" ? 2 : 1]
    if (JSON.stringify(a.map(([key]) => key)) !== JSON.stringify(b.map(([key]) => key)))
      return { structuralPath: at, reason: "field-set", transformed: a.map(([key]) => key), reparsed: b.map(([key]) => key) }
    for (let index = 0; index < a.length; index++) {
      const difference = firstSemanticDifference(a[index][1], b[index][1], [...at, a[index][0]])
      if (difference) return difference
    }
    return null
  }
  if (left[0] === "array") {
    if (left[1].length !== right[1].length) return mismatch("array-length")
    for (let index = 0; index < left[1].length; index++) {
      const difference = firstSemanticDifference(left[1][index], right[1][index], [...at, index])
      if (difference) return difference
    }
    return null
  }
  return left[1] === right[1] ? null : mismatch("value")
}

export function linkSemanticTrees(transformedAst, reparsedAst, nodeFields) {
  const transformed = semanticTree(transformedAst, nodeFields)
  const reparsed = semanticTree(reparsedAst, nodeFields)
  if (transformed.canonical !== reparsed.canonical) {
    const diagnostic = { transformedSha256: transformed.sha256, reparsedSha256: reparsed.sha256,
      firstDifference: firstSemanticDifference(transformed.projection, reparsed.projection) }
    const error = new Error("G09_ORIGIN_SEMANTIC_TREE_DIFFER: " + JSON.stringify(diagnostic))
    error.semanticDiagnostic = diagnostic
    error.semanticProjections = { transformed: transformed.projection, reparsed: reparsed.projection }
    throw error
  }
  return { transformed, reparsed }
}

export function originForToken(link, token, original, seed, rawText, originalFilename) {
  const matches = [...link.reparsed.nodes.values()].filter(({ node }) =>
    node.type === "Identifier" && node.start === token.utf16Start && node.end === token.utf16End && node.name === seed)
  check(matches.length > 0, "G09_ORIGIN_GENERATED_TOKEN_MISSING")
  const origins = matches.map(({ path: nodePath }) => {
    const node = link.transformed.nodes.get(JSON.stringify(nodePath))?.node
    check(node?.type === "Identifier" && node.name === seed && node.loc?.start && node.loc?.end,
      "G09_ORIGIN_LOCATION_MISSING")
    const loc = node.loc
    check(loc.filename == null || loc.filename === originalFilename, "G09_ORIGIN_FILENAME_DIFFER")
    const start = offsetAt(rawText, loc.start.line - 1, loc.start.column)
    const end = offsetAt(rawText, loc.end.line - 1, loc.end.column)
    check(start === original.utf16Start && end === original.utf16End && rawText.slice(start, end) === seed,
      "G09_ORIGIN_FULL_TOKEN_DIFFER")
    for (const [position, expected] of [[loc.start, start], [loc.end, end]])
      check(position.index === undefined || position.index === expected, "G09_ORIGIN_LOC_INDEX_DIFFER")
    check((node.start === undefined || node.start === start) && (node.end === undefined || node.end === end),
      "G09_ORIGIN_NUMERIC_RANGE_DIFFER")
    return { structuralPath: nodePath, type: node.type, name: node.name,
      loc: { start: { line: loc.start.line, column: loc.start.column }, end: { line: loc.end.line, column: loc.end.column }, filename: loc.filename ?? null },
      numericStartPresent: node.start !== undefined, numericStart: node.start ?? null,
      numericEndPresent: node.end !== undefined, numericEnd: node.end ?? null,
      sourceUtf16RangeFromLoc: [start, end] }
  })
  // Shorthand key/value nodes can share one printed token. Every corresponding
  // path must agree on the same complete origin; a conflicting alias rejects.
  check(new Set(origins.map((item) => JSON.stringify(item.sourceUtf16RangeFromLoc))).size === 1,
    "G09_ORIGIN_AMBIGUOUS")
  return { semanticTreeSha256: link.transformed.sha256, semanticNodeCount: link.transformed.nodes.size,
    generatedAstPaths: origins.length, uniqueOriginalRanges: 1, origins }
}

async function main() {
  const [candidateArgument, evidenceArgument, solidArgument, outputArgument] = process.argv.slice(2)
  check(candidateArgument && evidenceArgument && solidArgument && outputArgument, "G09_ORIGIN_ARGUMENTS_REQUIRED",
    "<candidate> <preserved-inputs> <solid-recovery-output> <output>")
  const candidate = await realpath(candidateArgument)
  const evidence = await realpath(evidenceArgument)
  const solidDirectory = await realpath(solidArgument)
  const output = path.resolve(outputArgument)
  check(![candidate, evidence, solidDirectory].some((root) => output === root || output.startsWith(root + path.sep)),
    "G09_ORIGIN_OUTPUT_OVERLAP")
  await mkdir(output, { recursive: true, mode: 0o700 })
  check(await realpath(output) === output, "G09_ORIGIN_OUTPUT_SYMLINK")
  const receipt = {
    schema: "sf-g09-solid-origin-supplement-v1", status: "blocked", sourceSHA: pins.source, sourceTreeSHA: pins.tree,
    artifactId: "14722264806", elfSha256: pins.elf, workflowSHA: process.env.GITHUB_SHA,
    runId: process.env.GITHUB_RUN_ID, runAttempt: process.env.GITHUB_RUN_ATTEMPT,
    jobId: process.env.G09_JOB_ID ?? process.env.CHECK_RUN_ID,
    harnessSha256: sha256(await readFile(fileURLToPath(import.meta.url))),
    method: "whole-semantic-tree-equality-and-exact-structural-path-to-transform-origin",
    formalG09Pass: false, reviewDisposition: "not-assigned", existingExactEndCriterionChanged: false,
    inputs: {}, files: [], semanticDifferences: [], occurrences: [],
    limits: [
      "Supplementary origin metadata from the same pinned transform, not an independent compiler validation.",
      "No original or supplementary source-map point is created, interpolated, or changed.",
      "The existing requirement for 33 exact Babel end anchors remains unchanged.",
      "Every endOfBunSpan stays not-proven; every tuiExecution stays not-observed.",
      "AST equality may fail closed on unsupported formatting metadata or semantic differences; no approximate matching is used.",
    ],
  }
  try {
    check(process.env.GITHUB_ACTIONS === "true" && process.env.GITHUB_REPOSITORY === "gustavomhss/Orchestra-SF",
      "G09_ORIGIN_ACTIONS_REQUIRED")
    check(/^[a-f0-9]{40}$/.test(receipt.workflowSHA ?? "") &&
      [receipt.runId, receipt.runAttempt, receipt.jobId].every((value) => /^[1-9][0-9]*$/.test(value ?? "")),
      "G09_ORIGIN_EXECUTION_IDENTITY_REQUIRED")
    const readPinned = async (file, expected, label) => {
      const bytes = await readFile(file)
      verifyHash(bytes, expected, label)
      receipt.inputs[label] = { sha256: expected, bytes: bytes.length }
      return bytes
    }
    const fixture = JSON.parse(await readPinned(new URL("./g09-solid-cases.json", import.meta.url), pins.fixture, "fixture"))
    const ledger = JSON.parse(await readPinned(path.join(evidence, "compile-evidence.json"), pins.ledger, "ledger"))
    await readPinned(path.join(candidate, "bun.lock"), pins.lock, "lockfile")
    await readPinned(path.join(evidence, "orchestra"), pins.elf, "elf")
    const precedingBytes = await readFile(path.join(solidDirectory, "solid-recovery-receipt.json"))
    const preceding = JSON.parse(precedingBytes)
    receipt.inputs.exactRecoveryReceipt = { sha256: sha256(precedingBytes), bytes: precedingBytes.length }
    check(preceding.harnessSha256 === sha256(await readFile(new URL("./g09-recover-solid.mjs", import.meta.url))) &&
      preceding.sourceSHA === pins.source && preceding.sourceTreeSHA === pins.tree && preceding.elfSha256 === pins.elf &&
      preceding.workflowSHA === receipt.workflowSHA && preceding.runId === receipt.runId &&
      preceding.runAttempt === receipt.runAttempt && preceding.jobId === receipt.jobId &&
      preceding.summary?.recoveredIntermediates === 8 && preceding.summary?.lexicalTokensVerified === 33,
      "G09_ORIGIN_PRECEDING_RECEIPT_DIFFER")
    const toolchain = await solidToolchain(candidate)
    const require = createRequire(toolchain.transform)
    const coreRequire = createRequire(require.resolve("@babel/core"))
    const types = coreRequire("@babel/types")
    const typesVersion = coreRequire("@babel/types/package.json").version
    const generatorVersion = coreRequire("@babel/generator/package.json").version
    const parserVersion = coreRequire("@babel/parser/package.json").version
    check(typesVersion === "7.29.7" && generatorVersion === "7.29.7" && parserVersion === "7.29.7", "G09_ORIGIN_DEPENDENCY_VERSION_DIFFER")
    receipt.toolchain = { bun: Bun.version, bunRevision: Bun.revision, core: toolchain.babel.version,
      types: typesVersion, generator: generatorVersion, parser: parserVersion,
      dependenciesResolvedFrom: "effective @babel/core module", lockfileSha256: pins.lock }
    receipt.semanticProjection = { fields: "All @babel/types.NODE_FIELDS with their declared defaults; sorted field names; array order preserved",
      omittedNodeMetadata: [...metadata].sort(), allowedExtraMetadata: [...extraMetadata].sort(),
      parserCompatibility: {
        topLevelAwait: "Required boolean on module Program.extra only; preserved in the semantic projection without a guessed default",
        method: "ObjectProperty: false; ObjectMethod: kind=method means true, get/set means false; absent builder field is derived from compared type/kind; contradictory or nonboolean values reject",
        shorthand: "extra.shorthand is accepted only as true on ObjectProperty whose semantic shorthand field is true",
        id: "ArrowFunctionExpression and ObjectMethod permit absent or null only; canonical null is preserved; any named id rejects",
      },
      identifierParentheses: "Reject parenthesized Identifier in AssignmentExpression.left or AssignmentPattern.left before projection.",
      unknownNodeOrFieldOrExtra: "reject", numbers: "finite; negative zero distinct" }
    const cases = targetIds.map((id) => {
      const rows = fixture.solid.filter((row) => row.id === id)
      const observations = preceding.occurrences.filter((row) => row.id === id)
      check(rows.length === 1 && observations.length === 1 && observations[0].lexicalTokens === "verified-at-all-three-levels" &&
        observations[0].originalBunStartAnchor === "verified" && observations[0].supplementaryBabelStartAnchor === "verified" &&
        observations[0].supplementaryBabelEndAnchor === "not-proven", "G09_ORIGIN_TARGET_SET_DIFFER", id)
      return { ...rows[0], previous: observations[0] }
    })
    for (const repositoryPath of [...new Set(cases.map((item) => item.repositoryPath))]) {
      const group = cases.filter((item) => item.repositoryPath === repositoryPath)
      try {
        const recovered = preceding.recovered.filter((item) => item.repositoryPath === repositoryPath)
        const inputs = ledger.inputs.filter((item) => item.path.endsWith("/" + repositoryPath))
        check(recovered.length === 1 && inputs.length === 1 && inputs[0].path === recovered[0].originalFilename,
          "G09_ORIGIN_SOURCE_BINDING_DIFFER")
        const prior = recovered[0]
        const first = group[0]
        check(group.every((item) => item.sha256 === first.sha256 && item.intermediateSha256 === first.intermediateSha256) &&
          inputs[0].sha256 === first.sha256 && prior.sourceSha256 === first.sha256 &&
          prior.intermediateSha256 === first.intermediateSha256, "G09_ORIGIN_SOURCE_HASH_BINDING_DIFFER")
        check(prior.intermediatePath === "intermediates/" + repositoryPath + ".js" &&
          prior.mapPath === "babel-maps/" + repositoryPath + ".map.json", "G09_ORIGIN_INPUT_PATH_DIFFER")
        const raw = await readPinned(path.join(candidate, repositoryPath), first.sha256, "raw:" + repositoryPath)
        const intermediate = await readPinned(path.join(solidDirectory, prior.intermediatePath), first.intermediateSha256, "intermediate:" + repositoryPath)
        await readPinned(path.join(solidDirectory, prior.mapPath), prior.supplementaryBabelMapSha256, "map:" + repositoryPath)
        const rawText = decoder.decode(raw)
        const intermediateText = decoder.decode(intermediate)
        const transformed = await toolchain.babel.transformAsync(rawText, {
          filename: prior.originalFilename, sourceFileName: prior.originalFilename,
          configFile: false, babelrc: false, plugins: [],
          presets: [[toolchain.solid, { moduleName: "@opentui/solid", generate: "universal" }], [toolchain.ts]],
          sourceMaps: true, ast: true,
        })
        check(transformed?.ast && transformed.code === intermediateText, "G09_ORIGIN_TRANSFORM_BYTES_DIFFER")
        verifyHash(Buffer.from(JSON.stringify(transformed.map) + "\n"), prior.supplementaryBabelMapSha256, "unchanged map:" + repositoryPath)
        const reparsed = toolchain.babel.parseSync(intermediateText, {
          configFile: false, babelrc: false, sourceType: "module", parserOpts: { allowReturnOutsideFunction: true },
        })
        const link = linkSemanticTrees(transformed.ast, reparsed, types.NODE_FIELDS)
        const rawIdentifiers = parseIdentifiers(toolchain.babel, rawText, true)
        const intermediateIdentifiers = parseIdentifiers(toolchain.babel, intermediateText)
        receipt.files.push({ repositoryPath, codeAndMapByteIdentical: true, semanticTreeSha256: link.transformed.sha256,
          semanticNodeCount: link.transformed.nodes.size, omittedMetadataOnly: true })
        for (const row of group) {
          try {
            const original = identifierSpan(raw, rawIdentifiers, row.gitOffset, row.seed)
            const intermediateOffset = offsetAt(intermediateText, row.start.sourceLine, row.start.sourceStartColumn)
            const token = identifierSpan(intermediate, intermediateIdentifiers,
              Buffer.byteLength(intermediateText.slice(0, intermediateOffset)), row.seed)
            const origin = originForToken(link, token, original, row.seed, rawText, prior.originalFilename)
            receipt.occurrences.push({ id: row.id, repositoryPath, seed: row.seed,
              status: "supplementary-origin-candidate-for-review", intermediate: token, original, ...origin,
              existingBabelEndAnchor: "not-proven", endOfBunSpan: "not-proven", tuiExecution: "not-observed", reviewDisposition: "not-assigned" })
          } catch (error) {
            receipt.occurrences.push({ id: row.id, repositoryPath, status: "blocked", reason: String(error),
              semanticDiagnostic: error?.semanticDiagnostic ?? null,
              existingBabelEndAnchor: "not-proven", endOfBunSpan: "not-proven", tuiExecution: "not-observed" })
          }
        }
      } catch (error) {
        if (error?.semanticProjections) {
          const diagnosticPath = "semantic-differences/" + repositoryPath + ".json"
          const diagnosticBytes = Buffer.from(JSON.stringify({ schema: "sf-g09-semantic-tree-difference-v1", repositoryPath,
            ...error.semanticDiagnostic, projections: error.semanticProjections }, null, 2) + "\n")
          await mkdir(path.dirname(path.join(output, diagnosticPath)), { recursive: true, mode: 0o700 })
          await writeFile(path.join(output, diagnosticPath), diagnosticBytes, { flag: "wx", mode: 0o600 })
          receipt.semanticDifferences.push({ repositoryPath, path: diagnosticPath, sha256: sha256(diagnosticBytes),
            bytes: diagnosticBytes.length, ...error.semanticDiagnostic })
        }
        for (const row of group) receipt.occurrences.push({ id: row.id, repositoryPath, status: "blocked", reason: String(error),
          semanticDiagnostic: error?.semanticDiagnostic ?? null,
          existingBabelEndAnchor: "not-proven", endOfBunSpan: "not-proven", tuiExecution: "not-observed" })
      }
    }
    receipt.summary = { exactSemanticTrees: receipt.files.length, occurrences: receipt.occurrences.length,
      originCandidates: receipt.occurrences.filter((row) => row.status === "supplementary-origin-candidate-for-review").length,
      originalMapEndsAdded: 0, existingCriteriaChanged: 0, tuiCasesExecuted: 0 }
    check(receipt.summary.exactSemanticTrees === 3 && receipt.summary.occurrences === 5 && receipt.summary.originCandidates === 5,
      "G09_ORIGIN_SUPPLEMENT_INCOMPLETE")
    verifyHash(await readFile(path.join(evidence, "orchestra")), pins.elf, "elf-after-origin-inspection")
    receipt.status = "supplementary-origin-evidence-ready-for-review"
  } catch (error) {
    receipt.failure = String(error)
    process.exitCode = 1
  }
  await writeFile(path.join(output, "solid-origin-receipt.json"), JSON.stringify(receipt, null, 2) + "\n", { flag: "wx", mode: 0o600 })
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main()
