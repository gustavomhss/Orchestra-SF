import { createSfDomainClient } from "@orchestra/client/sucafina/domain"
import type { SfTransport } from "@orchestra/client/sucafina/transport"
import { SfDomainPageCap04, SfDomainPageCap05 } from "@orchestra/schema/sucafina/domain"
import type { SfContextStamp } from "@orchestra/schema/sucafina/context"

export type BudgetCapability = "CAP04" | "CAP05"
type Cap04Ok = Extract<typeof SfDomainPageCap04.output.Type, { status: "ok" }>
type Cap05Ok = Extract<typeof SfDomainPageCap05.output.Type, { status: "ok" }>
export type BudgetOwner = NonNullable<Cap04Ok["value"]["data"]["opexOwners"]>[number]
export type BudgetEntry = NonNullable<Cap04Ok["value"]["data"]["opexEntries"]>[number]
export type BudgetDeviation = NonNullable<Cap04Ok["value"]["data"]["deviations"]>[string]
export type BudgetYearHint = NonNullable<NonNullable<Cap04Ok["value"]["data"]["budgetYtd"]>["opex"]>[string]

export type BudgetPage = Readonly<{
  capabilityId: BudgetCapability
  context: SfContextStamp
  selection: Cap04Ok["value"]["selection"] | Cap05Ok["value"]["selection"]
  owners: readonly BudgetOwner[] | undefined
  entries: readonly BudgetEntry[] | undefined
  deviations: Readonly<Record<string, BudgetDeviation>> | undefined
  ytd: Readonly<Record<string, BudgetYearHint>> | undefined
  budgetLineIds: readonly string[] | undefined
  versions: Readonly<Record<string, number>>
  allowedActionIds: readonly string[]
}>
export type BudgetRead =
  | Readonly<{ state: "ready"; page: BudgetPage }>
  | Readonly<{ state: "unavailable" | "denied" | "session-expired" | "stale" | "invalid" }>
export type BudgetCommandName = "save" | "delete" | "save-entry" | "save-deviation" | "annual-entry" | "year-amount"
export type BudgetForm = Readonly<{
  name: string
  budget: string
  month: number
  actual: string
  forecast: string
  annual: string
  field: "budget" | "actual" | "forecast"
  amount: string
  flag: "" | "dev-green" | "dev-amber" | "dev-red"
  text: string
}>
export type BudgetCommand = Readonly<{
  action: BudgetCommandName
  recordId?: string
  parentId: string | null
  year: number
  version: number
  versions: Readonly<Record<string, number>>
  form: BudgetForm
}>
export type BudgetWriteResponse = Awaited<ReturnType<ReturnType<typeof createSfDomainClient>["domain.command.CAP04.save"]>>

const requiredStamp = (current: SfContextStamp, received: SfContextStamp) =>
  current.installationId === received.installationId &&
  current.projectId === received.projectId &&
  current.hostId === received.hostId &&
  current.principalRef === received.principalRef &&
  current.policyVersion === received.policyVersion &&
  current.accessRevision === received.accessRevision

/**
 * A01 is the only read producer. Absence of data fields is not zero or an empty
 * collection; transport failure is not not-found. Caller fences owner generation.
 */
