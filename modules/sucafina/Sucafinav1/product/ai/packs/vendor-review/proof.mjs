import assert from "node:assert/strict"
import { registerTool } from "./mcp/index.ts"

const refs = { A: "SUP-09001", B: "SUP-09002" }
const suppliers = {
  A: { ref: refs.A, legalName: "Fornecedor Sintético A", status: "active" },
  B: { ref: refs.B, legalName: "Fornecedor Sintético B", status: "pending" },
}

export const gatewayProof = {
  pack: new URL("./", import.meta.url),
  serverId: "sf-vendor-review",
  requestKey: "recordRef",
  refs,
  register(server, schemas, actor, observe) {
    registerTool(server, schemas, async (ref) => {
      observe(ref)
      if (refs[actor] === ref) return { ...suppliers[actor], bankAccount: "never-returned" }
    })
  },
  assertOwn(payload, actor) {
    assert.deepEqual(payload, { status: "ok", supplier: suppliers[actor] })
  },
}
