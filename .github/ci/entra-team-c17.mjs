import assert from "node:assert/strict"
import { createHash, randomUUID } from "node:crypto"
import { access, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import { Database } from "bun:sqlite"

const root = process.env.GITHUB_WORKSPACE
const candidate = (path) => import(pathToFileURL(join(root, path)).href)
const moduleRoot = "modules/sucafina/Sucafinav1"
const [{ digestSfValue }, { RENEWAL_TRANSITION_CATEGORIES }, { openLocalStore, decodeSnapshot }, { readCurrentChoiceBinding }] = await Promise.all([
  candidate(moduleRoot + "/product/contracts/canonical.ts"),
  candidate(moduleRoot + "/product/contracts/decisions.ts"),
  candidate(moduleRoot + "/runtime/local-store.ts"),
  candidate(moduleRoot + "/product/decisions/current-choice-preview.ts"),
])
export const c17Case = "C17 CurrentChoice calculates and persists the recorded Planner scenario for the admitted Microsoft Team"
const horizon = { start: "2027-01-01", end: "2027-12-31" }
const currency = "USD"
const objective = "Record-only C17 calculation on the installed Team Planner"
const criterion = "Keep the increase in known subtotal at or below 2000 USD"
const pending = "The synthetic service amount does not establish complete coverage"
const otherTeam = "44444444-4444-4444-8444-444444444445"

export async function exerciseTeamC17(input) {
  const { tab, request, origin, binding, team, allowed, denied, signIn } = input
  const dashboard = binding.mount + "/teams/" + team + "/dashboard"
  const partition = digestSfValue({ installationId: binding.installationId, tenantId: binding.tenantId, teamObjectId: team })
  const other = digestSfValue({ installationId: binding.installationId, tenantId: binding.tenantId, teamObjectId: otherTeam })
  const base = join(process.env.CI_RUNTIME, "installation", "business-teams")
  const directory = join(base, partition)
  const snapshotRows = () => {
    const database = new Database(join(directory, "installation.sqlite"), { readonly: true, strict: true })
    try { return database.query("SELECT surface, payload FROM snapshots ORDER BY surface").all() }
    finally { database.close() }
  }
  const state = () => {
    const database = new Database(join(directory, "installation.sqlite"), { readonly: true, strict: true })
    try {
      const row = database.query("SELECT payload FROM snapshots WHERE surface = 'dashboard'").get()
      assert(row)
      return decodeSnapshot(row.payload).data.__sfProductV1
    } finally { database.close() }
  }
  const tool = new URL(origin + dashboard)
  const url = (mode, query = {}, destination = dashboard) =>
    destination + "?" + new URLSearchParams({ sf: mode, ...query })
  const postRaw = (mode, payload, overrides = {}) => request(url(mode, {}, overrides.dashboard), {
    cookie: overrides.cookie ?? allowed,
    timeout: overrides.timeout,
    accept: "application/json",
    method: "POST", json: payload, idempotencyKey: overrides.key ?? randomUUID(),
  })
  const read = (mode, query) => request(url(mode, query), { cookie: allowed, accept: "application/json", timeout: 120_000 })
  const ok = async (response, mode) => {
    assert.match(response.headers.get("content-type") ?? "", /application\/json/, mode)
    const value = await response.json()
    assert.equal(response.status, 200, mode + " " + String(value.reason ?? ""))
    assert.equal(value.status, "ok", mode)
    return value
  }
  const post = async (mode, body) => ok(await postRaw(mode, body, { timeout: 120_000 }), mode)
  const controls = async (ref) => {
    const body = await ok(await read("decision-controls", { case: ref, format: "json" }), "decision-controls")
    return body.value.selected
  }
  // Only raw Planner inputs are seeded. Installed APIs create all decision records.
  const store = await openLocalStore(directory)
  try {
    await store.transaction("planner", async (snapshot) => {
      assert.equal(Object.keys(snapshot.data).length, 0)
      const versions = [{ id: "c17-baseline", amount: 100 }, { id: "c17-candidate", amount: 200 }].map(({ id, amount }) => ({
        id, name: id, year: 2027, closed: 1, lines: [{ id: "service", name: "Annual service", ownerId: "owner",
          sec: "opex", el: "licenses", cur: "USD", b: Array(12).fill(amount), a: [amount, ...Array(11).fill(null)],
          f: [null, ...Array(11).fill(amount)] }], fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {},
      }))
      snapshot.data = { versions, officials: { "2027": "c17-baseline" }, entities: [], allocations: [], roster: [] }
      return { commit: true, value: undefined }
    })
  } finally { await store.dispose() }

  const created = await post("workbench-command", { operation: "sf_case_draft",
    input: { objective, horizon, currency, criteria: [criterion], sourceRefs: [] } })
  const reference = created.outputRef
  const unprovisioned = digestSfValue(snapshotRows())
  const invalid = await read("decision-controls", { case: "different-case", format: "json" })
  assert.equal(invalid.status, 403, "unknown case denied before source bootstrap")
  assert.deepEqual(await invalid.json(), { status: "denied" })
  assert.equal(digestSfValue(snapshotRows()), unprovisioned, "denied case provisioned a snapshot")
  const draft = await controls(reference)
  process.stdout.write("C17_TEAM_CONTROLS_OK: case available before BI\n")
  const criteria = draft.decision.criteria.map((entry) => entry.id)
  assert.equal(criteria.length, 1)
  const options = (await ok(await read("bi-options", { viewId: "BI01", ...horizon }), "bi-options")).value
  const sources = []
  for (const id of ["c17-baseline", "c17-candidate"]) {
    const version = options.versions.find((value) => value.label.startsWith(id + " (" + id + ")"))
    assert(version, id)
    const reply = await read("bi-data", { viewId: "BI01", ...horizon, baseRef: version.ref, candidateRef: version.ref, currency })
    assert.equal(reply.status, 200, "bi-data")
    const values = (await reply.json()).projection.values
    const source = values.flatMap((value) => [...value.sourceRefs, value.drilldown]).find((value) =>
      value?.kind === "record" && value.refId === version.ref && value.target.surface === "planner" && value.target.recordId === id)
    assert(source, id)
    sources.push(source)
  }
  const edited = await post("decision-edit", { caseRef: draft.caseRef, objective, horizon, currency,
    criteria: draft.decision.criteria, sourceRefs: sources })
  let caseRef = edited.value.caseRef
  let coverageRef
  const basis = { id: "human-cost-inventory:" + randomUUID(), version: 1, decisionType: "renewal-transition-v1",
    categoryIds: RENEWAL_TRANSITION_CATEGORIES, additionalCategoryIds: [], sourceRefs: sources }
  for (const source of sources) {
    coverageRef = (await post("decision-coverage", { caseRef, source, basis, expectedVersion: 0,
      entries: basis.categoryIds.map((categoryId) => ({ categoryId, status: "pending", reason: pending })) })).value.coverageRef
    caseRef = (await post("decision-promote", { caseRef, coverageRef, title: source.target.recordId,
      scenario: { baseRef: source.refId, operations: [], assumptions: [] } })).value.caseRef
  }
  const comparedCase = await controls(reference)
  assert.deepEqual(comparedCase.caseRef, caseRef)
  const [baseline, candidate] = sources.map((source) =>
    comparedCase.decision.alternatives.find((item) => item.scenario.baseRef === source.refId))
  assert(baseline && candidate)
  await post("decision-criteria", { caseRef, criterionId: criteria[0], metricRef: "planner:known-subtotal-difference",
    operator: "lte", value: 2000, unit: currency, period: horizon, evidenceRefs: sources, expectedRuleVersion: 0 })
  const compared = (await post("decision-compare", { caseRef, baselineAlternativeId: baseline.id, alternativeId: candidate.id, criteria })).value
  assert.equal(compared.comparison.knownDifference, 1200)
  assert.equal(compared.comparison.completeDifference, null)
  const chosen = await post("decision-choose", { caseRef, alternativeId: candidate.id, alternativeVersion: candidate.version,
    comparison: compared.request, criteria, reason: "Keep the candidate under recorded pending cost conditions" })
  const recorded = await controls(reference)
  caseRef = recorded.caseRef
  assert.deepEqual(chosen.value.caseRef, caseRef)
  assert.equal(recorded.decision.choices.length, 1)
  const choice = recorded.decision.choices[0]
  const prepare = { caseRef, choiceId: choice.id, alternativeRef: { id: candidate.id, version: candidate.version }, coverageRef }
  const target = tool.origin + url("current-choice", { case: reference })
  const section = tab.locator("section.sf-current-choice")
  const button = section.getByRole("button", { name: "Preparar escolha vigente", exact: true })
  const before = digestSfValue(snapshotRows())
  assert.equal((await tab.goto(target, { waitUntil: "domcontentloaded", timeout: 120_000 })).status(), 200)
  await button.waitFor({ state: "visible", timeout: 30_000 })
  assert(await button.isDisabled(), "prepare disabled until Atlas has the capture")
  const absent = await postRaw("current-choice-prepare", prepare, { timeout: 120_000 })
  assert.equal(absent.status, 503)
  assert.deepEqual(await absent.json(), { status: "unavailable", reason: "choice-source-continuity-unavailable" })
  assert.equal(digestSfValue(snapshotRows()), before, "no prepared write without Atlas")
  process.stdout.write("C17_TEAM_WITHOUT_ATLAS_DENIED\n")

  const captureKey = randomUUID()
  const archive = async () => ok(await postRaw("decision-archive-choice", caseRef, {
    key: captureKey, timeout: 120_000,
  }), "decision-archive-choice")
  const archived = await archive()
  assert.match(archived.eventId, /\S/)
  const archivedState = digestSfValue(snapshotRows())
  assert.equal((await archive()).eventId, archived.eventId, "archive replay returns canonical event")
  assert.equal(digestSfValue(snapshotRows()), archivedState, "archive replay did not write a second event")
  process.stdout.write("C17_TEAM_ARCHIVE_OK\n")
  assert.equal((await tab.reload({ waitUntil: "domcontentloaded", timeout: 120_000 })).status(), 200)
  await button.waitFor({ state: "visible", timeout: 30_000 })
  assert(await button.isEnabled())
  const responseTarget = tool.origin + url("current-choice-prepare")
  const observed = tab.waitForResponse((response) => response.url() === responseTarget && response.request().method() === "POST", { timeout: 330_000 })
  await button.click()
  const resultResponse = await observed
  assert.deepEqual(resultResponse.request().postDataJSON(), prepare)
  assert.equal(resultResponse.status(), 200)
  const result = await resultResponse.json()
  assert.equal(result.status, "ok")
  assert.equal(result.value.current.knownSubtotal, 2400)
  assert.equal(result.value.current.total, null)
  assert.equal(result.value.current.costCoverage.coverageState, "pending")
  assert.deepEqual(result.value.historical, choice.result)
  assert.equal(result.value.current.sourceRefs.some((ref) => ref.refDigest === sources[1].refDigest), true)
  await section.getByRole("heading", { name: "Revisar resultado vigente", exact: true }).waitFor({ timeout: 30_000 })
  assert(await section.getByRole("button", { name: "Promover resultado vigente", exact: true }).isDisabled())
  const kept = state()
  const entry = readCurrentChoiceBinding(kept, result.value.promotion)
  assert(entry && entry.producerResultRef !== result.value.promotion.resultRef)
  const production = kept.decisionResults[entry.producerResultRef]
  assert.equal(production.resultDigest, entry.producerResultDigest)
  assert.equal(digestSfValue(production.result), production.resultDigest)
  const currentCase = kept.cases[caseRef.id]
  assert.equal(currentCase.version, caseRef.version)
  assert.deepEqual(currentCase.choices, [choice])
  assert.deepEqual(currentCase.ledger.map((event) => event.kind), ["choice-recorded"])
  assert.deepEqual(currentCase.preparedChanges, [])
  assert.deepEqual(currentCase.receipts, [])
  assert.equal((await tab.reload({ waitUntil: "domcontentloaded", timeout: 120_000 })).status(), 200)
  await button.waitFor({ state: "visible", timeout: 30_000 })
  assert(await button.isEnabled())
  const commandKey = await resultResponse.request().headerValue("idempotency-key")
  assert(commandKey)
  const record = digestSfValue(snapshotRows())
  const replay = await ok(await postRaw("current-choice-prepare", prepare, { key: commandKey, timeout: 320_000 }), "same-key C17 replay")
  assert.equal(replay.value.bindingDigest, result.value.bindingDigest)
  assert.equal(digestSfValue(snapshotRows()), record, "replay duplicated or changed the persisted calculation")
  const different = await postRaw("current-choice-prepare", {
    ...prepare, coverageRef: prepare.coverageRef + "-different",
  }, { key: commandKey, timeout: 120_000 })
  assert.equal(different.status, 409, "same key with changed input")
  assert.deepEqual(await different.json(), { status: "conflict", reason: "choice-preview-idempotency-changed" })
  assert.equal(digestSfValue(snapshotRows()), record, "conflicting replay wrote state")
  process.stdout.write("C17_TEAM_PREPARE_REPLAY_OK\n")
  const otherSession = await signIn("other")
  const otherContext = new URLSearchParams({
    contractRevision: binding.contractRevision, installationId: binding.installationId, tenantId: binding.tenantId,
    hostId: binding.hostId, kind: "team", teamObjectId: otherTeam,
  })
  const otherAdmission = await request(binding.mount + "/api/ui/context?" + otherContext, {
    cookie: otherSession, accept: "application/json",
  })
  assert.equal((await ok(otherAdmission, "Team B is independently admitted")).value.profile.teams.selected.teamObjectId, otherTeam)
  const transient = await signIn("allowed")
  const retired = await request(binding.mount + "/auth/logout", {
    method: "POST", cookie: transient, originHeader: true, accept: "application/json",
  })
  assert.equal(retired.status, 204, "real installed logout")
  for (const test of [
    { cookie: denied, name: "no Team" },
    { dashboard: binding.mount + "/teams/" + otherTeam + "/dashboard", name: "different Team" },
    { cookie: transient, name: "revoked session" },
  ]) {
    const refused = await postRaw("current-choice-prepare", prepare, { ...test, key: commandKey })
    assert.equal(refused.status, 403, test.name)
    assert.equal(await refused.text(), "", test.name + " returns no protected data")
    assert.equal(digestSfValue(snapshotRows()), record, test.name + " changed durable state")
  }
  assert.equal(await access(join(base, other)).then(() => true, () => false), false, "denied cross-Team call opened another store")
  const receipt = {
    caseName: c17Case, status: "pass", syntheticEntra: true, partition, caseDigest: digestSfValue(caseRef),
    resultDigest: production.resultDigest, bindingDigest: result.value.bindingDigest,
    beforeAtlas: 503, prepared: 200, reload: 200, replay: 200, noTeam: 403, crossTeam: 403, revoked: 403, promotion: false,
  }
  await writeFile(process.env.SF_C17_RECEIPT, JSON.stringify(receipt) + "\n", { flag: "wx", mode: 0o600 })
  process.stdout.write("C17_TEAM_PACKAGE_OK " + c17Case + "\n")
}
