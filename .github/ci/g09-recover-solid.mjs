import { createHash } from "node:crypto"
import { mkdir, readFile, realpath, writeFile } from "node:fs/promises"
import { createRequire } from "node:module"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const pins = {
  sourceSHA: "3ef84da65d6b8ad7cd3250412bbcabdf90924172",
  sourceTreeSHA: "48d57887656fd2e325dee97a7c066bcb8e84bbc8",
  fixture: "226e5b05d09a6755e2ddcc971cacce9986057969aff40275ecf3396503813a8b",
  ledger: "3921b2dd5d7df9ac9aa979264cff827901b5da162dd2976f00105bc92775cde9",
  index: "1b0f15f4d6017878743453356d4a3933d0f2b2e2682514717ea2d52df22d5bb4",
  maps: "6b80a904c0e253b308f80dfa028e636c6898d0ecc15c09c97fa3d8c658f6ef52",
  archive: "dc11455bbcce4565b24cdca53ce3e5ab05f883757f6c0765910a0e4c98147d83",
  elf: "ff145b04dc0897b32b7cdd904cf3bba7d793cf4a391d3c02325d3c6125006a9f",
  lock: "1397aec462767ce4692561bc8d443cf4761181dd8920b30c146538c1b7da09f9",
  plugin: "56ae4cb00b4d3cd3090150e3f10790fb44a9c8b55cab90ed4af97258d53d7803",
  transform: "ca3acfa640221b791495c48aa5b16936b917f88b9b1f0addafd59ce1f74ddeb1",
  package: "85ff0980ee422074de51135e87bfd6a5ed9c345c8955cd267242a051abf12a06",
}
const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true })
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"

export const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex")
const gitBlob = (bytes) => createHash("sha1").update("blob " + bytes.length + "\0").update(bytes).digest("hex")

export function check(condition, code, detail = "") {
  if (!condition) throw new Error(code + (detail ? ": " + detail : ""))
}

export function verifyHash(bytes, expected, label) {
  const actual = sha256(bytes)
  check(actual === expected, "G09_HASH_MISMATCH", label + "; expected=" + expected + "; actual=" + actual)
}

export function verifyMappedSource(map, originalFilename, rawText) {
  check(map?.version === 3 && map.sources?.length === 1 && map.sources[0] === originalFilename &&
    map.sourcesContent?.length === 1 && map.sourcesContent[0] === rawText &&
    (!map.sourceRoot || map.sourceRoot === ""), "G09_BABEL_SOURCE_BINDING_DIFFER", originalFilename)
}

export function mapPoints(mappings) {
  let source = 0
  let sourceLine = 0
  let sourceColumn = 0
  return mappings.split(";").map((line) => {
    let column = 0
    const points = new Map()
    for (const segment of line ? line.split(",") : []) {
      const fields = []
      let value = 0
      let shift = 0
      for (const character of segment) {
        const digit = alphabet.indexOf(character)
        check(digit >= 0 && shift <= 30, "G09_MAP_VLQ_INVALID")
        value += (digit & 31) * 2 ** shift
        if (digit & 32) shift += 5
        else {
          fields.push(value % 2 ? -Math.floor(value / 2) : value / 2)
          value = shift = 0
        }
      }
      check(shift === 0 && [1, 4, 5].includes(fields.length), "G09_MAP_SEGMENT_INVALID")
      column += fields[0]
      check(column >= 0, "G09_MAP_COLUMN_INVALID")
      const entries = points.get(column) ?? []
      if (fields.length === 1) entries.push(null)
      else {
        source += fields[1]
        sourceLine += fields[2]
        sourceColumn += fields[3]
        check(Math.min(source, sourceLine, sourceColumn) >= 0, "G09_MAP_SOURCE_INVALID")
        entries.push([source, sourceLine, sourceColumn])
      }
      points.set(column, entries)
    }
    return points
  })
}

export function exactPoint(points, line, column, expected) {
  const entries = points[line]?.get(column)
  return Boolean(entries?.length && entries.every((entry) =>
    entry !== null && entry.length === expected.length && entry.every((value, index) => value === expected[index])))
}

