# C08 projection: held, not an integration release

This complete patch is preserved for the actual host-binding and Decisions owners, through57. It was **not applied, typechecked, or executed**. Its pre/post bytes reconstruct exactly, but static review found observable behavior changes. Do not apply it as a qualified fix.

The original whole-state clone can fail or invoke getters in unselected fields; the projection can omit those effects. It can also select a case before a stored-result getter changes `caseRef.id`, whereas the original selector runs after cloning. The changed malformed-envelope guard has a separate behavioral difference. Frozen context does not establish whole-state plain-data provenance after authorization.

The full review is in `../../review/CAUSAL-STATIC.json`. No speedup has been measured, and no P03 result qualifies this proposal. Its presence in receipts conveys a complete rejected hypothesis and the exact work the owner must reconsider; it conveys no authority to change foreign paths.
