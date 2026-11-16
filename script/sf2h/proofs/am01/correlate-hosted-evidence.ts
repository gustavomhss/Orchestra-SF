/**
 * AM01 evidence correlation, never a standalone proof of inference or an
 * alternate CI dispatcher. Invoke only on job logs authenticated by 164 via
 * GitHub MCP; the output needs independent reviewer and C/D admission.
 *
 * bun script/sf2h/proofs/am01/correlate-hosted-evidence.ts <hosted-runs.json>
 *
 * Input: {
 *   schema: "sf2h.am01.hosted-input.v2", candidateSha, candidateTreeSha,
 *   sucafinaSubtreeSha,
 *   runs: [{ id, url, headSha, candidateSha, sucafinaSubtreeSha,
 *     ciRequestSha256, conclusion, selectedFiles, log }]
 * }
 * Each .ci-run.json produces a DIFFERENT snapshot commit. 164 must verify
 * that every snapshot's product subtree equals the same integrated C and
 * that only the allowed CI request differs elsewhere; this correlator never
 * substitutes one GitHub SHA for another.
 * }
 * Raw logs, run IDs, selections, head and URL must originate from the same
 * GitHub Actions observations. This file cannot certify the transport.
 */
import { createHash } from "node:crypto"
import path from "node:path"
import { createResidentAiBundle } from "../../../../modules/sucafina/Sucafinav1/product/ai/resident.ts"

const wp12 = "Sucafinav1/test/product/wp12/"
const proof = "Sucafinav1/test/product/integrated-proofs/am01/portfolio-recall-proof.test.ts"
const matrixProof = "Sucafinav1/test/product/integrated-proofs/am01/recall-five-profiles.test.ts"
const fiveProfiles = ["sf_finance", "sf_procurement", "sf_portfolio", "sf_maestro", "sf_reviewer"] as const
const assignments = [
  { caseId: "AM01-FINANCE", profileId: "sf_finance", skillId: "sf-explicar-forecast", source: wp12 + "native-execution-forecast-kpi.test.ts" },
  { caseId: "AM01-FINANCE", profileId: "sf_finance", skillId: "sf-comparar-cenarios", source: wp12 + "native-execution-scenarios-review.test.ts" },
  { caseId: "AM01-FINANCE", profileId: "sf_finance", skillId: "sf-avaliar-sensibilidade", source: wp12 + "native-execution-portfolio.test.ts" },
  { caseId: "AM01-FINANCE", profileId: "sf_finance", skillId: "sf-produzir-bi-contextual", source: wp12 + "native-execution-bi-public-selection.test.ts" },
  { caseId: "AM01-PROCUREMENT", profileId: "sf_procurement", skillId: "sf-comparar-sourcing", source: wp12 + "native-execution-sourcing.test.ts" },
  { caseId: "AM01-PROCUREMENT", profileId: "sf_procurement", skillId: "sf-revisar-condicoes-contratuais", source: wp12 + "native-execution-documents-contract.test.ts" },
  { caseId: "AM01-PROCUREMENT", profileId: "sf_procurement", skillId: "sf-preparar-compra", source: wp12 + "native-execution-purchase.test.ts" },
  { caseId: "AM01-PROCUREMENT", profileId: "sf_procurement", skillId: "sf-extrair-evidencias", source: wp12 + "native-execution-documents-contract.test.ts" },
  { caseId: "AM01-PORTFOLIO", profileId: "sf_portfolio", skillId: "sf-revisar-dependencias", source: wp12 + "native-execution-dependencies.test.ts" },
  { caseId: "AM01-PORTFOLIO", profileId: "sf_portfolio", skillId: "sf-compor-portfolio", source: wp12 + "native-execution-portfolio.test.ts" },
  { caseId: "AM01-PORTFOLIO", profileId: "sf_portfolio", skillId: "sf-reavaliar-compromissos", source: wp12 + "native-execution-reevaluation.test.ts" },
  { caseId: "AM01-PORTFOLIO", profileId: "sf_portfolio", skillId: "sf-consultar-memoria-decisoria", source: proof },
  { caseId: "AM01-MAESTRO", profileId: "sf_maestro", skillId: "sf-enquadrar-decisao", source: wp12 + "native-execution-intent.test.ts" },
  { caseId: "AM01-MAESTRO", profileId: "sf_maestro", skillId: "sf-preparar-revisao-executiva", source: wp12 + "native-execution-executive.test.ts" },
  { caseId: "AM01-MAESTRO", profileId: "sf_maestro", skillId: "sf-coordenar-perguntas", source: wp12 + "native-execution-questions.test.ts" },
  { caseId: "AM01-MAESTRO", profileId: "sf_maestro", skillId: "sf-produzir-material-reuniao", source: wp12 + "native-execution-executive.test.ts" },
  { caseId: "AM01-REVIEWER", profileId: "sf_reviewer", skillId: "sf-contestar-decisao", source: wp12 + "native-execution-scenarios-review.test.ts" },
  { caseId: "AM01-REVIEWER", profileId: "sf_reviewer", skillId: "sf-revisar-evidencias", source: wp12 + "native-execution-documents-contract.test.ts" },
] as const

