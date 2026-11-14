# WP07 — reconciliação do grupo Astra

Fonte normativa: plano `dbf9547211d9b0fade619790de7c19c0869b7c7d`, handoff completo `a3d29d011ba3607a57914701300f09117a3e2de9`, campaign SHA256 `703dd257274bed829a978705de548cd1383225bf7aac76445104c053e2bb5fba`. Os 86 IDs e textos do mapa novo foram comparados estruturalmente ao pack completo e permanecem idênticos. Essa comparação de metadados não executa produto.

O mapa completo está em `astra-collaboration-criteria.json`. Cada critério mantém o ponteiro para a prova original da PR27, associa implementação, consumidores, novas provas e dependências com owner. Nenhum recibo original foi substituído. O mapa não declara aceitação global: 50 critérios conservam verificação delimitada; 34 conservam pendência de integração; o consumo real do selector Dashboard e o cenário literal C06 v3→v4 têm incrementos preparados ainda sem execução.

## Produto publicado e prova mais recente

O incremento04 está no produto `5ec1630993e4fa66684539db11af939b44ec8ecd`, tree `993ae9a67abb3050536609bc369843a105753da5`. A execução [43582480758](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43582480758), job `132409958684`, usa snapshot `82889e5df6ce9bee9e572b239879f5b35e609f4e`. **WP07: 95 testes passaram em 22 arquivos, nenhum falhou.** A seleção completa do grupo teve 193 passagens e quatro falhas; o resultado agregado permanece failure. `astra-collaboration-ci03.json` registra nomes, paths e linhas do log de cada assertiva WP07.

O check separado [43582484277](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43582484277), job `132409969312`, snapshot `84e70d31169e2611e65231294b047b859499ba70`, passou nos guards e gerou os seis exports. Typecheck global falhou; o erro WP07 de tipos genéricos de `Uint8Array` no teste de armazenamento tem correção preparada05, mantendo a comparação de todos os bytes. Não se declara typecheck verde antes da execução hospedada.

## Findings fechados no produto próprio

| Finding | Comportamento entregue | Consumidores e negativos |
| --- | --- | --- |
| F01 — corpo factual C07 | A aplicação abre a saída autenticada e imutável pelo produto WP09, verifica run/result/digest, cria seleção privada e reabre o mesmo resultado em cada uso. A UI obtém uma lease específica `sf_routine_result` vinculada ao mesmo Request e à mesma identidade de cinco campos. | `routine-reader`, `routine-selection`, aplicação/HTTP, preservação, reunião e ambos os formatos. Snapshot do cliente, pin divergente, saída alterada, revogação e expiração não liberam conteúdo. Contexto native não é convertido em UI. |
| F02 — contexto histórico C06 | Captura usa `readHistorical` e `readVersion` com a base exata de cada mensagem. Mudança de incarnation scoped ou período exige o callback de continuidade física/ACL e C17 histórico explícito. | `thread-access`, `authorizeComments`, C05, reunião e exports. IDs iguais, homônimos e acesso apenas à projeção corrente não concedem o histórico. Exclusão/recriação e revogação continuam negativas. |
| F03 — associação e conversa atual | A preservação cria `reviewCommentRefs` com id, versão e digest completo a partir dos comentários já autorizados de cada seção. Um helper compartilhado alimenta reunião, comparação, inclusão, layout e formatos. O endpoint de conversa atual reabre C05 e C06 antes de emitir um payload fechado. | Um comentário de outra seção, versão ou digest não entra por coincidência de source ID. A revisão conserva o texto capturado; a conversa corrente aparece em região explicitamente identificada, sem CRUD paralelo. |
| F04 — stamp de artifact | `reports/storage` conserva o stamp histórico e checa a autorização corrente, revisão exata, inclusão e bytes. Rotação legítima de policy/access pode reabrir os mesmos bytes. | Retry, mudança de intenção, troca de revisão, outro ator, revogação e tamper não retornam o artifact. Essa correção não concede a política externa de escrita privada do viewer. |
| F05 — idade de Request | O digest material de seleção ignora somente o avanço do campo derivado `ageDays`; a captura conserva o valor apresentado. | Mudança de status, stage ou ausência material continua stale. Nenhum cálculo Procurement foi refeito. |
| F07 — schema e autorização completos | O decoder canônico valida o núcleo da projeção; somente as cinco extensões próprias reconhecidas são retiradas antes dele, e cada extensão tem validação estrita. Coletores cobrem fontes e evidências aninhadas, comparação, componentes e drilldowns. | Campos privados extras e evidências revogadas não escapam pelo preview C07 ou pelo C05. Deduplicação usa a referência completa em cada passagem, sem cache entre chamadas. |

Os testes C07 exercitam o produto, dispatcher e leases reais com leitores de execução/resultado controlados. Não são recibos de uma execução nativa governada Relay/Session/SkillLoadReceipt. Os testes C06 exercitam SQLite, produtores de fonte, mensagens e verificadores físicos/ACL reais; as concessões de destinatário e histórico são fronteiras explícitas de fixture.

## Incremento05 preparado

`createReviewClosurePort.listByAction(topicId, context)` retorna somente `closureRef`, `reviewRef`, `reviewVersion` e `reviewDigest`, após duas leituras autorizadas de C05/ação/relação e conferência do índice C08 protegido. Ele não cria tarefa nem presume acesso do destinatário. O callback WP08 `reviewContexts` acrescenta esse contexto ao item canônico de handoff já existente em Meu trabalho.

