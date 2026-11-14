# Retomada de Colaboração — WP07, WP08 e WP09

## Entrega e limite de aceite

Continuação da [PR #33](https://github.com/gustavomhss/Orchestra-SF/pull/33), publicada em `collab-resume` → `sf2-stack` na [PR #41](https://github.com/gustavomhss/Orchestra-SF/pull/41). O head original `2784daafbb0d3b58b6019822288a07fa38e5c5b0` e as branches de origem permanecem preservados. O [registro de origens](preserved-origins.json) e os suplementos de avanço discriminam cada pin observado.

**Estado: entregue para revisão de S0, com deltas próprios e provas delimitadas; sem DONE integral ou prova de execução Relay nativa.** O produto de referência deste recibo é `9e1f44af7689946d27d37ed48b9f5e9849417121`, tree `ac88fa893a3b8b9f36c4373c2889652025fcf0f3`. O commit posterior de entrega acrescenta somente evidência. Seu head/tree e o check obrigatório desse head são publicados na PR #41, sem reescrever o recibo para referir a si próprio.

O plano permanece em `dbf9547211d9b0fade619790de7c19c0869b7c7d`, os packs em `a3d29d011ba3607a57914701300f09117a3e2de9` e o registro da retomada em `c208200cb39529ba09c1f3bbc5594a1ff579d385`. A campanha mantém o SHA256 `703dd257274bed829a978705de548cd1383225bf7aac76445104c053e2bb5fba`.

## Mapa integral

O [índice completo](criteria-index.json) contém os **330 IDs/textos canônicos e as 17 tasks integrais**, incluindo checks e axiomas. A comparação documental exige igualdade literal com os packs; não houve teste de produto local para produzir essa conferência.

| WP | Critérios / tasks | Mapa, implementação e limites |
| --- | --- | --- |
| WP07 — revisão, reunião e exportação | 86 / 4 | [Critérios](../../WP07/collab-resume/criteria.json), [handoff próprio](../../WP07/collab-resume/HANDOFF.md), [equivalência de exports](../../WP07/collab-resume/export-equivalence.json) |
| WP08 — colaboração, resposta, reuso e Meu trabalho | 132 / 6 | [Critérios](criteria-132.json), [índice legível](criteria-index.md), [handoff próprio](handoff.md), [deltas por owner](owner-deltas.md) |
| WP09 — rotinas e recorrência | 112 / 7 | [Critérios](../../WP09/collab-resume/criteria-112.json), [recibos](../../WP09/collab-resume/evidence.json), [deltas por owner](../../WP09/collab-resume/owner-deltas.md), [equivalência final](../../WP09/collab-resume/final-equivalence.json) |

As contagens são inventário de critérios, não quantidade de critérios aceitos. Cada mapa conserva o resultado original, seus W/S, consumidores, paths, limites e próxima ação. Evidência histórica, implementação própria, prova cirúrgica e dependência externa não são intercambiáveis.

## Deltas próprios publicados

| Incremento | Commit publicado | Delta próprio |
| --- | --- | --- |
| W1 | [ff5575529361](https://github.com/gustavomhss/Orchestra-SF/commit/ff557552936197b6734e57f0ecea0c44b19139b1) | Inicialização/CAS C08 e agenda de revisão; fixture SQLite real; pinagem de providers de rotinas. |
| W2 | [20821df310eb](https://github.com/gustavomhss/Orchestra-SF/commit/20821df310ebc6ea08ccab27e829008d72a04de6) | Adapter C05 privado, autoridade própria do destinatário, confirmação/reuso/Meu trabalho e tradução CAS. |
| W3 | [34f26821f62a](https://github.com/gustavomhss/Orchestra-SF/commit/34f26821f62a99ae40ca1e69f4bded602f83768e) | Correção do parser do teste WP07, preservando o assert. |
| W4 | [70af5b7d26bb](https://github.com/gustavomhss/Orchestra-SF/commit/70af5b7d26bbc9456b1d9b9aa324bf2ae10668c4) | Lease do destinatário presa ao contexto original (R09) e narrowing explícito do teste CAS. |
| W5 | [0d9820924b33](https://github.com/gustavomhss/Orchestra-SF/commit/0d9820924b33a8fc7b145f54a675aeef76c98489) | Redução de leituras repetidas, confirmação do token HTTP e oráculo de identidade física; falhas do CI preservadas. |
| W6 | [dc21cd389de6](https://github.com/gustavomhss/Orchestra-SF/commit/dc21cd389de67c2e7fac996b663d9c0aa7d8cae5) | Escopo corrente restaurado; fence de versão thread/baseline (R10), contraprovas reais e jornadas C05 independentes. |
| W7 | [9e1f44af7689](https://github.com/gustavomhss/Orchestra-SF/commit/9e1f44af7689946d27d37ed48b9f5e9849417121) | Leitura C08 correta nas contraprovas R10 e três cadeias completas de edição/reconfirmação; sem alteração do produto ou das fixtures compartilhadas. |

### Revisão preservada e confirmação

O adapter privado WP07 `createReviewAnswerSource` observa a seção preservada e fixa review/version/digest/section, autoridade e identidade física. A preparação das leases ocorre fora de C08; a checagem protegida durante o commit lê os snapshots e as leases já preparadas. O fence de escrita da conversa autentica a revisão inteira e não depende do recorte record-only de C06. Dependências que C06 não representa continuam recusadas explicitamente; não são descartadas para fabricar um resultado positivo.

WP08 conserva esse pin no baseline da resposta, na apresentação HTTP privada, no histórico e em Meu trabalho. A confirmação diz respeito à revisão observada. Uma pergunta sobre o domínio corrente não herda a confirmação por ID textual, proximidade ou texto igual. Edição da resposta exige nova observação/confirmação e reabre somente uma identidade de comunicação. A confirmação utiliza o mesmo observationRef devolvido pela preparação HTTP e lido na contraprova; a apresentação dessa observação na UI instalada permanece na composição do owner.

A autoridade do destinatário é independente da do caller. O commit verifica a mesma lease original, com proteção contra troca de provider/método e repinagem no mesmo contexto admitido. A identidade privada de cada observação impede que outra observação substitua a sua lease. Esses identificadores privados não são publicados no HTTP nem persistidos como grants.

O contrato compartilhado `sf_answer_read` ainda não representa o pin C05. O consumidor recusa esse caso com `review-answer-output-contract-unavailable`, preservando o caminho de respostas correntes. A extensão versionada de schema/descriptor pertence ao owner; sua proposta está no handoff WP08.

### Histórico, CAS e rotinas

O consumidor genérico conserva a derivação de escopo já comprovada a partir da mensagem e das referências correntes emitidas pelo leitor autenticado, com os checks de referências, período e manifesto. C05 aplica a validação estrita do seu contexto preservado. A página faz parte da identidade de escopo: usar a identidade original de All Projects onde o emissor corrente usa Portfolio Dashboard causou uma recusa indevida em W5. A correção mantém a classificação stale após mudança material, permite respostas novas no mesmo thread e não reescreve a versão observada do histórico.

A perda conhecida de CAS na seleção de caso é exposta como `selection-not-committed`, sem escrita do perdedor ou perda da identidade de retry. Outros erros permanecem distintos. A contraprova usa o estado SQLite real; a composição e a navegação UI dessa resposta são uma prova separada do owner de Interface.

As rotinas fixam os providers e métodos de autorização, owner, recorrência, C08, ocorrência e resultado durante cada invocação. Troca de provider retorna `schedule-provider-changed`. Após um possível efeito, não se anuncia rollback ou sucesso sem resultado autenticado; preservam-se input e chave para recuperação idempotente. O recebimento de uma admissão ou de um prompt durável não é tratado como execução Relay concluída.

### Falhas encontradas e corrigidas nesta retomada

O primeiro CI C05 preservou 29 PASS, mas terminou FAILURE: um arquivo WP07 não carregou por um parêntese excedente, dois cenários C05 excederam 120000 ms e o reuso histórico retornou unavailable onde deveria ser stale. O parser foi corrigido sem retirar o assert; os três diagnósticos próprios de narrowing no teste CAS também foram corrigidos.

O caminho de preparação repetia a derivação da mesma mensagem autenticada. As contagens de leituras completas C05 são análise estática, não um benchmark. Foram preservadas a releitura canônica, a ACL atual, as verificações de pertencimento, a observação atual e os fences finais/C08. O teste compara duas encarnações físicas definidas, antes da remoção e depois de uma substituição hostil de storage, sem chamar essa substituição de escrita de negócio válida. O mapa de redistribuição dos oráculos conserva as cadeias causais em fixtures independentes; os limites de 120000 ms continuam explícitos.

A revisão independente identificou também R10: uma edição legítima poderia ocorrer após a última releitura da resposta e antes do fence final, que até então verificava somente a fonte. A correção própria vincula a thread e o baseline ao snapshot protegido de C08 nos consumidores de reuso e Meu trabalho, antes e depois do fence da fonte. A contraprova usa edição humana real fora da transação protegida, conserva fonte e ACL e exige recusa da versão antiga; seu resultado efetivo consta do ledger. Nenhuma baseline é semeada para substituir a confirmação real.

W6 corrigiu o histórico genérico e reteve sete PASS, mas o run agregado continuou FAILURE: a cadeia de edição/reconfirmação consumiu 149408,75 ms, e as duas contraprovas R10 falharam numa inspeção posterior da revisão. A recusa concorrente foi atingida; o erro posterior do teste vinha de `snapshots()`, uma projeção de negócio que remove C08, e portanto tentava obter o digest de uma revisão ausente nessa projeção. W7 mantém o produto e corrige somente os dois arquivos de teste: lê a revisão pelo namespace C08 canônico com presença/id/version/pin antes e depois, e distribui a cadeia de edição entre três cenários completos. Todos confirmam de verdade e reabrem SQLite antes de editar; o histórico original é verificado depois da reconfirmação, e a resolução/reutilização também sucede à reconfirmação real.

**W7 terminou SUCCESS** no [run 43625515062](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43625515062), job `132540336771`: **5 PASS, 0 FAIL, 3 filtrados, 62 assertions**, em 316,06 s. Os cinco nomes previstos foram conferidos literalmente no log. B1/B2/B3 levaram respectivamente 61511,96 / 78004,90 / 81498,13 ms; R10 read/work, 50642,45 / 44219,55 ms. A revisão canônica, a versão da mensagem, a baseline, a fonte física, a ACL e o Work stale posterior foram verificados nos dois casos R10 completos. O cleanup `132542378353` passou. Omni declarou not applicable, com zero spawns; não há prova nativa. Os sete PASS W6 e cinco PASS W7 são seleções distintas com sua equivalência documentada, e não um run agregado retroativamente verde. Veja o [resultado W7](c05-w7-result.json), o [resultado W6](c05-w6-result.json) e os [trechos exatos de logs](logs/index.json).

## Checks e reaproveitamento

O [ledger de checks](checks.json) contém seleções normalizadas, requests/hash, W/S/tree, jobs, conclusões, controle Omni, artifacts e justificativas para revalidar cada arquivo. O snapshot de cada teste é filho direto de seu produto e acrescenta somente `.ci-run.json`. Todas as operações remotas utilizaram GitHub MCP.

| Seleção | Produto W / snapshot S | Run / job | Resultado real |
| --- | --- | --- | --- |
| WP09 — três arquivos | [W ff5575529361](https://github.com/gustavomhss/Orchestra-SF/commit/ff557552936197b6734e57f0ecea0c44b19139b1) / [S 6f73befe7414](https://github.com/gustavomhss/Orchestra-SF/commit/6f73befe7414d08cf882ef0b125d8857ad69ec4f) | [43615514065](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43615514065) / `132509571848` | 42 PASS, 0 FAIL, 111 assertions; reanexado por equivalência. |
| C05 inicial | [W 20821df310eb](https://github.com/gustavomhss/Orchestra-SF/commit/20821df310ebc6ea08ccab27e829008d72a04de6) / [S 161f5f9b547d](https://github.com/gustavomhss/Orchestra-SF/commit/161f5f9b547dcb7ca7868a70ab0ffa05413131b3) | [43616934900](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43616934900) / `132513933634` | 29 PASS, 4 FAIL e 1 erro reportado; parser, dois timeouts e histórico delimitados. |
| C05 W5 | [W 0d9820924b33](https://github.com/gustavomhss/Orchestra-SF/commit/0d9820924b33a8fc7b145f54a675aeef76c98489) / [S 49e83715497e](https://github.com/gustavomhss/Orchestra-SF/commit/49e83715497e221350a8c221f45968debb566bea) | [43619790251](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43619790251) / `132522634877` | 8 PASS, 2 FAIL, 235 assertions; PASS WP07/R09/CAS preservados. |
| C05 W6 | [W dc21cd389de6](https://github.com/gustavomhss/Orchestra-SF/commit/dc21cd389de67c2e7fac996b663d9c0aa7d8cae5) / [S 72848c2122b6](https://github.com/gustavomhss/Orchestra-SF/commit/72848c2122b68e15341baa41e5beef4e9237562a) | [43623257640](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43623257640) / `132533400502` | 7 PASS, 3 FAIL, 212 assertions; sete PASS reanexados, agregado continua FAILURE. |
| C05 W7 — cinco nomes em dois arquivos | [W 9e1f44af7689](https://github.com/gustavomhss/Orchestra-SF/commit/9e1f44af7689946d27d37ed48b9f5e9849417121) / [S a4f8c7bd673d](https://github.com/gustavomhss/Orchestra-SF/commit/a4f8c7bd673de3e4092f20185f4c3ea2d10d0ec3) | [43625515062](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43625515062) / `132540336771` | 5 PASS, 0 FAIL, 3 filtrados, 62 assertions; SUCCESS em 316,06 s. |
| Estático W4, checkpoint anterior | `70af5b7d26bbc9456b1d9b9aa324bf2ae10668c4` | [43618057932](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43618057932) / `132517365573` | Typecheck global FAILURE: 69 diagnósticos exatamente iguais ao baseline, zero próprios; guards PASS, 78 regras, 0 gates, 14 avisos, 0 erros. |
| Estático da entrega | Head evidencial e tree publicados na [PR #41](https://github.com/gustavomhss/Orchestra-SF/pull/41) | Run/job e artifact do head final na PR #41 | Executado após o commit de evidências para cobrir produto, testes e documentos finais; nenhum teste de produto adicional por mudança apenas documental. |

O typecheck global falhou no último checkpoint estático anterior por 69 diagnósticos herdados, exatamente iguais ao baseline, com zero próprios. O [inventário por owner](inherited-typecheck.json) não atribui essas falhas às branches estrangeiras mais novas: registra o candidato de Colaboração. O check obrigatório do head evidencial final é publicado na PR #41; guards e typecheck não são confundidos com testes de produto.

Foram reanexados, no respectivo escopo, os 42 PASS de Schedule do run `43615514065`, os 14 PASS de revisão e um de agenda do run `43616934900`, a prova literal v3→v4 e os recibos de exportação. Os 29 arquivos de exportação relacionados continuam idênticos; não se alegam identidade de toda a árvore ou nova inspeção visual. O resultado de um arquivo não converte um run agregado falho em verde.

O finding B01 de `approvalStage` já foi corrigido no trabalho herdado e passou no run `43584357490`, job `132415569882`. A [reconciliação B01](procurement-b01-reconciliation.json) preserva essa prova. A jornada de aprovação legal, transferência de holder, mudança de etapa e atualização de Meu trabalho permanece distinta do teste que semeia o estado pending.

## Avanços de fontes alheias

Os suplementos [Interface/Finance](source-advances-final-interface-finance.json), [avanço final de Finance](source-advances-post-171554-interface-finance.json) e [WP12/WP10/WP14](source-advances-final-native-outcome.json) registram os últimos heads/trees observados, diferenças de produto versus recibos e resultados reais de Actions. Eles complementam as reconciliações anteriores de [Interface](interface-advance-reconciliation.json), [Finance](finance-advance-reconciliation.json) e [WP12](wp12-advance-reconciliation.json). Nenhuma árvore estrangeira foi incorporada. O [corte de encerramento](source-heads-closing.json) foi reconciliado pelos suplementos finais de [Finance](source-advances-closure-finance.json) e [WP12](source-advances-final-native-outcome-supplement-ba27411a.json): ambos acrescentaram recibos e WP12 também um teste, sem alterar os produtores. O check estático desse teste novo não é execução do seu fluxo.

A prova WP12 `43615955284` tem dois PASS de UI e um timeout, com catálogos nativos vazios. Review crossroutes mostrou duas seções de 22 valores, relatório/download e reload; Executive Work mostrou a seleção pública Procurement e a ação Hot Topic existente. O run posterior `43619631569` concluiu três PASS, incluindo Question Work, em seu próprio W/S. Esses resultados não comprovam C05 answer reuse, C07, execução residente ou o consumidor de resultado previsto/observado de WP14. Seus subprocessos Omni não são inferência. Runs ainda em andamento conservam seu estado e horário de consulta no suplemento.

## Findings e próxima ação

| Owner | Pendência concreta | Próxima ação delimitada |
| --- | --- | --- |
| S0 / WP10 | Compor C05, leitor de revisão, `prepareAccess` integral, autoridade independente do destinatário e métodos protegidos no host instalado. | Aplicar os hooks privados já publicados por delta, qualificar pedido/resposta/edição/confirmação/reuso/Meu trabalho e negar revogação, homônimo, troca de provider e substituição física. |
| WP00 C16 / WP10 / Interface | A apresentação compartilhada de resposta não representa o pin C05; UI ainda precisa consumir a observação exibida na composição real. | Admitir variante de contrato versionada, atualizar decoder/descriptor e mostrar review/version/digest/section juntos; só então liberar a apresentação C05 compartilhada. |
| WP10 / C07-C08 / S0 | A factory de rotinas existe; a composição ainda não injeta o port nativo e não fornece o resultado real governado. | Ligar o serviço nativo aos hooks existentes, qualificar admissão → ocorrência → execução → resultado com principal atual, digest e estado terminal; provar retry, pausa, falha, revogação e reload. |
| WP10 / owners de C17 e das fontes; WP12 como consumidor nativo | Histórico por tipo, períodos, fontes removidas e leases document/calculation/case-event ainda têm limites de composição/prova. | Publicar os produtores reais com ACL e identidade física atuais; consumir sem reconstruir o passado por ID/nome e sem substituir por fixtures. |
| WP07 + WP14 + S0 | Consumidor próprio de resultado previsto/observado WP14 **não vazio** ainda falta após composição dos produtores publicados ausentes na árvore. | Compor os quatro arquivos/pins exatos listados no handoff WP07; WP07 então implementa/executa preservação/exportação, reabertura SQLite e revogação. Os 44 valores da revisão UI não substituem esse resultado. |
| Interface / WP02 / WP07 | Helper Node/browser precisa entrar pelo owner e aceitar explicitamente WP07; cleanup em falha não está qualificado. | Compor o helper exato, migrar a fixture própria e executar falha real seguida de recuperação, preservando o erro primário e o orçamento. Não trocar label ou variante de helper para importar uma prova incompatível. |
| WP11 / WP10 / WP09 | Verificador real de operações de cenário e continuação de decisão precisam acompanhar o produtor atualizado. | Compor `verifyScenarioOperations` do owner, sem callback permissivo; executar nova admissão após resposta humana e recuperar o output real da nova versão. |
| WP13 / WP10 / S0 | O agregado R4 conservou falhas no limite de tempo numérico e na contraprova de private writer grant, que esperava unavailable e recebeu ok. | Concluir o replay numérico completo dentro do orçamento. WP10/S0 compõe em Finance o delta de grant já publicado na PR #32 (prefixo `sf:portfolio:campaign:`), preservando o oráculo WP13; os seis PASS cirúrgicos de R5 cobrem somente as duas seleções corrigidas. |
| WP03 / C02 | Idade da fonte e classificação sec/el não podem ser inferidas de metadados ausentes. | Publicar o timestamp material e as identidades de seção/elemento; manter unknown/indisponível até haver produtor autorizado. |
| WP08 / WP10 / C08 | O percurso C05 agregado em W5 consumiu 253128,15 ms; a partição dos testes não aceita latência do produto. | Usar os timings por fase para medir o fluxo composto, mantendo leases por operação e snapshots protegidos; qualquer otimização do store compartilhado cabe ao owner de C08. |
| S0 e owners do typecheck | Compatibilidade global e qualificação integrada C/G7, D/G8, AM01–AM06 e seleções finais continuam fora do green cirúrgico. | Reconciliar os diagnósticos do candidato por delta de owner; executar os gates do bundle integrado sem reatribuir recibos a outro produto. |

**Próxima ação imediata:** S0 revisa a PR #41 e os deltas próprios, preserva as origens e compõe somente os deltas externos aceitos por seus owners. Os consumidores próprios bloqueados por essa composição continuam explicitamente atribuídos; não foram descartados. A PR permanece aberta para revisão, sem merge e sem fechamento das PRs anteriores.
