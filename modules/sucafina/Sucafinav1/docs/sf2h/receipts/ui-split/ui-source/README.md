# ui-source — identidade física e replay

Status: **incremento seguro publicado e provado no escopo executado; fechamento funcional bloqueado por dependências externas**. Não é GLOBAL_RELEASE, nem substitui os 153 critérios WP01/WP02 ou os gates globais. A PR deve permanecer draft até composição e aceites dos owners.

## Escopo e comportamento

Base da fatia: `2ee71fc90055814912654ae198f7a1dcf9583943` (`interface-resume`). Handoff: `d3d411f7e2476a562a57aa7620823980eaf34e46`, `docs/sf2h/control/handoff/astra/ui-split/ui-source.md`. Normativa: `dbf9547211d9b0fade619790de7c19c0869b7c7d`; SHA256 de campaign.json `703dd257274bed829a978705de548cd1383225bf7aac76445104c053e2bb5fba`.

Somente `product/dashboard/hot-topics.ts` muda em produção. CREATE com correlação existente exige `targetIncarnation` persistida e igualdade com a identidade física atual produzida por `sfSourceIdentity`. Correlação antiga sem identidade não pode ser preenchida a partir da linha atual. Digest diferente continua conflitando. Ausência, ambiguidade, troca de identidade e revogação continuam recusadas.

CREATE novo retorna `unavailable/action-create-identity-unavailable`, sem dispatch de domínio, correlação ou segunda transação, porque o lifecycle publicado só finaliza identidades depois do callback. Esta recusa desabilita o caminho de criação correlacionada até integração do owner; não constitui aceite do happy path CREATE. UPDATE previamente vinculado permanece com o comportamento original e é exercitado sem depender de CREATE bloqueado. `product/dashboard/hot-topic-draft.ts` permanece inalterado: o registro efetivo está no produtor estrangeiro `product/decisions/hot-topic-draft.ts`.

## Findings e critérios

| Finding | Delta / prova desta fatia | Dependência ainda aberta |
| --- | --- | --- |
| IR-EXT-CREATE-INCARNATION | Recusa segura, rejeição de legado sem vínculo, replay de recibo fisicamente vinculado, ABA, reabertura e preservação de UPDATE | Lifecycle + C08/host precisam emitir e persistir identidade + correlação no mesmo commit antes de reativar CREATE |
| IR-EXT-DRAFT-CASE-ADVANCE | HTTP real: registro efetivo, ACK descartado, avanço de objetivo do caso via C08, replay exato e controle de comando novo com versão antiga | Produtor de drafts valida versão antiga antes de consultar recibo idempotente |
| IR-EXT-F04-WRITE-ONLY-REVOCATION | HTTP real demonstra leitura ainda disponível, incarnation de escopo diferente, identidade física igual; ABA conserva ID mas troca identidade | Falta porta admitida para reautorizar a fonte original do draft não salvo e comprovar continuidade física |

Critérios vinculados preservados: `WP02.INV.02`, `WP02.T04.CHK.01`, `WP02.T04.DOD.01`, `WP02.T04.QLT.02`, `WP02.T04.CMP.01`, `WP02.T04.CMP.02`, `WP02.T04.SUC.01`, `WP02.T04.SUC.02`, `WP01.T03.DOD.01`, `WP01.T03.CMP.01`, `WP01.T03.SUC.01`, `WP02.QLT.02`, `WP02.T02.SUC.02`, `WP02.T02.QLT.02`, `WP02.CMP.10`.

## Provas e limites

Testes novos usam SQLite, identidade autenticada, autoridade, C08, lifecycle, issuer e hosts reais. Recibos CREATE legados/vinculados pré-carregados são dados explícitos de fixture; não são prova de CREATE atômico bem-sucedido. O avanço de caso é um evento de fixture autenticado por C08 com controle de versão, sem alteração de identidade, participantes, horizonte, moeda, critérios ou fonte. A contraprova é **lost-register**, sem chamada de apply; não é o C12 lost-apply anterior.

