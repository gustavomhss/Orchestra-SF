import { createSfTeamContractMcp, createSfTeamPurchaseMcp, createSfTeamSupplierMcp } from "../../../../apps/cli/src/sucafina-product/team-purchase-mcp.ts"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { AppProcess } from "@orchestra/core/process"
import { expectSpawn } from "@orchestra/core/test/fixture/omni-expect"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import { expect, test } from "bun:test"
import { Database } from "bun:sqlite"
import { Effect, Schema } from "effect"
import { ChildProcess } from "effect/unstable/process"
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { exportJWK, generateKeyPair, SignJWT } from "jose"
import { createMicrosoftInstallation } from "../local/microsoft-entry.ts"
import { digestSfValue } from "../product/contracts/canonical.ts"
import { inspectSfProductRestoreFrontier } from "../product/host-binding/state-provider.ts"
import { openCorporateRecoveryRegister } from "../runtime/corporate-recovery-register.ts"
import { createLocalBackups } from "../runtime/local-backups.ts"
import { prepareLocalConfiguration } from "../runtime/local-configuration.ts"
import type { LocalConfiguration } from "../runtime/local-configuration.ts"
import { initialProcurementSettings } from "../src/initial-settings.ts"
import { changed, object, rows } from "../runtime/contract.ts"
import { teamProfileInstallationId } from "../runtime/team-profile-access.ts"
import { openLocalStore } from "../runtime/local-store.ts"
import { bindMicrosoftInstallation } from "../runtime/microsoft-configuration.ts"
import { prepareMicrosoftInstallation } from "../runtime/microsoft-installation.ts"

const listenerOrigin = "http://127.0.0.1:4110"
const ingressOrigin = "http://sf-ingress.example.test:4110"
const origin = "https://sf.example.test"
const mount = "/sucafina"
const tenantId = "11111111-1111-4111-8111-111111111111"
const clientId = "22222222-2222-4222-8222-222222222222"
const oid = "33333333-3333-4333-8333-333333333333"
const grantPrincipal = "a3333333-3333-4333-8333-333333333333"
const teamObjectId = "44444444-4444-4444-8444-444444444444"
const secondTeamId = "55555555-5555-4555-8555-555555555555"
const disabledTeamId = "66666666-6666-4666-8666-666666666666"
const authority = "https://login.microsoftonline.com/" + tenantId
const graph = "https://graph.microsoft.com/v1.0"
const secret = "synthetic-private-installation-secret"
const ingressProof = "a".repeat(64)
const accessToken = "synthetic-private-installation-access"
const epoch = 1794398400

async function fixture(
  teams: "direct" | undefined,
  fetch: (request: Request) => Promise<Response>,
  enabledTeamIds?: unknown,
  groups: LocalConfiguration["groups"] = { dashboard: {}, planner: {}, procurement: {} },
  teamDirectory?: "members",
  options: { nativeDecisions?: boolean; nativeRecovery?: boolean; nativeWeb?: boolean; purchasePrincipals?: readonly string[]; supplierReview?: boolean; contractReview?: boolean } = {},
) {
  const root = await mkdtemp(join(await realpath(tmpdir()), "sf-microsoft-installation-"))
  const directory = join(root, "installation")
  const workspaceDirectory = join(root, "workspace")
  const register = join(root, "witness.sqlite")
  try {
    const file = await prepareLocalConfiguration(directory)
    await mkdir(workspaceDirectory, { mode: 0o700 })
    const grants = options.nativeDecisions
      ? [{ principalRef: oid, namespaces: ["cases"], operations: ["sf_case_draft"], ...(options.nativeRecovery ? { migrationActions: ["recover"] } : {}) }]
      : options.purchasePrincipals?.map((principalRef) => ({ principalRef, operations: [
        "sf_request_read", "sf_sourcing_compare", ...(options.supplierReview ? ["sf_supplier_read"] : []),
        ...(options.contractReview ? ["sf_contract_read"] : []),
      ] })) ??
        [{ principalRef: grantPrincipal, operations: ["sf_case_read"] }]
    await writeFile(file, JSON.stringify({
      version: 1, deployment: "azure-https", authentication: "microsoft",
      origin, listenerOrigin, ingressOrigin, mount, tenantId, clientId, workspaceDirectory,
      groups,
      grants: grants.map((grant) => ({ ...grant, principalRef: grant.principalRef.toUpperCase() })),
      supremeAdminGroupId: grantPrincipal.toUpperCase(), scanner: null,
      ...(teams ? { teams } : {}),
      ...(options.purchasePrincipals ? { clawPurchasePeriod: { start: "2026-01-01", end: "2026-12-31" } } : {}),
      ...(options.supplierReview ? { clawSupplierReview: true } : {}),
      ...(options.contractReview ? { clawContractReview: true } : {}),
      teamDirectory,
      enabledTeamIds,
    }))
    await writeFile(join(directory, "client-secret.txt"), secret, { mode: 0o600 })
    await writeFile(join(directory, "ingress-secret.txt"), ingressProof, { mode: 0o600 })
    if (options.nativeRecovery) {
      const database = new Database(register)
      try {
        database.exec(`CREATE TABLE recovery_pins (
          installation_digest TEXT, partition_digest TEXT, generation INTEGER, checkpoint_digest TEXT,
          frontier_digest TEXT, archive_digest TEXT, PRIMARY KEY (installation_digest, partition_digest, generation)
        ) STRICT`)
      } finally { database.close() }
    }
    const environment = {
      ORCHESTRA_DB: join(directory, "host-data", "orchestra.db"),
      ORCHESTRA_INHERIT_CREDENTIALS: "0",
      ORCHESTRA_CONFIG_DIR: join(directory, "host-config"),
      ORCHESTRA_CREDENTIAL_KEY_FILE: join(directory, "host-credential.key"),
      TMPDIR: join(directory, "host-tmp"),
      XDG_DATA_HOME: join(directory, "host-data"),
      XDG_CONFIG_HOME: join(directory, "host-config"),
      XDG_CACHE_HOME: join(directory, "host-cache"),
      XDG_STATE_HOME: join(directory, "host-state"),
      ...(options.nativeDecisions ? { SUCAFINA_NATIVE_TEAM_DECISIONS: "1" } : {}),
      ...(options.nativeWeb ? { SUCAFINA_NATIVE_TEAM_WEB: "1" } : {}),
      ...(options.nativeRecovery ? { SUCAFINA_CORPORATE_RECOVERY_REGISTER: register } : {}),
    }
    const prepare = () => prepareMicrosoftInstallation({ origin: listenerOrigin }, file, environment,
      { fetch, now: () => new Date(epoch * 1000) })
    const [prepared, concurrent] = await Promise.all([prepare(), prepare()])
    expect(concurrent.loaded.config).toEqual(prepared.loaded.config)
    expect(prepared.loaded.config.grants).toEqual(grants)
    expect(Object.isFrozen(prepared.loaded.config.grants[0]?.operations)).toBe(true)
    expect(prepared.loaded.config.supremeAdminGroupId).toBe(grantPrincipal)
    await expect(bindMicrosoftInstallation(directory, { ...prepared.loaded.config, tenantId: oid })).rejects
      .toThrow("Microsoft installation identity cannot change")
    const open = () => createMicrosoftInstallation({ origin: listenerOrigin,
      ...(options.purchasePrincipals ? { loadTeamPurchaseMcp: async () => createSfTeamPurchaseMcp } : {}),
      ...(options.supplierReview ? { loadTeamSupplierMcp: async () => createSfTeamSupplierMcp } : {}),
      ...(options.contractReview ? { loadTeamContractMcp: async () => createSfTeamContractMcp } : {}),
    }, file, environment, {
      fetch, now: () => new Date(epoch * 1000),
      openRecoveryRegister: (file, directory) => openCorporateRecoveryRegister(file, directory, process.getuid?.()),
    })
    const state = { installation: await open() }
    return {
      get installation() { return state.installation },
      directory, register,
      prepare,
      async reopen() {
        await state.installation.dispose()
        state.installation = await open()
      },
      async close() {
        try { await state.installation.dispose() }
        finally { await rm(root, { recursive: true, force: true }) }
      },
    }
  } catch (error) {
    await rm(root, { recursive: true, force: true })
    throw error
  }
}

