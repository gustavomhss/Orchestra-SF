import { canonical, digest, exactSet, missionSha, object, planningSha, proofIds, requireSha, rows, strings, text } from "./schema.ts"
import type { PreparedPlan, ProofCheck } from "./schema.ts"

/** Both definition layers remain byte-for-byte semantically equal to the pinned
 * source. In particular, indexing by AM id must not discard the second layer. */
export function preparePlan(coverageValue: unknown, pinnedValue: unknown, candidate?: string): PreparedPlan {
  const coverage = object(coverageValue, "coverage")
  const pinned = object(pinnedValue, "pinned definitions")
  if (pinned.planning_sha !== planningSha) throw new Error("Planning SHA mismatch")
  const definitions = rows(coverage.proof_definitions, "proof_definitions")
  if (canonical(definitions) !== canonical(pinned.proof_definitions)) throw new Error("Pinned proof definitions changed or omitted")
  if (definitions.length !== 12 || proofIds.some((id) => definitions.filter((row) => row.id === id).length !== 2))
    throw new Error("Both AM01-AM06 definition layers are required")
  const profiles = rows(coverage.profiles, "profiles")
  const skills = rows(coverage.skills, "skills")
  const packs = rows(coverage.mcp_packs, "mcp_packs")
  const routes = rows(coverage.operation_call_routes, "operation_call_routes")
  exactSet(profiles.map((row) => text(row.id, "profile id")), ["sf_maestro", "sf_finance", "sf_procurement", "sf_portfolio", "sf_reviewer"], "profiles")
  const am01 = definitions.find((row) => row.id === "AM01" && Array.isArray(row.skills))!
  exactSet(skills.map((row) => text(row.id, "skill id")), strings(am01.skills, "AM01.skills"), "skills")
  if (skills.length !== 18 || packs.length !== 8 || routes.length !== 39) throw new Error("Expected 18 skills / 8 packs / 39 positive routes")
  exactSet(packs.map((row) => text(row.id, "pack id")), strings(am01.packs, "AM01.packs"), "packs")
  const operations: Record<string, unknown>[] = packs.flatMap((pack) => rows(pack.operations, "pack operations").map((operation) => ({ ...operation, packId: pack.id })))
  exactSet(routes.map((row) => text(row.operation_id, "route operation")), operations.map((row) => text(row.id, "operation id")), "39 operations")
  for (const route of routes) {
    const profile = profiles.find((row) => row.id === route.profile_id)
    const skill = skills.find((row) => row.id === route.skill_id)
    const operation = operations.find((row) => row.id === route.operation_id)
    if (!profile || !skill || !operation || operation.packId !== route.pack_id || route.requires_loaded_skill_receipt !== true ||
      !strings(profile.allowed_skills, "profile skills").includes(String(skill.id)) ||
      !strings(profile.allowed_operations, "profile operations").includes(String(operation.id)) ||
      !strings(skill.profiles, "skill profiles").includes(String(profile.id)) ||
      !strings(skill.allowed_operations, "skill operations").includes(String(operation.id)) ||
      !strings(operation.profiles, "operation profiles").includes(String(profile.id)))
      throw new Error(`Route cannot pass C16: ${String(route.operation_id)}`)
    if (!strings(route.consumer_tasks, "route consumers").length) throw new Error("Route has no consumer")
  }
  const checks: ProofCheck[] = definitions.flatMap((definition, index) => definitionChecks(definition, index))
  skills.forEach((skill, index) => {
    for (const [field, kind] of [["positive_acceptance", "positive"], ["negative_acceptance", "negative"], ["visible_consumption", "consumption"],
      ["missing_or_failure", "negative"], ["stale_or_access_change", "negative"], ["negative_discriminator", "negative"]] as const) {
      checks.push({ id: `AM01.skill.${String(skill.id)}.${field}`, proofId: "AM01", skillId: String(skill.id),
        sourcePointer: `/skills/${index}/${field}`, kind, expected: text(skill[field], field),
        ownerTasks: strings(skill.producer_tasks, "skill producers"), consumerTasks: strings(skill.consumer_tasks, "skill consumers") })
    }
  })
  routes.forEach((route, index) => {
    for (const [field, kind] of [["expected", "positive"], ["negative", "negative"]] as const)
      checks.push({ id: `AM02.route.${String(route.operation_id)}.${kind}`, proofId: "AM02", operationId: String(route.operation_id),
        skillId: String(route.skill_id), sourcePointer: `/operation_call_routes/${index}/${field}`, kind,
        expected: text(route[field], field), ownerTasks: [text(route.producer_task, "route producer"), "WP10.T06"],
        consumerTasks: strings(route.consumer_tasks, "route consumers") })
  })
  const requiredReceiptFields = Object.fromEntries(proofIds.map((id) => [id, [...new Set(definitions.filter((row) => row.id === id)
    .flatMap((row) => row.required_receipt_fields === undefined ? [] : strings(row.required_receipt_fields, "receipt fields")))]]))
  return { schema: "sf2h-native-plan-v1", planningSha, missionSha, candidateC: candidate ? requireSha(candidate, "candidate C") : null,
    status: "PREPARED_NOT_RUN", nativeAccepted: false, coverageDigest: digest(canonical(coverage)),
    counts: { profiles: profiles.length, skills: skills.length, packs: packs.length, operations: routes.length, proofDefinitions: definitions.length, checks: checks.length },
    requiredReceiptFields, campaignEvidenceFields: strings(object(coverage.campaign_evidence, "campaign evidence").required_fields, "campaign evidence fields"), checks }
}

function definitionChecks(definition: Record<string, unknown>, index: number): ProofCheck[] {
  const id = text(definition.id, "proof id")
  const ownerTasks = definition.owner_tasks ? strings(definition.owner_tasks, "owners") :
    [text(definition.owner_task, "owner"), ...strings(definition.producer_tasks, "producers")]
  const consumerTasks = definition.consumer_tasks ? strings(definition.consumer_tasks, "consumers") : []
  const check = (expected: unknown, pointer: string, kind: ProofCheck["kind"]): ProofCheck => ({
    id: `${id}.definition.${index}.${pointer.replaceAll("/", ".")}`, proofId: id,
    sourcePointer: `/proof_definitions/${index}/${pointer}`, kind, expected: text(expected, pointer), ownerTasks, consumerTasks,
  })
  return [
    ...(["checks", "positive_checks", "negative_checks"] as const).flatMap((field) => definition[field] === undefined ? [] :
      strings(definition[field], field).map((value, item) => check(value, `${field}/${item}`, field === "negative_checks" ? "negative" : field === "positive_checks" ? "positive" : "check"))),
    ...(definition.cases === undefined ? [] : rows(definition.cases, "cases").flatMap((row, item) => [
      check(row.positive, `cases/${item}/positive`, "positive"), check(row.negative, `cases/${item}/negative`, "negative"),
      check(row.expected_consumed_outputs, `cases/${item}/expected_consumed_outputs`, "consumption"),
    ])),
    ...(definition.pack_matrix === undefined ? [] : rows(definition.pack_matrix, "pack matrix").map((row, item) => check(row.expected, `pack_matrix/${item}/expected`, "check"))),
  ]
}
