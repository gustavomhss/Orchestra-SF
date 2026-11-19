// F04 native fixture: implementation only; installed/auth/desktop proof requires the real host.
// This is DOMAIN-FIXTURE evidence only. Actual UI/auth/desktop proof requires an installed host.
import type { Actor, Environment, Persistence, Result } from "../../../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import { object, rows, text } from "../../../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import { ProcurementModule } from "../../../../../../modules/sucafina/Sucafinav1/runtime/procurement.ts"
import { initialProcurementSettings } from "../../../../../../modules/sucafina/Sucafinav1/src/initial-settings.ts"
import { createVolumeCorpus } from "../../../../../../modules/sucafina/Sucafinav1/test/product/wp00/fixtures/volume.ts"
import { createPlannerCorpus } from "../../../../../../modules/sucafina/Sucafinav1/test/product/wp00/fixtures/planner.ts"
import inputs from "../../../../../../modules/sucafina/Sucafinav1/test/product/wp00/fixtures/consumer-inputs.json" with { type: "json" }

export const nativeCorpus = {
  schema: "sf2h-native-corpus-v1" as const,
  proofClass: "DOMAIN_FIXTURE_NOT_INSTALLED" as const,
  canonicalSource: "WP00.T03 / WP10.T01 / WP10.T04",
  expected: {
    financialLines: 1000,
    purchaseOrders: 200,
    projects: 100,
    actual2027: "$1000",
    forecast2027: "$2000",
    firstRequest: "synthetic-po-1",
    firstAmount: "1 USD",
    pilotPrEstimate: inputs.procurement.prEstimate,
    lastRequest: "synthetic-po-200",
    lastAmount: "200 USD",
    baseOutlook: "$590,000.00",
    outlook84: "$602,000.00",
    outlook78: "$596,000.00",
    budget: "$600,000.00",
    actual: "$400,000.00",
  },
  pilot: {
    p0: "draft pr.title save with requests:<id> version CAS; never an approval",
    p1: "persisted pr_pending from real submit_pr, then holder approval in installed UI",
    unknownResponse: "read original producer state/receipt, never blindly resubmit",
  },
} as const

/** Read the original deterministic corpus. This never replaces a real-domain producer. */
export function sourceNativeVolume() {
  const volume = createVolumeCorpus()
  const planner = createPlannerCorpus()
  if (volume.financial.length !== nativeCorpus.expected.financialLines ||
      volume.purchaseOrders.length !== nativeCorpus.expected.purchaseOrders ||
      volume.projects.length !== nativeCorpus.expected.projects ||
      volume.financial.reduce((total, line) => total + line.actual, 0) !== inputs.volume.expected.financialActual ||
      volume.financial.reduce((total, line) => total + line.forecast, 0) !== inputs.volume.expected.financialForecast ||
      volume.purchaseOrders.reduce((total, row) => total + row.pr.estAmount, 0) !== inputs.volume.expected.purchaseOrderTotal ||
      volume.purchaseOrders[0]?.pr.estAmount !== 1 ||
      volume.purchaseOrders.at(-1)?.pr.estAmount !== 200)
    throw new Error("F04_SOURCE_CORPUS_DRIFT")
  if (rows(planner.data.versions)[0]?.id !== inputs.planner.versionId ||
      inputs.procurement.prEstimate !== 32000 ||
      inputs.planner.expected.baseOutlook !== 590000 ||
      inputs.planner.expected.replacement84000 !== 602000 ||
      inputs.planner.expected.replacement78000 !== 596000)
    throw new Error("F04_PLANNER_CORPUS_DRIFT")
  return { volume, planner }
}

export type NativeRealActors = Readonly<{
  setup: Actor
  requester: Actor
  holder: Actor
  denied: Actor
}>

export type NativePilotSeed = Readonly<{
  proofClass: "DOMAIN_FIXTURE_NOT_INSTALLED"
  p0: { requestId: string; originalTitle: string; version: number; status: "draft" }
  p1: { requestId: string; version: number; status: "pr_pending"; holderRef: string }
  secondActor: { principalRef: string; observedStatus: 403 }
}>

function needSuccessful(result: Result, action: string): unknown {
  if (!result.ok) throw new Error("F04_REAL_DOMAIN_" + action + "_REFUSED_" + result.status)
  return result.value
}

function requestId(value: unknown): string {
  const id = text(object(value).number)
  if (!/^PR-\d{4}-\d+$/.test(id)) throw new Error("F04_PRODUCER_REQUEST_ID_UNAVAILABLE")
  return id
}

/**
 * Seed an *already isolated*, genuine SQLite-backed producer using original
 * ProcurementModule commands, not fake approval snapshots/receipts. Callers
 * must supply actors resolved by their real host; this function CANNOT attest
 * that those actors were authenticated. Actor roles are test input, never an auth grant.
 * The denial below is a domain-only negative, not an HTTP/installed ACL proof. Installed qualification MUST use real
 * browser/server auth and the original HTTP Command/holder path afterwards.
 */