const discovery = () => Response.json({
  issuer: authority + "/v2.0",
  authorization_endpoint: authority + "/oauth2/v2.0/authorize",
  token_endpoint: authority + "/oauth2/v2.0/token",
  jwks_uri: authority + "/discovery/v2.0/keys",
})
const ingress = (relative: string, headers?: Record<string, string>, init?: Pick<RequestInit, "method" | "body">) => new Request(ingressOrigin + mount + relative, {
  ...init,
  headers: { host: new URL(ingressOrigin).host, ...headers },
})

test("Installed purchase MCP and supplier review preserve A/B Team scopes alongside contract review", async () => {
  const keys = await generateKeyPair("RS256", { extractable: true })
  const jwk = await exportJWK(keys.publicKey)
  const nonces = new Map<string, string>()
  const principals = [oid, grantPrincipal]
  const ungranted = "77777777-7777-4777-8777-777777777777"
  const membership: { revokeOnRoleCheck: boolean; teamRemoved: boolean; onRoleCheck?: () => Promise<void> } =
    { revokeOnRoleCheck: false, teamRemoved: false }
  const teams = [teamObjectId, secondTeamId].map((id) => ({ id, tenantId, displayName: id, isArchived: false }))
  const fetch = async (request: Request) => {
    const url = new URL(request.url)
    if (url.href === authority + "/v2.0/.well-known/openid-configuration") return discovery()
    if (url.href === authority + "/discovery/v2.0/keys") return Response.json({ keys: [{ ...jwk, kid: "installation-test" }] })
    if (url.href === authority + "/oauth2/v2.0/token") {
      const code = new URLSearchParams(await request.text()).get("code") ?? ""
      const nonce = nonces.get(code)
      if (!nonce) throw new Error("Unexpected test authorization code")
      const idToken = await new SignJWT({ tid: tenantId, oid: code, nonce })
        .setSubject(code).setIssuer(authority + "/v2.0").setAudience(clientId)
        .setIssuedAt(epoch).setExpirationTime(epoch + 3600)
        .setProtectedHeader({ alg: "RS256", kid: "installation-test" }).sign(keys.privateKey)
      return Response.json({ access_token: "synthetic-" + code, id_token: idToken,
        token_type: "Bearer", expires_in: 3600, scope: "User.Read Team.ReadBasic.All" })
    }
    if (url.origin === "https://graph.microsoft.com") {
      const principal = [...principals, ungranted].find((id) => request.headers.get("authorization") === "Bearer synthetic-" + id)
      if (!principal) throw new Error("Unexpected test Microsoft session")
      if (url.pathname === "/v1.0/me") return Response.json({ id: principal, displayName: "Test purchaser" })
      if (url.href === graph + "/me/checkMemberGroups") {
        await membership.onRoleCheck?.()
        if (principal === oid && membership.revokeOnRoleCheck) membership.teamRemoved = true
        return Response.json({ value: [grantPrincipal] })
      }
      if (url.href === graph + "/me/joinedTeams")
        return Response.json({ value: principal === oid && membership.teamRemoved ? teams.slice(1) : teams })
    }
    throw new Error("Unexpected synthetic Microsoft request")
  }
  const f = await fixture("direct", fetch, [teamObjectId, secondTeamId], {
    dashboard: { viewer: "group:" + grantPrincipal }, planner: {}, procurement: { requester: "group:" + grantPrincipal, buyer: "group:" + grantPrincipal },
  }, undefined, { purchasePrincipals: principals, supplierReview: true, contractReview: true })
  try {
    const signIn = async (principal: string) => {
      const begin = await f.installation.handler(ingress("/auth/login"))
      expect(begin?.status).toBe(303)
      const login = new URL(begin!.headers.get("location")!)
      nonces.set(principal, login.searchParams.get("nonce")!)
      const finish = await f.installation.handler(ingress("/auth/callback?" + new URLSearchParams({
        code: principal, state: login.searchParams.get("state")!,
      }), { cookie: begin!.headers.getSetCookie().find((item) => item.includes("_login="))!.split(";")[0]! }))
      expect(finish?.status).toBe(303)
      return finish!.headers.getSetCookie().find((item) => item.includes("_session="))!.split(";")[0]!
    }
    const installationId = teamProfileInstallationId({ origin, mount, directory: f.directory })
    const select = (id: string) => JSON.stringify({ contractRevision: "sf-team-profile/1",
      kind: "team", profile: { installationId, tenantId, teamObjectId: id } })
    const vendorPath = "/api/claw/vendor-review"
    const contractPath = "/api/claw/contract-review"
    const paths = { purchases: "/api/claw", "vendor-review": vendorPath, "contract-review": contractPath }
    const ungrantedCookie = await signIn(ungranted)
    for (const purpose of ["vendor-review", "contract-review"] as const) {
      expect((await f.installation.handler(ingress(paths[purpose] + "/connect", {
        cookie: ungrantedCookie, origin, "x-sf-claw-purpose": purpose, "x-sf-team-profile": select(teamObjectId),
      }, { method: "POST" })))?.status).toBe(403)
    }
    const pair = async (cookie: string, id: string, purpose: keyof typeof paths = "purchases") => {
      const response = await f.installation.handler(ingress(paths[purpose] + "/connect", {
        cookie, origin, "x-sf-claw-purpose": purpose, "x-sf-team-profile": select(id),
      }, { method: "POST" }))
      expect(response?.status).toBe(200)
      return ((await response!.json()) as { token: string }).token
    }
    const cases = await Promise.all([
      [oid, teamObjectId, "PR-2026-0901", "A", "SUP-09001", "active", "CT-09001", "2027-06-30", "fixed"],
      [grantPrincipal, secondTeamId, "PR-2026-0902", "B", "SUP-09002", "pending", "CT-09002", "2027-12-31", "auto"],
    ].map(async ([principal, team, ref, label, number, status, contractNumber, end, renewType]) => {
      const cookie = await signIn(principal!)
      const partition = digestSfValue({ installationId, tenantId, teamObjectId: team })
      const storePath = join(f.directory, "business-teams", partition)
      const store = await openLocalStore(storePath)
      try {
        await store.transaction("dashboard", async (snapshot) => {
          snapshot.data.summaries = ["Vendor Contracts"]
          snapshot.data.contracts = [{
            id: "contract-" + label, num: contractNumber, ...(label === "A" ? { name: "Contrato Sintético A" } : {}),
            vendor: "Fornecedor Sintético " + label, end, renewType,
            amount: 100_000, notes: "private-fixture-note", documents: [{ id: "private-file", name: "private.pdf" }],
          }, ...(label === "A" ? [{ id: "contract-companion", num: "CT-09003", name: "Contrato Companheiro" }] : [])]
          return { commit: true, value: undefined }
        })
        await store.transaction("procurement", async (snapshot) => {
          const at = new Date(epoch * 1000).toISOString()
          const entry = { version: 1, request: {
            number: ref, createdBy: principal, buyerId: principal, createdAt: at, status: "sourcing", history: [],
            pr: { title: "Test purchase " + label, estAmount: 100, recurring: false, expenseType: "OPEX" },
            prApproval: null, po: null,
            sourcing: { selectedId: null, fxSnapshot: null, approval: null, contractStrategy: "new", quotes: [1, 2, 3].map((id) => ({
              id: label + id, supplier: "Supplier " + label + id, total: id * 100, qty: 1, unitPrice: id * 100,
              currency: "USD", techPass: true, scores: [5, 4, 3, 4, 5], cscores: [0, 4, 5],
            })) },
          } }
          snapshot.data.store = { settings: initialProcurementSettings(), requests: { [ref!]: entry }, suppliers: [{
            id: "supplier-" + label, number, status, legalName: "Fornecedor Sintético " + label,
            account: "synthetic-private-account", contacts: [{ email: "private@example.test" }],
          }] }
          changed(snapshot, "requests:" + ref, { id: "fixture", roles: [], canWrite: false }, at, undefined, entry)
          return { commit: true, value: undefined }
        })
      } finally { await store.dispose() }
      return { cookie, team: team!, ref: ref!, label, number, contractNumber, storePath, token: await pair(cookie, team!),
        vendorToken: await pair(cookie, team!, "vendor-review"), contractToken: await pair(cookie, team!, "contract-review") }
    }))
    const rpc = (token: string, method: string, params?: Record<string, unknown>, extra?: Record<string, string>, path = "/api/claw/mcp") =>
      f.installation.handler(ingress(path, {
        authorization: "Bearer " + token, "content-type": "application/json", accept: "application/json, text/event-stream", ...extra,
      }, { method: "POST", body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) }))
    const call = (token: string, requestRef: string, extra?: Record<string, string>) =>
      rpc(token, "tools/call", { name: "sf_comparar_compra", arguments: { requestRef } }, extra)
    const contractCall = (token: string, recordRef: string, name = "sf_read_contract_review") =>
      rpc(token, "tools/call", { name, arguments: { recordRef } }, undefined, contractPath + "/mcp")
    const contractDenied = { isError: true, content: [{ type: "text", text: '{"status":"denied"}' }] }
    for (const actor of cases) {
      const { result: supplierTools } = await (await rpc(actor.vendorToken, "tools/list", undefined, undefined, vendorPath + "/mcp"))!.json()
      expect(supplierTools.tools).toHaveLength(1)
      expect(supplierTools.tools[0]).toMatchObject({ name: "sf_read_vendor_review", annotations: { readOnlyHint: true } })
      expect((await rpc(actor.token, "tools/list", undefined, undefined, vendorPath + "/mcp"))?.status).toBe(403)
      expect((await rpc(actor.vendorToken, "tools/list"))?.status).toBe(403)
      const other = cases.find((item) => item !== actor)!
      const contractTools = await (await rpc(actor.contractToken, "tools/list", undefined, undefined, contractPath + "/mcp"))!.json()
      expect(contractTools.result.tools).toHaveLength(1)
      expect(contractTools.result.tools[0]).toMatchObject({ name: "sf_read_contract_review", annotations: { readOnlyHint: true } })
      expect((await contractCall(actor.token, actor.contractNumber!))?.status).toBe(403)
      expect((await contractCall(actor.vendorToken, actor.contractNumber!))?.status).toBe(403)
      expect((await rpc(actor.contractToken, "tools/list"))?.status).toBe(403)
      expect((await rpc(actor.contractToken, "tools/list", undefined, undefined, vendorPath + "/mcp"))?.status).toBe(403)
      for (const recordRef of [other.contractNumber!, "CT-09999"]) {
        const response = await contractCall(actor.contractToken, recordRef)
        expect(response?.status).toBe(200)
        expect((await response!.json()).result).toEqual(contractDenied)
      }
      const contractMutation = await contractCall(actor.contractToken, actor.contractNumber!, "sf_contract_renew")
      expect((await contractMutation!.json()).result).toEqual({ isError: true, content: [{ type: "text", text: '{"status":"invalid"}' }] })
      for (const recordRef of [other.number, "SUP-09999"]) {
        const response = await rpc(actor.vendorToken, "tools/call", { name: "sf_read_vendor_review", arguments: { recordRef } },
          undefined, vendorPath + "/mcp")
        expect(response?.status).toBe(200)
        expect((await response!.json()).result).toEqual({ isError: true, content: [{ type: "text", text: '{"status":"denied"}' }] })
      }
      const mutation = await rpc(actor.vendorToken, "tools/call", { name: "sf_supplier_block", arguments: { recordRef: actor.number } },
        undefined, vendorPath + "/mcp")
      expect((await mutation!.json()).result).toEqual({ isError: true, content: [{ type: "text", text: '{"status":"invalid"}' }] })
      const tools = await (await rpc(actor.token, "tools/list"))!.json()
      expect(tools.result.tools.map((tool: { name: string }) => tool.name)).toEqual(["sf_comparar_compra"])
      for (const target of cases) {
        const response = await call(actor.token, target.ref)
        expect(response?.status).toBe(200)
        const envelope = await response!.json()
        const result = JSON.parse(envelope.result.content[0].text)
        if (actor === target) {
          expect(result.status).toBe("ok")
          expect(result.comparison.proposals.map((quote: { proposalRef: string }) => quote.proposalRef))
            .toEqual([actor.label + "1", actor.label + "2", actor.label + "3"])
          const review = new URL(result.reviewUrl)
          expect(review.pathname).toBe(mount + "/teams/" + actor.team + "/procurement")
          expect(review.searchParams.get("request")).toBe(actor.ref)
        } else {
          expect(envelope.result.isError).toBe(true)
          expect(result).toEqual({ status: "denied" })
          expect((await call(actor.token, target.ref, { "x-sf-team-profile": select(target.team) }))?.status).toBe(403)
          expect((await call(actor.token, target.ref, { cookie: target.cookie }))?.status).toBe(403)
        }
      }
    }
    const a = cases[0]!
    if (process.platform === "linux") {
      expectSpawn(import.meta.path)
      const control = crypto.randomUUID()
      const proxy = Bun.serve({ hostname: "127.0.0.1", port: 0, async fetch(request) {
        const pathname = new URL(request.url).pathname
        if (request.method !== "POST") return new Response(null, { status: 405 })
        if (Object.values(paths).some((path) => pathname === mount + path + "/mcp")) {
          const headers = Object.fromEntries(Array.from(request.headers).filter(([name]) => name !== "host"))
          return await f.installation.handler(ingress(pathname.slice(mount.length), headers, {
            method: "POST", body: await request.text(),
          })) ?? new Response(null, { status: 404 })
        }
        if (pathname !== "/confirm" || request.headers.get("authorization") !== "Bearer " + control)
          return new Response(null, { status: 404 })
        const input = await request.json() as { reviewUrl: string; version: number; quoteId: string }
        const review = new URL(input.reviewUrl)
        expect(review.origin).toBe(origin)
        expect(review.pathname).toBe(`${mount}/teams/${a.team}/procurement`)
        expect(review.searchParams.get("request")).toBe(a.ref)
        expect(input.quoteId).toBe("A1")
        const confirmed = await f.installation.handler(ingress(review.pathname.slice(mount.length) + "?page=Requests", {
          cookie: a.cookie, origin, "content-type": "application/json",
        }, { method: "POST", body: JSON.stringify({
          page: "Requests", action: "select_quote", id: a.ref, version: input.version, values: { quoteId: input.quoteId },
        }) }))
        expect(confirmed?.status, await confirmed?.clone().text()).toBe(200)
        expect(await confirmed?.json()).toMatchObject({ ok: true })
        const persisted = await openLocalStore(a.storePath)
        try {
          await persisted.transaction("procurement", async (snapshot) => {
            const entry = object(object(object(snapshot.data.store).requests)[a.ref])
            expect(snapshot.versions[`requests:${a.ref}`]?.version).toBe(2)
            expect(entry).toMatchObject({ version: 2, request: {
              status: "sourcing", sourcing: { selectedId: "A1" }, po: { sourceQuoteId: "A1" }, history: [{
                by: oid, action: "Quotation selected — PO proposal generated", note: "Supplier A1",
              }],
            } })
            return { commit: false, value: undefined }
          })
        } finally { await persisted.dispose() }
        return new Response(null, { status: 204 })
      } })
      try {
        const runGateway = (file: string, tokens: { A: string; B: string }, confirmation?: string) => Effect.runPromise(Effect.gen(function* () {
          const script = fileURLToPath(new URL("../../../../packages/script/test/" + file, import.meta.url))
          const processService = yield* AppProcess.Service
          const result = yield* processService.run(ChildProcess.make("node", [script, "--installed-fixture"]), {
            stdin: JSON.stringify({ url: proxy.url.origin, control: confirmation, tokens }),
            timeout: "10 minutes", maxErrorBytes: 16_384, maxOutputBytes: 16_384,
          })
          return yield* AppProcess.requireSuccess(result)
        }).pipe(Effect.provide(LayerNode.compile(AppProcess.node))))
        const b = cases[1]!
        const fingerprint = (surface: "dashboard" | "procurement", path: string) => openLocalStore(path).then(async (store) => {
          try {
            return await store.transaction(surface, async (state) => ({ commit: false, value: digestSfValue(state) }))
          } finally { await store.dispose() }
        })
        const before = await Promise.all(cases.map((item) => fingerprint("procurement", item.storePath)))
        const vendor = await runGateway("sf-vendor-review.node-smoke.mjs", { A: a.vendorToken, B: b.vendorToken })
        const vendorReceipt = vendor.stdout.toString().split("\n").find((line) => line.startsWith("SF supplier review "))
        expect(vendorReceipt).toBe("SF supplier review SUP-09001/SUP-09002: two own reads, two crossed denials.")
        expect(await Promise.all(cases.map((item) => fingerprint("procurement", item.storePath)))).toEqual(before)
        console.log(vendorReceipt)
        const beforeContracts = await Promise.all(cases.map((item) => fingerprint("dashboard", item.storePath)))
        const contracts = await runGateway("sf-contract-review.node-smoke.mjs", { A: a.contractToken, B: b.contractToken })
        const contractReceipt = contracts.stdout.toString().split("\n").find((line) => line.startsWith("SF contract review "))
        expect(contractReceipt).toBe("SF contract review CT-09001/CT-09002: two own reads, two crossed denials.")
        expect(await Promise.all(cases.map((item) => fingerprint("dashboard", item.storePath)))).toEqual(beforeContracts)
        console.log(contractReceipt)
        const run = await runGateway("sf-purchase-invoke.node-smoke.mjs", { A: a.token, B: b.token }, control)
        const receipt = run.stdout.toString().split("\n").find((line) => line.startsWith("SF synthetic purchase "))
        expect(receipt).toBe("SF synthetic purchase PR-2026-0901: A/B 4/4, confirmed A1, version 1 -> 2, one quotation selection in history.")
        console.log(receipt)
      } finally { await proxy.stop(true) }
    }
    const dashboard = await openLocalStore(a.storePath)
    try {
      const batch = () => f.installation.handler(ingress(contractPath + "/mcp", {
        authorization: "Bearer " + a.contractToken, "content-type": "application/json", accept: "application/json, text/event-stream",
      }, { method: "POST", body: JSON.stringify([a.contractNumber, "CT-09003"].map((recordRef, index) => ({
        jsonrpc: "2.0", id: index + 1, method: "tools/call",
        params: { name: "sf_read_contract_review", arguments: { recordRef } },
      }))) }))
      const original = await batch()
      expect(original?.status).toBe(200)
      const messages = await original!.json() as { result: { content: { text: string }[] } }[]
      expect(messages.map((message) => JSON.parse(message.result.content[0]!.text).contract.ref).sort())
        .toEqual([a.contractNumber, "CT-09003"])
      const checks = { count: 0 }
      membership.onRoleCheck = async () => {
        if (++checks.count !== 2) return
        await dashboard.transaction("dashboard", async (snapshot) => {
          snapshot.data.contracts = rows(snapshot.data.contracts).map((row) =>
            row.num === "CT-09003" ? { ...row, name: "Changed during publication" } : row)
          return { commit: true, value: undefined }
        })
      }
      try {
        const staleBatch = await batch()
        expect(staleBatch?.status).toBe(403)
        expect(await staleBatch?.text()).toBe("")
        expect(checks.count).toBe(2)
      } finally { membership.onRoleCheck = undefined }
      await dashboard.transaction("dashboard", async (snapshot) => {
        snapshot.data.summaries = []
        return { commit: true, value: undefined }
      })
    } finally { await dashboard.dispose() }
    const afterPageRevocation = await contractCall(a.contractToken, a.contractNumber!)
    expect(afterPageRevocation?.status).toBe(200)
    expect((await afterPageRevocation!.json()).result).toEqual(contractDenied)
    membership.revokeOnRoleCheck = true
    expect((await call(a.token, a.ref))?.status).toBe(403)
    expect(membership.teamRemoved).toBe(true)
    membership.revokeOnRoleCheck = false
    membership.teamRemoved = false
    const rotated = await pair(a.cookie, a.team)
    expect((await call(a.token, a.ref))?.status).toBe(403)
    expect((await f.installation.handler(ingress("/auth/logout", { cookie: a.cookie, origin, accept: "application/json" }, {
      method: "POST",
    })))?.status).toBe(204)
    expect((await call(rotated, a.ref))?.status).toBe(403)
  } finally { await f.close() }
}, 620_000)

