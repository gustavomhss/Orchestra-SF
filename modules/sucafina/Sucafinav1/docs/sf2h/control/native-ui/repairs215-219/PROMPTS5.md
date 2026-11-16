# Cinco correções concretas — sessões novas215–219

Um bloco completo por chatNOVO. As branches estão reservadas; esta publicação não inicia os chats. Correções derivadas de findings207/208/209, com critérios originais preservados.

## 215

```text
Trabalhe em gustavomhss/Orchestra-SF em uma sessão NOVA. Missão215: Corrigir unidade e moeda na fronteira BI.

Branch preparada:sf-bi-units; HEAD:6015d23d4d0e08af32004e5b9d614320ca2a7142; epoch:review-fix-e1-browser215. Baseproduto7abf6c425e9b480bb43ba4a82f29c02a55445b92. Preserve todos os outputs anteriores. Confira HEAD/S0-FENCE e publique ACK com modelo/session quando expostos, sem inventar runtime.

Leia seu pacote COMPLETO, incluindo finding verificável, ordens completas e anexos obrigatórios:
https://github.com/gustavomhss/Orchestra-SF/blob/84924fbe8838a9ff8f7d3acdd6e9e6b5830e63d3/modules/sucafina/Sucafinav1/docs/sf2h/control/handoff/astra/parallel-closure/215.json
Leia AGENTS aplicáveis e código/dependências reais antes de editar. Planoimutáveldbf9547211d9b0fade619790de7c19c0869b7c7d,UXcbac654784714f68779ae1434d30e6ea8970c4d1. Preserve15WPs/74tasks/17contratos/1610critérios,39operaçõesMCP e todoUXaprovado; não reduzir escopo ou inventar autorização.

FINDING:REV208-NEW-001. Sua missão é corrigir o comportamento inteiro, de ponta a ponta:
1. Resolver REV208-NEW-001 sem permitir que igualdade de moeda masque conflito explícito de unidade. Não inferir conversão, FX ou equivalência entre horas/FTE/custo.
2. Preservar sérieUSDporcurrency e sérieFTEporunit válidas, rejeitarhours+USD→sérieUSD, moedas heterogêneas e dimensões conflitantes; manternull/zero/tabela/gráficoparidade e labels corretos.
3. Ler guard/producer/view reais e C10/C17/A08/U20/U21; implementar fronteira e regressõescomportamentais completas. Não trocar&&por||sem conferir semântica de unidade ausente/moeda opcional.
4. Entregar PR/código/prepost e request cirúrgico214; nenhuma alteração de política financeira, engine, frontend totals ou fontes.

Os paths de escrita são EXATAMENTE os do pacote. Esta é uma tentativa de correção de critério/finding já contratado na missão integral211, não novoescopo. A211compõe somente sf-closure-bundle/PR191. Abra sua PR para sf-closure-bundle, com findingID/tarefas no handoff e commits/blobs. Não escreva na branch211, sf2-stack ou na branchdeoutroautor. Mudanças fora delease devem ser patches completos INERTES com pre/post/contexto para211, não recomendações soltas.

Reaproveite produtores reais/entregasórfãs antes de criar adapters. Nunca use mock/porta vazia/catálogo/unavailable permanente como implementação entregue. Se faltaAPIreal, prove assinaturas/callchain e conclua toda implementação legítima independente; não faça bypass e não pare no primeiro impedimento. Não troque assert/fixture para esconder falha. Azurefoi informada pronta: não alterar recursos/deploy/login/novosacessos e não chamar readinessinfra de provadeproduto.

Não rode testes,typecheck,builds,validators locais ou CI próprio. Entregue requestcirúrgico com seletores/SHA/inputs à214 pelo handoff/PR;190 écompiler,199hostfixture,213desktopbootstrap. Produto e testes próprios completos, validação realNOT_RUN ou runIDs verdadeiros. Comentários são avisos, não contexto recebido por chatstarted; consumidores acompanham outputs previstos peloGit.

Faça toda a correção contratada até código/PR consumíveis. EntregueHANDOFF com critérios/casos,paths/prepostblobs,comportamento,dependências,checksreais,inputs externos mínimos e aceite de recheck independente208. Não pedir aprovação rotineira nem entregar só outro plano/relatório. UseGitHubMCP apenas para remoto,CASexpectedhead/force:false; sem gh/push/token/devmerge/deploy/Azure/engines/restart/guardbypass/segredos. Goalnativapausada,GLOBAL_RELEASEfalse,semnewsupervisor/watchdog.
```

