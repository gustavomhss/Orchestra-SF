# CAP02 — Hot Topics redesign

Status: REAL JOURNEY PASS; FINAL CAP02 REFERENCE-SELECTOR POLISH VISUALLY VERIFIED ON CANDIDATE 5012d7a. User visual approval and golden baseline remain pending.

## Scope and origin

- Worker: `redesign_topics`.
- Branch: `sf-redesign-topics`, created from integration foundation `a169c6b1ddca854a58dbf467a6573d5b1359c66f`.
- Target: native CAP02 only, including list, filter, detail, new/edit, save review and deletion review.
- Approved reference inspected: actual wave-one Portuguese Cases image `UI33-pt-BR-dark-desktop-test-data.jpg`, plus the approved Cases source and current DESIGN.md §10.
- Read the repository/app instructions and Orchestra design-system/visual-QA skills. Directory inspection found no additional AGENTS.md under the affected source ancestors.

## Composition

One raised surface holds the list toolbar and rows. The title and filtered count anchor the left; a 200px status selector and labeled refresh action sit on the right. Action names use the native 14px emphasis; priority is secondary metadata beneath the action. Owner, status and due date share aligned columns. At narrower viewports records become stacked semantic table rows with visible field labels, retaining the complete values and 44px actions.

The detail foregrounds the action title, followed by four metadata fields and Notes. The primary Edit action and the destructive action share a deliberate action row. Cross-links remain available. Record reference, version and producer history absence live in a native details disclosure. Deletion review hides the ordinary detail actions while preserving the content instance; cancel returns keyboard focus to Delete topic.

Creation/editing occupy a 760px surface. Action is a two-line textarea; Owner/Due date and Status/Priority form two paired rows; Notes spans the width. The existing due field stays a source-compatible text field. Review is a separate stage with original/current/proposed snapshots. New-record review gives the proposed fields the full width; narrow viewports stack all snapshots. Returning from review restores the existing draft fields and focuses Action.

The header primary action is shown only on the entry route, so editors and deletion reviews do not compete with New topic. The explicit wave marker imports the approved shared frame geometry. All new styling is rooted in CAP02's `.sf-topics`; the original `u38.css`, shared change-review styles, proposal leaf and HuGR shell are unchanged.

## Preserved behavior

The original `remove()` body is byte-identical. The save command, payload, digest, CAS, idempotency and unknown-outcome branches remain; the post-confirmation lifecycle repair below adds a presentation notification. Reader, route codec, owner selection, admission and draft acquire identity are unchanged. Commands still require the existing explicit confirmation. The current source is never replaced by a synthetic result.

Presentation changes include focused return from review, 44px targets, secondary metadata disclosure, translated status/priority values in review, and explicit Not specified presentation for empty review fields. No amount, total, priority, history or receipt is invented. Back/discard are disabled while actively saving; pending operations keep the original discard fence and Back retains the existing reconciliation navigation.

## Copy

Every existing English and Portuguese catalog value is unchanged. The only new catalog key, `sf.u38.relate`, moves the existing English “Relate action by reference” and Portuguese “Relacionar ação por referência” from the component's bilingual adapter into the registered U38 catalog, byte for byte. No translation was invented for this change. Review enum labels reuse the existing U38 status/priority corpus. Product naming retains Hot Topics; other visible UI labels continue through the existing bilingual catalog.

Primary localization reference inspected: Mozilla Firefox's maintained pt-BR global-dialog corpus, `mozilla-l10n/firefox-l10n/pt-BR/toolkit/toolkit/global/commonDialog.ftl`. Existing project copy remains the source of the actual strings used.

## Test contracts for integration

- Page: `[data-sf-surface="CAP02"][data-sf-wave="two"]`; route kind in `data-sf-view`.
- List: `[data-sf-topic-list]`; rows retain `[data-sf-topic="<source id>"]`.
- Filter: label **Filter by status / Filtrar por status**; values `""`, `open`, `progress`, `blocked`, `done`.
- Row action: **View details / Ver detalhes**.
- Entry primary: **New topic / Novo tópico**.
- Detail: `[data-sf-topic-detail]`; deletion mode in `data-sf-deleting`.
- Editor: `[data-sf-topic-editor][data-sf-stage="edit"|"review"]`.
- Fields: **Action/Ação**, **Owner/Responsável**, **Due date/Prazo**, **Status/Situação**, **Priority/Prioridade**, **Notes/Notas**.
- Review: **Review save/Revisar salvamento**, **Confirm save/Confirmar salvamento** and shared `[data-component="sf-change-review"]`.
- Back: **Back to topics/Voltar aos tópicos**.
- Detail edit/delete: **Edit topic/Editar tópico**, **Delete topic/Excluir tópico**, **Confirm deletion/Confirmar exclusão**.
- Source disclosure: **Current producer source/Fonte atual do produtor**.
- Existing feedback contracts remain `data-topic-feedback` and `data-delete-state`.

## Validation and limits