test("Corporate dashboard authorizes only current, enabled direct Teams from the signed HTTPS session", async () => {
  const keys = await generateKeyPair("RS256", { extractable: true })
  const jwk = await exportJWK(keys.publicKey)
  const login = { nonce: "" }
  const graphCalls: string[] = []
  const finance = { id: teamObjectId, tenantId, displayName: "Finance", isArchived: false }
  const planning = { ...finance, id: secondTeamId, displayName: "Planning" }
  const disabled = { ...finance, id: disabledTeamId, displayName: "Disabled" }
  const membership = { teams: [finance, disabled], incomplete: false, down: false, group: true, revokeAfterRoleCheck: false }
  const f = await fixture("direct", async (request) => {
    const url = new URL(request.url)
    if (url.href === authority + "/v2.0/.well-known/openid-configuration") return discovery()
    if (url.href === authority + "/discovery/v2.0/keys") return Response.json({ keys: [{ ...jwk, kid: "installation-test" }] })
    if (url.href === authority + "/oauth2/v2.0/token") {
      const form = new URLSearchParams(await request.text())
      expect(form.get("client_secret")).toBe(secret)
      expect(form.get("redirect_uri")).toBe(origin + mount + "/auth/callback")
      const idToken = await new SignJWT({ tid: tenantId, oid, nonce: login.nonce })
        .setSubject("synthetic-subject").setIssuer(authority + "/v2.0").setAudience(clientId)
        .setIssuedAt(epoch).setExpirationTime(epoch + 3600)
        .setProtectedHeader({ alg: "RS256", kid: "installation-test" }).sign(keys.privateKey)
      return Response.json({ access_token: accessToken, id_token: idToken, token_type: "Bearer", expires_in: 3600, scope: "User.Read Team.ReadBasic.All" })
    }
    if (url.origin === "https://graph.microsoft.com") {
      graphCalls.push(url.pathname)
      expect(request.headers.get("authorization")).toBe("Bearer " + accessToken)
      if (url.pathname === "/v1.0/me") return Response.json({ id: oid, displayName: "Verified person" })
      if (url.href === graph + "/me/checkMemberGroups") {
        expect(request.method).toBe("POST")
        expect(await request.json()).toEqual({ groupIds: [grantPrincipal] })
        if (membership.revokeAfterRoleCheck) membership.teams = [planning, disabled]
        return Response.json({ value: membership.group ? [grantPrincipal] : [] })
      }
      if (url.href === graph + "/me/joinedTeams") {
        if (membership.down) return new Response(null, { status: 503 })
        return Response.json({
          value: membership.teams,
          ...(membership.incomplete ? { "@odata.count": membership.teams.length + 1 } : {}),
        })
      }
    }
    throw new Error("Unexpected synthetic Microsoft request")
  }, [teamObjectId.toUpperCase(), secondTeamId], {
    dashboard: { admin: "group:" + grantPrincipal },
    planner: { viewer: "group:" + grantPrincipal },
    procurement: { buyer: "group:" + grantPrincipal, admin: "group:" + grantPrincipal },
  })
  try {
    expect(f.installation.mount).toBe(mount)
    expect(f.installation.trustedIngress.origin).toBe(ingressOrigin)
    expect(f.installation.trustedIngress.authorize(ingressProof)).toBe(true)
    expect(f.installation.trustedIngress.authorize(undefined)).toBe(false)
    expect(f.installation.trustedIngress.authorize("b".repeat(64))).toBe(false)
    expect(f.installation.trustedIngress.authorize(ingressProof + ", " + ingressProof)).toBe(false)
    const anonymous = await f.installation.handler(ingress("/dashboard"))
    expect(anonymous?.status).toBe(303)
    expect(anonymous?.headers.get("location")).toBe(mount + "/auth/login")
    const begin = await f.installation.handler(ingress("/auth/login", { "x-forwarded-host": "foreign.example.test" }))
    expect(begin?.status).toBe(303)
    const authorize = new URL(begin!.headers.get("location")!)
    expect(authorize.searchParams.get("redirect_uri")).toBe(origin + mount + "/auth/callback")
    expect(authorize.searchParams.get("scope")?.split(" ")).toContain("Team.ReadBasic.All")
    expect(authorize.searchParams.get("scope")?.split(" ")).not.toContain("TeamMember.Read.All")
    expect(authorize.searchParams.has("client_secret")).toBe(false)
    login.nonce = authorize.searchParams.get("nonce")!
    const loginCookie = begin!.headers.getSetCookie().find((value) => value.includes("_login="))!
    expect(loginCookie).toContain("; Secure")
    const finish = await f.installation.handler(ingress("/auth/callback?" + new URLSearchParams({
      code: "synthetic-code", state: authorize.searchParams.get("state")!,
    }), { cookie: loginCookie.split(";")[0] }))
    expect(finish?.status).toBe(303)
    const sessionCookie = finish!.headers.getSetCookie().find((value) => value.includes("_session="))!
    expect(sessionCookie).toContain("; Secure")
    expect(sessionCookie).not.toContain(accessToken)
    expect(graphCalls).toEqual(["/v1.0/me"])
    const headers = { cookie: sessionCookie.split(";")[0] }
    const callbackTarget = new URL(finish!.headers.get("location")!, origin)
    expect(callbackTarget.href).toBe(origin + mount + "/dashboard")
    const callbackHeaders = { ...headers, "sec-fetch-site": "cross-site", "sec-fetch-mode": "navigate", "sec-fetch-dest": "document" }
    const landing = await f.installation.handler(ingress(callbackTarget.pathname.slice(mount.length), callbackHeaders))
    expect(landing?.status).toBe(303)
    const teamPath = (id: string, surface: string) => "/teams/" + id + "/" + surface
    expect(landing?.headers.get("location")).toBe(mount + teamPath(teamObjectId, "dashboard"))
    expect(await f.installation.handler(ingress("/teams", headers))).toBeUndefined()
    expect((await f.installation.handler(ingress("/auth/login", { host: "foreign.example.test" })))?.status).toBe(403)
    expect((await f.installation.handler(new Request(listenerOrigin + mount + "/auth/login", {
      headers: { host: new URL(ingressOrigin).host },
    })))?.status).toBe(403)
    const result = await f.installation.teamDirectory!(ingress("/dashboard?principalObjectId=caller", headers))
    expect(result).toEqual({
      state: "complete", tenantId, principalObjectId: oid, source: "joinedTeams", membership: "direct",
      teams: [
        { teamObjectId, name: "Finance", archived: false },
        { teamObjectId: disabledTeamId, name: "Disabled", archived: false },
      ],
    })
    expect(JSON.stringify(result)).not.toContain(accessToken)
    const read = ["/v1.0/me", "/v1.0/me/joinedTeams", "/v1.0/me"]
    expect(graphCalls).toEqual(["/v1.0/me", ...read, ...read])

    const dashboard = (fields?: Record<string, string>) =>
      f.installation.handler(ingress("/dashboard", { ...headers, ...fields }))
    expect((await dashboard({ "x-sf-team-profile": "" }))?.status).toBe(403)
    expect((await dashboard({ "sec-fetch-site": "cross-site" }))?.status).toBe(403)
    expect((await f.installation.handler(ingress("/dashboard?teamObjectId=" + teamObjectId, headers)))?.status).toBe(403)
    expect(graphCalls).toEqual(["/v1.0/me", ...read, ...read])

    const teamDashboard = await f.installation.handler(ingress(teamPath(teamObjectId, "dashboard"), callbackHeaders))
    expect(teamDashboard?.status).toBe(200)
    expect(await teamDashboard?.text()).toContain(`name="person" value="${oid}"`)
    for (const surface of ["planner", "procurement"]) {
      const redirect = await f.installation.handler(ingress("/" + surface, headers))
      expect(redirect?.status).toBe(303)
      expect(redirect?.headers.get("location")).toBe(mount + teamPath(teamObjectId, surface))
    }
    const head = await f.installation.handler(ingress(teamPath(teamObjectId, "planner"), headers, { method: "HEAD" }))
    expect(head?.status).toBe(200)
    expect(await head?.text()).toBe("")

    membership.teams = [finance, planning, disabled]
    const selection = await dashboard()
    expect(selection?.status).toBe(409)
    expect(selection?.headers.get("Cache-Control")).toBe("no-store")
    const selected = Schema.decodeUnknownSync(TeamProfile.TeamState)(await selection?.json())
    if (selected.status !== "selection-required") throw new Error("Expected Team selection")
    expect(selected.choices.map((choice) => choice.displayName)).toEqual(["Finance", "Planning"])
    const profile = selected.choices[1]!.profile
    const selector = (target: unknown) => ({
      "x-sf-team-profile": JSON.stringify({ contractRevision: "sf-team-profile/1", kind: "team", profile: target }),
    })
    const selectedDashboard = await dashboard(selector(profile))
    expect(selectedDashboard?.status).toBe(303)
    expect(selectedDashboard?.headers.get("location")).toBe(mount + teamPath(secondTeamId, "dashboard"))
    expect((await dashboard({
      ...selector(profile), "sec-fetch-site": "cross-site", "sec-fetch-mode": "navigate", "sec-fetch-dest": "document",
    }))?.status).toBe(403)
    const selectedRoot = await f.installation.handler(ingress("", { ...headers, ...selector(profile) }))
    expect(selectedRoot?.status).toBe(303)
    expect(selectedRoot?.headers.get("location")).toBe(mount + teamPath(secondTeamId, "dashboard"))
    expect((await dashboard(selector({ ...profile, teamObjectId: disabledTeamId })))?.status).toBe(403)
    expect((await dashboard(selector({ ...profile, installationId: "other-installation" })))?.status).toBe(403)
    expect((await dashboard(selector({ ...profile, tenantId: clientId })))?.status).toBe(403)

    const suppliers = (id: string, fields?: Record<string, string>) => f.installation.handler(
      ingress(teamPath(id, "procurement") + "?page=Suppliers", { ...headers, ...fields }),
    )
    const createSupplier = (id: string, legalName: string, fields?: Record<string, string>) => f.installation.handler(
      ingress(teamPath(id, "procurement"), { ...headers, "content-type": "application/json", ...fields }, {
        method: "POST", body: JSON.stringify({ page: "Suppliers", action: "create", version: 0, values: { legalName } }),
      }),
    )
    expect((await suppliers(teamObjectId, selector(profile)))?.status).toBe(403)
    expect((await createSupplier(teamObjectId, "Missing origin"))?.status).toBe(403)
    expect((await createSupplier(teamObjectId, "Wrong origin", { origin: ingressOrigin }))?.status).toBe(403)
    expect((await createSupplier(teamObjectId, "Cross Team", { origin, ...selector(profile) }))?.status).toBe(403)
    expect((await createSupplier(teamObjectId, "Finance supplier", { origin }))?.status).toBe(200)
    expect((await createSupplier(secondTeamId, "Planning supplier", { origin }))?.status).toBe(200)
    for (const [id, own, other] of [
      [teamObjectId, "Finance supplier", "Planning supplier"],
      [secondTeamId, "Planning supplier", "Finance supplier"],
    ] as const) {
      const read = await suppliers(id)
      expect(read?.status).toBe(200)
      const html = await read!.text()
      expect(html).toContain(`data-logout="${mount}/auth"`)
      expect(html).toContain(own)
      expect(html).not.toContain(other)
      const partition = digestSfValue({ installationId: profile.installationId, tenantId, teamObjectId: id })
      expect(await Bun.file(join(f.directory, "business-teams", partition, "installation.sqlite")).exists()).toBe(true)
    }

    const writeSettings = (action: "reset" | "save", version: number, holderId?: string) =>
      f.installation.handler(ingress(teamPath(teamObjectId, "procurement"), {
        ...headers, origin, "content-type": "application/json",
      }, {
        method: "POST",
        body: JSON.stringify({ page: "Settings", action, version, values: holderId
          ? { levels: [{ id: "first", name: "First", threshold: 100, holderId }] } : {} }),
      }))
    expect((await writeSettings("reset", 0))?.status).toBe(200)
    expect((await writeSettings("save", 1, grantPrincipal))?.status).toBe(422)
    expect((await writeSettings("save", 1, oid))?.status).toBe(200)

    membership.group = false
    expect((await suppliers(teamObjectId))?.status).toBe(403)
    membership.group = true
    membership.revokeAfterRoleCheck = true
    expect((await createSupplier(teamObjectId, "Revoked before commit", { origin }))?.status).toBe(403)
    membership.revokeAfterRoleCheck = false
    expect((await suppliers(teamObjectId))?.status).toBe(403)
    membership.teams = [finance, planning, disabled]
    membership.revokeAfterRoleCheck = true
    const revokedRead = await suppliers(teamObjectId)
    expect(revokedRead?.status).toBe(403)
    expect(await revokedRead?.text()).not.toContain("Finance supplier")
    membership.revokeAfterRoleCheck = false
    membership.teams = [finance, planning, disabled]
    const staleImport = () => f.installation.handler(ingress(teamPath(teamObjectId, "dashboard"), {
      ...headers, origin, "content-type": "application/json",
    }, {
      method: "POST", body: JSON.stringify({
        page: "Executive Dashboard", action: "backup-import", version: 999, confirmed: true, values: { data: {} },
      }),
    }))
    expect((await staleImport())?.status).toBe(409)
    membership.revokeAfterRoleCheck = true
    const revokedConflict = await staleImport()
    expect(revokedConflict?.status).toBe(403)
    expect(await revokedConflict?.text()).toBe("")
    membership.revokeAfterRoleCheck = false
    membership.teams = [finance, planning, disabled]
    const restored = await suppliers(teamObjectId)
    expect(restored?.status).toBe(200)
    const restoredHtml = await restored!.text()
    expect(restoredHtml).toContain("Finance supplier")
    expect(restoredHtml).not.toContain("Revoked before commit")

    membership.teams = [finance, disabled, { ...planning, isArchived: true }]
    expect((await dashboard(selector(profile)))?.status).toBe(403)
    membership.teams = [finance, disabled]
    expect((await dashboard(selector(profile)))?.status).toBe(403)
    membership.incomplete = true
    expect((await dashboard())?.status).toBe(503)
    membership.incomplete = false
    membership.down = true
    expect((await dashboard())?.status).toBe(503)
    membership.down = false
    membership.teams = []
    expect((await f.installation.handler(ingress("", headers)))?.status).toBe(403)

    const prepared = await f.prepare()
    const store = await openLocalStore(join(f.directory, "business-microsoft"))
    try {
      const identity = prepared.createIdentity(store.secrets)
      const observeRecovery = identity.observeCorporateRecoveryActor!
      const recovery = (fields: HeadersInit, requestOrigin = origin) =>
        new Request(requestOrigin + mount + "/api/ui/corporate-recovery", { method: "POST", headers: fields })
      const callsBeforeRecovery = graphCalls.length
      expect(await observeRecovery(recovery({ origin }), grantPrincipal)).toBeUndefined()
      expect(await observeRecovery(recovery({ ...headers, origin: "https://other.example.test" }), grantPrincipal)).toBeUndefined()
      expect(await observeRecovery(recovery({ ...headers, origin }, "https://other.example.test"), grantPrincipal)).toBeUndefined()
      expect(await observeRecovery(recovery({ ...headers, origin, "sec-fetch-site": "cross-site" }), grantPrincipal)).toBeUndefined()
      expect(graphCalls.length).toBe(callsBeforeRecovery)

      const admitted = await observeRecovery(recovery({ ...headers, origin }), grantPrincipal)
      expect(admitted?.principalId).toBe(oid)
      expect(graphCalls.slice(callsBeforeRecovery)).toEqual(["/v1.0/me", "/v1.0/me/checkMemberGroups"])
      membership.group = false
      expect(await admitted?.verifyCurrent()).toBe(false)
      membership.group = true
      expect(await admitted?.verifyCurrent()).toBe(true)

      const logout = await f.installation.handler(ingress("/auth/logout", { ...headers, origin }, { method: "POST" }))
      expect(logout?.status).toBe(204)
      const callsBeforeRevokedSession = graphCalls.length
      expect(await admitted?.verifyCurrent()).toBe(false)
      expect(graphCalls.length).toBe(callsBeforeRevokedSession)
    } finally { await store.dispose() }
    const signedOut = await f.installation.handler(ingress("/auth/signed-out"))
    expect(signedOut?.status).toBe(200)
    expect(await signedOut?.text()).toContain(`href="${mount}/auth/login"`)
    expect((await suppliers(teamObjectId))?.status).toBe(303)
  } finally { await f.close() }
})

