# W23 — admissão real da seleção Procurement no fixture

## Alteração aplicada

Somente `modules/sucafina/Sucafinav1/test/product/wp10/integration/scenario-operation-access.test.ts` mudou sobre o W22 publicado `4bc9c7220f04f113609393aaba38934a7e69878b`. O novo helper local `selectPeriod` admite e valida `sf_work_list` no Request real, com `digestSfValue({ purpose: "work-selection", period })`. Ele aguarda o produtor real de seleção e finaliza apenas a nova lease em `finally`, inclusive quando a validação ou o produtor recusa.

O setup e a contraprova de mudança de período usam esse helper. As duas asserções continuam exigindo `status === "ok"`; o restante da contraprova continua exigindo que a leitura da prova seja recusada após a alteração.

## Causa hospedada

No W21 `532da498e08fa36fadbd3c01e3e7da00d869dd47`, snapshot `6cc1999f0614f6002f2d1bfc72be2edd82ae7594`, run `43605495862`, job `132479126824`, o arquivo teve seis passes e treze falhas. Todas as treze pararam na linha 280 do setup, com `ok` esperado e `denied` recebido. O run completo terminou com 49 passes, 30 falhas e um erro adicional, em 79 testes/10 arquivos. Cleanup foi bem-sucedido; não houve artefato disponibilizado pela API.

`financialCompositionFixture.read()` fornece uma lease consumida de `sf_review_prepare`, com digest de Review. O guard de `procurementSelections.create` exige a intenção consumida de `sf_work_list` e o digest do período selecionado. Logo, o código publicado retorna `selection-authority-unavailable` nessa fronteira; essa razão é uma dedução estática do guard, pois o log da asserção exibiu apenas o status. O grant correto já existia e permanece inalterado.

## Preservação da lease original

A API real `ui-authority` usa um WeakMap por objeto de contexto. `admit` cria um novo contexto, requestId e lease; `validate` consome apenas essa entrada; `finish` remove apenas o contexto recebido. O helper nunca reatribui nem finaliza a call de prova original. Seu Request, o finalizer ligado ao deadline e a leitura final de case continuam usando a call original.

A seleção de período é registrada pela API existente em uma chave de autoridade composta por instalação, projeto, principal, versão da política e revisão de acesso. Essa chave exclui requestId e expiração. Por isso a seleção explícita, feita pela nova lease autorizada, fica disponível ao mesmo principal da call original sem transferir ou substituir a lease. A contraprova de período emite outra admissão com o novo digest e mantém o ponto de interleaving após o segundo fence.

## Verificação e limites

A comparação textual reversa confirma somente quatro hunks: helper, chamada no setup, chamada no contracaso de período e exposição do helper no retorno do fixture. Todos os 19 casos, matrizes, nomes, asserções, contadores, limites externos de 120000 ms e deadlines cooperativos permanecem. Nenhum grant, guard, arquivo estrangeiro, fixture financeiro compartilhado ou código de produção foi alterado por este pacote.

Foram feitas apenas leituras estáticas, comparações textuais e hashes. Não houve teste, typecheck, import ou build local de produto, publicação ou despacho CI. O arquivo completo precisa ser executado no CI hospedado do sucessor; a correção estática da admissão não demonstra ainda que as asserções seguintes passaram. Esta entrega de builder não é revisão independente nem aceite nativo/global.
