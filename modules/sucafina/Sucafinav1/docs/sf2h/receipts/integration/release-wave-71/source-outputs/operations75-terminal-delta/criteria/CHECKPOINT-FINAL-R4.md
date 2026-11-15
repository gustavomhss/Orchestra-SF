# Missão75 — checkpoint final dos critérios após R4

As cinco jornadas originais Operations passaram no candidato composto C40. Quatro falhas históricas foram resolvidas no escopo dessas jornadas, e OP-PROC-01 preservou seu PASS. O checkpoint conserva os 251 critérios completos — 111 WP04 e 140 WP06— com seus IDs, textos e histórico63, além dos dez registros de gaps históricos.

## Evidência e identidade

| Seleção | Produto | Snapshot | Resultado |
|---|---|---|---|
| R3, controles reais | W4 d50287e998b2f42f548bce3b72b75e16eff40043 |209c613895a2555ba7de8befc33f1bd41b263f62 |7 PASS,0 FAIL,0 skip,150 expects,3 arquivos |
| R4, cinco originais | C40 eb58cd9e9f8125d879bff260d6d794264b9dc53a |901dc9e2a70f2e89d5a4f0d2a768205a7252413e |5 PASS,0 FAIL,0 skip,0 flaky |

C40 tem tree b325894e636ae31db80886bb9ca2add1ce4ec126. O snapshot R4 tem tree 97cfe87165038481ffb1d5b3ad98fa673a2fafcc, pai único C40 e delta exclusivo .ci-run.json. A seleção canônica tem SHA-256 e4201f174defe27af1f45cac85a40535e665aa851eeb6e803311b9ae72085717.

[R3: run 43672349552](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43672349552), job 132684956460, permanece evidência de seus controles no produto W4. [R4: run 43675784039](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43675784039), job 132695512980, tentativa 1, concluiu SUCCESS com um worker, zero retries e uma repetição.

## Resultado dos cinco casos

| Caso | Histórico63 | R4 em C40 | Duração |
|---|---|---|---:|
| OP-PROC-01 |PASS |PASS |1.990 ms |
| OP-PROC-02 |FAIL |PASS |10.968 ms |
| OP-PROC-03 |FAIL |PASS |10.367 ms |
| OP-IMPORT-01 |FAIL |PASS |7.751 ms |
| OP-DOC-01 |FAIL |PASS |23.384 ms |

A especificação original permanece no blob bab6a804e5f082cc60eb6f27209070b552981035 e SHA-256 29c9dcd28d0de5726770feac79be3f11652c349de2cbac09e8517307663f76fb. Os nomes, IDs, anotações, ações, oráculos e budgets de 60000 ms por teste e 10000 ms por expectativa foram preservados. As durações acima medem execução automatizada.

Os anexos registram os valores literais J04/C02 e o sourcing mantido em 30240 USD após alteração de FX, enquanto a PO futura passa a 56000 com taxa 2. A ausência de FX continua indisponível e recebe 422 sem nova versão decorrente da submissão recusada. Importação registra exatamente um Apply e recuperação do mesmo recibo após perda da entrega da resposta, por GET, Refresh receipt e reload. O TXT confirma Price 42 USD com referência exata e, após revogação da fonte, asset 403, evidence 409 e discovery 0.

PROC01 preserva C06 material NOT_EXERCISED; PROC02 preserva BLOCKED_DEPENDENCY. O PASS desses casos não fecha C06 amplo.

## ClamD e controles

R3 executou os sete controles live/private com ClamD real: clean/EICAR/clean-after, erro real de tamanho, daemon efetivamente indisponível, resposta malformada/unknown e admissões privadas reais com persistência, rejeição e ausência de efeitos duráveis nos negativos.

