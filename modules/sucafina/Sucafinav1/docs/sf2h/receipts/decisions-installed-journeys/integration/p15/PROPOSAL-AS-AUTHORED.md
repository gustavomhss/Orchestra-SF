# P15 — one-shot SHA256 proposal

## Verdict

The measured canonical digest bucket justifies one narrow owner proposal: replace the per-call `new Bun.CryptoHasher("sha256").update(...).digest("hex")` chain with `Bun.CryptoHasher.hash("sha256", canonicalSfValue(value), "hex")`. The serializer and every caller remain byte-identical. This is an inert two-path proposal: one shared product line and one owned surgical unit gate. No performance, nominal acceptance or release is claimed before hosted qualification.

P14's proposed historical-reader wrapper remains HOLD and is absent from this patch. D18 measured only 402.058 ms in the two historical-result calls. Even removing that entire measured cost would be an ideal upper bound, not the result a wrapper would achieve.

## Actual D18 measurement

Run `43688075463`, profile input 1 / choose ordinal 4, measured the complete existing HTTP handler at **8129.195 ms**. It emitted start and end, no server abort event, and all measured calls settled. These are diagnostic observations; the run's four passing UI cases cannot be transferred into nominal acceptance.

| Bucket | Settled calls | Inclusive ms | Relative to handler elapsed |
|---|---:|---:|---:|
| `choice.compare` | 1 | 5020.346 | 61.76% |
| `choice.stored-result` | 2 | 402.058 | 4.95% |
| `choice.values` | 1 | 2231.263 | 27.45% |
| `choice.save` | 1 | 208.745 | 2.57% |
| `choice.capture` | 1 | 65.242 | 0.80% |
| `canonical.digest` | 195,778 | 3491.585 | 42.95% |
| `runtime.currentAccessSnapshots` | 7,749 | 1273.010 | 15.66% |
| `runtime.auth.read` | 83,772 | 629.535 | 7.74% |

These durations overlap. `choice.capture` is inside `choice.save`; hash, snapshot and auth work may occur within the higher-level choice stages. Their sum is not an exclusive wall-time breakdown. The digest bucket includes the unchanged canonical serialization as well as SHA256. D18 does not separate those two costs, and the proposed native-call reduction cannot be credited with the entire digest bucket.

The comparison and value-resolution stages account for most observed choice work. The P9 capture itself measured 65.242 ms inside the 208.745 ms save path. This evidence does not support attributing the earlier request abort to capture or treating source capture as optional.

## Exact preservation and native evidence

Product path: `modules/sucafina/Sucafinav1/product/contracts/canonical.ts`.

- Preimage: `1769271386cdda1017c38023b0988ce2d64423d2`.
- Postimage: `576199437a21a5d094da7db7601e78dcf01bce82`.
- Removing the single replacement line recovers the complete preimage. `canonicalSfValue`, the private tagged canonical traversal, evidence helpers and all other product text are unchanged.
- No shared hasher is retained. Every call observes the current value, produces the same canonical string, then calculates a fresh SHA256 result. There is no digest, identity, snapshot, role or ACL cache.
- No authentication, revalidation, comparison, mutation, abort or transaction guard changes.

Official Bun 1.3.13 commit `bf2e2cecf27e800962b1e7f03d66278f9d5d2e79` and 1.3.14 commit `0d9b296af33f2b851fcbf4df3e9ec89751734ba4` both declare the exact three-argument static overload returning a string. The full sources and type excerpts are pinned in `evidence/provenance.json`.

The native static implementation obtains SHA256 through the existing EVP selector, hashes the supplied string and uses the existing hex encoder. It does not construct the JS/native CryptoHasher instance (`CryptoHasher.new`) used by the previous constructor path. Its EVP state is disposed before return. The two versions' CryptoHasher sources differ only in an import path outside these methods; the EVP source is byte-identical. This identifies a concrete allocation and native-call reduction. It does not prove a speedup on the installed workload.

The actual Bun version must come from the hosted job; the gate prints `Bun.version`. The parent has separately verified Unit05 used `bun test v1.3.14 (0d9b296a)` and the current target still has the exact canonical preimage. That readback is `m52-audit/P15-base-preimages-read.json`.

## Surgical gate

New owned path: `modules/sucafina/Sucafinav1/test/product/decisions-installed-journeys/canonical-digest-once.test.ts`.

Static expansion is 36 cases and 154 expect calls: 17 fixed byte vectors, 11 existing rejections and 8 additional controls. The tests import the actual production serializer and digest. They compare with independent `node:crypto` SHA256 and fixed canonical bytes. The only previous implementation retained in the test is the three-call hash expression; the canonical algorithm is not copied.

Controls cover Unicode, lone surrogates, escaping, negative zero, finite limits, key order, sparse arrays versus explicit undefined, null prototypes, unselected keys, sorted getter/proxy observations, reentrant hashing, in-place source/role/identity changes, propagated getter exceptions and cyclic rejection. Fixture restoration captures the actual original versions instead of assuming a role version.

The eight-value measurement corpus uses real product contract shapes, the production evidence-digest producer and actual role-map factory. It has two record references, three surface role maps, two value arrays and binding metadata. These are unit fixtures; they do not grant access or seed an installed journey.

The hosted measurement uses six alternating old/new and new/old pairs, 128 fixed rounds over the same eight current values per sample: 6,144 measured calls per implementation and 128 warm-up calls each. Every measured call performs serialization again. There are no timer-dependent work counts, sleeps, timeout overrides or speed assertions. Output is limited to Bun version, counts, total durations, ratios and sample durations. The intended overhead is well below three seconds, but actual duration must be observed on Actions.

A lower ratio on this uniform corpus does not establish the installed workload's distribution or margin. The unchanged five-case nominal UI suite remains necessary for acceptance. A slower or inconclusive microcomparison must be reported honestly; the proposal has no permission to increase UI or test budgets.

## Artifacts and status

`material.json` contains complete pre/post content for both files. `complete.patch` reconstructs them forward and backward exactly, recorded in `reconstruction.json`. `static-preservation.json` records the one-line preservation proof. All evidence here is text analysis or D18 artifact analysis. No product, test or benchmark was executed locally; no source, target or workflow was changed remotely.
