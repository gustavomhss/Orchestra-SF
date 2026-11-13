# WP05: producer boundary and surgical evidence

Source audited: `b33541ede0fd715fc0990aebeb3fe484d0991cb7` in `gustavomhss/Orchestra-SF`. Product files cited below are read-only dependencies. The new WP05 tests have not been executed locally; their assertions require GitHub Actions evidence before being called PASS.

## Added evidence

`test/product/wp05/engine-fixture.ts` builds synthetic source data and invokes the published Planner port, stored-scenario resolver, criterion registry, canonical criterion metric, canonical exact solver, sensitivity evaluator, C08 result store and protected criterion bindings. It uses a physical `openLocalStore` and the real `createSfUiAuthority` admission registry. Authorization, source and evidence callbacks remain fixture host boundaries. This is not GNATIVE/provider execution evidence.

`test/product/wp05/engine-coverage.test.ts` asks the real producers to demonstrate:

- Renewal 240000 and transition 210000, with the canonical cost delta -30000.
- The canonical exact solver's IEEE boundary near 55000, independently of the integrated sensitivity gate; real preview at 55000 yields 220000 / -20000, and 55001 yields -19999.
- A source without a training component or classification derives `missing-category`, with no invented zero.
- An independent source including training 40000 yields 250000 / +10000 cost delta and the canonical threshold near 15000. The same canonical comparator, with transition as baseline and renewal as alternative, yields the pack's advantage +30000 then -10000. No test-side financial formula computes these values.
- Persisted C08 scenarios, comparisons and sensitivity are consumed unchanged by the WP05 stored BI adapter. Old persisted results remain unchanged when reading the independent revised fixture.

These are producer and adapter checks. The two source variants are independent physical fixtures, not a demonstrated human confirmation command mutating the same case. They do not establish a ChoiceRecord update/reconsideration path or the complete live chart/table workflow.

`sensitivity-integration.test.ts` retains every prior assertion, including rendered EUR/USD axes, unavailable threshold, persisted result reference and stale-after-rule-revision behavior. Its missing external fixture import is replaced by the WP05-owned real-producer fixture.

## Blocker A: integrated exact sensitivity cannot be reached

- `product/planner/scenario-port.ts` always returns a preview with `comparisonStatus: conditioned`, `total: null`, and scenario coverage pending (or unavailable), adding `scenario-coverage-reassessment-required`.
- `product/planner/preview-comparison.ts` explicitly rejects a sample unless it is conditioned, has total null and coverage not complete. Its returned comparison and metric are conditioned.
- `product/portfolio/planner-sensitivity.ts` sets `sample.complete` only when the comparison is complete and its coverage complete. It invokes the supplied exact-threshold solver only when every sample is complete and the baseline/selected source coverage is complete. No output accepted by the published preview port satisfies that requirement.
- `finalizePlannerSensitivity` in the same file preserves a conditioned comparison and describes a sampled interval when there is a sampled transition. It does not publish the direct canonical solver's 55000 as an exact financial decision threshold.

Therefore `WP05.T05.CHK.01` and the full positive acceptance in `sf-avaliar-sensibilidade` cannot be marked accepted through the integrated port merely because the direct exact solver passes. The WP05 adapter must consume the producer's conditioned result. Changing or bypassing the producer gate is outside WP05 ownership.

## Blocker B: shared components across cost categories

The pack's AI-RENEWAL counting rule permits the same unique implementation component to cover implementation, migration, training and part of taxes, while contributing 45000 once. The renewal component similarly covers service and taxes.

At the seed, `product/decisions/cost-coverage.ts` (`assessCostCoverage`) flattens every included category's componentRefs and emits `uncategorized-component` whenever a component appears a count other than exactly one. Thus a correctly classified component reused across two supported categories is treated as unresolved. `validateScenarioCoverage` repeats the exactly-one restriction for a complete assessment.

The new coverage test uses Planner-produced components, the real `classifyCoverage` / `supportsCoverageClassification`, and explicit synthetic applicability statements for nonapplicable categories. All category entries can be supported and the missing-category list empty while the real assessor remains pending due to `uncategorized-component`. This is a characterization of the upstream mismatch, not a substitute positive acceptance assertion.

This blocks claiming the pack's financially complete AI-RENEWAL and confirmed-training case, and the complete integrated `WP05.T05.CHK.20`, `DOD.20`, `CMP.20`, `SUC.20`. WP05's safe behavior for pending data and unchanged C08 consumption can still be tested independently.

## Contract/host dependencies already identified

The seed lacks WP00's `BiPresentation`, `BiViewId`, `SfBiArtifact` and decision `sensitivityResultRef` contracts/schema. The current WP00 branch was observed to publish them at `72342f0efbbe099231aa2e30a964769b14e4fbb2`; integrating that owner dependency is separate from changing WP05.

The seed live `product/integration/bi-http.ts` is dashboard/UI only. Component adapters, real UI admission and fixture callbacks do not establish a GNATIVE dispatch or consumer route for all BI views. Root owns the exact delta/PR wording and must keep these boundaries explicit.
