import assert from "node:assert/strict"
import { registerContractReview } from "./mcp/index.ts"

const refs = { A: "CT-09001", B: "CT-09002" }
const contracts = {
  A: { ref: refs.A, title: "Contrato Sintético A", vendor: "Fornecedor Sintético A", endsOn: "2027-06-30", renewalType: "fixed" },
  B: { ref: refs.B, title: null, vendor: "Fornecedor Sintético B", endsOn: "2027-12-31", renewalType: "auto" },
}

export const gatewayProof = {
  pack: new URL("./", import.meta.url),
  serverId: "sf-contract-review",
  requestKey: "recordRef",
  refs,
  register(server, schemas, actor, observe) {
    registerContractReview(server, schemas, async (ref) => {
      observe(ref)
      if (refs[actor] === ref) return { ...contracts[actor], notes: "never-returned" }
    })
  },
  assertOwn(payload, actor) {
    assert.deepEqual(payload, { status: "ok", contract: contracts[actor] })
  },
}
