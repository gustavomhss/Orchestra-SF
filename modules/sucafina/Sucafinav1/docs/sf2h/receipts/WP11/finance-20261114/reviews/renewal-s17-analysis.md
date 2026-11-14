# S17 — custo de observação de fonte no replay de renovação

**Estado: correção estática congelada; ganho de duração e aprovação de produto dependem do Actions no candidato exato.** Nenhum teste, import de produto, comando Bun, typecheck ou escrita remota foi executado por esta frente.

## Evidência observada

Run [43591635600](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43591635600), job `132437416020`, produto W26 `0c4a2545a63b4903c7eedb00d3f0989eb74ed398`, snapshot `2b2b2eb1872d09a3a2dcee24f3f679ef4f9e7ad4`: **4 pass,15 fail,165 assertions,713,39s**. Esta frente trata somente os dois deadlines de renovação; não atribui a eles as falhas de inicialização ou de diagnóstico de current-choice.

| Caso | Observação |
| --- | --- |
| `renewal-choice-history` | Falhou em180008,19ms, limite180000. A preparação da fonte revisada terminou em160823ms; o deadline ocorreu em `threshold-after:start`. |
| `renewal-choice-revision` | Falhou em210367,19ms, limite180000. A preparação revisada terminou em177207ms; faltava concluir a nova operação humana. |

No primeiro caso, o trace acumulou658 verificações source-only e100931ms nesse limite. As observações `operation-source` e `operation-coverage` acumularam24019ms e19470ms. O estado C08 já tinha1367034bytes. No segundo,352 verificações source-only acumularam71843ms; as observações de source/coverage somaram19667ms/16109ms. Esses dados são os logs existentes do Actions, não medições locais.

## Causa demonstrada na composição

`createRenewalQuoteRevision.currentSource`, em `renewal-source-fixture.ts`, confere a projeção atual por `fixture.store.transaction("planner", …)` em cada observação da nova fonte. Antes da revisão, a fixture usava referências sintéticas estáveis com lookup em memória; a revisão acrescenta corretamente a leitura real do domínio.

O `LocalStore.transaction` externo lê e decodifica **Dashboard, Planner e Procurement** antes do callback. Portanto cada observação Planner isolada também decodifica o C08 crescente do Dashboard, contendo escolhas, resultados e recibos de transação. O verificador canônico faz várias observações independentes de fonte/projeção/cobertura; essas observações continuam necessárias, mas estavam abrindo repetidamente a mesma fronteira externa de armazenamento.

O mesmo LocalStore já suporta uma transação de leitura aninhada: ela usa o contexto assíncrono da transação atual, clona apenas o snapshot da superfície selecionada e proíbe commits aninhados. Não foi necessário modificar esse produtor compartilhado.

## Delta próprio

| Path relativo ao package | Blob anterior | Blob candidato |
| --- | --- | --- |
| `test/product/wp11/renewal-operation-verifier.ts` | `f83ca8b14429905f84d42d27bb57e8b19d7aba42` | `2338917427497733e4bd88aec852985206cce066` |
| `test/product/wp11/renewal-read-scope.test.ts` | Novo | `d91a07ddb9dc9cc5d093121112b7603533d4e1fb` |

Cada invocação de `createRenewalOperationVerifier` agora abre **uma transação real com `commit:false`**. Dentro dela continua executando o verificador canônico completo para cenários com operações/premissas, ou o mesmo `compareForecast` canônico para source-only. As chamadas aos leitores de fonte/cobertura, suas comparações exatas, o parser e todas as verificações internas permanecem. As leituras aninhadas usam a fronteira já implementada pelo LocalStore.

O request e a autoridade são conferidos antes da transação e novamente depois de ela devolver. O signal é passado à transação. Não há Map de resultado, autoridade ou projeção compartilhado entre invocações; a próxima invocação abre sua própria transação atual. Nenhuma avaliação de valor ou fórmula foi acrescentada à fixture.

Esta composição está restrita aos três consumidores do helper: `renewal-choice-fixture`, `renewal-human-choice-fixture` e `renewal-restart-reader`. Seus adapters resolvem referências já existentes e somente leem snapshots; não emitem fontes scoped ou registram cobertura durante a verificação. O caminho não é uma proposta genérica para envolver produtores que possam escrever identidades durante uma leitura.

## Provas discriminantes novas

`renewal-read-scope.test.ts` contém três casos, ainda não executados:

1. Verificações reais com três operações e source-only preservam integralmente os três snapshots duráveis.
2. Após uma primeira verificação aprovada, um comando OPEX canônico altera a fonte; uma segunda invocação recusa a referência anterior. Isso distingue uma observação atual de reutilização do scope anterior.
3. A concessão UI é revogada durante um callback de fonte aguardado dentro da transação. A verificação deve recusar, demonstrando que o scope não congela autorização.

Não se mede desempenho pelo número de chamadas mockadas nem se fornece um resultado financeiro calculado pela fixture.

## Oráculos e arquivos preservados

Os quatro consumidores abaixo continuam byte idênticos aos blobs publicados; nenhum teste foi dividido e nenhum timeout ou assertion foi enfraquecido:

| Consumidor | Blob preservado | Linhas de assertions | Timeout |
| --- | --- | ---: | ---: |
| `renewal-choice-history.test.ts` | `6dcb733518a225039da3e7d7f39ff1c63a35fb09` | 41 |180000 |
| `renewal-choice-revision.test.ts` | `c2901936d6730b56422b2c495069c0ed0a0705ce` | 44 |180000 |
| `implementation-quote-history.test.ts` | `5e4519aaf1cc7d9bb17a1ec93b81ea950084bb2a` | 28 |180000 |
| WP05 `choice-history-bi.test.ts` | `cf93dff4919989322c28a3a04fd6380629f3caa1` | 69 |180000 |

Preservam-se os12 meses explícitos da cotação de treinamento,40000 em novembro, ausência/null/zero, shared/N/A, operação humana separada, escolha original, preparo/aplicação distintos, reinício/reabertura e replay. Os thresholds55000/15000, implantação70000, total235000 e vantagem5000 não foram alterados.

## Validação e risco restante

A seleção afetada é o novo teste de boundary, os dois históricos de renovação, a cotação de implantação70000 e o BI de mesmo caso. O coordenador controla as seleções WP11/WP05 pelo protocolo CI.md. Os quatro consumers usam o helper, diretamente ou pelos seus fixtures, e qualificam fronteiras distintas. Não repetir outros batches inalterados por causa deste delta.

A transação externa mantém o lock de admissão do LocalStore durante **uma invocação** inteira do verificador. Nestes fixtures os callbacks são locais, limitados e somente de leitura; nenhuma mutação humana ou comando de domínio fica envolvido nesse scope. Ainda é necessário medir no Actions se a redução de decodificações é suficiente para os deadlines originais e confirmar que todas as negativas permanecem discriminantes.

O ganho de duração não está demonstrado por esta inspeção. Prova instalada/nativa, revisão de aceite C/D e epic do bundle permanecem separados. Não se declara READY ou DONE.

Arquivos congelados: `renewal-s17-changes.json`, `renewal-s17-files-ready.json`, `renewal-s17.diff`, `renewal-s17-analysis.json` e este relatório. O JSON conserva a evidência S17, limites, consumidores, hashes e proposta de seleção.
