import { codeBaseline, equal, exactSet, object, proofIds, requireDigest, requireSha, rows, strings, text } from "./schema.ts"
import type { PreparedPlan } from "./schema.ts"

/** Capture validation is deliberately not an acceptance oracle. It rejects
 * incomplete/fixture evidence and reports what a fresh reviewer must examine. */
export function inspectCapture(plan: PreparedPlan, coverageValue: unknown, captureValue: unknown) {
  const capture = object(captureValue, "capture")
  const coverage = object(coverageValue, "coverage")
  const problems: string[] = []
  const check = (label: string, work: () => void) => {
    try { work() } catch (error) { problems.push(`${label}: ${error instanceof Error ? error.message : "invalid evidence"}`) }
  }
  check("candidate", () => {
    if (!plan.candidateC || requireSha(capture.testedCommit, "testedCommit") !== plan.candidateC) throw new Error("Capture is not for the plan's single candidate C")
    requireSha(capture.testedTree, "testedTree")
    if (capture.schema !== "sf2h-native-capture-v1" || capture.coverageDigest !== plan.coverageDigest) throw new Error("Capture schema or coverage digest mismatch")
    if (capture.mode !== "preproof" && capture.mode !== "final") throw new Error("Mode must be explicit")
  })
  check("campaign evidence envelope", () => {
    const records = rows(capture.campaignEvidence, "campaignEvidence")
    exactSet([...new Set(records.map((record) => text(record.proofId, "campaign proofId")))], [...proofIds], "campaign proof coverage")
    for (const record of records) {
      for (const field of plan.campaignEvidenceFields) {
        const value = record[field]
        if (value === undefined || value === null || value === "" || (Array.isArray(value) && !value.length))
          throw new Error(`Missing applicable campaign field ${field}`)
        if (value && typeof value === "object" && !Array.isArray(value) && object(value).notApplicable === true)
          text(object(value).reason, `Non-applicability reason for ${field}`)
      }
      for (const field of ["candidate_sha", "product_candidate_sha", "runtime_build_sha"])
        if (record[field] !== plan.candidateC) throw new Error(`Campaign ${field} differs from C`)
      for (const field of ["criterion_id", "entity_id", "actor_or_role", "evidence_uri", "native_session_id"])
        text(record[field], `campaign ${field}`)
      if (record.status !== "PASS" || record.scope !== "integrated") throw new Error("Campaign native evidence is not observed integrated evidence")
      if (!Number.isFinite(Date.parse(text(record.verified_at, "campaign verified_at")))) throw new Error("Invalid campaign evidence timestamp")
      evidenceRefs(record.evidenceRefs)
    }
  })
  const receipts = safeRows(capture.proofReceipts, "proofReceipts", problems)
  check("six receipts", () => exactSet(receipts.map((row) => text(row.proofId, "proofId")), [...proofIds], "proof receipts"))
  receipts.forEach((receipt) => check(String(receipt.proofId), () => {
    const id = text(receipt.proofId, "proofId")
    const fields = plan.requiredReceiptFields[id]
    if (!fields) throw new Error("Unknown proof")
    for (const field of fields) if (receipt[field] === undefined || receipt[field] === null || receipt[field] === "") throw new Error(`Missing receipt field ${field}`)
    if (receipt.testedCommit !== plan.candidateC || receipt.codeBaseline !== codeBaseline) throw new Error("Commit/baseline differs")
    if (receipt.verdict !== "MATCHED") throw new Error("Receipt outcome is not MATCHED")
    requireNativeCaptureSource(receipt.fixtureOrRealSource)
    for (const field of ["runId", "nativeSessionId", "profileId", "operation", "handlerIdentity", "consumerRef", "outputRef"]) text(receipt[field], field)
    const principal = object(receipt.principalScope, "principalScope")
    for (const field of ["installationId", "projectId", "locationId", "principalRef", "accessRevision", "policyVersion"]) text(principal[field], field)
    const caseRef = object(receipt.caseRef, "caseRef")
    text(caseRef.id, "case id"); text(caseRef.incarnation, "case incarnation")
    if (!Number.isSafeInteger(caseRef.version) || Number(caseRef.version) < 1) throw new Error("Invalid case version")
    requireDigest(receipt.inputDigest, "inputDigest")
    const loads = rows(receipt.skillLoadReceipts, "skillLoadReceipts")
    if (!loads.length) throw new Error("Native SkillLoadReceipt is absent")
    loads.forEach((load) => skillReceipt(load))
    if (!loads.some((load) => load.runId === receipt.runId && load.nativeSessionId === receipt.nativeSessionId && load.profileId === receipt.profileId))
      throw new Error("Receipt does not bind the run, session and profile")
    evidenceRefs(receipt.evidenceRefs)
    if (id === "AM05") atlasReceipt(receipt)
  }))
  const observations = safeRows(capture.checkResults, "checkResults", problems)
  check("complete check coverage", () => exactSet(observations.map((row) => text(row.checkId, "checkId")), plan.checks.map((row) => row.id), "checks"))
  observations.forEach((observation) => check(String(observation.checkId), () => {
    const expected = plan.checks.find((entry) => entry.id === observation.checkId)
    if (!expected || observation.proofId !== expected.proofId || observation.testedCommit !== plan.candidateC ||
      observation.status !== "OBSERVED" || observation.matched !== true) throw new Error("Check not observed/matched on C")
    if (!equal(observation.expected, expected.expected)) throw new Error("Expected criterion was edited")
    text(observation.observed, "observed discriminating outcome")
    evidenceRefs(observation.evidenceRefs)
  }))
  const skills = safeRows(capture.skillExecutions, "skillExecutions", problems)
  check("18 skills", () => exactSet(skills.map((row) => text(row.skillId, "skillId")), rows(coverage.skills, "skills").map((row) => text(row.id, "id")), "skill executions"))
  skills.forEach((execution) => check(String(execution.skillId), () => {
    const required = rows(coverage.skills, "skills").find((row) => row.id === execution.skillId)
    if (!required || execution.testedCommit !== plan.candidateC) throw new Error("Unknown skill or wrong commit")
    requireNativeCaptureSource(execution.fixtureOrRealSource)
    const load = object(execution.skillLoadReceipt, "skillLoadReceipt")
    skillReceipt(load)
    if (load.skillId !== execution.skillId || !strings(required.profiles, "profiles").includes(String(load.profileId))) throw new Error("Wrong skill/profile")
    text(execution.actualModel, "actualModel"); requireDigest(execution.contextFingerprint, "contextFingerprint"); text(execution.accessRevision, "accessRevision")
    const loaded = object(execution.loadObservation, "loadObservation")
    if (loaded.sourcePath !== required.source_path || loaded.sourceDigest !== load.sourceDigest || loaded.instructionsDigest !== load.instructionsDigest ||
      loaded.loadedMessageId !== load.loadedMessageId || loaded.nativeSessionId !== load.nativeSessionId || loaded.providerTurnCompleted !== true)
      throw new Error("Source bytes / actual loaded message / provider turn not linked")
    const output = object(execution.persistedOutput, "persisted output")
    text(output.ref, "output ref"); requireDigest(output.digest, "output digest")
    if (output.schemaValidated !== true || output.committed !== true) throw new Error("Output was not validated and committed")
    const consumed = object(execution.afterReload, "afterReload")
    if (consumed.outputRef !== output.ref || consumed.outputDigest !== output.digest || consumed.freshRead !== true) throw new Error("No same-output consumption after reload")
    if (!Number.isSafeInteger(consumed.caseVersion) || Number(consumed.caseVersion) < 1) throw new Error("Consumer case version is absent")
    const consumers = rows(execution.consumers, "consumers")
    exactSet(consumers.map((row) => text(row.consumerTask, "consumerTask")), strings(required.consumer_tasks, "required consumer tasks"), "skill consumers")
    consumers.forEach((consumer) => { text(consumer.consumerRef, "consumerRef"); text(consumer.observedAction, "observedAction"); evidenceRefs(consumer.evidenceRefs) })
    evidenceRefs(execution.evidenceRefs)
  }))
  check("five contributing profiles", () => exactSet([...new Set(skills.map((row) => String(object(row.skillLoadReceipt).profileId)))],
    rows(coverage.profiles, "profiles").map((row) => String(row.id)), "contributing profiles"))
  const parity = safeRows(capture.operationParity, "operationParity", problems)
  check("39 routes", () => exactSet(parity.map((row) => text(row.operationId, "operationId")), rows(coverage.operation_call_routes, "routes").map((row) => String(row.operation_id)), "operation parity"))
  parity.forEach((row) => check(String(row.operationId), () => operationParity(row, coverage, plan)))
  check("UI per pack", () => {
    const exposed = parity.filter((row) => row.uiExposure === "exposed").map((row) => String(row.packId))
    for (const pack of rows(coverage.mcp_packs, "packs")) if (!exposed.includes(String(pack.id))) throw new Error(`No real UI action for ${String(pack.id)}`)
  })
  check("reviewer independence", () => {
    const reviews = rows(capture.independentReviews, "independentReviews")
    exactSet(reviews.map((row) => text(row.reviewerSkillId, "reviewerSkillId")), ["sf-contestar-decisao", "sf-revisar-evidencias"], "reviewer skills")
    for (const review of reviews) {
      for (const field of ["targetRunId", "reviewerRunId", "targetSessionId", "reviewerSessionId"]) text(review[field], field)
      requireDigest(review.targetOutputDigest, "targetOutputDigest")
      if (review.targetRunId === review.reviewerRunId || review.targetSessionId === review.reviewerSessionId || review.sharedHistory !== false)
        throw new Error("Review must use a distinct run and native Session without shared analysis history")
      const author = skills.find((row) => object(row.skillLoadReceipt).runId === review.targetRunId)
      const reviewer = skills.find((row) => row.skillId === review.reviewerSkillId && object(row.skillLoadReceipt).runId === review.reviewerRunId)
      if (!author || !reviewer || object(author.skillLoadReceipt).nativeSessionId !== review.targetSessionId ||
        object(author.persistedOutput).digest !== review.targetOutputDigest || object(reviewer.skillLoadReceipt).nativeSessionId !== review.reviewerSessionId ||
        object(reviewer.skillLoadReceipt).profileId !== "sf_reviewer") throw new Error("Reviewer/target IDs are disconnected from recorded native skill executions")
      evidenceRefs(review.evidenceRefs)
    }
  })
  return { schema: "sf2h-native-capture-check-v1", testedCommit: plan.candidateC, mode: capture.mode ?? null,
    status: problems.length ? "INCOMPLETE" : "CAPTURE_COMPLETE_PENDING_INDEPENDENT_REVIEW",
    nativeAccepted: false, archiveIntegrity: "NOT_CHECKED", problems,
    counts: { proofReceipts: receipts.length, checks: observations.length, skills: skills.length, operations: parity.length } }
}

