# WP04 — mapa compacto dos 111 critérios

Esta versão conserva os 111 textos literais, seus estados históricos e todas as referências do mapa original. O JSON normalizado reconstrói integralmente o original, campo a campo, sem perda de critério, nota, consumidor, prova, SHA ou qualificação. A conferência é documental; nenhum produto foi executado localmente.

## Pins e limites de aceite

- Fonte imutável: `dbf9547211d9b0fade619790de7c19c0869b7c7d`; campaign SHA256 `703dd257274bed829a978705de548cd1383225bf7aac76445104c053e2bb5fba`.
- Handoff e pack: `a3d29d011ba3607a57914701300f09117a3e2de9`.
- WP04 consumido: PR #23 `91e1f60bc6f7e85517e2b4f963eec5ac7da13e62`, tree `e7d11d7fff0f35d180083ba2497b5b750eeb206d`.
- Corpus histórico: `dae18b4f43f0daecf46264e876810025684a919d`, tree `ceb9615bb5bbd5f829d2e9569a2797e3124236a5`.
- Composição W1: `de6959db82dbe48bd59e3d012ff668a86347a6cd`, tree `e7c36171c132009e34d4f870e5d300bab4a1c82a`.
- Candidato atual / PR #34: `c4a2f4ebeb88f5915e51569b921be06b3c37ddad`, tree `5cc00703f04845c62448a2a3239683d266d8d548`.

W5 mantém 127/127 casos originais mapeados com prova positiva de componente: 95 históricos, 16 passes individuais W1, 8 browser W2, 2 prepared-port W4 e 6 host W5. Os dois novos negativos de digest também passaram W5. H01–H08 passaram; H02/H03/H05 superaram as falhas W4 após restauração do CAS, e H01 exercitou o segundo dossiê com sourcing/FX/fences reais. H09 NÃO se qualificou: startup/H09/lifecycle falharam antes de adquirir Chromium; aggregate Bun3 FAILURE (8 pass/3 fail), Omni PASS de um spawn apenas. Allcheck W5 permanece FAILURE pelo fixture Atlas externo, com CLI e guards PASS. Dez bloqueios nativos WP04, quatro provas humanas, os consumidores ainda não qualificados e o aceite global continuam explícitos.

Os **97 PASS_SCOPED, 10 BLOCKED_NATIVE e 4 NOT_RUN_HUMAN são os estados históricos preservados**. PASS_SCOPED descreve o componente e a seleção registrados; não concede aceite integral no bundle atual. Cada uma das 111 linhas mantém `current_requirement_accepted: false`. Provas nativas/humanas, todos os consumidores e aceite global por S0 continuam requisitos explícitos.

## Contagem histórica por task

| Escopo | Critérios | PASS_SCOPED | BLOCKED_NATIVE | NOT_RUN_HUMAN |
|---|---:|---:|---:|---:|
| WP04 | 20 | 18 | 1 | 1 |
| WP04.T01 | 20 | 17 | 3 | 0 |
| WP04.T02 | 14 | 14 | 0 | 0 |
| WP04.T03 | 21 | 17 | 3 | 1 |
| WP04.T04 | 15 | 13 | 0 | 2 |
| WP04.T05 | 21 | 18 | 3 | 0 |

## Checks e snapshots

| Ref | Run / snapshot / produto | Resultado e limite |
|---|---|---|
| `ci_bun` | [43534137756](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756) / `846cc5aa5c4e1413e741d4de06bd0f53238f34ed` / `dae18b4f43f0daecf46264e876810025684a919d` | 257 pass, 0 fail, 53 arquivos. |
| `ci_browser` | [43534795463](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534795463) / `23f527266a8bf0da2c015624d40db417e2d9bb80` / `dae18b4f43f0daecf46264e876810025684a919d` | 10 pass, 0 fail, 2 specs; sem prova de compreensão humana. |
| `ci_checks` | [43534115446](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534115446) / `dae18b4f43f0daecf46264e876810025684a919d` / `dae18b4f43f0daecf46264e876810025684a919d` | Typecheck, geração e guards históricos; não substitui os checks do candidato atual. |
| `W1-BUN43` | [43578845234](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43578845234) / `acd7f87c28c70a68bd75ab65bac6c05477f470fe` / `de6959db82dbe48bd59e3d012ff668a86347a6cd` | **FAILURE**: 100 pass, 1 fail, 0 skip, 43 arquivos; falha WP06 native/import-analysis por timeout de 300s. Nenhum WP04 falhou nessa seleção. O rerun isolado nativo W3 é outro recibo; este resultado não foi reescrito. |
| `W2-ALLCHECK` | [43580277793](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43580277793) / `ee2099e581eb4a6fc83283599763dd825c4a8ac4` / `5e0c79ee7013ea84329ff1fab8b32ab04ebdc2c3` | **FAILURE**: Falha histórica preservada. O erro próprio foi corrigido no W3 e o allcheck W3 tem zero diagnóstico próprio; a falha externa Sucafina permanece explícita. |
| `W3-ALLCHECK` | [43580747934](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43580747934) / `3cf8e9327f344e85ccc4b8b2b88c2bf77470bd8e` / `d7d343ecb2ef4b4ccff925f50a5a60324d22b371` | **FAILURE**: CLI e guards aprovados no W3; Sucafina falhou somente no consumidor externo Atlas OPS-CONSUMER-02. O W4 altera fonte CLI e workflow e exige seu próprio check; não há reaproveitamento integral do allcheck. |
| `W2-BROWSER` | [43580401528](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43580401528) / `26726f85ce39819fcfa376daf1e6ebea203188b2` / `5e0c79ee7013ea84329ff1fab8b32ab04ebdc2c3` | **SUCCESS**: 30/30 combined browser cases passed (8 Procurement,14 WP06 imports,8 WP06 documents);0retry/skip/flaky. Product W2 and sole-child snapshot are pinned. No positive Omni verdict was reported; human timing was not measured. This does not qualify UI03 C12, native sessions, human observations or global acceptance. |
| `W3-NATIVE-IMPORT` | [43580976466](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43580976466) / `c2ad4cb308ffa6e4b8d1a0cf5ed031bf1a304a01` / `d7d343ecb2ef4b4ccff925f50a5a60324d22b371` | **SUCCESS**: 2 pass, 0 fail, 0 skip, 123 asserts; Session/MCP/adaptador nativo de importação no W3. Reaproveitável no W4 somente pelo fechamento de caminhos de execução registrado. Omni not-applicable, zero spawns; não qualifica modelo/provider, nativo WP04, tempo humano ou aceite global. Falha anterior W1 não é apagada. |
| `W4-BUN24` | [43582205250](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43582205250) / `6108eafea9a35ba15968271f0aed76b1498d5ac4` / `644324778e4a21d22424515dd698d5b8d6c01893` | **FAILURE**: The aggregate run remains FAILURE. All 24 exact files executed through the final summary: 114 passed and 3 WP04 host-integration cases failed. Per-case passes are scoped to W4; no failed case or global gate is promoted. No Omni execution was proved. |
| `W4-ALLCHECK` | [43582192808](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43582192808) / `e4b18ec95f837985d1f138272d54f2b2732ce66e` / `644324778e4a21d22424515dd698d5b8d6c01893` | **FAILURE**: CLI and guards passed independently. Sucafina and the aggregate run remain FAILURE due to the Atlas fixture missing procurementEvidenceWrites; no own source type error is reported. No prior failure is overwritten and no global acceptance is inferred. |
| `W4-DOSSIER-BROWSER` | [43582881446](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43582881446) / `5a6d4ee27f2279b8d5e6e1c19c392d8b92a8f6d7` / `644324778e4a21d22424515dd698d5b8d6c01893` | **SUCCESS**: Hosted production Playwright ran the explicit one-spec selection: eight expected passes, zero retries/skips/flakes. Artifact digest and request match. Screenshot inspected. Renderer fixture scope is retained; real host evidence is separate. |
| `W5-HOST-BROWSER` | [43584405211](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43584405211) / `9e1d872f453c218909d328b480ffaf8bed6f0c82` / `c4a2f4ebeb88f5915e51569b921be06b3c37ddad` | **FAILURE**: Aggregate FAILURE retained. H01–H08 passed at exact W5; H09 never reached its host fixture after the owner browser acquisition failed. Browser startup/finalizer failed and physical exit is unproved. No automatic rerun, human/native/global acceptance, or absence of orphan processes is inferred. |
| `W5-ALLCHECK` | [43584394810](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43584394810) / `70bfcae5a16f8a007ee95402976cd1534d4a2ca3` / `c4a2f4ebeb88f5915e51569b921be06b3c37ddad` | **FAILURE**: CLI and guards PASS independently. Sucafina and aggregate remain FAILURE exclusively at the known Atlas fixture consumer. No own W5 source or new browser-fixture/H09 diagnostic was reported. This check is not execution or global acceptance. |

