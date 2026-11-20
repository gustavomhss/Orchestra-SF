import { SHARDED, validateManifest } from "./gate.mjs"

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
//   and the exact product SHA plus actual GITHUB_RUN_ID/GITHUB_RUN_ATTEMPT. stdout is newline-delimited,
//   sorted, checkout-validated paths relative to each suite.directory;
//   releaseOnlyFiles are excluded by the selector (not by YAML).
// * Bun prefixes only its in-memory argv with one exact ./ loop after the guard.
// * Each Bun job admits one strict Python timing sidecar; UI admits none.
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
  let stepStart = -1
  requireContract(!/^ {6}-\s*(?:\{|\*|&)/m.test(job), "flow or aliased steps are not auditable")
  requireContract(!/^\s*(?:-\s*)?<<:/m.test(job), "merged YAML metadata is not an auditable execution step")
  for (let index = 0; index < lines.length; index++) {
    if (/^ {6}- /.test(lines[index])) stepStart = index
    if (!/^(?: {8}(?:run|["']run["']):| {6}- (?:run|["']run["']):)/.test(lines[index])) continue
    requireContract(stepStart >= 0 && /^ {8}run: \|\s*$/.test(lines[index]),
      "every run step must use one explicit literal script")
    const header = lines.slice(stepStart, index)
    const content = []
    for (++index; index < lines.length; index++) {
      if (!lines[index].trim()) { content.push(""); continue }
      if (!lines[index].startsWith("          ")) break
      content.push(lines[index].slice(10))
    }
    const next = lines.findIndex((line, offset) => offset >= index && /^ {6}- /.test(line))
    scripts.push({
      script: content.join("\n"),
      metadata: [...header, ...lines.slice(index, next < 0 ? undefined : next)]
        .filter((line) => line.trim() && !/^\s*#/.test(line)),
    })
    index--
  }
  return scripts
}

/** Admit the entire sidecar, without discarding unknown shell commands. */
function assertTimingSidecar(step, context) {
  const metadata = [
    "        if: always() && !cancelled() && steps.tests.outcome != 'skipped'",
    "        env:",
    "          TEST_CONCLUSION: ${{ steps.tests.outcome }}",
  ]
  requireContract(step.metadata.length === metadata.length + 1 &&
    /^ {6}- name: \S.+$/.test(step.metadata[0]) &&
    step.metadata.slice(1).every((line, index) => line === metadata[index]),
  context + ": timing step metadata must bind only the actual test outcome")
  const evidence = context === "unit" ? "sf-ci-evidence/$SF_SUITE_ID" : "sf-ci-evidence/CI-SF-shard-$SF_SHARD_INDEX"
  const command = [
    "python3 script/sf-ci/timings.py",
    '--report "' + evidence + '/report.xml"',
    '--output "' + evidence + '/timings.json"',
    '--source-sha "$SF_PRODUCT_SOURCE_SHA" --run-id "$GITHUB_RUN_ID" --run-attempt "$GITHUB_RUN_ATTEMPT"',
    '--job-name "$GITHUB_JOB"',
    context === "unit"
      ? '--suite "$SF_SUITE_ID" --directory "${SF_TIMINGS_DIRECTORY:-.}" --file-root "$GITHUB_WORKSPACE/${SF_TIMINGS_DIRECTORY:-.}"'
      : '--suite CI-SF --directory modules/sucafina --file-root "$GITHUB_WORKSPACE/modules/sucafina"',
    '--conclusion "$TEST_CONCLUSION"',
    ...(context === "unit-sf" ? ['--shard-index "$SF_SHARD_INDEX" --shard-count "$SF_SHARD_COUNT"'] : []),
  ].join(" ")
  const actual = step.script.replace(/\\\n[ \t]*/g, " ").trim()
  requireContract(!actual.includes("\n") && actual.replace(/[ \t]+/g, " ") === command,
    context + ": timing sidecar must be exactly one admitted Python command")
}

/** These two complete UI setup steps do not choose or execute test files. */
function withoutUiBootstraps(job) {
  const expected = [
    [
      "      - name: Install Chromium for Linux only",
      "        working-directory: packages/app-shell",
      "        run: bunx playwright install --with-deps chromium",
    ].join("\n"),
    [
      "      - name: Qualify real loopback ClamD for Operations uploads",
      "        if: ${{ matrix.id == 'CI-UI-OPERATIONS' }}",
      "        shell: bash",
      "        run: bash script/sf-ci/operations-clamd.sh",
    ].join("\n"),
  ]
  const lines = job.split("\n")
  const starts = lines.flatMap((line, index) => /^ {6}- /.test(line) ? [index] : [])
  const steps = starts.map((start, index) => lines.slice(start, starts[index + 1]).join("\n").trimEnd())
  const selectPos = job.indexOf("node script/sf-ci/gate.mjs select")
  let previous = -1
  for (const step of expected) {
    requireContract(steps.filter((block) => block === step).length === 1,
      "ui: exactly one unchanged Chromium and ClamD bootstrap is required")
    const position = job.indexOf(step)
    requireContract(position > previous && position < selectPos, "ui: bootstraps must precede the test execution in order")
    previous = position
  }
  return expected.reduce((text, step) => text.replace(step, ""), job)
}

function executionScript(job, context) {
  const scripts = runScripts(context === "ui" ? withoutUiBootstraps(job) : job)
  requireContract(scripts.length === (context === "ui" ? 1 : 2),
    context + ": one execution script and only the admitted Bun timing sidecar are required")
  if (context !== "ui") {
    requireContract(scripts[0].metadata.filter((line) => line === "        id: tests").length === 1,
      context + ": timing outcome must refer to the execution step")
    assertTimingSidecar(scripts[1], context)
  }
  return scripts[0].script
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
  requireContract(found.every((matches) => matches.length === 1), context + ": must invoke selector, mapfile and nonempty guard exactly once")
  const [selectPos, mapPos, guardPos] = found.map((matches) => matches[0].index)
  requireContract(selectPos < mapPos && mapPos < guardPos, context + ": broken selector -> files -> guard ordering")
  requireContract(!/^\s*cd\s+/m.test(source.slice(0, selectPos)), context + ": selector invoked outside repository root")
  const prefix = 'for index in "${!files[@]}"; do files[$index]="./${files[$index]}"; done'
  const prefixes = source.split("\n").filter((line) => line === prefix)
  requireContract(prefixes.length === (count === "bun" ? 1 : 0), context + ": explicit file prefix loop must occur exactly once for Bun")
  const prefixPos = source.indexOf(prefix)
  const executePos = source.search(/\bbun (?:test|run test:e2e:local)\b/)
  requireContract(executePos > guardPos && (count !== "bun" || (prefixPos > guardPos && prefixPos < executePos)),
    context + ": explicit file prefix must follow the guard and precede execution")
  // Only the admitted prefix changes argv. Every other files reference must
  // read the complete Bun array or the single UI spec; the saved inventory stays intact.
  const admitted = new Set(found.map((matches) => matches[0][0].trim()))
  const untouched = source.split("\n")
    .filter((line) => !admitted.has(line.trim()) && !(count === "bun" && line === prefix)).join("\n")
    .replaceAll(count === "bun" ? "${files[@]}" : "${files[0]}", "")
  requireContract(!/\bfiles\b|\breadarray\b|\bmapfile\b|\bselection\.txt\b/.test(untouched),
    context + ": selected files overridden or selection inventory rewritten")
  requireContract(!/\|\|\s*(?:true|:)(?:\s|$)/m.test(source), context + ": ignored selector/runner failure")
  return { source, guardPos, prefixPos }
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
  const shardedSuites = unitSuites.filter((suite) => SHARDED[suite.id])
  const singleSuites = unitSuites.filter((suite) => !SHARDED[suite.id])
  const unit = jobBlock(workflow, "unit")
  const ui = jobBlock(workflow, "ui")
  for (const [job, name, expected] of [[unit, "unit", singleSuites], [ui, "ui", uiSuites]]) {
    requireContract(/^      SF_SUITE_ID:\s*\$\{\{\s*matrix\.id\s*\}\}\s*$/m.test(job), `${name}: SF_SUITE_ID not bound to matrix.id`)
    assertExactIds(jobMatrixIds(job, name), expected.map((suite) => suite.id), name)
  }
  const selectedUnit = assertSelectionDataflow(executionScript(unit, "unit"), "bun", "unit")
  const selectedUi = assertSelectionDataflow(executionScript(ui, "ui"), "ui", "ui")
  const directoryExport = 'printf \'SF_TIMINGS_DIRECTORY=%s\\n\' "$suite_dir" >> "$GITHUB_ENV"'
  const unitLines = selectedUnit.source.split("\n")
  const exported = unitLines.indexOf(directoryExport)
  requireContract(exported > 0 && unitLines[exported - 1] === 'test -f "$root/$suite_dir/package.json"' &&
    (selectedUnit.source.match(/\bSF_TIMINGS_DIRECTORY\b/g) || []).length === 1,
  "unit: timing directory must be published once immediately after the validated suite directory")
  const { arms, casePos } = caseArms(selectedUnit.source)
  requireContract(selectedUnit.prefixPos < casePos, "unit: selector/guard/prefix must apply before every case")
  assertExactIds([...arms.keys()].filter((id) => id !== "*"), singleSuites.map((suite) => suite.id), "unit arms")
  requireContract(/^.*\bexit [1-9][0-9]*\b/m.test(arms.get("*") || ""), "unit: unknown suite must fail")
  for (const suite of singleSuites) {
    const body = arms.get(suite.id)
    const flat = body.replace(/\\\n\s*/g, " ")
    const commands = flat.split("\n").filter((line) => /\bbun test\b/.test(line))
    requireContract(commands.length === 1 && (commands[0].match(/"\$\{files\[@\]\}"/g) || []).length === 1,
      `${suite.id}: Bun must consume all files from selector as argv, exactly once`)
    if (suite.id === "CI-APP-BROWSER") {
      requireContract(/(?:^|\s)--bail=5(?:\s|$)/.test(commands[0]), "CI-APP-BROWSER: --bail=5 lost")
    }
    if (suite.id === "CI-APP-BROWSER") {
      requireContract(/(?:^|\s)--conditions=browser(?:\s|$)/.test(commands[0]), "CI-APP-BROWSER: browser execution condition lost")
    }
    if (suite.selection.testDirectory && suite.selection.testDirectory !== ".") {
      requireContract(!commands[0].includes(suite.selection.testDirectory), `${suite.id}: directory was hardcoded`)
    }
    assertNoHardcodes(body, suite.id)
  }
  requireContract((selectedUnit.source.match(/\bbun test\b/g) || []).length === singleSuites.length, "unit: unexpected Bun invocation outside suite branches")
  assertNoHardcodes(selectedUnit.source, "unit")
  for (const suite of shardedSuites) {
    const job = jobBlock(workflow, "unit-sf")
    const count = SHARDED[suite.id]
    requireContract(new RegExp(`^      SF_SUITE_ID:\\s*${suite.id}\\s*$`, "m").test(job),
      "unit-sf: SF_SUITE_ID not bound to the sharded suite")
    requireContract(/^      SF_SHARD_INDEX:\s*\$\{\{\s*matrix\.shard\s*\}\}\s*$/m.test(job),
      "unit-sf: shard index not bound to matrix.shard")
    requireContract(new RegExp(`^      SF_SHARD_COUNT:\\s*"${count}"\\s*$`, "m").test(job),
      "unit-sf: shard count differs from the gate partition")
    const shards = job.match(/^        shard:\s*\[([^\]\n]*)\]\s*$/m)
    requireContract(shards !== null, "unit-sf: missing shard matrix")
    assertExactIds(shards[1].split(",").map((item) => item.trim()),
      Array.from({ length: count }, (_, offset) => String(offset + 1)), "unit-sf shards")
    const selected = assertSelectionDataflow(executionScript(job, "unit-sf"), "bun", "unit-sf")
    const commands = selected.source.replace(/\\\n\s*/g, " ").split("\n").filter((line) => /\bbun test\b/.test(line))
    requireContract(commands.length === 1 && (commands[0].match(/"\$\{files\[@\]\}"/g) || []).length === 1,
      "unit-sf: Bun must consume the shard selection as argv, exactly once")
    requireContract(!/(?:^|\s)--bail(?:=|\s|$)/.test(commands[0]),
      "unit-sf: --bail would hide late shard cases")
    assertNoHardcodes(selected.source, "unit-sf")
  }
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

/** Every product job checks out the immutable PR head; GITHUB_SHA remains workflow provenance. */
export function assertWorkflowSourceSelection(workflow) {
  const expression = "$" + "{{ github.event.pull_request.head.sha || github.sha }}"
  requireContract(workflow.includes("  SF_PRODUCT_SOURCE_SHA: " + expression), "missing exact product source declaration")
  const steps = workflow.split(/(?=^      - )/m)
  const checkouts = steps.filter((step) => step.includes("uses: actions/checkout@"))
  requireContract(checkouts.length > 0, "missing product checkouts")
  for (const step of checkouts)
    requireContract(step.includes("          ref: " + expression), "checkout is not pinned to the actual PR head")
  requireContract(!workflow.includes('test "$GITHUB_SHA"'), "workflow identity used as product checkout identity")
  requireContract(!workflow.includes("if (sha !== process.env.GITHUB_SHA)"), "guard receipt uses the synthetic merge SHA")
  const identities = [...workflow.matchAll(/\bworkflowSHA:\s*([^,\s}]+)/g)]
  requireContract(identities.length > 0 && identities.every((entry) => entry[1] === "process.env.GITHUB_SHA"),
    "raw workflow provenance was erased or rebound")
  requireContract(!/^      [A-Z_]+: \$\{\{ runner\./m.test(workflow), "runner context is not available in job-level env")
  return checkouts.length
}
