# Revisão independente — transação de leitura da renovação

**Resultado: nenhum bloqueio estático encontrado nos dois blobs congelados. Publicação limitada pode prosseguir; ganho de duração, regressões executadas e aceite continuam pendentes.**

Esta revisão foi somente leitura de código, diff, manifests e logs já existentes. Não executei produto, imports, Bun, testes, CI, provas nativas ou comandos remotos. Escrevi apenas este relatório e seu JSON no scratch. O resultado não declara READY ou DONE.

## Escopo e pins

| Arquivo relativo ao package | Blob anterior | Blob revisado |
| --- | --- | --- |
| `test/product/wp11/renewal-operation-verifier.ts` | `f83ca8b14429905f84d42d27bb57e8b19d7aba42` | `2338917427497733e4bd88aec852985206cce066` |
| `test/product/wp11/renewal-read-scope.test.ts` | Novo | `d91a07ddb9dc9cc5d093121112b7603533d4e1fb` |

Recalculei os hashes dos dois arquivos: coincidem com `renewal-s17-files-ready.json`. O diff e `renewal-s17-changes.json` contêm somente esses dois paths. A baseline informada na atribuição foi W27 `332c5a762365e8550eaac7a278c864be0452651d`; os blobs do contexto efetivamente lidos estão registrados no JSON, sem presumir que um head posterior tenha sido revisado por completo.

## Constatações

### Escopo, isolamento e durabilidade

O helper, linhas 20–43, mantém o parser e admite request, signal e autoridade antes de abrir `host.persistence.transaction("planner")`. Ambos os ramos devolvem `commit:false`. Depois de aguardada a transação, o helper confere novamente abort e autoridade fora do escopo que ele abriu.

O LocalStore, linhas 80–198 e 200–276, usa `AsyncLocalStorage`. A transação externa lê Dashboard, Planner e Procurement uma vez e mantém `BEGIN IMMEDIATE`. Uma leitura filha clona apenas o snapshot da superfície solicitada, preservando a raiz. `commit:true`, escrita de blobs e operações de escrita aninhadas são recusados e contaminam a raiz; o pai não pode aceitar silenciosamente uma tentativa de escrita capturada por um callback. Os scopes fecham no `finally`; leitores ainda ativos impedem a saída normal. Com `commit:false`, a transação externa é revertida e o banco fechado.

O callback novo do helper não recebe nem usa a capacidade de blobs e não altera o snapshot raiz. A simulação canônica continua no snapshot filho isolado. Não encontrei caminho pelo qual essa mudança grave C08, Planner, Procurement ou uma ChoiceRecord.

### Verificadores e produtores canônicos preservados

Cenários com operações ou premissas continuam passando integralmente por `createPlannerOperationVerifier`. Permanecem autenticação com roleMap do snapshot, alvo único, período/moeda, referências de substituição, simulação Planner, comparações de projeção, reobservações de fonte e autoridade. O ramo source-only mantém `compareForecast` real e as comparações exatas da evidência e da fonte. O helper não fornece totais financeiros, avaliações ou resultados simulados.

As reobservações de banco dentro da mesma chamada passam a compartilhar deliberadamente um snapshot consistente. A autorização da fixture continua dinâmica: `ui.finish` remove a admissão da coleção observada por `revalidate`, sem depender do snapshot SQL. Também permanecem as verificações antes e depois dos callbacks assíncronos e as verificações externas adicionadas.

Não há cache novo entre chamadas independentes: os objetos persistentes da closure são portas/verificador/trace; source, projeções, resultado e escopo são locais à invocação. Se houver um scope LocalStore já aberto pelo chamador, o contrato existente de leitura aninhada usa essa raiz; isso deve ser descrito como herança de uma transação atômica, sem prometer uma nova conexão externa em tal situação.

### Consumidores reais compatíveis

| Consumidor | Fonte usada pelo helper | Escrita durante verificação |
| --- | --- | --- |
| `renewal-choice-fixture.ts:92–100` | `current.sources` da fixture inicial ou da revisão de cotação; a revisão confere a projeção em `transaction("planner", commit:false)` | Nenhuma observada |
| `renewal-human-choice-fixture.ts:75–109` | `currentSource` confere referência conhecida e projeção; cobertura de admissão responde unavailable | Nenhuma observada |
| `renewal-restart-reader.ts:58–82` | Referências persistidas, autenticação do ator e projeção atual em leitura Planner; cobertura de admissão responde unavailable | Nenhuma observada |