R4 executou novamente o setup real e efêmero: pacote ClamAV 1.5.4 verificado, bases oficiais verificadas, 3.628.275 assinaturas carregadas, readiness PONG e controles diretos clean/EICAR/clean-after/size-error. O job usou 127.0.0.1:3310 e 3311 e encerrou ambos os processos como STOPPED, preservando evidências. Os sete testes R3 não foram relabelados como executados em C40.

O ZIP original R4 permanece íntegro: 319886 bytes, SHA-256 11fd4542d0a29a1841a0a640b7100cf04a340b0948db60a13139c262898a8d21, [artifact 14146162056](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43675784039/artifacts/14146162056). Seus cinco anexos JSON originais permanecem dentro do relatório runtime; o manifesto registra seus hashes. O parser documental realizou 299 verificações de consistência, sem falha. Esse número não é uma contagem de testes do produto.

## Critérios e gaps

A situação atual é 28 PARTIAL_WITNESS_ONLY e 223 NOT_RUN. Nenhum critério WP completo foi fechado. Os 25 critérios historicamente bloqueados continuam preservados como histórico63; seus witnesses atuais passam apenas no recorte anotado dos cinco casos.

| Gap histórico preservado | Disposição75 |
|---|---|
| M63-REAL-CLAMD |Resolvido no escopo R3 controles + R4 setup real |
| M63-PROC-02-UI |Resolvido pelo original em C40, usando unidade combinada73 |
| M63-PROC-03-A11Y |Resolvido pelo original em C40, com screen-shell75 |
| M63-IMPORT-RECOVERY |Resolvido pelo original em C40 |
| M63-DOC-CONFIRM-REVOCATION |Resolvido no original TXT em C40 |
| M63-DOCUMENT-FORMATS |Matriz ampla ainda não qualificada |
| M63-C06-CONSUMERS |C06 amplo ainda não qualificado |
| M63-TYPECHECK-GUARDS |Sem resultado checks45 observado |
| INTEGRATOR-AUTHORITY |Intake material71 reconhecido em C40 |
| GLOBAL-C-D-AM |Aceitação global ainda não qualificada |

A mudança de identidade/visibilidade durante um scan que aceita o arquivo continua NOT_DYNAMICALLY_EXERCISED. A revogação de fonte após confirmação documental tem outra ordem de eventos. PDF/DOCX e a matriz completa de formatos/negativos, leitores C06, natividade, Microsoft/Entra, AM01–AM06, medição humana, oito seleções finais, três revisões FINAL e C-G7/D-G8 mantêm seus próprios gates.

## Composição e HEAD posterior

A reconciliação registra host Bun63, identidade local e config preservados; unidade combinada73; screen-shell e instalação75; Atlas69, auth72 com readonly59 e BI62 retidos. O resultado R4 cobre o caminho real Operations desse C40. A análise de alcance dos incrementos é limitada e não promove seus testes de fonte a aceitação geral.

C41 foi observado posteriormente: 1074cf338619a70ddef1ad1f62e32618fc355fed, tree 3f98ab38aa223eefba708e566a42450d8f1c2a93, pai C40. O incremento Dashboard67 altera business-services, entre outros arquivos. C41 não recebe PASS de R4; sua disposição de qualificação permanece com 71/S0. Nenhum rerun foi feito por este trabalho documental.

O handoff terminal do recurso CI permanece registrado como pendente no instante deste checkpoint e será disposto no recibo terminal de 75. A matriz não inventa resultado de compiler 45 nem aceitação global.

## Afirmação recomendada para o handoff

“Os cinco originais Operations passaram em C40, preservando as cinco identidades, ações, oráculos e budgets, com ClamD real efêmero no job. Os sete controles live/private passaram separadamente em W4/R3. Permanecem 28 witnesses parciais, 223 critérios não executados e zero fechamento integral dos 251 critérios. A prova não se transfere para C41.”

Este arquivo e a matriz foram produzidos por reconciliação documental de evidências existentes. Nenhum produto, teste, build ou typecheck foi executado localmente; nenhuma escrita remota foi realizada por este agente.
