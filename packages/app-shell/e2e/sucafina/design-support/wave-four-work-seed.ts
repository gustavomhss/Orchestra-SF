import { randomUUID } from "node:crypto"
import { waveFourProcurementData } from "./wave-four-procurement-data"

type Installed = {
  actorId: string
  request(pathname: string, init?: RequestInit): Promise<Response>
}

export const waveFourWorkData = {
  title: "Design test data · Service continuity follow-up",
} as const

export type WaveFourWorkSeed = Readonly<{
  title: string
  topicId: string
  actionRef: string
  sourceVersion: number
  ownerRef: string
  ownerName: string
}>

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Canonical Work seed expected an object")
  return value as Record<string, unknown>
}

function list(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error("Canonical Work seed expected a source list")
  return value
}

function text(value: unknown) {
  if (typeof value !== "string" || !value.trim())
    throw new Error("Canonical Work seed omitted a source identifier")
  return value
}

async function responseBody(response: Response, stage: string) {
  if (!response.headers.get("Content-Type")?.includes("application/json"))
    throw new Error("Canonical Work seed received a non-JSON " + stage + " response (HTTP " + response.status + ")")
  return object(await response.json())
}

async function result(response: Response, stage: string) {
  const body = await responseBody(response, stage)
  if (response.status !== 200 || body.status !== "ok" || !Object.hasOwn(body, "value"))
    throw new Error("Canonical Work seed rejected " + stage + " (HTTP " + response.status + "): " +
      String(body.reason ?? body.status))
  return body.value
}

/**
 * UI30-only post-host seed. All operations use the originally enrolled HTTP
 * session. The Handoff producer invokes the original Dashboard domain command
 * and C08 relation/assignment transactions. No source, context, grant, receipt,
 * directory identity, storage revision or successful response is manufactured.
 * An absent self-recipient may be registered by the original admin command with
 * assigned: []; this never assigns a contributor module or changes a role.
 *
 * Creating a plain assigned Hot Topic is insufficient: Work requires the
 * producer's handoff relation to a source in the selected Procurement collection.
 * This helper creates that local relation through its public human command.
 * It sends no email, chat message, invitation or other external communication.
 */
export async function seedWaveFourWork(installed: Installed, year: number): Promise<WaveFourWorkSeed> {
  if (!installed.actorId.trim() || !Number.isSafeInteger(year))
    throw new Error("Canonical Work seed requires the enrolled actor and fixture year")
  const period = { start: year + "-01-01", end: year + "-12-31" }
  const post = async (mode: string, payload: unknown) => result(await installed.request(
    "/dashboard?" + new URLSearchParams({ sf: "collaboration-" + mode }), {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID() },
      body: JSON.stringify(payload),
    }), mode)

  // Register before issuing selection/evidence because the original admin
  // command advances accessRevision. Every later call obtains fresh authority.
  const person = await prepareRecipient(installed, post)
  const ownerRef = text(person.id), ownerName = text(person.name)
  const selected = object(await result(await installed.request(
    "/api/ui/projections/work-selection?" + new URLSearchParams(period)), "work-selection"))
  const selectedPeriod = object(selected.period)
  if (selectedPeriod.start !== period.start || selectedPeriod.end !== period.end)
    throw new Error("Canonical Work seed returned a different selected period")
  const selection = { selectionRef: text(selected.selectionRef), period }
  const readWork = async () => list(object(await post("work-list", selection)).items).map(object)

  const original = (await readWork()).filter((item) =>
    item.kind === "procurement" && item.title === waveFourProcurementData.requests.prApproval &&
    item.ownerRef === installed.actorId)
  if (original.length !== 1)
    throw new Error("Canonical Work seed requires exactly one owned continuity requisition")
  const item = original[0]!
  const sources = list(item.sourceRefs)
  const originals = sources.map(object).filter((source) => source.refId === item.actionRef)
  const source = originals[0]
  if (originals.length !== 1 || !source || source.kind !== "record")
    throw new Error("Canonical Work seed did not receive the original selected record evidence")
  const target = object(source.target)
  const sourcePeriod = object(target.period)
  if (target.surface !== "procurement" || target.recordType !== "procurement-request" ||
    sourcePeriod.start !== period.start || sourcePeriod.end !== period.end)
    throw new Error("Canonical Work seed source belongs to a different domain or period")

  const created = object(await post("handoff-create", {
    intent: {
      correlationKey: randomUUID(), sourceRefs: sources,
      action: waveFourWorkData.title, owner: ownerName, due: year + "-12-18",
      priority: "high", notes: "",
    },
    sourceRef: text(source.refId),
    recipientRef: ownerRef,
    relationKey: randomUUID(),
  }))
  const topic = object(created.topic)
  const topicId = text(topic.id)
  if (!["created", "existing"].includes(String(created.state)) || !text(created.relationId) ||
    topic.action !== waveFourWorkData.title || topic.owner !== ownerName)
    throw new Error("The original Handoff producer did not confirm the requested local action")

  // This is a fresh canonical Work read, not a projection installed by the seed.
  const confirmed = (await readWork()).filter((entry) =>
    entry.kind === "handoff" && entry.title === waveFourWorkData.title &&
    entry.ownerRef === ownerRef && object(entry.destination).kind === "hot-topic" &&
    object(entry.destination).topicId === topicId)
  if (confirmed.length !== 1)
    throw new Error("The original Work producer did not list the confirmed local handoff")
  const work = confirmed[0]!
  const sourceVersion = work.sourceVersion
  if (typeof sourceVersion !== "number" || !Number.isSafeInteger(sourceVersion) || sourceVersion < 1)
    throw new Error("Canonical Work seed omitted the confirmed source version")
  return { title: waveFourWorkData.title, topicId, actionRef: text(work.actionRef),
    sourceVersion, ownerRef, ownerName }
}

