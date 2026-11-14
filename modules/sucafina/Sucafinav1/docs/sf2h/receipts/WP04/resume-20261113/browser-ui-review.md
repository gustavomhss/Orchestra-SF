> **Validação final pelo integrador:** produto `dae18b4f43f0daecf46264e876810025684a919d`; Bun 257 pass, Playwright 10 pass, zero falhas/skips/retries, geração oficial e typecheck aprovados. Recibos e escopo em [ci-evidence.json](ci-evidence.json). O texto histórico abaixo conserva a atribuição e o estado da revisão em sua data; estes resultados hospedados não são atribuídos a execução pelo revisor. Permanecem 10 limites nativos e 4 observações humanas.

# WP04 — W8 browser UI visual audit

## Result and evidence boundary

The five requested hosted screenshots were opened with `view_image` and inspected at their original 1280 × 720 viewport. No blocking visual defect was found in these captures. The screenshots support the observations below; successful assertions provide the additional state, authorization and persistence evidence that is outside each viewport.

The completed [Actions run 43534795463, job 132261059694](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534795463/job/132261059694) reports **10 passed, 0 failed, 0 skipped, 0 retries**: eight real-host cases and two explicitly isolated sourcing-controller cases. This audit inspected five PNG attachments from three of the real-host cases. The other screenshots are reviewed separately by the root agent. No product code was changed or executed locally for this audit.

## Provenance cross-check

- Product commit: `dae18b4f43f0daecf46264e876810025684a919d`.
- Executed snapshot: `23f527266a8bf0da2c015624d40db417e2d9bb80`, confirmed by the artifact's `test-ci-evidence/request.json`, runtime report and hosted log. `equality-w8-browser.json` records exact recursive product-tree equality, with only the `.ci-run.json` envelope added.
- Artifact: `14088094597`; the downloaded ZIP was independently rehashed as `379a94caec10edce2da7afb7f5d0e376eaefbb05f92db93c7cf535962b0c6d84`.
- Frozen spec: `packages/app-shell/e2e/sucafina/wp04/procurement.spec.ts`, 43,185 bytes; SHA256 `6562cb86fc9ea7095fb812b8477363dd59adb9b71907e1096bd72722d3d7b9b5`; Git blob `a960a2cad432000edf51efcc6764c0c21d60ce07`. Its current bytes equal `publication-w8.json`, and its blob equals `manifest-w8.json`.
- All five PNG member hashes and the corresponding decoded inline JSON attachment hashes match `review/w8-browser-observations.json`. JSON observations were also compared with the underlying runtime report, rather than treated as independent proof of their own assertions.
- The real execution result comes from `playwright-runtime.json`, not the separate `--list` selection report. The latter intentionally has no execution results. The runtime has ten passed results, no errors and zero retries; the hosted log ends with `10 passed (1.9m)`.

## Visual observations and assertion support

