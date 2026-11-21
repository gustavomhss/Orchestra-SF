import { Database } from "bun:sqlite"
import { randomUUID } from "node:crypto"
import { constants } from "node:fs"
import { lstat, open, realpath } from "node:fs/promises"
import { userInfo } from "node:os"
import path from "node:path"
import { Global } from "@orchestra/core/global"
import { AppProcess } from "@orchestra/core/process"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { AbsolutePath } from "@orchestra/core/schema"
import { SfInstallationList } from "@orchestra/schema/sucafina/context"
import { ServerAuth } from "@orchestra/server/auth"
import { Effect, Schema } from "effect"
import { createSfBusinessServices } from "../../../../../apps/cli/src/sucafina-product/business-services.ts"
import { sfUiCommandIdentity } from "../../../../../apps/cli/src/sucafina-product/command-identity.ts"
import { sfNativeLocationRef } from "../../../../../apps/cli/src/sucafina-product/native-identity.ts"
import atlasPackage from "../../../../../modules/atlas/boundary/package.json" with { type: "json" }
import { createResidentAiBundle } from "../../../../../modules/sucafina/Sucafinav1/product/ai/resident.ts"
import { digestSfEvidenceRef, digestSfValue, sfEvidenceSourceMaps } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import freeze from "../../../../../modules/sucafina/Sucafinav1/product/contracts/freeze-v1.json" with { type: "json" }
import type { SfProductState } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/state.ts"
import type { CurrentChoicePromotion } from "../../../../../modules/sucafina/Sucafinav1/product/decisions/current-choice-promotion.ts"
import { readCurrentChoiceBinding } from "../../../../../modules/sucafina/Sucafinav1/product/decisions/current-choice-preview.ts"
import { probeSfAtlasScanner } from "../../../../../modules/sucafina/Sucafinav1/product/host-binding/atlas-scanner.ts"
import { sfHumanActions } from "../../../../../modules/sucafina/Sucafinav1/product/integration/human-authority.ts"
import { createSfProductAuthority } from "../../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import { enumerateSfSources } from "../../../../../modules/sucafina/Sucafinav1/product/integration/source-inventory.ts"
import { createSfSourcePersistence } from "../../../../../modules/sucafina/Sucafinav1/product/integration/source-lifecycle.ts"
import { createSfSourceScopeProjector } from "../../../../../modules/sucafina/Sucafinav1/product/integration/source-projections.ts"
import { object } from "../../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import { loadLocalConfiguration } from "../../../../../modules/sucafina/Sucafinav1/runtime/local-configuration.ts"
import { decodeSnapshot, openLocalStore } from "../../../../../modules/sucafina/Sucafinav1/runtime/local-store.ts"
import { createOperatorIdentity } from "../../../../../modules/sucafina/Sucafinav1/runtime/operator-identity.ts"

// The launcher restricts Bun setup entries to this directory. Only raw Planner
// inputs are seeded. Installed browser APIs create every decision record, and
// archive-choice drains the real pending ledger event through the Atlas writer.
const [operation, file, argument, requestedDigest] = process.argv.slice(2)
if (!file || (operation !== "seed" && operation !== "archive-choice" && operation !== "observe" && operation !== "observe-prepare"))
  throw new Error("Unexpected C17 fixture operation")
const loaded = await loadLocalConfiguration(file)
if (loaded.config.authentication !== "local-operator") throw new Error("Expected the isolated local-operator installation")
if (operation === "observe-prepare") {
  const { caseRef, digest } = caseAndDigest()
  process.stdout.write(JSON.stringify(await observePrepare(loaded, caseRef, digest)))
} else {
  await runBusinessSetup()
}

function caseAndDigest() {
  if (!argument || !requestedDigest || !/^[a-f0-9]{64}$/.test(requestedDigest))
    throw new Error("Expected the browser case reference and evidence or command digest")
  const ref = object(JSON.parse(argument))
  if (typeof ref.id !== "string" || !ref.id || typeof ref.incarnation !== "string" || !ref.incarnation ||
      typeof ref.version !== "number" || !Number.isSafeInteger(ref.version) || ref.version < 1)
    throw new Error("Invalid browser case reference")
  return { caseRef: { id: ref.id, incarnation: ref.incarnation, version: ref.version }, digest: requestedDigest }
}