## Reuso de componente por fechamento de dependência

Os resultados permanecem atribuídos aos SHAs em que rodaram. A inspeção de imports, símbolos e caminhos de chamada permite reaproveitar somente o componente cujo comportamento alcançado não mudou. Uma execução falha não é transformada em sucesso porque outros casos passaram.

| Ref de prova | Execução | Fechamento e qualificação |
|---|---|---|
| `R-HIST-BUN` | 43534137756 / `846cc5aa5c4e1413e741d4de06bd0f53238f34ed` | Per-file D-to-W1 unchanged/symbol-scoped closure, W1-to-W2 NO_ADDITIONAL_C12_RUN, W3-to-W4 C34-01. Original qualification limits remain. |
| `R-HIST-CONTROLLER` | 43534795463 / `23f527266a8bf0da2c015624d40db417e2d9bb80` | Unchanged production controller/script boundary with intercepted transport. Shared startup separately covered by actual Procurement browser cases. W3-to-W4 C34-01. |
| `R-W1-BUN` | 43578845234 / `acd7f87c28c70a68bd75ab65bac6c05477f470fe` | Exact case title/path recorded PASS in the failed aggregate. W1-to-W2 NO_ADDITIONAL_C12_RUN and W3-to-W4 C34-02 close the later material delta for that component; global failure is retained. |
| `R-W2-BROWSER` | 43580401528 / `26726f85ce39819fcfa376daf1e6ebea203188b2` | Eight exact real-host Procurement cases. W3 UI type narrowing lies only in C12 apply path; W4 dossier path is not invoked by these requests (C34-03). No new execution at W4 is asserted. |
| `R-W4-BUN` | 43582205250 / `6108eafea9a35ba15968271f0aed76b1498d5ac4` | W4 aggregate remains FAILURE (114 pass/3 fail). The two mapped own prepared-production cases and 12 WP11 consumer cases passed; their exact unchanged/direct-port/early-return scopes survive W5 via w4-w5-closure.json C45-01. W4 H01–H08 observations are retained as history and superseded only by actual W5 execution. |
| `R-W5-HOST` | 43584405211 / `9e1d872f453c218909d328b480ffaf8bed6f0c82` | H01–H08 passed at W5. H01 covers the newly composed business dossier; H02/H03/H05 now pass after published CAS hunk restoration, with W4 failures retained. H09/startup/finalizer failed before browser acquisition, so no real UI proof or physical browser-exit success is inferred. |

Catálogo original: **127 casos mapeados**, com **127 provas positivas de componente**, **0 falhas atuais mapeadas** e **0 casos históricos aguardando nova qualificação material**. Os novos casos mantêm catálogo próprio, sem alterar os 127 registros originais. All 127 original mapped cases have positive component observations at their actual executed SHAs or explicit later closure. This does not mean 127 newly executed W5 cases or 111 accepted criteria. H09 is an additional unqualified UI consumer; W5 aggregate failed and native/human/global obligations remain.

### Incremento material e prova de UI

Estado: `W5_PUBLISHED_HOST_PROOFS_COMPLETE_UI_OWNER_STARTUP_BLOCKED`. W5 code is frozen and published. Actual H01–H08 pass is recorded; H09 never reached the real host because owner Chromium acquisition failed. No rerun or fixture deadline change is inferred or performed.

Seleção registrada: `./Sucafinav1/test/product/wp01/browser-startup.test.ts` → `./Sucafinav1/test/product/wp04/host-integration.test.ts` → `./Sucafinav1/test/product/wp01/browser-lifecycle.test.ts`. A seleção foi desenhada para provar aquisição/encerramento no owner e aplicação real em H09. Neste run, a aquisição falhou; nenhuma prova de UI de H09 ou de encerramento físico foi qualificada.

## Como ler a tabela

`Bnnn` aponta no JSON para listas completas de implementações (`I`), consumidores (`C`), casos de teste (`T`), checks, dependências e impactos. `Nnnn` guarda a razão e os limites históricos. A coluna atual informa o número de casos mapeados com prova positiva e registra gaps materiais, mantendo os requisitos restantes. Prova de componente não é aceite integral. As linhas nativas/humanas preservam seu bloqueio mesmo quando também possuem casos de componente aprovados.

## Critérios literais

