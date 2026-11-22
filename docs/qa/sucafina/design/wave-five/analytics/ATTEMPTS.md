# Analytics qualification attempts

This ledger preserves failed execution and the exact scope of the evidence. No screenshot in this folder is an approval or a fabricated result. Images are original Chromium screenshots from the installed native UI, decoded from the existing bounded preview log; the full canonical PNGs remain in the Actions artifact.

## Attempt 1 — diagnostic production bundle, development channel

- Source composition: `6931e774b963a2a8ab7a07e2fb89e9d777fdae2e`.
- Test snapshot: `00d145b52dedd28d3d1bedd06faf1e418e325097`.
- Branch: `ci-run-sf5analytics2`.
- [Run 44978115976](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44978115976), job `137072448099`, attempt 1.
- Existing workflow: `.github/workflows/test-ci.yml`; existing `e2e/playwright.production.config.ts`.
- Environment requested `ORCHESTRA_EXPERIMENTAL_OMNI_SPAWNER=strict`. It omitted `ORCHESTRA_CHANNEL=prod`; the screenshots show the development channel badge. This attempt proves neither the production channel nor completed UI42–UI46 journeys.
- Result: both grouped tests failed; no retries. The source fixture and original one-use enrollment completed for both installations. No page or console errors were observed.
- [Canonical artifact 14736393406](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44978115976/artifacts/14736393406): `playwright-ubuntu-24.04-1`, 5,747,526 bytes, SHA-256 `64391944d8bfb92f39861e467a0d7aa0c3da4243837f566cfda62c686e859a9d`.

### Observed failures

UI42's two independent original `decision-controls` reads returned HTTP 200 and `status:ok`; the fixture exposed two cases and two conditioned alternatives. The native page then displayed the preserved authority error and no case list. Its original readiness helper required the whole resource to be ready, even when the exact controls operation was independently ready in a partially available resource. The integration owner corrected that narrow adapter gate in `c75a561ed9fa634cc4fc7d289c755f708d79a2c3`, retaining exact family, exact operation, ready state and operational checks.

UI45 rendered all eleven questions in three families. Its desktop dark and light captures succeeded. The journey then resized to 390px before invoking the shell theme switch, which is absent from compact navigation. The failure was a test-helper ordering error, not a claim that mobile dark mode was rendered. Commit `072cfe4b75fb34b40c0e950da414089c077a8a75` chooses the actual native theme at desktop width before resizing to measure 390px/320px reflow.

### Actual image inspection

All four images below were emitted through the image tool and visually inspected. The UI45 desktop composition has a clear title, compact Context access, three aligned question families and legible question controls in both themes. The 390px failure capture shows a one-column catalog with readable wrapped titles and no visible horizontal spill; it remains a light-theme interrupted capture. UI42's error panel is legible and preserves the denial, but it supplies no successful scenario content evidence.

| Capture | Observed content | Qualification |
| --- | --- | --- |
| [UI42 denied desktop](attempt-01/UI42-denied-desktop.jpg) | Original error state, dark desktop | Failed admission; source content not reached |
| [UI45 dark desktop](attempt-01/UI45-dark-desktop.jpg) | Eleven questions, three native families | Visual inspection only; grouped test failed later |
| [UI45 light desktop](attempt-01/UI45-light-desktop.jpg) | Same original catalog, light theme | Visual inspection only; grouped test failed later |
| [UI45 mobile interruption](attempt-01/UI45-mobile-theme-interruption.jpg) | Light catalog at 390px | Interrupted before requested dark capture |

## Source preparation correction before requalification

The unchanged `four-decisions` fixture promotes source-only scenarios with no operations. The original controls producer publishes sensitivity parameters only for explicit finite replacement operations; a bare scenario title is insufficient evidence of an admitted parameter. The owned helper `wave-five-analytics-source.ts` therefore reopens an authorized Planner forecast and its issued pending-coverage receipt, selects its confirmed February monthly component, and promotes one explicit replacement hypothesis through the original `decision-promote` API. The hypothesis uses that component's exact amount, currency, period and identity. It does not edit a stored scenario, manufacture a sensitivity result, or patch admission.

The journey selects the newly published scenario by the original result reference and alternative identity, and selects its original parameter reference. The original seed remains unchanged. Empty authorized cases still receive their real no-units state. The final sensitivity assertion reads the persisted threshold proof and compares its actual sampled interval or unavailable reason with the UI. Pending coverage remains conditioned and no exact threshold or complete total is inferred.

Requalification must include both strict omni control and `ORCHESTRA_CHANNEL=prod`, using the composed integration source and the original installed endpoints.
