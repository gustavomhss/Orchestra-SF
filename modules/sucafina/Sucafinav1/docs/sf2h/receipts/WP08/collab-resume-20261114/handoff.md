# WP08 — handoff da retomada de Colaboração

## Estado de entrega

O produto está publicado em `collab-resume`, W7 `9e1f44af7689946d27d37ed48b9f5e9849417121`, tree `ac88fa893a3b8b9f36c4373c2889652025fcf0f3`, pai W6 `dc21cd389de67c2e7fac996b663d9c0aa7d8cae5`. W7 altera somente dois arquivos de teste e o recibo do incremento; código de produto e fixtures compartilhadas continuam iguais a W6. A [PR#41](https://github.com/gustavomhss/Orchestra-SF/pull/41), base `sf2-stack`, preserva [#33](https://github.com/gustavomhss/Orchestra-SF/pull/33) como origem. Nenhuma PR antiga foi fechada e não houve merge.

O [run W7 43625515062](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43625515062), job `132540336771`, snapshot `a4f8c7bd673de3e4092f20185f4c3ea2d10d0ec3`, está **SUCCESS**. Foram selecionados somente os cinco nomes alterados nos dois arquivos. Os cinco casos completos passaram; as provas são limitadas ao produto/SQLite e às fronteiras de autoridade descritas.

W6 terminou **7 PASS/3 FAIL**. Seus sete PASS permanecem válidos no escopo exato: confirmação/SQLite reopen, fonte corrente distinta/revogação, lease/substituição física, histórico genérico, host, primeiro HTTP e unit reuse. B excedeu 120 s em 149408.75 ms. Os dois R10 chegaram à recusa esperada após a edição humana, mas falharam depois ao ler estado privado de um snapshot sanitizado; ambos continuam FAIL nesse run. W7 corrige somente a observação do teste e distribui B em três cadeias completas.

O último check estático verificado, W4, tinha 69 diagnósticos externos idênticos à baseline, zero próprios e guards PASS. O único gate estático final cobrirá W7 e os recibos; a conclusão será publicada na PR sem commit autorreferencial. Desempenho medido e composição instalada ausente continuam pendências separadas.

O conjunto mantém **330 critérios e 17 tasks**: [WP07](../../WP07/collab-resume/criteria.json) 86/4, WP08 132/6 e [WP09](../../WP09/collab-resume/criteria-112.json) 112/7. O [mapa WP08](criteria-132.json) conserva **132 critérios literais** (109 das seis tasks, 23 do WP), implementação/consumidores/testes, casos por W/S e deltas por owner. As provas cirúrgicas novas estão associadas a 37 critérios: 23 com W6/W7 e 14 com W5. Outros 82 conservam evidência parcial e limites anteriores; 13 preservam provas anteriores nos seus escopos. O [índice](criteria-index.md) mantém todos os IDs. Nenhum teste isolado é promovido à conclusão integral de critério ou prova nativa.

## Proveniência e publicações

| Marco | Head | Tree | Conteúdo relevante para WP08 |
| --- | --- | --- | --- |
| Retomada | `2784daafbb0d3b58b6019822288a07fa38e5c5b0` | `fd1c89074488008ff0e60fd07577268a34329069` | Trabalho publicado na origem #33, incluindo os packs e recibos reconciliados. |
| W1 | `ff557552936197b6734e57f0ecea0c44b19139b1` | `0349fb1b18315a9c7c0cadb04b738ea499beda05` | Correções WP07/WP09; nenhuma fonte WP08 alterada. |
| W2 | `20821df310ebc6ea08ccab27e829008d72a04de6` | `98d5c2f4f62a778f4acf6ec1b69ef5bfd19d5783` | C05 recipient/fences/answer/Meu trabalho, recusa C16 sem pin e G03 CAS. |
| W3 | `34f26821f62a99ae40ca1e69f4bded602f83768e` | `25e89787b9c49dd97078db999bc74dfad57e1818` | Um parêntese excedente removido no teste WP07; fontes WP08 preservadas. |
| W4 | `70af5b7d26bbc9456b1d9b9aa324bf2ae10668c4` | `44a6c14f500f88dc8b01f82f64dedb6cc4d3c47f` | R09: lease imutável por contexto admitido; contraprova de repinagem; narrowing explícito do resultado C08 no teste G03. |
| W5 | `0d9820924b33a8fc7b145f54a675aeef76c98489` | `39cec0a91dc5ebc2dde012d4d1d8b63166074373` | Remoção de duplicação e contraprova física; o leitor histórico incondicional expôs regressão fresca e a jornada longa ainda excedeu120s. |
| W6 | `dc21cd389de67c2e7fac996b663d9c0aa7d8cae5` | `0a5eea5d992e65153fae6999ce3e7e4d109f30b0` | Base corrente genérica restaurada, membership C05 privado, redução de leitura duplicada, R10 e jornadas causais completas com todos os oráculos. |
| W7 | `9e1f44af7689946d27d37ed48b9f5e9849417121` | `ac88fa893a3b8b9f36c4373c2889652025fcf0f3` | Somente testes: B1/B2/B3 completos e revisão C08 definida antes/depois em R10. Produto/fixtures inalterados. |

O plano permanece em `dbf9547211d9b0fade619790de7c19c0869b7c7d`; os packs e handoffs completos foram lidos na origem indicada. As tasks, cláusulas de aceitação, critérios e exclusões permanecem intactos. O recibo anterior principal é `docs/sf2h/receipts/WP08/collaboration-reconciliation/criteria-132.json`, blob `3eb8e99da9f1dba13fe3f4934074d5f39e26b40e`, no head inicial.

A reconciliação não depende da descrição atual das PRs. Os heads preservados de #27, #28 e #30 são, respectivamente, `9839a46aa8d4e379268b2a724050247e2a0d8aa1`, `08d808aa91696a30c6eb04293858fcae4fde4229` e `1998acb0dcb59e68d41ee924eca4737bccbd5148`. A #33 já continha consumidores e correções posteriores às descrições antigas. Nenhuma árvore inteira foi copiada e nenhum ramo antigo foi alterado.

## O que foi reaproveitado

Relações, comentários, perguntas, respostas, histórico de mensagens, continuidade física, seleção de trabalho, handoff e confirmação por escopo já tinham implementações e testes publicados. A retomada conserva esses caminhos e reanexa suas provas cirúrgicas. As provas anteriores de alteração material/irrelevante, dependências mensais, ausência versus zero, ACL restaurada, substituição física, handoff idempotente e primeira confirmação HTTP continuam ligadas ao produto em que realmente rodaram.

O antigo B01 Procurement sobre `approvalStage` está resolvido no produto herdado. O commit `a3dcbb62c88231f95a7c57afb32e975404a3b59c` alinhou o projector de integração ao produtor. O blob `3e8830c3dddc8b9609f583f877b2fe7458eccd28` está preservado no head retomado. O teste idêntico `work-presentation.test.ts`, blob `43103eea4e7a10e8da2f799a2495894627ce528a`, passou em CI04 e verificou etapa Manager, título, destino, identidade canônica e revogação. A aprovação legal, transferência de holder e conclusão da etapa continuam sendo uma jornada distinta: o teste semeia o estado pending. Não é necessário repetir B01 nem retirar `approvalStage`.

A montagem WP10 examinada também já contém `answerReuse` no dispatch e o roteamento de confirmação dos domínios. A pendência concreta é a montagem dos novos produtores C05 e da autoridade independente de destinatário. O [documento por owner](owner-deltas.md) identifica o arquivo e blob examinados e propõe somente a passagem tipada dos novos callbacks.

## Deltas próprios e comportamento

### Destinatário C05 e commit atual

Uma conversa C05 conserva `reviewRef`, versão, digest integral e seção, junto da base original. A autorização do caller não concede acesso ao destinatário. O novo `ReviewThreadRecipientAuthority` prepara uma lease para o destinatário admitido separadamente e fornece um check síncrono da autoridade atual para o commit.

As mutações C05 exigem `prepareReviewThreadFence`. A preparação acontece fora de C08; o callback retornado só examina snapshots protegidos e as leases originais, incluindo a revisão inteira e todas as fontes. Create, reply, edit e resolve não recolhem fontes nem abrem uma escrita aninhada dentro do commit. A ausência do produtor continua negativa.

R09 vincula objeto e métodos do provider à instância real de `TrustedDomainContext`, ao destinatário e à base. Um replay no mesmo contexto não pode substituir a lease que uma operação já preparou. A checagem ocorre antes e depois dos awaits relevantes e não armazena um booleano de autorização. O limite de entradas recusa novas bases em vez de expulsar uma lease ativa. Contextos clonados ou bindings reconstruídas não ganham autoridade.

### Resposta sobre revisão preservada

O adapter WP07 separa observação e confirmação de uma resposta C05 da confirmação dos dados correntes. A confirmação vincula mensagem, autoria, corpo, versão, pin e fingerprints. O baseline persistido conserva a base C05; o estado corrente não reescreve a revisão antiga.

O reuso privado e Meu trabalho precisam verificar ACL atual e continuidade física em cada consumo. A resposta confirmada suprime a mesma pendência comunicacional; uma edição reabre uma única linha `answer-stale`/`answer-changed`, com o pin preservado. Uma pergunta nova sobre a fonte corrente não herda confirmação por texto igual ou proximidade de IDs.

O preparo HTTP devolve `reviewContext`. Identificadores privados de lease e encarnação física ficam fora da resposta HTTP. A contraprova lê a resposta HTTP e confirma usando exatamente seu `observationRef`, sem uma segunda preparação. Isso não prova apresentação real à pessoa em uma UI instalada.

O método geral de fence de conversa é independente do escopo material C06. Documentos/cálculos podem participar da conversa quando o produtor fornece suas leases reais. A confirmação C06 recusa dependências que não consegue representar; não descarta essas dependências para obter um resultado positivo.

### R10: versão final da resposta e de Meu trabalho

A revisão independente encontrou uma janela entre a última releitura externa e o fence da fonte: uma edição humana podia conservar fonte/revisão/baseline e permitir devolver o corpo antigo como confirmado, ou retornar `valid` em Meu trabalho. A aprovação estática inicial de W6 foi suspensa antes da publicação; o finding permanece no histórico.

O novo `answer-state-fence.ts` compara a thread canônica completa e o baseline aplicável dentro de `currentSnapshots`, antes e depois do await do fence real da fonte. A preparação vincula a thread sem exigir baseline ausente; a leitura não confirmada exige ausência; leitura confirmada, pós-confirmação e Work exigem baseline exato. Ambos os caminhos, genérico e C05, usam essa proteção. O helper fixa a identidade da persistência e de seus métodos e não transforma igualdade de storage em autorização.

As duas contraprovas adicionais fazem uma edição humana admitida de verdade depois de um read C08 já liberado. Uma interrompe a segunda leitura de baseline do reuso; outra interrompe a segunda leitura própria de `createAnswerWorkPort`. O componente Work é chamado diretamente para impedir que uma coleta externa posterior esconda seu resultado obsoleto. Elas verificam incremento único de versão, baseline/fonte física/revisão/ACL iguais e a pendência atual `stale/answer-changed`. Nenhuma thread ou confirmação é semeada diretamente.

W6 executou as recusas centrais de ambos os R10, mas os casos completos falharam depois: `snapshots()` é uma projeção de negócio e exclui `__sfProductV1`. O digest comparava `undefined`, não a revisão preservada. W7 lê o namespace C08 `reviews` pela referência exata antes e depois e exige status, presença, id/versão, digest do pin e igualdade integral. A leitura anterior ocorre antes do hook de corrida; a posterior ocorre após restaurar o read. Cada caso agora tem 26 locais de asserção. Não houve mudança de produtor, helper R10 ou autoridade.

### Limite do contrato compartilhado

O schema fechado de `sf_answer_read` não representa o pin C05. W2 recusa especificamente esse caminho com `review-answer-output-contract-unavailable`. A leitura privada mantém a semântica completa, e o caminho compartilhado de respostas sobre fontes correntes permanece.

WP00/WP10 precisam admitir uma variante discriminada de resposta preservada, com os quatro campos do pin, atualizar o decoder e os consumidores e exercitar a mesma autoridade/destino. Nenhum contrato compartilhado foi ampliado nesta retomada. Não existe uma referência C17 sintética criada para contornar essa limitação.

### Seleção CAS e regressão histórica

G03 incorpora o delta de Interface em `9d65ea8fcd8ce6ea1249dc669e0fcc248b540241`. Somente `conflict/product-state-changed` na seleção de preferências passa a `selection-not-committed`, cuja resposta HTTP existente é409. Outros erros e conflito de conteúdo da chave idempotente continuam indisponíveis. A concorrência real passou W2 e W5; W4 corrigiu somente o narrowing do tipo C08 no teste.

W2 identificou uma mistura entre referências correntes da projeção de exibição e versão originalmente observada. W5 tentou usar o leitor histórico incondicionalmente, mas a contraprova fresca falhou antes de qualquer mudança: o issuer de `projects` usa `Portfolio Dashboard`, enquanto o original podia estar escopado a `All Projects`; a página participa da encarnação do seletor. Não era uma exigência universal de concessão histórica.

W6 restaura a base genérica anteriormente provada, `message.sourceContext ?? thread.value`, obtida pela leitura corrente autenticada e acompanhada de todas as checagens de referência, período, manifesto e dependências. A base estrita `threadMessageContext` continua obrigatória quando existe pin C05 explícito. O answerRef completo permanece derivado da mensagem autenticada, e a releitura canônica final permanece protegida. A expectativa antiga `stale/answer-scope-changed` não foi alterada.

### Custo medido e custo ainda pendente

Os dois casos novos C05 de W2 excederam120000ms. A leitura estática identificou70 chamadas completas a `ReviewPort.read` por preparação. W5 reduziu a contagem a32, mas a primeira jornada ainda levou253128.15ms e falhou; o segundo caso, de revogação/substituição física, passou em99895.10ms. Houve progresso contínuo, sem evidência de um deadlock simples. A persistência rejeita escrita aninhada, e as observações ocorrem antes da transação.

W6 reduz a contagem estática por preparo/leitura a16, confirmação a12 e as projeções de Work correspondentes. Membership C05 verifica identidade, participação e última mensagem no estado canônico; não concede acesso a fontes. As leituras autenticadas, observação exata e fences atuais continuam obrigatórias. A resolução C05 duplicada em Work foi removida porque `observe` já deriva e compara o escopo completo. Nenhuma concessão é memoizada.

W6 já havia separado a primeira jornada, mas B ainda levou149408.75ms. W7 distribui somente B em três cenários funcionais completos. Os seis cenários C05 finais mantêm seus setups reais dentro de120s e não compartilham baseline ou concessão:

| Caso | Cadeia preservada |
| --- | --- |
| Confirmação/reopen | C05 real, mudança do domínio, resposta original, negativas de ref, HTTP, mesmo observationRef, confirmação/retry, invariantes, recusa C16, fechamento/reabertura real de SQLite e reuso do mesmo baseline. |
| B1: edição/pendência | C05 e primeira confirmação reais, SQLite reopen antes de editar a mesma mensagem, uma única pendência stale repetível e recusa do token antigo. |
| B2: reconfirmação/histórico | Repete C05/confirmação/reopen/edição reais; nova ref/observação/confirmação suprime a mesma linha Work, e só depois lê corpo/versão/pin históricos originais. |
| B3: resolução/reuso | Repete C05/confirmação/reopen/edição reais; reconfirma a resposta nova antes de resolver a mesma thread e reler corpo editado/pin. |
| Fonte corrente/revogação | C05 realmente confirmado, nova pergunta corrente com exatamente o mesmo corpo sem herdar baseline, depois recusa de read/prepare/work sob ACL da revisão revogada. |
| Lease/continuidade física | Cenário anterior inteiro: revogação no último await e no commit, nenhum write indevido, nova observação explícita, exclusão legal e substituição física hostil com encarnação diferente. |

Todos os58 oráculos existentes (54 originais+4 W5) e os23 do unit model foram preservados. Em W7, A/C/D e todos os helpers que executam são byte-equivalentes a W6 e não foram rerodados. R10 acrescenta duas corridas reais, cada uma com120s. Os nomes fixos dos checkpoints e tempos não contêm conteúdo do negócio. Dividir cenários ou reduzir contagem estática não fecha o limite de desempenho do produto instalado. Os runs registram somente o custo efetivo de suas fases. Os timeouts253s de W5 e149s de W6 permanecem documentados; a partição W7 não os transforma em aceite de latência.

### Tempos observados nos casos W6

| Caso | Resultado | Tempo observado |
| --- | --- | --- |
| C05 answers confirm the displayed preserved review and reuse the same baseline after SQLite reopen | PASS | 109225.56 ms |
| C05 edited answers after SQLite reopen create one stale item and reconfirm the same original review | FAIL | 149408.75 ms |
| a current-domain question cannot inherit a confirmed C05 answer and review ACL revocation hides every private consumer | PASS | 49462.65 ms |
| C05 confirmation refuses a lease revoked at commit and cannot revive a replaced physical source | PASS | 83097.57 ms |
| C05 answer read refuses a real human edit after its final external version read | FAIL | 66668.51 ms |
| C05 answer work refuses a real human edit after its final external version read | FAIL | 57952.4 ms |

Esses tempos pertencem ao run/produto/snapshot acima. Não são uma medição da UI instalada nem apagam o timeout anterior.

### Tempos observados nos cinco casos W7

| Caso | Resultado | Tempo observado |
| --- | --- | --- |
| C05 edited answers after SQLite reopen create one stable stale item and reject the old confirmation | PASS | 61511.96 ms |
| C05 edited answers after SQLite reopen reconfirm the same response and retain its original historical version | PASS | 78004.9 ms |
| C05 edited answers after SQLite reopen resolve and reuse the newly confirmed response | PASS | 81498.13 ms |
| C05 answer read refuses a real human edit after its final external version read | PASS | 50642.45 ms |
| C05 answer work refuses a real human edit after its final external version read | PASS | 44219.55 ms |

Produto/fixtures inalterados: os sete PASS W6 continuam anexados. Não houve validação duplicada desses casos.

## Checks e runs

| Evidência | Produto W / snapshot S | Resultado observado e limite |
| --- | --- | --- |
| [PR28, run 43533574980](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43533574980), job `132256977328` | W `156f074d15c9787a9fc1b6430e632504ee3a69e6`; S `b55254b4da225f3ad874b27885d4792c69f047ac` | 64 PASS / 2 FAIL; origem histórica, sem promoção para o head atual. |
| [CI03, run 43582480758](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43582480758) | W `5ec1630993e4fa66684539db11af939b44ec8ecd`; S `82889e5df6ce9bee9e572b239879f5b35e609f4e` | 193 PASS / 4 FAIL; casos e correções posteriores preservados no mapa. |
| [CI04, run 43584357490](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43584357490), job `132415569882` | W `ea5a6f965c803d436202934872c3650ab8f8eb19`; S `c03b06bea510e0ed8ec8df105c269304d388317f` | 42 PASS / 2 FAIL; B01 e outros casos específicos positivos, sem verde global. |
| [Head inicial, run 43586213509](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43586213509), job `132421137142` | W `2784daafbb0d3b58b6019822288a07fa38e5c5b0`; S `528ef2329844fe20aee393357a6bb9a549de332a` | 56 PASS / 2 FAIL; falhas de fixtures WP07. Casos WP08 específicos reanexados. |
| [W2, run 43616934900](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43616934900), job `132513933634` | W `20821df310ebc6ea08ccab27e829008d72a04de6`; S `161f5f9b547dcb7ca7868a70ab0ffa05413131b3` | 29 PASS / 4 FAIL / 1 ERROR, 518 asserts, 33 testes/13 arquivos. Parser WP07 corrigido W3; dois timeouts C05 e regressão histórica motivaram W5/W6. O run permanece FAILURE. |
| [Static W4, run 43618057932](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43618057932), job `132517365573` | W `70af5b7d26bbc9456b1d9b9aa324bf2ae10668c4` | Typecheck: 69 diagnósticos estrangeiros idênticos à baseline, zero próprios. Guards: 78 regras, 853 paths, zero gates, 14 warnings, zero errors. Artifact `14123230259`. |
| [W5, run43619790251](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43619790251), job `132522634877` | W `0d9820924b33a8fc7b145f54a675aeef76c98489`; S `49e83715497e221350a8c221f45968debb566bea` | 8 PASS/2 FAIL,235 asserts,10 testes/7 arquivos. Primeira jornada C05 timeout253128.15ms; histórico falha no primeiro preparo fresco. R09/CAS/WP07 e segundo C05 positivos no escopo real. |
| [W6, run43623257640](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43623257640), job `132533400502` | W `dc21cd389de67c2e7fac996b663d9c0aa7d8cae5`; S `72848c2122b68e15341baa41e5beef4e9237562a` | 7 PASS / 3 FAIL, 212 asserts, 10 testes/6 arquivos. |
| [W7, run43625515062](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43625515062), job `132540336771` | W `9e1f44af7689946d27d37ed48b9f5e9849417121`; S `a4f8c7bd673de3e4092f20185f4c3ea2d10d0ec3` | 5 PASS/0 FAIL, 62 asserts, 5 testes/2 arquivos. |

O snapshot W7 tem tree `0e4ca3c0551816cc4033a978f32fed750ed46434` e difere do produto somente por `.ci-run.json`; request SHA256 `9d3fcc8f30bb2b880ebe67a5cfd7f2011d4b92ada94b7fb7cc2fd17fa15f6586`. A seleção usa `--test-name-pattern` ancorado nos três novos nomes B e nos dois R10, apenas em `review-answer-confirmation.test.ts` e `answer-egress-version.test.ts`.

Os sete PASS W6 são reanexados porque W7 não altera produto ou fixture, e A/C/D/helpers são byte-equivalentes. As três falhas W6 permanecem falhas; somente resultados W7 completos podem qualificar seus sucessores. WP07 pin/provider, G03 e R09 de W5 também permanecem: R09 executa `threads.create`, `threadReads.read` e `authority.reviewRecipientSources`, sem os callbacks de answer do host alterados W6. A equivalência é por caminhos executados, sem afirmar igualdade de todo host. Review-port/agenda WP07 W2 seguem anexados. Não houve teste local de produto, epic por grupo, timeout maior ou engine alterada.

## Avanço WP12 e limites por owner

O avanço WP12 até `812f8427423dc143cefc2731edc3485eeb8d1f04` acrescentou46 documentos e um teste, sem implementação. Run43615955284/job132510939072, W `6880666b15dc18bf400c908a8457580526b70f4d`, S `89799ce8ca1d9a78e25695353879dfe2bd0c229a`:2 PASS/1 FAIL. Executive Work e revisão pública populada/report/download/reload passaram; o timeout de Question Work permanece como história.

O avanço seguinte até `f2cbdb30c1673bc89426db6618d19cb65601c8ef` também não alterou implementação. O [run43619631569](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43619631569), job `132522137649`, snapshot `b5eb330f9b914953bf19fa7e265e9db11762cfd2`, terminou **3 PASS/0 FAIL,367 asserts**. Question Work agora passou em254350.31ms dentro360000ms, com Workbench real reaberto, mesma ação idempotente e recusa após remoção da seleção. O blob do teste é `c146fe374294f07f38c5beae9d34147d97c94968`. Não manter o antigo timeout como bloqueio atual desse caminho UI.

O avanço posterior até `ba27411a7cda9301aa162680a94153a5e643be4d`, tree `e88a267c3eb31e2d2040693535076222dbad74e1`, acrescentou17 recibos e o teste CAPEX Answer `e7bdf4d8e2da41b8f3bdf05aa8f1384873d2d7a0`, sem implementação. O check43621280244 passou, mas nenhum novo run de produto foi observado até17:59:06 UTC. A preparação de `sf_answer_read` não confirmado/Question/reopen não é prova runtime e não recebe o PASS de Question Work. C05 confirmado e o escopo Planner anterior continuam separados.

Os seis catálogos nativos estavam vazios e três missões indisponíveis. `questionId/outputRef/nativeCallId/nativeReceipt` permanecem nulos, `sf_answer_read` não foi exercitado e `confirmedAnswerReuseAccepted` é falso. O PASS UI não fecha C05, resposta confirmada, C11, recorrência C07 ou execução de inferência. As174 inicializações de subprocesso Omni não são inferências. Essas provas externas já existentes são reanexadas sem nova validação equivalente.

| Owner | Delta concreto restante |
| --- | --- |
| WP10 / astra-compose | Montar `reviewContexts`, autorização C05, `prepareReviewThreadFence`, `reviewAnswerSource` e autoridade independente de destinatário a partir de produtores reais; completar roteamento por ator/domínio. |
| WP00 / WP10 / WP01 | Admitir output compartilhado C05 discriminado com pin completo; mostrar revisão/versão/período e provar apresentação à pessoa, destino e retorno na UI instalada. |
| WP10 e owners C17 das fontes | Capturar C06 ainda não arquivado por Atlas/C12, autorizar currentRef através de rollover e produzir leases reais de todas as fontes, preservando competência original, ACL atual e continuidade física. WP12 é consumidor nativo, não owner dessa implementação produtora. |
| WP02 / WP03 / WP04 | Provar manifests materiais/FX/regras/unidade/moeda e caminhos canônicos; executar a jornada legal de approval/holder/stage/completion distinta do B01 resolvido. |
| WP00 / WP11 / consumidores C11 | Representar razão/efeito/prioridade decisiva da pergunta e consumir a mesma resposta no caso sem confundir premissa com alteração oficial. |
| WP09 / WP10 | Demonstrar execução e recorrência C07 governadas com resultado autenticado; zero itens em Work não prova ausência de cobrança nativa. |
| WP08 / WP07 e WP10 | Medir a latência dos fluxos montados e reconciliar o limite real de253s, separado de partição dos testes e de composição ausente. |
| S0 / owners do typecheck | Rever deltas e evidência por SHA e tratar diagnósticos externos sem stubs permissivos, engines ou alteração de contratos alheios. |

Os findings WP13 mantêm escopos separados e permanecem abertos: replay numérico positivo fora do orçamento e recusa sem private writer grant. O fix do provider já foi publicado por WP10/PR32 em9048e0e, mas o state-provider Finance ainda não inclui o prefixo `sf:portfolio:campaign:` sob `proposalCoverageWrites`. WP10/S0 devem compor o delta delimitado; WP13 mantém e qualifica o oráculo. Os seis PASS de R5 são somente 4+2 nas duas fixtures corrigidas e não certificam uma jornada WP13 mais ampla. A proposta delimitada ao host e todos os owners constam em [owner-deltas.md](owner-deltas.md). Nenhum contrato compartilhado, host WP10, implementação WP12, engine, Azure, deploy, identidade ou política financeira foi alterado.

## Próxima ação

S0 revisa a PR41 com a evidência limitada W6/W7 e o resultado único do gate estático final. Os owners compõem os produtores/consumidores delimitados e tratam a latência observada. Não fazer merge nem declarar execução nativa ou DONE. Estado observado W7: `SUCCESS`. O produto de W6 está preservado sem alteração em W7; os resultados não são renomeados para outro SHA.

S0 recebe a PR draft, head/tree, os132 critérios, checks/run IDs/W/S e findings. O relatório `c05-w7-independent-review.json`, SHA256 `5f82639e04b6d87f536bc6116970f96ff10d2585e986e6a84545d8a88809b07a`, confere os dois testes, os58 oráculos e o filtro de cinco nomes. O inventário `c05-w7-independent-byte-check.json`, SHA256 `f535b2d9a0f47acd4f6b96f4c85cb7af12dbe90d04b5d210aeae3875b8be8a85`, conserva A/C/D/helpers. São revisões estáticas; a prova runtime permanece nos runs reais.

Somente o writer principal realizou mutações remotas via GitHub MCP. Arquivos dirty e inputs arquivados foram preservados. Não houve force push, reset/clean destrutivo, exclusão de worktree, merge de `sf2-control`, reinício de desktop/server ou merge de PR. Nenhuma fixture/SQLite é apresentada como prova nativa ou conclusão integral do WP.

