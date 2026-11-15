/**
 * AM02 hosted proof reconciler. DOES NOT execute a test, dispatch CI,
 * fabricate an actor, or infer identity from a branch name.
 *
 * bun script/sf2h/proofs/am02/reconcile-hosted-traces.ts <verified-actions-runs.json>
 *
 * The input must come from 191's observed Actions runs, be cross-checked
 * independently by 189, and retain the original log, request SHA and product
 * subtree. A component test of three public Performance C16 tools does NOT
 * prove the other 36 routes or LLM/GNATIVE.
 */
import { createHash } from "node:crypto"
import path from "node:path"
import resident from "../../../../modules/sucafina/Sucafinav1/product/ai/manifests/resident.json" with { type: "json" }
import freeze from "../../../../modules/sucafina/Sucafinav1/product/contracts/freeze-v1.json" with { type: "json" }
import { createResidentAiBundle } from "../../../../modules/sucafina/Sucafinav1/product/ai/resident.ts"

type Json = Record<string, unknown>
type Run = { id: number; url: string; headSha: string; candidateSha: string; sucafinaSubtreeSha: string;
  ciRequestSha256: string; conclusion: string; selectedFiles: string[]; log: string }
type Input = { schema: string; candidateSha: string; candidateTreeSha: string; sucafinaSubtreeSha: string; runs: Run[] }
const sha40 = /^[a-f0-9]{40}$/
const sha64 = /^[a-f0-9]{64}$/
const wp12 = "Sucafinav1/test/product/wp12/"
const integrated = "Sucafinav1/test/product/integrated-proofs/"
const knownSource = /^(Sucafinav1\/test\/product\/(wp12|integrated-proofs\/(am01|am02))\/)[\w.-]+\.test\.ts$/

function insist(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error("AM02 hosted evidence rejected: " + detail)
}
function record(value: unknown): Json {
  insist(!!value && typeof value === "object" && !Array.isArray(value), "non-object observed receipt")
  return value as Json
}
function string(value: unknown) { return typeof value === "string" ? value : "" }
function extract(log: string, tag: string): Json[] {
  return log.split(/\r?\n/).flatMap((line) => {
    const offset = line.indexOf(tag)
    if (offset < 0) return []
    return [record(JSON.parse(line.slice(offset + tag.length).trim()))]
  })
}
function sameCase(a: unknown, b: unknown) {
  const left = record(a), right = record(b)
  return left.id === right.id && left.incarnation === right.incarnation && left.version === right.version
}