## 216

```text
Trabalhe em gustavomhss/Orchestra-SF em uma sessão NOVA. Missão216: Corrigir integridade da sequência persistida Atlas.

Branch preparada:sf-atlas-sequence; HEAD:f9aca032271d1b683647b701f2c02c703eaaea20; epoch:review-fix-e1-browser216. Baseproduto7abf6c425e9b480bb43ba4a82f29c02a55445b92. Preserve todos os outputs anteriores. Confira HEAD/S0-FENCE e publique ACK com modelo/session quando expostos, sem inventar runtime.

Leia seu pacote COMPLETO, incluindo finding verificável, ordens completas e anexos obrigatórios:
https://github.com/gustavomhss/Orchestra-SF/blob/84924fbe8838a9ff8f7d3acdd6e9e6b5830e63d3/modules/sucafina/Sucafinav1/docs/sf2h/control/handoff/astra/parallel-closure/216.json
Leia AGENTS aplicáveis e código/dependências reais antes de editar. Planoimutáveldbf9547211d9b0fade619790de7c19c0869b7c7d,UXcbac654784714f68779ae1434d30e6ea8970c4d1. Preserve15WPs/74tasks/17contratos/1610critérios,39operaçõesMCP e todoUXaprovado; não reduzir escopo ou inventar autorização.

FINDING:REV208-NEW-002. Sua missão é corrigir o comportamento inteiro, de ponta a ponta:
1. Resolver REV208-NEW-002 validando ordinal persistido, unicidade e ordem monotônica real do journal. Não comparar cadaevento ao seqconstante de versioned([record]); preservar formato/compatibilidade e falha fechada.
2. Cobrir pelo menosdoisrecordscommitted, leitura/reabertura positiva, nextappend apósrestartmonotônico; duplicate/outoforder/tamperedordinal devem falhar semvazarrecords oucommitarappend.
3. Usar store/persistência real e source de Atlas existente; preservar scanner, C08/C09, idempotência, callbacks e engine. Nenhum reset/migração destrutiva/sort que esconda corrupção.
4. Entregar fix completo e regressões, request214 deduplicável com198, sourceblobs e causalrecheck208.

Os paths de escrita são EXATAMENTE os do pacote. Esta é uma tentativa de correção de critério/finding já contratado na missão integral211, não novoescopo. A211compõe somente sf-closure-bundle/PR191. Abra sua PR para sf-closure-bundle, com findingID/tarefas no handoff e commits/blobs. Não escreva na branch211, sf2-stack ou na branchdeoutroautor. Mudanças fora delease devem ser patches completos INERTES com pre/post/contexto para211, não recomendações soltas.

Reaproveite produtores reais/entregasórfãs antes de criar adapters. Nunca use mock/porta vazia/catálogo/unavailable permanente como implementação entregue. Se faltaAPIreal, prove assinaturas/callchain e conclua toda implementação legítima independente; não faça bypass e não pare no primeiro impedimento. Não troque assert/fixture para esconder falha. Azurefoi informada pronta: não alterar recursos/deploy/login/novosacessos e não chamar readinessinfra de provadeproduto.

Não rode testes,typecheck,builds,validators locais ou CI próprio. Entregue requestcirúrgico com seletores/SHA/inputs à214 pelo handoff/PR;190 écompiler,199hostfixture,213desktopbootstrap. Produto e testes próprios completos, validação realNOT_RUN ou runIDs verdadeiros. Comentários são avisos, não contexto recebido por chatstarted; consumidores acompanham outputs previstos peloGit.

Faça toda a correção contratada até código/PR consumíveis. EntregueHANDOFF com critérios/casos,paths/prepostblobs,comportamento,dependências,checksreais,inputs externos mínimos e aceite de recheck independente208. Não pedir aprovação rotineira nem entregar só outro plano/relatório. UseGitHubMCP apenas para remoto,CASexpectedhead/force:false; sem gh/push/token/devmerge/deploy/Azure/engines/restart/guardbypass/segredos. Goalnativapausada,GLOBAL_RELEASEfalse,semnewsupervisor/watchdog.
```

## 217

