import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { lstat, mkdir, readFile, realpath, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import ts from "typescript"

const check = (condition, message) => assert(condition, "VISUAL_INSPECTION: " + message)
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex")
const gitBlob = (bytes) => createHash("sha1").update("blob " + bytes.length + "\0").update(bytes).digest("hex")
const compact = (value) => JSON.stringify(value)
const same = (actual, expected, label) => assert.deepEqual(actual, expected, label)
const byteMap = (text) => {
  const toByte = new Map([[0, 0]]), toChar = new Map([[0, 0]])
  let character = 0, byte = 0
  for (const value of text) {
    character += value.length
    byte += Buffer.byteLength(value)
    toByte.set(character, byte)
    toChar.set(byte, character)
  }
  return {
    byte: (offset) => { check(toByte.has(offset), "not a UTF-16/code-point boundary"); return toByte.get(offset) },
    char: (offset) => { check(toChar.has(offset), "not a UTF-8/code-point boundary"); return toChar.get(offset) },
  }
}
const space = (character) => /[\t\n\r\f ]/.test(character ?? "")
const nameStart = (character) => !!character && (/[A-Za-z_]/.test(character) || character.codePointAt(0) >= 128)
const namePart = (character) => nameStart(character) || !!character && /[0-9-]/.test(character)
const validEscape = (text, offset) => text[offset] === "\\" && offset + 1 < text.length && !/[\n\r\f]/.test(text[offset + 1])
const startsName = (text, offset) => nameStart(text[offset]) || validEscape(text, offset) ||
  text[offset] === "-" && (nameStart(text[offset + 1]) || text[offset + 1] === "-" || validEscape(text, offset + 1))

function cssEscape(text, start, continuation = false) {
  check(text[start] === "\\" && start + 1 < text.length, "truncated CSS escape")
  let end = start + 1
  if (/[\n\r\f]/.test(text[end])) {
    check(continuation, "newline in CSS identifier escape")
    if (text[end] === "\r" && text[end + 1] === "\n") end++
    return { value: "", end: end + 1 }
  }
  const match = /^[0-9a-fA-F]{1,6}/.exec(text.slice(end))
  if (match) {
    end += match[0].length
    if (space(text[end])) {
      if (text[end] === "\r" && text[end + 1] === "\n") end++
      end++
    }
    const code = Number.parseInt(match[0], 16)
    return { value: String.fromCodePoint(code === 0 || code > 0x10ffff || code >= 0xd800 && code <= 0xdfff ? 0xfffd : code), end }
  }
  const value = String.fromCodePoint(text.codePointAt(end))
  return { value, end: end + value.length }
}

function cssTokens(text) {
  const tokens = []
  let offset = 0
  while (offset < text.length) {
    const start = offset, first = text[offset]
    let kind, value = ""
    if (text.startsWith("/*", offset)) {
      const finish = text.indexOf("*/", offset + 2)
      check(finish >= 0, "unterminated CSS comment")
      offset = finish + 2; kind = "comment"; value = text.slice(start, offset)
    } else if (space(first)) {
      while (offset < text.length && space(text[offset])) offset++
      kind = "space"; value = text.slice(start, offset)
    } else if (first === "'" || first === '"') {
      offset++; kind = "string"
      while (offset < text.length && text[offset] !== first) {
        check(!/[\n\r\f]/.test(text[offset]), "unescaped newline in CSS string")
        if (text[offset] === "\\") {
          const escaped = cssEscape(text, offset, true)
          value += escaped.value; offset = escaped.end
        } else {
          const character = String.fromCodePoint(text.codePointAt(offset))
          value += character; offset += character.length
        }
      }
      check(text[offset] === first, "unterminated CSS string")
      offset++
    } else if (startsName(text, offset)) {
      kind = "ident"
      while (offset < text.length && (namePart(text[offset]) || validEscape(text, offset))) {
        if (text[offset] === "\\") {
          const escaped = cssEscape(text, offset)
          value += escaped.value; offset = escaped.end
        } else {
          const character = String.fromCodePoint(text.codePointAt(offset))
          value += character; offset += character.length
        }
      }
    } else {
      kind = "delim"; value = String.fromCodePoint(text.codePointAt(offset)); offset += value.length
    }
    tokens.push({ kind, value, start, end: offset })
  }
  return tokens
}
const significant = (tokens) => tokens.filter((token) => token.kind !== "space" && token.kind !== "comment")
const tokenSignature = (tokens) => compact(significant(tokens).map(({ kind, value }) => [kind, value]))

// This is a bounded CSS lexical/structural reader, not a browser CSS engine.
// It recognizes complete class tokens only in qualified-rule selector preludes.
// Strings, attribute contents, declaration values and unknown at-rule grammars
// do not become class selectors merely because they contain a literal seed.
function inspectCss(text) {
  const tokens = cssTokens(text), selectors = [], classes = [], statements = []
  const grouping = new Set(["media", "supports", "container", "layer", "scope", "document", "-moz-document", "starting-style"])
  const declarations = new Set(["font-face", "page", "property", "counter-style", "font-feature-values", "color-profile", "position-try"])
  function block(begin, parentKind, atRules, parentSelectors, closing) {
    let start = begin, cursor = begin
    const delimiters = []
    while (cursor < tokens.length) {
      const token = tokens[cursor], value = token.kind === "delim" ? token.value : ""
      if (value === "(" || value === "[") delimiters.push(value)
      else if (value === ")" || value === "]") {
        check(delimiters.pop() === (value === ")" ? "(" : "["), "unbalanced CSS bracket")
      } else if (!delimiters.length && value === "{") {
        const preludeTokens = tokens.slice(start, cursor), clean = significant(preludeTokens)
        check(clean.length, "empty CSS rule prelude")
        const first = clean[0], at = first.kind === "delim" && first.value === "@"
        const name = at && clean[1]?.kind === "ident" ? clean[1].value.toLowerCase() : null
        if (at) check(name, "unknown CSS at-rule token")
        const prelude = text.slice(first.start, clean.at(-1).end)
        const customValue = clean[0]?.kind === "ident" && clean[0].value.startsWith("--") && clean[1]?.value === ":"
        const qualified = !at && !customValue && parentKind !== "unknown" && parentKind !== "declarations" && parentKind !== "keyframes"
        let nextKind = "mixed", nextAtRules = atRules, nextSelectors = parentSelectors
        const selector = qualified ? {
          index: selectors.length, selector: prelude, start: first.start, end: clean.at(-1).end,
          atRules: [...atRules], parentSelectors: [...parentSelectors],
          tokenSignature: tokenSignature(preludeTokens), bodyStart: token.end, bodyEnd: null,
        } : null
        if (selector) {
          selectors.push(selector)
          nextSelectors = [...parentSelectors, prelude]
          let attributeDepth = 0
          for (let index = 0; index < preludeTokens.length; index++) {
            const item = preludeTokens[index]
            if (item.kind === "delim" && item.value === "[") attributeDepth++
            if (item.kind === "delim" && item.value === "]") attributeDepth--
            if (attributeDepth === 0 && item.kind === "delim" && item.value === ".") {
              const nameToken = preludeTokens[index + 1]
              if (nameToken?.kind === "ident" && nameToken.start === item.end) {
                classes.push({ start: item.start, end: nameToken.end, classToken: text.slice(item.start, nameToken.end),
                  decodedClassToken: "." + nameToken.value, selector: selector.index })
              }
            }
          }
          check(attributeDepth === 0, "unbalanced selector attribute")
        }
        if (at) {
          nextAtRules = [...atRules, prelude]
          nextKind = grouping.has(name) ? (parentKind === "mixed" ? "mixed" : "rules")
            : declarations.has(name) ? "declarations"
            : name === "keyframes" || name === "-webkit-keyframes" ? "keyframes" : "unknown"
        } else if (customValue || parentKind === "unknown" || parentKind === "declarations") nextKind = "unknown"
        const closed = block(cursor + 1, nextKind, nextAtRules, nextSelectors, true)
        if (selector) selector.bodyEnd = tokens[closed - 1].start
        cursor = closed; start = cursor; continue
      } else if (!delimiters.length && value === ";") {
        const clean = significant(tokens.slice(start, cursor))
        if (clean.length) statements.push({ start: clean[0].start, end: token.end,
          tokens: clean, atRules: [...atRules], parentSelectors: [...parentSelectors] })
        cursor++; start = cursor; continue
      } else if (!delimiters.length && value === "}") {
        check(closing, "extra CSS closing brace")
        return cursor + 1
      }
      cursor++
    }
    check(!closing && delimiters.length === 0, "unterminated CSS block")
    return cursor
  }
  block(0, "rules", [], [], false)
  return { tokens, selectors, classes, comments: tokens.filter((token) => token.kind === "comment"), statements }
}

function cssContext(css, parsed, start, end) {
  const comment = parsed.comments.find((item) => item.start <= start && item.end >= end)
  if (comment) return {
    kind: "css-comment", range: { start: comment.start, end: comment.end },
    text: css.slice(comment.start, comment.end), classToken: null,
  }
  const matches = parsed.classes.filter((item) => item.start <= start && item.end >= end)
  check(matches.length === 1, "seed is not bounded to exactly one CSS class selector or comment at " + start)
  const item = matches[0], selector = parsed.selectors[item.selector]
  return {
    kind: "css-class-selector", classToken: item.classToken, decodedClassToken: item.decodedClassToken,
    classRange: { start: item.start, end: item.end },
    selector: selector.selector, selectorRange: { start: selector.start, end: selector.end },
    atRules: selector.atRules, parentSelectors: selector.parentSelectors,
    selectorTokenSignature: selector.tokenSignature,
  }
}

function decodeJsLiteral(source, node, sourceFile) {
  const start = node.getStart(sourceFile), end = node.end, raw = source.slice(start, end)
  const quote = raw[0]
  check(["'", '"', String.fromCharCode(96)].includes(quote) && raw.at(-1) === quote, "unexpected JS literal token")
  const template = quote.charCodeAt(0) === 96
  let cursor = 1, cooked = ""
  const segments = []
  function append(rawStart, rawEnd, value, kind) {
    const before = cooked.length
    cooked += value
    const next = { rawStart: start + rawStart, rawEnd: start + rawEnd,
      decodedStart: before, decodedEnd: cooked.length, kind }
    const previous = segments.at(-1)
    if (kind === "literal" && previous?.kind === "literal" && previous.rawEnd === next.rawStart &&
        previous.decodedEnd === next.decodedStart) {
      previous.rawEnd = next.rawEnd; previous.decodedEnd = next.decodedEnd
    } else segments.push(next)
  }
  while (cursor < raw.length - 1) {
    const before = cursor, character = raw[cursor]
    if (character !== "\\") {
      if (character === "\r") {
        check(template, "newline in ordinary JS string")
        cursor += raw[cursor + 1] === "\n" ? 2 : 1
        append(before, cursor, "\n", "newline-normalization")
      } else {
        check(template || character !== "\n", "newline in ordinary JS string")
        const value = String.fromCodePoint(raw.codePointAt(cursor))
        cursor += value.length; append(before, cursor, value, "literal")
      }
      continue
    }
    cursor++
    check(cursor < raw.length - 1, "truncated JS escape")
    const escape = raw[cursor++]
    let value, kind = "escape"
    if (escape === "\n" || escape === "\r" || escape === "\u2028" || escape === "\u2029") {
      if (escape === "\r" && raw[cursor] === "\n") cursor++
      value = ""; kind = "line-continuation"
    } else if (escape === "x") {
      const hex = raw.slice(cursor, cursor + 2)
      check(/^[a-fA-F0-9]{2}$/.test(hex), "invalid JS hex escape")
      value = String.fromCharCode(Number.parseInt(hex, 16)); cursor += 2
    } else if (escape === "u") {
      if (raw[cursor] === "{") {
        const close = raw.indexOf("}", cursor + 1), hex = raw.slice(cursor + 1, close)
        check(close > cursor && /^[a-fA-F0-9]{1,6}$/.test(hex) && Number.parseInt(hex, 16) <= 0x10ffff, "invalid JS Unicode escape")
        value = String.fromCodePoint(Number.parseInt(hex, 16)); cursor = close + 1
      } else {
        const hex = raw.slice(cursor, cursor + 4)
        check(/^[a-fA-F0-9]{4}$/.test(hex), "invalid JS Unicode escape")
        value = String.fromCharCode(Number.parseInt(hex, 16)); cursor += 4
      }
    } else if (escape === "0") {
      check(!/[0-9]/.test(raw[cursor] ?? ""), "legacy octal escape not accepted")
      value = "\0"
    } else {
      check(!/[1-9]/.test(escape), "legacy numeric escape not accepted")
      value = ({ b: "\b", f: "\f", n: "\n", r: "\r", t: "\t", v: "\v" })[escape] ?? escape
    }
    append(before, cursor, value, kind)
  }
  check(cursor === raw.length - 1 && cooked === node.text, "escape decoder differs from TypeScript 5.8.2")
  function mapPoint(point, isEnd) {
    const found = segments.filter((segment) => isEnd
      ? segment.rawStart < point && point <= segment.rawEnd
      : segment.rawStart <= point && point < segment.rawEnd)
    check(found.length === 1, "ambiguous JS raw/decoded boundary")
    const segment = found[0]
    if (segment.kind === "literal") return segment.decodedStart + point - segment.rawStart
    check(point === (isEnd ? segment.rawEnd : segment.rawStart), "span splits a JS escape")
    return isEnd ? segment.decodedEnd : segment.decodedStart
  }
  return { start, end, raw, cooked, segments,
    map: (begin, finish) => ({ start: mapPoint(begin, false), end: mapPoint(finish, true) }) }
}

function staticCssModule(file) {
  const ast = ts.createSourceFile(file.path, file.text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
  check(ast.parseDiagnostics.length === 0, "JS parse diagnostic in " + file.path)
  const declarations = new Map(), exports = []
  const literal = (node) => ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)
  for (const statement of ast.statements) {
    if (ts.isEmptyStatement(statement)) continue
    if (ts.isVariableStatement(statement)) {
      check(!statement.modifiers?.length, "modified JS variable statement")
      for (const declaration of statement.declarationList.declarations) {
        check(ts.isIdentifier(declaration.name) && declaration.initializer && literal(declaration.initializer),
          "module contains executable or non-literal initialization")
        check(!declarations.has(declaration.name.text), "duplicate literal binding")
        declarations.set(declaration.name.text, declaration.initializer)
      }
    } else if (ts.isExportDeclaration(statement)) {
      check(!statement.moduleSpecifier && statement.exportClause && ts.isNamedExports(statement.exportClause),
        "external or wildcard export is not pure CSS data")
      for (const item of statement.exportClause.elements) {
        check(item.name.text === "default", "non-default CSS export")
        const identifier = item.propertyName?.text ?? item.name.text
        check(declarations.has(identifier), "unknown default export binding")
        exports.push(declarations.get(identifier))
      }
    } else if (ts.isExportAssignment(statement)) {
      check(!statement.isExportEquals, "CommonJS export is unsupported")
      const node = ts.isIdentifier(statement.expression) ? declarations.get(statement.expression.text) : statement.expression
      check(node && literal(node), "default export is not a string literal")
      exports.push(node)
    } else check(false, "module contains a non-data statement: " + ts.SyntaxKind[statement.kind])
  }
  check(exports.length === 1 && declarations.size <= 1, "expected one static CSS export")
  const decoded = decodeJsLiteral(file.text, exports[0], ast)
  return { ...decoded, ast: { parser: "typescript", version: ts.version, parseDiagnostics: 0,
    statementKinds: ast.statements.map((node) => ts.SyntaxKind[node.kind]), onlyStaticDefaultString: true,
    literalKind: ts.SyntaxKind[exports[0].kind], literalStart: decoded.start, literalEnd: decoded.end } }
}

function syntaxControls() {
  const css = '@media (width > 1px){.orchestra-one:is(.orchestra-two,[x=".orchestra-value"]){content:".orchestra-value";color:red}/* .orchestra-comment */}'
  const parsed = inspectCss(css)
  same(parsed.classes.map((item) => item.classToken), [".orchestra-one", ".orchestra-two"], "CSS selector versus string control")
  check(cssContext(css, parsed, css.indexOf(".orchestra-comment"), css.indexOf(".orchestra-comment") + 10).kind === "css-comment", "comment control")
  const escaped = ".\\6f rchestra-label{color:red}.actions-repo-strip{color:blue}"
  same(inspectCss(escaped).classes.map((item) => item.decodedClassToken),
    [".orchestra-label", ".actions-repo-strip"], "escaped CSS identifier control")
  const js = { path: "literal-control.js", text: 'const a="\\u002eorchestra\\\\-x{content:\\"z\\"}\\n";export{a as default};' }
  const decoded = staticCssModule(js)
  check(decoded.cooked === '.orchestra\\-x{content:"z"}\n', "JS escape control")
  const escapedStart = js.text.indexOf("\\u002eorchestra")
  check(escapedStart >= 0, "raw escaped seed control")
  const mapped = decoded.map(escapedStart, escapedStart + "\\u002eorchestra".length)
  same(mapped, { start: 0, end: 10 }, "escaped raw span maps to exact CSS interval")
  same(decoded.cooked.slice(mapped.start, mapped.end), ".orchestra", "mapped seed control")
  assert.throws(() => staticCssModule({ path: "executable-control.js", text: "const a=render();export{a as default};" }),
    /module contains executable or non-literal initialization/, "executable module must be rejected")
  const unicode = byteMap("a\u{1f642}b")
  check(unicode.char(5) === 3 && unicode.byte(3) === 5, "UTF-8 versus UTF-16 control")
  return { caseName: "visual syntax reader rejects values and preserves literal offsets", status: "PASS", controls: 6 }
}

const [inspectionArg, sourceArg, evidenceArg, outputArg] = process.argv.slice(2)
check(process.argv.length === 6, "usage: node helper.mjs inspection-checkout source-checkout evidence-directory output-directory")
same([process.env.GITHUB_ACTIONS, process.env.GITHUB_REPOSITORY, process.env.GITHUB_REPOSITORY_ID,
  process.env.RUNNER_OS, process.env.RUNNER_ARCH],
["true", "gustavomhss/Orchestra-SF", "1455724710", "Linux", "X64"], "hosted inspection identity")
check(/^[a-f0-9]{40}$/.test(process.env.GITHUB_SHA ?? ""), "inspection SHA required")
for (const key of ["GITHUB_RUN_ID", "GITHUB_RUN_ATTEMPT"]) check(/^[1-9][0-9]*$/.test(process.env[key] ?? ""), "inspection run identity required")
same(ts.version, "5.8.2", "exact TypeScript parser")
const inspection = await realpath(inspectionArg), sourceRoot = await realpath(sourceArg), evidence = await realpath(evidenceArg)
const temporary = await realpath(process.env.RUNNER_TEMP), workspace = await realpath(process.env.GITHUB_WORKSPACE)
const within = (parent, child) => {
  const relative = path.relative(parent, child)
  return relative === "" || relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative)
}
const output = path.resolve(outputArg)
check(within(temporary, evidence) && within(temporary, output) && !within(workspace, evidence) && !within(workspace, output), "external temporary paths required")
check(inspection !== sourceRoot && within(workspace, inspection) && within(workspace, sourceRoot), "separate explicit source checkout required")
await mkdir(output, { mode: 0o700 })
const read = (root, name) => readFile(path.join(root, name))
const json = async (root, name) => JSON.parse(await read(root, name))
const write = async (name, value) => {
  const bytes = Buffer.from(JSON.stringify(value, null, 2) + "\n")
  await writeFile(path.join(output, name), bytes, { flag: "wx", mode: 0o600 })
  return { file: name, bytes: bytes.length, sha256: sha256(bytes) }
}
const sourceScanner = path.join(sourceRoot, "script/sf-ci/team-profile-residue.mjs")
same(gitBlob(await readFile(sourceScanner)), "10ae99ab085821f0e312ee05479cad3fb723c7b0", "canonical parser Git blob")
const canonical = await import(pathToFileURL(sourceScanner).href)
const stage = await json(evidence, "visual-stage-receipt.json")
const navigation = await json(path.join(inspection, ".github/ci"), "g09-v2-visual-navigation.json")
const proposal = await json(path.join(inspection, ".github/ci"), "g09-visual-source-proposals.json")
const expected = await json(evidence, "expected.json")
same(stage.originalIdentities, expected, "stage identities")
same(navigation.identities, expected, "visual target identities")
same(stage.inspection, { workflowSHA: process.env.GITHUB_SHA, runId: process.env.GITHUB_RUN_ID,
  runAttempt: process.env.GITHUB_RUN_ATTEMPT, job: process.env.GITHUB_JOB }, "actual inspection run")
