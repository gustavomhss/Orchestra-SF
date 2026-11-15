# External candidate89: canonical equality without redundant cryptographic hashing

Preimage `086c0100a39525f5d78f5864ad589e2d72fc40cd` confirmed on `sf2-stack@eecbdacb21734695094332deb6142aa35d5c9c3c`. No modification of the producer outside89 authority.

The validated bounded diagnostic **run 43677538070, job 132700853984** measured **1,272 SHA256 digests / 5,894ms synchronous exclusive** in `operation-verifier.ts:94` on final replacement equality (96+324+216 calls per side). Each pair produces two canonical strings before hashing; comparison of the **same canonical strings** avoids SHA256 work while keeping source and other check callbacks, the initial and final independently read replacement entries, and every semantic field.

Candidate patch `OPERATION-VERIFIER89.patch`, plus exact complete pre/post source files for owner review. This is an optimization **proposal**, not a proved saving or original P03 closure. All 72 assertions and 180,000ms budget remain unchanged. If no measurable improvement in a bounded identical workload, reject the patch and investigate snapshot/C08 under state-provider owner. Other unowned hotspot: `state-provider.ts:65` 2,104 clones ~6,545ms exclusive in the same 39.4s diagnostic; no unsafe projection or clone skipping was applied.

Tests: existing `historical-batch-fences`, `calculation-sources`, `read-before-bind`, original P03 only after material causal gain; strengthen getter/unsupported/canonical collisions controls. Require CI45 run, source/tree, independent reviewer, owner acceptance. `GLOBAL_RELEASE=false`.