Nenhum dos três adapters inspecionados emite identidade ScopedSource, registra cobertura C10, escreve C08 ou chama `transactionAll` dentro da verificação. Os callbacks do trace apenas medem e aplicam o orçamento original. Esse resultado fica limitado a esses consumidores; não é aprovação para envolver qualquer producer de fonte em uma transação externa.

## Novas provas e provas preservadas

Os três novos casos são discriminantes e usam as fronteiras reais:

1. A fixture possui três operações reais. Após verificação completa e source-only, uma nova leitura compara os três snapshots persistidos com o estado anterior.
2. Um comando OPEX canônico com CAS grava `f10:46000` entre invocações; a segunda chamada precisa recusar a evidência anterior. Isso cobre reaproveitamento indevido do scope entre chamadas.
3. `ui.finish` ocorre na segunda observação aguardada de fonte, dentro da transação; o verificador precisa recusar e `revalidate` precisa retornar false. Isso cobre autorização revogada durante o callback.

Esses casos ainda não foram executados nesta revisão. Eles usam a fonte inicial; os históricos completos continuam necessários para exercitar a cotação revisada que abre leituras aninhadas, as escolhas persistidas e o reinício/replay.

Comparei os blobs dos quatro testes existentes ao manifest publicado: todos coincidem. O candidato não altera nenhuma assertion ou timeout.

| Teste preservado | Blob | Linhas com `expect(` |
| --- | --- | ---: |
| WP11 `renewal-choice-history.test.ts` | `6dcb733518a225039da3e7d7f39ff1c63a35fb09` | 41 |
| WP11 `renewal-choice-revision.test.ts` | `c2901936d6730b56422b2c495069c0ed0a0705ce` | 44 |
| WP11 `implementation-quote-history.test.ts` | `5e4519aaf1cc7d9bb17a1ec93b81ea950084bb2a` | 28 |
| WP05 `choice-history-bi.test.ts` | `cf93dff4919989322c28a3a04fd6380629f3caa1` | 69 |

## Evidência anterior e limitações

O log existente do run `43591635600`, job `132437416020`, pertence ao produto `0c4a2545a63b4903c7eedb00d3f0989eb74ed398` e ao snapshot `2b2b2eb1872d09a3a2dcee24f3f679ef4f9e7ad4`. Seu SHA256 bruto foi conferido: `bee8143075a7ec7ecfc512df315fa23f42ec3dbf7b438a0e597ab9cd90c8cb16`. Ele é evidência de falha anterior, não do candidato.

Os traces de deadline registram 658 chamadas source-only /100931ms no primeiro histórico e 352 chamadas /71843ms no segundo. A leitura do LocalStore e do `currentSource` da cotação revisada confirma o mecanismo plausível de repetição: cada observação externa redecodifica as três superfícies, incluindo o C08 crescente. A mudança remove essa repetição dentro de cada invocação. O tamanho do benefício e o cumprimento do orçamento de180000ms só podem ser demonstrados pelo Actions no commit candidato.

A transação segura o lock de admissão de escrita durante todos os awaits de uma verificação. Para estes callbacks locais e somente leitura, não encontrei incompatibilidade; fontes que escrevam identidades, callbacks de rede ou `transactionAll` exigem outra revisão. Lock timeout, abort ou tentativa de escrita filha podem rejeitar a Promise do helper; nada no candidato converte tais falhas em aprovação. Não considero necessário acrescentar um catch genérico para esta composição de teste.

Uma chamada fornece observação coerente durante a transação. Não prova que uma fonte não possa mudar após a liberação do lock, durante a revalidação externa, nem substitui fences de persistência/aplicação. O novo teste de edição entre chamadas cobre a observação fresca na chamada seguinte; não é prova de ChoiceRecord aplicada ou de replay durável. Esses contratos continuam pertencendo aos produtores de estado e aos históricos completos.

## Próxima evidência necessária

O coordenador deve executar a seleção cirúrgica do CI.md, incluindo o novo boundary e os históricos afetados, nos pins publicados exatos. Registrar run IDs, produto/snapshot SHAs, durações e resultados das negativas. Não aumentar timeouts ou relaxar assertions para fechar o resultado. Provas instaladas/nativas, revisão de aceite C/D e epic final de S0 permanecem separados e pendentes.
