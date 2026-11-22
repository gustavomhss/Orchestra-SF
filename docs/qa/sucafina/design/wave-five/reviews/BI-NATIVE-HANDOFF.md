# BI native qualification handoff

**The original BI06 boundary and corrected scalar presentation are qualified.** The full installed BI journey passed in native2; a focused BI06 run passed in native3 and supplied the corrected mobile plot framing. This handoff is evidence for user review, not merge approval.

## Integration pointers

- Three production leaf formatter files are unchanged since worker `eaf75a21b3087d3a2a0873220254ed96194feadf`: `bi/finance/scalar.ts` blob4182b427658ef130aa997b7e4294a6d578b60397, `model.ts` blob7fab3f57776f427a466eedcf563bb08110e87fde, `visual.tsx` blobfb11020bed7fdabe947ffe93357d1bc0a227010f (all under `packages/app-shell/src/orchestra/chapters/sucafina/`).
- Permanent `packages/app-shell/e2e/sucafina/design-wave-five-analytics.spec.ts` blob **7d4af62590e256ed9f034fd8a00bbce5694f1c25**. Its Portfolio declaration is byte-identical to analytics94c0de8e8e2016782156507256247a06b0c13ece. Root integrated it at2213d2f216745976bb89d345277726e3a833f1d4.
- Analytics support helper ebbab2a37b7f1fe5b65bbe4595dbc4b12347ae02 was copied exactly for native3 qualification. It was not edited by this agent; global captureModes is unchanged. Only a local BI06 capture action aligns the actual label.
- Four CLI observation-boundary runtime blobs and the seven original-source groups are recorded in [BI06-OBSERVATION.md](BI06-OBSERVATION.md) and [bi06-observation-runs.json](bi06-observation-runs.json). Root owns its later test-only explicit-response guard. Do not overwrite that test with the older worker version.

## Separate qualification receipts

| Scope | Run / test job | Product / snapshot | Outcome |
| --- | --- | --- | --- |
| Original clock/admission/source boundary | [44987754031](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44987754031) /137101943346 | root4d38 + four CLI blobs /6a3438bf8ba98b1c1ff72d0393c6ac00fd67527f | 7 groups,119 assertions PASS |
| First complete installed BI | [44988337151](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44988337151) /137103725904 | 6703cc5ba71709f0616b186383ab63f779c22dfb /9472494bd3fd208f7e80d3e76e500a11960c7d95 | 1 passed4.6m; small-positive display defect found visually |
| Corrected complete installed BI | [44989634639](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44989634639) /137107669401 | 22f0eae12c4bb42684cc28b35d10f35ac3243b71 /74d1de6ad2454712d1d430a9165b17f9cecf1051 | 1 passed3.9m; display fixed; one inspected mobile plot crop superseded |
| Focused BI06/mobile capture | [44990477521](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44990477521) /137110210773 | 01ced03042f396941902820487db67cf469336c4 /fa6b988e79c820886ad80f32e66a3ed664ad83c4 | 1 passed3.2m; five selected images approved |
| App, permanent E2E and CLI types (root report) | [44989840123](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44989840123) /137108269511 | 796c7f27634dca55e25087cb44d1a0fe45a06cf9 /b4896d460a32549f0eb37be3c21564968fd2cda9 | 3/3 PASS, zero diagnostics, three Omni spawns; before capture-only7d4 delta |

All three native workflows and their cleanup jobs succeeded. Every recorded source response body was native; no readback fallback was used. These are composed receipts with distinct scopes, not one all-green omnibus run.

## What the installed journey proves

BI01 retains its36 original rows,14 numeric and22 missing values. Two distinct value IDs sharing an original reference were resolved with their exact value/digest queries. The source URL owner binding and original labels were checked. A period edit removed the old projection and navigation. The original BI11 sensitivity catalog had zero choices; no result was invented.

BI06 now returns200 from its original C16 path and from its original source-link handler. A wrong digest still returns403 `bi-source-outside-selected-value`. The original EN and Portuguese ages differ because separate invocations retain their own real original observation times. In native3 the source0.0014994675925925926 days rendered0.00149947; later source0.0016391550925925927 rendered0,00163916. DOM assertions check sign/nonzero, integer equality or relative error at most1e-5, plot/table agreement, and the exact original unit. Source values, units, labels, missing evidence and receipts are unchanged.

No source producer, codec, grant, guard, workflow or original English catalog value was changed by the scalar display correction. No report was published, notification sent or external message sent. Both language sessions reported no page/console errors. The deliberately unchanged readForReview boundary remains documented in the observation note.

## Persistent captures versus visual review