```text
Trabalhe em gustavomhss/Orchestra-SF em uma sessão NOVA. Missão217: Implementar casos semelhantes de ponta a ponta.

Branch preparada:sf-similar-cases; HEAD:41dfcd8fa5063129d5ed0968d7f9d1ed081238a6; epoch:review-fix-e1-browser217. Baseproduto7abf6c425e9b480bb43ba4a82f29c02a55445b92. Preserve todos os outputs anteriores. Confira HEAD/S0-FENCE e publique ACK com modelo/session quando expostos, sem inventar runtime.

Leia seu pacote COMPLETO, incluindo finding verificável, ordens completas e anexos obrigatórios:
https://github.com/gustavomhss/Orchestra-SF/blob/84924fbe8838a9ff8f7d3acdd6e9e6b5830e63d3/modules/sucafina/Sucafinav1/docs/sf2h/control/handoff/astra/parallel-closure/217.json
Leia AGENTS aplicáveis e código/dependências reais antes de editar. Planoimutáveldbf9547211d9b0fade619790de7c19c0869b7c7d,UXcbac654784714f68779ae1434d30e6ea8970c4d1. Preserve15WPs/74tasks/17contratos/1610critérios,39operaçõesMCP e todoUXaprovado; não reduzir escopo ou inventar autorização.

FINDING:S1-R1-207-001. Sua missão é corrigir o comportamento inteiro, de ponta a ponta:
1. Resolver S1-R1-207-001: UI62 não pode ficar permanentementeunavailable. Ler todoU26/A14, surfaceUI62, C09/C17 e porta real de memória/recall antes de definir adaptação.
2. Implementar produtor tipado autorizado e consumoUI reais sobre fonte original; scopedACL, cutoffhistórico, dedup, reasonwhyrelated/diferenças atuais, empty/denied/revoked e owner-swap. Não fabricar similaridade ou precedentes.
3. Reusar operações públicas congeladas se satisfizerem a semântica real; se faltar peça no catálogo tipado, entregar contrato/implementação completa e delta operacional separado comdigest para integração211, sem editar plano aprovado nem presumir permissão nova.
4. Completar campos/estados/query/keyboard/reflow e testescomportamentais doisatores, cutoff/dedup. Mudanças sharedregistry/hostbinding/i18nsharedfora da lease são patchesINERTOS completos para211; sem encerramento só emBLOCKED_CONTRACT enquanto houver implementaçãoautorizada independente.
5. Publicar PR com critérioporcasa e pre/post; request214 e recheck207.

Os paths de escrita são EXATAMENTE os do pacote. Esta é uma tentativa de correção de critério/finding já contratado na missão integral211, não novoescopo. A211compõe somente sf-closure-bundle/PR191. Abra sua PR para sf-closure-bundle, com findingID/tarefas no handoff e commits/blobs. Não escreva na branch211, sf2-stack ou na branchdeoutroautor. Mudanças fora delease devem ser patches completos INERTES com pre/post/contexto para211, não recomendações soltas.

Reaproveite produtores reais/entregasórfãs antes de criar adapters. Nunca use mock/porta vazia/catálogo/unavailable permanente como implementação entregue. Se faltaAPIreal, prove assinaturas/callchain e conclua toda implementação legítima independente; não faça bypass e não pare no primeiro impedimento. Não troque assert/fixture para esconder falha. Azurefoi informada pronta: não alterar recursos/deploy/login/novosacessos e não chamar readinessinfra de provadeproduto.

Não rode testes,typecheck,builds,validators locais ou CI próprio. Entregue requestcirúrgico com seletores/SHA/inputs à214 pelo handoff/PR;190 écompiler,199hostfixture,213desktopbootstrap. Produto e testes próprios completos, validação realNOT_RUN ou runIDs verdadeiros. Comentários são avisos, não contexto recebido por chatstarted; consumidores acompanham outputs previstos peloGit.

Faça toda a correção contratada até código/PR consumíveis. EntregueHANDOFF com critérios/casos,paths/prepostblobs,comportamento,dependências,checksreais,inputs externos mínimos e aceite de recheck independente207. Não pedir aprovação rotineira nem entregar só outro plano/relatório. UseGitHubMCP apenas para remoto,CASexpectedhead/force:false; sem gh/push/token/devmerge/deploy/Azure/engines/restart/guardbypass/segredos. Goalnativapausada,GLOBAL_RELEASEfalse,semnewsupervisor/watchdog.
```

## 218