test("Installed Teams Decisions replays a native draft after authenticated restore and reopening the installation", async () => {
  const keys = await generateKeyPair("RS256", { extractable: true })
  const jwk = await exportJWK(keys.publicKey)
  const login = { nonce: "" }
  const membership = { active: true, both: false, reads: 0, queued: Promise.withResolvers<void>() }
  const f = await fixture("direct", async (request) => {
    const url = new URL(request.url)
    if (url.href === authority + "/v2.0/.well-known/openid-configuration") return discovery()
    if (url.href === authority + "/discovery/v2.0/keys") return Response.json({ keys: [{ ...jwk, kid: "installation-test" }] })
    if (url.href === authority + "/oauth2/v2.0/token") {
      const idToken = await new SignJWT({ tid: tenantId, oid, nonce: login.nonce })
        .setSubject("synthetic-subject").setIssuer(authority + "/v2.0").setAudience(clientId)
        .setIssuedAt(epoch).setExpirationTime(epoch + 3600)
        .setProtectedHeader({ alg: "RS256", kid: "installation-test" }).sign(keys.privateKey)
      return Response.json({ access_token: accessToken, id_token: idToken, token_type: "Bearer", expires_in: 3600, scope: "User.Read Team.ReadBasic.All" })
    }
    expect(request.headers.get("authorization")).toBe("Bearer " + accessToken)
    if (url.origin === "https://graph.microsoft.com" && url.pathname === "/v1.0/me") return Response.json({ id: oid, displayName: "Verified person" })
    if (url.href === graph + "/me/checkMemberGroups") {
      expect(await request.json()).toEqual({ groupIds: [grantPrincipal] })
      return Response.json({ value: [grantPrincipal] })
    }
    if (url.href === graph + "/me/joinedTeams") {
      const value = membership.active
        ? [teamObjectId, ...(membership.both ? [secondTeamId] : [])].map(id => ({ id, tenantId, displayName: id, isArchived: false })) : []
      if (++membership.reads === 2) membership.queued.resolve()
      return Response.json({ value })
    }
    throw new Error("Unexpected synthetic Microsoft request")
  }, [teamObjectId, secondTeamId], {
    dashboard: { contributor: "group:" + grantPrincipal }, planner: {}, procurement: {},
  }, undefined, { nativeDecisions: true, nativeRecovery: true, nativeWeb: true })
  try {
    const begin = await f.installation.handler(ingress("/auth/login?returnTo=%2F"))
    expect(begin?.status).toBe(303)
    const authorize = new URL(begin!.headers.get("location")!)
    login.nonce = authorize.searchParams.get("nonce")!
    const challenge = begin!.headers.getSetCookie().find((value) => value.includes("_login="))!.split(";")[0]
    const finish = await f.installation.handler(ingress("/auth/callback?" + new URLSearchParams({
      code: "synthetic-code", state: authorize.searchParams.get("state")!,
    }), { cookie: challenge }))
    expect(finish?.status).toBe(303)
    expect(new URL(finish!.headers.get("location")!, origin).href).toBe(origin + "/")
    const cookie = finish!.headers.getSetCookie().find((value) => value.includes("_session="))!.split(";")[0]
    const nativeContext = async (id: string, session?: string) => {
      const installed = await f.installation.discovery?.current(AbortSignal.timeout(1000))
      const binding = installed?.identity()
      if (!binding) throw new Error("Expected the current Microsoft installation")
      return f.installation.handler(ingress("/api/ui/context?" + new URLSearchParams({
        contractRevision: "sf-team-profile/1", installationId: binding.installationId, hostId: binding.hostId,
        tenantId, kind: "team", teamObjectId: id,
      }), session ? { cookie: session } : undefined))
    }
    expect((await nativeContext(teamObjectId))?.status).toBe(401)
    const context = await nativeContext(teamObjectId, cookie)
    expect(context?.status).toBe(200)
    expect(await context?.json()).toMatchObject({
      status: "ok", value: { profile: { teams: { selected: { teamObjectId } } } },
    })
    const crossTeam = await nativeContext(secondTeamId, cookie)
    expect(crossTeam?.status).toBe(403)
    expect(await crossTeam?.json()).toEqual({ status: "denied" })
    const input = { objective: "Preserve the recorded Team decision",
      horizon: { start: "2027-01-01", end: "2027-12-31" }, currency: "USD", criteria: ["Keep the original case"], sourceRefs: [] }
    const draft = (id: string, fields: Record<string, string> = {}) => f.installation.handler(
      ingress(`/teams/${id}/dashboard?sf=workbench-command`, {
        cookie, origin, "content-type": "application/json", "idempotency-key": "native-team-restart-draft", ...fields,
      }, { method: "POST", body: JSON.stringify({ operation: "sf_case_draft", input }) }),
    )
    const installationId = digestSfValue({ origin, mount, directory: f.directory })
    const partitionFor = (id: string) => digestSfValue({ installationId, tenantId, teamObjectId: id })
    const pathFor = (id: string) => join(f.directory, "business-teams", partitionFor(id))
    const readFrontier = async () => {
      const store = await openLocalStore(pathFor(teamObjectId))
      try {
        return await store.transaction("dashboard", async (snapshot) => ({ commit: false, value: inspectSfProductRestoreFrontier(snapshot) }))
      } finally { await store.dispose() }
    }
    expect((await draft(teamObjectId, { cookie: "" }))?.status).toBe(401)
    expect((await draft(secondTeamId))?.status).toBe(403)
    expect((await draft(teamObjectId, { "idempotency-key": "native-team-checkpoint-draft" }))?.status).toBe(200)
    const store = await openLocalStore(pathFor(teamObjectId))
    const clock = new Date(epoch * 1000).toISOString()
    const archive = await createLocalBackups(join(f.directory, "backups-teams", partitionFor(teamObjectId)))
    const checkpoint = await archive.capture(store, "dashboard", clock)
    const checkpointData = await archive.source.load("dashboard", checkpoint.id)
    expect(checkpointData).toBeDefined()
    await store.dispose()
    const created = await draft(teamObjectId)
    expect(created?.status).toBe(200)
    const result = await created!.json()
    expect(result).toMatchObject({ status: "ok", outputRef: expect.stringMatching(/^case:[^:]+:[^:]+$/), value: { objective: input.objective } })
    const frontier = await readFrontier()
    expect(frontier?.transactions).toHaveLength(2)
    expect(await Bun.file(join(pathFor(secondTeamId), "installation.sqlite")).exists()).toBe(false)

    membership.both = true
    expect((await draft(secondTeamId))?.status).toBe(403)
    const witness = new Database(f.register)
    try {
      witness.query("INSERT INTO recovery_pins VALUES (?, ?, ?, ?, ?, ?)").run(
        digestSfValue({ installationId, tenantId, clientId }), partitionFor(teamObjectId), 1,
        digestSfValue(checkpointData!.snapshot), digestSfValue(frontier),
        digestSfValue({ checkpointId: checkpoint.id, manifest: checkpoint.manifest }),
      )
    } finally { witness.close() }
    const modified = await openLocalStore(pathFor(teamObjectId))
    try {
      await modified.transaction("dashboard", async (snapshot) => {
        snapshot.data.qaMarkerAfterCheckpoint = true
        return { commit: true, value: undefined }
      })
    } finally { await modified.dispose() }
    const recovery = await f.installation.handler(ingress("/api/ui/team-profile-migration/recover", {
      cookie, origin, "content-type": "application/json",
    }, { method: "POST", body: JSON.stringify({ teamObjectId, checkpointId: checkpoint.id, expectedVersion: 0, confirm: true }) }))
    expect(recovery?.status).toBe(204)
    const restored = await openLocalStore(pathFor(teamObjectId))
    try {
      await restored.transaction("dashboard", async (snapshot) => {
        expect(snapshot.data.qaMarkerAfterCheckpoint).toBeUndefined()
        expect(snapshot.versions.dataset?.version).toBe(1)
        return { commit: false, value: undefined }
      })
    } finally { await restored.dispose() }
    expect(await readFrontier()).toEqual(frontier)
    await f.reopen()
    const retry = await draft(teamObjectId)
    expect(retry?.status).toBe(200)
    expect(await retry!.json()).toEqual(result)
    expect(await readFrontier()).toEqual(frontier)
    membership.active = false
    const noTeam = await nativeContext(teamObjectId, cookie)
    expect(noTeam?.status).toBe(403)
    expect(await noTeam?.json()).toEqual({ status: "denied" })
    expect((await draft(teamObjectId))?.status).toBe(403)
    expect(await readFrontier()).toEqual(frontier)

    const authStore = await openLocalStore(join(f.directory, "business-microsoft"))
    const locked = Promise.withResolvers<void>()
    const release = Promise.withResolvers<void>()
    const before = authStore.transaction("dashboard", async (snapshot) => {
      locked.resolve()
      await release.promise
      return { commit: false, value: digestSfValue(snapshot.data.teamDecisionIntentions) }
    })
    try {
      await locked.promise
      membership.active = true
      membership.reads = 0
      membership.queued = Promise.withResolvers<void>()
      const waiting = draft(teamObjectId, { "idempotency-key": "native-team-revocation-race" })
      await Promise.race([membership.queued.promise, waiting.then(() => { throw new Error("Expected a queued Decisions write") })])
      membership.active = false
      release.resolve()
      expect((await waiting)?.ok).toBe(false)
      expect(await authStore.transaction("dashboard", async (snapshot) => ({
        commit: false, value: digestSfValue(snapshot.data.teamDecisionIntentions),
      }))).toBe(await before)
      expect(await readFrontier()).toEqual(frontier)
    } finally {
      release.resolve()
      await authStore.dispose()
    }
  } finally { await f.close() }
}, 60_000)

