# CAP02 — Hot Topics redesign

Status: IMPLEMENTED, AWAITING ACTIONS AND REAL VISUAL REVIEW.

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

No local build, test, app execution or owner-app restart. Root owns the consolidated Actions run and actual dark/light, Portuguese and narrow captures. Static source comparison confirmed unchanged remove logic, preserved save dispatch/admission semantics and preservation of all existing catalog pairs. The new source has not yet been runtime validated, visually accepted or assigned a golden baseline. Narrow CSS is not evidence of browser zoom. Post-save source refresh and owner draft lifecycle retain the original implementation and must be exercised through the real installation.

## Inherited confirmation lifecycle repair

Source inspection during the first consolidated Actions run identified a concrete lifetime bug: the editor set its saved feedback, then immediately refreshed CAP02. The reader publishes loading and clears records; SfStatePanel removes children during loading. This destroyed the confirmed editor/notice and, on the new route, could create another blank draft immediately after the successful command.

The page now retains only a confirmation marker consisting of the owner generation and editor route scope. The notification is accepted only from the exact transport that sent the successful command and only while the current owner still admits CAP02 read access. The marker clears on owner generation, read authority or editor route change; no field values, producer projection, receipt or permission are cached.

The actual source refresh still runs immediately after the confirmed command. The stable success panel remains outside the read-loading boundary, so read failure can be shown separately without pretending that the command failed. The normal new/edit component cannot remount while confirmation is visible, preventing a replacement draft and accidental repeat. Back returns to the authorized list that is being reread. Clicking New topic from the list begins a new editor instance.

The final action remains **Back to topics / Voltar aos tópicos**. Success is now `[data-sf-topic-confirmed] [data-topic-feedback="saved"]`, outside `[data-sf-topic-editor]`. The success panel contains no form, review button or send action. Transport capture occurs immediately before the existing client call; it changes no request parameters and lets a late response from an old owner be rejected by the presentation callback.

Inspection of the owner registry showed Map-backed acquire and a draft constructor that does not read its snapshot. No reactive self-subscription was observed there, so no speculative untrack was added. Runtime proof of the repair remains the responsibility of the consolidated real-installation journey.

### First Actions result and marker hardening

Run `44918211856`, job `136888297405`, captured the initial twelve desktop/light/narrow views with no reported page errors, then stopped at the exact accessible-name lookup for the CAP02 status filter. The implicit label included option text, so the intended control name was not exact. The filter and editor Status/Priority selects now have explicit localized aria-label values matching their existing labels. The test locator and timeout are unchanged.

The completion callback also receives the editor scope captured before the first await and checks it against the current route, in addition to checking the sending transport and owner generation. A late response from another editor route on the same transport cannot mark the current editor complete.

Actual initial CAP02 captures inspected: dark desktop and light 320px. The list alignment and record reflow are intact. The inherited source navigation's oversized outlined buttons were the main visual inconsistency; root is applying the approved compact navigation to the three wave-two surfaces. Editor/review captures remain pending because this run stopped before creation.