function safeRows(value: unknown, name: string, errors: string[]) {
  try { return rows(value, name) } catch { errors.push(`${name}: expected array`); return [] }
}

export function requireNativeCaptureSource(value: unknown) {
  const source = object(value, "fixtureOrRealSource")
  if (source.execution !== "installed-host" || source.authority !== "existing-authenticated-request" ||
    (source.data !== "real" && source.data !== "synthetic-business-corpus")) throw new Error("Fixture/provider/principal/grants are not native proof")
  text(source.sourceRef, "sourceRef")
}

function skillReceipt(load: Record<string, unknown>) {
  for (const field of ["runId", "nativeSessionId", "profileId", "profileVersion", "skillId", "skillVersion", "loadedMessageId"]) text(load[field], field)
  for (const field of ["profileDigest", "sourceDigest", "instructionsDigest", "manifestDigest"]) requireDigest(load[field], field)
  if (!Number.isFinite(Date.parse(text(load.loadedAt, "loadedAt")))) throw new Error("Invalid skill load timestamp")
}

function evidenceRefs(value: unknown) {
  const refs = rows(value, "evidenceRefs")
  if (!refs.length) throw new Error("No immutable evidence file reference")
  refs.forEach((ref) => { text(ref.path, "evidence path"); requireDigest(ref.sha256, "evidence SHA256") })
}

