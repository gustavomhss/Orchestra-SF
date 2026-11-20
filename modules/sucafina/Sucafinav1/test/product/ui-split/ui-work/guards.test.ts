import { test } from "bun:test"
import { assertStaticOwnership, readStaticProof } from "../../fixture/ci-static-contract.ts"

test("ui-work guard wiring preserves both bases and rejects every non-success static result", async () => {
  const proof = await readStaticProof()
  assertStaticOwnership(proof.workflow, proof.prerequisite, "guards")
})
