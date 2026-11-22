# Procurement route and state matrix

## Native routes

These are the existing 17 route patterns. The route recognizer, owner selection and source admission are unchanged.

| CAP | Existing pattern | Presentation |
| --- | --- | --- |
| 24 | `/orchestra/sf-procurement/overview` | Source totals, filtered ledger and coverage disclosure |
| 25 | `/orchestra/sf-procurement/requests` | Request list; select one current record |
| 25 | `/orchestra/sf-procurement/requests/new` | Requisition create draft and review |
| 25 | `/orchestra/sf-procurement/requests/:requestRef` | Current request, stage links and history |
| 25 | `/orchestra/sf-procurement/requests/:requestRef/requisition` | Requisition fields; separate W19 title intent |
| 25 | `/orchestra/sf-procurement/requests/:requestRef/sourcing` | Quotation/evaluation editor |
| 25 | `/orchestra/sf-procurement/requests/:requestRef/sourcing/compare` | Recorded producer comparison and selection review |
| 25 | `/orchestra/sf-procurement/requests/:requestRef/po` | Purchase-order fields and rows |
| 25 | `/orchestra/sf-procurement/requests/:requestRef/history` | Authorized source history |
| 26 | `/orchestra/sf-procurement/approvals` | Submitted PR queue |
| 26 | `/orchestra/sf-procurement/approvals/:requestRef` | Submitted PR record |
| 26 | `/orchestra/sf-procurement/approvals/:requestRef/review` | Sourcing/PO approval detail and decision; existing host dispatch |
| 27 | `/orchestra/sf-procurement/suppliers` | Supplier list and selected source detail |
| 27 | `/orchestra/sf-procurement/suppliers/new` | General supplier create draft |
| 27 | `/orchestra/sf-procurement/suppliers/:supplierRef` | Supplier detail, links, masked bank section and audit |
| 27 | `/orchestra/sf-procurement/suppliers/:supplierRef/edit` | General supplier editor |
| 28 | `/orchestra/sf-procurement/settings` | Policy editor, sections and source-bound review |

The procurement queue panel receives the same token treatment and retains its existing table/detail component. It introduces no extra native route.

## State ownership

| State | Existing owner and behavior | New presentation |
| --- | --- | --- |
| Ready list | Authorized projection and existing row references | One ledger with toolbar and deliberate selection |
| Detail | Current source record and version | Bounded facts, actions and source metadata |
| New draft | Existing F01 new-intent identity | Create form; list return keeps the draft and exposes Resume draft |
| Dirty record | Existing F01 record identity/edit scope | Editor remains mounted across local list return |
| Review | Frozen source revision, action, intent and proposed values | Focused 760 px surface, browsing/editor hidden |
| Checking/submitting/verifying | Original writer and dispatch fence | Busy review disables Cancel/Revise/Confirm; source readback still decides outcome |
| Cancelled review | Existing draft/controller retained | Editor restores its entered values; no command is sent |
| Confirmed | Original producer acknowledgement followed by authorized reread | Existing truthful acknowledgement; no synthetic receipt |
| Missing, denied, expired | Original admission/projection result | Native state panel inside the same marked page frame |
| Validation/conflict | Source response and existing draft conflict handling | Original errors and explicit discard/review controls remain |
| Pending/unknown | Stored pending operation and read-only reconciliation | Original recovery action, no automatic replay |

No create/edit action is invented for the read-only overview or for an approval record. “Create” for CAP28 means adding a permitted matrix/criteria/rate row inside the settings draft; saving still uses the one original settings command.

## Executable coverage and limits

The browser journey covers overview/filter, request list/create/edit, quotation comparison and sourcing edit, PR approval, sourcing approval, PO rejection and order draft save, supplier create/edit, settings edit, and source reread after confirmation. It verifies that cancelled reviews retain request, supplier, sourcing, PR decision and settings values. It also verifies a recorded zero versus a missing estimate, and preserved quote/PO notes after unrelated edits.

The existing regression suites retain authority, conflict, pending/unknown, permissions, reference validation, source metadata and bank-secret protections. This new visual journey does not simulate those failures with network mocks and does not claim to have newly exercised every negative branch. It does not submit supplier bank data, activate suppliers, reset policies, dispatch external notifications, or assert external delivery of internally issued orders.

## Observed qualification

[Procurement10](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44965165654) passed the four independent installed groups on snapshot `7f3de0206fc25b2925d7c55947d9b5785bdfe7ba`. Its [gallery and manifest](../evidence/procurement/README.md) contain all 43 reviewed captures and the exact eleven command/readback pairs.

| Group | Original POSTs | Observed fresh source result |
| --- | ---: | --- |
| Requests, sourcing and approvals | 8 | Saved PR values; created source record; pr_pending; retained sourcing evaluator/quote metadata/selection; approved PR to sourcing; approved sourcing to po_draft; rejected PO to po_rejected; saved PO delivery conditions and retained line notes |
| Suppliers | 2 | Created supplier is pending with source notes; edited notes survive a fresh source reopen |
| Settings | 1 | Reminder day 9 survives a fresh settings page; minimum quotations 3 and USD currency remain |
| Portuguese | 0 | Real source rows in CAP24–27 and the seven-section policy form in CAP28, desktop and 320 px |

All groups passed their exact POST-count and empty page-/console-error assertions. Six readable command response bodies were positive; five bodies were unavailable to the collector and relied on the unchanged application-completion checks plus the same explicit fresh source readbacks. No body unavailability was converted to an acknowledgement. The seventeen-route inventory above is broader than this observed action/state matrix.