| Critério | Texto literal do pack | Histórico | Evidência / razão / limites | Componente no candidato atual |
|---|---|---|---|---|
| WP04.DOD.01 | As cinco páginas e o inventário de comandos/estados originais têm cobertura explícita, com views exportadas, C02/C03 reais e evidências locais reproduzíveis. | PASS_SCOPED | `B001` · `N009` · `N010` | 16/16 casos com prova; UI H09 não qualificada |
| WP04.DOD.02 | Fila, pedido guiado, comparação, resumos por etapa e fornecedores estão demonstrados com os mesmos registros e versões, sem um store paralelo de demonstração. | PASS_SCOPED | `B002` · `N016` · `N010` | 12/12 casos com prova; UI H09 não qualificada |
| WP04.DOD.03 | O handoff lista consumidores, casos adversos, artefatos de evidência e verificações de composição reservadas a WP10; não declara entrega integrada com base apenas em fixtures. | PASS_SCOPED | `B003` · `N017` · `N010` | 6/6 casos com prova; UI H09 não qualificada |
| WP04.DOD.10 | As entregas residentes atribuídas a WP04 têm produção, consumo e provas reais completos. | BLOCKED_NATIVE | `B004` · `N019` · `N020` | 8/8 casos com prova; nativo bloqueado |
| WP04.INV.01 | Alçadas, papéis, autorização por holder, opção de bloquear autoaprovação, política de fornecedores e transições legais permanecem os do domínio; decidir continua sendo ato explícito da pessoa autorizada. | PASS_SCOPED | `B005` · `N023` · `N010` | 10/10 casos com prova; UI H09 não qualificada |
| WP04.INV.02 | Histórico, identificadores já emitidos, versões esperadas e snapshots de aprovação/câmbio são preservados; po_issued continua significando emissão interna. | PASS_SCOPED | `B006` · `N025` · `N010` | 13/13 casos com prova; UI H09 não qualificada |
| WP04.INV.03 | Recortes autorizados e restrições bancárias valem para tela, exportação, resumo e C02; referência textual ou ausência nunca vira relação, autorização ou valor zero. | PASS_SCOPED | `B007` · `N027` · `N028` | 16/16 casos com prova; UI H09 não qualificada |
| WP04.INV.10 | WP04 conserva autoridade, dados oficiais e ownership; não assume identidade técnica ou novo acesso empresarial. | PASS_SCOPED | `B008` · `N029` · `N010` | 10/10 casos com prova; UI H09 não qualificada |
| WP04.QLT.01 | Cada etapa informa próxima ação, responsável conhecido e motivo concreto da restrição, sem expor uma parede de comandos que só falham depois do clique. | PASS_SCOPED | `B009` · `N031` · `N010` | 9/9 casos com prova; closure registrado |
| WP04.QLT.02 | Valores, ranking e resumos mostram origem, moeda, versão e limitações; notas humanas não são apresentadas como medida objetiva de qualidade do fornecedor. | PASS_SCOPED | `B010` · `N033` · `N010` | 12/12 casos com prova; closure registrado |
| WP04.QLT.03 | Formulários e ações críticas são operáveis por teclado, mantêm foco após erro/conflito e apresentam a correção junto ao campo correspondente. | PASS_SCOPED | `B011` · `N034` · `N035` | 5/5 casos com prova; closure registrado |
| WP04.QLT.10 | Interfaces são concretas, versões/digests são verificáveis e falhas possuem causa e estado explícitos. | PASS_SCOPED | `B012` · `N036` · `N010` | 8/8 casos com prova; UI H09 não qualificada |
| WP04.CMP.01 | A matriz de cobertura inclui requester, buyer, approver, supplier admin, admin, viewer e combinações já permitidas; estados normais, rejeitados, cancelados e emitidos não ficam fora. | PASS_SCOPED | `B013` · `N037` · `N038` | 17/17 casos com prova; closure registrado |
| WP04.CMP.02 | A cobertura monetária inclui moeda base, moeda estrangeira, FX ausente, mudança de taxa após submissão, proposta incompleta e divergência entre total informado e quantidade vezes preço. | PASS_SCOPED | `B014` · `N039` · `N010` | 12/12 casos com prova; closure registrado |
| WP04.CMP.03 | Cadastro/ativação/bloqueio/inativação/banco de fornecedor, configurações/reset, histórico, registros/exportações e referências existentes permanecem acessíveis. | PASS_SCOPED | `B015` · `N040` · `N010` | 13/13 casos com prova; closure registrado |
| WP04.CMP.10 | Todas as obrigações 5/18/8/C17 desta frente têm task, owner, paths, consumidor e negativos discriminantes. | PASS_SCOPED | `B016` · `N041` · `N010` | 8/8 casos com prova; UI H09 não qualificada |
| WP04.SUC.01 | No roteiro sintético, o aprovador identifica em até 30 segundos a etapa que decide, o valor, a diferença relevante, a razão da escolha e o próximo passo, sem abrir Settings. | NOT_RUN_HUMAN | `B017` · `N042` · `N043` | 8/8 casos com prova; humano não observado |
| WP04.SUC.02 | No roteiro PR até PO, o buyer não redigita fornecedor, moeda e quantidade já selecionados quando esses valores podem ser reutilizados; sugestões identificam a origem e preservam ajustes negociados. | PASS_SCOPED | `B018` · `N045` · `N010` | 6/6 casos com prova; closure registrado |
| WP04.SUC.03 | Os casos adversos distinguem aprovado de emitido, desconhecido de zero e versão atual de versão desatualizada; nenhuma dessas diferenças é ocultada por um resultado visual aparentemente correto. | PASS_SCOPED | `B019` · `N046` · `N010` | 15/15 casos com prova; UI H09 não qualificada |
| WP04.SUC.10 | O consumidor integrado utiliza a saída de produção sem substituto fictício e o revisor consegue reproduzir o resultado. | PASS_SCOPED | `B020` · `N047` · `N048` | 7/7 casos com prova; UI H09 não qualificada |
| WP04.T01.CHK.01 | Comparar a leitura do mesmo conjunto por requester puro e buyer: o requester recebe apenas seus pedidos também em totais, pendências e referências; inserir um pedido alheio deve alterar o buyer e não o requester. | PASS_SCOPED | `B021` · `N049` · `N010` | 4/4 casos com prova; closure registrado |
| WP04.T01.CHK.02 | Dado pedido submetido, rejeitado, ressubmetido e salvo depois, a idade usa a última entrada na etapa pendente; alterar apenas o horário do save não altera essa idade. | PASS_SCOPED | `B022` · `N050` · `N010` | 6/6 casos com prova; closure registrado |
| WP04.T01.CHK.03 | Retirar o evento que comprova a entrada na etapa: C02 marca idade indisponível e a fila mantém o pedido; não usa criação como fallback nem calcula uma duração fictícia. | PASS_SCOPED | `B023` · `N051` · `N010` | 9/9 casos com prova; closure registrado |
| WP04.T01.CHK.04 | Um pedido com holder diferente do ator não oferece aprovação como próxima ação; holder ausente aparece explicitamente sem responsável, sem criar autorização nova. | PASS_SCOPED | `B024` · `N052` · `N010` | 5/5 casos com prova; closure registrado |
| WP04.T01.CHK.18 | Executar sf_request_read pela UI/native/MCP com base e autoridade iguais produz o mesmo handler, resultado e versão; chamada direta sem concessão ou após revogação é recusada pelo destino. | BLOCKED_NATIVE | `B025` · `N053` · `N054` | 4/4 casos com prova; nativo bloqueado |
| WP04.T01.DOD.01 | As filas exportadas consomem a projeção C02 de Procurement e cobrem cada estado atual do baseline. | PASS_SCOPED | `B026` · `N055` · `N010` | 7/7 casos com prova; closure registrado |
| WP04.T01.DOD.02 | O mapa estado/papel/próxima ação e a proveniência da idade estão anexados ao handoff local. | PASS_SCOPED | `B027` · `N056` · `N010` | 8/8 casos com prova; closure registrado |
| WP04.T01.DOD.18 | Descritores C16 de sf_request_read são implementados e consumidos por T06 com referências reais. | BLOCKED_NATIVE | `B028` · `N057` · `N058` | 4/4 casos com prova; nativo bloqueado |
| WP04.T01.INV.01 | Filas, totais e deep links compartilham o mesmo recorte autorizado de requests. | PASS_SCOPED | `B029` · `N059` · `N010` | 5/5 casos com prova; closure registrado |
| WP04.T01.INV.02 | Salvar um campo não reinicia a idade da etapa; histórico insuficiente não produz data presumida. | PASS_SCOPED | `B030` · `N060` · `N010` | 8/8 casos com prova; closure registrado |
| WP04.T01.INV.18 | Permissões, locks, cálculos e comandos finais continuam no domínio; o transporte não cria poder novo. | PASS_SCOPED | `B031` · `N061` · `N010` | 7/7 casos com prova; closure registrado |
| WP04.T01.QLT.01 | Cada linha explica estado, próxima ação e responsável conhecido sem depender de códigos internos. | PASS_SCOPED | `B032` · `N062` · `N010` | 7/7 casos com prova; closure registrado |
| WP04.T01.QLT.02 | Ordenação e filtros são visíveis, reversíveis e operáveis por teclado. | PASS_SCOPED | `B033` · `N063` · `N010` | 3/3 casos com prova; closure registrado |
| WP04.T01.QLT.18 | Schema fechado, ausência/falha explícitas e provenance permitem comparar UI/native/MCP. | PASS_SCOPED | `B034` · `N064` · `N065` | 6/6 casos com prova; closure registrado |
| WP04.T01.CMP.01 | Incluir rejeitados, cancelados, emitidos, sem holder e históricos incompletos, além do caminho feliz. | PASS_SCOPED | `B035` · `N066` · `N010` | 10/10 casos com prova; closure registrado |
| WP04.T01.CMP.02 | Entregar referência estável de drilldown e contexto de versão para cada pedido visível. | PASS_SCOPED | `B036` · `N067` · `N010` | 5/5 casos com prova; closure registrado |
| WP04.T01.CMP.18 | Cobrir todos os exports desta task (1), caso autorizado, direto proibido, stale e indisponível. | PASS_SCOPED | `B037` · `N068` · `N069` | 3/3 casos com prova; closure registrado |
| WP04.T01.SUC.01 | Requester e buyer localizam seus pedidos e distinguem falta de informação de espera por outra pessoa sem executar uma ação inválida. | PASS_SCOPED | `B038` · `N070` · `N071` | 10/10 casos com prova; closure registrado |
| WP04.T01.SUC.02 | Aging e contagens fornecidos a WP05 reproduzem a seleção autorizada e não divergem da fila. | PASS_SCOPED | `B039` · `N072` · `N073` | 6/6 casos com prova; closure registrado |
| WP04.T01.SUC.18 | O usuário recebe a mesma capacidade e resultado pelas superfícies sem divergência ou efeitos adicionais. | BLOCKED_NATIVE | `B040` · `N074` · `N054` | 2/2 casos com prova; nativo bloqueado |
| WP04.T02.CHK.01 | Percorrer PR aprovada até a proposta de PO: fornecedor, moeda e quantidade selecionados reaparecem sem redigitação; uma condição negociada já presente na PO não é substituída por default do fornecedor. | PASS_SCOPED | `B041` · `N075` · `N010` | 5/5 casos com prova; closure registrado |
| WP04.T02.CHK.02 | Alternar compra recorrente e não recorrente e estratégia existing/new: campos e validações aplicáveis acompanham o estado sem apagar valores previamente salvos nem aceitar submissão que o validador existente recusa. | PASS_SCOPED | `B042` · `N076` · `N010` | 5/5 casos com prova; closure registrado |
| WP04.T02.CHK.03 | Dois atores abrem a mesma versão; o segundo tenta salvar após a alteração do primeiro: o comando retorna conflito, os valores do segundo continuam visíveis e o primeiro registro não é sobrescrito silenciosamente. | PASS_SCOPED | `B043` · `N078` · `N010` | 4/4 casos com prova; UI H09 não qualificada |
| WP04.T02.CHK.04 | Tentar excluir pedido fora de draft ou cancelar po_issued continua recusado; ocultar o botão não substitui a recusa do comando real. | PASS_SCOPED | `B044` · `N079` · `N010` | 3/3 casos com prova; closure registrado |
| WP04.T02.DOD.01 | PR, sourcing e PO têm apresentação progressiva e roundtrip completo dos campos originais. | PASS_SCOPED | `B045` · `N080` · `N010` | 8/8 casos com prova; closure registrado |
| WP04.T02.DOD.02 | Os estados de erro e conflito conservam entradas locais e permitem retomar a tarefa. | PASS_SCOPED | `B046` · `N081` · `N010` | 7/7 casos com prova; UI H09 não qualificada |
| WP04.T02.INV.01 | Pré-preenchimento é sugestão identificada ou cópia de dado existente; não inventa condição comercial nem substitui ajuste negociado. | PASS_SCOPED | `B047` · `N082` · `N010` | 4/4 casos com prova; closure registrado |
| WP04.T02.INV.02 | Ocultar uma seção ou comando não altera a autorização, a transição legal ou os dados persistidos. | PASS_SCOPED | `B048` · `N083` · `N010` | 5/5 casos com prova; closure registrado |
| WP04.T02.QLT.01 | A pendência aponta o campo e a correção necessária, sem um erro genérico no fim do formulário. | PASS_SCOPED | `B049` · `N084` · `N010` | 5/5 casos com prova; closure registrado |
| WP04.T02.QLT.02 | Ações de salvar, revisar conflito e continuar mantêm foco e contexto do pedido. | PASS_SCOPED | `B050` · `N085` · `N010` | 4/4 casos com prova; closure registrado |
| WP04.T02.CMP.01 | Cobrir os campos obrigatórios/condicionais de PR, sourcing e PO, defaults, linhas repetidas e histórico. | PASS_SCOPED | `B051` · `N086` · `N010` | 8/8 casos com prova; closure registrado |
| WP04.T02.CMP.02 | Cobrir retomada, rejeição, cancelamento e exclusão somente nas condições existentes. | PASS_SCOPED | `B052` · `N088` · `N010` | 8/8 casos com prova; closure registrado |
| WP04.T02.SUC.01 | O roteiro de compra reutiliza os dados já confirmados e deixa visível a origem de cada sugestão. | PASS_SCOPED | `B053` · `N089` · `N010` | 5/5 casos com prova; closure registrado |
| WP04.T02.SUC.02 | Uma edição concorrente não destrói entrada local nem produz confirmação de salvamento inexistente. | PASS_SCOPED | `B054` · `N090` · `N010` | 4/4 casos com prova; UI H09 não qualificada |
| WP04.T03.CHK.01 | Fixture: A USD 32.400, notas técnicas [5,4,4,4,4], comerciais manuais [4,4]; B EUR 28.000 a 1,08, notas [4,4,4,3,4] e [5,4]; C USD 29.000 não conforme. Esperar A 87,9333..., B 85, C fora do ranking, diferença A versus menor conforme USD 2.160/7,142857...%; a UI deve mostrar o arredondamento sem alterar a ordem. | PASS_SCOPED | `B055` · `N091` · `N010` | 5/5 casos com prova; closure registrado |
| WP04.T03.CHK.02 | Deixar uma nota obrigatória vazia ou manter somente uma proposta: a UI declara incompletude/comparação limitada e a submissão segue exatamente o validador vigente; não inventa nota zero nem nova exceção. | PASS_SCOPED | `B056` · `N092` · `N010` | 6/6 casos com prova; closure registrado |
| WP04.T03.CHK.03 | Mudar a taxa configurada depois da submissão: a decisão pendente preserva o valor/câmbio congelado; remover FX de uma comparação sem snapshot produz indisponibilidade/pendência, nunca total zero. | PASS_SCOPED | `B057` · `N093` · `N010` | 11/11 casos com prova; closure registrado |
| WP04.T03.CHK.04 | Misturar PO em moeda base e estrangeira, uma po_approved e outra po_issued: totais por estado usam valores C02 comparáveis e apresentam itens não conversíveis; aprovado não vira emitido ou realizado. | PASS_SCOPED | `B058` · `N094` · `N010` | 5/5 casos com prova; closure registrado |
| WP04.T03.CHK.05 | Introduzir total informado diferente de qty vezes unitPrice: ambas as bases e a discrepância aparecem; nenhum cálculo silencioso altera preço, política de aprovação ou documento. | PASS_SCOPED | `B059` · `N095` · `N010` | 4/4 casos com prova; closure registrado |
| WP04.T03.CHK.18 | Executar sf_sourcing_compare pela UI/native/MCP com base e autoridade iguais produz o mesmo handler, resultado e versão; chamada direta sem concessão ou após revogação é recusada pelo destino. | BLOCKED_NATIVE | `B060` · `N096` · `N097` | 8/8 casos com prova; nativo bloqueado |
| WP04.T03.DOD.01 | A comparação visual utiliza o motor existente e entrega componentes reconciliáveis no C02. | PASS_SCOPED | `B061` · `N098` · `N010` | 5/5 casos com prova; closure registrado |
| WP04.T03.DOD.02 | Moeda, taxa/snapshot e estado monetário ficam definidos para cada valor exibido. | PASS_SCOPED | `B062` · `N099` · `N010` | 9/9 casos com prova; closure registrado |
| WP04.T03.DOD.18 | Descritores C16 de sf_sourcing_compare são implementados e consumidos por T06 com referências reais. | BLOCKED_NATIVE | `B063` · `N101` · `N102` | 8/8 casos com prova; nativo bloqueado |
| WP04.T03.INV.01 | Pesos, mínimo de propostas, critérios, elegibilidade e justificativas continuam os da configuração existente. | PASS_SCOPED | `B064` · `N103` · `N010` | 8/8 casos com prova; closure registrado |
| WP04.T03.INV.02 | Ausência de taxa/nota/valor não vira zero, precisão inventada ou confirmação de gasto realizado. | PASS_SCOPED | `B065` · `N104` · `N010` | 13/13 casos com prova; closure registrado |
| WP04.T03.INV.18 | Permissões, locks, cálculos e comandos finais continuam no domínio; o transporte não cria poder novo. | PASS_SCOPED | `B066` · `N105` · `N010` | 7/7 casos com prova; UI H09 não qualificada |
| WP04.T03.QLT.01 | A comparação distingue avaliação humana, cálculo e informação ausente; diferença de preço e razão do ranking são legíveis juntas. | PASS_SCOPED | `B067` · `N106` · `N010` | 7/7 casos com prova; closure registrado |
| WP04.T03.QLT.02 | Arredondamento é de apresentação e não altera ranking, valor aprovado ou reconciliação. | PASS_SCOPED | `B068` · `N107` · `N010` | 5/5 casos com prova; closure registrado |
| WP04.T03.QLT.18 | Schema fechado, ausência/falha explícitas e provenance permitem comparar UI/native/MCP. | PASS_SCOPED | `B069` · `N108` · `N010` | 6/6 casos com prova; closure registrado |
| WP04.T03.CMP.01 | Cobrir moedas diferentes, snapshot, FX ausente, empate, proposta não conforme, menos propostas e notas incompletas. | PASS_SCOPED | `B070` · `N109` · `N010` | 9/9 casos com prova; closure registrado |
| WP04.T03.CMP.02 | Cobrir PR estimada, sourcing, PO aprovada e PO emitida internamente sem agregar estados como se fossem equivalentes. | PASS_SCOPED | `B071` · `N110` · `N010` | 8/8 casos com prova; closure registrado |
| WP04.T03.CMP.18 | Cobrir todos os exports desta task (1), caso autorizado, direto proibido, stale e indisponível. | PASS_SCOPED | `B072` · `N111` · `N010` | 9/9 casos com prova; closure registrado |
| WP04.T03.SUC.01 | O leitor explica a liderança de A e seu custo adicional no cenário sintético usando apenas a comparação e sua decomposição. | NOT_RUN_HUMAN | `B073` · `N112` · `N113` | 4/4 casos com prova; humano não observado |
| WP04.T03.SUC.02 | O mesmo valor de domínio aparece coerentemente no detalhe, resumo e C02 entregue a consumidores. | PASS_SCOPED | `B074` · `N114` · `N010` | 7/7 casos com prova; UI H09 não qualificada |
| WP04.T03.SUC.18 | O usuário recebe a mesma capacidade e resultado pelas superfícies sem divergência ou efeitos adicionais. | BLOCKED_NATIVE | `B075` · `N115` · `N116` | 8/8 casos com prova; nativo bloqueado |
| WP04.T04.CHK.01 | Em cada variante, uma pessoa identifica em até 30 segundos o que está aprovando, valor, diferença relevante, razão/evidência e próximo passo; registrar respostas incorretas, não apenas tempo. | NOT_RUN_HUMAN | `B076` · `N117` · `N118` | 2/2 casos com prova; humano não observado |
| WP04.T04.CHK.02 | Aprovar uma etapa intermediária mantém o pedido pendente se ainda houver holder seguinte; concluir sourcing libera po_draft, nunca po_issued ou aprovação de PO implícita. | PASS_SCOPED | `B077` · `N119` · `N010` | 7/7 casos com prova; closure registrado |
| WP04.T04.CHK.03 | Ator que não é o holder, inclusive admin sem direito de override, recebe a recusa existente também no comando; opção blockSelfApproval continua configurável e respeitada. | PASS_SCOPED | `B078` · `N121` · `N010` | 7/7 casos com prova; UI H09 não qualificada |
| WP04.T04.CHK.04 | Alterar a versão entre abertura e confirmação: decisão é recusada por conflito, comentário local permanece e nenhuma aprovação é reaplicada automaticamente após recarregar. | PASS_SCOPED | `B079` · `N123` · `N010` | 8/8 casos com prova; UI H09 não qualificada |
| WP04.T04.CHK.05 | Executar a preparação determinística C02 consumida pela receita C07 de WP09 duas vezes na mesma versão: obter o mesmo conteúdo de decisão/pendências sem transição de estado, novo identificador de PO ou mensagem externa. | PASS_SCOPED | `B080` · `N124` · `N010` | 3/3 casos com prova; UI H09 não qualificada |
| WP04.T04.DOD.01 | PR, sourcing e PO possuem resumos próprios ligados à versão e aos comandos reais. | PASS_SCOPED | `B081` · `N125` · `N010` | 7/7 casos com prova; closure registrado |
| WP04.T04.DOD.02 | Preparação read-only e ações humanas estão separadas no contrato exportado. | PASS_SCOPED | `B082` · `N126` · `N010` | 6/6 casos com prova; UI H09 não qualificada |
| WP04.T04.INV.01 | Aprovar uma etapa não pula outras aprovações nem muda os poderes do holder/admin. | PASS_SCOPED | `B083` · `N127` · `N010` | 10/10 casos com prova; UI H09 não qualificada |
| WP04.T04.INV.02 | Uma decisão desatualizada nunca é reaplicada automaticamente e referências textuais não ganham validação fictícia. | PASS_SCOPED | `B084` · `N128` · `N010` | 8/8 casos com prova; UI H09 não qualificada |
| WP04.T04.QLT.01 | O título nomeia a decisão concreta e a área de ação explica seu efeito e a próxima etapa. | PASS_SCOPED | `B085` · `N129` · `N010` | 6/6 casos com prova; closure registrado |
| WP04.T04.QLT.02 | Resumo curto e drilldown detalhado apresentam os mesmos valores, contexto e limitações. | PASS_SCOPED | `B086` · `N130` · `N010` | 7/7 casos com prova; UI H09 não qualificada |
| WP04.T04.CMP.01 | Cobrir PR, sourcing, PO, aprovador intermediário/final, rejeição com motivo, autoaprovação configurável e holder alheio. | PASS_SCOPED | `B087` · `N131` · `N010` | 14/14 casos com prova; UI H09 não qualificada |
| WP04.T04.CMP.02 | Cobrir versão desatualizada, evidência incompleta e execução read-only por consumidor de rotinas. | PASS_SCOPED | `B088` · `N132` · `N010` | 7/7 casos com prova; UI H09 não qualificada |
| WP04.T04.SUC.01 | O aprovador completa o roteiro de compreensão sem abrir Settings nem reconstruir a comparação manualmente. | NOT_RUN_HUMAN | `B076` · `N133` · `N134` | 2/2 casos com prova; humano não observado |
| WP04.T04.SUC.02 | Uma preparação automática é útil como rascunho e demonstravelmente não produz decisão de negócio. | PASS_SCOPED | `B089` · `N135` · `N010` | 5/5 casos com prova; UI H09 não qualificada |
| WP04.T05.CHK.01 | Fornecedor ativo tem IBAN/account alterado por ator permitido: volta a pending, validação é removida e a interface indica revalidação; ator sem permissão é recusado e não vê material bancário em view, erro, histórico, register ou C02. | PASS_SCOPED | `B090` · `N136` · `N010` | 7/7 casos com prova; closure registrado |
| WP04.T05.CHK.02 | Fornecedor com taxId duplicado não é aceito; legalName duplicado segue o aviso existente; ativação incompleta aponta os requisitos reais sem declarar sanctions screening externo realizado. | PASS_SCOPED | `B091` · `N137` · `N010` | 4/4 casos com prova; closure registrado |
| WP04.T05.CHK.03 | Reset de Settings restaura exatamente os defaults do baseline sem apagar requests/suppliers; edição de matriz/câmbio não modifica snapshots já congelados. | PASS_SCOPED | `B092` · `N138` · `N010` | 5/5 casos com prova; closure registrado |
| WP04.T05.CHK.04 | Após importação representativa ou exclusão permitida, criar PR/PO/SUP não reutiliza identificador já emitido; registro/PO exportados preservam campos de negócio e omitem material restrito. | PASS_SCOPED | `B093` · `N139` · `N010` | 8/8 casos com prova; closure registrado |
| WP04.T05.CHK.05 | Percorrer create → submit_pr → approve → sourcing/select/submit → approve → PO/submit → approve → issue e caminhos de rejeição/cancelamento: estados e recusas coincidem com o inventário; po_issued permanece interno e terminal para cancel/delete. | PASS_SCOPED | `B094` · `N140` · `N010` | 8/8 casos com prova; closure registrado |
| WP04.T05.CHK.18 | Executar sf_supplier_read, sf_contract_read pela UI/native/MCP com base e autoridade iguais produz o mesmo handler, resultado e versão; chamada direta sem concessão ou após revogação é recusada pelo destino. | BLOCKED_NATIVE | `B095` · `N142` · `N143` | 4/4 casos com prova; nativo bloqueado |
| WP04.T05.DOD.01 | Suppliers e Settings conservam todas as operações e campos do inventário com feedback utilizável. | PASS_SCOPED | `B096` · `N080` · `N010` | 13/13 casos com prova; closure registrado |
| WP04.T05.DOD.02 | O pacote fecha o recibo de preservação dos fluxos e entrega as portas ao integrador com limitações explícitas. | PASS_SCOPED | `B097` · `N144` · `N010` | 3/3 casos com prova; UI H09 não qualificada |
| WP04.T05.DOD.18 | Descritores C16 de sf_supplier_read, sf_contract_read são implementados e consumidos por T06 com referências reais. | BLOCKED_NATIVE | `B098` · `N145` · `N146` | 3/3 casos com prova; nativo bloqueado |
| WP04.T05.INV.01 | Alteração bancária e ativação seguem os papéis, cifragem, máscara e revalidação existentes; dados sensíveis não vazam para consumidores. | PASS_SCOPED | `B099` · `N147` · `N010` | 8/8 casos com prova; closure registrado |
| WP04.T05.INV.02 | Reset, exclusão e retomada não apagam histórico nem reutilizam identificadores PR/PO/SUP já emitidos. | PASS_SCOPED | `B100` · `N139` · `N010` | 7/7 casos com prova; closure registrado |
| WP04.T05.INV.18 | Permissões, locks, cálculos e comandos finais continuam no domínio; o transporte não cria poder novo. | PASS_SCOPED | `B101` · `N148` · `N010` | 5/5 casos com prova; closure registrado |
| WP04.T05.QLT.01 | Pendências de fornecedor explicam a ação corretiva sem confundir preenchimento declarado com verificação externa. | PASS_SCOPED | `B102` · `N149` · `N010` | 3/3 casos com prova; closure registrado |
| WP04.T05.QLT.02 | Operações raras e Settings ficam em acesso secundário claro, preservando descoberta por teclado e todos os controles. | PASS_SCOPED | `B103` · `N150` · `N010` | 4/4 casos com prova; closure registrado |
| WP04.T05.QLT.18 | Schema fechado, ausência/falha explícitas e provenance permitem comparar UI/native/MCP. | PASS_SCOPED | `B104` · `N151` · `N010` | 4/4 casos com prova; closure registrado |
| WP04.T05.CMP.01 | Cobrir os quatro estados de fornecedor, dados comerciais/bancários/compliance, linked requests, auditoria, busca e exportação. | PASS_SCOPED | `B105` · `N152` · `N010` | 9/9 casos com prova; closure registrado |
| WP04.T05.CMP.02 | Cobrir configurações/reset, todos os comandos originais e preservação de identificadores/campos após dados migrados representativos. | PASS_SCOPED | `B106` · `N080` · `N010` | 13/13 casos com prova; closure registrado |
| WP04.T05.CMP.18 | Cobrir todos os exports desta task (2), caso autorizado, direto proibido, stale e indisponível. | PASS_SCOPED | `B107` · `N153` · `N010` | 4/4 casos com prova; closure registrado |
| WP04.T05.SUC.01 | Buyer e supplier admin concluem cadastro, correção e revalidação sem consultar códigos internos nem expor informação bancária indevida. | PASS_SCOPED | `B108` · `N154` · `N010` | 4/4 casos com prova; closure registrado |
| WP04.T05.SUC.02 | O integrador consegue executar a jornada real completa com os exports entregues, sem solicitar um substituto de demonstração ou escrever dentro do domínio. | PASS_SCOPED | `B109` · `N155` · `N010` | 6/6 casos com prova; UI H09 não qualificada |
| WP04.T05.SUC.18 | O usuário recebe a mesma capacidade e resultado pelas superfícies sem divergência ou efeitos adicionais. | BLOCKED_NATIVE | `B110` · `N156` · `N157` | 3/3 casos com prova; nativo bloqueado |

