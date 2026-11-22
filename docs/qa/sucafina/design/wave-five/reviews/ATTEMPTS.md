# Review and proposal qualification attempts

All runtime execution uses the repository's existing test-ci workflow. Temporary ci-run branches carry only the existing runner selector and an exact shared header/fixture composition. No workflow is changed.

## Attempt 1 — source identity boundary

- Product: `b5d5bfaefce6c85f81f2d4f3ad45cb083a956e1c`
- Snapshot: `693a8e985f556f7fe3eba533f7c4668613d7644a`
- Branch: `ci-run-sf5reviews1`
- [Run 44977715259](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44977715259)
- Test job: `137071223168`; failed. Cleanup job `137072061750`; succeeded.
- Production native bundle built. Original Budget Overview and Portfolio Dashboard review projections both returned HTTP 200 / status ok.
- Failure: the second Add to agenda control remained disabled because both original sections use the same canonical `dashboard` identity. No producer identity was replaced to bypass the condition.
- Correction: preserve the original one-section agenda; verify disabled reorder and meeting-navigation controls, a real preservation preview/confirmation, two original preservations and the comparison between them. Multiple-section ordering is explicitly not qualified.
- Browser diagnostics at failure: no uncaught page errors.
- Two JPEGs extracted from the test's SF_DESIGN_PREVIEW log chunks and manually viewed. The initial source/selection hierarchy is readable. The source filter and Available sections heading needed additional spacing; scoped CSS now supplies that gap. These are failed-attempt evidence, not final acceptance captures.

### Captures

- [Initial agenda](attempt-01/UI47-dark-desktop-initial-selection-test-data.jpg)
- [Failure at the original shared section identity](attempt-01/FAILED-native-wave-three-test-data.jpg)

## Next attempt

Pending the corrected installed journey and original Hot Topic draft seed. The original seed must include a notes string, since the existing producer only publishes an editable draft when all required fields are present. That source field is populated through the existing fixture's DashboardPeople command, without an authorization, identity or receipt patch.
