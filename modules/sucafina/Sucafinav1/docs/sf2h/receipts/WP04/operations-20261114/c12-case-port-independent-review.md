# Independent source finding — C12 case-port fixture replay

Operations W3 `d7d343ecb2ef4b4ccff925f50a5a60324d22b371` consumes only the `reviewDigestFor` and `revalidateProducer` constructor arguments in `test/product/wp11/case-port.test.ts`. Its resulting blob is `3cfdaf5adbb8abcfe7f90640a56db3f9d733ac56`, from before `4f3680a666c943843d05dad04b065599e42a8e9c`. This closes the missing-property type diagnostic but leaves runtime expectations inconsistent with the consumed producer.

Canonical Finance owner source at `981ad44102b2e2e67d31bfc8fb7d97208e390e5b`, blob `4e01acf909609e40bf9fc5e64c633ea8189c6e8b`, includes two further changes inside the same test, `partial domain execution reconciles a durable receipt and never repeats it on retry`:

1. After the fake domain returns a stored receipt, the expected result becomes `unavailable` with reason `review-proof-unbound`, replacing two `ok` expectations.
2. The case remains `chosen`, version 1, instead of `partially-applied`, version 2.

These changes match the exact newly consumed `product/decisions/apply.ts` owner producer, blob `fed7feb25d9af2fecebba8d2b1d2e2a6b1a3e0ac`: the found-receipt branch reads the persistent transaction indexed by `receiptProofTransactionKey` and denies a missing binding before case reconciliation. This fixture's fake `PreparedApplyPort` writes a domain receipt only; it never creates that binding. The current Operations expectations therefore cannot be satisfied by the new producer on that path. This conclusion is from source inspection, not a locally executed test.

Recommended resolution is to consume those two exact owner hunks together with the already consumed callback line. The remaining Finance changes in this file add case-operation verification and proposal-store scenarios whose producers were not part of the C12 intake; importing the entire file is unnecessary and may expand the dependency closure. No shared product code, contract, grant or policy should be changed to make the old fake-receipt expectation pass.

After composition, revalidate this file in the next surgical hosted Bun selection. Other successful W1 cases retain their own impact classification; the new fixture and producer behavior cannot inherit W1's old pass.

## Resolution by source composition

Root subsequently consumed both related owner hunks. The final proposed fixture blob is `a8348b91ed8eb4483352e449b8bb37aef409b803`, recorded in `c12-fixture-negative-followup.json`. A second independent comparison against the canonical Finance file confirms that the complete C12 scenario now matches; all remaining differences concern the intentionally excluded case-verification and proposal-store dependencies. The source finding is resolved. Hosted proof of the corrected fixture remains required; this addendum does not change the earlier run outcomes.