## Critérios com dependência C12 explícita

São **28 linhas com casos próprios diretamente mapeados**: `WP04.DOD.02`, `WP04.DOD.03`, `WP04.DOD.10`, `WP04.INV.01`, `WP04.INV.02`, `WP04.INV.03`, `WP04.INV.10`, `WP04.QLT.10`, `WP04.CMP.10`, `WP04.SUC.03`, `WP04.SUC.10`, `WP04.T02.CHK.03`, `WP04.T02.DOD.02`, `WP04.T02.SUC.02`, `WP04.T03.INV.18`, `WP04.T03.SUC.02`, `WP04.T04.CHK.03`, `WP04.T04.CHK.04`, `WP04.T04.CHK.05`, `WP04.T04.DOD.02`, `WP04.T04.INV.01`, `WP04.T04.INV.02`, `WP04.T04.QLT.02`, `WP04.T04.CMP.01`, `WP04.T04.CMP.02`, `WP04.T04.SUC.02`, `WP04.T05.DOD.02`, `WP04.T05.SUC.02`.

Dependência adicional por produção: `WP04.DOD.01`. Total: **29 linhas**. O gate dos três consumidores WP11 não cria testes históricos fictícios para WP04; acompanha a produção compartilhada. `WP04.DOD.10` continua bloqueado nativo independentemente do resultado de componente.

