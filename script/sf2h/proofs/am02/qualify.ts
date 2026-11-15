import freeze from "../../../../modules/sucafina/Sucafinav1/product/contracts/freeze-v1.json" with { type: "json" }
import resident from "../../../../modules/sucafina/Sucafinav1/product/ai/manifests/resident.json" with { type: "json" }

// Qualification ONLY. Callers must supply independently captured host/CI traces.
// This never constructs calls, runs models, authorizes an operation, or emits PASS.
// Static manifests, profile catalog, component fixtures and human assertions do
// not count as observed runtime or as an independent FINAL review.

export type Am02Identity = {
  installationId: string
  projectId: string
  principalRef: string
  policyVersion: string
  accessRevision: string
  caseId: string
  caseIncarnation: string
  caseVersion: number
  businessVersion: string
}

export type Am02CallObservation = {
  operation: string
  handlerExport: string
  domainPort: string
  domainCallID: string
  bridgeCallID?: string
  inputDigest: string
  resultDigest: string
  sourceRefs: readonly string[]
  outputRef: string
  identity: Am02Identity
  receipt: {
    kind: "ui" | "native"
    operation: string
    handlerExport: string
    callId: string
    inputDigest: string
    resultDigest?: string
    principalRef: string
    accessRevision: string
    runId?: string
    nativeSessionId?: string
  }
}

export type Am02OperationWitness = {
  operation: string
  pack: string
  profileId: string
  skillId: string
  skill: {
    version: string
    sourceDigest: string
    instructionsDigest: string
    loadedMessageId: string
    nativeSessionId: string
    manifestDigest: string
  }
  ui: Am02CallObservation
  agent: Am02CallObservation
  mcp: Am02CallObservation
  native: {
    runtimeBuildSha: string
    candidateSha: string
    ciRunId: string
    ciRequestHash: string
    effectiveModel: string
    providerMessageRef: string
    admissionRef: string
    scannerVersion: string
    scannerState: "qualified" | "unavailable" | "unqualified"
    caseVersion: number
  }
  negatives: readonly {
    scenario: "no-grant" | "revoked" | "wrong-project" | "wrong-principal" | "stale-version"
    status: "denied" | "unavailable" | "provider-conflict"
    unbound: boolean
    domainEntered: boolean
    outputDisclosed: boolean
  }[]
  consumer: {
    outputRef: string
    observedActionRef: string
    observedAfterReload: boolean
    caseVersion: number
    authorizedPrincipalRef: string
  }
}

export type Am02Qualification = {
  status: "NOT_RUN" | "FAIL" | "QUALIFIED_NOT_FINAL"
  total: number
  packs: number
  rows: readonly { operation: string; pack: string; status: "NOT_RUN" | "FAIL" | "QUALIFIED_NOT_FINAL"; reasons: readonly string[] }[]
}

/** Compare real UI, public-agent and SDK-MCP observations against the same frozen domain descriptor.
 * A complete structural match is only ready for independent scrutiny; not AM02 PASS.
 */
