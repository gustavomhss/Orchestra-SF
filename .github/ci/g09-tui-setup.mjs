// Fixture setup only: use the frozen producer's configuration implementation.
// This does not execute/rebuild the product or attest a TUI result.
import assert from "node:assert/strict"
import { mkdir, writeFile } from "node:fs/promises"
import { isAbsolute, join } from "node:path"
import { pathToFileURL } from "node:url"

assert.equal(process.env.GITHUB_ACTIONS, "true", "This fixture runs only in GitHub Actions")
assert.equal(process.env.SOURCE_REVISION, "3ef84da65d6b8ad7cd3250412bbcabdf90924172")
const source = process.env.SF_G09_SOURCE_DIR
const root = process.env.CI_RUNTIME
const port = process.env.CI_PORT
const proof = process.env.CI_PROOF
assert(source && isAbsolute(source) && root && isAbsolute(root))
assert(port && /^\d+$/.test(port) && Number(port) > 0 && Number(port) <= 65535)
assert(proof && /^[0-9a-f]{64}$/.test(proof))
const load = (path) => import(pathToFileURL(join(source, path)).href)
const [{ prepareLocalConfiguration }, { default: freeze }, { sfHumanActions }] = await Promise.all([
  load("modules/sucafina/Sucafinav1/runtime/local-configuration.ts"),
  load("modules/sucafina/Sucafinav1/product/contracts/freeze-v1.json"),
  load("modules/sucafina/Sucafinav1/product/integration/human-authority.ts"),
])
const directory = join(root, "installation")
const workspaceDirectory = join(root, "workspace")
const file = await prepareLocalConfiguration(directory)
await mkdir(workspaceDirectory, { mode: 0o700 })
await writeFile(file, JSON.stringify({
  version: 1, deployment: "azure-https", authentication: "microsoft",
  origin: "https://sf.example.test", listenerOrigin: "http://127.0.0.1:" + port,
  ingressOrigin: "http://sf-ingress.example.test:" + port, mount: "/sucafina",
  tenantId: "11111111-1111-4111-8111-111111111111", clientId: "22222222-2222-4222-8222-222222222222",
  workspaceDirectory, teams: "direct",
  enabledTeamIds: ["44444444-4444-4444-8444-444444444444", "44444444-4444-4444-8444-444444444445"],
  groups: {
    dashboard: { admin: "group:55555555-5555-4555-8555-555555555555" },
    planner: { admin: "group:55555555-5555-4555-8555-555555555555" }, procurement: {},
  },
  grants: [{
    principalRef: "33333333-3333-4333-8333-333333333333",
    namespaces: ["cases", "preferences", "atlas", "outbox", "bi-artifacts"],
    operations: freeze.operations.map((entry) => entry.operation), humanActions: sfHumanActions,
  }], scanner: null,
}) + "\n")
await writeFile(join(directory, "client-secret.txt"), "hosted-ci-only", { flag: "wx", mode: 0o600 })
await writeFile(join(directory, "ingress-secret.txt"), proof, { flag: "wx", mode: 0o600 })
console.log("G09_TUI_FIXTURE_CONFIGURED: synthetic Entra transport; product configuration implementation reused")