Em `W4-BUN24`, os casos históricos próprios de C12 tiveram 5 pass / 3 fail; os dois novos negativos de digest passaram e os 12 casos consumidores WP11 passaram. As falhas mapeadas são `T038`, `T046`, `T127`.

Restore previously published post-domain CAS refresh and full-case equality from PR23/W1 while retaining all Finance digest/receipt binding. Only host-integration reaches this restored block; the other four C12 files have explicit unchanged/early-return reuse proof.

Em **W5**, os oito cenários reais H01–H08 passaram. As três falhas anteriores foram superadas pelo novo resultado, e H01 qualificou o segundo consumidor de dossiê. Os dois testes próprios prepared-port e os 12 consumidores WP11 conservam seus resultados W4 por fechamento do hunk. **H09 não foi qualificado**: a aquisição do navegador falhou antes de hostFixture/HTTP/assertions; startup e finalizer também falharam. O run agregado continua FAILURE. Nenhuma prova humana, de sessão nativa/modelo, de aquisição/saída física de Chromium ou de aceite global decorre desses passes.

## Consumidores e lacunas atuais

O JSON conserva **126 registros de implementação, 69 de consumidor e 127 de casos de teste** do original. Registros diferentes podem apontar para símbolos distintos do mesmo arquivo. Nomes, selectors, conexões, reversos por critério, hashes, resultados observados e limites estão nos catálogos; uma referência de código não constitui prova global.