| Capture | Direct visual observation | Corresponding successful assertions and limitation |
| --- | --- | --- |
| `supplier-bank-revalidation.png` | The bank-change warning says that supplier validation was cleared and an authorized supplier administrator must review and reactivate. The activation prerequisites distinguish recorded prerequisites from external sanctions verification. An Activate button is visible. The bank form is covered by the intentional magenta screenshot mask. | The case verifies the actual bank-change response, version increment and preserved edited IBAN in the authorized form. The same supplier's authorized viewer CSV confirms `pending` with empty validation metadata. The screenshot mask protects the artifact; it is not evidence of application-side viewer redaction. |
| `supplier-viewer-redaction.png` | The read-only supplier page shows `SUP-00001`, Journey registered supplier and status `pending`, with its detail open. The captured area contains general fields and the supplier CSV link; no bank value appears in this viewport. | The viewer case verifies the bank-masked message, absence of bank inputs/change-bank form, absence of the bank fixture values in the whole HTML response, a rejected forged bank update (`403`), and omission of all six bank columns from the viewer CSV. The bank section is below this screenshot's viewport, so visual absence alone would not establish redaction. |
| `supplier-reactivated-masked.png` | The same supplier row and detail now show `active`. General read-only information remains visible; the screenshot contains no bank values. | The authorized activation returns success and advances the version again. A new viewer CSV read confirms `active`, the actual authorized principal as `validatedBy`, and the recorded validation timestamp. The viewer still has no bank controls. The JSON records that same principal and supplier ID; those identifiers are not readable from this screenshot alone. |
| `pr-sourcing-po-issued.png` | The PO section retains Journey registered supplier, quantity `2`, unit price `48`, the negotiated invoice address and the later note. The visible controls and labels are legible and do not overlap. | The real journey makes fresh authorized GETs after saving and issuing, checking the exact supplier ID `4402a3bb-50ab-47f3-b27b-d33fb7f65b7e`, EUR, quantity 2, price 48, `FRAME-2026-01`, `Net 60 negotiated` and version. It also checks `Issued internally` and `103.68 USD`. Supplier ID, currency, payment terms, issued state and amount lie outside this viewport; the PNG alone does not prove them. |
| `settings-reset-preserves-submitted-source.png` | The application has returned to Requests, filtered to `PR-2026-0001`; the captured top portion shows the request filter and new-request form. | The preceding assertions establish the invalid-save `422`, corrected-save `200`, Reset `200`, Tab/Enter/Tab/Space flow, restored defaults, unchanged submitted-request summary and retained `30240 USD (submitted FX: 1.08)`. Neither the Settings controls nor the preserved comparison is inside this viewport. This PNG is byte-identical to `queue-keyboard-filter-restored.png`, consistent with the same final route and viewport; it must not be represented as a visual capture of the reset interaction or the FX detail. |

## Executed cases supporting these captures

All names below occur in the frozen production-host spec and in the completed runtime report, with one successful attempt each:

| Exact test name | Duration |
| --- | ---: |
| `a recurring request reaches an internally issued PO with source values and negotiated entries preserved` | 24,572 ms |
| `an authorized bank change requires supplier revalidation and a real viewer cannot read or update bank details` | 6,693 ms |
| `settings reject invalid currencies with visible feedback and reset restores defaults without changing a submitted request` | 8,865 ms |

## Residual presentation detail and limits

The viewer's read-only general-field table displays `tradingName` in camelCase, while the editable inputs and activation prerequisites use humanized labels. This is a minor presentation inconsistency observed in the capture; it did not obscure the supplier identity or pending/active transition and is not evidence of a failed authorization or persistence assertion. No additional product change is proposed by this read-only audit.

The captures cover a desktop Chromium viewport, not every responsive size or every field at once. They do not establish a human's comprehension within 30 seconds, native/MCP execution parity, or an actual model run. Each JSON observation explicitly records `humanTimingMeasured: false`; the aggregate receipt records `native_qualification: false`. These boundaries remain unchanged by the green browser result.

## Inspected PNG SHA256 values

Exact ZIP member paths and JSON attachment hashes remain in `review/w8-browser-observations.json`.

| PNG | SHA256 |
| --- | --- |
| `supplier-bank-revalidation.png` | `6351481af961d1c55dfde58ba51f5041b4eb2d7fdf1723c04358da2e5d5b0366` |
| `supplier-viewer-redaction.png` | `50db1678eb159a32cc8c831295c5407890e4f2f92f912f7343638da018de50a9` |
| `supplier-reactivated-masked.png` | `d203569af630c433d1d9c60f4fe6878e8290b4c9f704074530bed15fb1877e87` |
| `pr-sourcing-po-issued.png` | `969c15e5ee5c2c8537a761dd41d0bf7a2b914c8bdb81374c8ced23fb46e8afbf` |
| `settings-reset-preserves-submitted-source.png` | `f3d530fc4796b7489c4671ca87579cabf3cfd89d971e8cc3ce35e2326af8ec94` |