```text
Trabalhe em gustavomhss/Orchestra-SF em uma sessão NOVA. Missão218: Implementar histórico autorizado de importações.

Branch preparada:sf-import-history; HEAD:58ec4c5376f5c34c3391f7eb2962f32697c67a9e; epoch:review-fix-e1-browser218. Baseproduto7abf6c425e9b480bb43ba4a82f29c02a55445b92. Preserve todos os outputs anteriores. Confira HEAD/S0-FENCE e publique ACK com modelo/session quando expostos, sem inventar runtime.

Leia seu pacote COMPLETO, incluindo finding verificável, ordens completas e anexos obrigatórios:
https://github.com/gustavomhss/Orchestra-SF/blob/84924fbe8838a9ff8f7d3acdd6e9e6b5830e63d3/modules/sucafina/Sucafinav1/docs/sf2h/control/handoff/astra/parallel-closure/218.json
Leia AGENTS aplicáveis e código/dependências reais antes de editar. Planoimutáveldbf9547211d9b0fade619790de7c19c0869b7c7d,UXcbac654784714f68779ae1434d30e6ea8970c4d1. Preserve15WPs/74tasks/17contratos/1610critérios,39operaçõesMCP e todoUXaprovado; não reduzir escopo ou inventar autorização.

FINDING:S1-R1-207-002. Sua missão é corrigir o comportamento inteiro, de ponta a ponta:
1. Antes de criar arquivo/adapter, reconciliar o produtor Files já produzido e suas releases nos workorders/contratos originais. UIimporta @orchestra/client/sucafina/files e schemafiles, ausentes em7ab. Consumir fonte real liberada se existe; não reimplementar trabalho órfão ou inventar API. Se o produtor foi omitido da composição, entregar closure completa exata para211 e continuar história usando essa fonte.
2. Resolver S1-R1-207-002: rota aprovadaUI57/history não pode serunavailableincondicional. LerU23/WP06.T04/READ-01 e produtor original de histórico/CommandReceipt/importação antes de alterar.
3. Consumir histórico/recibos reais porowner/principal/recordversion, navegar detalhes/retorno/fontes autorizadas, distinguir vazio/notfound/removed/denied/unknown, revalidarowner/revogação e descartarrespostaantiga.
4. Implementar typedadapter/consumer e ponte ausente real necessária; nenhuma história sintética, bypass de upload/policy ou aprovação financeira implícita. Não reeditar infraAzure/login/engines.
5. Cobrirpositivo/negativo/trocadeowner/late/return/reflow comfixtures reais de domínio. Fora da lease, patchshared completo para211. EntregarPR/prepost/request214/recheck207, não só tela ou relato de dependencia.

Os paths de escrita são EXATAMENTE os do pacote. Esta é uma tentativa de correção de critério/finding já contratado na missão integral211, não novoescopo. A211compõe somente sf-closure-bundle/PR191. Abra sua PR para sf-closure-bundle, com findingID/tarefas no handoff e commits/blobs. Não escreva na branch211, sf2-stack ou na branchdeoutroautor. Mudanças fora delease devem ser patches completos INERTES com pre/post/contexto para211, não recomendações soltas.

Reaproveite produtores reais/entregasórfãs antes de criar adapters. Nunca use mock/porta vazia/catálogo/unavailable permanente como implementação entregue. Se faltaAPIreal, prove assinaturas/callchain e conclua toda implementação legítima independente; não faça bypass e não pare no primeiro impedimento. Não troque assert/fixture para esconder falha. Azurefoi informada pronta: não alterar recursos/deploy/login/novosacessos e não chamar readinessinfra de provadeproduto.

Não rode testes,typecheck,builds,validators locais ou CI próprio. Entregue requestcirúrgico com seletores/SHA/inputs à214 pelo handoff/PR;190 écompiler,199hostfixture,213desktopbootstrap. Produto e testes próprios completos, validação realNOT_RUN ou runIDs verdadeiros. Comentários são avisos, não contexto recebido por chatstarted; consumidores acompanham outputs previstos peloGit.

Faça toda a correção contratada até código/PR consumíveis. EntregueHANDOFF com critérios/casos,paths/prepostblobs,comportamento,dependências,checksreais,inputs externos mínimos e aceite de recheck independente207. Não pedir aprovação rotineira nem entregar só outro plano/relatório. UseGitHubMCP apenas para remoto,CASexpectedhead/force:false; sem gh/push/token/devmerge/deploy/Azure/engines/restart/guardbypass/segredos. Goalnativapausada,GLOBAL_RELEASEfalse,semnewsupervisor/watchdog.
```

## 219