- Native1: **32 JPEGs saved**, diagnostic history. Seven were manually viewed, including the defective positive-age display; no native1 image is used as the final corrected gallery.
- Native2: **40 JPEGs saved**. This reviewer manually saw13: **12 approved for their represented state**, and one bad light320 plot crop. The bad crop is explicitly excluded from approval. The other27 have no manual-review claim from this reviewer.
- Native3: **17 JPEGs saved**, same production runtime as native2. This reviewer manually saw and approved **5**; the other12 have no manual-review claim.
- **89 complete JPEG chunk sets persisted**, with exact blob identities and original names in the three manifests. Canonical PNG artifacts have expiry dates. The source-produced test data is identified as test data throughout.

The root reviewer independently confirmed native2 dark desktop table, dark320 table and pt-BR desktop precision. The analytics reviewer independently inspected ten native2 images and maintains their own ledger. Their review is not silently substituted for this agent's manual flags.

## Selected approved images

Each link below was opened as an actual JPEG with the image tool by design_reviews. The native2 unit-column view remains valid for that state; use native3 for the final aligned mobile plot.

| State | Attempt | Image |
| --- | --- | --- |
| UI45 catalog — dark desktop | 2 | [JPEG](bi-native-attempt-02/UI45-question-catalog-dark-desktop-test-data.jpg) |
| UI45 catalog — light desktop | 2 | [JPEG](bi-native-attempt-02/UI45-question-catalog-light-desktop-test-data.jpg) |
| UI45 catalog — light320 | 2 | [JPEG](bi-native-attempt-02/UI45-question-catalog-light-320-test-data.jpg) |
| BI01 original values — light320 after horizontal scroll | 2 | [JPEG](bi-native-attempt-02/UI46-financial-original-values-light-320-scrolled-values-test-data.jpg) |
| BI01 original table and source limitations — light desktop | 2 | [JPEG](bi-native-attempt-02/UI46-financial-source-table-light-desktop-test-data.jpg) |
| BI06 values, days and source references — dark desktop | 2 | [JPEG](bi-native-attempt-02/UI46-operations-original-table-dark-desktop-test-data.jpg) |
| BI06 positive table values — dark320 | 2 | [JPEG](bi-native-attempt-02/UI46-operations-dark-320-test-data.jpg) |
| BI06 resolved original Procurement source | 2 | [JPEG](bi-native-attempt-02/UI46-operations-resolved-original-source-test-data.jpg) |
| BI11 original empty sensitivity selection | 2 | [JPEG](bi-native-attempt-02/UI46-source-empty-sensitivity-catalog-test-data.jpg) |
| UI45 catalog — pt-BR desktop | 2 | [JPEG](bi-native-attempt-02/UI45-pt-BR-dark-desktop-catalog-test-data.jpg) |
| BI06 localized decimal comma — pt-BR desktop | 2 | [JPEG](bi-native-attempt-02/UI46-pt-BR-dark-desktop-operations-test-data.jpg) |
| BI06 original days and period — pt-BR320 scrolled table | 2 | [JPEG](bi-native-attempt-02/UI46-pt-BR-dark-320-operations-scrolled-units-test-data.jpg) |
| BI06 numeric labels inside viewport — dark390 | 3 | [JPEG](bi-native-attempt-03/UI46-operations-original-values-dark-390-scrolled-values-test-data.jpg) |
| BI06 numeric labels inside viewport — light320 | 3 | [JPEG](bi-native-attempt-03/UI46-operations-original-values-light-320-scrolled-values-test-data.jpg) |
| BI06 scalar values and original units — light desktop | 3 | [JPEG](bi-native-attempt-03/UI46-operations-original-table-light-desktop-test-data.jpg) |
| BI06 localized numeric labels inside viewport — pt-BR320 | 3 | [JPEG](bi-native-attempt-03/UI46-pt-BR-dark-320-operations-scrolled-values-test-data.jpg) |
| BI06 original days and period — pt-BR320 scrolled table | 3 | [JPEG](bi-native-attempt-03/UI46-pt-BR-dark-320-operations-scrolled-units-test-data.jpg) |

## Artifact provenance

| Attempt | Artifact | SHA-256 |
| --- | --- | --- |
| native1 |14740533334|1c0a901f3105f2bb36fd3739fe94b256176a427aed37319db1c2effdbbd35e5f|
| native2 |14741277986|f16fede2b526ac20fb6569a9614168bc37b0dbc7e8a4ffa4d5e43179c3311a70|
| native3 |14741114781|48e8b3677bed1e256f53c148887acd19304ca7feca583c57a366d3f0d5c0c577|

The three directory manifests preserve snapshot, parent product, spec/overlay identity, source acquisition, exact viewport, captured state, complete chunk counts and manual-review status. The broader Analytics gallery remains owned by the analytics agent.
