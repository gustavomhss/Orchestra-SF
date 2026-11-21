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

The original `remove()` and `save()` function bodies are byte-identical. Reader, route codec, owner selection, admission, draft acquire identity, CAS expected version, payload digest, idempotency and unknown-outcome fences remain. Commands still require the existing explicit confirmation. The current source is never replaced by a synthetic result.

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

No local build, test, app execution or owner-app restart. Root owns the consolidated Actions run and actual dark/light, Portuguese and narrow captures. Static source comparison confirmed unchanged save/remove bodies and preservation of all existing catalog pairs. The new source has not yet been runtime validated, visually accepted or assigned a golden baseline. Narrow CSS is not evidence of browser zoom. Post-save source refresh and owner draft lifecycle retain the original implementation and must be exercised through the real installation.
