# WP11 — Revisão de requisitos, proveniência e retomada

Esta revisão preserva os **83 critérios próprios** do pack, com textos literais: 18 no WP, 14 em T01, 21 em T02, 15 em T03 e 15 em T04. O [mapa de critérios](criterion-map.json) liga cada requisito às assertions inspecionadas, enumera os limites de cada evidência e mantém `NOT_ESTABLISHED` até haver observação hospedada suficiente. Arquivo de teste existente, fonte publicada e fixture não equivalem a critério concluído.

Fontes normativas: [handoff/pack no pin a3d29d0](https://github.com/gustavomhss/Orchestra-SF/blob/a3d29d011ba3607a57914701300f09117a3e2de9/modules/sucafina/Sucafinav1/docs/sf2h/control/handoff/astra/WP11.pack.json), plano `dbf9547211d9b0fade619790de7c19c0869b7c7d` e seed WP11 `ff99e4b4de56bbf6e7ef36daf5d3eb749779017a`. O head da [PR32](https://github.com/gustavomhss/Orchestra-SF/pull/32) foi observado via GitHub MCP como `5866bcb2ed610f80138aaabc261acac4acf709cd` durante esta revisão.

## T01: provider real, identidades e concorrência

O teste novo `test/product/wp11/case-authority-concurrency.test.ts` usa o provider C08 e SQLite reais, `createSfUiAuthority` e `createSfHumanAuthority`. Cria o caso pelo port, fecha e reabre o store e cria outra instância de provider. A segunda identidade admitida lê o mesmo conteúdo e versão; a receipt de criação conserva o principal original. Um terceiro principal admitido no host, mas fora de `participants`, é recusado pelo caso.

A associação do colaborador é uma transação de fixture explicitamente identificada. O teste não afirma que uma UI de compartilhamento foi exercida.

A barreira de concorrência fica **antes** da transação SQLite. As duas intenções humanas distintas chegam ao provider real com a mesma versão previamente lida; as assertions exigem um commit, um conflito e uma receipt de edição. Reenvio exato retorna a receipt; conteúdo diferente com a mesma correlação conflita. O rascunho perdedor permanece imutável e só é reaplicado após rebase e nova admissão humana.

A leitura estática de `case-management.edit` não encontrou perda concreta de atualização: ela combina versão do caso, versão do namespace, autoridade e fence dentro do lock. O teste foi revisado estaticamente por outro agente. **Não foi executado localmente nem possui PASS declarado neste documento.**

## C11: identidade exata e captura privada

Não foi encontrado bypass concreto de `operationIdentity` na cadeia publicada da PR32. O callback verificado do host obtém a identidade de `authority.native.operationIdentity(call)`, captura request/output/receipt e indexa o registro privado por essa identidade. `captureCurrent` exige binding vivo, geração, expiração, revogação, request do run e igualdade integral da captura.

O bridge verifica a receipt e a autoridade antes de invocar o callback. O run store compara a captura por `callId`, exige publicação compatível e repete a validação sob o lock antes de gravar run, contribuição e proveniência atomicamente. A string não vazia aceita pelo helper WP11 isolado não concede esse poder privado.

O [manifesto de consumo WP10](wp10-consumption-manifest.json) registra os blobs exatos e os testes discriminantes necessários. Ele não copia os apps/CLI nem transforma leitura estática em prova de sessão nativa, skill carregada, modelo real ou consumo depois de reiniciar.

## Portfólio: parent replay

No seed WP11, `mutations.replayPortfolio` não tinha caller no host disponível. Avaliar novamente o portfólio antes de consultar sua receipt pode falhar após um commit que avançou a versão do caso, mesmo quando a tentativa anterior já teve efeito.

A composição publicada da PR32 já fornece a solução:

- `portfolio-http.ts` admite retry histórico nos pedidos prepare/promote.
- `portfolio-handoff.ts` consulta primeiro a transação durável, valida principal, namespace, destino, encarnação e digests de parent/child, e cria um grant privado temporário para o child salvo.
- `portfolio-preparation.ts` fornece `portfolioParent`, autorização e verificação desse child.
- `portfolio-services.ts` envolve os caminhos HTTP e contribution antes de entrar na avaliação de inputs mutáveis.

O seam deve ser consumido pelo owner WP10/S0. Duplicar esse mecanismo no domínio de portfólio estrangeiro não é necessário. Os quatro arquivos são o conjunto lógico mínimo; suas importações ainda devem ser reconciliadas contra a composição escolhida.

O teste publicado `portfolio-preparation-composition.test.ts` verifica o lado de recuperação a partir de uma receipt semeada diretamente em C08. `portfolio-promotion.test.ts` cobre promoção HTTP real e retry. Esses dois fatos não são apresentados como uma prova única de perda de resposta após efeito real do parent.

## Current choice: integração e prova ainda necessárias

A revisão inicial encontrou `current-choice-preview.ts` e `current-choice-promotion.ts` sem ligação no produto/host/HTTP do seed. O fluxo para reavaliar uma escolha antiga após confirmar treinamento não podia ser alcançado por essas fábricas. A correção de montagem está sendo preparada em WP11; este documento não a declara executada ou aceita.

A prova discriminante deve conservar a mesma identidade de caso e o hash do ChoiceRecord original:

1. Registrar escolha condicionada com subtotal 210000, training ausente e total/diferença completa indisponíveis.
2. Confirmar a fonte real de treinamento 40000 pela autoridade apropriada.
3. Preparar o preview com continuidade da fonte, produtor WP03 e inventário C10.
4. Exigir revisão/confirmação humana para promover a nova alternativa.
5. Observar 250000, diferença de economia −10000, teto 15000 e falha do mínimo 20000, preservando integralmente a escolha antiga.
6. Recusar fonte substituída/revogada, caso concorrente e digest alterado; reconciliar retry sem duplicar resultado.

`choice-persistence.test.ts` preserva a escolha e reabre o provider, mas seu passo posterior só muda o objetivo por transação de fixture. `composite-coverage.test.ts` usa stores separados para omitted/null/zero/confirmed. Nenhum dos dois, sozinho ou por soma de resultados, prova T02.CHK.21 ou T03.CHK.20.

## Limites da evidência financeira e de execução

Cobertura completa e cenário aplicado são dimensões diferentes. Os testes compostos mantêm as operações hipotéticas: subtotal conhecido pode ser 210000 ou 250000 enquanto `total` continua nulo e `comparisonStatus` continua condicionado. Uma classificação de categoria não pode confirmar uma hipótese nem recalcular uma fórmula.

A ordem dos cenários determina o sinal de `knownDifference` no produtor. O consumidor do critério deve expor a convenção de economia do handoff usando o cálculo do domínio; não se deve inverter sinais informalmente no relatório para simular uma assertion ausente.

`execution-reconciliation.test.ts` exercita mutação Planner real, perda de resposta, receipt autoritativa, revogação e preservação de edição concorrente no caso. Seu segundo comando também é Planner. A prova exigida de **Planner aplicado e Procurement recusado** continua distinta, assim como aprovação formal pendente e receipt ausente/indeterminada.

## Registro de validação

- Leitura do pack e de fontes publicadas: concluída por operações somente de leitura.
- Extração: 83 IDs únicos com texto literal e associação de arquivo para critério.
- Testes locais de produto/typecheck: não executados.
- Runs hospedados novos: devem ser anexados pela execução principal com SHA de produto, SHA de request snapshot e run ID.
- Sessão nativa real, UI renderizada e paridade UI/native/MCP: não declaradas por este material.
- Merge, deploy e integração em `dev`: não realizados.

