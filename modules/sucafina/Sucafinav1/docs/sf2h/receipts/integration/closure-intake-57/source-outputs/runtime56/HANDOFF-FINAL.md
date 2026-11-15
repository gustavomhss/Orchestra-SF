# Missão56 — cópias frescas de runtime

## Entrega e autoridade

**Fonte qualificada pela seleção cirúrgica; gates e composição pendentes.** O produto publicado é W1 `b6b8f664c3ba6766891731267177ba541dbe47b6`, tree `f629c4cd1e73c090de2e820c4c1a214b8ca99e9e`, na branch `runtime-read-cost`. A [PR draft #71](https://github.com/gustavomhss/Orchestra-SF/pull/71) aponta para `sf2-stack`. Os commits posteriores ao W1 contêm somente recibos próprios. O commit que publica este handoff e `AUTHORITY-FINAL.json` encerra explicitamente a lease56; seu SHA/tree são confirmados por readback e publicados na PR e nos comentários de entrega.

ACK56 foi publicado em `086132a98f90bff7e7b7904a5ce0bfbd81c09e47`. A leitura distribuída cobriu o pacote S0-C completo, START/WORKFLOW/COMMON, três anexos, AGENTS, missão56, propostas A54, código corrente e evidências. [ACK56.json](ACK56.json), [DESIGN.json](DESIGN.json) e [reviews/FINAL.json](reviews/FINAL.json) registram pins, hashes, decisões e atribuição das revisões.

A55 permanece a única integradora do stack. Na reconciliação final, `sf2-stack` estava em `9b1670be4132ef78efb9126fca1562a3fcb1d633`; runtime e teste estrangeiro ainda tinham exatamente os preimages deste pacote. A54 publicou terminal explícito em `651738f8ebcf003a4c66517a72f0ebd9a7c95050`, estado `TERMINATED_WITH_P03_FAIL_AND_GATES_PENDING`. Essa constatação substitui a informação antiga de que ainda executava P03; não transfere seu domínio à56 nem reativa sua lease. O material é encaminhado às PRs55/#65 e54/#37 com ACK solicitado. A45 recebeu o pedido dos checks na PR#32.

## Mudança implementada

Em uma root de uma só superfície, o alvo entregue ao callback continua mutável. Cada observação desse alvo percorre `cloneSnapshot` e sua validação. As superfícies não expostas ao callback podem, quando seu payload coincide com um plano imutável já admitido no memo, produzir uma nova cópia por materialização nativa a cada `currentSnapshots` ou leitura nested. Nenhum grafo mutável é compartilhado entre essas observações.

As três superfícies continuam sendo observadas no SQL sob o lock existente. Payload alterado passa pelo decoder/validação antes do callback, mesmo quando a superfície não será solicitada. Em um miss, o comportamento Finance34 continua: decoder, eventual plano no memo compartilhado e snapshot privado para clone posterior. Só hits do memo inicial recebem fábricas de cópia. `transactionAll` permanece no caminho de snapshots mutáveis e clone validado. O percurso por descritores também evita os pares intermediários criados por `Object.entries`, mantendo a verificação de accessor.

Não houve mudança de contrato, engines, Portfolio, fixture P03, autorização, callbacks, replays, workflow ou contagem de observações. Escritas nested proibidas continuam envenenando a root mesmo quando a rejeição é capturada. Scope, reader count, capacidades capturadas, abort e descarte mantêm seus fences.

## Memória e validade dos dados

A proposta A54 foi adaptada: capturar também planos recém-criados durante a admissão poderia superar o argumento de retenção da Finance34. Nesta implementação, a união dos planos capturados por lazy materializers e fábricas é um subconjunto do memo inicial limitado.

- Memo compartilhado: no máximo três entradas e **8.388.608 unidades UTF-16**, equivalentes a 16MiB de conteúdo de strings.
- União adicional de planos capturados por uma root: no máximo outro budget igual. Esse limite já existia para planos capturados e evictados durante a admissão.
- O record adicional de fábricas é limpo no encerramento. Materializadores lazy ainda não consumidos podem manter os mesmos planos por descendants de ALS encerrados; não afirmamos liberação completa de todos os planos ao fechar.
- O limite não mede heap total, graphs decodificados, objetos auxiliares, alocações temporárias, cópias retidas pelo chamador ou outras instâncias.
- Os thresholds de depth128, nodes200000 e paths de undefined4096 continuam sendo limites da otimização, com fallback para dados válidos.

As regressões executadas preservam rejeição de accessors de objetos, ciclos, funções, não finitos, símbolos, protótipos inválidos e metadata inválida; também preservam undefined, -0, `__proto__`, ordem e normalização de arrays esparsos. O baseline usa `Array.from` para arrays e pode avaliar getters indexados. Não é feita uma promessa nova de rejeitar todos os accessors em arrays.

## Prova real em GitHub Actions

Todos os testes de produto foram executados no protocolo `test:ci`, com Bun1.3.14 e SQLite/local-store reais. Cada snapshot S adiciona somente `.ci-run.json` ao respectivo W. Foram dois dispatches, ambos deduplicados antes da criação da branch, sem retry idêntico, epic, teste local de produto ou P03. O [ledger completo](ci/LEDGER-FINAL.json) contém W/S, árvores, requests, jobs, nonces e cleanup.

| Execução | Identidades | Resultado |
|---|---|---|
| [B0 — controle](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43659727318) | W `94b2768385d181ee6f7aba7b42558a62d3e5a98d`; S `ba2375dcf1ca273ea26e884e60bb8f70014ecfd7`; job `132646107638` | **0 PASS / 1 FAIL esperado**, 23.631 assertions; só custo, runtime original. Último oracle recebeu224000 em vez de0, depois das verificações de carga e isolamento. |
| [R1 — candidato](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43660001174) | W `b6b8f664c3ba6766891731267177ba541dbe47b6`; S `f74ed163aa647ba0f4c85fa5968f161bc3a0e4fb`; job `132646961999` | **65 PASS / 1 filtered / 0 FAIL**, 24.522 assertions, 11 arquivos,3,04s reportados pelo Bun. |

R1 contém23 casos funcionais novos,1 teste de custo,1 substituição de oracle e40 regressões existentes selecionadas. Exercitou os três targets, mutação e independência de cópias, transactionAll, dados inválidos, limites/fallback, rollback false/throw/abort, generations, writes capturados e engolidos, readers pendentes, handles encerrados, descarte, reabertura, commits por outra conexão SQLite, mudança/deleção/corrupção SQL, eviction e revogação/Request abort nos callbacks reais de autoridade. [Lista executada](ci/R1-selected-tests.json).

Os jobs de cleanup terminaram com sucesso. A verificação de Omni foi `not applicable` nos dois runs: esta seleção não prova spawn de Omni. Logs integrais: [B0](logs/B0.log.txt), [R1](ci/R1.log.txt), [resultado R1](ci/R1-result.json). Nenhum resultado foi promovido a prova de ambiente instalado ou do stack composto.

### Oracle Finance34 fora do escopo de escrita

O teste legado `one root materializes a demanded sibling once while nested and current snapshots remain independent staged copies` exige `nativeDashboard === 1`: uma materialização privada seguida de quatro clones JS. O novo caminho produz quatro materializações nativas independentes para as mesmas duas leituras nested e duas chamadas a `currentSnapshots`.

Como o arquivo pertence a outro escopo, seu source permaneceu intacto em W1. R1 filtrou somente esse título exato e executou `surface-demand-replacement.test.ts`, que preserva as19 assertions, incluindo isolamento após encerramento e SQL inalterado, atualizando somente título e contador estrutural para4. Os outros seis testes do arquivo legado passaram. **Não se declara PASS do arquivo legado integral sem adaptação.**

O [patch estrangeiro](external/surface-demand.patch), [preimage](external/surface-demand.preimage.txt) e [postimage](external/surface-demand.postimage.txt) são inertes e destinados à55. O postimage estrangeiro não foi instalado nem executado como esse arquivo no W1; o cenário equivalente foi executado no namespace autorizado. A55 deve reconciliar essa expectativa ao compor e qualificar a seleção relevante na árvore composta, preservando todas as verificações semânticas.

## Trabalho e custo, com carga preservada

O `cost.test.ts` é idêntico em B0/R1: blob `0a46c9113127542c43aed60951514a7397b5fdb6`, SHA-256 `900b1d820a4c47d90419f36df9a4373442c629593139d5d85f24e2bbe42a2896`. As duas execuções persistem300 linhas Dashboard,1200 Planner e400 Procurement, com os mesmos hashes, tamanhos, digests e ordem.

Cada root realiza1 callback externo,60 leituras nested Planner,20 Procurement e20 `currentSnapshots`: **81 callbacks e118.300 linhas consumidas**. Foram12 roots cronometradas,1 warmup e1 root instrumentada separada por revisão. Os globals permanecem nativos durante a medição temporal; wrappers pass-through de descriptors/parse só existem na root de contagem. Nenhum timer ratio é assertado.

| Trabalho por root instrumentada, fase copies | B0 | R1 |
|---|---:|---:|
| Objetos marcados Planner/Procurement atravessados por descriptors | 224.000 | **0** |
| Objetos marcados Dashboard mutável atravessados por descriptors | 12.000 | **12.000** |
| Chamadas totais de descriptors | 236.980 | 12.140 |
| Chamadas `JSON.parse` | 4 | **240** |
| Caracteres enviados a `JSON.parse` | 511.152 | **35.658.440** |

O custo de construir cópias permanece: traversal JS repetido foi substituído por parsing nativo independente nos planos não alvo elegíveis. O aumento de parsing é parte explícita do resultado.

| Mediana observada por root | B0 | R1 |
|---|---:|---:|
| Root completa, wall time | 274,86ms | 113,02ms |
| Leituras nested antes do callback, síncrono | 176,25ms | 62,28ms |
| `currentSnapshots`, síncrono | 84,12ms | 37,01ms |
| Admissão da root, wall time | 1,26ms | 1,14ms |
| Trabalho síncrono do callback | 16,62ms | 12,77ms |

**Limite da comparação temporal:** B0 usou runner Azure/centralus, imagem20261111.370.1; R1 AWS/us-east-1, imagem20261111.127.1. R1 também executou outros arquivos antes do custo. Os12 samples são seis pares sequenciais da mesma revisão, não A/B randomizado na mesma máquina. Portanto, a diferença observada não é uma estimativa causal isolada nem garantia estatística de speedup. A evidência causal principal é a redução estrutural com carga e semântica verificadas. Spans síncronos nested/current são disjuntos; wall times não devem ser somados como custo de CPU. Não houve medição de heap/RSS/alocação total. [Métricas integrais e limites](metrics/comparison.json), [B0](metrics/B0.json), [R1](metrics/R1.json).

P03 continua aberto. O diagnóstico A54 tinha233 `currentSnapshots`/677ms síncronos em um timeout original de180014,84ms e37120 transações Planner/99590ms inclusivos. Tempos inclusivos se sobrepõem e incluem callbacks: não são CPU de clone nem podem ser somados para prometer resolução. Nenhuma cópia de P03 foi executada pela56.

## Pacote para composição

[MANIFEST.json](delivery/MANIFEST.json) contém pre/post Git blobs, SHA-256, bytes, modos e paths exatos. Os patches foram aplicados apenas a árvores parciais scratch para validação textual; isso não executou produto nem substitui CI. [Recibo da reconstrução](delivery/patch-check.json).

| Artefato | Conteúdo |
|---|---|
| [runtime.patch](delivery/runtime.patch) | Mudança completa de `runtime/local-store.ts`. |
| [source-and-tests.patch](delivery/source-and-tests.patch) | Runtime e sete arquivos de teste/helper: oito paths materiais publicados. |
| [composition-with-oracle.patch](delivery/composition-with-oracle.patch) | Os oito paths mais o delta de título/contador do teste estrangeiro, para adoção pela55. Não aplicado na branch56. |
| [runtime preimage](delivery/runtime.preimage.txt) / [postimage](delivery/runtime.postimage.txt) | Bytes completos e verificados da implementação Finance34 original e candidata. |

Runtime: `e9da289bdce680f2429904c1e83dec60c39aa2a8` → `666259511ad459629ef52f48aca20b231b0dff4b`. Oracle estrangeiro: `8a81665075aab6f8afa37105d3174d698f18bb9e` → proposta `0ac3c01f77c013d05ee8fecb69c401acd126b942`. Se o target mudar, a55 deve reconciliar os novos bytes sem sobrepor mudanças alheias. As evidências de W1 não qualificam automaticamente outra árvore.

## Pendências e término

1. **A55:** confirmar ACK, reconciliar preimages/dependências e o oracle estrangeiro, compor seletivamente e executar a qualificação pertinente da nova árvore. A PR permanece draft; não houve merge.
2. **A45:** executar `bun typecheck` em `modules/sucafina` e `bun run check:guards --base origin/dev` na raiz, conforme [REQUEST-45.json](checks/REQUEST-45.json) e [pedido na PR#32](https://github.com/gustavomhss/Orchestra-SF/pull/32#issuecomment-6886858884). Ambos estão **NOT_RUN** nesta missão. Não foi criado workflow nem tomado ref de45.
3. **A54/autoridade de P03:** receber ACK técnico e usar o patch somente em futura execução autorizada sobre o cenário fixado ou candidato55. O terminal A54 não autoriza56 a executar P03.

Não há runs56 ativos ou enfileirados. [CONSUMER-RELEASE.json](CONSUMER-RELEASE.json) libera o pacote qualificado e registra ACKs solicitados, ainda não recebidos. [AUTHORITY-FINAL.json](AUTHORITY-FINAL.json) encerra explicitamente a missão como `TERMINATED_SOURCE_QUALIFIED_GATES_PENDING`. Permanecem15 WPs,74 tarefas,17 contratos,1610 critérios e T0 `2026-11-13T04:01:10Z`, sem fechamento global por este patch. **GLOBAL_RELEASE=false.** Nenhum recurso Azure, deploy, dev merge, engine ou source de outro owner foi alterado.
