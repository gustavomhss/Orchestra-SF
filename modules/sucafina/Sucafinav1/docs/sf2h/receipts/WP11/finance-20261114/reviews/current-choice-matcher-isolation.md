# Current-choice: isolate the assertion observation

Candidate test blob: `7a5100d9e60a81f654cc31714efd2b1e7d0b68f5`.
Previous published blob: `35d562e6686b27f5fdad5c88584391d7649571df`.

## Evidence and scope

S18 (`43593276333`, W `29172d2e4db859eedac31e84778c447bb97f6c08`) recorded `DataCloneError` in the coverage observation, then reached the original `choice-preview-coverage-unavailable`. Its canonical reassessment had already passed the baseline/basis identity guard and resolved all three references as fresh. Baseline basis2 and selected basis2 agree. The unclassified source scenario still carries basis1; that difference is not the guard that failed and must not be changed to conceal the error.

The assessment intentionally retains the included entries from `coverage.entries`. The classification keeps separate cloned entries. The test's `toMatchObject` with `expect.arrayContaining` observed this shared entry directly before resimulation. A mutation by the test matcher would therefore contaminate canonical proof data and make the later clone or reassessment fail. This is a specific hypothesis, not yet a runtime-proven cause.

## Change

The existing training assertion now observes an exact `structuredClone` of the entry. Its expected status and contained `training:11` component are unchanged. One additional canonical digest assertion verifies that the entire producer assessment remains unchanged by the matcher. A small diagnostic records the observation digest before/after the matcher, whether its componentRefs remain an array, or the canonical exception if that observation became unsupported.

All 40 original expectations, the 180000ms timeout, financial results, operations, human grants, source revocation/case race checks, durable ChoiceRecord, reopening, and absence of Planner application remain. There is no product, source-provider, basis-version, financial formula or authorization change. No local product execution was performed.

The earlier unpublished extended assessment diagnostic `d72602ff…` is superseded and must not be included. The next parent-dispatched change-scoped Actions run determines both the matcher hypothesis and the full lifecycle result; no READY/DONE or complete criterion acceptance is claimed here.
