import { test } from "bun:test"
import { assertStaticOwnership, readStaticProof } from "../../fixture/ci-static-contract.ts"

test("work-reuse assigns typecheck and guard execution to the mandatory static job", async () => {
  const proof = await readStaticProof()
  assertStaticOwnership(proof.workflow, proof.prerequisite, "both")
})