`closure-work.test.ts` usa os ports reais de C05, C06, casos, fonte Dashboard, HotTopic e SQLite. A mesma intenção retorna a mesma ação/relação e uma única linha da fila; o projeto de origem permanece intacto; o fechamento conserva sua base financeira. Após completar a ação no domínio, comparação e fila mostram a mesma ação concluída, com o snapshot de fechamento original. Revogar apenas C05 retira os metadados da revisão e mantém a ação autorizada. Revogação entre as duas leituras do callback bloqueia a saída sem referência de revisão. Esse teste depende do incremento pareado WP08 de `handoff-relation` e ainda não executou.

`dashboard-agenda-consumer.test.ts` consome o producer estrangeiro publicado `createDashboardAgendaSelector`, de `astra-interface` em `b13b28a8c8843b1c1b8cd81a3c7e627e700287de`, blob `32b95d4a270cb9b9c987c6cb3097dbd6de975895`, sem editá-lo. Usa comandos reais para dois projetos de mesmo nome e seleção por referência exata; confere Budget/Projects/Hot Topics, ordem, contagens, remoção, vazio, Talent negado e nenhuma escrita de negócio durante seleção. O cenário está preparado para Actions.

O cenário C06 é ampliado de v1→v2, já executado, para a sequência real v1→v2→v3 antes da preservação e v3→v4 depois dela. Os dois formatos devem conter v3 exatamente uma vez e excluir v1/v2/v4. As duas próximas capturas de navegador passam a `fullPage: true`; a UI e o producer do cenário permanecem os mesmos.

## Deltas exatos para fontes de outros owners

### Astra Compose — montagem do produto

`apps/cli/src/sucafina-product/review-services.ts` no head publicado `8f760659279567d2c169691c3e57cf19be10417d` ainda tinha blob `e795aa2e8667a0da134a00ce6012fe1f7f1dc712`, igual ao inspecionado antes. A montagem deve fornecer os seguintes inputs próprios já publicados/preparados, sem clonar engines ou usar o material arquivado como fonte corrente:

1. `createReviewApplication.routineProduct`: produto WP09 real (`openResult`, `descriptors`). A aplicação cria o reader governado; o host não passa conteúdo do cliente como snapshot.
2. `collaboration.threads`: `business.collaboration.threadReads`, com `read` e `readHistorical`; `history`: `business.collaboration.threadHistory`; `authorizeSourceContinuity`: `business.collaboration.authorizeThreadSourceContinuity`. O mapping exato de evidência permanece obrigatório.
3. `createCollaborationHost.reviewContexts`: callback para `reviewApplication.closures.listByAction`. Uma referência tardia pode resolver a ordem de construção; antes de a revisão estar montada, retorna indisponível, sem fabricar contexto. O callback só enriquece a fila canônica.
4. Handoff: conservar `createSfReviewHandoffs` publicado e seus leitores reais de relação/HotTopic. O novo WP08 reader de target concluído preserva a relação armazenada e prova a continuidade física/ACL atual do HotTopic.
5. Dashboard: consumir o blob atual do selector de pauta verbatim. O novo teste WP07 é consumidor desse producer, não uma implementação substituta.

### C05/C17 — histórico completo sob ACL corrente

O teste externo `meeting-number.test.ts`, run `43580185033`, head Interface `b13b28a8c8843b1c1b8cd81a3c7e627e700287de`, encontrou 403 ao reabrir a mesma revisão depois de 1300→2400 na mesma fonte física. Essa contraprova permanece registrada. Ela **não** é imputada ao novo Compose8f sem reteste: esse head passou a fornecer um producer adicional de record histórico.

`review-history.ts` em Compose8f, blob `0c9a68225d114ba77617af4a0e3acc2607ea0e5a`, delega primeiro a `business.evidence.resolve`; seu fallback ainda seleciona capturas por identidade/stamps de authority e scope histórico. O owner precisa provar a cadeia completa de C05, dados e comentários após atualização legítima, policy/access rollover, exclusão permitida e revogação. Deve conservar bytes, período, incarnation e stamps originais e receber autorização histórica do domínio. Um grant corrente, mesmo para o mesmo principal, não prova por si só permissão ao histórico. Nenhum arquivo desse owner foi alterado por WP07.

### UI geral e evidências nativas

O owner da UI geral deve consumir `WorkPresentationItem.reviewContexts` da mesma linha de ação para navegar ao C05 autorizado e ao projeto, e não criar outra fila. O destino continua sujeito à releitura canônica e à revogação.

O host de execução deve fornecer o recibo e resultado de uma execução real governada para os contratos C16 e C07. WP07 não pode corrigir essa lacuna forjando binding native, promovendo fixture de Session ou reativando workers. S0 executa o epic apenas sobre o bundle final completo; nenhuma suite epic foi executada por este grupo.

## Exports e limites visuais preservados

Os quatro artifacts anteriores conservaram as 85 imagens inspecionadas, comparadas pixel a pixel: DOCX legado 6 páginas, PPTX legado 26 slides, DOCX preservado 14 páginas e PPTX preservado 39 slides. Os dois artifacts novos históricos gerados no check02 acrescentam DOCX de duas páginas e PPTX de seis slides; root inspecionou todos os oito, encontrou os textos v3/v1 íntegros, ausência distinta de zero e nenhum clipping/overlap. São fixtures sintéticas de layout e conteúdo, não prova de ACL do host.

O artifact de navegador `14109660013`, SHA256 `3ff1b8c032e59e651f83186aac8630af1adcb10af4f0fc0a0d4c135bd00b4814`, preserva as duas capturas da CI03. Elas mostram apenas o viewport e não estabelecem aceitação visual de toda a conversa; o incremento05 corrige o enquadramento na próxima execução afetada. Todos os testes de produto, typecheck, guards e geração dos exports ocorreram exclusivamente em GitHub Actions. A inspeção dos artifacts baixados não executou produto.
