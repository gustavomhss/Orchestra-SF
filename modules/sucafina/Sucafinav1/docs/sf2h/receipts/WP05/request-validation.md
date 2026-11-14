# WP05 CI request validation

Result: metadata validation passed with exit code 0. No product module or test was imported or executed. No remote action was performed.

Command, from `/workspace/scratch/b9370847f7d4`:

```sh
node ci-prep/validate-wp05-request.mjs
```

Runtime: Node `v24.22.1`, Linux x64. The GitHub workflow's Node setup remains pinned to `24.15`; this local command validates the request metadata using the same source functions.

The harness imports unmodified canonical sources materialized from `b33541ede0fd715fc0990aebeb3fe484d0991cb7`: `parseOptions`, `testPathsAt`, `validateRequest`, `locateTestPackage` and `omniControlScope`, including the real module catalog/resolver. The catalog resolved all 35 registered manifests successfully. Source and manifest hashes are recorded in `ci-run.validation-proof.json`.

| Property | Validated value |
| --- | --- |
| Request artifact | `ci-prep/ci-run.validated.json` |
| Package selector | `packages/sucafina` |
| Normalized package | `sucafina` |
| Resolved directory | `modules/sucafina` |
| Runner | `bun` |
| OS | `linux` |
| Timeout | `120000` milliseconds |
| Omni control scope | `declared` |
| Original tests preserved | 27 |
| Additional tests | 7 |
| Total exact test paths | 34 |
| Path admission | All exist and resolve within the product workspace |
| Request SHA256, pretty JSON plus newline | `8ee2345d98c785d8bdee518c9625e6cf04e4f5926367aae30c5efe6e42748f4c` |
| Request SHA256 after workflow's compact canonical serialization | `5a3cb5e4ee782bb73db35adb975ea4b2d8f3f3b1b78ce8fe796b5559f6e55f8f` |

The seven additional files are `consumer.test.ts`, `factory-selection.test.ts`, `projection-validation.test.ts`, `render-completion-browser.test.ts`, `engine-coverage.test.ts`, `consumer-dashboard.test.ts` and `semantic-discriminants.test.ts`, each selected under `./Sucafinav1/test/product/wp05/`. The helper fixture is not included as a separate test. The 33-file S1 request, validation proof, harness and summary are preserved under `ci-evidence/s1-*`; this request preserves all 33 prior paths and appends the semantic discriminator test.

Node emitted a module-type detection warning for the canonical module catalog; execution succeeded. No canonical source or manifest was changed to suppress the warning.