type Json = Record<string, unknown>
type Run = { id: number; url: string; headSha: string; candidateSha: string;
  sucafinaSubtreeSha: string; ciRequestSha256: string; conclusion: string; selectedFiles: string[]; log: string }
type Input = { schema: string; candidateSha: string; candidateTreeSha: string;
  sucafinaSubtreeSha: string; runs: Run[] }
const sha40 = /^[0-9a-f]{40}$/
const sha64 = /^[0-9a-f]{64}$/

function record(value: unknown): Json {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("AM01 expected an object")
  return value as Json
}

function text(value: unknown): string {
  return typeof value === "string" ? value : ""
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error("AM01 evidence rejected: " + message)
}

function extract(log: string, marker: string): Json[] {
  return log.split(/\r?\n/).flatMap((line) => {
    const start = line.indexOf(marker)
    if (start < 0) return []
    const raw = line.slice(start + marker.length).trim()
    // Malformed tagged evidence fails the whole run. Never skip an invalid
    // receipt in favor of a later superficially matching one.
    return [record(JSON.parse(raw))]
  })
}

function sameRef(left: Json, right: Json) {
  return text(left.id) === text(right.id) &&
    text(left.incarnation) === text(right.incarnation) &&
    left.version === right.version
}

async function correlate(input: Input) {
  assert(input.schema === "sf2h.am01.hosted-input.v2", "unsupported hosted input schema")
  assert(sha40.test(input.candidateSha) && sha40.test(input.candidateTreeSha) &&
    sha40.test(input.sucafinaSubtreeSha), "missing candidate commit/tree or product subtree")
  assert(Array.isArray(input.runs) && input.runs.length > 0, "no hosted Actions run evidence")
  const root = path.resolve(import.meta.dir, "../../../../modules/sucafina/Sucafinav1/product/ai")
  // Real loader recalculates SHA-256 of all shipped sources, verifies their
  // instruction digests, profiles, grants, schema and immutable manifest.
  const bundle = await createResidentAiBundle({ root, manifestPath: path.join(root, "manifests/resident.json") })
  assert(bundle.profiles.length === 5 && bundle.skills.length === 18 && assignments.length === 18,
    "C15 source cardinality mismatch")
  const runEvidence = input.runs.map((run) => {
    assert(Number.isSafeInteger(run.id) && run.id > 0, "missing Actions run identifier")
    assert(run.url === `https://github.com/gustavomhss/Orchestra-SF/actions/runs/${run.id}`, "Actions URL does not match run identifier")
    assert(sha40.test(run.headSha) && run.candidateSha === input.candidateSha &&
      run.sucafinaSubtreeSha === input.sucafinaSubtreeSha && sha64.test(run.ciRequestSha256),
      "snapshot/C/product-subtree/request receipt not tied to this candidate")
    assert(run.conclusion === "success", "Actions result is not successful")
    assert(Array.isArray(run.selectedFiles) && run.selectedFiles.length > 0 &&
      new Set(run.selectedFiles).size === run.selectedFiles.length, "missing or duplicate exact selectors")
    assert(run.selectedFiles.every((file) => /^(Sucafinav1\/test\/product\/(wp12|integrated-proofs\/am01)\/)[\w.-]+\.test\.ts$/.test(file)),
      "unscoped or ambiguous selector in hosted witness")
    assert(typeof run.log === "string" && run.log.length > 0, "empty Actions log")
    const tagged = (marker: string) => extract(run.log, marker)
    const catalog = tagged("SF_WP12_NATIVE_MISSION_CATALOG:")
    return {
      id: run.id, url: run.url, headSha: run.headSha,
      ciRequestSha256: run.ciRequestSha256, selectedFiles: run.selectedFiles,
      logSha256: createHash("sha256").update(run.log).digest("hex"),
      catalog, prepared: tagged("SF_WP12_NATIVE_MISSION:"),
      runs: tagged("SF_WP12_NATIVE_MISSION_RUN:"),
      loads: tagged("WP12 native skill loads:"),
      portfolio: tagged("SF_AM01_PORTFOLIO_RECALL_CONSUMED:"),
      negatives: tagged("SF_AM01_PORTFOLIO_RECALL_NEGATIVE:"),
      matrix: tagged("SF_AM01_PROFILE_RECALL_CONSUMED:"),
      matrixNegatives: tagged("SF_AM01_PROFILE_RECALL_NEGATIVE:"),
      nativeCalls: tagged("SF_AM02_NATIVE_C16_TOOL:"),
      nativeUiParity: tagged("SF_AM02_NATIVE_UI_PARITY:"),
    }
  })
  assert(new Set(runEvidence.map((run) => run.id)).size === runEvidence.length, "duplicate Actions run ID")

  // The resident-native.test.ts proof covers *load*, and explicitly says it
  // does not cover inference. Its 18 denial rows cannot become outputs.
  const loadRuns = runEvidence.filter((run) => run.selectedFiles.includes(wp12 + "resident-native.test.ts"))
  const loads = loadRuns.flatMap((run) => run.loads)
  const load = loads.find((item) => {
    const receipts = item.receipts
    const refusals = item.refusals
    return item.scope === "registration-and-load-only" && Array.isArray(receipts) && receipts.length === 18 &&
      Array.isArray(refusals) && refusals.length === 18
  })
  const receipts = load && Array.isArray(load.receipts) ? load.receipts.map(record) : []
  const refusals = load && Array.isArray(load.refusals) ? load.refusals.map(record) : []
  const loadCovered = bundle.skills.every((skill) => {
    const receipt = receipts.find((entry) => entry.skillId === skill.id)
    const refusal = refusals.find((entry) => entry.skillId === skill.id)
    const profile = bundle.profiles.find((item) => item.id === receipt?.profileId)
    return !!profile && !!receipt && !!refusal &&
      receipt.skillVersion === skill.version && receipt.profileVersion === profile.version &&
      receipt.sourceDigest === skill.sourceDigest && receipt.instructionsDigest === skill.instructionsDigest &&
      receipt.profileDigest === profile.sourceDigest && receipt.manifestDigest === bundle.manifestDigest &&
      typeof receipt.loadedMessageId === "string" && receipt.loadedMessageId.length > 0 &&
      typeof receipt.nativeSessionId === "string" && receipt.nativeSessionId.length > 0 &&
      refusal.state === "Failure" && typeof refusal.messageCount === "number" && Number.isSafeInteger(refusal.messageCount) && refusal.messageCount >= 0
  }) && new Set(receipts.map((item) => item.nativeSessionId)).size === 18

  const witnesses = assignments.map((assignment) => {
    const expected = bundle.selected.find((selection) => selection.profile.id === assignment.profileId)
    const skill = expected?.skills.find((item) => item.id === assignment.skillId)
    assert(expected && skill, `manifest does not grant ${assignment.profileId}/${assignment.skillId}`)
    const observations = runEvidence.flatMap((run) => run.selectedFiles.includes(assignment.source) ?
      run.prepared.filter((item) =>
        item.scope === "one-skill-native-execution-and-reopened-http-consumer" && item.status === "consumed" &&
        item.profileId === assignment.profileId && item.skillId === assignment.skillId &&
        item.inferenceExecuted === true).map((item) => ({ run, item })) : [])
    const accepted = observations.filter(({ run, item }) => {
      const receipt = item.receipt
      if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) return false
      const loaded = record(receipt)
      const caseRef = item.caseRef && typeof item.caseRef === "object" ? record(item.caseRef) : {}
      const runObservation = run.runs.find((entry) => entry.runRef === item.runRef && entry.skillId === skill.id &&
        entry.nativeSessionId === loaded.nativeSessionId && entry.state === "ready" &&
        entry.githubSha === run.headSha)
      const catalog = run.catalog.find((entry) => entry.phase === "initial" && entry.state === "available" &&
        entry.githubSha === run.headSha && Array.isArray(entry.intersection) &&
        entry.intersection.some((m) => {
          const model = record(m)
          return `${model.providerID}/${model.id}` === item.actualModel
        }))
      return !!runObservation && !!catalog && item.githubSha === run.headSha &&
        typeof item.runRef === "string" && item.runRef.length > 0 && loaded.runId === item.runRef &&
        typeof loaded.nativeSessionId === "string" && loaded.nativeSessionId.length > 0 &&
        typeof loaded.loadedMessageId === "string" && loaded.loadedMessageId.length > 0 &&
        loaded.profileId === expected.profile.id && loaded.profileVersion === expected.profile.version &&
        loaded.profileDigest === expected.profile.sourceDigest &&
        loaded.skillId === skill.id && loaded.skillVersion === skill.version &&
        loaded.sourceDigest === skill.sourceDigest && loaded.instructionsDigest === skill.instructionsDigest &&
        loaded.manifestDigest === bundle.manifestDigest &&
        text(item.actualModel).length > 2 &&
        sha64.test(text(item.outputDigest)) && sha64.test(text(item.inputDigest)) &&
        text(item.outputRef).length > 0 && typeof caseRef.id === "string" &&
        typeof caseRef.incarnation === "string" && Number.isSafeInteger(caseRef.version) &&
        Array.isArray(item.toolCallIds) && item.toolCallIds.length > 0 &&
        item.consumerRef === "handleSfAnalysis:output" &&
        item.consumerObservedAction === "reopened-host-rendered-persisted-output"
    })
    if (observations.length > 0 && accepted.length === 0)
      throw new Error(`AM01 unsafe positive witness for ${assignment.profileId}/${assignment.skillId}`)
    const first = accepted[0]
    // A real skill may execute twice in one scenario, with different types
    // (for instance PortfolioComparison and AlternativeDraft). Select a
    // representative observed run; extra real invocations are not a forgery.
    return {
      ...assignment, status: first ? "CORRELATED_NEEDS_REVIEW" : "NOT_RUN",
      sourcePath: skill.sourcePath, skillVersion: skill.version,
      sourceDigest: skill.sourceDigest, instructionsDigest: skill.instructionsDigest,
      profileSourcePath: expected.profile.sourcePath, profileDigest: expected.profile.sourceDigest,
      additionalQualifiedInvocations: Math.max(accepted.length - 1, 0),
      outputKindsAllowed: skill.outputSchemaRefs,
      runId: first?.run.id ?? null, runUrl: first?.run.url ?? null,
      ciSnapshotSha: first?.run.headSha ?? null, ciRequestSha256: first?.run.ciRequestSha256 ?? null,
      logSha256: first?.run.logSha256 ?? null,
      runRef: first?.item.runRef ?? null, nativeSessionId: first ? record(first.item.receipt).nativeSessionId : null,
      outputRef: first?.item.outputRef ?? null, outputDigest: first?.item.outputDigest ?? null,
      consumerRef: first?.item.consumerRef ?? null, actualModel: first?.item.actualModel ?? null,
      caseRef: first?.item.caseRef ?? null,
    }
  })
  const matched = witnesses.filter((item) => item.status === "CORRELATED_NEEDS_REVIEW")
  const skillsUnique = new Set(matched.map((item) => item.skillId)).size === 18
  const profilesUnique = new Set(matched.map((item) => item.profileId)).size === 5
  const noRunOrOutputReuse = new Set(matched.map((item) => item.runRef)).size === matched.length &&
    new Set(matched.map((item) => item.outputRef)).size === matched.length &&
    new Set(matched.map((item) => item.nativeSessionId)).size === matched.length
  const contest = matched.find((item) => item.skillId === "sf-contestar-decisao")
  const author = matched.find((item) => item.skillId === "sf-comparar-cenarios")
  const reviewerDistinct = !!contest && !!author && contest.runId === author.runId &&
    contest.runRef !== author.runRef && contest.nativeSessionId !== author.nativeSessionId &&
    contest.caseRef && author.caseRef && sameRef(record(contest.caseRef), record(author.caseRef))
  const portfolio = matched.find((item) => item.profileId === "sf_portfolio" && item.skillId === "sf-consultar-memoria-decisoria")
  const portfolioRun = runEvidence.find((run) => run.id === portfolio?.runId)
  const portfolioNegative = !!portfolio && !!portfolioRun &&
    portfolioRun.negatives.some((item) => item.profileId === portfolio.profileId &&
      item.skillId === portfolio.skillId && item.deniedBeforeInference === true &&
      item.unrelatedTrainingRemainsMissing === true &&
      Array.isArray(item.refused) && item.refused.length === 3)
  // A catalog load or a standalone source correlator cannot establish a five-
  // profile execution. Require each profile's distinct ready native run, full
  // source/version/digest receipt, verified tool calls, negative HTTP decisions
  // and reopened durable HTTP output in the SAME real Actions log.
  const matrixCovered = runEvidence.some((run) => {
    if (!run.selectedFiles.includes(matrixProof)) return false
    const matched = fiveProfiles.map((profileId) => {
      const selected = bundle.selected.find((item) => item.profile.id === profileId)
      const skill = selected?.skills.find((item) => item.id === "sf-consultar-memoria-decisoria")
      if (!selected || !skill) return undefined
      const negatives = run.matrixNegatives.find((value) => value.githubSha === run.headSha &&
        value.profileId === profileId && value.skillId === skill.id &&
        value.outsideGrantDenied === true && value.wrongIncarnationDenied === true &&
        value.unissuedPrecedentDenied === true && value.missingTrainingWasNotConvertedToZero === true)
      const consumption = run.matrix.find((value) => value.githubSha === run.headSha &&
        value.profileId === profileId && value.skillId === skill.id &&
        value.inferenceExecuted === true && value.consumerRef === "handleSfAnalysis:output" &&
        value.observedAction === "reopened-host-rendered-persisted-output" &&
        value.missingTrainingRemainsUnknown === true)
      if (!negatives || !consumption || !consumption.receipt || typeof consumption.receipt !== "object")
        return undefined
      const receipt = record(consumption.receipt)
      const actual = run.prepared.find((value) =>
        value.runRef === consumption.runRef && value.profileId === profileId && value.skillId === skill.id &&
        value.inferenceExecuted === true && value.outputRef === consumption.outputRef &&
        value.outputDigest === consumption.outputDigest && value.inputDigest === negatives.inputDigest &&
        value.consumerRef === "handleSfAnalysis:output" && value.actualModel === consumption.actualModel)
      const started = run.runs.find((value) => value.githubSha === run.headSha &&
        value.runRef === consumption.runRef && value.skillId === skill.id &&
        value.nativeSessionId === consumption.nativeSessionId && value.state === "ready")
      const actualReceipt = actual?.receipt && typeof actual.receipt === "object" && !Array.isArray(actual.receipt)
        ? record(actual.receipt) : undefined
      const requiredNativeCalls = ["sf_decision_recall", "sf_knowledge_search", "sf_context_get", "sf_freshness_check"]
      const verifiedNativeCalls = requiredNativeCalls.every((operation) =>
        run.nativeCalls.some((call) => call.githubSha === run.headSha &&
          call.operation === operation && call.profileId === profileId && call.skillId === skill.id &&
          call.runRef === consumption.runRef && call.nativeSessionId === consumption.nativeSessionId &&
          call.principalRef === "wp12-synthetic-am01-five-profile-recall-principal" &&
          call.accessRevision === consumption.accessRevision &&
          call.providerTurnObserved === true && call.sameRunAsPersistedContribution === true &&
          call.actualModel === consumption.actualModel && call.sourceDigest === skill.sourceDigest &&
          call.instructionsDigest === skill.instructionsDigest &&
          sha64.test(text(call.inputDigest)) && sha64.test(text(call.resultDigest)) &&
          Array.isArray(consumption.toolCallIds) &&
          consumption.toolCallIds.includes(call.toolCallId) &&
          call.caseRef && sameRef(record(call.caseRef), record(consumption.caseRef))))
      const verifiedNativeUiParity = requiredNativeCalls.every((operation) =>
        run.nativeUiParity.some((parity) => parity.githubSha === run.headSha &&
          parity.operation === operation && parity.profileId === profileId && parity.skillId === skill.id &&
          parity.runRef === consumption.runRef && parity.nativeSessionId === consumption.nativeSessionId &&
          parity.actualModel === consumption.actualModel && parity.sourceDigest === skill.sourceDigest &&
          parity.accessRevision === consumption.accessRevision &&
          parity.principalRef === "wp12-synthetic-am01-five-profile-recall-principal" &&
          parity.uiDomainEntered === true && parity.nativeProviderTurnObserved === true &&
          parity.sameCaseAndInputOutputDigest === true &&
          parity.thirdTransportMcpParityNotClaimed === true &&
          parity.caseRef && sameRef(record(parity.caseRef), record(consumption.caseRef)) &&
          parity.consumerOutputRef === consumption.outputRef &&
          run.nativeCalls.some((call) => call.githubSha === parity.githubSha &&
            call.toolCallId === parity.toolCallId && call.runRef === parity.runRef &&
            call.operation === operation && call.inputDigest === parity.inputDigest &&
            call.resultDigest === parity.resultDigest && call.handlerExport === parity.handlerExport)))
      if (!actual || !actualReceipt || !started || !sha64.test(text(consumption.outputDigest)) ||
        !Array.isArray(consumption.toolCallIds) || consumption.toolCallIds.length < 4 ||
        receipt.nativeSessionId !== consumption.nativeSessionId || receipt.runId !== consumption.runRef ||
        receipt.loadedMessageId !== actualReceipt.loadedMessageId ||
        !verifiedNativeCalls || !verifiedNativeUiParity ||
        receipt.profileId !== profileId || receipt.profileVersion !== selected.profile.version ||
        receipt.profileDigest !== selected.profile.sourceDigest || receipt.skillId !== skill.id ||
        receipt.skillVersion !== skill.version || receipt.sourceDigest !== skill.sourceDigest ||
        receipt.instructionsDigest !== skill.instructionsDigest || receipt.manifestDigest !== bundle.manifestDigest ||
        !consumption.caseRef || !negatives.caseRef ||
        !sameRef(record(consumption.caseRef), record(negatives.caseRef))) return undefined
      return { profileId, runRef: consumption.runRef, sessionId: receipt.nativeSessionId, outputRef: consumption.outputRef }
    }).filter((value): value is { profileId: string; runRef: unknown; sessionId: unknown; outputRef: unknown } => !!value)
    return matched.length === 5 &&
      new Set(matched.map((item) => item.runRef)).size === 5 &&
      new Set(matched.map((item) => item.sessionId)).size === 5 &&
      new Set(matched.map((item) => item.outputRef)).size === 5
  })
  const pending = [
    ...(!loadCovered ? ["native-load-and-18-refusals"] : []),
    ...witnesses.filter((item) => item.status === "NOT_RUN").map((item) => item.profileId + "/" + item.skillId),
    ...(!skillsUnique || !profilesUnique || !noRunOrOutputReuse ? ["unique-5/18-run-output-session"] : []),
    ...(!reviewerDistinct ? ["independent-reviewer-linked-to-author"] : []),
    ...(!portfolioNegative ? ["portfolio-recall-forbidden-grant-and-missing-data"] : []),
    ...(!matrixCovered ? ["five-profile-recall-native-runs-denials-and-reopened-consumers"] : []),
    "independent-164-log-and-162-candidate-attestation",
    "real-scanner-admission-and-identity-receipts",
    "human-consumer-authority-and-five-case-negative-variants",
    "AM01-final-independent-review",
  ]
  const result = {
    schema: "sf2h.am01.correlation.v1", proof: "AM01", status: "NOT_RUN",
    conclusion: pending.length === 4 && matched.length === 18 ? "ALL_18_WITNESSES_CORRELATED_PENDING_INDEPENDENT_ATTESTATION" : "INCOMPLETE",
    candidateSha: input.candidateSha, candidateTreeSha: input.candidateTreeSha,
    sucafinaSubtreeSha: input.sucafinaSubtreeSha,
    manifestDigest: bundle.manifestDigest, profiles: bundle.profiles.length, skills: bundle.skills.length,
    loadedAndRefused: loadCovered, witnesses, reviewerDistinct, portfolioNegative, matrixCovered,
    runs: runEvidence.map((run) => ({ runId: run.id, url: run.url,
      ciSnapshotSha: run.headSha, ciRequestSha256: run.ciRequestSha256,
      logSha256: run.logSha256, selectedFiles: run.selectedFiles })),
    pending, executionClaim: "Only recorded GitHub Actions logs; no run launched by this correlator",
    authority: "Log provenance, CI request, candidate identity and final approval must be checked by 164/162/independent reviewers",
  }
  return result
}

const file = process.argv[2]
if (!file) throw new Error("AM01 requires the verified hosted-runs.json path; never infer CI from catalog or branch")
const input: Input = await Bun.file(file).json()
const result = await correlate(input)
console.log(JSON.stringify(result, null, 2))
if (result.conclusion !== "ALL_18_WITNESSES_CORRELATED_PENDING_INDEPENDENT_ATTESTATION") process.exitCode = 1