export function identifierIndex(ast) {
  const identifiers = new Map()
  const pending = [ast]
  while (pending.length) {
    const node = pending.pop()
    if (!node || typeof node !== "object") continue
    if (Array.isArray(node)) {
      pending.push(...node)
      continue
    }
    // A preserved JSX attribute name is a JSXIdentifier in the raw TSX AST,
    // then an Identifier after Solid lowers it to an object property. Both
    // provide exact lexical token bounds; neither permits a string substring.
    if (node.type === "Identifier" || node.type === "JSXIdentifier") {
      const existing = identifiers.get(node.start) ?? []
      existing.push({ type: node.type, name: node.name, start: node.start, end: node.end })
      identifiers.set(node.start, existing)
    }
    for (const [key, value] of Object.entries(node)) {
      if (["loc", "comments", "leadingComments", "trailingComments", "innerComments", "tokens"].includes(key)) continue
      if (value && typeof value === "object") pending.push(value)
    }
  }
  return identifiers
}

export function position(text, offset) {
  check(Number.isSafeInteger(offset) && offset >= 0 && offset <= text.length, "G09_TEXT_OFFSET_INVALID")
  const before = text.slice(0, offset)
  return { line: before.split("\n").length - 1, column: before.length - before.lastIndexOf("\n") - 1 }
}

export function offsetAt(text, line, column) {
  const lines = text.split("\n")
  check(Number.isSafeInteger(line) && Number.isSafeInteger(column) && line >= 0 &&
    line < lines.length && column >= 0 && column <= lines[line].length, "G09_SOURCE_COORDINATE_INVALID")
  return lines.slice(0, line).reduce((length, item) => length + item.length + 1, 0) + column
}

export function identifierSpan(bytes, identifiers, byteOffset, seed) {
  check(/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(seed), "G09_IDENTIFIER_SEED_INVALID")
  check(Number.isSafeInteger(byteOffset) && byteOffset >= 0 && byteOffset + seed.length <= bytes.length,
    "G09_IDENTIFIER_OFFSET_INVALID")
  const text = decoder.decode(bytes)
  const start = decoder.decode(bytes.subarray(0, byteOffset)).length
  check(bytes.subarray(byteOffset, byteOffset + seed.length).equals(Buffer.from(seed)),
    "G09_IDENTIFIER_BYTES_DIFFER")
  const matches = identifiers.get(start)
  check(matches?.length && matches.every((node) =>
    node.name === seed && node.start === start && node.end === start + seed.length),
    "G09_IDENTIFIER_TOKEN_BOUNDARY_DIFFER")
  return {
    byteStart: byteOffset, byteEnd: byteOffset + seed.length,
    utf16Start: start, utf16End: start + seed.length,
    astNodeTypes: [...new Set(matches.map((node) => node.type))].sort(),
    start: position(text, start), end: position(text, start + seed.length),
  }
}

export async function solidToolchain(candidate) {
  check(typeof Bun !== "undefined" && Bun.version === "1.4.1" &&
    Bun.revision === "4661e494f052c83c80dade1318e5710238340be6", "G09_BUN_IDENTITY_DIFFER")
  const plugin = await realpath(Bun.resolveSync("@opentui/solid/bun-plugin", path.join(candidate, "apps/cli")))
  const transform = path.join(path.dirname(plugin), "solid-transform.js")
  const packageFile = path.join(path.dirname(plugin), "../package.json")
  for (const [file, hash] of [[plugin, pins.plugin], [transform, pins.transform], [packageFile, pins.package]])
    verifyHash(await readFile(file), hash, file)
  const require = createRequire(transform)
  const babel = require("@babel/core")
  const ts = require("@babel/preset-typescript")
  const solid = require("babel-preset-solid")
  check(babel.version === "7.28.0", "G09_BABEL_VERSION_DIFFER")
  const original = await import(pathToFileURL(transform).href)
  check(typeof original.transformSolidSource === "function", "G09_SOLID_TRANSFORM_UNAVAILABLE")
  return { original, babel, ts: ts.default ?? ts, solid: solid.default ?? solid, transform }
}

export function parseIdentifiers(babel, text, typescript = false) {
  const ast = babel.parseSync(text, {
    configFile: false, babelrc: false, sourceType: "module",
    parserOpts: { allowReturnOutsideFunction: true, plugins: typescript ? ["typescript", "jsx"] : [] },
  })
  check(ast, "G09_AST_PARSE_FAILED")
  return identifierIndex(ast)
}

