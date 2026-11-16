# R2 — pacote para revisor INDEPENDENTE em sessão nova

> PREPARED_NOT_STARTED · C formal ainda ausente · nenhum parecer final emitido.

## Prompt de entrada

Você é um REVISOR NOVO E INDEPENDENTE (R2: Finanças, semântica, permissão, versão, atomicidade e persistência) no repositório gustavomhss/Orchestra-SF. Esta é uma NOVA sessão/contexto, não a revisão histórica 208. NÃO assuma identidade/autoria ou reuse execução de autor. Antes de começar: exija o commit C formalmente ACEITO e a árvore exata publicados pela composição 211/S0; se não há C, emita BLOCKED_NOT_STARTED, nunca APPROVE. Leia AGENTS, START.md, WORKFLOW.md, execution/COMMON.md do plano dbf9547211d9b0fade619790de7c19c0869b7c7d, seu actor pack integral, seus apêndices obrigatórios e modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure235/FINDING-TRACE.json, modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure235/CI-DISPATCH-REQUESTS.json e todas as fontes originais. Leia o produto REAL no checkout de C com SHA e blobs, não 228 separado como se fosse C. Execute crítica causal própria sem editar produto, sem novo supervisor/Goal; releia correções aceitas e compare paths/pre/post. Registre independência por arquivo, modelo/session apenas se expostos, cada critério e evidência nativa real + neg/pos, run/job IDs/artefatos, rechecks de todos seus achados, caminhos e consumidor. CI somente dispatcher único; G7 checkout C e G8 checkout D separadamente via 190. 207/208/209 são PRE_FREEZE/FIX_FIRST, não aceite. Se falta prova: NOT_RUN ou BLOCKED. Nunca invente grants, dados financeiros, aprovação, provider ou resultado. Nenhuma mudança em sf-closure-bundle, sf2-control, dev; devolva findings aos owners em receipts autorizados.

## Escopo e achados históricos

- Verificar semântica BI com moeda/unidade incompatível, zero/null/ausência, granularidade e sem conversão FX implícita
- Verificar Atlas event seq invariants, C08 commit/outbox, replay idempotente, stored corruption, fail-closed e scanner
- Rechecar UI49 comparação preservada, owner/project/version/incarnation e UI55 Jan→Feb stale selection
- Rechecar C03/C06/C12 com original autoridade do draft Requests.save e revisão humana sem aprovação financeira fictícia; consumir patches inertes 230 somente se realmente integrados em C

- **REV208-NEW-001** (FAIL_SOURCE_STATIC_NOT_RUNTIME_QUALIFIED) — USD and FTE positives, conflicting explicit hours+USD v USD, other mismatched physical/currency, null/zero, no fake FX, correct BI charts; fonte/correção: 215 original analytics unit repair full inert payload in 228; CI existente: S215-BI-UNITS.
- **REV208-NEW-002** (FAIL_SOURCE_STATIC_NOT_RUNTIME_QUALIFIED) — Two persisted originals, clean restart/append, duplicate/reordered/mutated ordinal rejects without disclosure/append, scanner clean/canary/unavailable; fonte/correção: 216 original Atlas storage repair full inert payload and 228 semantic atlas-memory merge; CI existente: S216-ATLAS-SEQUENCE, S220-AM05.
- **PRE147-R02-01** (STATIC_CORRECTION_OBSERVED_HOSTED_RECHECK_NOT_PROVEN) — Same-period/currency across installation/project must deny; same-owner project positive after fresh original read; fonte/correção: 152/157 historic UI49 preserved comparison source, 211 integration; CI existente: CI-UI-DECISIONS.
- **PRE147-R02-02** (STATIC_CORRECTION_OBSERVED_HOSTED_RECHECK_NOT_PROVEN) — 100 USD→EUR, confidence confirmed→estimated, 0→null, no silent conversion, full provenance; fonte/correção: 152/157 UI49 preserved model + semantic rendering already corrected statically; CI existente: CI-UI-DECISIONS.
- **PRE147-R02-03** (STATIC_CORRECTION_OBSERVED_HOSTED_RECHECK_NOT_PROVEN) — Equal numeric value with changed sourceRef version/incarnation/access/observedAt must show change; revocation negative; fonte/correção: 152/157 preserved model lineage original source; CI existente: CI-UI-DECISIONS.
- **PRE147-R02-04** (STATIC_CORRECTION_OBSERVED_HOSTED_RECHECK_NOT_PROVEN) — Jan→Feb clears prior target/selection, renewed discovery; deny stale/revoked target, no apply; fonte/correção: 152/157 original UI55 import target selection source; 218 cross-domain receipt; CI existente: S218-IMPORT-HISTORY-F04.

## Fontes obrigatórias

Ler integralmente `modules/sucafina/Sucafinav1/docs/sf2h-plan/execution/actors/S2-R2.json` no commit `dbf9547211d9b0fade619790de7c19c0869b7c7d` (Git blob `dfb48ef567034ebc235d47bb12be030083d3e065`), inclusive 17 contratos, 40 textos de critérios e proof bindings; esta página não os substitui. O JSON `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure235/REVIEW-R2.json` inclui os 40 textos e campos de prova. Ler ainda `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure235/FINDING-TRACE.json` e `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure235/CI-DISPATCH-REQUESTS.json`, a revisão original e os apêndices do actor pack.

## Critério de decisão

No C aceito, conferir cada mudança realmente consumida com pre/post e comparar comportamento observado com fonte e consumidor originais. Exigir identidade, grant, negativos e recheck causal; recorrer ao único dispatcher autorizado para CI, sem disparos duplicados. G7 é real no checkout de C, G8 real no de D, separadamente. Sem C e provas: **BLOCKED_NOT_STARTED / NOT_PROVEN**, nunca APPROVE. Sem autoria de produto nem Goal reativada.

**Situação preparada em 235:** testes NOT_RUN; typecheck NOT_RUN; build NOT_RUN; validadores NOT_RUN; CI NOT_RUN; G7 NOT_RUN; G8 NOT_RUN; revisão final NOT_STARTED.