export async function readBudgetPage(
  transport: SfTransport,
  capability: BudgetCapability,
  year: number,
  expected: SfContextStamp,
  signal: AbortSignal,
): Promise<BudgetRead> {
  const client = createSfDomainClient(transport)
  const response = capability === "CAP04"
    ? await client["domain.page.CAP04"]({ year }, { signal })
    : await client["domain.page.CAP05"]({ year }, { signal })
  if (response.kind !== "response") {
    return { state: "unavailable" }
  }
  if (response.body.status !== "ok") {
    if (response.body.status === "unauthenticated") return { state: "session-expired" }
    if (response.body.status === "denied") return { state: "denied" }
    if (response.body.status === "stale") return { state: "stale" }
    if (response.body.status === "needs-input") return { state: "invalid" }
    return { state: "unavailable" }
  }
  if (!requiredStamp(expected, response.body.context)) return { state: "denied" }
  const { value, context } = response.body
  if (value.capabilityId === "CAP04") {
    return {
      state: "ready",
      page: {
        capabilityId: "CAP04",
        context, selection: value.selection,
        owners: value.data.opexOwners,
        entries: value.data.opexEntries,
        deviations: value.data.deviations,
        ytd: value.data.budgetYtd?.opex,
        budgetLineIds: value.data.budgetLineIds,
        versions: value.versions,
        allowedActionIds: value.allowedActionIds,
      },
    }
  }
  return {
    state: "ready",
    page: {
      capabilityId: "CAP05",
      context, selection: value.selection,
      owners: value.data.capexProjects,
      entries: value.data.capexEntries,
      deviations: value.data.deviations,
      ytd: value.data.budgetYtd?.capex,
      budgetLineIds: value.data.budgetLineIds,
      versions: value.versions,
      allowedActionIds: value.allowedActionIds,
    },
  }
}

/**
 * Explicit, closed operation dispatch. Each case calls its own A01 typed method.
 * There is deliberately no arbitrary operation/path/action API, no retry, and
 * no client-side annual allocation, FX, deviation or forecast arithmetic.
 */
export async function writeBudgetPage(
  transport: SfTransport,
  capability: BudgetCapability,
  input: BudgetCommand,
  options: Readonly<{ signal: AbortSignal; idempotencyKey: string }>,
): Promise<BudgetWriteResponse> {
  const client = createSfDomainClient(transport)
  const { action, form, year, version, versions } = input
  const id = input.recordId
  const amount = (raw: string): number | null => raw.trim() === "" ? null : Number(raw)
  switch (action) {
    case "save": {
      const values = { name: form.name, budget: amount(form.budget), versions }
      return capability === "CAP04"
        ? client["domain.command.CAP04.save"]({ ...(id === undefined ? {} : { id }), version, values }, options)
        : client["domain.command.CAP05.save"]({ ...(id === undefined ? {} : { id }), version, values }, options)
    }
    case "delete": {
      const values = { versions }
      return capability === "CAP04"
        ? client["domain.command.CAP04.delete"]({ id, version, values }, options)
        : client["domain.command.CAP05.delete"]({ id, version, values }, options)
    }
    case "save-entry": {
      if (!input.parentId) throw new Error("budget parent missing")
      const common = {
        year, month: form.month, budget: amount(form.budget),
        actual: amount(form.actual), forecast: amount(form.forecast), versions,
      }
      return capability === "CAP04"
        ? client["domain.command.CAP04.save-entry"]({ ...(id === undefined ? {} : { id }), version, values: { ...common, ownerId: input.parentId } }, options)
        : client["domain.command.CAP05.save-entry"]({ ...(id === undefined ? {} : { id }), version, values: { ...common, projId: input.parentId } }, options)
    }
    case "save-deviation": {
      const values = { year, month: form.month, flag: form.flag, text: form.text, versions }
      return capability === "CAP04"
        ? client["domain.command.CAP04.save-deviation"]({ id, version, values }, options)
        : client["domain.command.CAP05.save-deviation"]({ id, version, values }, options)
    }
    case "annual-entry": {
      const values = { year, annual: amount(form.annual), field: form.field, versions }
      return capability === "CAP04"
        ? client["domain.command.CAP04.annual-entry"]({ id, version, values }, options)
        : client["domain.command.CAP05.annual-entry"]({ id, version, values }, options)
    }
    case "year-amount": {
      // Clearing a year hint is null; an observed zero remains numeric zero.
      const values = { year, amount: amount(form.amount), versions }
      return capability === "CAP04"
        ? client["domain.command.CAP04.year-amount"]({ id, version, values }, options)
        : client["domain.command.CAP05.year-amount"]({ id, version, values }, options)
    }
  }
}
