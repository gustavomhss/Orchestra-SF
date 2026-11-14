# work-ack — entrega e próximo owner

**Rota entregue: dependência externa reproduzida, UI inconclusiva preservada e patch aplicável preparado. O ACK positivo do destinatário continua aberto.**

PR: [#54 — work-ack → ui-work](https://github.com/gustavomhss/Orchestra-SF/pull/54). Não houve merge nem alteração de produtor, host ou fixture compartilhado. Esta é a leitura de fechamento; `README.md` e `INPUTS.json` preservam o estado do primeiro candidato.

## Produtor realmente consultado

O head inicial de Colaboração foi `dc21cd389de67c2e7fac996b663d9c0aa7d8cae5`. A última consulta fixada nesta entrega encontrou `collab-resume` em `9e1f44af7689946d27d37ed48b9f5e9849417121`. O avanço alterou dois testes de Colaboração e acrescentou um recibo; o arquivo `product/collaboration/recipient-actions.ts` permanece no blob `496df344b314df69e5e4d9896aa794ffc84f3cc1`.

Esse produtor ainda grava `value: true` no C08 e retorna `input.read(id, context)`. A projeção `RecipientThread.current` não publica a identidade durável da mutação. Por isso nenhum contrato proposto foi habilitado no consumidor. `product/ui/work-collaboration.ts` permanece no blob `175ff36fe09405e0f31dd55207d751e3753f6ffb`.

Os testes hospedados executaram o produtor **retido em work-ack**, blob `9054624ad9cc632f4ba945bdc75b1034a5da16a6`; a ausência de recibo no head ativo foi verificada por inspeção do arquivo fixado. Os testes não executaram o head ativo completo nem o patch.

## Evidência hospedada

| Identidade | Valor |
| --- | --- |
| W testado | `6efc22ad55ceb646026d92b80aadd6192ecd033a` |
| Árvore W | `c0df2145715bae65aded22d54b6c59b62054cae4` |
| S do snapshot | `d68be8e7735489a7fc6d3c5518a53ea28a45a87c` |
| Árvore S | `22cbd51be1475ed9a9e00f34fc4b35ea81113912` |
| Request SHA256 | `c6aca28b69e689878cf930068da2fbcb8e4a5c15f9d62851d729f29f4c6b8c74` |
| Run / job | [43625483916 / 132540241299](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43625483916/job/132540241299) |

O diff completo W→S contém somente a adição de `.ci-run.json`, blob `b1cb18d98c40bf0eff05a20049bdcb95ed2874f5`. Todos os blobs existentes de produto, testes, fixtures e configuração são iguais.

Resultado: **4 pass, 1 fail, 84 assertions, 5 testes em 4 arquivos**. As duas contraprovas e o startup/finalização física do Chromium passaram. Omni: **pass**, dois testes declarantes, quatro spawns e zero delegações. A única falha é o gate combinado de typecheck/guards, por typecheck. O run completo permanece **failure**.

| Contraprova | Observação real | Limite |
| --- | --- | --- |
| Resposta inutilizada após commit → revogação → retry → reload | Um append real, texto congelado na tentativa inconclusiva, retry com mesmo corpo/chave retorna 403, DOM/contexto protegidos removidos; em b2 o GET do caso retorna 503 e a leitura própria da conversa retorna 200/current; sem reenvio ou append adicional. | Leitura corrente não é ACK. A navegação Chromium lançou `ERR_HTTP_RESPONSE_CODE_FAILURE`; o 503 foi comprovado pelo GET corroborante. |
| Mensagens iguais → marcador removido → Boolean | Duas respostas de mesmo autor/texto com IDs distintos; o resultado durável real consultado no C08 é `true`; remover `current` do transporte e depois entregar Boolean não confirma a tentativa. Retry mantém corpo/chave, mensagens e versão armazenada. | Índices/texto/autor apenas descrevem o corpus observado, nunca associam uma intenção ao ACK. |

A primeira prova danifica a entrega JSON **depois** de o produtor real concluir. A segunda altera somente a forma entregue de respostas reais. Nenhuma delas fabrica um recibo produtor positivo. Os dois eventos do log registram `acknowledged: false`.

`run-02.json` contém os eventos, diagnóstico completo, hashes e relações de versão. `run-01.json` conserva a tentativa anterior [43624884278](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43624884278): 3 pass/2 fail, expectativa incorreta de reload 200 e um erro de tipagem readonly no teste próprio. A correção manteve b2, todos os fences, revogação, fixtures e deadlines. Não reclassifica a tentativa anterior como PASS.

### Typecheck e guards

`bun typecheck`, em `modules/sucafina`, retornou 2 com **9 diagnósticos externos e zero próprios**: cinco TS2322 em `apps/cli/src/sucafina-product/host-context.ts` e quatro TS2739 em `test/product/wp07/review-port.test.ts`. As nove mensagens são exatamente iguais às registradas no run histórico 43622153636. Esses arquivos permanecem fora do delta desta fatia.

`bun run check:guards --base origin/dev` passou no snapshot S: **78 regras, 937 paths, zero gate findings, 53 warnings, zero errors**. A base foi obtida no runner hospedado. Isso não é guard da entrega documental posterior.

Um warning novo, `GUARD-ACK-01`, é falso positivo de `test-timeout-raised` no timeout HTTP `5_000`: o regex conta o separador numérico como caractere e o classifica como dez segundos ou mais. O valor efetivo é 5000 ms. O finding fica reportado em `validation.json` para o owner Guardrail; não foi acrescentado ignore, aprovação ou mudança de regra. Os outros 52 warnings têm texto idêntico ao primeiro run. Nenhum prazo foi aumentado.

O commit que contém este handoff acrescenta somente arquivos evidenciais novos. O **resultado posterior dos guards dessa entrega** é publicado externamente no fechamento da PR #54, com seu SHA/snapshot/run, sem reescrever estes recibos nem atribuir o run de W à entrega.

## Patch aplicável ao owner Colaboração

Arquivos: [patch](c03-recipient-receipt.NOT_APPLIED.patch), [request detalhado](OWNER_REQUEST.md) e [seleção preparada](owner-regression.ci-request.NOT_RUN.json).

- Preimage: blob `496df344b314df69e5e4d9896aa794ffc84f3cc1`, SHA256 `70e8c3eaa6b157b8e138e87b650cf5b31a4022bc07808f4e6a8ae04181877ccd`.
- Patch SHA256: `8e056e78914b0287dfd54d330e5e9e03358fd65f0591699dfeba563c4cb1ec71`.
- Postimage proposto: blob `29ba733fd88814cfc4f872cc9c6c6bde66a814c3`, SHA256 `ce70802c8301eaf763e8462f338db321bf49c9a8b1043862e8eafed508403021`.

A aplicação textual foi conferida em cópia isolada do preimage, incluindo `git apply --check` e igualdade exata do postimage. Houve revisão estática independente dos hunks e dos oráculos. **NOT_APPLIED / NOT_COMPILED / NOT_RUN** no produto.

A proposta grava no mesmo commit C08 a identidade da ação, thread, principal, chave, digest original, digest da intenção completa e mensagem/incarnation/versão. O retorno usa `saved.value`; replay recupera o recibo original antes de checks de novo append/resolução e não reabre a conversa. Chave reutilizada com corpo ou expectedStorageVersion diferente é conflito. Boolean legado e versão de mensagem indisponível permanecem inconclusivos. A leitura final e a admissão humana/host são revalidadas; fontes de review conservam seus fences. Esses comportamentos são **propostos**, não resultados dos testes desta PR.

O request do owner exige dez witnesses, incluindo mensagens iguais, perda de retorno, replay após resolução, conteúdo/versão de entrada divergentes, Boolean legado, versão de mensagem alterada, revogação e fences de fonte/review. A seleção existente preparada não substitui os novos witnesses.

## Critérios e fronteiras

A norma permanece fixada em `dbf9547211d9b0fade619790de7c19c0869b7c7d`, campaign SHA256 `703dd257274bed829a978705de548cd1383225bf7aac76445104c053e2bb5fba`. Os 75 critérios de WP01 e 78 de WP02 estão enumerados e preservados em `validation.json`.

Este delta contribui apenas para os aspectos negativos de WP01.T03.CHK.01/INV.01/CMP.01, WP01.T05.INV.01/CMP.01/CHK.02 e WP01.INV.01. WP01.T03.DOD.01/SUC.01 e WP01.DOD.03/CMP.02 continuam sem aceite integral. As obrigações Hot Topics WP02.T04.CHK.01/QLT.02/CMP.01/SUC.01 não são testadas por replies. C03 continua aberto para recibo exato do destinatário. C06 continua exigindo confirmação humana por escopo, autorização e continuidade; ACK de transporte não é confirmação humana nem aprovação financeira.

As três jornadas aprovadas de ui-work foram reanexadas por seus SHAs e pelo run 43621603578, sem repetição: snapshot direto C08 com mensagens iguais/retry/reload, projeção recipient inconclusiva com retry/leitura fresca e seleção do primeiro ciclo com resposta perdida/reload. Aquele run completo teve 5 pass/2 fail; suas falhas de G03/confirmação e identidade histórica permanecem intactas.

As provas novas usam HTTP de Colaboração, produtores e SQLite reais, com autenticação/leases explicitamente fornecidos pelo fixture. O vínculo inicial pergunta/caso é semeado e o attachment final de answer não está montado. Não se declara instalação, identidade nativa, GNATIVE, AM01–AM06, G7/G8 da campanha ou release global.

**Reload não preserva hoje corpo/chave da tentativa pendente:** `replyRequest` vive apenas na closure. O teste prova ausência de reenvio/disclosure e leitura autorizada separada. Ele não prova recuperação de intenção nem ACK exato após reload.

## Handoff para S0 e owner

1. **Colaboração:** conferir o preimage no head vigente, aplicar a proposta no seu namespace, acrescentar os witnesses de recibo exato e publicar W/tree, S, run/jobs, typecheck e guards reais.
2. **S0:** revisar/versionar o contrato aditivo e os consumidores afetados; admitir o incremento pelo SHA e atribuir o consumo da UI e a recuperação de intenção. Tratar separadamente os erros externos de typecheck e encaminhar GUARD-ACK-01 ao owner.
3. **Owner UI atribuído:** consumir o recibo realmente publicado, recuperar/reconciliar a intenção pendente sob autorização fresca e provar o ACK positivo no mesmo candidato composto, com contraprovas de mensagens iguais, retry, reload, divergência e revogação.

Estado de fechamento desta fatia: **contraprovas PASS; dependência reproduzida; patch aplicável entregue; ACK positivo ainda não concluído; PR draft para revisão e composição.**