Produto é executado apenas em Actions, via protocolo `.ci-run.json`. O adaptador `static-checks.test.ts` executa `bun typecheck` no package e `bun run check:guards --base origin/dev` na raiz do runner, com processos Omni e base realmente buscada. Não altera workflows ou fontes compartilhadas. Diagnósticos externos permanecem falhas. Antes da publicação, somente parsing de sintaxe e validação pura oficial do request ocorreram localmente.

Provas anteriores de ACK/Escape/revogação não alteradas permanecem referenciadas pelo recibo PR43 e não são reexecutadas. O assert positivo do replay após avanço permanece `200` + recibo original; falha externa será publicada como falha. F04 nesta seleção é reprodução de fronteira de fonte, não aprovação do cenário de retenção do browser.

## Execuções hospedadas

| Seleção | W / S | Actions | Resultado real |
| --- | --- | --- | --- |
| Identidade, replay, continuidade e checks estáticos | W `cfeda8edd29717f032f06b1ce66e63bd8a900c8e`; S `d204b40f21984398bd5abf90331f58b935229634` | [43620533033](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43620533033), job `132524993530` | 4 PASS / 5 FAIL; 72 asserts. Três falhas eram o `version: 0` ausente na fixture canônica. Replay após avanço falhou no produtor externo. Typecheck identificou nove erros próprios de tipagem e nove locais externos. |
| Somente três provas de identidade afetadas pela correção da fixture, typecheck e guards | W `e10819f8242c7e34dfd62e279a261c91e9915fc7`; S `d10a06048ff882bd90444f4b4a605c493f79d4d3` | [43620871410](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43620871410), job `132526032410` | 4 PASS / 1 FAIL; 66 asserts. Três provas de produto e guards PASS. Typecheck FAIL apenas em nove locais externos. |

Ambos os workflows concluíram **failure**, sem reclassificação. Omni positive control **pass** nos dois runs, cada um com cinco spawns próprios e zero delegados. Não houve alteração de timeout ou redução de assert. A segunda seleção usa filtro explícito e não repete as provas verdes de CREATE sem seam, replay sem avanço ou F04.

W→S altera somente `.ci-run.json`, comprovado por compare remoto. O blob de produto é idêntico em W1/W2: `051be54adbf197a0f4b290ab6bc6aaa9f0f563d5`. W2 corrige dois arquivos de teste: inclusão de `version: 0` no comando da fixture, anotação `key: string` e mensagem no ramo de erro da leitura de preferences. Os resultados da primeira execução ficam vinculados a W1/S1; não há alegação de um novo run integral verde sobre W2. O commit final de recibos acrescenta apenas documentação e patches inertes, mantendo os blobs de produto/testes de W2.

### Resultado por finding

- **CREATE:** o host real recusou a criação sem seam antes de qualquer alteração durável; retry exato e reabertura conservaram o snapshot. Legado `{digest,id}` foi recusado antes/depois de reabertura e ABA. Recibo previamente vinculado à incarnation física seguiu a ação através de UPDATE e foi recusado após substituição. O happy path de CREATE continua indisponível.
- **UPDATE:** a mutation real avançou a versão uma vez, gravou `targetIncarnation` e o resultado original, retornou esse resultado no replay e após reabertura, e recusou ABA/revogação sem alterar o snapshot. O corpo de UPDATE não foi modificado.
- **Lost-register:** HTTP 200 com ACK descartado, exatamente um histórico persistido, caso avançado de 1 para 2 via C08; `readCurrent` do draft no caso atual retornou `ok`. Replay com corpo/chave originais retornou **403** (`hot-topic-draft-access-unavailable`), quando o assert exige 200 e recibo original. Nenhuma duplicação, alteração do Hot Topic ou chamada de apply. Comando novo com caso antigo também retornou 403. Sem avanço, replay exato retornou 200; conteúdo diferente 409; escrita revogada 403.
- **F04:** fonte atual reemitida com leitura autorizada após revogar apenas escrita; a incarnation física permaneceu igual, mas a de escopo mudou. Evidência antiga passou a `unavailable`; escrita retornou 403. O endpoint existente rejeitou `originalEvidence` com 400. A mesma string de ID também sobreviveu a delete/recreate com incarnation física nova, demonstrando por que ID não serve como continuidade. **Retenção legível do draft no browser permanece bloqueada**, não foi aprovada por esse teste de fronteira.