```text
Trabalhe em gustavomhss/Orchestra-SF em uma sessão NOVA. Missão219: Conectar o produtor nativo Task Relay ao host padrão.

Branch preparada:sf-native-admission; HEAD:0d9053d4649da9d313cc47392cd6723f9de1f8a7; epoch:review-fix-e1-browser219. Baseproduto7abf6c425e9b480bb43ba4a82f29c02a55445b92. Preserve todos os outputs anteriores. Confira HEAD/S0-FENCE e publique ACK com modelo/session quando expostos, sem inventar runtime.

Leia seu pacote COMPLETO, incluindo finding verificável, ordens completas e anexos obrigatórios:
https://github.com/gustavomhss/Orchestra-SF/blob/84924fbe8838a9ff8f7d3acdd6e9e6b5830e63d3/modules/sucafina/Sucafinav1/docs/sf2h/control/handoff/astra/parallel-closure/219.json
Leia AGENTS aplicáveis e código/dependências reais antes de editar. Planoimutáveldbf9547211d9b0fade619790de7c19c0869b7c7d,UXcbac654784714f68779ae1434d30e6ea8970c4d1. Preserve15WPs/74tasks/17contratos/1610critérios,39operaçõesMCP e todoUXaprovado; não reduzir escopo ou inventar autorização.

FINDING:R3-TASK-03. Sua missão é corrigir o comportamento inteiro, de ponta a ponta:
1. Resolver R3-TASK-03: construtorpadrão createSfHostRuntime não injeta nativeRoutineProducer; readerports e fixtures não são dono executante. Ler C07/C15, origem humana/TaskToolFrame públicos, pinpublicação, Permission/approval/providerbinding e runtime reais.
2. Implementar a composição first-party usando SOMENTE APIs públicas já suportadas, proveniência deRequest humana original e frameTask executado, provider/generation/C15owner atuais; garantir admissão/execução e leitura legítimas atéRelaychild/run/result/consumoproduto.
3. Preservar revogação,cancelamento,retryidempotente, timezone/recorrência,dedup e recusa de prepare/run emroutine-result. SemTaskIDforjado, aprovaçãoautomática, read-onlycapture tratada comoowner, engineparalelo ou acesso privado.
4. Não alterar engines Maestro/Relay/Schedule, políticas ou conceder novos acessos. Se aAPIpública realmente não expuser a origem necessária, demonstrar assinaturas/callchain e bloqueio exato sem implementar bypass; completar todas as pontes legítimas possíveis e entregar patch integral/inertofora delease.
5. Receber a prontidãoAzure como infra existente informada pelo usuário, não prova deTask/provider/identidade.199preparouhostfixture; usar callbacks reaispermitidos e preparar AM06 driver com211/214. Semdeploy/mutaçãoAzure/restart.
6. Publicarcódigo/PR/prepost/proveniência, request214 e recheck209. Escopo inteiro do finding, não outro inventário deports.

Os paths de escrita são EXATAMENTE os do pacote. Esta é uma tentativa de correção de critério/finding já contratado na missão integral211, não novoescopo. A211compõe somente sf-closure-bundle/PR191. Abra sua PR para sf-closure-bundle, com findingID/tarefas no handoff e commits/blobs. Não escreva na branch211, sf2-stack ou na branchdeoutroautor. Mudanças fora delease devem ser patches completos INERTES com pre/post/contexto para211, não recomendações soltas.

Reaproveite produtores reais/entregasórfãs antes de criar adapters. Nunca use mock/porta vazia/catálogo/unavailable permanente como implementação entregue. Se faltaAPIreal, prove assinaturas/callchain e conclua toda implementação legítima independente; não faça bypass e não pare no primeiro impedimento. Não troque assert/fixture para esconder falha. Azurefoi informada pronta: não alterar recursos/deploy/login/novosacessos e não chamar readinessinfra de provadeproduto.

Não rode testes,typecheck,builds,validators locais ou CI próprio. Entregue requestcirúrgico com seletores/SHA/inputs à214 pelo handoff/PR;190 écompiler,199hostfixture,213desktopbootstrap. Produto e testes próprios completos, validação realNOT_RUN ou runIDs verdadeiros. Comentários são avisos, não contexto recebido por chatstarted; consumidores acompanham outputs previstos peloGit.

Faça toda a correção contratada até código/PR consumíveis. EntregueHANDOFF com critérios/casos,paths/prepostblobs,comportamento,dependências,checksreais,inputs externos mínimos e aceite de recheck independente209. Não pedir aprovação rotineira nem entregar só outro plano/relatório. UseGitHubMCP apenas para remoto,CASexpectedhead/force:false; sem gh/push/token/devmerge/deploy/Azure/engines/restart/guardbypass/segredos. Goalnativapausada,GLOBAL_RELEASEfalse,semnewsupervisor/watchdog.
```