check(expected.sourceSHA !== process.env.GITHUB_SHA && expected.runId !== process.env.GITHUB_RUN_ID,
  "inspection must not impersonate the original producer")
const reportRoot = path.join(evidence, "report"), packageRoot = path.join(evidence, "package")
const reportBytes = await read(reportRoot, "diagnostic.json")
same(sha256(reportBytes), navigation.reportSha256, "original report bytes")
const report = JSON.parse(reportBytes), binding = await json(reportRoot, "candidate-binding.json")
const provenance = await json(reportRoot, "artifact-provenance.json")
same(report.binding, navigation.binding, "original canonical binding")
const contextManifestBytes = await read(path.join(evidence, "canonical-context"), "manifest.json")
same(sha256(contextManifestBytes), stage.canonicalContextManifestSha256, "canonical context manifest")
const contextManifest = JSON.parse(contextManifestBytes)
same(contextManifest.sourceReportSha256, navigation.reportSha256, "context report")
same(contextManifest.binding, report.binding, "context binding")
for (const page of contextManifest.pages) {
  const bytes = await read(path.join(evidence, "canonical-context"), page.file)
  same([bytes.length, sha256(bytes)], [page.bytes, page.sha256], "original context page")
}
for (const [group, root] of [["report", reportRoot], ["package", packageRoot]]) {
  for (const item of stage.copiedMembers[group]) {
    const bytes = await read(root, item.path)
    same([bytes.length, sha256(bytes)], [item.bytes, item.sha256], "staged preserved member")
  }
}
const verified = canonical.verifyGitSource(await read(reportRoot, "commit.raw"), await read(reportRoot, "tracked.z"), expected.sourceSHA)
same(verified.tree, expected.sourceTreeSHA, "actual source tree")
const entries = new Map(verified.entries.map((entry) => [entry.path, entry]))
const inventory = new Map(report.inventory.map((file) => [file.domain + ":" + file.path, file]))
const sourceFiles = new Map()
async function sourceFile(name) {
  if (sourceFiles.has(name)) return sourceFiles.get(name)
  canonical.safePath(name)
  const entry = entries.get(name), full = path.join(sourceRoot, name)
  check(entry?.type === "blob" && ["100644", "100755"].includes(entry.mode), "source must be a tracked regular file: " + name)
  same(await realpath(full), full, "source symlink")
  check((await lstat(full)).isFile(), "source regular file")
  const bytes = await readFile(full)
  same(gitBlob(bytes), entry.oid, "actual source Git blob")
  const file = canonical.record("source", name, bytes), declared = inventory.get("source:" + name)
  check(declared, "source missing from original inventory")
  same([file.sha256, file.byteLength, file.encoding], [declared.sha256, declared.byteLength, declared.encoding], "source inventory bytes")
  sourceFiles.set(name, file)
  return file
}
same(JSON.parse((await sourceFile("package.json")).text).workspaces.catalog.typescript, ts.version, "source parser catalog")
const archiveName = "orchestra-sf-entra-linux-x64-baseline.tar.gz"
const archiveBytes = await read(packageRoot, archiveName)
const archiveSHA = "af312871e79307bd281e7d46a162feeb44bc0112db0e67cb59f8be55db20a109"
same(sha256(archiveBytes), archiveSHA, "actual archive digest")
for (const value of [binding, provenance, report.artifact]) same(value.archiveSha256, archiveSHA, "preserved archive binding")
same(binding.binarySha256, "724894cb17c5781a9fd7a23be6de2f191fb1d62abdfa51835c74b5c88a4ad242", "preserved ELF binding")
const packed = canonical.readTarArchive(archiveBytes), byPath = new Map(packed.map((file) => [file.path, file]))
same(byPath.get("bin/orchestra")?.sha256, binding.binarySha256, "actual ELF bytes; never executed")
const inventoryBytes = await read(packageRoot, archiveName + ".inventory.json")
const receiptBytes = await read(packageRoot, "g09-artifact-receipt.json")
const archivedInventory = canonical.parseCanonicalJson(inventoryBytes, "preserved archive inventory")
const receipt = canonical.parseCanonicalJson(receiptBytes, "preserved archive receipt")
same([sha256(inventoryBytes), sha256(receiptBytes)], [provenance.inventorySha256, provenance.receiptSha256], "preserved receipt/inventory hashes")
same([receipt.schema, receipt.proofRole, receipt.sourceSHA, receipt.sourceTreeSHA, receipt.archiveFile,
  receipt.archiveSha256, receipt.archiveBytes, receipt.inventoryFile, receipt.inventorySha256, receipt.extractedVerified,
  receipt.target, receipt.channel, receipt.brand, receipt.viteEnvironmentInputs],
["sf-teams-production-artifact-v1", "sf-production-archive", expected.sourceSHA, expected.sourceTreeSHA,
  archiveName, archiveSHA, archiveBytes.length, archiveName + ".inventory.json", sha256(inventoryBytes), true,
  "linux-x64-baseline", "prod", "sucafina", 0], "preserved production receipt fields")
