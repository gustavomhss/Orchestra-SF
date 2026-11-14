# Dossier consumer finding and owner patch

Status: PREPARED_FOR_ASTRA_COMPOSE, not applied to `operations`, not tested. No claim of a passing check is made for this patch.

Canonical producer: WP09 `1998acb0dcb59e68d41ee924eca4737bccbd5148`, `product/routines/dossier.ts` blob `ed88a6ff4f6c42eecfd80ba13824e8122fcc774e`.

PR26 carries `dossier-services.ts` blob `cbdb8aed51f5c01f147181e968327cc5611d75ed` and `dossier-workbench.ts` blob `e5170c5ef3cc8d18934684dfcd417f142c22d03b`. These two files are absent from the PR23 tree; PR23 supplies its separate business-service dossier preparation.

## Confirmed seam defects

1. The service obtains current authorized `source.value` from the actual `business.sourcingEvidence` producer but drops it. The canonical routine's optional `sourcing` input remains absent, so its proposal-terms section says unavailable despite a successful authorized read. The patch passes those same facts and includes them in the existing second-read material identity fence. It does not infer prices, scoring, FX, eligibility or a selected offer.
2. The canonical routine distinguishes rejected documents without exposing rejected values, but the workbench treats every entry without `.evidence` as inaccessible. The patch displays the explicit rejected state and retains its permitted field/ref metadata, without using a rejected value as a premise.
3. The workbench ignores the canonical explanation, domain ranking, human selection message, proposal terms, next steps and draft conditions/gaps. The patch renders those returned values with `textContent` and no mutation controls. Domain ranking is displayed independently from the producer's recorded human selection; no winner is inferred.

## Verification required after owner composition

- Extend the owned `test/product/wp06/documents/dossier-runtime.test.ts` pending/confirmed/current read expectations with `commercialSources.proposalTerms.status: available`, the exact Request source ref, and `supplierRegister.status: not-selected`. Add a case whose producer returns proposal facts and whose second authorized read changes those facts, verifying the egress fence refuses it.
- Exercise the actual workbench script in a scoped browser fixture with a rejected entry containing no `.evidence`, authorized proposal terms, ranking, recorded/unavailable selection, next steps and gaps. Verify text-only rendering and no POST/Apply/confirmation action.
- Keep the existing actual Request attachment/SQLite/TXT-DOCX-PDF pending→confirmed→source-change→revocation cases selected after the new routine producer is composed.
- Run Sucafina and CLI Bun typechecks and applicable guards through the authorized hosted check. Prior C20/N16/R18/U20 receipts do not qualify this owner patch.

The ownership restriction is why this delta is a reviewable patch rather than a direct host-file edit. Parent/S0 may transfer it to astra-compose; WP06 consumers and tests remain in the operations group's scope.