| Frente | Estado | Evidência, consumo ou obrigação restante |
|---|---|---|
| `TS-29_TS-30` | `REAL_HOST_REVIEW_DIGEST_AND_RECEIPT_COMPONENTS_PASS_W5_UI_CONSUMER_UNQUALIFIED` | H01–H08 passed W5; actual reviewDigest and human-intent binding, current producer reread, durable receipt replay, ABA/access denial and expiry are scoped real-host proofs. UI H09 failed before host acquisition. Cache clear is not process restart; native/human/global acceptance remains separate. |
| `OPS-CONSUMER-03` | `EXACT_OWNER_UI_CONSUMED_H09_UNQUALIFIED_OWNER_BROWSER_ACQUISITION_BLOCKED` | Published UI code retains real digest and frozen retry. H09 was authored/reviewed against real Procurement host but could not acquire the owner browser pool; no UI/HTTP assertion ran. Startup failed at chromium-launch, H09 and physical finalizer also failed. One Omni spawn was proved; acquisition/exit, generic Dashboard/Planner bindings, native/human/global acceptance were not. |
| `OPS-HOST-01` | `PUBLISHED_OWNER_CONSUMED_RUNTIME_AND_RENDERER_COMPONENT_PROOFS_PASS_W4` | Five real runtime dossier cases passed inside failed Bun24 aggregate; eight renderer cases passed in their separate production Playwright run. Different scopes remain explicit: synthetic HTTP renderer is not another real-host/native/human proof. |
| `OPS-HOST-01B` | `MINIMAL_PUBLISHED_OWNER_WRAPPER_CONSUMED_REAL_H01_COMPONENT_PASS_W5` | H01 actual business.procurementDossier passes with Request sourcing, offers, submitted FX and same refs/context/comparison; real source edit and principal revocation are fenced. The source-change schedule also invalidates the selection, so it is not exclusive proof of the full-sourcing equality branch. C12 preparation remains unchanged. No native WP09 recipe/provider session or human acceptance inferred. |
| `OPS-C12-CAS-REGRESSION` | `PUBLISHED_DELTA_RESTORED_AND_REAL_HOST_RECONCILIATION_PASS_W5` | The exact published PR23/W1 post-domain CAS/equality hunk was composed into Finance binding without weakening proof or guards. W4 H02/H03/H05 failures remain in history; all three and H06 passed on W5 run43584405211. No repeated validation of four unchanged/early-return C12 files. |
| `OPS-CONSUMER-02` | `EXTERNAL_ATLAS_TYPECHECK_FIXTURE_STILL_BLOCKS_AGGREGATE` | W5 allcheck reports only TS2741 missing procurementEvidenceWrites at line167. Own sources/fixtures have no diagnostic; CLI and 78 guards passed (772 paths, 0 findings, 11 warnings). Owner must preserve both existing scenarios when adapting its factory caller. |
| `OPS-NATIVE-UI-ACQUISITION` | `BLOCKED_OWNER_ACQUISITION_NO_CHROMIUM_OR_PHYSICAL_EXIT_PROOF` | W5 owner startup timed out in chromium-launch; stderr had no cause, no browser PID was reported. H09 and finalizer failed through the poisoned pool; real Procurement HTTP/SQLite/browser assertions were not reached. Root cause and absence of orphan processes are not inferred. One Omni spawn was observed. No automatic rerun or timeout increase. |
| Humano | NOT_RUN_HUMAN | Quatro observações continuam obrigatórias; navegador e screenshots não medem compreensão/tempo. |
| Global | Não aceito | S0 integra TODO o trabalho, faz as revisões independentes exigidas e executa o epic do bundle final. |