async function runBusinessSetup() {
  const store = await openLocalStore(path.join(loaded.directory, "business-local"))
  try {
    if (operation === "seed") {
      await store.transaction("planner", async (snapshot) => {
        if (Object.keys(snapshot.data).length || Object.keys(snapshot.versions).length || snapshot.audit.length || snapshot.sfSources)
          throw new Error("The C17 fixture only seeds an empty Planner")
        const versions = [{ id: "c17-baseline", amount: 100 }, { id: "c17-candidate", amount: 200 }].map((source) => ({
          id: source.id, name: source.id, year: 2027, closed: 1,
          lines: [{ id: "service", name: "Annual service", ownerId: "owner", sec: "opex", el: "licenses", cur: "USD",
            b: Array(12).fill(source.amount), a: [source.amount, ...Array(11).fill(null)], f: [null, ...Array(11).fill(source.amount)] }],
          fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {},
        }))
        snapshot.data = { versions, officials: { "2027": "c17-baseline" }, entities: [], allocations: [], roster: [] }
        return { commit: true, value: undefined }
      })
    } else if (operation === "archive-choice") {
      const { caseRef, digest } = caseAndDigest()
      const result = await archiveChoice(loaded, store, caseRef, digest)
      process.stdout.write(JSON.stringify(result))
    } else {
      if (!argument) throw new Error("Expected a browser-emitted CurrentChoice promotion binding")
      const promotion = JSON.parse(argument) as CurrentChoicePromotion
      const observed = await store.transaction("dashboard", async (snapshot) => {
        const state = snapshot.data.__sfProductV1 as SfProductState
        const binding = readCurrentChoiceBinding(state, promotion)
        if (!binding) throw new Error("The installed server did not persist the exact preview binding")
        const result = state.decisionResults?.[binding.producerResultRef]
        const decision = state.cases[promotion.caseRef.id]
        const request = object(state.preferences[`sf:proposal-coverage:scenario-request:${digestSfValue(binding.producerResultRef)}`])
        const choice = decision?.choices.find((entry) => entry.id === promotion.choiceId)
        if (result?.kind !== "scenario" || !decision || !choice || result.resultDigest !== binding.producerResultDigest ||
            digestSfValue(result.result) !== result.resultDigest || request.schema !== "sf-scenario-request-v1" ||
            request.resultRef !== result.resultRef || request.resultDigest !== result.resultDigest ||
            request.requestDigest !== result.requestDigest || digestSfValue(request.request) !== result.requestDigest ||
            digestSfValue(request.request) !== digestSfValue(promotion.scenario) ||
            digestSfValue(request.caseRef) !== digestSfValue(promotion.caseRef) ||
            digestSfValue(result.caseRef) !== digestSfValue(promotion.caseRef) ||
            digestSfValue(choice) !== promotion.choiceDigest)
          throw new Error("Canonical Planner result, request binding or preserved choice was missing or changed")
        return { commit: false, value: {
          producerResultRef: result.resultRef, engineVersion: request.engineVersion,
          caseVersion: decision.version, choices: decision.choices.length,
          ledgerKinds: decision.ledger.map((event) => event.kind), preparedChanges: decision.preparedChanges.length,
          receipts: decision.receipts.length,
        } }
      })
      process.stdout.write(JSON.stringify(observed))
    }
  } finally { await store.dispose() }
}

