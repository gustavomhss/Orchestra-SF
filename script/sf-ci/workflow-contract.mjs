import { validateManifest } from "./gate.mjs"

// A2 -> A6 (sf-ci.yml owns only the wiring, not the selection policy):
// * sf/ci/suites.json schemaVersion=1; suites: [{ id, kind, directory,
//   selection: { kind: explicit|directory|full-except-release-only, testFiles?,
//                testDirectory?, releaseOnlyFiles? }, specFile? }].
// * Matrix IDs must equal the five Bun / three Playwright manifest IDs.
// * In BOTH job scripts, BEFORE any cd, from the repository root:
//     node script/sf-ci/gate.mjs select > "$evidence/selection.txt" || exit $?
//     mapfile -t files < "$evidence/selection.txt"
//     test "${#files[@]}" -gt 0 || exit 2         # Bun (UI: -eq 1)
//   select uses SF_SUITE_ID=${{ matrix.id }}, RUNNER_OS=Linux, RUNNER_ARCH=X64
//   and the real GITHUB_SHA/RUN_ID/RUN_ATTEMPT. stdout is newline-delimited,
//   sorted, checkout-validated paths relative to each suite.directory;
//   releaseOnlyFiles are excluded by the selector (not by YAML).
// * Every Bun case must execute bun test ... "${files[@]}" without file globs,
//   hardcoded file paths, path-ignore filters, extra selectors or bypasses.
// * UI must run: bun run test:e2e:local "${files[0]}" ... (no matrix.spec).
// This checks *binding* to the authoritative selector, not a literal example
// test command or shell execution; GitHub Actions must prove actual execution.
const fail = (message) => { throw new Error("SF_CI_WORKFLOW_SELECTION: " + message) }
const requireContract = (condition, message) => { if (!condition) fail(message) }

function jobBlock(workflow, name) {
  const lines = workflow.split("\n")
  const start = lines.findIndex((line) => line === `  ${name}:`)
  requireContract(start >= 0, `missing ${name} job`)
  const end = lines.findIndex((line, index) => index > start && /^  [a-z][\w-]*:\s*$/.test(line))
  return lines.slice(start, end < 0 ? undefined : end).join("\n")
}

function jobMatrixIds(job, kind) {
  requireContract(/^    strategy:\s*$/m.test(job) && /^      matrix:\s*$/m.test(job), `${kind}: no strategy matrix`)
  const compact = [...job.matchAll(/^        id:\s*\[([^\]\n]*)\]\s*$/gm)]
  const includes = [...job.matchAll(/^          - id:\s*(CI-[A-Z0-9-]+)\s*$/gm)]
  requireContract(compact.length + Number(includes.length > 0) === 1, `${kind}: ambiguous/absent suite matrix`)
  if (compact.length) return compact[0][1].split(",").map((item) => item.trim())
  return includes.map((match) => match[1])
}

function assertExactIds(actual, expected, context) {
  requireContract(actual.length === expected.length && new Set(actual).size === actual.length &&
    [...actual].sort().join("\0") === [...expected].sort().join("\0"),
  `${context}: suite matrix/branch differs from manifest (${JSON.stringify(actual)})`)
}

function runScripts(job) {
  const lines = job.split("\n")
  const scripts = []
  for (let index = 0; index < lines.length; index++) {
    if (!/^ {8}run: \|\s*$/.test(lines[index])) continue
    const content = []
    for (++index; index < lines.length; index++) {
      if (!lines[index].trim()) { content.push(""); continue }
      if (!lines[index].startsWith("          ")) { index--; break }
      content.push(lines[index].slice(10))
    }
    scripts.push(content.join("\n"))
  }
  return scripts
}