## Bloqueios sem requalificação

Nativos: `WP04.DOD.10`, `WP04.T01.CHK.18`, `WP04.T01.DOD.18`, `WP04.T01.SUC.18`, `WP04.T03.CHK.18`, `WP04.T03.DOD.18`, `WP04.T03.SUC.18`, `WP04.T05.CHK.18`, `WP04.T05.DOD.18`, `WP04.T05.SUC.18`.

Humanos: `WP04.SUC.01`, `WP04.T03.SUC.01`, `WP04.T04.CHK.01`, `WP04.T04.SUC.01`.

A recuperação por `dispose()` limpa o cache próprio e usa o recibo persistido; não demonstra reinício completo de processo. O código de H09 compõe o produtor, a autoridade e o formulário publicado com identidade controlada do fixture; esse caminho não foi executado após a falha de aquisição. Mesmo quando executar, sua página de teste não prova o host genérico de Dashboard/Planner ou a sessão nativa/modelo. O caso de expiração varia o clock do produtor real. Políticas de compras, alçadas, scoring, engines e significado dos estados não foram alterados.

## Auditoria e reprodução documental

- `operations-criteria-111.normalized.json`: os 111 critérios, catálogos deduplicados, estados originais e addendum atual.
- `operations-criteria.json` e `operations-criteria.md`: originais integrais preservados.
- `compact-map.py` e `compact-map-verification.json`: normalização, reconstrução semântica e igualdade dos 111 IDs/textos literais.
- `impact-inspection.json`, `ts29-30/w1-w2-symbol-impact.json`, `w3-w4-closure.json` e `w4-w5-closure.json`: fechamento por arquivo/símbolo até W5; compare MCP e oito blobs publicados em `w4-w5-compare.json`/`w5-published-code-pins.json`.
- `patches/OPS-C12-CAS-REGRESSION/finding.json` e `five-caller-impact.json`: restauração dos deltas publicados, origem dos hunks e quatro consumidores reutilizáveis versus host materialmente afetado.
- `patches/OPS-HOST-01B-tests/manifest.json` e `patches/H09-real-ui/manifest.json`: novas provas próprias, limites, hashes e seleção cirúrgica.
- Os recibos individuais do catálogo de checks registram job IDs, árvores, envelopes, seleção, tempos, asserts, artefatos e qualificações completas.

SHA256 do JSON original: `293a4a81ca9d5da520823030b1620f919ed8aa3f9a5990f3bb964c43a5d89cd3`. Os 111 IDs/textos foram comparados em sequência; nenhuma linha foi agregada, omitida ou substituída.