async function observePrepare(loaded: Awaited<ReturnType<typeof loadLocalConfiguration>>,
  caseRef: CurrentChoicePromotion["caseRef"], command: string) {
  const operator = loaded.config.localOperator
  if (!operator) throw new Error("The prepare observation requires the isolated local operator")
  const principalRef = `macos:${operator.installationId}:${operator.uid}`
  const uid = process.getuid?.()
  const directory = path.join(loaded.directory, "business-local")
  const databasePath = path.join(directory, "installation.sqlite")
  if (uid === undefined || process.env.SUCAFINA_LOCAL_CONFIG !== file ||
      process.env.XDG_STATE_HOME !== path.join(loaded.directory, "host-state"))
    throw new Error("Prepare observation is restricted to the private Reports launcher")
  const [sandbox, business, databaseFile, resolved] = await Promise.all([
    lstat(loaded.directory), lstat(directory), lstat(databasePath), realpath(databasePath),
  ])
  if (!sandbox.isDirectory() || !business.isDirectory() || !databaseFile.isFile() || resolved !== databasePath ||
      [sandbox, business, databaseFile].some((entry) => entry.uid !== uid || (entry.mode & 0o077) !== 0))
    throw new Error("Prepare observation requires the private installed SQLite file")
  // Use a WAL reader directly. The LocalStore transaction path would wait for
  // the browser's writer, preventing an observation before the test ends.
  const database = new Database(databasePath, { readonly: true, strict: true })
  try {
    database.exec("PRAGMA busy_timeout=0; PRAGMA query_only=ON")
    const row = database.query<{ payload: string }, []>("SELECT payload FROM snapshots WHERE surface = 'dashboard'").get()
    if (!row) return { observation: "dashboard-snapshot-unavailable" }
    let snapshot: ReturnType<typeof decodeSnapshot>
    try {
      snapshot = decodeSnapshot(row.payload)
    } catch {
      return { observation: "dashboard-snapshot-undecodable" }
    }
    const state = snapshot.data.__sfProductV1 as SfProductState | undefined
    const decision = state?.cases[caseRef.id]
    if (!state || decision?.incarnation !== caseRef.incarnation || decision.version !== caseRef.version)
      return { observation: "case-version-changed" }
    const stages = [
      ["producer", "cases", `decision-result:${command}`],
      ["scenarioRequest", "preferences", `scenario-request:${command}`],
      ["coverage", "preferences", `proposal-coverage:${command}`],
      ["previewResult", "cases", `decision-result:choice-preview:${command}`],
      ["previewBinding", "preferences", `choice-preview-binding:${command}`],
    ] as const
    const receipts = Object.fromEntries(stages.map(([stage, namespace, key]) => {
      const receipt = state.transactions[JSON.stringify([principalRef, namespace, caseRef.id, key])]
      const committed = receipt?.targetIncarnation === caseRef.incarnation && receipt.targetRef === caseRef.id &&
        receipt.namespace === namespace && receipt.principalRef === principalRef
      return [stage, committed
        ? { committed: true, storageVersion: receipt.storageVersion, aggregateRevision: receipt.aggregateRevision }
        : { committed: false }]
    }))
    return {
      observation: Object.values(receipts).some((receipt) => receipt.committed)
        ? "durable-prepare-receipts-found" : "no-durable-prepare-receipt-for-this-command",
      receipts,
    }
  } finally { database.close() }
}