same([archivedInventory.schema, archivedInventory.sourceSHA, archivedInventory.sourceTreeSHA,
  archivedInventory.archiveFile, archivedInventory.archiveSha256],
["sf-teams-archive-inventory-v1", expected.sourceSHA, expected.sourceTreeSHA, archiveName, archiveSHA], "preserved inventory identity")
const actualMembers = packed.map(({ path, byteLength, sha256 }) => ({ path, byteLength, sha256 }))
same(archivedInventory.files, actualMembers, "every actual tar member")
same(receipt.archiveFileCount, packed.length, "actual archive count")
for (const file of packed) {
  const original = inventory.get("archive:" + file.path)
  check(original, "actual tar member absent from original report")
  same([file.sha256, file.byteLength, file.encoding], [original.sha256, original.byteLength, original.encoding], "archive report inventory")
}
same(report.inventory.filter((file) => file.domain === "archive").length, packed.length, "complete archive report inventory")
const distribution = byPath.get("distribution.json")
same(distribution?.sha256, receipt.manifestSha256, "embedded distribution")
const descriptor = JSON.parse(distribution.text)
same([descriptor.files.length, descriptor.files.filter((file) => file.path.startsWith("bin/web/")).length,
  descriptor.target, descriptor.version], [receipt.fileCount, receipt.webFileCount, receipt.target, receipt.version], "distribution counters")