export async function seedNativeProcurementCorpus(input: {
  persistence: Pick<Persistence, "transaction">
  environment: Environment
  actors: NativeRealActors
}): Promise<NativePilotSeed> {
  const { setup, requester, holder, denied } = input.actors
  if (new Set([setup.id, requester.id, holder.id, denied.id]).size !== 4 ||
      !setup.canWrite || !setup.roles.includes("admin") ||
      !requester.canWrite || !requester.roles.some((role) => role === "requester" || role === "admin") ||
      !holder.canWrite || !holder.roles.some((role) => role === "approver" || role === "admin") ||
      !denied.canWrite || !denied.roles.includes("approver"))
    throw new Error("F04_REQUIRES_FOUR_DISTINCT_DOMAIN_ACTOR_ARGUMENTS")
  const originalTitle = "F04 real domain P0 draft title"
  const submittedTitle = "F04 real domain P1 submitted PR"
  const seeded = await input.persistence.transaction("procurement", async (snapshot) => {
    const invoke = (actor: Actor, action: string, version: number, values: Record<string, unknown>, id?: string) =>
      needSuccessful(ProcurementModule.domain.execute(
        snapshot, actor, { page: action === "reset" ? "Settings" : action === "settings-save" ? "Settings" : "Requests",
          action: action === "settings-save" ? "save" : action, version, values, ...(id ? { id } : {}) },
        input.environment,
      ), action)

    invoke(setup, "reset", snapshot.versions.settings?.version ?? 0, {})
    const settings = initialProcurementSettings()
    const settingsVersion = snapshot.versions.settings?.version
    if (settingsVersion === undefined) throw new Error("F04_SETTINGS_CAS_MISSING")
    invoke(setup, "settings-save", settingsVersion, {
      settings: { ...settings, levels: settings.levels.map((level) => ({ ...level, holderId: holder.id })),
        blockSelfApproval: true },
    })

    const requisition = (title: string) => ({
      pr: { title, type: "service", description: "F04 canonical service request",
        estAmount: inputs.procurement.prEstimate, costCenter: "Synthetic IT", needBy: "2026-12-01",
        justification: "Verify real native CAS and holder admission", expenseType: "OPEX" },
    })
    const p0 = requestId(invoke(requester, "create", 0, requisition(originalTitle)))
    const p1 = requestId(invoke(requester, "create", 0, requisition(submittedTitle)))
    if (p0 === p1) throw new Error("F04_NON_UNIQUE_PRODUCER_IDENTITIES")
    const p1Before = snapshot.versions["requests:" + p1]?.version
    if (p1Before === undefined) throw new Error("F04_P1_VERSION_UNAVAILABLE")
    invoke(requester, "submit_pr", p1Before, {}, p1)
    const p0Version = snapshot.versions["requests:" + p0]?.version
    const p1Version = snapshot.versions["requests:" + p1]?.version
    if (p0Version === undefined || p1Version === undefined)
      throw new Error("F04_PILOT_VERSIONS_UNAVAILABLE")
    const requests = rows(ProcurementModule.domain.view(snapshot, holder, input.environment).data.requests)
    const observedP0 = requests.find((row) => text(row.number) === p0)
    const observedP1 = requests.find((row) => text(row.number) === p1)
    if (!observedP0 || text(observedP0.status) !== "draft" ||
        text(object(observedP0.pr).title) !== originalTitle ||
        object(observedP0.pr).estAmount !== inputs.procurement.prEstimate ||
        !observedP1 || text(observedP1.status) !== "pr_pending" ||
        object(observedP1.pr).estAmount !== inputs.procurement.prEstimate)
      throw new Error("F04_REAL_DOMAIN_SEED_NOT_OBSERVABLE")
    const steps = rows(object(observedP1.prApproval).steps)
    if (!steps.some((step) => step.holderId === holder.id && step.status === "pending"))
      throw new Error("F04_CURRENT_HOLDER_NOT_PROVEN")
    return { commit: true, value: { p0, p0Version, p1, p1Version } }
  })
  // The wrong actor is denied by the real producer in a rollback transaction.
  // Never record a refused synthetic attempt as an approval or durable receipt.
  const denial = await input.persistence.transaction("procurement", async (snapshot) => {
    const result = ProcurementModule.domain.execute(snapshot, denied,
      { page: "My approvals", action: "approve", id: seeded.p1,
        version: snapshot.versions["requests:" + seeded.p1]?.version ?? -1,
        values: { comment: "Unauthorized F04 negative probe" } }, input.environment)
    return { commit: false, value: result }
  })
  if (denial.ok || denial.status !== 403) throw new Error("F04_SECOND_ACTOR_NOT_DENIED_BY_DOMAIN")
  return {
    proofClass: "DOMAIN_FIXTURE_NOT_INSTALLED",
    p0: { requestId: seeded.p0, originalTitle, version: seeded.p0Version, status: "draft" },
    p1: { requestId: seeded.p1, version: seeded.p1Version, status: "pr_pending", holderRef: holder.id },
    secondActor: { principalRef: denied.id, observedStatus: 403 },
  }
}