/**
 * Register only the already authenticated operator, through the original admin
 * authorizer and a CAS observed in its real form. runtime/admin.ts accepts []
 * as no assigned contributor modules; src/nav.ts does not derive any write
 * permission from an empty assignment. No role/roleMap or grant is changed.
 * Never clear an existing assignment or retry a conflicting configuration.
 */
async function prepareRecipient(
  installed: Installed,
  post: (mode: string, payload: unknown) => Promise<unknown>,
) {
  const read = async () => list(await post("recipients", {})).map(object)
    .filter((person) => person.id === installed.actorId)
  const existing = await read()
  if (existing.length === 1) return existing[0]!
  if (existing.length) throw new Error("The enrolled operator has an ambiguous recipient identity")

  const before = await emptyAssignment(installed)
  if (before !== 0)
    throw new Error("The original self-recipient is unavailable despite an existing assignment revision")
  const response = await installed.request("/dashboard", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      page: "Executive Dashboard", action: "configure-assignment",
      id: installed.actorId, version: before, values: { person: installed.actorId, assigned: [] },
    }),
  })
  const configured = await responseBody(response, "empty-self-assignment")
  if (response.status !== 200 || configured.ok !== true)
    throw new Error("The original admin authorizer rejected empty self-assignment (HTTP " + response.status + ")")
  if (await emptyAssignment(installed) !== before + 1)
    throw new Error("The original admin form did not confirm the empty assignment revision")
  const confirmed = await read()
  if (confirmed.length !== 1)
    throw new Error("The originally enrolled operator is not a unique admitted recipient after empty registration")
  return confirmed[0]!
}

/** Read only this exact original form; a changed or unavailable form fails shut. */
async function emptyAssignment(installed: Installed) {
  const response = await installed.request("/dashboard?" + new URLSearchParams({ page: "Executive Dashboard" }))
  if (response.status !== 200 || !response.headers.get("Content-Type")?.includes("text/html"))
    throw new Error("The original admin form is unavailable (HTTP " + response.status + ")")
  const html = await response.text()
  const matches = [...html.matchAll(/<form data-command="configure-assignment" data-page="Executive Dashboard" data-record="([^"]*)" data-version="(\d+)">([\s\S]*?)<\/form>/g)]
    .filter((match) => match[1] === installed.actorId)
  const selected = matches[0]
  if (matches.length !== 1 || !selected ||
    /<input\b[^>]*\schecked(?:\s|=|>)/.test(selected[3]!) ||
    /<button\b[^>]*\sdisabled(?:\s|=|>)/.test(selected[3]!))
    throw new Error("The original self-assignment form is missing, disabled or already assigns modules")
  const version = Number(selected[2])
  if (!Number.isSafeInteger(version) || version < 0)
    throw new Error("The original self-assignment form omitted its CAS revision")
  return version
}