async function main() {
  const [candidateArgument, evidenceArgument, outputArgument] = process.argv.slice(2)
  check(candidateArgument && evidenceArgument && outputArgument, "G09_ARGUMENTS_REQUIRED",
    "<candidate> <evidence-dir> <output-dir>")
  const candidate = await realpath(candidateArgument)
  const evidence = await realpath(evidenceArgument)
  const output = path.resolve(outputArgument)
  check(![candidate, evidence].some((root) => output === root || output.startsWith(root + path.sep)),
    "G09_OUTPUT_OVERLAPS_INPUT")
  await mkdir(output, { recursive: true, mode: 0o700 })
  const receipt = {
    schema: "sf-g09-solid-recovery-candidate-v1",
    status: "blocked",
    artifactId: "14722264806",
    sourceSHA: pins.sourceSHA,
    sourceTreeSHA: pins.sourceTreeSHA,
    archiveSha256: pins.archive,
    elfSha256: pins.elf,
    sourceMapIndexSha256: pins.index,
    workflowSHA: process.env.GITHUB_SHA,
    runId: process.env.GITHUB_RUN_ID,
    runAttempt: process.env.GITHUB_RUN_ATTEMPT,
    jobId: process.env.G09_JOB_ID ?? null,
    checkRunId: process.env.CHECK_RUN_ID ?? null,
    harnessSha256: sha256(await readFile(fileURLToPath(import.meta.url))),
    inputs: {},
    recovered: [],
    occurrences: [],
    formalG09Pass: false,
    reviewDisposition: "not-assigned",
    limits: [
      "No ELF is rebuilt, modified, or executed.",
      "Recovered intermediates must match hashes recorded for the original binary.",
      "The Babel maps are supplementary maps regenerated over hash-identical intermediates; they are not original Bun maps.",
      "Lexical token endpoints do not create missing compiler source-map endpoints.",
      "Every endOfBunSpan stays not-proven; every tuiExecution stays not-observed.",
      "A reviewed attribution rule and independent execution evidence remain necessary before formal qualification.",
    ],
  }
  try {
    check(process.env.GITHUB_ACTIONS === "true", "G09_ACTIONS_EXECUTION_REQUIRED")
    check(/^[a-f0-9]{40}$/.test(receipt.workflowSHA ?? "") &&
      /^[1-9][0-9]*$/.test(receipt.runId ?? "") &&
      /^[1-9][0-9]*$/.test(receipt.runAttempt ?? "") &&
      (/^[1-9][0-9]*$/.test(receipt.jobId ?? "") || /^[1-9][0-9]*$/.test(receipt.checkRunId ?? "")),
      "G09_JOB_IDENTITY_REQUIRED")
    const readPinned = async (file, hash, label = file) => {
      const bytes = await readFile(file)
      verifyHash(bytes, hash, label)
      receipt.inputs[label] = { sha256: hash, bytes: bytes.length }
      return bytes
    }
    const fixture = JSON.parse(await readPinned(new URL("./g09-solid-cases.json", import.meta.url), pins.fixture, "fixture"))
    const ledger = JSON.parse(await readPinned(path.join(evidence, "compile-evidence.json"), pins.ledger, "ledger"))
    const index = JSON.parse(await readPinned(path.join(evidence, "cli-source-map-index.json"), pins.index, "index"))
    await readPinned(path.join(evidence, "cli-source-maps.tar.gz"), pins.maps, "mapsArchive")
    await readPinned(path.join(evidence, "orchestra-sf-entra-linux-x64-baseline.tar.gz"), pins.archive, "archive")
    const elf = await readPinned(path.join(evidence, "orchestra"), pins.elf, "elf")
    await readPinned(path.join(candidate, "bun.lock"), pins.lock, "lockfile")
    check(fixture.sourceSHA === pins.sourceSHA && fixture.sourceTreeSHA === pins.sourceTreeSHA &&
      fixture.elfSha256 === pins.elf && index.binarySha256 === pins.elf &&
      ledger.binary.sha256 === pins.elf, "G09_SOURCE_ARTIFACT_BINDING_DIFFER")
    check(fixture.solid.length === 33 && new Set(fixture.solid.map((row) => row.id)).size === 33,
      "G09_EXPECTED_OCCURRENCE_SET_DIFFER")
    const paths = [...new Set(fixture.solid.map((row) => row.repositoryPath))]
    check(paths.length === 8, "G09_EXPECTED_SOURCE_SET_DIFFER")
    const toolchain = await solidToolchain(candidate)
    receipt.toolchain = {
      bun: Bun.version, bunRevision: Bun.revision, babel: toolchain.babel.version,
      solid: "@opentui/solid@0.4.5", pluginSha256: pins.plugin,
      transformSha256: pins.transform, packageSha256: pins.package, lockfileSha256: pins.lock,
    }
    const sources = new Map()
    for (const repositoryPath of paths) {
      check(repositoryPath.startsWith("packages/tui/src/") && !repositoryPath.split("/").includes(".."),
        "G09_SOURCE_PATH_INVALID")
      const rows = fixture.solid.filter((row) => row.repositoryPath === repositoryPath)
      const first = rows[0]
      check(rows.every((row) => row.sha256 === first.sha256 && row.gitBlob === first.gitBlob &&
        row.intermediateSha256 === first.intermediateSha256), "G09_SOURCE_ROW_BINDING_DIFFER")
      const raw = await readPinned(path.join(candidate, repositoryPath), first.sha256, repositoryPath)
      check(gitBlob(raw) === first.gitBlob, "G09_GIT_BLOB_DIFFER", repositoryPath)
      const matches = ledger.inputs.filter((input) => input.path.endsWith("/" + repositoryPath))
      check(matches.length === 1 && matches[0].transform === "solid-jsx-babel" &&
        matches[0].sha256 === first.sha256 && matches[0].gitBlob === first.gitBlob,
        "G09_LEDGER_SOURCE_DIFFER", repositoryPath)
      const originalFilename = matches[0].path
      const rawText = decoder.decode(raw)
      const recoveredText = await toolchain.original.transformSolidSource(rawText, { filename: originalFilename })
      const recovered = Buffer.from(recoveredText)
      verifyHash(recovered, first.intermediateSha256, "intermediate:" + repositoryPath)
      check(recovered.length === matches[0].compilerBytes && recovered.length === matches[0].analysisBytes,
        "G09_INTERMEDIATE_SIZE_DIFFER", repositoryPath)
      const mapped = await toolchain.babel.transformAsync(rawText, {
        filename: originalFilename, sourceFileName: originalFilename,
        configFile: false, babelrc: false, plugins: [],
        presets: [[toolchain.solid, { moduleName: "@opentui/solid", generate: "universal" }], [toolchain.ts]],
        sourceMaps: true,
      })
      check(mapped?.code === recoveredText && mapped.map?.version === 3,
        "G09_MAPPED_TRANSFORM_CODE_DIFFER", repositoryPath)
      verifyMappedSource(mapped.map, originalFilename, rawText)
      const intermediatePath = "intermediates/" + repositoryPath + ".js"
      const mapPath = "babel-maps/" + repositoryPath + ".map.json"
      const mapBytes = Buffer.from(JSON.stringify(mapped.map) + "\n")
      for (const [file, bytes] of [[intermediatePath, recovered], [mapPath, mapBytes]]) {
        await mkdir(path.dirname(path.join(output, file)), { recursive: true, mode: 0o700 })
        await writeFile(path.join(output, file), bytes, { flag: "wx", mode: 0o600 })
      }
      sources.set(repositoryPath, {
        raw, rawText, recovered, recoveredText,
        rawIdentifiers: parseIdentifiers(toolchain.babel, rawText, true),
        intermediateIdentifiers: parseIdentifiers(toolchain.babel, recoveredText),
        babelPoints: mapPoints(mapped.map.mappings),
      })
      receipt.recovered.push({
        repositoryPath, gitBlob: first.gitBlob, sourceSha256: first.sha256,
        originalFilename, intermediatePath, intermediateSha256: sha256(recovered),
        bytes: recovered.length, mapPath, supplementaryBabelMapSha256: sha256(mapBytes),
        originalTransformHashMatched: true, mappedTransformCodeIdentical: true,
      })
    }
    const modules = new Map(index.modules.map((module) => [module.name, module]))
    const chunks = new Map()
    for (const row of fixture.solid) {
      try {
        const module = modules.get(row.module)
        check(module && module.encoding === 1 && module.mapSha256 === row.mapSha256 &&
          module.sha256 === row.moduleSha256, "G09_MODULE_BINDING_DIFFER")
        check(module.offset >= 0 && module.byteLength > 0 && module.offset + module.byteLength <= elf.length,
          "G09_MODULE_RANGE_INVALID")
        if (!chunks.has(row.module)) {
          const bytes = elf.subarray(module.offset, module.offset + module.byteLength)
          verifyHash(bytes, row.moduleSha256, row.module)
          check(/^[A-Za-z0-9_.-]+\.map$/.test(module.map), "G09_MAP_PATH_INVALID")
          const mapBytes = await readFile(path.join(evidence, "maps", module.map))
          verifyHash(mapBytes, row.mapSha256, module.map)
          const map = JSON.parse(mapBytes)
          check(map.version === 3 && map.sources.length === module.sources.length &&
            map.sources.every((source, position) => source === module.sources[position].source),
            "G09_MAP_SOURCE_LIST_DIFFER")
          const text = decoder.decode(bytes)
          chunks.set(row.module, { bytes, map, points: mapPoints(map.mappings),
            identifiers: parseIdentifiers(toolchain.babel, text) })
        }
        const chunk = chunks.get(row.module)
        const source = sources.get(row.repositoryPath)
        check(module.sources[row.start.sourceIndex]?.source === row.start.sourceName &&
          module.sources[row.start.sourceIndex]?.sha256 === row.intermediateSha256,
          "G09_INTERMEDIATE_INDEX_BINDING_DIFFER")
        const generated = identifierSpan(chunk.bytes, chunk.identifiers, row.elfOffset - module.offset, row.seed)
        check(generated.start.line === row.start.generatedLine && generated.start.column === row.start.generatedStartColumn &&
          generated.end.column === row.start.generatedEndColumn, "G09_GENERATED_COORDINATE_DIFFER")
        const originalPoint = [row.start.sourceIndex, row.start.sourceLine, row.start.sourceStartColumn]
        check(exactPoint(chunk.points, generated.start.line, generated.start.column, originalPoint),
          "G09_BUN_START_ANCHOR_DIFFER")
        check(sha256(JSON.stringify({
          domain: "archive", path: "bin/orchestra", fileSha256: pins.elf,
          byteOffset: row.elfOffset, byteLength: row.length, seed: row.seed, encoding: "utf8",
        })) === row.id && row.length === row.seed.length, "G09_OCCURRENCE_ID_DIFFER")
        const intermediateOffset = offsetAt(source.recoveredText, row.start.sourceLine, row.start.sourceStartColumn)
        const intermediate = identifierSpan(source.recovered, source.intermediateIdentifiers,
          Buffer.byteLength(source.recoveredText.slice(0, intermediateOffset)), row.seed)
        const original = identifierSpan(source.raw, source.rawIdentifiers, row.gitOffset, row.seed)
        const babelStart = exactPoint(source.babelPoints, intermediate.start.line, intermediate.start.column,
          [0, original.start.line, original.start.column])
        const babelEnd = exactPoint(source.babelPoints, intermediate.end.line, intermediate.end.column,
          [0, original.end.line, original.end.column])
        const bunEnd = exactPoint(chunk.points, generated.end.line, generated.end.column,
          [row.start.sourceIndex, intermediate.end.line, intermediate.end.column])
        receipt.occurrences.push({
          id: row.id, repositoryPath: row.repositoryPath, seed: row.seed,
          lexicalTokens: "verified-at-all-three-levels",
          originalBunStartAnchor: "verified",
          supplementaryBabelStartAnchor: babelStart ? "verified" : "not-proven",
          supplementaryBabelEndAnchor: babelEnd ? "verified" : "not-proven",
          literalAttributionCandidate: babelStart && babelEnd ? "ready-for-independent-review" : "incomplete",
          generated, intermediate, original, originalBunEndPointMatches: bunEnd,
          endOfBunSpan: "not-proven", tuiExecution: "not-observed",
        })
      } catch (error) {
        receipt.occurrences.push({
          id: row.id, repositoryPath: row.repositoryPath, status: "blocked",
          reason: error instanceof Error ? error.message : String(error),
          endOfBunSpan: "not-proven", tuiExecution: "not-observed",
        })
      }
    }
    receipt.summary = {
      recoveredIntermediates: receipt.recovered.length,
      occurrences: receipt.occurrences.length,
      lexicalTokensVerified: receipt.occurrences.filter((row) => row.lexicalTokens === "verified-at-all-three-levels").length,
      attributionCandidatesReady: receipt.occurrences.filter((row) => row.literalAttributionCandidate === "ready-for-independent-review").length,
      blocked: receipt.occurrences.filter((row) => row.status === "blocked").length,
      tuiCasesExecuted: 0,
    }
    check(receipt.summary.recoveredIntermediates === 8 && receipt.summary.occurrences === 33 &&
      receipt.summary.lexicalTokensVerified === 33 && receipt.summary.attributionCandidatesReady === 33 &&
      receipt.summary.blocked === 0, "G09_RECOVERY_INCOMPLETE")
    verifyHash(await readFile(path.join(evidence, "orchestra")), pins.elf, "elf-after-inspection")
    receipt.status = "supplementary-evidence-ready-for-review"
  } catch (error) {
    receipt.failure = error instanceof Error ? error.message : String(error)
    process.exitCode = 1
  }
  await writeFile(path.join(output, "solid-recovery-receipt.json"), JSON.stringify(receipt, null, 2) + "\n",
    { flag: "wx", mode: 0o600 })
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await main()