### Checks estáticos

`bun typecheck` no package retornou 2. Depois da correção própria restam **9 locais de diagnóstico, zero no escopo ui-source**: cinco TS2322 em `apps/cli/src/sucafina-product/host-context.ts` (193, 225, 281, 404, 420), envolvendo `SfStateResult`/`preview`; quatro TS2739 em `test/product/wp07/review-port.test.ts` (40, 45, 56, 221), por propriedades ausentes de `ReviewHost`. Os diagnósticos integrais do topo estão em `verification.json` e nos excerpts dos logs.

`bun run check:guards --base origin/dev` retornou 0: **78 regras, 889 paths comparados, zero gates, 42 warnings, zero erros**. A base realmente buscada foi `a1d37698a7bb097c1578f827eba6a19b9917ef07`; nenhum warning pertence ao delta ui-source. A skill `guardrail-usage` foi consultada. Não foram adicionados ignores, aprovações ou labels de bypass.

## Patches NOT_APPLIED e handoff

| Patch proposto | Owner / próximo passo |
| --- | --- |
| [01-draft-case-replay.NOT_APPLIED.patch](patches/01-draft-case-replay.NOT_APPLIED.patch) | **compose-resume / produtor de drafts:** consultar o recibo de digest/incarnation originais sob o caso atual autorizado, revalidando escopo, fonte e draft ativo; preservar versão exata para qualquer novo write. Baseia-se no blob mais novo `d8a151c558227b3bd2612dbb6caba993efa85783`, preservando suas fences finais. Executar a contraprova positiva entregue e controles de troca material de caso, draft supersedido, ABA, cancelamento e revogação. |
| [02-atomic-create-binding.NOT_APPLIED.patch](patches/02-atomic-create-binding.NOT_APPLIED.patch) | **WP10 + collab-resume:** reserva host-private de identidade durante o callback de persistência, protegida pelo lifecycle, consumida pelo host e port no mesmo commit. O owner ainda precisa ligar a mesma instância de persistência usada por C08 à capability opcional; sem wiring, a recusa continua. Provar rollback, ACK perdido/reabertura, ABA e autoridade/fonte revogadas antes de reativar CREATE. |
| [03-unsaved-source-continuity.NOT_APPLIED.patch](patches/03-unsaved-source-continuity.NOT_APPLIED.patch) | **compose-resume / WP10 source authority:** reautorizar leitura da referência original, comprovar lineage física e projeção/fields/period atuais, responder continuidade pelo endpoint admitido. O owner da UI ainda precisa consumir essa resposta para manter o texto do draft legível com escrita desabilitada. Provar F04 positivo e negativos de leitura revogada, escopo reduzido, alteração material e ABA. |

Os três patches passaram somente por parsing e `git apply --check` contra cópias exatas dos blobs pinados. **Não foram aplicados a produto, typechecked ou executados.** O patch é proposta delimitada para revisão/integração do owner, sem crédito de aceite. [manifest.json](patches/manifest.json) registra cada source/proposed blob e SHA256.

Na reconciliação final, `astra-wp10` continuava em `a1434e7ea7340aa1d1c8ce6bb48958b724218170`. `compose-resume` avançou de `e1a1888bd2117616d53c5af5f5014e81c4b4e530` para `d86d119c15d1149fd6f463e07acce836b197eb4e` somente em guia/recibo, mantendo os blobs relevantes. Esses heads foram **consultados**, não incorporados à base de execução; [input-reconciliation.json](input-reconciliation.json) distingue inputs executados e propostas.

**Próxima ação da composição:** integrar/revisar os patches em ownership próprio, resolver typecheck externo e executar somente os aceites ainda abertos no candidato composto. Preservar a contraprova lost-apply/C12 anterior e os checks fortes da PR43. Não promover este incremento a fechamento global.

Recibos: [verification.json](verification.json), [run inicial](runs/43620533033.log), [run de correção](runs/43620871410.log). Nenhum provider, endpoint, contrato, workflow, fixture compartilhada ou branch de outro owner foi alterado.