function cleanShell(script) {
  return script.split("\n").filter((line) => !/^\s*#/.test(line)).join("\n")
}

function assertSelectionDataflow(script, count, context) {
  const source = cleanShell(script)
  const selector = /^\s*node script\/sf-ci\/gate\.mjs select > "\$evidence\/selection\.txt" \|\| exit \$\?\s*$/gm
  const mapfile = /^\s*mapfile -t files < "\$evidence\/selection\.txt"\s*$/gm
  const nonempty = count === "bun"
    ? /^\s*test "\$\{#files\[@\]\}" -gt 0 \|\| exit [1-9][0-9]*\s*$/gm
    : /^\s*test "\$\{#files\[@\]\}" -eq 1 \|\| exit [1-9][0-9]*\s*$/gm
  const found = [selector, mapfile, nonempty].map((regex) => [...source.matchAll(regex)])
  requireContract(found.every((matches) => matches.length === 1), `${context}: must invoke selector, mapfile and nonempty guard exactly once`)
  const [selectPos, mapPos, guardPos] = found.map((matches) => matches[0].index)
  requireContract(selectPos < mapPos && mapPos < guardPos, `${context}: broken selector -> files -> guard ordering`)
  requireContract(!/^\s*cd\s+/m.test(source.slice(0, selectPos)), `${context}: selector invoked outside repository root`)
  requireContract(!/\bfiles\s*=\s*\(|\bfiles\[[^\]]+\]\s*=|\breadarray\b|\bmapfile\b(?! -t files < "\$evidence\/selection\.txt")/.test(source),
    `${context}: selected files overridden`)
  requireContract(!/\|\|\s*(?:true|:)(?:\s|$)/m.test(source), `${context}: ignored selector/runner failure`)
  return { source, guardPos }
}

function caseArms(source) {
  const lines = source.split("\n")
  const first = lines.findIndex((line) => /^\s*case "\$SF_SUITE_ID" in\s*$/.test(line))
  requireContract(first >= 0, "unit: missing SF_SUITE_ID dispatch")
  const last = lines.findIndex((line, index) => index > first && /^\s*esac\s*$/.test(line))
  requireContract(last > first, "unit: missing case terminator")
  const arms = new Map()
  let name = null
  let content = []
  for (const line of lines.slice(first + 1, last)) {
    const match = /^\s*(CI-[A-Z0-9-]+|\*)\)\s*(.*)$/.exec(line)
    if (match) {
      requireContract(name === null && !arms.has(match[1]), "unit: missing case terminator or duplicate arm")
      name = match[1]
      content = []
      if (match[2]) {
        requireContract(/;;\s*$/.test(match[2]), "unit: unexpected inline case body")
        arms.set(name, cleanShell(match[2].replace(/;;\s*$/, "")))
        name = null
      }
    } else if (/^\s*;;\s*$/.test(line)) {
      requireContract(name !== null, "unit: stray case terminator")
      arms.set(name, cleanShell(content.join("\n")))
      name = null
    } else if (name !== null) content.push(line)
    else if (line.trim()) fail("unit: executable code outside a case arm")
  }
  requireContract(name === null, "unit: unterminated case arm")
  return { arms, casePos: source.indexOf(lines[first]) }
}

function assertNoHardcodes(source, context) {
  const withoutComments = cleanShell(source)
  requireContract(!/(?:^|[^\w/])[\w./-]+\.(?:test|spec)\.[cm]?[jt]sx?\b/m.test(withoutComments),
    `${context}: literal test/spec path bypasses manifest`)
  requireContract(!/--path-ignore-patterns|--test-name-pattern|--pass-with-no-tests|--filter\b|\btest:unit\b|gate\.mjs release-only/.test(withoutComments),
    `${context}: path filtering, bypass or hardcoded test runner`)
}

