# Forecast — Cancelar e conclusão da jornada U30

## Resultado e autoridade

**Missão: READY_FOR_INTEGRATION. Finding `WP10-U30-CANCEL-VISIBILITY`: RESOLVED_WITH_EVIDENCE no candidato `ui-review@765a9a5b86c21791ed59152098971b2dfbe8398e`, dentro da fronteira de UI/HTTP explicitada abaixo.**

A correção está aplicada na mesma branch e [PR45](https://github.com/gustavomhss/Orchestra-SF/pull/45), base `interface-resume`. O handoff anterior de Review em `32bae2bcc8008b2e81948e434dc1e3326dc4f947` foi reconciliado; seus arquivos, commits, provas, findings e propostas permanecem intactos. A autorização desta sessão veio da missão 12 e do handoff terminal publicado, não de silêncio no Git. As atualizações da ref foram fast-forward com expected-head/CAS.

Este é o handoff terminal da sessão `forecast-cancel-visibility-20261114`, ator S1-A. A escrita desta fatia fica encerrada após a publicação; nenhuma autoridade é transferida sobre outras branches ou frentes. Apoios de leitura fizeram inspeção estática, sem escrever produto ou executar CI. Seus preflights não substituem os pareceres finais independentes da campanha.

A entrega anterior de Review continua **PARTIAL_OWNER_INTEGRATION_REQUIRED**. Este trabalho não encerra os findings `IR-EXT-C05-WHOLE-REVIEW`, `C05_PRESERVED_MEETING_HISTORY` e `IR-EXT-WORK-REVIEW-CONTEXT`, nem transforma as propostas de reader/mount/My work em mudanças aplicadas. O [texto anterior da PR](attempt-01/pr45-before.md) está preservado integralmente.

## Causa demonstrada antes da correção

O diagnóstico [43632553311](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43632553311), sobre produto sem correção, reproduziu **3 pass / 1 fail, 35 assertions**. A captura atômica leu DOM e CSSOM sem alterar estilos, atributos, eventos de submit ou prontidão:

| Campo no instante ready | Antes | Depois, run principal |
| --- | --- | --- |
| Controller pronto | `true` | `true` |
| Último read | `ui-fixture-run / ready / version 1` | Igual |
| Corpo de resultado renderizado | 1 | 1 |
| `hidden` atributo/propriedade | `"" / true` | Igual |
| `computedStyle.display` de Cancelar | `flex` | `none` |
| Retângulos renderizados | 1 | 0 |
| Moeda observada | EUR | EUR |

A regra de autor correspondente era `button,.button{display:inline-flex}`. O valor computado torna-se `flex` porque o botão é um item do formulário flex. O atributo `hidden` estava correto, mas essa declaração mantinha o botão renderizado. A mesma falha foi capturada no controle real **Refresh analysis status**, inclusive antes de iniciar. A hipótese estática inicial só recebeu crédito causal depois dessas observações.

A prova antes/depois, os requests e os logs completos permanecem em [attempt-01](attempt-01/) e [attempt-02](attempt-02/). O U30 original 43629303473 pertence a W `d4fb072fa9bd32ebfef2b9cbc9b27b998d34f4e7` / S `84432d8ab3a5f1619eb2e96652290434d2bb0a2e`; `54317229` é seu input documental posterior, não o W daquele run.

## Correção mínima aplicada

| Arquivo | Preimage ui-review | Blob corrigido | Delta |
| --- | --- | --- | --- |
| `src/screen-shell.ts` | `2aeacf2c05e86fef28947c5332284f3089e00049` | `c57e1f01044d12bf5c86bb5d7d68408950a83fc1` | Acrescentar `button[hidden],.button[hidden]{display:none}`. |
| `product/ui/forecast-analysis.ts` | `973a2f09b394426364c514b923ecdc8e10ffb184` | `dad8eeb1879e6c93bc9a448c6567fc0e2ee0f747` | Acrescentar `cancel.remove(); retryStatus.remove()` na revogação permanente, preservando as guardas e flags anteriores. |

O controller de ui-review/WP10/WP12 era byte-idêntico. O shell de ui-review tinha uma correção própria de Escape/`aria-expanded`, integralmente preservada. Não houve substituição cega pelo shell de WP10. Start e os botões ativos conservam seu display/comportamento; refresh mantém sua lógica de erro e retry.

A correção foi publicada em `e32b25ce4ed383fcc61d6133a4635b612b289ce2`. O commit seguinte `cecd1de9` somente alinhou a resposta de cancel da fixture ao contrato real `{cancelled:true}`. O último W `765a9a5b` apenas corrigiu a observação do teste de revogação e acrescentou recibos; o produto continuou idêntico.

## Provas executadas e resultados integrais

| Tentativa | W | S | Run / resultado |
| --- | --- | --- | --- |
| Diagnóstico causal | `f250a790f80710f939f02f1cc28ec6174887fc37` | `ed3dfa599723630aec7fe72d746ac7dd5fff15e9` | [43632553311](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43632553311): **FAIL 3/1**, 35 assertions, 4 testes/3 arquivos, 12,11s. |
| Seleção principal corrigida | `cecd1de92bf4cbed7d6735e74fd5ffd4944e7dde` | `a03193f99c3e28c149e1d47c5913b3a673fecc27` | [43633001171](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43633001171): **FAIL 14/1**, 280 assertions, 15 testes/6 arquivos, 23,12s. |
| Recheck da revogação | `765a9a5b86c21791ed59152098971b2dfbe8398e` | `d332d30008e5bc4933d7cbd76ca08b3ca60608d3` | [43633471899](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43633471899): **PASS 4/0**, 65 assertions, 4 testes/3 arquivos, 11,93s. |

A seleção principal passou o U30 completo e todos os estados, cancelamentos, retries e revogação HTTP403. A única falha era uma expectativa nova do teste: aguardar o formulário continuar conectado após o evento global de revogação. O shell real substitui a tela inteira por `main[data-access-unavailable]`.

O recheck conserva todas as condições de limpeza e os deadlines. Ele aguarda a nova tela real e usa referências somente de leitura aos nós antigos para verificar, depois da desconexão: Cancelar/refresh ausentes, seis campos limpos e bloqueados, configuração removida, histórico sem case/ref/output e conteúdo antigo ausente na tela atual. **Nenhuma mudança adicional de produto foi necessária.**

O run 14/1 continua FAIL; não é apresentado como 15/0. Os passes não afetados são reanexados por igualdade de blobs de produto, testes, helpers, fixtures/config e ambiente. O compare de W2 para W3 altera somente `revocation.test.ts` fora dos recibos. O recheck executou o arquivo de revogação inteiro porque o pool exige seleção explícita de arquivos. Ver [scope-and-reattachment.json](scope-and-reattachment.json).

## Jornada e matriz cobertas

- **Antes da execução:** Cancelar e refresh ocultos; controller realmente pronto; Start visível/habilitado.
- **Ativos:** `preparing`, `queued`, `running`; Cancelar visível e habilitado; campos e Start bloqueados.
- **Terminais:** `ready`, `needs-input`, `unavailable`, `failed`, `cancelled`, `stale`; Cancelar/refresh ocultos; seis campos reabilitados; EUR preservado.
- **Cancelamento:** clique único e payload com runRef exato; confirmação direta e HTTP503 depois de a fixture aplicar o cancelamento, recuperado somente por consulta de status.
- **Retry de status:** falha no primeiro read mantém Cancelar oculto; falha depois de running conserva o último estado cancelável; refresh usa o mesmo runRef sem duplicar prepare/start.
- **Revogação:** HTTP403 limpa o formulário e remove ações; evento do shell limpa o DOM antigo e remove a tela/resultados.
- **U30 positivo e negativo completos:** submit implícito real, clique positivo, guarda de fontes iguais, Enter negativo409, ordem prepare → start → read → output, payloads completos, chaves em todas as requisições, EUR, Start/Currency reabilitados e `pageErrors=[]`.

Os **17 statements de assertion originais** do U30 permanecem intactos. Removendo apenas a instrumentação de leitura e normalizando a extração/imports da fixture, o corpo dos dois testes é exatamente igual ao original: SHA256 `f23bf546bc4e2d58876bbce147255fc8aa888c6caad73587bd2cd6a8023a7f7f`. Ver [equivalência](attempt-02/u30-equivalence.json). Nenhuma assertion original foi retirada, nenhum botão foi escondido na fixture e nenhum deadline foi aumentado.

## Execução, controles e limites

As três tentativas ocorreram somente em GitHub Actions, com requests canônicos de `test-ci`, dedupe prévio e no máximo um run desta missão em voo. Cada S é filho de seu W e acrescenta somente `.ci-run.json`; as seleções efetivamente observadas foram comparadas com os requests. As branches temporárias pertencem ao protocolo de snapshot e foram limpas pelo workflow; a branch de produto continua ui-review.

Omni passou em todas as tentativas, com uma declaração/um spawn/zero delegações. O pool comprovou uma única instância Chromium, liberação de todas as leases, zero contextos e encerramento físico do browser/driver. Cleanup passou; artefatos retornados foram `[]`; a prova está nos logs completos e nos recibos estruturados, não em screenshots inventados.

**Typecheck e guards deste delta: NOT_RUN.** Os workflows disponíveis fazem checkout de refs fixas de outras frentes; a missão não autoriza alterar workflows/configs compartilhados nem movimentar essas refs. Não houve teste local, wrapper de checks escondido como teste, epic/full suite, reset, merge ou novo PR.

A fronteira exercitada contém renderer/controller/shell, catálogo distribuído e browser reais. **Caso, fontes, modelo e respostas HTTP são fixtures explícitas.** O 503 de cancelamento não representa desconexão física; nenhuma resposta read/output foi deliberadamente retida para atravessar revogação. Não se declara cálculo/producer Finance real, modelo/sessão nativa, persistência nativa, AM01–AM06, auditoria responsiva completa ou GLOBAL_RELEASE.

## Critérios, consumidor e próxima ação

[criteria.json](criteria.json) mapeia contribuições locais aos textos canônicos de WP01.T05.CHK.31/CMP.01/CHK.02/INV.01/QLT.01, WP01.T03.DOD.01/CHK.01/SUC.01 e WP01.INV.01. Esses critérios integrais permanecem sob o aceite da campanha; a prova desta fatia não os encerra por contagem.

**Consumidor: WP10/S0 e revisores do candidato composto.** Portar apenas os dois deltas de produto, conferindo os preimages atuais e preservando o restante do shell/controller. Executar typecheck/guards no caminho autorizado da composição e revalidar o consumidor se seu produto/fixture/config relevante mudar. Não atribuir o green desta fronteira à preparação financeira ou à integração ainda não executada em outra branch.

Todos os novos testes/helpers estão em `test/product/forecast-cancel-visibility/` e os recibos neste namespace. `work-collaboration.ts`, `runtime/downloads.ts`, hosts, configurações/fixtures compartilhadas e E2Es das outras sessões permaneceram intactos.