test("Corporate Team directory scopes assignment choices to the mounted Team", async () => {
  const keys = await generateKeyPair("RS256", { extractable: true })
  const jwk = await exportJWK(keys.publicKey)
  const login = { nonce: "" }
  const finance = { id: teamObjectId, tenantId, displayName: "Finance", isArchived: false }
  const planning = { ...finance, id: secondTeamId, displayName: "Planning" }
  const financePerson = "77777777-7777-4777-8777-777777777777"
  const planningPerson = "88888888-8888-4888-8888-888888888888"
  const provider = { joined: [finance, planning], roster: "complete", commitRosterReads: 0 }
  const member = (id: string, userId: string, displayName: string) => ({
    "@odata.type": "#microsoft.graph.aadUserConversationMember", id, userId, tenantId, displayName,
  })
  const f = await fixture("direct", async (request) => {
    const url = new URL(request.url)
    if (url.href === authority + "/v2.0/.well-known/openid-configuration") return discovery()
    if (url.href === authority + "/discovery/v2.0/keys") return Response.json({ keys: [{ ...jwk, kid: "installation-test" }] })
    if (url.href === authority + "/oauth2/v2.0/token") {
      const idToken = await new SignJWT({ tid: tenantId, oid, nonce: login.nonce })
        .setSubject("synthetic-subject").setIssuer(authority + "/v2.0").setAudience(clientId)
        .setIssuedAt(epoch).setExpirationTime(epoch + 3600)
        .setProtectedHeader({ alg: "RS256", kid: "installation-test" }).sign(keys.privateKey)
      return Response.json({
        access_token: accessToken, id_token: idToken, token_type: "Bearer", expires_in: 3600,
        scope: "User.Read Team.ReadBasic.All TeamMember.Read.All",
      })
    }
    if (url.origin === "https://graph.microsoft.com") {
      expect(request.headers.get("authorization")).toBe("Bearer " + accessToken)
      if (url.pathname === "/v1.0/me") return Response.json({ id: oid, displayName: "Verified person" })
      if (url.href === graph + "/me/checkMemberGroups") {
        expect(await request.json()).toEqual({ groupIds: [grantPrincipal] })
        return Response.json({ value: [grantPrincipal] })
      }
      if (url.href === graph + "/me/joinedTeams") return Response.json({ value: provider.joined })
      const team = [teamObjectId, secondTeamId].find((id) => url.pathname === `/v1.0/teams/${id}/members`)
      if (team) {
        expect(request.method).toBe("GET")
        if (provider.roster === "down") return new Response(null, { status: 503 })
        if (provider.roster === "revoke") provider.joined = [planning]
        if (provider.roster === "archive" && ++provider.commitRosterReads === 2)
          provider.joined = [{ ...finance, isArchived: true }, planning]
        const value = [member("caller-opaque", oid, "Verified person")]
        if (team === secondTeamId) value.push(member("planning-opaque", planningPerson, "Planning colleague"))
        if (team === teamObjectId && provider.roster !== "missing-finance" &&
            (provider.roster !== "depart" || ++provider.commitRosterReads === 1))
          value.push(member("finance-opaque", financePerson, "Finance colleague"))
        return Response.json({ value, ...(provider.roster === "incomplete" ? { "@odata.count": value.length + 1 } : {}) })
      }
    }
    throw new Error("Unexpected synthetic Microsoft request")
  }, [teamObjectId, secondTeamId], {
    dashboard: { admin: "group:" + grantPrincipal }, planner: {}, procurement: { admin: "group:" + grantPrincipal },
  }, "members")
  try {
    const begin = await f.installation.handler(ingress("/auth/login"))
    expect(begin?.status).toBe(303)
    const authorize = new URL(begin!.headers.get("location")!)
    expect(authorize.searchParams.get("scope")?.split(" ")).toContain("TeamMember.Read.All")
    login.nonce = authorize.searchParams.get("nonce")!
    const loginCookie = begin!.headers.getSetCookie().find((value) => value.includes("_login="))!
    const finish = await f.installation.handler(ingress("/auth/callback?" + new URLSearchParams({
      code: "synthetic-code", state: authorize.searchParams.get("state")!,
    }), { cookie: loginCookie.split(";")[0] }))
    expect(finish?.status).toBe(303)
    const cookie = finish!.headers.getSetCookie().find((value) => value.includes("_session="))!.split(";")[0]
    const dashboardPath = (id: string) => `/teams/${id}/dashboard`
    const dashboard = (id: string) => f.installation.handler(ingress(dashboardPath(id), { cookie }))
    const assign = (id: string, person: string, version = 0, assigned = ["Operations"]) => f.installation.handler(
      ingress(dashboardPath(id), { cookie, origin, "content-type": "application/json" }, {
        method: "POST", body: JSON.stringify({ page: "Executive Dashboard", action: "configure-assignment", version, values: { person, assigned } }),
      }),
    )
    for (const [id, person, name, other, otherName] of [
      [teamObjectId, financePerson, "Finance colleague", planningPerson, "Planning colleague"],
      [secondTeamId, planningPerson, "Planning colleague", financePerson, "Finance colleague"],
    ]) {
      const response = await dashboard(id)
      expect(response?.status).toBe(200)
      const html = await response!.text()
      expect(html).toContain(`name="person" value="${person}"`)
      expect(html).toContain(name)
      expect(html).not.toContain(other)
      expect(html).not.toContain(otherName)
      expect(html).not.toContain("-opaque")
      expect((await assign(id, other))?.status).toBe(422)
    }
    expect((await assign(teamObjectId, financePerson))?.status).toBe(200)
    expect(await (await dashboard(teamObjectId))?.text()).toContain('value="Operations" checked')
    expect(await (await dashboard(secondTeamId))?.text()).not.toContain('value="Operations" checked')

    const settings = (holderId?: string, version = 1) => f.installation.handler(
      ingress(`/teams/${teamObjectId}/procurement`, { cookie, origin, "content-type": "application/json" }, {
        method: "POST", body: JSON.stringify(holderId === undefined
          ? { page: "Settings", action: "reset", version: 0, values: {} }
          : { page: "Settings", action: "save", version, values: { levels: [{ id: "L1", name: "Reviewer", threshold: 0, holderId }] } }),
      }),
    )
    expect((await settings())?.status).toBe(200)
    expect((await settings(planningPerson))?.status).toBe(422)
    expect((await settings(financePerson))?.status).toBe(200)

    provider.roster = "missing-finance"
    const approvalPicker = async () => {
      const response = await f.installation.handler(ingress(`/teams/${teamObjectId}/procurement?page=Settings`, { cookie }))
      expect(response?.status).toBe(200)
      return (await response!.text()).match(/<select name="levels\.0\.holderId">[\s\S]*?<\/select>/)?.[0]
    }
    const previous = await approvalPicker()
    expect(previous).toContain('value="keep-previous-holder" selected')
    expect(previous).not.toContain(financePerson)
    expect((await settings("keep-previous-holder", 2))?.status).toBe(200)
    provider.roster = "complete"
    expect(await approvalPicker()).toContain(`value="${financePerson}" selected`)

    for (const state of ["incomplete", "down"]) {
      provider.roster = state
      const unavailable = await dashboard(teamObjectId)
      expect(unavailable?.status).toBe(503)
      expect(await unavailable?.text()).not.toContain("Finance colleague")
      expect((await assign(teamObjectId, financePerson, 1, ["risks"]))?.status).toBe(503)
    }

    provider.roster = "depart"
    expect((await assign(teamObjectId, financePerson, 1, ["risks"]))?.status).toBe(403)
    expect(provider.commitRosterReads).toBe(2)
    provider.roster = "archive"
    provider.commitRosterReads = 0
    expect((await assign(teamObjectId, financePerson, 1, ["risks"]))?.status).toBe(403)
    expect(provider.commitRosterReads).toBe(2)
    provider.joined = [finance, planning]
    provider.roster = "revoke"
    const revoked = await assign(teamObjectId, financePerson, 1, ["risks"])
    expect(revoked?.status).toBe(403)
    expect(await revoked?.text()).not.toContain("Finance colleague")
    provider.roster = "complete"
    provider.joined = [finance, planning]
    const restored = await (await dashboard(teamObjectId))?.text()
    expect(restored).toContain('value="Operations" checked')
    expect(restored).not.toContain('value="risks" checked')
  } finally { await f.close() }
})