async function reconcile(input: Input) {
  insist(input.schema === "sf2h.am02.hosted-input.v1", "invalid hosted input version")
  insist(sha40.test(input.candidateSha) && sha40.test(input.candidateTreeSha) &&
    sha40.test(input.sucafinaSubtreeSha), "incomplete candidate commit/tree/subtree")
  insist(Array.isArray(input.runs) && input.runs.length > 0, "no observed Actions runs")
  insist(freeze.operations.length === 39 && resident.operation_call_routes.length === 39 &&
    new Set(freeze.operations.map((entry) => entry.pack)).size === 8, "8/39 frozen operations changed")
  const root = path.resolve(import.meta.dir, "../../../../modules/sucafina/Sucafinav1/product/ai")
  const bundle = await createResidentAiBundle({ root, manifestPath: path.join(root, "manifests/resident.json") })
  insist(bundle.profiles.length === 5 && bundle.skills.length === 18, "source bundle not 5 profiles/18 skills")
  const runs = input.runs.map((run) => {
    insist(Number.isSafeInteger(run.id) && run.id > 0 && run.url ===
      `https://github.com/gustavomhss/Orchestra-SF/actions/runs/${run.id}`, "bad run URL/ID")
    insist(sha40.test(run.headSha) && run.candidateSha === input.candidateSha &&
      run.sucafinaSubtreeSha === input.sucafinaSubtreeSha &&
      sha64.test(run.ciRequestSha256), "hosted candidate/subtree/request mismatch")
    insist(run.conclusion === "success" && Array.isArray(run.selectedFiles) &&
      run.selectedFiles.length > 0 && new Set(run.selectedFiles).size === run.selectedFiles.length &&
      run.selectedFiles.every((file) => knownSource.test(file)), "unqualified hosted selector or conclusion")
    insist(typeof run.log === "string" && run.log.length > 0, "missing raw log bytes")
    return {
      id: run.id, url: run.url, headSha: run.headSha,
      selectedFiles: run.selectedFiles, requestHash: run.ciRequestSha256,
      logHash: createHash("sha256").update(run.log).digest("hex"),
      native: extract(run.log, "SF_WP12_NATIVE_MISSION:"),
      nativeRuns: extract(run.log, "SF_WP12_NATIVE_MISSION_RUN:"),
      catalogs: extract(run.log, "SF_WP12_NATIVE_MISSION_CATALOG:"),
      performance: extract(run.log, "SF_AM02_PERFORMANCE_C16_CONSUMED:"),
      toolObservations: extract(run.log, "SF_AM02_NATIVE_C16_TOOL:"),
    }
  })
  insist(new Set(runs.map((item) => item.id)).size === runs.length, "duplicate Actions run identity")
  const rows = freeze.operations.map((operation) => {
    const route = resident.operation_call_routes.find((item) => item.operation_id === operation.operation)
    insist(route?.pack_id === operation.pack && route.profile_id === operation.routeProfile &&
      route.skill_id === operation.routeSkill, "frozen canonical route mismatch " + operation.operation)
    const selected = bundle.selected.find((item) => item.profile.id === route.profile_id)
    const skill = selected?.skills.find((item) => item.id === route.skill_id)
    insist(!!selected && !!skill && selected.operationIds.includes(operation.operation) &&
      skill.allowedOperations.includes(operation.operation), "operation not actually in C15 distribution " + operation.operation)
    const evidence = runs.flatMap((run) => {
      const hosted = run.native.flatMap((item) => {
        if (item.scope !== "one-skill-native-execution-and-reopened-http-consumer" ||
          item.status !== "consumed" || item.inferenceExecuted !== true ||
          item.profileId !== route.profile_id || item.skillId !== skill.id ||
          item.githubSha !== run.headSha || item.consumerRef !== "handleSfAnalysis:output" ||
          item.consumerObservedAction !== "reopened-host-rendered-persisted-output" ||
          !Array.isArray(item.tools) || !item.receipt || !item.caseRef) return []
        const receipt = record(item.receipt)
        if (receipt.manifestDigest !== bundle.manifestDigest ||
          receipt.profileDigest !== selected.profile.sourceDigest ||
          receipt.profileVersion !== selected.profile.version ||
          receipt.skillVersion !== skill.version ||
          receipt.sourceDigest !== skill.sourceDigest || receipt.instructionsDigest !== skill.instructionsDigest ||
          receipt.skillId !== skill.id || receipt.profileId !== route.profile_id ||
          receipt.runId !== item.runRef || !sha64.test(string(item.outputDigest)) ||
          !sha64.test(string(item.inputDigest)) || !string(item.actualModel) ||
          !run.nativeRuns.some((observed) => observed.runRef === item.runRef &&
            observed.state === "ready" && observed.nativeSessionId === receipt.nativeSessionId &&
            observed.githubSha === run.headSha) ||
          !run.catalogs.some((catalog) => catalog.phase === "initial" &&
            catalog.githubSha === run.headSha && catalog.state === "available" &&
            Array.isArray(catalog.intersection) && catalog.intersection.some((model) => {
              const value = record(model)
              return `${value.providerID}/${value.id}` === item.actualModel
            }))) return []
        const tools = item.tools.flatMap((tool) => {
          const part = record(tool)
          if (part.operation !== operation.operation || part.handlerExport !== operation.handlerExport ||
            typeof part.toolCallId !== "string" || !Array.isArray(item.toolCallIds) ||
            !item.toolCallIds.includes(part.toolCallId) ||
            !sha64.test(string(part.inputDigest)) || !sha64.test(string(part.resultDigest)) ||
            part.principalRef === undefined || !string(part.accessRevision) ||
            !Number.isSafeInteger(part.providerGeneration)) return []
          return [part]
        })
        return tools.map((tool) => ({
          runRef: item.runRef, nativeSessionId: receipt.nativeSessionId, caseRef: item.caseRef,
          outputRef: item.outputRef, outputDigest: item.outputDigest,
          receipt: { skillId: receipt.skillId, version: receipt.skillVersion, sourceDigest: receipt.sourceDigest,
            instructionsDigest: receipt.instructionsDigest, loadedMessageId: receipt.loadedMessageId },
          call: { toolCallId: tool.toolCallId, inputDigest: tool.inputDigest,
            resultDigest: tool.resultDigest, handlerExport: tool.handlerExport },
          actualModel: item.actualModel, githubSha: run.headSha, runId: run.id, runUrl: run.url,
          logSha256: run.logHash, ciRequestSha256: run.requestHash,
          consumer: "reopened-host-rendered-persisted-output",
        }))
      })
      // Component Performance receipts prove real UI and wrapper, not a
      // native assistant turn, and cannot be spliced onto a WP12 case/run.
      return hosted
    })
    const nativeReady = evidence.length > 0
    return {
      operation: operation.operation, pack: operation.pack, profileId: route.profile_id,
      skillId: route.skill_id,
      status: nativeReady ? "NATIVE_C16_OBSERVED_NOT_AM02_PASS" : "NOT_RUN",
      nativeCandidate: evidence[0] ?? null,
      additionalUniqueCandidates: Math.max(evidence.length - 1, 0),
      missing: [
        ...(!nativeReady ? ["no-real-provider-bridge-receipt-and-reopened-host-consumer"] : []),
        "same-case-and-business-version-UI-agent-MCP-parity",
        "same-principal-no-grant-stale-revoked-negative-witness",
        "independent-191-run-log-and-189-integrated-candidate-attestation",
        "external-199-real-installation-and-Atlas-Relay-case-resources-where-required",
      ],
    }
  })
  const realNative = rows.filter((row) => row.status !== "NOT_RUN").length
  const missing = rows.filter((row) => row.status === "NOT_RUN").map((row) => row.operation)
  return {
    schema: "sf2h.am02.hosted-c16-correlation.v1", proof: "AM02", status: "NOT_RUN",
    canonicalRoutes: rows.length, packs: new Set(rows.map((row) => row.pack)).size,
    nativeObservedOnly: realNative, missingNative: missing,
    fullAgentUiMcpConsumerParity: false, GLOBAL_RELEASE: false,
    candidateSha: input.candidateSha, candidateTreeSha: input.candidateTreeSha,
    sucafinaSubtreeSha: input.sucafinaSubtreeSha, manifestDigest: bundle.manifestDigest,
    runs: runs.map((run) => ({ id: run.id, url: run.url, headSha: run.headSha,
      logSha256: run.logHash, ciRequestSha256: run.requestHash,
      selectedFiles: run.selectedFiles, performanceComponentRows: run.performance.length,
      nativeObserverRows: run.toolObservations.length })),
    rows,
    nextAction: "191 run existing native selectors after 189 applies inert per-tool receipt patch; provide same-case UI+agent+MCP/negative+consumer witnesses to qualifyAm02. Never replace a missing witness with this correlator.",
  }
}
const filename = process.argv[2]
if (!filename) throw new Error("AM02 requires hosted Actions run envelope; never infer from branch or source catalog")
const input: Input = await Bun.file(filename).json()
const result = await reconcile(input)
console.log(JSON.stringify(result, null, 2))
// This is deliberately not a release gate. The complete AM02 proof must be
// accepted by the owner only after real parity/consumption and negative traces.
if (result.status !== "NOT_RUN" || result.canonicalRoutes !== 39 || result.packs !== 8) process.exitCode = 1
