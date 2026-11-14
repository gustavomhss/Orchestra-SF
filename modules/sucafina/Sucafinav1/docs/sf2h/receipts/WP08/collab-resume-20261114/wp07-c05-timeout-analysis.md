# C05 — análise independente dos timeouts W2

## Conclusão delimitada

O caminho feliz da preparação de uma resposta C05 executa **70 leituras completas de revisão**, antes de contar as operações de reissue/refresh da conversa. Na fixture real, cada uma dessas leituras resolve a mesma evidência C17 em três fases independentes: pelo menos **210 resoluções por uma observação**. Isso demonstra amplificação evitável da composição. Não foi identificado um self-deadlock no fence WP07 e esta leitura estática não mede qual operação consumiu cada milissegundo do run.

Base revisada: W4 `70af5b7d26bbc9456b1d9b9aa324bf2ae10668c4`. GitHub MCP confirmou `review-answer-source.ts` blob `fc1bebfdd8b1dd4b0536b7076f4305dfa91483d0`, `thread-context.ts` `20d98a976372338a22c947ee6bfcb9641c0429c5`, `runtime/local-store.ts` `eefc1ed550a455abc4952430ec3b57a5abd5c9ee`, Dashboard confirmation `fefdb4b7814be4953e1a5e7f12e2385e0a6a03c4` e source lifecycle `d0cab7f33b08806a6bb01a869fa789dc77e087ee`. As cópias lidas correspondem a esses blobs, descontada somente a newline adicional das cópias antigas de leitura.

## Contagem do caminho feliz

`recipient-thread` autoriza o contexto de revisão no início e no fim. Cada autorização chama `reviewThreadBasis`, que chama `threadContext.authorize`, que executa duas `reviews.read`. Portanto uma `threadReads.read` que passa pelo leitor de destinatário C05 executa quatro leituras completas da revisão.

| Componente chamado por `answerReuse.prepare` | Leituras completas C05 |
| --- | ---: |
| `answer()` — thread lida uma vez, mais `answerEvidence.issue` com duas leituras de thread | 12 |
| `belongsToQuestion()` — resolve → issue → duas leituras de thread | 8 |
| `scopeForAnswer()` — belongs 8 + thread 4 + resolve 8 + reviewThreadBasis 2 + source.resolve 2 + reviewThreadBasis 2 | 26 |
| `source.observe()` — contexts.read 2 + prepareAccess da fixture que repete threadContext.authorize 2 | 4 |
| Releitura `answer()` | 12 |
| Segundo `belongsToQuestion()` | 8 |
| **Total** | **70** |

Uma `ReviewPort.read` chama `authorizeSections`, `revalidate` e `revalidateEvidence`. Na composição de `review-answers-fixture`, os dois primeiros resolvem a origem por `sources`; o terceiro resolve a referência deduplicada pelo `BusinessContext`. Isso produz três resoluções por leitura. Resolução histórica ainda envolve emissão corrente, refresh, prova de continuidade e leases do Dashboard. As transações/serializações reais permanecem presentes em cada etapa.

No Meu trabalho, sem erro/fallback adicional, um item C05 unconfirmed faz `threads.read` (4), `recipientThread` (4) e `discussionsAgain` (4): 12 leituras. Um item valid confirmado avalia `answerWork` em duas passagens, cada uma com `resolve` (2) e `observe` (4): 12. Um item stale com pin também reabre a conversa e a prova final, chegando aproximadamente a 20. Essa contagem é estática, não telemetria do run.

## Transações e fences

`ReviewAnswerSource.observe` e `prepareThreadFence` recusam preparação quando `currentSnapshots()` já existe. Os dois fazem autenticação e `prepareAccess` antes de abrir sua transação de verificação. Dentro dela, o fence lê o snapshot corrente, verifica o digest C05 completo, métodos/providers, request e ACL, e usa o lease preparado. O lease Dashboard chama `checkScopedSource`; com snapshots correntes ele não abre outra transação.

`local-store.transactionAll` chama `operation(true)`. Se já houver `AsyncLocalStorage` de uma transação, `operation` marca o scope como poisoned e lança `Nested local writes are forbidden` imediatamente. Portanto uma chamada `transactionAll` aninhada não explica, por si, uma espera silenciosa pelo próprio lock. Seria uma falha imediata de composição; não foi observada dentro do fence WP07 inspecionado.

`currentSnapshots()` serializa/deserializa os três snapshots e os fences o chamam várias vezes. Isso contribui custo, mas não há medição que justifique retirar verificações pós-await ou mudar o runtime por esse motivo.

## Redundâncias que podem ser removidas com proteção equivalente

1. **Fixture `prepareAccess`:** `contexts.read` já autenticou a revisão duas vezes, conferindo pin, basis, digest e provider antes de entregar `selected`. A repetição de `services.threadContext.authorize` dentro do callback acrescenta outras duas leituras completas. Pode ser removida exclusivamente nessa composição privada se forem preservados ACL atual, digest integral `selected/pin`, ator/request, preparação real de leases de **todas** as referências da revisão e rechecagem desses leases no fence. Não há autorização fornecida pelo navegador nem cache global de ACL.
2. **WP08 host, maior multiplicador:** derivar o answerRef e sua identidade a partir da mesma thread autenticada já recebida, em vez de chamar `issue/resolve/belongsToQuestion` reiteradamente para reabrir a mesma thread na mesma fase. A ref deve continuar canônica, vinculada a question/message/incarnation/version e ao digest da mensagem/basis. Preservar as duas fases de leitura, a comparação final da thread e a validação de commit; não transformar `belongsToQuestion` externo em simples comparação textual permissiva.
3. **Não alterar `threadContext` para leitura simples ou remover fences:** suas duas leituras protegem troca de provider/snapshot e são fronteiras claras. O ganho deve vir de compartilhar material autenticado dentro da mesma operação, sem reaproveitar concessão entre requests e sem relaxar as contraprovas de revogação/substituição.

WP08 está preparando o delta de composição; esta análise não editou produto nem fixture.

## Evidência de execução preservada

Run `43616934900`, job `132513933634`, produto W2 `20821df310ebc6ea08ccab27e829008d72a04de6`: `review-port` 14 PASS e `dashboard-agenda-consumer` 1 PASS. `review-thread-context` não executou seus cenários devido ao erro de parser, corrigido em W3; sua validação runtime continua pendente.

Os dois casos C05 de confirmação falharam por timeout de 120000 ms, com durações reportadas de 312068.16 e 303803.18 ms. O caso antigo `host-answer-reuse` reporta 18876.44 ms: a diferença maior entre timestamps do log não deve ser rotulada como sua duração nem usada como prova de lock. O agregado W2 permaneceu FAILURE: 29 PASS, 4 FAIL, 1 error, 518 assertions. Nenhum teste local/remoto foi executado para esta análise; nenhum timeout foi aumentado.
