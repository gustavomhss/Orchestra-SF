import assert from "node:assert/strict"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import { createPack } from "../../../script/sucafina/create-pack.mjs"
import { runSfGatewayProof } from "./sf-purchase-invoke.node-smoke.mjs"

const root = await mkdtemp(join(tmpdir(), "sf-pack-template-"))
try {
  await assert.rejects(() => createPack("../outside", root), /pack slug/)
  const pack = await createPack("vendor-review", root)
  const skillPath = join(pack, "skills", "sf-read-vendor-review", "SKILL.md")
  const skill = await readFile(skillPath, "utf8")
  await assert.rejects(() => createPack("vendor-review", root), { code: "EEXIST" })
  assert.equal(await readFile(skillPath, "utf8"), skill)
  assert.match(skill, /^name: sf-read-vendor-review$/m)
  assert.ok(skill.includes("sf-vendor-review__sf_read_vendor_review"))
  const server = JSON.parse(await readFile(join(pack, "openclaw-mcp.example.json"), "utf8"))
  assert.equal(server.enabled, true)
  const { gatewayProof } = await import(pathToFileURL(join(pack, "proof.mjs")).href)
  await runSfGatewayProof(gatewayProof)
} finally {
  await rm(root, { recursive: true, force: true })
}
