# ui-source — identidade física e replay

Status inicial: incremento seguro implementado; aceites dependentes de portas externas continuam abertos. Não é GLOBAL_RELEASE, nem substitui os 153 critérios WP01/WP02 ou os gates globais.

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

Critérios vinculados preservados: `WP02.INV.02`, `WP02.T04.CHK.01`, `WP02.T04.DOD.01`, `WP02.T04.QLT.02`, `WP02.T04.CMP.01`, `WP02.T04.CMP.02`, `WP02.T04.SUC.01`, `WP02.T04.SUC.02`, `WP01.T03.DOD.01`, `WP01.T03.CMP.01`, `WP01.T03.SUC.01`, `WP02.QLT.02`, `WP02.T02.SUC.02`, `WP02.T02.QLT.02`, `WP02.T02.CMP.10`.

## Provas e limites

Testes novos usam SQLite, identidade autenticada, autoridade, C08, lifecycle, issuer e hosts reais. Recibos CREATE legados/vinculados pré-carregados são dados explícitos de fixture; não são prova de CREATE atômico bem-sucedido. O avanço de caso é um evento de fixture autenticado por C08 com controle de versão, sem alteração de identidade, participantes, horizonte, moeda, critérios ou fonte. A contraprova é **lost-register**, sem chamada de apply; não é o C12 lost-apply anterior.

Produto é executado apenas em Actions, via protocolo `.ci-run.json`. O adaptador `static-checks.test.ts` executa `bun typecheck` no package e `bun run check:guards --base origin/dev` na raiz do runner, com processos Omni e base realmente buscada. Não altera workflows ou fontes compartilhadas. Diagnósticos externos permanecem falhas. Antes da publicação, somente parsing de sintaxe e validação pura oficial do request ocorreram localmente.

Provas anteriores de ACK/Escape/revogação não alteradas permanecem referenciadas pelo recibo PR43 e não são reexecutadas. O assert positivo do replay após avanço permanece `200` + recibo original; falha externa será publicada como falha. F04 nesta seleção é reprodução de fronteira de fonte, não aprovação do cenário de retenção do browser.

Os resultados W/S, blobs, run/jobs, patch proposto NOT_APPLIED, diagnósticos e handoff final serão anexados após a execução hospedada.