same(packed.length, descriptor.files.length + 2, "distribution inventory count")
check(new Set(descriptor.files.map((file) => file.path)).size === descriptor.files.length &&
  descriptor.files.every((file) => byPath.has(file.path)) && byPath.has("checksums.sha256"), "distribution membership")
const compileBytes = await read(packageRoot, "compile-provenance.json")
same(sha256(compileBytes), binding.compileProvenanceSha256, "original compile provenance")
const compile = canonical.parseCanonicalJson(compileBytes, "compile provenance")
same([compile.schema, compile.sourceSHA, compile.sourceTreeSHA, compile.workflowSHA, compile.runId,
  compile.runAttempt, compile.job, compile.checkRunId, compile.binary?.path, compile.binary?.sha256, compile.archiveSha256],
["sf-linux-compile-provenance-v2", expected.sourceSHA, expected.sourceTreeSHA, expected.workflowSHA,
  expected.runId, expected.runAttempt, "teams-profile-artifact", expected.producerCheckRunId, "bin/orchestra",
  binding.binarySha256, archiveSHA], "original compile identity")
const native = canonical.parseCanonicalJson(await read(packageRoot, "orchestra-sf-entra-package-receipt.json"), "native package receipt")
same([native.sourceSHA, native.checkoutSHA, native.expectedSourceSHA, native.archiveSha256, native.runID, native.runAttempt],
[expected.sourceSHA, expected.sourceSHA, expected.sourceSHA, archiveSHA, expected.runId, expected.runAttempt], "native original identity")

