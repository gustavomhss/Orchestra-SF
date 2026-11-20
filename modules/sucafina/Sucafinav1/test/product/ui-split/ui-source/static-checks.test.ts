import { test } from "bun:test"
import { assertStaticOwnership, readStaticProof } from "../../fixture/ci-static-contract.ts"

test("ui-source wires the Sucafina typecheck to the mandatory static job", async () => {
  const proof = await readStaticProof()
  assertStaticOwnership(proof.workflow, proof.prerequisite, "typecheck")
})

test("ui-source wires both guard bases to mandatory fail-closed static verification", async () => {
  const proof = await readStaticProof()
  assertStaticOwnership(proof.workflow, proof.prerequisite, "guards")
})