test("Corporate enabled Team config rejects malformed and duplicate IDs and requires direct Teams mode", async () => {
  const unexpectedProvider = async () => { throw new Error("Unexpected Microsoft request") }
  await expect(fixture("direct", unexpectedProvider, [teamObjectId, teamObjectId.toUpperCase()])).rejects.toThrow("Duplicate enabled Team ID")
  await expect(fixture("direct", unexpectedProvider, ["Finance"])).rejects.toThrow("Invalid enabled Team ID")
  await expect(fixture(undefined, unexpectedProvider, [teamObjectId])).rejects.toThrow("Enabled Team IDs require direct Teams membership")
})

test("Corporate profile without Teams opt-in keeps minimum login scopes", async () => {
  const f = await fixture(undefined, async (request) => {
    expect(request.url).toBe(authority + "/v2.0/.well-known/openid-configuration")
    return discovery()
  })
  try {
    expect(f.installation.teamDirectory).toBeUndefined()
    const begin = await f.installation.handler(ingress("/auth/login"))
    expect(begin?.status).toBe(303)
    const authorize = new URL(begin!.headers.get("location")!)
    expect(authorize.searchParams.get("scope")?.split(" ")).toEqual(["openid", "profile", "offline_access", "User.Read"])
  } finally { await f.close() }
})

test("Corporate login reserves capacity before discovery and releases its slot on provider failure", async () => {
  const provider = { calls: 0 }
  const f = await fixture(undefined, async (request) => {
    expect(request.url).toBe(authority + "/v2.0/.well-known/openid-configuration")
    provider.calls++
    if (provider.calls === 1) return new Response(null, { status: 503 })
    return discovery()
  })
  try {
    expect((await f.installation.handler(ingress("/auth/login")))?.status).toBe(503)
    for (let i = 0; i < 100; i++) {
      expect((await f.installation.handler(ingress("/auth/login")))?.status).toBe(303)
    }
    const blocked = await f.installation.handler(ingress("/auth/login"))
    expect(blocked?.status).toBe(429)
    expect(blocked?.headers.get("set-cookie")).toBeNull()
    expect(provider.calls).toBe(101)
  } finally { await f.close() }
})
