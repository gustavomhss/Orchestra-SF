# Case-list operational observation intake

Base: 27a2a5a4de019b6319a1751651ea86a4bf43dd5d. Shared preimages:
- apps/cli/src/sucafina-product/native-ui/decisions.ts: 52b77cbaedbf36880edcbd6fd73ddb61e5472b79
- modules/sucafina/Sucafinav1/local/entry.ts: 7dc7dfc70dc6a0838c593607756a6f6ea2874f6e

Consumer: verify the preimages and integrate the postimages, merging the entry callback with any independently integrated home producer. The observer invokes the actual case-list implementation with the original Request, retaining UI admission, participant-filtered state read, per-case admission/dispatch, list-stability and lease fences. Live context supplies the outer re-admission/stamp fences. Schema validation and binding comparison precede the readiness observation. Empty lists are valid only after the state read succeeds.

Validation NOT RUN. Test fixture covers an empty list and actual UI authority, denial, revocation and source failure; it does not claim production acceptance. Run hosted scoped tests, typecheck and guards before use.
