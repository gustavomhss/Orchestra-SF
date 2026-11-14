# work-g03 — G03 integrado e conflito/review verificado

**G03: PASS no consumidor composto. Entrega pronta para revisão e integração em `ui-work`; não é aceite global.** PR [#53](https://github.com/gustavomhss/Orchestra-SF/pull/53).

O fix publicado por Colaboração foi consumido verbatim. A contraprova real agora observa HTTP **409 `selection-not-committed`**, mantém a tentativa rejeitada bloqueada até revisão explícita e conclui a nova gravação, retry/reload e revogação sem duplicação.

## Implementação e origem

- Base `ui-work` / input PR47: `79ebf5555eddaa4b5b8b57cbe1df7c5ad22b1244`, tree `d0508747f0818b3467f44bac845ca6a878bdb7ea`.
- Origem do fix: `20821df310ebc6ea08ccab27e829008d72a04de6`. Head inicialmente conferido: `dc21cd389de67c2e7fac996b663d9c0aa7d8cae5`.
- Rechecagem final de Colaboração: `9e1f44af7689946d27d37ed48b9f5e9849417121`, tree `ac88fa893a3b8b9f36c4373c2889652025fcf0f3`; o mesmo blob permanece publicado.
- Único arquivo de produção consumido: `product/collaboration/case-selection.ts`, de `ec80e2916c8a06cbb471cf02e30bb1cb5ebd9cc0` para **`cd9a67887f41986243809672572c972440c832ec`**.
- O diff reconhece exclusivamente C08 `conflict / product-state-changed` como rejeição conhecida antes do commit. Os demais resultados, CAS, autorização, fontes e fences permanecem iguais. Nenhuma closure adicional foi necessária.
- Consumidor UI preservado: `product/ui/case-work-selection.ts`, blob `cc0bfcdbd7b31d1aa31d65300251b574aaad4fb9`.

[Diff exato aplicado](patches/g03-published-intake.APPLIED.patch), [proveniência inicial](intake.01.json) e [pins/equivalências](validation.json). O consumo foi feito referenciando diretamente o blob publicado na árvore Git, sem reimplementar o produtor.

## Prova observada

Run [**43625362178**](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43625362178), job `132539863339`, teste G03 em **7.696,05 ms**, mantendo o limite de 45.000 ms.

| Etapa | Resultado observado |
| --- | --- |
| Concorrência real pela API | Concorrente 200; tentativa original 409 com payload exato. Nenhum 503 aceito como conflito. |
| Estado rejeitado | Checkbox, caso, sourceRef e período 01–31/03/2026 preservados; inputs e Salvar bloqueados. |
| Revisão explícita | Uma releitura do caso e uma leitura da versão; zero gravações; campos liberados sem redigitação. |
| Nova intenção revisada | Chave nova e `expectedStorageVersion = 1`; mesmo draft de caso/fontes/período. |
| Perda de resposta e retry | Resposta danificada somente depois do commit real; corpo/chave idênticos no retry; estado protegido inalterado. |
| Reload autorizado | Links recuperados com `selectionRef` e período corretos; nenhuma criação automática. |
| Revogação real | Logout 204; listagem 403; contexto/links/inputs apagados; exatamente um evento de revogação. |
| Replay após revogação | Mesmo corpo/chave com a sessão antiga devolve 403, apesar de existir recibo. |
| Persistência e reload revogado | Nova sessão autorizada observa o mesmo estado; navegador revogado continua recebendo 403 no reload. |

**Contabilidade de efeitos:** revisões de armazenamento `0 → 1 → 2`. Há uma seleção legítima do concorrente e uma da nova intenção explicitamente revisada. Rejeição, retry, reload e replay revogado acrescentam **zero** efeitos; nunca surge uma terceira seleção. A sequência HTTP de create foi `[200, 409, 200, 200, 403]`.

A prova usa o mesmo consumidor e o fixture compartilhado publicado: HTTP de Colaboração, fontes, C08, SQLite e sessão criptografada reais. O caso é corpus semeado em transação protegida e lido pelo port real. Não qualifica host instalado, execução nativa, question attachment, reemissão histórica ou WorkSignals.

## Candidatos, snapshots e resultados

| Run | W: candidato | S: snapshot CI | Resultado |
| --- | --- | --- | --- |
| [43624801241](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43624801241) | `034d03c4721367a00fb0f546eed98b3ad047b0f9` | `4a63cfecb426dcca14ed8d55a3790f25eab6e6fa` | 2 pass / 2 fail. G03 chegou ao 409 e às verificações de replay/revogação, mas falhou na observação do último reload; um diagnóstico novo de tipo no teste. Falhas preservadas. |
| [43625362178](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43625362178) | `bbebc56623f326572dd25d0e0d20655da4904eba` | `3a278f0bafd7cb9e255b28b0babce45a6c9d05a0` | **G03 PASS**, startup/finalização PASS, guards PASS; 3 pass / 1 fail no total por typecheck externo. |

W1 tree: `3ccd6bfa9311adf20ab341a519af3c1e2f3c648b`. W2 tree: `ada91397233d12b9a6ee2bafaac3f85cf51a3c46`. S1 tree: `299df80b88f87e75dfe7848d644fd5bb2534f926`. S2 tree: `b4c6de249a60aa234058865bd47c5b323ba53d25`.

Cada W→S contém somente `.ci-run.json`; todos os inputs de produto/testes/configuração/fixtures são idênticos dentro do par. W2 altera apenas o teste exclusivo e acrescenta recibos sobre W1; o produto permanece igual. Os arquivos finais de handoff são novas evidências sobre W2. O head/tree da entrega e o run do guard final ficam registrados externamente na PR #53, sem autorreferência.

Os requests foram aceitos pelo validador canônico do workflow. A seleção executou exatamente quatro testes em quatro arquivos, com `./` e startup/finalização em ordem. Omni passou com nonce correspondente, dois testes declarantes, quatro spawns e zero delegação. Um Chromium foi lançado; uma lease adquirida/liberada; zero contextos restantes e saída física do processo confirmada.

[Run 01 preservado](run-01.json), [run 02 completo](run-02.json), [request 02](ci-request.02.json). Nenhum teste local, epic ou rerun sem hipótese causal. As jornadas de replies previamente aprovadas não foram repetidas.

## Checks estáticos e limites

`bun typecheck` foi executado em `modules/sucafina`: **FAIL**, com **zero diagnósticos próprios e nove externos**. As localizações coincidem com o run anterior `43622153636`: cinco em `apps/cli/src/sucafina-product/host-context.ts` e quatro em `test/product/wp07/review-port.test.ts`. Esses arquivos são readonly nesta missão; o resultado não foi mascarado.

`bun run check:guards --base origin/dev` passou no snapshot S2: 78 regras, 935 paths examinados, zero gate findings, 52 avisos e zero erros. A base foi efetivamente buscada no runner. O guard final da entrega usa somente [ci-request.03.json](ci-request.03.json) e seu resultado é registrado na PR com o checkout correspondente; não reutilizar o guard de S2 como execução de outro SHA.

## Teste legado e próxima ação do owner

O teste antigo `test/product/ui-split/ui-work/selection-recovery.test.ts` espera o botão Salvar habilitar enquanto a UI está corretamente em `rejected`. Esse arquivo permanece readonly. O novo teste exclusivo corrige a observação preservando a exigência de 409 e os assertions originais.

O [patch delimitado para o owner ui-work](patches/ui-work-g03-observation.NOT_APPLIED.patch) está **NOT_APPLIED / NOT_RUN** no arquivo legado. Antes de incluí-lo em uma seleção mais ampla, o owner deve reconciliar essa espera. A prova nova desta PR já exercitou a observação correta; não é alegação de que o arquivo antigo passou.

Próximas ações concretas:

1. S0/ui-work revisar e incorporar o delta pequeno da PR #53, preservando os pins e recibos.
2. Owner ui-work reconciliar o patch do teste legado quando consumir essa seleção.
3. Composition/WP10 e WP07 resolver os nove diagnósticos estáticos em seus próprios arquivos.
4. Manter confirmações/reuso C03, recibo de destinatário e host instalado com as frentes responsáveis; este G03 não concede aceite a essas jornadas.

## Critérios preservados

[criteria.json](criteria.json) registra a contribuição para WP01.T03, T04 e T05, os invariantes pertinentes de WP02 e C03/C06/C08, sem promover os critérios amplos inteiros. O universo continua com **75 critérios WP01 + 78 WP02**, e a fonte imutável continua com **15 WPs, 74 tasks, 17 contratos e 1.610 critérios**.

**GLOBAL_RELEASE: não declarado.** Sem merge, alteração de branch do produtor, mudança de política ou escrita em namespaces das outras fatias.