function atlasReceipt(receipt: Record<string, unknown>) {
  const artifacts = object(receipt.generatedArtifactDigests, "generatedArtifactDigests")
  exactSet(Object.keys(artifacts), ["business-memory-ports.js", "business-memory-ports.d.ts", "native-memory.js", "native-memory.d.ts"], "four generated artifacts")
  Object.values(artifacts).forEach((value) => requireDigest(value, "artifact digest"))
  for (const field of ["nativeBoundSourceDigest", "scannerSourceDigest", "guardSourceDigest", "allowlistDigest"]) requireDigest(receipt[field], field)
  if (receipt.spawnGuardCommand !== "bun run check:spawn-imports" || receipt.spawnGuardExitStatus !== 0 || receipt.businessBundleAstVerdict !== "PASS") throw new Error("Candidate AST/spawn guard did not pass")
  const edge = object(receipt.exactExternalEdge, "external edge")
  if (edge.importer !== "memory-emit.ts" || edge.specifier !== "./scanner.js" || edge.target !== "@orchestra/atlas-boundary/native-memory") throw new Error("Wrong external scanner edge")
  const restart = object(receipt.restart, "restart")
  if (typeof restart.beforeProcessId !== "number" || typeof restart.afterProcessId !== "number" || restart.beforeProcessId === restart.afterProcessId ||
    restart.committedBeforeExit !== true || restart.sameEventAfterRestart !== true) throw new Error("Restart/commit not witnessed in distinct processes")
  const scanner = object(receipt.scanner, "scanner")
  text(scanner.binaryPath, "scanner binary path"); text(scanner.version, "scanner version"); requireDigest(scanner.binaryDigest, "scanner binary digest")
  if (scanner.realBinary !== true || scanner.clean !== "clean" || scanner.canary !== "hit" || scanner.timeout !== "scanner-unavailable" || scanner.absent !== "scanner-unavailable") throw new Error("Incomplete real scanner cases")
}