No local build, test, app execution or owner-app restart. Root owns the consolidated Actions runs and actual dark/light, Portuguese and narrow captures. Static source comparison confirmed unchanged remove logic, preserved save dispatch/admission semantics and preservation of all existing catalog pairs. Candidate 263e694ef565376cc1af61cae0dc9e44777075b8 passed the real-installation journey and the focused registry tests documented below. The subsequent reference-selector CSS polish is covered by the two targeted final captures on candidate 5012d7adf0e5d02576fe6a0add6f79331a812137 documented below. No user visual approval or golden baseline has been recorded. A 320px viewport is reflow evidence, not browser-zoom evidence.

## Inherited confirmation lifecycle repair

Source inspection during the first consolidated Actions run identified a concrete lifetime bug: the editor set its saved feedback, then immediately refreshed CAP02. The reader publishes loading and clears records; SfStatePanel removes children during loading. This destroyed the confirmed editor/notice and, on the new route, could create another blank draft immediately after the successful command.

The page now retains only a confirmation marker consisting of the owner generation and editor route scope. The notification is accepted only from the exact transport that sent the successful command and only while the current owner still admits CAP02 read access. The marker clears on owner generation, read authority or editor route change; no field values, producer projection, receipt or permission are cached.

The actual source refresh still runs immediately after the confirmed command. The stable success panel remains outside the read-loading boundary, so read failure can be shown separately without pretending that the command failed. The normal new/edit component cannot remount while confirmation is visible, preventing a replacement draft and accidental repeat. Back returns to the authorized list that is being reread. Clicking New topic from the list begins a new editor instance.

The final action remains **Back to topics / Voltar aos tópicos**. Success is now `[data-sf-topic-confirmed] [data-topic-feedback="saved"]`, outside `[data-sf-topic-editor]`. The success panel contains no form, review button or send action. Transport capture occurs immediately before the existing client call; it changes no request parameters and lets a late response from an old owner be rejected by the presentation callback.

Inspection of the owner registry showed Map-backed acquire and a draft constructor that does not read its snapshot. No reactive self-subscription was observed there, so no speculative untrack was added. The initial repair required runtime proof from the consolidated real-installation journey; its later PASS is recorded below.

### First Actions result and marker hardening

Run `44918211856`, job `136888297405`, captured the initial twelve desktop/light/narrow views with no reported page errors, then stopped at the exact accessible-name lookup for the CAP02 status filter. The implicit label included option text, so the intended control name was not exact. The filter and editor Status/Priority selects now have explicit localized aria-label values matching their existing labels. The test locator and timeout are unchanged.

The completion callback also receives the editor scope captured before the first await and checks it against the current route, in addition to checking the sending transport and owner generation. A late response from another editor route on the same transport cannot mark the current editor complete.

Actual initial CAP02 captures inspected: dark desktop, dark 1440×800, light desktop and light 320px. The list alignment and record reflow are intact. The inherited source navigation's oversized outlined buttons were the main visual inconsistency; root is applying the approved compact navigation to the three wave-two surfaces. Editor/review captures remain pending because this run stopped before creation.

## Reopening a confirmed existing topic

The owner registry retained the confirmed controller under the same record identity. A later acquire returned that completed controller, while receiveRemote, discard and confirmSave on the controller only operate on active snapshots. The approved Cases flow uses its own local creation state, so its completed-instance cleanup could not be copied to this registry.

With root's explicit shared-file assignment, registry.discard now accepts an optional confirmedOperationRef. This mode only deletes an entry whose availability is confirmed-without-projection, whose stored operation reference exactly matches, and which has no unresolved marker. It returns without touching any other snapshot. Without the optional argument, the original discard path is unchanged; discardAll, quarantine, revalidation and revocation are unchanged.

CAP02 captures the submitted draft identity before awaiting, confirms the actual successful producer result, then releases precisely that confirmed registry entry with the same operationRef. The stable page confirmation still prevents an immediate new editor. The source reread remains immediate, and reentering the record creates an active editor from its fresh projection/version. No pending, unknown, conflict or unsent edit is released by the confirmation option.

A focused regression file was added to the existing Bun browser test suite:
`packages/app-shell/test-browser/sucafina-draft-confirmation.test.ts`.
It uses the real owner registry and draft controller; unrelated external dependencies throw if called. Cases cover omitted/wrong confirmation references, unresolved-marker protection, exact confirmed release, acquisition of a fresh version/value, pending/submitting/outcome-unknown protection, and unchanged ordinary discard behavior for clean/dirty/conflict drafts. Run through the existing Actions app test runner with browser conditions. No local test or additional CI was launched by this worker.

## Real journey and final visual review — candidate 263e694

Reviewed product candidate: `263e694ef565376cc1af61cae0dc9e44777075b8`.

- Real browser journey: [run 44919606458](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44919606458), [job 136892554713](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44919606458/job/136892554713), **1 passed (2.8m)**; all 36 expected preview names were emitted with no skipped test.
- The journey exercised the authorized source fixture and actual producer commands. CAP02 coverage includes creation, a fourth source row after reread, editing an existing topic, retaining a confirmed result through refresh, reopening with fresh values/version, deletion review and cancellation, and Done → zero records → clear filter → three records. Root reports three real commands across the consolidated journey: topic creation, topic editing and the OPEX monthly update.
- Focused owner-registry test: [run 44919739363](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44919739363), [job 136892953895](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44919739363/job/136892953895), **6 pass, 0 fail, 29 assertions**. The actual job log was inspected. The request used `./test-browser/sucafina-draft-confirmation.test.ts` in the existing browser-conditioned Bun runner.