async function archiveChoice(loaded: Awaited<ReturnType<typeof loadLocalConfiguration>>,
  store: Awaited<ReturnType<typeof openLocalStore>>, caseRef: CurrentChoicePromotion["caseRef"], plannerDigest: string) {
  const config = loaded.config
  if (!config.localOperator || config.authentication !== "local-operator")
    throw new Error("The Atlas fixture requires the isolated local operator")
  const operator = { ...config.localOperator, name: config.localOperator.name ?? userInfo().username }
  const principalRef = `macos:${operator.installationId}:${operator.uid}`
  const policyVersion = "sf-product-v1"
  const identity = createOperatorIdentity({ origin: config.origin, mount: config.mount, operator,
    secrets: store.secrets, key: loaded.keys.session })
  const login = new URL(`${config.mount}/auth/local`, config.origin)
  login.searchParams.set("code", await identity.enroll())
  const signedIn = await identity.handle(new Request(login))
  const cookie = signedIn?.headers.get("set-cookie")?.split(";", 1)[0]
  if (signedIn?.status !== 303 || !cookie) throw new Error("Private Atlas operator enrollment failed")
  try {
    const discovery = new URL("/api/sucafina/installations", config.origin)
    discovery.search = new URLSearchParams({ select: "location", "location[directory]": loaded.directory }).toString()
    const discovered = await fetch(discovery, { headers: await discoveryHeaders(loaded.directory), redirect: "error" })
    if (!discovered.ok) throw new Error(`Installed C17 discovery failed (${discovered.status})`)
    const descriptors = Schema.decodeUnknownSync(SfInstallationList)(await discovered.json()).installations
    const installed = descriptors.length === 1 ? descriptors[0] : undefined
    if (!installed || installed.installationId !== operator.installationId || installed.mount !== config.mount ||
        installed.publicOrigin !== config.origin || installed.authMode !== "local-operator")
      throw new Error("C17 discovery returned a different installation")
    const request = new Request(new URL(`${config.mount}/dashboard`, config.origin), { headers: { cookie } })
    if ((await identity.person(request))?.id !== principalRef) throw new Error("Private Atlas operator identity changed")

    const persistence = createSfSourcePersistence({ persistence: store, enumerate: enumerateSfSources,
      projectScope: createSfSourceScopeProjector(() => new Date().toISOString()), createId: randomUUID })
    const proposalCoverageWrites = new WeakSet<object>()
    const authority = createSfProductAuthority({
      identity: () => ({ installationId: installed.installationId, projectId: installed.projectId, hostId: installed.hostId,
        location: sfNativeLocationRef({ directory: AbsolutePath.make(loaded.directory) }) }),
      installationId: installed.installationId, origin: config.origin, policyVersion, persistence, proposalCoverageWrites,
      authenticate: identity.authenticate, isAuthenticated: async (req) => Boolean(await identity.person(req)),
      environment: async (req) => ({ at: new Date().toISOString(), id: randomUUID, directory: await identity.directory(req),
        bankKey: loaded.keys.bank }),
      grants: [{
        principalRef,
        namespaces: ["preferences", "reviews", "relations", "threads", "confirmations", "cases", "contributions",
          "documents", "receipts", "atlas", "outbox", "bi-artifacts"],
        operations: freeze.operations.map((operation) => operation.operation),
        humanActions: sfHumanActions,
      }],
      createId: randomUUID, now: Date.now,
      commandIdentity: async (req, operation) => sfUiCommandIdentity(req, operation, {
        origin: config.origin, mount: config.mount, readOperations: new Map(), createId: randomUUID,
      }),
      inspectSession: async () => undefined, verifySelection: async () => false, verifySkillReceipt: async () => false,
      providerGeneration: async () => undefined, authorizeDocument: async () => undefined,
    })
    const business = createSfBusinessServices({ authority, persistence, proposalCoverageWrites })
    try {
      const pending = await authority.state.read(request, "outbox", (state, actor) => {
        const decision = state.cases[caseRef.id]
        const choice = decision?.choices[0]
        const event = decision?.ledger.find((entry) => entry.kind === "choice-recorded")
        if (!decision || decision.incarnation !== caseRef.incarnation || decision.version !== caseRef.version ||
            decision.choices.length !== 1 || !choice || !event || event.caseRef.version !== caseRef.version ||
            event.outputDigest !== digestSfValue(choice) || event.principalRef !== principalRef ||
            !event.evidenceRefs.some((ref) => ref.kind === "record" && ref.refDigest === plannerDigest &&
              ref.refId === choice.scenario.baseRef && ref.target.surface === "planner" && ref.target.recordType === "planner-version"))
          return undefined
        const key = JSON.stringify([decision.id, decision.incarnation, event.id])
        const item = state.outbox[key]
        if (item?.state !== "pending" || item.writerPrincipalRef !== principalRef || actor.principalRef !== principalRef ||
            item.accessRevision !== actor.accessRevision || item.eventRef.installationId !== installed.installationId ||
            item.eventRef.projectId !== installed.projectId || item.eventRef.target.eventId !== event.id ||
            item.eventRef.target.caseId !== caseRef.id || item.eventRef.target.caseIncarnation !== caseRef.incarnation ||
            item.eventRef.target.caseVersion !== caseRef.version || item.eventRef.target.outputDigest !== event.outputDigest ||
            digestSfValue(item.eventRef.target.evidenceRefs) !== digestSfValue(event.evidenceRefs) ||
            !Object.hasOwn(sfEvidenceSourceMaps([item.eventRef]).sourceVersions, plannerDigest)) return undefined
        return { key, item }
      })
      if (pending.status !== "ok" || !pending.value) throw new Error("The browser choice did not produce the expected pending Atlas event")
      const sourceRoot = path.resolve(import.meta.dirname, "../../../../../modules/sucafina/Sucafinav1/product/ai")
      const scanner = await Effect.runPromise(AppProcess.Service.use((process) =>
        Effect.promise(() => probeSfAtlasScanner(process))).pipe(Effect.provide(LayerNode.compile(AppProcess.node))))
      if (!scanner) throw new Error("The pinned Atlas scanner is unavailable")
      const bundle = await createResidentAiBundle({ root: sourceRoot, manifestPath: path.join(sourceRoot, "manifests/resident.json") })
      business.initializeAtlas(scanner, { boundaryVersion: atlasPackage.version, schemaVersion: freeze.canonicalSha256,
        manifestVersion: bundle.manifestDigest,
        skillVersion: digestSfValue(bundle.skills.map((skill) => ({ id: skill.id, version: skill.version, sourceDigest: skill.sourceDigest }))) })

      const { key, item } = pending.value
      const digest = digestSfValue(item.eventRef)
      const admitted = await authority.ui.admit(request, "sf_evidence_get", digest)
      if (admitted.status !== "ok") throw new Error("Authorization for the pending C17 event is unavailable")
      const call = admitted.value
      try {
        if (call.binding.principalRef !== item.writerPrincipalRef || call.binding.accessRevision !== item.accessRevision ||
            !await authority.ui.validate(call, "sf_evidence_get", digest))
          throw new Error("Authorization for the pending C17 event changed")
        const receipt = await business.context.emitFromLedger(item.eventRef, call)
        if (receipt.status !== "committed" || receipt.sourceEventId !== item.eventRef.target.eventId ||
            receipt.scanner.status !== "clean" || !receipt.eventId)
          throw new Error(`Atlas did not commit the browser choice with a clean scan (${receipt.status}, ${receipt.reason ?? "no reason"})`)
        const eventId = receipt.eventId
        const archived = await authority.state.read(request, "atlas", (state, actor) => {
          const outbox = state.outbox[key]
          if (outbox?.state !== "settled" || digestSfValue(outbox.receipt) !== digestSfValue(receipt) ||
              actor.principalRef !== item.writerPrincipalRef || actor.accessRevision !== item.accessRevision) return false
          return Object.values(state.atlas).filter((value) => {
            const partition = object(value)
            const capture = object(object(partition.originals)[plannerDigest])
            const ref = capture.ref as Parameters<typeof digestSfEvidenceRef>[0]
            return ref?.kind === "record" && ref.refDigest === plannerDigest && digestSfEvidenceRef(ref) === plannerDigest &&
              object(object(partition.captureDigests)[eventId])[plannerDigest] === digestSfValue(capture)
          }).length === 1
        })
        if (archived.status !== "ok" || !archived.value) throw new Error("The committed Atlas event did not retain the expected Planner capture")
        return { eventId, plannerDigest, scanner: receipt.scanner.status }
      } finally { authority.ui.finish(call) }
    } finally { business.dispose() }
  } finally {
    // Revoke only the independently enrolled fixture session.
    const logout = await identity.handle(new Request(new URL(`${config.mount}/auth/logout`, config.origin), {
      method: "POST", headers: { origin: config.origin, cookie },
    }))
    if (logout?.status !== 204) throw new Error("Private Atlas operator logout failed")
  }
}

async function discoveryHeaders(directory: string) {
  // The Reports launcher isolates XDG_STATE_HOME, and the serving Daemon writes
  // its generated Basic credential under Global.Path.state with mode 0600.
  const stateDirectory = path.join(directory, "host-state")
  const daemonDirectory = Global.Path.state
  if (process.env.XDG_STATE_HOME !== stateDirectory || daemonDirectory !== path.join(stateDirectory, "orchestra") ||
      await realpath(daemonDirectory) !== daemonDirectory)
    throw new Error("C17 Core credential must belong to the private Reports launcher")
  const file = await open(path.join(daemonDirectory, "password"), constants.O_RDONLY | constants.O_NOFOLLOW)
  try {
    const stat = await file.stat()
    if (!stat.isFile() || (stat.mode & 0o077) !== 0 || stat.size !== 43)
      throw new Error("C17 Core credential was not a private generated password")
    const password = await file.readFile("utf8")
    if (!/^[A-Za-z0-9_-]{43}$/.test(password))
      throw new Error("C17 Core credential was not a generated password")
    return ServerAuth.headers({ password, username: "orchestra" })
  } finally { await file.close() }
}