export function assertWorkflowManifestSelection(workflow, manifest) {
  const suites = validateManifest(manifest)
  const unitSuites = suites.filter((suite) => suite.kind === "bun")
  const uiSuites = suites.filter((suite) => suite.kind === "playwright")
  const unit = jobBlock(workflow, "unit")
  const ui = jobBlock(workflow, "ui")
  for (const [job, name, expected] of [[unit, "unit", unitSuites], [ui, "ui", uiSuites]]) {
    requireContract(/^      SF_SUITE_ID:\s*\$\{\{\s*matrix\.id\s*\}\}\s*$/m.test(job), `${name}: SF_SUITE_ID not bound to matrix.id`)
    assertExactIds(jobMatrixIds(job, name), expected.map((suite) => suite.id), name)
  }
  const unitScripts = runScripts(unit)
  const uiScripts = runScripts(ui)
  requireContract(unitScripts.length === 1 && uiScripts.length === 1, "one auditable execution script required per unit/ui job")
  const selectedUnit = assertSelectionDataflow(unitScripts[0], "bun", "unit")
  const selectedUi = assertSelectionDataflow(uiScripts[0], "ui", "ui")
  const { arms, casePos } = caseArms(selectedUnit.source)
  requireContract(selectedUnit.guardPos < casePos, "unit: selector/guard must apply before every case")
  assertExactIds([...arms.keys()].filter((id) => id !== "*"), unitSuites.map((suite) => suite.id), "unit arms")
  requireContract(/^.*\bexit [1-9][0-9]*\b/m.test(arms.get("*") || ""), "unit: unknown suite must fail")
  for (const suite of unitSuites) {
    const body = arms.get(suite.id)
    const flat = body.replace(/\\\n\s*/g, " ")
    const commands = flat.split("\n").filter((line) => /\bbun test\b/.test(line))
    const selectedFromManifest = suite.id === "CI-SF"
      ? /--files-from "\$evidence\/selection\.txt"/.test(commands[0]) && !/"\$\{files\[@\]\}"/.test(commands[0])
      : /"\$\{files\[@\]\}"/.test(commands[0]) && !/--files-from/.test(commands[0])
    requireContract(commands.length === 1 && selectedFromManifest,
      `${suite.id}: Bun must consume exactly the complete manifest-selected files`)
    if (suite.id === "CI-APP-BROWSER" || suite.id === "CI-SF") {
      requireContract(/(?:^|\s)--bail=5(?:\s|$)/.test(commands[0]), `${suite.id}: --bail=5 lost`)
    }
    if (suite.id === "CI-APP-BROWSER") {
      requireContract(/(?:^|\s)--conditions=browser(?:\s|$)/.test(commands[0]), "CI-APP-BROWSER: browser execution condition lost")
    }
    if (suite.selection.testDirectory && suite.selection.testDirectory !== ".") {
      requireContract(!commands[0].includes(suite.selection.testDirectory), `${suite.id}: directory was hardcoded`)
    }
    assertNoHardcodes(body, suite.id)
  }
  requireContract((selectedUnit.source.match(/\bbun test\b/g) || []).length === unitSuites.length, "unit: unexpected Bun invocation outside suite branches")
  assertNoHardcodes(selectedUnit.source, "unit")
  requireContract(!/^\s*SF_SPEC:\s*/m.test(ui) && !/^\s*spec:\s*/m.test(ui), "ui: matrix.spec overrides manifest")
  requireContract(!/\bSF_SPEC\b/.test(selectedUi.source), "ui: spec supplied outside selector")
  requireContract(uiSuites.every((suite) => !ui.includes(suite.specFile)), "ui: literal spec list bypasses selector")
  const uiFlat = selectedUi.source.replace(/\\\n\s*/g, " ")
  const uiCommands = uiFlat.split("\n").filter((line) => /\bbun run test:e2e:local\b/.test(line))
  requireContract(uiCommands.length === 1 && /"\$\{files\[0\]\}"/.test(uiCommands[0]),
    "ui: Playwright must consume the single manifest-selected spec")
  assertNoHardcodes(selectedUi.source, "ui")
  return { bun: unitSuites.map((suite) => suite.id), playwright: uiSuites.map((suite) => suite.id) }
}