const controls = syntaxControls()
const originalRows = new Map(report.occurrences.map((row) => [row.id, row]))
const priorRows = new Map(proposal.sourceOccurrences.map((row) => [row.id, row]))
const results = [], fileResults = [], parsedSources = new Map()
function occurrences(file) {
  const actual = canonical.findOccurrences([file])
  const original = report.occurrences.filter((row) => row.domain === file.domain && row.path === file.path)
  same(actual.map((row) => row.id), original.map((row) => row.id), "all exact occurrence IDs in " + file.path)
  for (const row of actual) {
    const original = originalRows.get(row.id)
    for (const [key, value] of Object.entries(row)) same(original[key], value, "exact occurrence identity field")
  }
  return original
}
function addResult(file, row, css, parsed, decodedRange, literal = null) {
  const context = cssContext(css, parsed, decodedRange.start, decodedRange.end)
  same(css.slice(decodedRange.start, decodedRange.end), row.seed, "decoded span seed")
  const cssBytes = parsed.byteOffsets ??= byteMap(css)
  const result = { original: row, canonicalDisposition: null, proposedClassification: "different-meaning",
    context: { ...context, coordinateSystem: literal ? "decoded-CSS-UTF16" : "file-UTF16",
      inspectedSpan: decodedRange, inspectedSpanUtf8: { start: cssBytes.byte(decodedRange.start), end: cssBytes.byte(decodedRange.end) } },
    literal, sourceComparison: null }
  if (file.domain === "source") {
    const prior = priorRows.get(row.id)
    check(prior, "source occurrence missing from previous exact context reference")
    const priorKind = prior.context === "comment" ? "css-comment" : prior.context
    same(context.kind, priorKind, "prior source context category")
    if (context.kind === "css-class-selector") same(context.classToken, prior.classToken, "prior complete source class token")
  }
  results.push(result)
  return result
}
for (const target of proposal.sourceFiles) {
  const file = await sourceFile(target.path), entry = entries.get(target.path)
  same([entry.oid, file.sha256, file.byteLength, file.encoding],
    [target.gitBlob, target.fileSha256, target.bytes, "utf8"], "frozen source CSS reference")
  const parsed = inspectCss(file.text), map = byteMap(file.text), rows = occurrences(file)
  same(rows.length, target.occurrences, "source occurrence count")
  for (const row of rows) addResult(file, row, file.text, parsed,
    { start: map.char(row.byteOffset), end: map.char(row.byteOffset + row.byteLength) })
  parsedSources.set(file.path, parsed)
  fileResults.push({ domain: file.domain, path: file.path, sha256: file.sha256, gitBlob: entry.oid,
    occurrences: rows.length, inspection: "CSS lexical and selector contexts" })
}
const paletteSources = {
  "bin/web/assets/palette-amoled-CIzcJbF7.js": "packages/app-shell/src/orchestra/palette/generated/palette-amoled.css",
  "bin/web/assets/palette-github-B8IT1y1k.js": "packages/app-shell/src/orchestra/palette/generated/palette-github.css",
  "bin/web/assets/palette-graphite-CaPSbzy0.js": "packages/app-shell/src/orchestra/palette/generated/palette-graphite.css",
  "bin/web/assets/palette-gruvbox-C4SpMCMX.js": "packages/app-shell/src/orchestra/palette/generated/palette-gruvbox.css",
  "bin/web/assets/palette-nord-C0R1snk8.js": "packages/app-shell/src/orchestra/palette/generated/palette-nord.css",
}
const literalProofs = []
for (const target of navigation.files) {
  const file = byPath.get(target.path)
  check(file, "selected actual archive member missing")
  same([file.sha256, file.encoding], [target.fileSha256, "utf8"], "v2 visual target bytes")
  const rows = occurrences(file), map = byteMap(file.text)
  same(rows.length, target.occurrences, "selected archive occurrence count")
  same(report.reachability.findings.filter((item) => item.domain === "archive" && item.path === file.path).length, 0, "unexpected selected archive finding")
  const isPalette = Object.hasOwn(paletteSources, file.path)
  const literal = isPalette ? staticCssModule(file) : null
  const css = literal?.cooked ?? file.text, parsed = inspectCss(css)
  for (const row of rows) {
    const rawRange = { start: map.char(row.byteOffset), end: map.char(row.byteOffset + row.byteLength) }
    const decodedRange = literal ? literal.map(rawRange.start, rawRange.end) : rawRange
    addResult(file, row, css, parsed, decodedRange, literal ? {
      ast: literal.ast, rawSpan: rawRange, rawSpanUtf8: { start: row.byteOffset, end: row.byteOffset + row.byteLength },
      decodedCssSha256: sha256(Buffer.from(css)),
      escapeMapReference: file.path,
    } : null)
  }
  if (literal) {
    const generated = await sourceFile(paletteSources[file.path])
    const sourceRows = results.filter((item) => item.original.domain === "source" && item.original.path === generated.path)
    const archiveRows = results.filter((item) => item.original.domain === "archive" && item.original.path === file.path)
    const sourceSequence = sourceRows.map((item) => [item.original.seed, item.context.classToken])
    const archiveSequence = archiveRows.map((item) => [item.original.seed, item.context.classToken])
    const orderedTokensSame = compact(sourceSequence) === compact(archiveSequence)
    const proof = {
      path: file.path, fileSha256: file.sha256, ast: literal.ast,
      literalRawSha256: sha256(Buffer.from(literal.raw)), decodedCssSha256: sha256(Buffer.from(css)),
      escapeSegments: literal.segments, decodedCssBytes: Buffer.byteLength(css),
      source: { path: generated.path, fileSha256: generated.sha256 },
      exactDecodedBytesEqualSource: Buffer.from(css).equals(generated.data),
      nonWhitespaceCssTokensEqualSource: tokenSignature(parsed.tokens) === tokenSignature(parsedSources.get(generated.path).tokens),
      orderedSeedAndClassTokensEqualSource: orderedTokensSame,
      comparisonLimit: "Token sequence correspondence is not byte identity, a source map, or a browser equivalence proof.",
    }
    if (orderedTokensSame) archiveRows.forEach((row, index) => {
      row.orderedSourceCorrespondence = { id: sourceRows[index].original.id,
        basis: "same ordinal in independently inspected ordered seed/full-class-token sequence",
        exactSelectorTokensEqual: row.context.selectorTokenSignature === sourceRows[index].context.selectorTokenSignature }
    })
    literalProofs.push(proof)
  }
  fileResults.push({ domain: "archive", path: file.path, sha256: file.sha256, occurrences: rows.length,
    inspection: literal ? "TypeScript static export, exact escape mapping, then CSS contexts" : "CSS lexical and selector contexts" })
}
same(results.filter((item) => item.original.domain === "source").length, 1424, "complete source visual scope")
same(results.filter((item) => item.original.domain === "archive").length, 1425, "complete archive visual scope")
same(literalProofs.length, 5, "five actual static CSS modules")
const generatedPaths = new Set(Object.values(paletteSources))
for (const row of results.filter((item) => item.original.domain === "archive")) {
  const matchingPool = results.filter((item) => item.original.domain === "source" &&
    (paletteSources[row.original.path] ? item.original.path === paletteSources[row.original.path] : !generatedPaths.has(item.original.path)))
  const matches = matchingPool.filter((item) => item.context.kind === row.context.kind &&
    (row.context.kind === "css-class-selector" ? item.context.classToken === row.context.classToken : item.context.text === row.context.text))
  row.sourceComparison = {
    basis: row.context.kind === "css-class-selector" ? "same complete inspected class token" : "same complete comment bytes",
    candidateSourceOccurrenceIds: matches.map((item) => item.original.id),
    exactNonWhitespaceSelectorTokenIds: matches.filter((item) =>
      row.context.kind === "css-class-selector" && item.context.selectorTokenSignature === row.context.selectorTokenSignature).map((item) => item.original.id),
    correspondenceIsNotUniqueIdentity: true,
  }
}
const selectedPaths = {
  source: new Set([...proposal.sourceFiles.map((item) => item.path), ...proposal.sourceConsumerBindings.observedChain.map((item) => item.path)]),
  archive: new Set(navigation.files.map((item) => item.path)),
}
const graphEvidence = { source: { files: [], edges: [], callsites: [] }, archive: { files: [], edges: [], callsites: [] } }
for (const domain of ["source", "archive"]) {
  const graph = report.reachability[domain], outputGraph = graphEvidence[domain]
  for (const name of selectedPaths[domain]) {
    const file = domain === "source" ? await sourceFile(name) : byPath.get(name)
    check(file, "selected graph context member missing")
    outputGraph.files.push({ path: name, fileSha256: file.sha256, reachable: graph.reachable[name] ?? [] })
  }
  for (const edge of graph.edges.filter((edge) => selectedPaths[domain].has(edge.from) ||
      edge.targets.some((target) => selectedPaths[domain].has(target)))) {
    const file = domain === "source" ? await sourceFile(edge.from) : byPath.get(edge.from)
    check(file && file.sha256 === edge.fileSha256, "actual import/caller bytes differ")
    const bounded = Number.isInteger(edge.start) && Number.isInteger(edge.end)
    if (bounded) check(file.text !== undefined && edge.start >= 0 && edge.end <= file.text.length && edge.start < edge.end, "edge syntax range")
    outputGraph.edges.push({ original: edge,
      actualText: bounded ? file.text.slice(edge.start, edge.end) : null,
      contextText: bounded ? file.text.slice(Math.max(0, edge.start - 100), Math.min(file.text.length, edge.end + 180)) : null,
      interpretation: bounded ? "original lexical/content edge with actual file bytes" : "manifest membership, not a function call" })
  }
  const calls = new Set(results.filter((item) => item.original.domain === domain).flatMap((item) => item.original.callsites ?? []))
  for (const call of graph.calls.filter((item) => calls.has(item.id))) {
    const file = domain === "source" ? await sourceFile(call.path) : byPath.get(call.path)
    check(file?.sha256 === call.fileSha256 && file.text !== undefined, "actual lexical callsite bytes")
    outputGraph.callsites.push({ original: call, actualText: file.text.slice(call.start, call.end) })
  }
}
const consumers = []
for (const item of proposal.sourceConsumerBindings.observedChain) {
  const file = await sourceFile(item.path)
  same(entries.get(item.path).oid, item.gitBlob, "source stylesheet consumer Git blob")
  consumers.push({ ...item, fileSha256: file.sha256, byteLength: file.byteLength,
    evidenceRole: "same actual source bytes as the previously inspected consumer chain" })
}
const cssImports = []
for (const name of new Set([...parsedSources.keys(), "packages/app-shell/src/index.css"])) {
  const file = await sourceFile(name), parsed = parsedSources.get(name) ?? inspectCss(file.text)
  for (const statement of parsed.statements) {
    const tokens = statement.tokens
    if (tokens[0]?.value !== "@" || tokens[1]?.value.toLowerCase() !== "import" || tokens[2]?.kind !== "string") continue
    const specifier = tokens[2].value, target = path.posix.normalize(path.posix.join(path.posix.dirname(name), specifier))
    if (!selectedPaths.source.has(target)) continue
    cssImports.push({ from: name, fileSha256: file.sha256, target, start: statement.start, end: statement.end,
      actualText: file.text.slice(statement.start, statement.end), kind: "inspected-css-import-statement" })
  }
}
const outside = proposal.existingExecutedEvidence.outsidePaletteInputOrGeneratedSet
const outsideRows = results.filter((item) => item.original.domain === "source" && outside.some((file) => file.path === item.original.path))
same(outsideRows.length, 41, "41 source spans outside palette-generation test")
const outsideConsumers = outside.map((item) => {
  const incoming = graphEvidence.source.edges.filter((edge) => edge.original.targets.includes(item.path)).map((edge) => edge.original.id)
  const css = cssImports.filter((edge) => edge.target === item.path)
  check(incoming.length + css.length > 0, "outside-palette stylesheet has no inspected consumer reference: " + item.path)
  return { ...item, originalImportEdgeIds: incoming, inspectedCssImports: css,
    inspectedOccurrenceIds: outsideRows.filter((row) => row.original.path === item.path).map((row) => row.original.id) }
})
const sourceGroups = results.filter((item) => item.original.domain === "source")
const cases = [
  controls,
  { caseName: "every selected source occurrence is bounded to an inspected CSS class or comment", status: "PASS", files: 26, occurrences: 1424 },
  { caseName: "every selected archive occurrence is bounded to inspected CSS or a mapped static CSS string", status: "PASS", files: 17, occurrences: 1425 },
  { caseName: "the 41 source spans outside the palette test have inspected contexts and consumer references", status: "PASS", files: 6, occurrences: 41 },
]
const review = {
  schema: "sf-g09-visual-context-inspection-v1", status: "READ_ONLY_INSPECTION_COMPLETE",
  formalG09Pass: false, assignedCanonicalDispositions: 0, productExecuted: false,
  sourceSHA: expected.sourceSHA, sourceTreeSHA: expected.sourceTreeSHA, originalIdentities: expected,
  originalReportSha256: navigation.reportSha256, originalReportBinding: report.binding,
  inspection: stage.inspection, tools: { node: process.version, typescript: ts.version,
    helperGitBlob: gitBlob(await readFile(fileURLToPath(import.meta.url))), canonicalParserGitBlob: "10ae99ab085821f0e312ee05479cad3fb723c7b0" },
  artifact: { evidenceRole: "preserved original bytes re-read during a separate inspection",
    artifactId: expected.producerArtifactId, artifactZipSha256: stage.producerZipSha256,
    archiveSha256: archiveSHA, binarySha256: binding.binarySha256, compileProvenanceSha256: binding.compileProvenanceSha256,
    memberCount: packed.length },
  cases, files: fileResults, occurrences: results, staticCssModules: literalProofs,
  consumers, originalGraphContexts: graphEvidence, inspectedCssImports: cssImports,
  outsidePaletteTest: { occurrences: 41, files: outsideConsumers,
    evidenceRole: "external read-only syntactic inspection; not credited to palette.test.ts" },
  limits: [
    "Exact class/comment spans are proposed different-meaning; this is not a blanket classification of files, extensions or callers.",
    "The CSS reader is bounded lexical/structural inspection, not a full standards validator or a rendering engine.",
    "TypeScript proves these selected module bodies are static string exports; no JavaScript or ELF from the artifact was executed.",
    "Original graph edges remain lexical/content references, not a qualified semantic call graph.",
    "No browser render, palette selection, corporate authority, full SF CI, canonical testObligation or signed G09 pass is claimed.",
    "This later inspection is external evidence and never impersonates the original source/workflow/run.",
  ],
}
const outputFile = await write("visual-context-inspection.json", review)
const groups = new Map()
for (const row of [...results.filter((item) => item.original.domain === "archive"), ...outsideRows]) {
  const context = row.context
  const key = compact([row.original.domain, row.original.path, context.kind, context.classToken, context.selector, context.atRules, context.text])
  if (!groups.has(key)) groups.set(key, {
    domain: row.original.domain, path: row.original.path, context: context.kind, classToken: context.classToken,
    selector: context.selector, atRules: context.atRules, comment: context.text, ids: [],
    sourceCandidateCount: row.sourceComparison?.candidateSourceOccurrenceIds.length ?? null,
    literal: !!row.literal,
  })
  groups.get(key).ids.push(row.original.id)
}
const readable = [...groups.values()]
const textBytes = Buffer.from(readable.map((item) => compact(item)).join("\n") + "\n")
await writeFile(path.join(output, "visual-readable-contexts.jsonl"), textBytes, { flag: "wx", mode: 0o600 })
const receiptOutput = await write("visual-inspection-receipt.json", {
  schema: "sf-g09-visual-inspection-receipt-v1", originalIdentities: expected, originalReportSha256: navigation.reportSha256,
  inspection: stage.inspection, toolGitBlob: review.tools.helperGitBlob, cases, artifact: review.artifact,
  report: outputFile, readableContexts: { file: "visual-readable-contexts.jsonl", bytes: textBytes.length,
    sha256: sha256(textBytes), groups: readable.length },
  sourceContexts: { occurrences: sourceGroups.length,
    classes: sourceGroups.filter((item) => item.context.kind === "css-class-selector").length,
    comments: sourceGroups.filter((item) => item.context.kind === "css-comment").length },
  formalG09Pass: false, canonicalDispositions: 0, canonicalTestObligationsAdded: 0,
})
check(textBytes.length <= 800000, "readable contexts exceed bounded stdout; preserved artifact remains available")
console.log("G09_VISUAL_INSPECTION " + compact({ receipt: receiptOutput, report: outputFile, cases,
  readableContextGroups: readable.length, readableContextBytes: textBytes.length, originalReportSha256: navigation.reportSha256,
  originalIdentities: expected, inspection: stage.inspection, formalG09Pass: false }))
console.log("G09_VISUAL_ACTUAL_CONTEXTS_BEGIN")
process.stdout.write(textBytes)
console.log("G09_VISUAL_ACTUAL_CONTEXTS_END")