### Exact images inspected

All thirteen CAP02 images below were viewed from the final journey's actual `SF_DESIGN_PREVIEW` data, not inferred from source. The compact navigation was present in these captures.

| Image name | Review |
| --- | --- |
| `CAP02-dark-desktop-test-data` | Three source rows; stable aligned metadata and actions; compact navigation. |
| `CAP02-dark-1440x800-test-data` | All three rows and primary controls fit the shorter desktop viewport. |
| `CAP02-light-desktop-test-data` | Native light surfaces retain clear row and status hierarchy. |
| `CAP02-light-320-test-data` | Toolbar and rows reflow; complete first record and full-width detail action are readable. |
| `CAP02-dark-desktop-editor-test-data` | Paired fields align; focused Notes remains inside the surface; review/discard actions are complete. |
| `CAP02-dark-desktop-review-test-data` | New-topic original/current context stays compact; proposed fields and final actions are readable. |
| `CAP02-dark-320-review-test-data` | Captured lower review region stacks proposed fields and three complete 44px actions without horizontal clipping. |
| `CAP02-dark-desktop-detail-test-data` | Title, metadata, Notes and edit/delete are aligned; the reference selector has the concrete finish defect described below. |
| `CAP02-dark-desktop-existing-review-test-data` | Original/current/proposed snapshots remain readable in equal columns, with the changed Notes visible and complete footer actions. |
| `CAP02-dark-desktop-saved-test-data` | A stable saved result and Back to topics remain visible while the real source reread shows its loading state; no replacement editor/send action appears. |
| `CAP02-pt-BR-dark-desktop-test-data` | Four source records, localized status/priority/date labels and complete actions. |
| `CAP02-pt-BR-dark-desktop-editor-test-data` | Portuguese labels and action captions fit; paired fields and focus treatment remain coherent. |
| `CAP02-pt-BR-dark-desktop-review-test-data` | Portuguese original/current/proposed labels and confirmation actions fit without overlap. |

The core list, editor, review and confirmation composition has no new blocking geometry issue in these images. Existing-record review was captured after scrolling toward the footer; the partially scrolled page eyebrow is not evidence of a broken title layout. The mobile review image covers the lower review region, not the entire page. Deletion review/cancel was exercised by the journey but no separate deletion screenshot was emitted; this report does not claim visual inspection of an absent image.

### Concrete visual finding and scoped correction

The detail image shows **Executive references → Open canonical record** with the selector rendered as bare text and a chevron, without the native field surface or a clear gap from its label. The shared component uses `select.mx-input`; CAP02's new input styling covered the list filter and editor but omitted this related-reference selector.

With root authorization, only `hot-topics/topics.css` now extends the existing native input treatment to `.sf-topics-related select`: 44px minimum height, native line/fill/radius, padding, full available width and inherited color scheme. Scoped related-section rules provide a 12px title/row gap and 8px label/control gap, with shrinkable label sizing for narrow screens. No shared cross-link markup, targets, commands, strings or authorization/admission code changes.

**Status at the 263e694 review:** these thirteen images predated the final CSS correction, so the corrected detail remained pending until another real render. That later targeted verification is recorded below; the original image inventory and finding are retained as history. This report is a worker critique, not user approval or a golden-baseline designation.

## Final targeted verification — candidate 5012d7a

Product candidate: `5012d7adf0e5d02576fe6a0add6f79331a812137`.

The existing real-installation journey passed again: [run 44920647017](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44920647017), [job 136895711016](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44920647017/job/136895711016), **1 passed (2.9m)**. The log contains 39 preview names. This targeted review reconstructed and rendered only the following two requested images, one at a time:

| Image name | Observed result |
| --- | --- |
| `CAP02-pt-BR-dark-desktop-detail-test-data` | Referências executivas now has clear separation between heading, label and selector. The selector has the native filled surface, border, radius and 44px height; its Portuguese prompt and chevron fit. The detail metadata, Notes, edit/delete controls and source disclosure remain aligned. |
| `CAP02-dark-320-related-test-data` | The reference selector fits the narrow card, with a complete visible focus outline and a full-height control. Label and field are separated, edit/delete actions remain complete, and the source disclosure fits below. No horizontal clipping is visible in the captured region. |

**Worker verdict:** the specific reference-selector finish defect observed in the 263e694 detail image is resolved in these actual final renders. No additional material defect was found in the two inspected areas. No product changes or CI executions were made during this final verification; only this review document was updated.

The 320px image is a scrolled capture of the lower detail/related-reference region, not a full-page image or browser-zoom test. The other 37 final preview names were not reconstructed by this worker in this targeted pass. The thirteen-image review of candidate 263e694 above remains the recorded broader CAP02 review; the final two images specifically close its last visual finding. User approval and any golden-baseline designation are still pending.