export function qualifyAm02(witnesses: readonly Am02OperationWitness[]): Am02Qualification {
  const operations = freeze.operations
  const routes = resident.operation_call_routes
  const packs = new Set(operations.map((operation) => operation.pack))
  const uniqueOperations = new Set(operations.map((operation) => operation.operation))
  if (operations.length !== 39 || routes.length !== 39 || packs.size !== 8 || uniqueOperations.size !== 39)
    return { status: "FAIL", total: operations.length, packs: packs.size,
      rows: [{ operation: "canonical", pack: "all", status: "FAIL", reasons: ["canonical-8-39-contract-changed"] }] }
  const rows = operations.map((descriptor) => {
    const issues: string[] = []
    const candidates = witnesses.filter((item) => item.operation === descriptor.operation)
    const route = routes.find((item) => item.operation_id === descriptor.operation)
    if (!route || route.pack_id !== descriptor.pack || route.profile_id !== descriptor.routeProfile ||
      route.skill_id !== descriptor.routeSkill)
      issues.push("canonical-route-mismatch")
    if (candidates.length !== 1) return { operation: descriptor.operation, pack: descriptor.pack,
      status: candidates.length ? "FAIL" as const : "NOT_RUN" as const,
      reasons: candidates.length ? ["duplicate-operation-witness"] : ["no-observed-operation-witness"] }
    const witness = candidates[0]!
    const skill = resident.skills.find((item) => item.id === witness.skillId)
    const profile = resident.profiles.find((item) => item.id === witness.profileId)
    if (witness.pack !== descriptor.pack || witness.profileId !== route?.profile_id ||
      witness.skillId !== route?.skill_id || !profile?.allowedOperations.includes(witness.operation) ||
      !profile.allowedSkills.includes(witness.skillId) || !skill?.allowedOperations.includes(witness.operation) ||
      !skill.allowedProfiles.includes(witness.profileId))
      issues.push("route-not-granted")
    if (!skill || witness.skill.version !== skill.version || witness.skill.sourceDigest !== skill.sourceDigest ||
      witness.skill.instructionsDigest !== skill.instructionsDigest)
      issues.push("skill-bytes-or-version-changed")
    const calls = [witness.ui, witness.agent, witness.mcp]
    const first = witness.ui
    for (const call of calls) {
      if (call.operation !== descriptor.operation || call.handlerExport !== descriptor.handlerExport ||
        !call.domainPort || call.domainPort !== first.domainPort ||
        !call.inputDigest || call.inputDigest !== first.inputDigest ||
        !call.resultDigest || call.resultDigest !== first.resultDigest ||
        !call.outputRef || call.outputRef !== first.outputRef ||
        JSON.stringify([...call.sourceRefs].sort()) !== JSON.stringify([...first.sourceRefs].sort()))
        issues.push("domain-port-input-output-or-source-mismatch")
      if (JSON.stringify(call.identity) !== JSON.stringify(first.identity))
        issues.push("authority-or-business-version-mismatch")
      if (call.receipt.operation !== descriptor.operation || call.receipt.handlerExport !== descriptor.handlerExport ||
        call.receipt.inputDigest !== call.inputDigest || call.receipt.resultDigest !== call.resultDigest ||
        call.receipt.principalRef !== call.identity.principalRef ||
        call.receipt.accessRevision !== call.identity.accessRevision)
        issues.push("receipt-disagrees-with-domain")
    }
    if (first.receipt.kind !== "ui" || first.receipt.callId !== first.receipt.callId.trim() ||
      witness.agent.receipt.kind !== "native" || witness.mcp.receipt.kind !== "native")
      issues.push("surface-receipt-kind-mismatch")
    if (!witness.agent.domainCallID || witness.agent.domainCallID !== witness.mcp.domainCallID ||
      !witness.mcp.bridgeCallID || witness.mcp.bridgeCallID !== witness.mcp.receipt.callId ||
      witness.mcp.domainCallID === witness.mcp.bridgeCallID ||
      witness.agent.receipt.callId !== witness.mcp.receipt.callId ||
      witness.agent.receipt.runId !== witness.mcp.receipt.runId ||
      witness.mcp.receipt.nativeSessionId !== witness.skill.nativeSessionId)
      issues.push("bridgecallid-domaincallid-receipt-chain-broken")
    const native = witness.native
    const sha = /^[a-f0-9]{40}$/
    const digest = /^[a-f0-9]{64}$/
    if (!sha.test(native.runtimeBuildSha) || !sha.test(native.candidateSha) ||
      !digest.test(native.ciRequestHash) || !digest.test(witness.skill.manifestDigest) ||
      !witness.skill.loadedMessageId || !native.ciRunId || !native.effectiveModel ||
      !native.providerMessageRef || !native.admissionRef || !native.scannerVersion ||
      native.scannerState !== "qualified" ||
      native.caseVersion !== first.identity.caseVersion)
      issues.push("real-runtime-model-scanner-admission-or-ci-not-observed")
    if (!witness.negatives.some((item) => item.scenario === "no-grant") ||
      !witness.negatives.some((item) => item.scenario === "revoked") ||
      witness.negatives.some((item) => item.status === "provider-conflict" && item.scenario !== "revoked") ||
      witness.negatives.some((item) => !item.unbound || item.domainEntered || item.outputDisclosed))
      issues.push("negative-authorization-or-revocation-unproven")
    if (!witness.consumer.observedAfterReload || !witness.consumer.observedActionRef ||
      witness.consumer.outputRef !== first.outputRef ||
      witness.consumer.caseVersion !== first.identity.caseVersion ||
      witness.consumer.authorizedPrincipalRef !== first.identity.principalRef)
      issues.push("authorized-consumer-not-observed-after-reload")
    const unique = [...new Set(issues)]
    return { operation: descriptor.operation, pack: descriptor.pack,
      status: unique.length ? "FAIL" as const : "QUALIFIED_NOT_FINAL" as const, reasons: unique }
  })
  const extra = witnesses.some((item) => !uniqueOperations.has(item.operation))
  const failure = extra || rows.some((row) => row.status === "FAIL")
  const missing = rows.some((row) => row.status === "NOT_RUN")
  return { status: failure ? "FAIL" : missing ? "NOT_RUN" : "QUALIFIED_NOT_FINAL",
    total: operations.length, packs: packs.size,
    rows: extra ? [...rows, { operation: "unknown", pack: "all", status: "FAIL", reasons: ["unknown-operation-witness"] }] : rows }
}
