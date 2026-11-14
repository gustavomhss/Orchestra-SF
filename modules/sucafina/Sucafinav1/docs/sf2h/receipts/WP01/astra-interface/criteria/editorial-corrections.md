# Correções editoriais do catálogo final v3

Produto testado W16 `f4ed6dfd82502bcebc091b9be6ce74d4eccf89b7`. As 1.272 observações, os 31 runs e todas as notas históricas permanecem intactos. Nenhum resultado novo foi criado.

O catálogo W16 congelado foi preservado. Esta lista corrige os rótulos e vínculos atuais usados na entrega documental.

| Correção | Relação atual corrigida | História preservada |
|---|---|---|
| Hook | W16 tem quatro named PASS e nenhum hook; a nota genérica com W16 era incorreta. | O único hook e os dois nomes bloqueados são do W15; a nota incorreta anterior fica identificada como erro editorial no registro. |
| Recipients | Os dois candidateAttemptScopeRef de W15 saíram dos campos atuais de testes com PASS W16. | historicalAttemptScopes conserva o mesmo scopeRef, o hook O-9ee821ae4b66 e o run43593121437. |
| Limites de critérios | Treze limites antigos foram movidos de limitRefs para historicalLimitRefs; notas atuais separam os PASS W16, rebase/thread e seleção já implementados, o limite G03 e os três FAILs remanescentes. | Todos os textos/IDs antigos permanecem; nenhuma observation.scopeRef foi reescrita. |
| Componentes | decision_consumers, review_digest_consumer e browser_harness recebem escopos atuais delimitados. | Os scopeRefs anteriores foram preservados em historicalScopeRefs. |
| Ações antigas | Três ações W6d/W7 sem vínculos nas linhas atuais são rotuladas históricas/superadas. | O texto original de cada ação e seus vínculos foram preservados. |
| Recovery | G02 identifica os quatro PASS W10, o FAIL separado e F01/F03/F04; a revisão inicial sem execução saiu do campo atual. | historicalPatchScopes preserva o texto inicial e a ação anterior continua identificada. |
| Resposta tardia de revisão | D08 explicita o PASS do mesmo teste completo no W14, em vez de condicionar sua eventual execução futura. | A descrição anterior e a observação incompleta do W13 permanecem no histórico. |

A revisão não altera os critérios, produto, testes, timeouts, contratos, controles de acesso ou recibos. A prova W16 permanece limitada aos dois consumidores executados e ao lifecycle normal; o ramo de cleanup após cancelamento, os callers standalone e as causas de I/O continuam sem crédito novo.
