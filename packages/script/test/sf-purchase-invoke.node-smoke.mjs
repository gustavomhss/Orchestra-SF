import assert from "node:assert/strict"
import { spawn, spawnSync } from "node:child_process"
import { randomBytes } from "node:crypto"
import { once } from "node:events"
import { cp, mkdtemp, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises"
import { createServer as httpsServer } from "node:https"
import { createServer as netServer } from "node:net"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { setTimeout as delay } from "node:timers/promises"

const directory = await mkdtemp(join(tmpdir(), "sf-purchase-invoke-"))
const plugin = "sf-purchase-gateway"
const tool = "sfcompras__sf_comparar_compra"
const upstreamTool = "sf_comparar_compra"
const refs = { A: "PR-2026-0901", B: "PR-2026-0902" }
const actors = Object.keys(refs)
const secrets = actors.map(() => randomBytes(32).toString("hex"))
const profileTokens = Object.fromEntries(actors.map((actor, index) => [actor, secrets[index]]))
const excludedToken = randomBytes(32).toString("hex")
secrets.push(excludedToken)
let excludedRequests = 0
let upstreamRequests = 0
const calls = []
const gateways = []
let upstream

function run(file, args) {
  const result = spawnSync(file, args, { cwd: directory, stdio: "inherit", timeout: 600_000 })
  if (result.error) throw result.error
  assert.equal(result.status, 0, `${file} failed`)
}

async function listen(server) {
  const listening = once(server, "listening")
  server.listen(0, "127.0.0.1")
  await listening
  return server.address().port
}

async function close(server) {
  server.closeAllConnections?.()
  await new Promise((resolve) => server.close(resolve))
}

try {
  // Pin the Gateway and SDK used in the VM proof. Keep all installation and state inside the fixture.
  run("npm", ["install", "--no-fund", "--no-audit", "--ignore-scripts", "openclaw@2026.8.1", "@modelcontextprotocol/sdk@1.30.0"])
  const module = createRequire(join(directory, "package.json"))
  const { Server } = module("@modelcontextprotocol/sdk/server/index.js")
  const { StreamableHTTPServerTransport } = module("@modelcontextprotocol/sdk/server/streamableHttp.js")
  const { CallToolRequestSchema } = module("@modelcontextprotocol/sdk/types.js")
  const packagePath = join(directory, plugin)
  await cp(new URL("../../../modules/sucafina/Sucafinav1/product/ai/packs/procurement/gateway", import.meta.url),
    packagePath, { recursive: true })

  run("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1",
    "-subj", "/CN=127.0.0.1", "-addext", "subjectAltName=IP:127.0.0.1", "-keyout", "key.pem", "-out", "ca.pem"])
  upstream = httpsServer({
    key: await readFile(join(directory, "key.pem")),
    cert: await readFile(join(directory, "ca.pem")),
  }, async (request, response) => {
    upstreamRequests++
    if (request.headers.authorization === `Bearer ${excludedToken}`) excludedRequests++
    const actor = actors.find((key) => request.headers.authorization === `Bearer ${profileTokens[key]}`)
    if (!actor || request.url !== "/sucafina/api/claw/mcp" || request.method !== "POST") {
      response.writeHead(403).end()
      return
    }
    const server = new Server({ name: "sf-purchase-fixture", version: "1" }, { capabilities: { tools: {} } })
    const transport = new StreamableHTTPServerTransport({ enableJsonResponse: true })
    server.setRequestHandler(CallToolRequestSchema, async ({ params }) => {
      assert.equal(params.name, upstreamTool)
      const ref = params.arguments?.requestRef
      calls.push([actor, ref])
      const own = refs[actor] === ref
      const payload = own ? { status: "ok", comparison: { proposals: ["P1", "P2", "P3"] } } : { status: "denied" }
      return { content: [{ type: "text", text: JSON.stringify(payload) }], isError: !own }
    })
    try {
      await server.connect(transport)
      await transport.handleRequest(request, response)
    } finally {
      await server.close()
    }
  })
  const upstreamUrl = `https://127.0.0.1:${await listen(upstream)}/sucafina/api/claw/mcp`

  const profiles = [...actors.map((actor) => ({ actor, excluded: false })), { actor: "B", excluded: true }]
  for (const { actor, excluded } of profiles) {
    const reservation = netServer()
    const port = await listen(reservation)
    await close(reservation)
    const profile = join(directory, excluded ? "B-excluded" : actor)
    const workspace = join(profile, "workspace")
    const config = join(profile, "openclaw.json")
    await mkdir(workspace, { recursive: true })
    const token = randomBytes(32).toString("hex")
    secrets.push(token)
    const profileConfig = {
      gateway: { mode: "local", bind: "loopback", port, auth: { mode: "token" } },
      agents: {
        defaults: { workspace, heartbeat: { every: "0m" } },
        entries: { maestro: { name: "Maestro", tools: { profile: "minimal", alsoAllow: [tool] } } },
        ownership: "explicit",
      },
      mcp: { servers: { sfcompras: {
        enabled: true, url: upstreamUrl, transport: "streamable-http",
        headers: { Authorization: "Bearer ${SF_CLAW_PURCHASE_TOKEN}" },
        toolFilter: { include: [upstreamTool], ...(excluded ? { exclude: ["*"] } : {}) },
      } } },
      tools: { deny: ["exec", "browser", "message"] },
      plugins: { allow: [plugin], load: { paths: [packagePath] }, entries: { [plugin]: { enabled: true } } },
      discovery: { mdns: { mode: "off" } },
    }
    await writeFile(config, JSON.stringify(profileConfig))

    const gateway = spawn(process.execPath, [join(directory, "node_modules/openclaw/openclaw.mjs"), "gateway", "run"], {
      cwd: directory,
      env: {
        PATH: process.env.PATH,
        HOME: profile,
        OPENCLAW_STATE_DIR: profile,
        OPENCLAW_CONFIG_PATH: config,
        OPENCLAW_GATEWAY_TOKEN: token,
        SF_CLAW_PURCHASE_TOKEN: excluded ? excludedToken : profileTokens[actor],
        NODE_EXTRA_CA_CERTS: join(directory, "ca.pem"),
      },
      stdio: ["ignore", "pipe", "pipe"],
    })
    const stopped = once(gateway, "close")
    gateway.output = ""
    for (const stream of [gateway.stdout, gateway.stderr])
      stream.on("data", (chunk) => { gateway.output = (gateway.output + chunk).slice(-8_000) })
    gateways.push({ gateway, stopped })

    const url = `http://127.0.0.1:${port}`
    let ready = false
    for (let attempt = 0; attempt < 120 && gateway.exitCode === null; attempt++) {
      ready = await fetch(`${url}/health`, { signal: AbortSignal.timeout(1000) })
        .then((response) => response.ok, () => false)
      if (ready) break
      await delay(500)
    }
    assert.ok(ready, `Gateway ${actor} failed to start`)

    const invoke = (ref, auth = token) => fetch(`${url}/tools/invoke`, {
      method: "POST",
      headers: { Authorization: `Bearer ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify({ tool, agentId: "maestro", args: { requestRef: ref } }),
      signal: AbortSignal.timeout(65_000),
    })
    const unauthorized = await invoke(refs[actor], "invalid-fixture-token")
    assert.equal(unauthorized.status, 401)
    await unauthorized.body?.cancel()
    if (excluded) {
      const response = await invoke(refs[actor])
      assert.equal(response.status, 200)
      const { result } = await response.json()
      assert.equal(result.isError, true)
      assert.deepEqual(JSON.parse(result.content[0].text), { status: "unavailable" })
      continue
    }
    for (const target of actors) {
      const response = await invoke(refs[target])
      assert.equal(response.status, 200, `Gateway ${actor} / ${target}: ${await response.clone().text()}`)
      const body = await response.json()
      assert.equal(body.ok, true)
      const result = body.result
      const payload = JSON.parse(result.content[0].text)
      assert.equal(result.isError, actor !== target)
      if (actor === target) {
        assert.equal(payload.status, "ok")
        assert.equal(payload.comparison.proposals.length, 3)
      } else {
        assert.deepEqual(payload, { status: "denied" })
      }
    }
    if (actor === "B") {
      profileConfig.mcp.servers.sfcompras.enabled = false
      const nextConfig = config + ".next"
      await writeFile(nextConfig, JSON.stringify(profileConfig))
      await rename(nextConfig, config)
      const applied = "config hot reload applied (mcp.servers.sfcompras.enabled)"
      for (let attempt = 0; attempt < 80 && !gateway.output.includes(applied); attempt++) await delay(250)
      assert.ok(gateway.output.includes(applied), "Gateway failed to apply the MCP disable without restarting")

      const before = upstreamRequests
      const response = await invoke(refs[actor])
      assert.equal(response.status, 200)
      const { result } = await response.json()
      assert.equal(result.isError, true)
      assert.deepEqual(JSON.parse(result.content[0].text), { status: "unavailable" })
      assert.equal(upstreamRequests, before)
    }
  }
  assert.equal(excludedRequests, 0)
  assert.deepEqual(calls, actors.flatMap((actor) => actors.map((target) => [actor, refs[target]])))
  console.log("Gateway /tools/invoke: 4/4 MCP cases passed; invalid credentials, excluded tool and live disable rejected.")
} catch (error) {
  const diagnostics = gateways.map(({ gateway }) => gateway.output).join("\n")
  if (diagnostics) console.error(secrets.reduce((text, secret) => text.replaceAll(secret, "[redacted]"), diagnostics))
  throw error
} finally {
  for (const { gateway } of gateways) gateway.kill("SIGTERM")
  await Promise.all(gateways.map(({ stopped }) => stopped))
  if (upstream) await close(upstream)
  await rm(directory, { recursive: true, force: true })
}
