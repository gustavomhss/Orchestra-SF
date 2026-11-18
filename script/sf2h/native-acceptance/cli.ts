import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { realpath } from "node:fs/promises"
import { realpathSync, statSync } from "node:fs"
import { appendAttempt, readJson, verifyEvidenceFiles } from "./artifacts.ts"
import { preparePlan } from "./plan.ts"
import { preflight } from "./preflight.ts"
import { inspectCapture } from "./capture.ts"
import { captureTemplate } from "./execution.ts"
import { object } from "./schema.ts"

const commands = ["prepare", "preflight", "capture-template", "validate-capture", "ci-request"]

export async function main(argv: string[]) {
  const command = argv[0]
  if (command === "--help" || command === "help" || !command) {
    console.log("Native acceptance preparation (does not dispatch tests or native proofs)\n" +
      "node --experimental-strip-types script/sf2h/native-acceptance/cli.ts <command> [options]\n" +
      "Commands: " + commands.join(", ") + "\n" +
      "Options: --root <checkout> --candidate <C SHA> --source-head <W SHA> --capture <file> --evidence-root <directory> --write\n" +
      "--write adds a new preparation attempt only inside docs/sf2h/receipts/native-acceptance/.\n" +
      "Exit 0: preparation/shape valid; 2: missing host, incomplete capture or invalid input. Never AM PASS.")
    return 0
  }
  if (!commands.includes(command)) throw new Error("Unknown command; final/epic dispatch is not exposed by this CLI")
  const flags = new Map<string, string>()
  const booleans = new Set<string>()
  for (let index = 1; index < argv.length; index++) {
    const key = argv[index]!
    if (flags.has(key) || booleans.has(key)) throw new Error(`Repeated option ${key}`)
    if (key === "--write") { booleans.add(key); continue }
    if (!["--root", "--candidate", "--source-head", "--capture", "--evidence-root"].includes(key) || !argv[index + 1] || argv[index + 1]!.startsWith("--")) throw new Error(`Invalid option ${key}`)
    flags.set(key, argv[++index]!)
  }
  const root = await realpath(flags.get("--root") ?? process.cwd())
  const directory = path.dirname(fileURLToPath(import.meta.url))
  const coverage = await readJson(path.join(directory, "coverage.json"))
  const plan = preparePlan(coverage, await readJson(path.join(directory, "pinned-am-proofs.json")), flags.get("--candidate"))
  const result = command === "prepare" ? plan : command === "capture-template" ? captureTemplate(plan) : command === "preflight" ?
    await preflight({ plan, repositoryRoot: root, sourceHead: flags.get("--source-head"),
      requirements: await readJson(path.join(directory, "host-requirements.json")), reuse: await readJson(path.join(directory, "reuse-map.json")) }) :
    command === "ci-request" ? await ciRequest(root, directory) : await validateCaptured(plan, coverage, flags)
  if (booleans.has("--write")) {
    if (command === "capture-template" || command === "validate-capture") throw new Error("Keep raw host evidence/templates outside published receipts; archive only reviewed metadata")
    const saved = await appendAttempt(root, { [`${command}.json`]: result })
    console.log(JSON.stringify({ saved, ...summary(result) }, null, 2))
  } else console.log(JSON.stringify(result, null, 2))
  return ["NEEDS_HOST", "NEEDS_INTEGRATION", "INCOMPLETE"].includes(String(object(result).status)) ? 2 : 0
}

async function ciRequest(root: string, directory: string) {
  // Reuse the candidate's validators; do not duplicate their whitelist/package map.
  const { validateRequest, omniControlScope } = await import(pathToFileURL(path.join(root, "script/test-ci-request.ts")).href)
  const { locateTestPackage } = await import(pathToFileURL(path.join(root, "script/test-ci-location.ts")).href)
  const input = object(await readJson(path.join(directory, "ci-request.json")))
  const isFile = (file: string) => (statSync(path.join(root, file), { throwIfNoEntry: false })?.isFile() ?? false) &&
    realpathSync(path.join(root, file)).startsWith(root + path.sep)
  const selected = input.args
  if (!Array.isArray(selected) || !selected.length || selected.some((file) => typeof file !== "string" || !isFile(`${String(input.directory)}/${file}`)))
    throw new Error("Surgical CI selection is empty or refers to absent files")
  const request = validateRequest(input, isFile,
    (selector: string) => locateTestPackage(root, selector))
  return { status: "REQUEST_VALIDATED_NOT_DISPATCHED", request, omniControlScope: omniControlScope(request),
    dispatchAllowedHere: false, reason: "Only astra-wp00/PR20 is authorized; canonical CI needs a separate ci-run-* snapshot ref." }
}

async function validateCaptured(plan: ReturnType<typeof preparePlan>, coverage: unknown, flags: Map<string, string>) {
  const capturePath = flags.get("--capture")
  const evidenceRoot = flags.get("--evidence-root")
  if (!capturePath || !evidenceRoot) throw new Error("validate-capture requires --capture and --evidence-root")
  const capture = await readJson(capturePath)
  const result = inspectCapture(plan, coverage, capture)
  const references: unknown[] = []
  const visit = (value: unknown) => {
    if (Array.isArray(value)) { value.forEach(visit); return }
    if (!value || typeof value !== "object") return
    for (const [key, item] of Object.entries(value)) {
      if (key === "evidenceRefs" && Array.isArray(item)) references.push(...item)
      else visit(item)
    }
  }
  visit(capture)
  if (!references.length) return { ...result, status: "INCOMPLETE", archiveIntegrity: "NO_EVIDENCE_FILES" }
  const verified = await verifyEvidenceFiles(references, evidenceRoot)
  return { ...result, archiveIntegrity: "SHA256_VERIFIED", verifiedFiles: verified.length }
}

function summary(value: unknown) {
  const row = object(value)
  return { status: row.status, counts: row.counts, nativeAccepted: false, missingHostCount: row.missingHostCount, missingSourceCount: row.missingSourceCount }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main(process.argv.slice(2)).then((code) => { process.exitCode = code }, (error) => { console.error(error instanceof Error ? error.message : "Invalid preparation input"); process.exitCode = 2 })