function operationParity(row: Record<string, unknown>, coverage: Record<string, unknown>, plan: PreparedPlan) {
  const route = rows(coverage.operation_call_routes, "routes").find((entry) => entry.operation_id === row.operationId)
  if (!route || row.testedCommit !== plan.candidateC || row.packId !== route.pack_id) throw new Error("Wrong route, pack or C")
  const native = object(row.native, "direct native wrapper result")
  const mcp = object(row.mcp, "MCP result")
  const compared = [{ kind: "native", result: native }, { kind: "native", result: mcp },
    ...(row.uiExposure === "exposed" ? [{ kind: "ui", result: object(row.ui, "UI result") }] : [])]
  if (row.uiExposure !== "exposed" && row.uiExposure !== "internal-only") throw new Error("UI exposure is absent")
  if (row.uiExposure === "internal-only") text(row.internalConsumerRef, "internal consumer ref")
  const base = object(native.contextObservation, "native context observation")
  for (const comparison of compared) {
    const kind = comparison.kind
    const result = comparison.result
    const receipt = object(result.receipt, "unaltered capability receipt")
    if (result.status !== "ok" || result.kind !== kind || receipt.kind !== kind || receipt.operation !== row.operationId)
      throw new Error("Parity lacks the actual successful capability receipt")
    text(receipt.handlerExport, "receipt handlerExport")
    if (text(result.handlerIdentity, "handlerIdentity") !== receipt.handlerExport) throw new Error("Handler identity differs from receipt.handlerExport")
    for (const field of ["principalRef", "accessRevision", "callId"])
      if (text(result[field], field) !== text(receipt[field], `receipt ${field}`)) throw new Error(`Normalized field differs from receipt: ${field}`)
    for (const field of ["inputDigest", "resultDigest"])
      if (requireDigest(result[field], field) !== requireDigest(receipt[field], `receipt ${field}`)) throw new Error(`Normalized digest differs from receipt: ${field}`)
    if (!Number.isFinite(Date.parse(text(receipt.at, "receipt timestamp")))) throw new Error("Invalid capability receipt timestamp")
    // Canonical read capabilities can return data + receipt without producing an
    // output artifact. An invented outputRef would invalidate native evidence.
    if (result.outputRef !== undefined) text(result.outputRef, "outputRef")
    if (result.outputRef !== native.outputRef) throw new Error("Parity mismatch: optional outputRef")
    for (const field of ["handlerIdentity", "principalRef", "accessRevision", "inputDigest", "resultDigest"])
      if (!equal(result[field], native[field])) throw new Error(`Parity mismatch: ${field}`)
    // Case/base are observed from the real binding or authorized selection.
    // They are not fields of BoundCapabilityReceipt and need their own evidence.
    const context = object(result.contextObservation, "context observation")
    const caseRef = object(context.caseRef, "observed caseRef")
    text(caseRef.id, "observed case id"); text(caseRef.incarnation, "observed case incarnation")
    if (!Number.isSafeInteger(caseRef.version) || Number(caseRef.version) < 1) throw new Error("Invalid observed case version")
    text(context.baseVersionRef, "observed base version ref"); text(context.sourceRef, "observed base source ref")
    evidenceRefs(context.evidenceRefs)
    for (const field of ["caseRef", "baseVersionRef", "sourceRef"])
      if (!equal(context[field], base[field])) throw new Error(`Parity context mismatch: ${field}`)
    if (kind === "native") {
      if (result.c16Wrapper !== true) throw new Error("Parity bypassed C16")
      const load = object(result.skillLoadReceipt, "route skill receipt")
      skillReceipt(load)
      if (load.skillId !== route.skill_id || load.profileId !== route.profile_id) throw new Error("Wrong positive route skill/profile")
      for (const field of ["runId", "nativeSessionId"])
        if (text(result[field], field) !== text(receipt[field], `receipt ${field}`) || result[field] !== load[field])
          throw new Error("Route receipt/load belongs to another native execution")
      if (!Number.isSafeInteger(receipt.providerGeneration) || Number(receipt.providerGeneration) < 0) throw new Error("Invalid native provider generation")
    } else {
      if (text(receipt.requestId, "receipt requestId") !== receipt.callId) throw new Error("UI receipt does not bind its request")
      const action = object(result.uiAction, "observed UI action")
      text(action.entrypoint, "UI entrypoint"); text(action.observedAction, "UI observed action")
      evidenceRefs(action.evidenceRefs)
    }
    evidenceRefs(result.evidenceRefs)
  }
  if (native.callId === mcp.callId) throw new Error("Private call leases must not be reused")
  if (object(native.receipt).providerGeneration !== object(mcp.receipt).providerGeneration) throw new Error("Parity provider generation changed")
  if (mcp.privateBridge !== true || mcp.initializeObserved !== true || mcp.listToolsObserved !== true || mcp.callToolObserved !== true) throw new Error("No private SDK bridge trace")
  const denied = object(row.notGranted, "direct denial")
  if (denied.status !== "denied" || denied.effects !== 0 || denied.restrictedDataExposed !== false || denied.directCall !== true) throw new Error("Missing direct not-granted negative")
  evidenceRefs(denied.evidenceRefs)
  if (route.requires_current_c07_admission && row.currentC07Admission !== true) throw new Error("No current C07 admission")
  const consumers = rows(row.consumers, "route consumers")
  exactSet(consumers.map((entry) => text(entry.consumerTask, "consumer task")), strings(route.consumer_tasks, "required consumers"), "route consumers")
  consumers.forEach((consumer) => { text(consumer.consumerRef, "consumer ref"); text(consumer.observedAction, "consumer action"); evidenceRefs(consumer.evidenceRefs) })
}
