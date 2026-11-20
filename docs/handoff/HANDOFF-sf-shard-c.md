# Handoff — sf-shard-c

SHA de código C: 8263062f23753c56ed7ca1646c2d08f6a2acf90e
Base original: f7dd58e32bc834f1485df20b91adbf759b4c4ad0
Integração observada: sf-join-four em b180588c63e41eecd6d73d839d078755d68cad3d
C incorpora a integração até b180588c63e41eecd6d73d839d078755d68cad3d (#437). Contém os merges qualificados #406/#430/#432/#427/#428/#431; testes próprios ainda pendentes permanecem separados da qualificação de produção.
Estado: IN_PROGRESS — pedido atualizado exige todas as falhas corrigidas e mergeadas verdes.
Checkpoint: 2026-11-20. PR principal: [#397](https://github.com/gustavomhss/Orchestra-SF/pull/397).

## Feito

Acesso exclusivamente pelo GitHub; execução somente por Actions. A enumeração completa da base mediu shard7 **518 pass / 12 fail** e shard8 **618 pass / 2 fail**. Todas as falhas originais estão mapeadas. Correções de testes ficam em sf-shard-c; produção compartilhada fica em PRs shared: separados, mergeados em sf-join-four somente após revisão e gate verde.

Já mergeados:
- [#399](https://github.com/gustavomhss/Orchestra-SF/pull/399), fixture da instalação e scanner privado; source1aee8d2dac6c92a6e509e76dca87525128dab4a9, merge a5b15b51b78469a054ba97b0e87fd1e36e31f73a. Typecheck canônico verde, sem alegar execução dos cenários privados EICAR/ClamD.
- [#398](https://github.com/gustavomhss/Orchestra-SF/pull/398), reobservação Atlas com novas provas consumíveis e fences originais; source28df867d458fef842919f8b5e703df90209ff76a, merge589adb7cae06c584e1e51eeac9db7cd24dc987ea. Quinze testes verdes incluem historical-memory C7, revocation-tail A2 e similarity217 B5.
- [#404](https://github.com/gustavomhss/Orchestra-SF/pull/404), identidade estável de ready dentro da mesma admissão, invalidada por geração/owner/reload/revogação; source4d8c7866df5e7b8146b7b0ff2fedf4b293cd59a7, merge5efe5a3ff3a2c382a18b28f0d575825eafab5ede. Três testes de componente verdes; não substituem instalação completa.
- [#401](https://github.com/gustavomhss/Orchestra-SF/pull/401), prova BI completa reaproveitada somente no escopo original, mantendo autoridade/fontes/dia UTC/imutabilidade; source29021f31f9ea0a46807e60f25176a272a8c93096, merge18a913220a6805bef1c62a58a26a310f991d6a0a. Nove testes verdes incluem ambos os renderings C7.
- [#402](https://github.com/gustavomhss/Orchestra-SF/pull/402), transporte verificável de aprovação real do PR fonte para guards; sourcecd7c1e082394ab105f507d38bf3d656953827f1b, merge08854f14d83ab12d8665b0e3787881edbfaabd53. Cinquenta e nove testes de resolver/runner verdes. Não concede aprovação e não elimina os dois gates protegidos.


- [#400](https://github.com/gustavomhss/Orchestra-SF/pull/400), fonte Planner na resposta humana; source 50ce9319b03ae52ec3871043161c19b17c49a1b3, merge 392cecab68288d4b669828adc5d1aaa738693d80. Original C7 passou no primeiro gate; a nova fixture recebeu a linha real de acesso do destinatário e passou no segundo (1/0, 32 asserções).
- [#411](https://github.com/gustavomhss/Orchestra-SF/pull/411), prioridade e destinos nativos de Signals; source 492c06aa5d34e30db3859db3f411f948891d02a3, merge 7c42282e8b910cc0e10381980f040dee72cb2b19. Gate 44660432596: 12/0 em unidades mais 2/0 em browser de rota, 183 asserções. A lista elegível mantém as 21 identidades; CAP13 não se torna produtor.
- [#409](https://github.com/gustavomhss/Orchestra-SF/pull/409), estado de busca/filtro Portfolio admitido novamente por owner/geração; source b07ed52c5e3d96567f0051520b229313e5b4b04a, merge f4b62403fc2d9c74c6302d745bb4a057cfdd4439. Primeiro gate 4/3 revelou remount incorreto da fixture. O segundo, após keyed render-prop real, passou 4/0, 60 asserções, sem ampliar wait.
- [#415](https://github.com/gustavomhss/Orchestra-SF/pull/415), restauração de 14 blobs documentais históricos exatos; source fa25e59bbcadc41823cdad47b24e75fac3095d37, merge 1222022bd54282c8086b1da45b0be6ad2f6520ea. Gate 44661599225: 8/0, 401 asserções. Nenhum pin alterado; evidência de corpus/contratos, não execução dos journeys.

- [#417](https://github.com/gustavomhss/Orchestra-SF/pull/417), revisão11 do contrato com proveniência; source f86d423436380812e4ce0835d4dbe4efced1d825, merge 687759276c2c9121c2cfd20a5994b277ceb7ee4d. Gate44662549289:5/0,913expects. Os merges posteriores407 e431 alteraram o produtor host pinado; revisão12 #426 está sendo emendada com as duas proveniências, ainda sem gate. O verde11 não qualifica a árvore posterior.
- [#407](https://github.com/gustavomhss/Orchestra-SF/pull/407), observação Reviews integrada por outra sessão; source713f9829e896fee44a610dfbda16f893be2e5be5, merge d548a76a4e7838bccdb20e98c1ad16fdeca0b391. Gate44657226869:4/0,27expects. Alteração real do host exige nova proveniência WP00.
- [#412](https://github.com/gustavomhss/Orchestra-SF/pull/412), recuperação OPEX/CAS; fix de fixture867fe10bf2aae28b244b65b5d17dc54c58ffd22e, merge d7fa94063e798207ed692026b557d27dfff1aef8. Segundo gate44662953944:2/0,21expects,1.63s. Captura usa schema estrito e fronteira JSON real; não modifica espera/assertions.
- [#421](https://github.com/gustavomhss/Orchestra-SF/pull/421), leitura/configuração nativa de resumos; source849f00b98ef315025acdfffd4f3705e49c39953f, merge d4ded81224e05f2d3b9789b3eec40b9de8a32fa1. Gate44663777161:9/0 HTTP/schema +12/0 UI =21/0,7913expects. Admin, CSRF, CAS, idempotência, directory, auditoria, intenção e releitura reais; nenhum guard removido.
- [#422](https://github.com/gustavomhss/Orchestra-SF/pull/422), navegação de período CAP03 pela admissão F01 real; source f201956ef1491e699bee409c571ad16d82cea158, merge23f851dbc6b86c0a571dd95f4b2bb2558b9dc1cd. Gate44664293983:5/0,107expects,1.84s; owner, geração, revogação, URL, recarga e draft preservados.
- [#430](https://github.com/gustavomhss/Orchestra-SF/pull/430), nove fatias B de teste qualificadas; source9af676c5df10e363c8837562e4bfe6bcc66fd60e, merge838572713fcceb2df96086f9729347fcda87d9e7. C02/C05/C06/C07+C08+C17(somente3arquivos)/C12/C13/C14/C15/C16,12blobs exatos dos snapshots verdes. C01/C03/C04/C09/S10 e demais unbounds excluídos; head B não usado como parent. Gates originais/limites completos no PR, sem alegação de shard integrado verde.

- [#406](https://github.com/gustavomhss/Orchestra-SF/pull/406), replay do draft somente com transação prévia durável e fences atuais; source3190d29fa62e902f8ceefdffcf703eb367c9b2c9, merge062506e92427f9ff41fcb952c0b1559e65076a4d. Gate44663906249:9/0,181expects; nova intenção obsoleta403, colisão409 e revogação403 preservadas.
- [#432](https://github.com/gustavomhss/Orchestra-SF/pull/432), fatias A descriptor/Executive/download qualificadas nos gates completos A1/A2; sourcec7b4b1d7077ba908bb588e955f784215fd185d72, mergee41c3e18330397ce508a349f52cb3bee8cb07639. Dois arquivos; não transporta os demais unbounds de A.
- [#427](https://github.com/gustavomhss/Orchestra-SF/pull/427), conflito documental original preservado como stale/HTTP409; source0fff3074641bf8f21845e4db59423cf89b3eef7a, mergebe192011d5cfccc7524fd81d53674b3317005091. Gate44667039756:2/0,54expects,2.67s; sem exposição privada ou segunda escrita.
- [#428](https://github.com/gustavomhss/Orchestra-SF/pull/428), fence final da saída de análise distingue falha de render503 e autoridade revogada403; sourcec62c817df0208202ad3ee768433542d862f3921c, merge573678d0acf9e91654efb7e67af7d30ebe45312b. Gate44667507711:3/0,25expects,13filtered; primeira preparação Workbench não incluída nesse gate.
- [#431](https://github.com/gustavomhss/Orchestra-SF/pull/431), disponibilidade de assets/import observada por outra sessão; merge295c2bdca05c2373f821d50aab5d3ee3d3fb218b. Gate44666552454:26/0,182expects,729ms, fonte6732ff508922b097e5c9c42b457e3dc8dc6c65ae. Novo host altera um pin WP00; não qualifica a suíte Operations inteira.
- [#437](https://github.com/gustavomhss/Orchestra-SF/pull/437), projeção Budget publica mapa vazio somente quando Domain.view admitido prova ausência canônica; source54f0e9da5f5119967e268a32b48cb7c7824440c0, mergeb180588c63e41eecd6d73d839d078755d68cad3d. Gate44668705164:18/0,1386expects,1219ms. Nenhum CAS inventado; mapa malformado, revogação e corrida continuam recusados. Não é terceiro gate do Dashboard.

Outras fatias concretas: C bcbc0a30c8d9f9dfb1ed78829ffe62939d07163e compõe os helpers C04 de B; C 8e71e07e907b02be635d4f98aaf0638816f7b429 corrige o chooser BI com duas fontes reais e controles HTTP negativos; C 3e23044944a59c2544b3d09451960d22e3bec47f migra o Dashboard completo ao host nativo. O chooser ainda aguarda gate. Dashboard nativo falhou duas vezes após25asserts: 44663298380 e44666208536. Registrado UNBOUND, sem terceira execução focada. Os cinco controles de #423 passaram; #437 corrige separadamente a omissão do mapa pelo produtor. A fixture conserva todos os controles originais e o limite de60s.

AM02, pin de produtor, recuperação Atlas, revogação de observação, import/report nativo e planner-origins também passaram nos gates focados abaixo. Não houve execução integrada dos oito shards após todos os fixes. Recortes não são somados aos totais da base.

## Enumeração original por shard

Paths de C relativos a modules/sucafina/Sucafinav1/.

| Shard | Run id | N pass / M fail | Falhas (file:line) | SHAs dos fixes |
| --- | --- | --- | --- | --- |
| 7 | [44645952434](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44645952434) | **518 / 12**,530tests103files | Mapa C7 completo abaixo | 36c7989,ccde747,e24aa85,4758184; shared28df867,29021f3,1aee8d2; demais pendentes |
| 8 | [44645956665](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44645956665) | **618 / 2**,620tests115files | product/canonical-read-cost/diagnostic-cost.test.ts:13:26; product/wp05/planner-origins.test.ts:83:77 | 328960a664ed64c4db46e69bf30f24f9efb04c51;8392356be8a13c33eb4dec83e4e198f7b1806b37 |

Snapshots:7=0cc9380fdc452c2da328a787e207396c4040c5e1;8=13f88387091b7db295a73aca0d20fb3859a56ae7.

## Mapa C7/C8 atualizado

| Causa | Falhas originais (file:line) | Evidência atual / próximo passo |
| --- | --- | --- |
| C7.1 validade da autoridade durante preparo | product/wp12/native-execution-scenarios-review.test.ts:39:72 → :55:25 | Gates44658317657=11/1 e44662130965=23/1; mesmo scenario-or-authority-changed,719650.91ms/611255.76ms. 23controles novos PASS, original não. **UNBOUND; dois gates no mesmo ponto, sem terceira execução focada. PR403 draft/não mergeado.** |
| C7.2 período/campos + baseline observado | product/wp12/native-execution-dependencies.test.ts:60:21 | Fix ba7200ea39f7bc56a97c33301b2d8ccd06ad3d77 + helpers B dda42a61; checkpoints c044ba0 preservam37asserts/prazo420s. Primeiro44658954003=0/1,139expects. Composição #414/#420/#424 no44666613719=20/1,272expects,613.77s:10metric+10persistence verdes, original timeout reportado549513.57ms. Última fase iniciada decision-choose, após units157.389s e criteria17.897s. Segunda falha do original→UNBOUND, sem terceiro gate focado. |
| C7.3 resposta Planner | product/wp12/native-execution-questions.test.ts:340:73 | Original passou no 44656420362. Nova fixture corrigida em 50ce9319b03ae52ec3871043161c19b17c49a1b3 passou 1/0 no 44658520809; PR400 mergeado |
| C7.4 custo BI09,2casos | product/bi-cost-waterfall/rendering.test.ts:20:11;112:7 | Gate44657153397:ambos PASS62.1s/57.6s dentro dos105s; PR401 mergeado |
| C7.5 import/report legado | product/wp02/import-report-consumer.test.ts:100:25 | Migração nativa4758184b6ef9abc61bf57ec7b08481bb78d5c8c3; gate44656058658:1/0,71expects |
| C7.5 Dashboard legado | product/wp02/dashboard-browser.test.ts:74:66 | Migração3e23044; 44663298380=0/1,25expects,60.40s. Segundo44666208536=0/1,25expects,55.64s no Save:97:72; controles #423=5/0,58expects. Chrome conectou em ambos, não é falha de launch. UNBOUND. Causa adicional de produção: mapa deviations canonicamente ausente; #437 mergeado após18/0, sem repetir Dashboard. |
| C7.6 cache Atlas single-use | product/wp10/analysis-composition/historical-memory.test.ts:292:100 | PR398 mergeado; gate44654168008:15/0,1495expects em5arquivos |
| C7.7 recuperação Atlas | product/wp10/atlas-business/atlas-recovery.test.ts:137:32 | Fix36c7989ecf8b836af893de22a293092e4cbd09ba; gate44650347644:1/0,37expects |
| C7.8 estático | product/work-split/work-reuse/static-gates.test.ts:12;budget:28 | Typecheck canônico corrigido/verde PR399. Canal guard PR402 verde, mas aprovação real dos2paths ainda necessária; não declarar static gate verde |
| C7.9 admissão removida | product/diagnostics/calculation/source-observation.test.ts:86:29 | Fixccde74734b19f78aab0aa64ac0f301e5a4d379c0; gate44650428648:2/0,27expects |
| C7.10 identidade + oracle AM02 | product/integrated-proofs/am02/performance-public-c16-reopen.test.ts:160:42;175:43 | Fixes9643737ac1b2a0c475af283dddc72db70d81a81c +e24aa85b0c8d88d0cd007b977ff84ff73eca8f30; gate44653652279:1/0,194expects,revogação final alcançada |
| C8.1 pin/proveniência | product/canonical-read-cost/diagnostic-cost.test.ts:13:26 | Fix328960a664ed64c4db46e69bf30f24f9efb04c51; gate44649157618:2/0,40expects |
| C8.2 driver original Node | product/wp05/planner-origins.test.ts:83:77 | Fix8392356be8a13c33eb4dec83e4e198f7b1806b37; caso PASS3.669s no44654104426; dois casos sensibilidadeA2 também PASS |

## Gates executados por causa

| Causa | Run | Pass / fail | Snapshot | Fonte / resultado |
| --- | --- | --- | --- | --- |
| Pin | [44649157618](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44649157618) | 2/0 | 96211198e61056d3ee17d1710d74ea4b0f16bcad | 328960a;40expects |
| Atlas recovery | [44650347644](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44650347644) | 1/0 | 0007a30900ff798c893cdf6d74362b688572fb48 | 36c7989;37expects |
| Source observation | [44650428648](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44650428648) | 2/0 | 011e889380002daf99536c75c829062a6e270389 | ccde747;27expects |
| AM02 identidade | [44650813269](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44650813269) | 0/1 | e805ecb442655cde05efc584b3f0937658754df6 | 9643737;novo ponto175:43,146expects |
| AM02 oracle completo | [44653652279](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44653652279) | 1/0 | 96b648684730b2b0e81a71370ce8adf80b77db25 | e24aa85;194expects |
| WP05 Node driver | [44654104426](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44654104426) | 12/1 | a29d447 (SHA completo no run) | 8392356;1057expects,113.27s,8files; único fail sentinel privado hidden colide com atributoHTML |
| Atlas completo | [44654168008](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44654168008) | 15/0 | 8b696e (SHA completo no run) | 28df867;1495expects,1127.47s,30Omni spawns0delegations |
| Private types | [44654714455](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44654714455) | 1/0 | 40a0506 (SHA completo no run) | 1aee8d2;typecheck exit0,30.4s;1spawn0delegations |
| Sentinel privado | [44655693464](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44655693464) | 0/1 | a26d54b83d29e88e72407a0fdae4bb2343b57f65 | 617815c3399db344bf951fa3569d41766a3eb268;57expects anteriores PASS;infraChrome launch14667ms |
| Import nativo | [44656058658](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44656058658) | 1/0 | e1a61cd4671e57b4b40674d8133f7e01fbb934af | 4758184;71expects,3.168s,2spawn0delegations |
| Planner answer inicial | [44656420362](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44656420362) | 1/1 | 07f3eadb2488aed5a7078fbbf784504f6e91d376 | eaf906;97expects;originalPASS,newfixtureFAILrecipient absent |
| Owner-ready | [44657002119](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44657002119) | 3/0 | 366a84276250b782ab46c4b1809dd1d77a43babf | 4d8c786;41expects,1.69s |
| BI completo | [44657153397](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44657153397) | 9/0 | 3d6bce8f3a4828ed2cd0fddd59118c76f6356eee | 29021f3;376expects,420.63s;drilldownA2 não incluído no filtro |
| Contexto approval guards | [44658251806](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44658251806) | 59/0 | b893ed5fb43e1bbcf66972f08634a7fd55578271 | cd7c1e0;361expects,215ms;testes não são aprovação real |
| Cenários Planner inicial | [44658317657](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44658317657) | 11/1 | 577f5d4c91bc144a41afbb40075ab0ae95438339 | b84fd723; 201 asserções; original :55 scenario-or-authority-changed |
| Planner recipient fixture | [44658520809](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44658520809) | 1/0 | 103b0b4f8c23c49741a254f34fd24949e9c05bff | 50ce9319; 32 asserções, 14.42 s; original já passou |
| Dependencies C04 | [44658954003](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44658954003) | 0/1 | 9f37bb3281b788a880b5b94ce9d0f524a106950d | bcbc0a30; 139 asserções; timeout após preparo completo, sem aumento |
| Portfolio inicial | [44660248357](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44660248357) | 4/3 | a8bae72fe29c80a6282b94af14c6ccd921017e07 | 05e2d751; 31 asserções; fixture não remontava, não falha da admissão inicial |
| Signals | [44660432596](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44660432596) | 14/0 | fff4d205916ad9896b6d93270358c4373df17b10 | 492c06aa; 183 asserções, duas invocações 12/0 + 2/0 |
| Result selection + B6 | [44660844009](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44660844009) | 30/1 + 1 error | c88eebfd04eff94b1ba300fda409eb83198e5cb4 | debed39; 223 asserções; semantic-union-source-scenario.test.ts:50 portfolio-analysis-changed, 180007.25 ms; PR414 continua draft |
| Portfolio remount real | [44661234622](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44661234622) | 4/0 | 739472f5450cc0f590e3fe5c0eb4e88acd661966 | b07ed52; 60 asserções, 1.493 s |
| OPEX captura inicial | [44661576715](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44661576715) | 0/2 | c7b7a1a455504ebfbd2d11f95e85227164f833c3 | cf961ffd; budget-conflict.test.ts:48/115; captura structuredClone do Proxy Solid diverge da serialização JSON real; corrigida em867fe10 e segundo gate verde abaixo |
| WP00 docs exatos | [44661599225](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44661599225) | 8/0 | 6999937050aeeb5d6839f87027dc26d2c7ab094c | fa25e59; 401 asserções, 358 ms |
| Cenários, comparação pública | [44662130965](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44662130965) | 23/1 | 96b53bb186df47815ce7189b77e8db7a2b45d754 | 0c15b8a;265expects615.08s; original:55:25 scenario-or-authority-changed repetiu; UNBOUND, parar esta causa |
| WP00 contrato11 | [44662549289](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44662549289) | 5/0 | d9284bc1079b580af9d6224c5d2b141ee02a0d6f | f86d423;913expects174ms; merge417;38artefatos/aceitação BLOCKED preservados;407posterior invalida somentepinhost, #426 pendente |

| OPEX captura JSON real | [44662953944](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44662953944) | 2/0 | f3319eed26f2ec6160566c5fe2af098b1db16678 | 867fe10;21expects1.63s; PR412 mergeado |
| Dashboard nativo inicial | [44663298380](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44663298380) | 0/1 | b0ba743540c727a63f3a579e718a9fb5cb041626 | b1a092b;25expects60.40s,52totais; driverNode/Chrome conectados, novo desvio não chegou à asserção final |
| Summary settings | [44663777161](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44663777161) | 21/0 | bd5bdf42b0c23386501d48a5237fedab330708d7 | 849f00b;9/0+12/0,7913expects; PR421 mergeado |
| C09 batch + selectors + B6 | [44663788472](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44663788472) | 49/1 | 75f6a0dfc518e171d213f6ec2a3e0cae563b9316 | source9d370bc;405expects236.31s; 49controlesPASS, original B6 timeout180011.22ms. Log novo não imprime :50/reason; mesmo teste após segundo gate, UNBOUND. PR414/420 drafts |
| Budget period | [44664293983](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44664293983) | 5/0 | f5fa0449c154ea355bdac91a61c53a6ae2d9783b | f201956;107expects1.84s; PR422 mergeado |
| Primeiro desvio + Dashboard | [44666208536](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44666208536) | 5/1 (original0/1 + controles5/0) | b108d7fa4d9385c33840944fb56ceb78de3ebc06 | source3216ee4;83expects; original Save:97:72 após25asserts, segundo mesmo ponto→UNBOUND |

O incidente Chrome do sentinel foi investigado: importsBun329ms/Node217ms, ChromePID4178 em espera deIO(folio_wait_bit_common) por~11s e depois futex, Browser.getVersion1sent0received; cleanup3.239s confirmou ausência dos2PIDs. **unbound de infraestrutura**, não prova de bug de privacidade. Nenhum rerun idêntico nem aumento de prazo foi feito.

| C7 metric/persistence/dependencies | [44666613719](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44666613719) | 20/1 | 6b61ae5160d1cc2e3fac144f2d6f6840c5125d2f | source6704378a414d787aa321305ab9d78ae6f96387d2;272expects;10metric+10persistencePASS,dependencies420sUNBOUND |
| Document conflict | [44667039756](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44667039756) | 2/0 | 7fd2096159136d00803089b4d9b44aa0d7b8447e | #4270fff307;54expects2.67s;mergebe192011 |
| Analysis egress | [44667507711](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44667507711) | 3/0 | df5d7fe31e32d2737b51f4f26a0a814880e3c5ee | #428c62c817;25expects13filtered;merge573678d |
| Runtime native | [44668010002](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44668010002) | 3/1 | 2030026bbd1c3329f4b492d7e3b3d642caec9e7c | sourcefdbf7c790fb7838009243b323b6c72530679d92b;26expects;browser45s,hostready11.838s,Chromeconnected11.925s depois; causa do await restante em investigação |
| Canonical deviation projection | [44668705164](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44668705164) | 18/0 | 3f6c0e11f319770b91e98605e5025e9614b491b2 | #43754f0e9d;1386expects1219ms;mergeb180588 |
| Native public-state | [44668708981](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44668708981) | 3/0 | c5125ef206690b1f5464275aa82eb00d80d378f0 | C2a71e601a50d990f27381f649d705ff5f38b0b15;source084226;25expects3.91s;timeoutoriginal30s |
| Procurement explicit draft/refusals | [44669199777](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44669199777) | em andamento | 65db150c81c01b1ee3667fa9c34a310ab469c96b | C7e133b7+1cc82d5;source084226;intençãofalse explícita e recusa real de PO |
| AM04 receipt collision | [44669202348](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44669202348) | em andamento | 7b85405efc1d3a7767166733e1ca28304a936ac7 | C16a7026;source084226;mesma Request admitida e recibo/digest reais, sem leasefabricada |

## Tabela agregada dos oito shards

Esta é a última execução completa disponível por shard, ou a execução parcial explicitamente marcada. Gates focados não são subtraídos dos totais. As enumerações originais C7/C8 e os detalhes históricos A/B permanecem abaixo. Foram solicitados resultados nos PRs397/410 e lidos os handoffs A/B; A2 também foi confirmado como terminal pelo coordenador. O shard3 está em novo gate44665621967 após fixa86e22c, ainda sem sumário.

| Shard | Branch | Run | Pass | Fail | Causas | Unbound / qualificação pendente |
| --- | --- | --- | ---: | ---: | --- | --- |
| 1 | sf-shard-a | [44657265518](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44657265518) | 576 | 29 | UIlegada;performance/C12;baselinePortfolio;HTTP/contratos;revogação;documentos | Completo605tests113files,6345expects2418.23s; snapshot3edf1737c390f89220337cbcbc0efdf9f689ad51,fixdescriptor243c083. 29falhas listadas no apêndice atual. Summary/period/427/428 qualificados; privacidade3/0; runtime3/1browser45s; demais testes nativos em qualificação |
| 2 | sf-shard-a | [44661562191](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44661562191) | 508 | 6 | Chrome180s;recall120s;BIdrilldown;Atlas3 | Completo107files,9142expects1791.93s,1skip1error; snapshot460ca5cbcbe85af34bc1945af832e52ac8db07cc,fix2ee5e96198500ed9d2524b692240b90cce86ed79. ExecutivePASS; Atlas3 jáverdes em398 mas ausentes deste snapshot; chooserC8e71e07 aguarda gate |
| 3 | sf-shard-a | [44651344557](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44651344557) | ≥255 | ≥21 | UIlegada;sentinel;Portfolio/BIcost;C12oracle;linksBudget;corpus | Cancelado45min66/99files,33nãoiniciados; NÃO FINAL. Novo gate44665621967/snapshot3caf96c9115b30f8a1150532e08b4a1714345a4a em andamento. Corpus415verde8/0; contrato12pendente |
| 4 | sf-shard-b | [44645900692](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44645900692) | 497 | 14 | Identity/replay;verifierpayload;C12;baselinePortfolio;draft;authUI;guards;AM01 | Completo511tests118files. C02/C07+C08+C17qualificados e isolados430mergeado; C01cancelado,C03invalidURL,C04=1/3+1error,C09=0/1. #4069/0mergeado;4059/2unbound |
| 5 | sf-shard-b | [44645913808](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44645913808) | ≥576 | ≥21 | Sensibilidade;Atlas;linksBI;coverageorder;freeze;UI;transport;threshold;instrumentação | Cancelado45min105/119files,14nãoiniciados; NÃO FINAL,1skipLinux. C05/C06/C16qualificados e430mergeado; Atlas398verde. Freeze11passou mas407+431exigem12;performance/UIrestantes abertos |
| 6 | sf-shard-b | [44651628624](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44651628624) | 409 | 23 | UIconsumer;Portfolio180s;CAS;humananswer;Forecastpayload;baseline;locator;proposalbody;ancestry;chooser;hostlifecycle7;preview | Completo434tests109files,2skip,7243expects2226.61s. C12–C16qualificados e430mergeado. B6 original falhou de novo no44663788472 após49controlesPASS: UNBOUND, sem terceira execução focada |
| 7 | sf-shard-c | [44645952434](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44645952434) | 518 | 12 | Cenários;dependencies;Planneranswer;BI2;import;Dashboard;Atlas;static;revogação;AM02 | Cenários2xfalha→UNBOUND. Dependencies2xfalha→UNBOUND(20controlesPASS). Dashboard2xfalha→UNBOUND(5controlesPASS);produtor437verde18/0. Typecheck/guardsglobais e aprovação real pendentes. Sem fullshardnovo |
| 8 | sf-shard-c | [44645956665](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44645956665) | 618 | 2 | Pinprodutor;driverbrowser | Ambas causas focadas verdes; fullshard integrado pendente |

Não há um total global completo: shards3/5 ainda têm arquivos não executados. Não há GO, coverage final ou inferência nativa alegada. O PR413 mudou o planejador canônico para particionamento LPT determinístico; os índices acima identificam o inventário histórico da enumeração original e não devem ser misturados silenciosamente com a partição final.

## Pendente

1. Colher os gates atuais44669199777 (procurement) e44669202348 (AM04), com no máximo2 iniciados por esta sessão simultaneamente. Ambos têm correções concretas em C e conservam limites originais.
2. Qualificar Workbench nativo Cf2e13d29f9238a736dab23fc3b0ac26201790327 com o parser CaseRef #440. Composição124f767dc0542b3f0a3c25ff5d24f7c00919a495 pronta; selecionar workbench-analysis e workbench-case-identity. O teste original de identidade inválida continua400; não foi enfraquecido para esconder o bug.
3. Gates ainda não iniciados: historical scope C049ed587 (3casos analysis-stale-calculation), chooser BI C8e71e07 (um caso), #438 observação histórica de analysis (analysis-observation/analysis-recovery/scenario-batch), revisão12 #426 emendada com host407+431. #438 não é terceiro gate de B6.
4. Runtime nativo44668010002=3/1,26expects. Chrome conectou; investigar o ponto de espera restante com leitura da fixture/DOM. Sem aumentar45s e sem repetir sem correção concreta.
5. #403cenários, #414/#420B6, #424dependencies e Dashboard original atingiram duas falhas no mesmo ponto: **UNBOUND**, sem terceira execução focada. Controles novos verdes não tornam esses originais verdes. #423cliente tem5/0; #437produtor18/0mergeado; jornada Dashboard ainda não qualificada na composição final.
6. Isolar PR das fatias C já qualificadas: pin, Atlas, source-observation, AM02, import/report, transporte WP05 e privacidade nativa. Em WP05 procurement só transportar as2linhas expectSpawn necessárias ao novo helper; o teste teve falha privacy:182 e o sentinel posterior permanece excluído. Não mergear toda C/#397 como verde.
7. Guards: dois paths protegidos herdados, godfile-waivers.json e script/spawn-allowlist.json, exigem aprovação humana elegível. #402 apenas transporta essa aprovação real. PR413 exige sf/static-and-contracts; wrappers validam wiring, não substituem execução canônica de typecheck/guards.
8. Atualizar resultados de A/B: A3 run44665621967 ainda em andamento; B acrescentou fixture Chrome/enrollment após primeiro C03invalidURL, aguardar run terminal informado por B. Não duplicar gates de outras sessões.
9. Compor merges qualificados e rederivar inventário/plano atual para verificação final1–8, registrando mudança de partição413. Sem sf-ci. Pin diagnóstico precisará proveniência real se result-store mudar por414/438; não forjar digest. Unbound não equivale a entrega verde.

## Decisões e justificativas

- Mantidos console descomissionado e runtime/application.ts intacto. Nenhuma navegação à porta proibida. Fixtures novas pertencem ao host nativo, porta0, identidade criptografada original, comandos reais eSQLite.
- Sem reduzir asserções/controles, inventar baseline/coverage/digest/GO ou aumentar prazos.
- PinC8 tem cadeia de proveniência do produtor real; AM02 compara exatamente seis efeitosC08 idempotentes e mantém snapshot completo/última revogação.
- Memória Atlas cria nova observação após consumo, verificando novamente fonte/C08; não retag de token gasto. BI cache contém prova completa original no escopo real, nunca autoridade global.
- A aprovação dos guards é decisão humana efetiva e verificável. Não foram aplicados labels de aprovação. Resolver valida snapshot único, blobrequest original, PR/head/base/labels/permissões atuais e repete verificação antes de transmitir; falhafecha. Basesorigin/dev ePRreal mantidas.
- Se mesmo ponto falhar2x, parar essa causa e registrar unbound; mudança posterior exige causa concreta distinta. Não há rerun idêntico para obter número melhor.

## Como retomar

Ler este HEAD de sf-shard-c e PR397, depois os handoffs atuais A/B e os Actions. Priorizar gates ativos e revisar as fatias concretas pendentes; consultar também os PRs423/424/426/438/440 e o PR isolado de testes C qualificados. Para criar snapshot: obter tree do source; acrescentar somente .ci-run.json; criar commit filho do source; só então criar branch ci-run-linux-*. Testes/dados do snapshot precisam já estar no source causal. Publicar evidencia terminal antes de merge para sf-join-four. Não escrever nos quatro branches proibidos.

## Comandos e resultados

Nenhum comando foi executado em shell. Requisições Actions usam package sucafina,directory modules/sucafina,runnerbun,args[--timeout,30000,...caminhos],envOmni=1. A forma literal SF_SUITE_ID/SF_SHARD_INDEX/SF_SHARD_COUNT não é aceita pelo validador da base; a enumeração inicial derivou suites.json +SHA256(path)mod8 e branchesci-run-linux-*. Seleção inicial883arquivos:113,107,99,118,119,109,103,115. Depois #413 introduziu script/sf-ci/shard-plan.mjs com LPTdeterminístico e cobertura/disjunção completas do manifesto atual. Custos históricos parciais são heurística, não recibo de cobertura. Derivar a partição final da árvore real; não chamar sf-ci.
- bun typecheck canônico: exit0 no44654714455; antes21erros reais da fixture.
- check:guards --base origin/dev: resultado original2GATE,194WARN,0errors. Sem posteriorPASSreal; aprovação específica ainda pendente.
- Testes de transporte de aprovação:59/0 no44658251806, sem efeitos de aprovação.
- sf-ci: nunca executado.
- Merges próprios qualificados: 399/398/404/401/402/400/409/411/415/417/412/421/422/430/406/432/427/428/437 em sf-join-four; SHAs acima. Outros merges da sessão de integração devem ser consultados no handoff sf-continuation.

## Apêndice — última enumeração completa A1/A2

Prefixo: modules/sucafina/Sucafinav1/test/. A1 run44657265518:576pass29fail; cada linha abaixo é um caso, não contagem de marcadoresduplicados. Os apêndices seguintes conservam a enumeração inicial para auditoria.

| # | Shard | File:line | Causa / estado |
| --- | --- | --- | --- |
| 1 | 1 | runtime-http.test.ts:146 | browser45s; migração Cfdbf7c7 gate44668010002=3/1,26expects;Chromeconectou; investigação concreta pendente |
| 2 | 1 | parity-polling-browser.test.ts:10 | console retirado |
| 3 | 1 | business-browser.test.ts:22→49 | formulário retirado |
| 4 | 1 | business-browser.test.ts:210 | duas abas do console retirado |
| 5 | 1 | product/wp13/source-scenario.test.ts:32 | timeout180s |
| 6 | 1 | product/installed-bi-closure/temporal-contract.test.ts:12 | deadline165s |
| 7 | 1 | product/installed-bi-closure/temporal-contract.test.ts:69 | deadline165s; stack61 é cleanup |
| 8 | 1 | product/wp12/native-execution-portfolio.test.ts:14→native-portfolio-preparation.ts:150 | oraclebaselineC04 |
| 9 | 1 | product/wp12/native-execution-portfolio.test.ts:134→native-portfolio-preparation.ts:150 | oraclebaselineC04 |
| 10 | 1 | product/wp01/workbench-analysis.test.ts:144 | fixture nativa Cf2e13d29f9238a736dab23fc3b0ac26201790327 +parser440 prontos para gate |
| 11 | 1 | product/wp01/workbench-analysis.test.ts:380 | PR428mergeado;gate44667507711=3/0,25expects;fence403preservado |
| 12 | 1 | product/c12-receipt-recovery/recovery-ui.test.ts:72 | rótulo Retrysameapplication ausente,UIreativaApply |
| 13 | 1 | product/c12-receipt-recovery/recovery-ui.test.ts:197 | recoveryseletor/decision-recover após200perdido |
| 14 | 1 | product/wp02/host-workbench.test.ts:147 | HTMLretirado |
| 15 | 1 | product/wp02/host-workbench.test.ts:280 | conflictdraftlegado |
| 16 | 1 | product/wp02/host-workbench.test.ts:468 | revogaçãoconsolelegado |
| 17 | 1 | product/wp10/integration/bi-fallback-lifecycle.test.ts:49 | redirectBIlegado |
| 18 | 1 | product/wp10/integration/analysis-stale-calculation.test.ts:303 | unavailablevsactualhistorical |
| 19 | 1 | product/wp10/integration/analysis-stale-calculation.test.ts:346 | injeçãoprivatereadnãochamada |
| 20 | 1 | product/wp10/integration/analysis-stale-calculation.test.ts:410 | injeçãoadmissãoprivadanãochamada |
| 21 | 1 | product/wp10/integration/public-state.test.ts:49 | C2a71e601native;gate44668708981=3/0,25expects;privacidade e armazenamento intactos |
| 22 | 1 | product/wp10/analysis-composition/alternative-selection.test.ts:456 | guardexternodeniedapósrevogação,wrapperesperavaok |
| 23 | 1 | product/wp10/analysis-composition/alternative-selection.test.ts:573 | annualdeadline105s;draft:58571.161s |
| 24 | 1 | product/wp10/analysis-composition/alternative-selection.test.ts:606 | annualdeadline105s;draft:61849.286s |
| 25 | 1 | product/wp06/documents/ws3-rejection.test.ts:65 | PR427mergeado;gate44667039756=2/0,54expects;stale409real |
| 26 | 1 | product/review-fixes/procurement-apply/refusals.test.ts:29 | estágioindisponível403vsoracle400 |
| 27 | 1 | product/review-fixes/procurement-apply/refusals.test.ts:59 | seedLegacyChangemissingconfirmedfalse |
| 28 | 1 | product/review-fixes/procurement-apply/refusals.test.ts:96→preparationInput:122 | missingconfirmedfalseantesmixedmutation |
| 29 | 1 | product/integrated-proofs/am04/receipt-key-collision.test.ts:53 | probeC08novarequestsemlease;colisão55–60nãoalcançada |
| 1 | 2 | product/wp05/sensitivity-integration.test.ts:9→browser.ts:9 | Chrome180s+error; driverNodefocadoCverde,semqualificaçãodofull |
| 2 | 2 | product/wp12/native-execution-collaboration-recall.test.ts:143 | timeout120s |
| 3 | 2 | product/wp10/integration/bi-call-scope.test.ts:402 | chooserBI;C8e71e07aguardagate |
| 4 | 2 | product/wp10/memory-integrity/revocation-tail.test.ts:87 | Atlas398focadoverde;ausentenestesnapshot |
| 5 | 2 | product/wp10/memory-integrity/revocation-tail.test.ts:104 | Atlas398focadoverde;ausentenestesnapshot |
| 6 | 2 | product/wp10/memory-integrity/revocation-tail.test.ts:124 | Atlas398focadoverde;ausentenestesnapshot |

A2 latest44661562191:508pass6fail,1skip1error,9142expects1791.93s; o executivo passou após2ee5e961. O skiplocal-backups.test.ts:209 épreexistente. Nenhuma subtração de testes focados foi usada para essas contagens.

## Apêndice — evidência original detalhada de C7/C8

O trecho seguinte preserva o diagnóstico da enumeração inicial. Seus estados unbound e pendências são históricos; o mapa atualizado e os gates acima prevalecem.

### C7.1 — preparação / autoridade

O log vai de 00:35:49.585Z a 00:40:49.687Z, aproximadamente 300,10 s. `apps/cli/src/sucafina-product/analysis-http.ts:59–60` aguarda `runtime.inputs.prepare` e reautoriza o mesmo contexto; `product/integration/ui-authority.ts:45` aplica validade de cinco minutos, e `human-authority.ts:44–45` exige a autoridade atual. Há evidência forte de expiração durante a preparação, sem localização do custo interno. Não ampliar lease, manipular relógio ou fabricar aprovação. A investigação do produtor exige fatia `shared:` se houver alteração fora de test/**.

### C7.2 — seleção de período / campos

A fixture usa projetos correntes observados em 2026 como fontes de 2027 (`native-execution-dependencies.test.ts:53–56`). `product/dashboard/scope.ts:15` recusa esses snapshots fora do período observado; `product/dashboard/sources.ts:124–126` não transforma o array `milestones` em campo escalar. A projeção `milestoneDates` de 2027 perde `status` em `dashboard/scope.ts:30`, enquanto `apps/cli/src/sucafina-product/analysis-dependency-readers.ts:79–84` exige data, nome e estado confirmados. Uma troca isolada do ano ou dos campos não resolve a fixture. Retomar com projeto e marco coerentes com a observação, horizonte financeiro explícito e controles de homônimo, identidade, data e FTE preservados.

### C7.3 — integração da resposta Planner

O teste emite fonte Planner em `test/product/wp12/native-question-preparation.ts:50–59`, cria suporte/thread e lê resposta em `native-execution-questions.test.ts:281–289`. `product/collaboration/dispatch.ts:49–50` consulta `answerReuse.read`; `answer-reuse.ts:120–121` exige escopo válido mesmo antes de confirmar a resposta. `collaboration/host.ts:257–263` só tem fallback Dashboard quando `resolveAnswerScope` está ausente. A composição em `apps/cli/src/sucafina-product/business-services.ts:202–219` não fornece esse resolvedor, embora o observador de confirmação suporte Planner em `:192–198`. Diagnóstico estático forte; o erro observado omite o motivo interno. Retomar no produtor compartilhado mantendo manifest, fonte, dependências e fences de confirmação. Não trocar a fonte para Dashboard para obter verde.

### C7.4 — BI09, antes do browser

Nos dois casos, o timeout nasce em `test/product/wp10/integration/composition-test-deadline.ts:5:29`. No primeiro, `comparison.persist` leva 42.519 ms; `BI09.dispatch` inicia em 51.507 ms e retorna abortado em 105.032 ms. No segundo, comparação leva 41.373 ms; dispatch inicia em 48.600 ms e retorna abortado em 105.002 ms. Nenhum `browser.bundle` ou `browser.launch` foi alcançado. A fixture já usa horizonte de um mês e produtores reais; `apps/cli/src/sucafina-product/bi-services.ts:162–168` já usa `callScope.run`. Não há suboperação culpada comprovada; instrumentar a composição em fatia própria antes de corrigir, sem ampliar o prazo ou reduzir provas.

### C7.5 — consumidores do console morto

`runtime/application.ts:58–61` define o 404 `legacy console decommissioned — use /`; `:94–95` o aplica aos GETs HTML antigos. O teste de importação pede `page=IT+Risks` e exige 200; o teste de browser pede `page=OPEX+Detail&year=2026` e espera o formulário `save-entry`/botão Edit. O browser conecta e encerra normalmente neste caso. A falha não prova defeito dos produtores JSON/DOCX, pois esses passos não foram alcançados. Retomar migrando os consumidores para o host nativo com importação, conflito, rascunho, confirmação, foco e navegação preservados; não recriar o console nem editar o runtime proibido.

### C7.6 — cache / observação Atlas

`product/decision-memory/case-recall.ts:66` classifica e `:79` repete a classificação para confirmar o resultado. `product/host-binding/atlas-memory.ts:28–35` consome a marca privada de observação; `cloneSfAtlasRecallResult:41–45` só mantém a associação enquanto ela existe. `apps/cli/src/sucafina-product/memory-case-read-scope.ts:314–319` reutiliza o valor cacheado na segunda classificação. O log é consistente: uma leitura canônica Atlas concluída, `memory.prepare` em cerca de 12,952 s e `aborted:false`; o resultado observado é `analysis-source-unavailable`. Classificação estática forte, sem fix validado. Retomar renovando a observação canônica após consumo, mantendo o bloqueio de observações fabricadas/reutilizadas.

### C7.7, C7.9 e C7.10 — correções restritas a testes

- **Atlas:** o estado sem evidência passou a ser controle negativo explícito; restaurar o resolver real permite verificar o mesmo recibo durável com scanner offline. Nenhuma asserção anterior foi retirada. Gate 1/0, 37 asserções, 19,47 s; controle Omni real passou com 2 spawns e zero delegações.
- **Observação Planner:** a quarta revalidação da chamada anterior remove a admissão em `ui-authority.ts:32`; `requestFor:70–72` retorna undefined e `planner-sources.ts:45–46` recusa antes do próximo callback. O fix prova essa ausência, exige o motivo exato da negação e zero transações/autenticações/revalidações/leitura preparada, mantendo ABA, egress, abort e estado durável. Gate 2/0, 27 asserções, 529 ms.
- **AM02:** `source-lifecycle.ts:57–65` preserva incarnation/versão para fonte, escopo e digest intactos. `native-capabilities-fixture.ts:296–302` reabre o mesmo banco e troca host/geração, sem alterar a fonte. As referências devem continuar iguais; a autoridade se renova por novas sessões e recibos. As asserções de bindings antigos negados e novas sessões passaram no gate; a igualdade global posterior ainda falha conforme registrado acima.

### C7.8 — gate estático, evidência integral

O teste excedeu 120 s. O log contém, inclusive após o timeout do teste, os resultados dos comandos reais:

- `WORK_REUSE_TYPECHECK 2`: **21 diagnósticos** em `test/product/operations-installed-finish/private-admission.check.ts`. Raiz de API desatualizada: chamada sem await e parâmetros `principalRef/readOnly` em `:66–72`; a factory atual em `packages/app-shell/e2e/sucafina/operations-support/installation.ts:29–42` é assíncrona e exige `operators`/`isAuthenticated`; `:150–156` devolve contribuições/discovery/services/application, sem o antigo dispose. Corrigir só await não migra o lifecycle e os comandos legados.
- Diagnósticos: TS2353 `:67:47`; TS2339 `:72:44, :80:41, :121:39, :145:30, :147:12, :159:11, :161:80, :162:54, :175:12, :180:12, :180:131, :184:12, :185:54, :196:11, :199:49`; TS7006 `:159:55, :159:65, :180:58, :196:57, :196:67`.
- `WORK_REUSE_GUARD_BASE 0`: fetch de `origin/dev` concluído.
- `WORK_REUSE_GUARDS 1`: **78 regras, 6.183 paths alterados, 2 gate, 194 warn, 0 errors**. Gates em `godfile-waivers.json` e `script/spawn-allowlist.json`, protegidos e já diferentes de `origin/dev` na base de integração. Esses arquivos não foram alterados pela sessão C.
- Não foi fabricado `GUARDRAIL_APPROVED`, acrescentada label nem alterada regra protegida. O resultado “0 errors” não significa guard verde: há dois gates sem aprovação observada.


## Shard 8 — mapa por causa

### C8.1 — identidade do produtor desatualizada: corrigida e validada

- Falha: `test/product/canonical-read-cost/diagnostic-cost.test.ts:13:26`.
- Pin anterior de `product/host-binding/state-provider.ts`: `ba10043704bbb1a25eb0f4a8edddcdca814ec7610157bc7c4d9d88d2970467f5`.
- Bytes atuais na base: `bf0a5639bd41f903c67a89096b733269fbcd9eaf25392dde8c062fdcc13434c1`.
- Proveniência: [c00b150b48f576a79a7c8b33f15c4fb55d72dfd1](https://github.com/gustavomhss/Orchestra-SF/commit/c00b150b48f576a79a7c8b33f15c4fb55d72dfd1), cujo pai é `2682f82da2650314e3437ab48b5c65e52c5b3fe4`, acrescentou `preferences`/`receipts` à união de tipos e à admissão de `selectSfNamespaceHealth`, nas linhas 39–40. Recomputação SHA256 dos arquivos obtidos do GitHub confirmou ambos os hashes. Aplicar somente essas duas alterações ao arquivo do pai reproduz integralmente os bytes atuais.
- Fix restrito a `modules/sucafina/Sucafinav1/test/product/canonical-read-cost/diagnostic-expected.ts`: um pin e seu comentário de proveniência. Os demais pins, teste, probe, recibo histórico e revisão histórica permanecem intactos.
- Gate executou `diagnostic-cost.test.ts` e `native-ui-contract/namespace-health.test.ts`. Os controles de autoridade original, autoridade incorreta, revogação e ausência de conteúdo privado passaram.
- O diagnóstico mede trabalho real; ele não contém asserção de teto numérico de custo. Esse verde confirma a execução com a identidade correta e controles existentes, sem demonstrar melhoria de desempenho nem qualificar P03.

### C8.2 — clique no chooser e cleanup pendente: unbound

- Falha primária: `test/product/wp05/planner-origins.test.ts:83:77`, origem B do BI03. O locator encontrou o botão correto, visível, habilitado e estável; o clique travou em “scrolling into view if needed” e excedeu 10 s.
- Falha secundária de encerramento: `test/product/wp05/browser.ts:61` aguarda `fixture.dispose()`/`browser.close()` sem deadline depois de cancelar o timer. O log não registra fechamento/desconexão desse browser antes do timeout externo de 180 s.
- Linha do tempo do run atual: BI02 concluiu entre 00:37:33.498Z e 00:37:35.719Z; BI03 começou às 00:37:36.131Z; origem A passou por mouse, foco, teclado e tabela; origem B começou às 00:37:36.935Z; o erro de clique foi registrado às 00:37:46.976Z; timeout externo às 00:40:33.426Z.
- Contraprova histórica: [run 44590270877](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44590270877), job 135794077900, snapshot `f85c4ca344ee0a064d6f9a422f6d55d4c4b8dba2`, fix [b32a7a1fc9f9280aa54ca1708fe8764ef48c5ae6](https://github.com/gustavomhss/Orchestra-SF/commit/b32a7a1fc9f9280aa54ca1708fe8764ef48c5ae6) / PR #376: **1 pass / 0 fail**, 178 asserções, 23,37 s.
- Blobs idênticos entre esse snapshot e a base atual: `product/analytics/view.ts`, `product/analytics/source-navigation.ts`, `test/product/wp05/browser.ts`, `test/product/wp05/planner-origins.test.ts` e `test/product/wp03/planner-fixture.ts`.
- Runner image observada: verde histórico `ubuntu-24.04 / 20261116.376.1`; shard atual `ubuntu-24.04 / 20261111.370.1`. A diferença não estabelece causa. O verde histórico não é transferido ao shard atual.
- Nenhuma troca de mouse por teclado, clique forçado/JavaScript, ampliação de timeout ou alteração de foco foi realizada. Corrigir só o cleanup não demonstraria solução para o clique. Sem fix causal concreto, não foi gasto rerun idêntico.


## Apêndice — falhas originais A/B com file:line

Diagnóstico original; correções e estados atuais estão no agregado e nos handoffs dos responsáveis.

## Falhas A/B — evidência da primeira leitura

Os mapas abaixo registram o comportamento observado, com classificações preliminares. Não atribuem correção de causa raiz às sessões A/B. Linhas de declaração são identificadas quando um timeout não fornece stack da instrução bloqueada.

### Shard 1 — enumeração A interrompida

[Run 44646013868](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44646013868), snapshot `a4bbf6b042526a0ee3f544243cfa67158236f871`, job 135988658580: **cancelled, N/D pass /N/D fail finais**. O log interrompido mostra 557 eventos pass,21 fail e0 skip, com102 dos113 arquivos iniciados; não há resumo Bun nem erro não tratado entre testes observado. Esses eventos não são o resultado final do shard. Último arquivo ativo: `test/product/wp10/analysis-composition/alternative-selection.test.ts`. O log diz “The operation was canceled”, e a API encerrou o run às01:13:00Z. Não foi inferida autoria de cancelamento. Classificações abaixo são preliminares; paths relativos a `modules/sucafina/Sucafinav1/test/`.

| Falha (file:line) | Causa observada / unbound |
| --- | --- |
| `runtime-http.test.ts:169:55` | Add risk não encontrado em30s; seletor/fluxo legado |
| `business-browser.test.ts:22:26` | ERR_CONNECTION_REFUSED em localhost:4110 Settings; dependência legada de porta fixa |
| `business-browser.test.ts:210:16` | ERR_CONNECTION_REFUSED em localhost:4110 Suppliers |
| `parity-polling-browser.test.ts:10:16` | ERR_CONNECTION_REFUSED em localhost:4110 Settings |
| `product/installed-bi-closure/temporal-contract.test.ts:12:7` | Deadline165000 ms; BI10/BI09; custo interno unbound |
| `product/installed-bi-closure/temporal-contract.test.ts:61:151` | Deadline165000 ms; persistência Portfolio retorna abortada |
| `product/wp02/host-workbench.test.ts:147:16` | Falha HTTP em /sucafina/auth/local; status exato não impresso |
| `product/wp02/host-workbench.test.ts:280:16` | Falha HTTP em /sucafina/auth/local |
| `product/wp02/host-workbench.test.ts:468:16` | Falha HTTP em /sucafina/auth/local |
| `product/wp13/source-scenario.test.ts:32 (declaração)` | Timeout180000 ms; await interno não localizado |
| `product/c12-receipt-recovery/recovery-ui.test.ts:72:17` | Retry same application não visível em30s |
| `product/c12-receipt-recovery/recovery-ui.test.ts:197:57` | [data-recover-change]:enabled não visível em30s |
| `product/wp12/native-execution-portfolio.test.ts:14; product/wp12/native-portfolio-preparation.ts:150:26` | Total esperado null, recebido 240000; portfolio |
| `product/wp12/native-execution-portfolio.test.ts:134; product/wp12/native-portfolio-preparation.ts:150:26` | Total esperado null, recebido 240000; sensitivity |
| `product/wp01/workbench-analysis.test.ts:144:27` | Prepare HTTP200 esperado, recebido 400 |
| `product/wp01/workbench-analysis.test.ts:380:27` | Após alteração de acesso: HTTP403 esperado, recebido 200; preservar negativo |
| `product/wp10/integration/public-state.test.ts:49:28` | GET Dashboard legado esperado 200, recebido 404 |
| `product/wp10/integration/bi-fallback-lifecycle.test.ts:49:16` | Falha HTTP em /sucafina/auth/local |
| `product/wp10/integration/analysis-stale-calculation.test.ts:303:28` | scoped.state esperado unavailable, recebido historical |
| `product/wp10/integration/analysis-stale-calculation.test.ts:346:10` | Preflight esperado denied/analysis-stale-access-unavailable, recebido ok com sourceFence |
| `product/wp10/integration/analysis-stale-calculation.test.ts:410:23` | Flag de injeção fired esperada true, recebida false |

### Shard 2 — enumeração A

[Run 44646018333](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44646018333), snapshot `dcb0c68d7e866b4df2153eadd26fda2eab45b266`, job 135988673159: **504 pass / 10 fail**, mais **1 skip e 1 error**, 515 testes em 107 arquivos, 2.278,24 s. O skip existente é `test/local-backups.test.ts` (root estrangeiro exige privilégios de fixture). O erro não tratado é o timeout tardio de Chromium; não constitui um décimo primeiro teste falho. Classificação preliminar pela evidência do log, sem fix A validado nesta leitura.

Paths desta tabela relativos a `modules/sucafina/Sucafinav1/test/product/`, salvo `runtime/local-store.ts`, relativo a `modules/sucafina/Sucafinav1/`.

| Falha (file:line) | Causa observada / unbound |
| --- | --- |
| `mixed-source-contracts/recorded-fallback.test.ts:11:7` | Deadline cooperativo165s; custo interno unbound |
| `wp08/thread-period-continuity.test.ts:17` | Hot Topic day excede30s; declaração parametrizada, await interno não localizado |
| `wp05/sensitivity-integration.test.ts:9; wp05/browser.ts:9:34` | Timeout180s; Chromium launch falha em fixture-setup, erro não tratado tardio; stack também teste:43:9 |
| `operations-fixes/document-search.test.ts:5; runtime/local-store.ts:55:16` | SQLITE_IOERR na abertura SQLite; storage/fixture/auth |
| `wp12/native-execution-collaboration-recall.test.ts:143` | Timeout120s, duração reportada286,487s; ponto interno unbound |
| `wp12/native-execution-executive.test.ts:213:31` | Esperava unavailable/analysis-source-unavailable; recebeu denied/case-selection-unavailable |
| `wp10/integration/bi-call-scope.test.ts:402:56` | BI retornou sem drilldown de registro Planner |
| `wp10/memory-integrity/revocation-tail.test.ts:87:22` | Positivo producer.prepare indisponível; possível família observação Atlas, não comprovada neste teste |
| `wp10/memory-integrity/revocation-tail.test.ts:104:29` | Positivo verifier.verify indisponível antes da revogação |
| `wp10/memory-integrity/revocation-tail.test.ts:124:29` | Positivo verifier.verify indisponível antes da aceitação/revogação |

### Shard 4 — enumeração B completa

[Run 44645900692](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44645900692), snapshot `dd45d888617943df40e02815d58b59f88d8a18f7`, job 135988262742, attempt 1: **497 pass /14 fail**,511 testes/118 arquivos,2.480,75s. O estado transitório queued foi o cleanup, não um rerun. Classificação preliminar sem fix B validado nesta leitura. Paths relativos a `modules/sucafina/Sucafinav1/test/product/`; o produtor `product/integration/product-authority.ts` é relativo à raiz Sucafinav1.

| Falha (file:line) | Causa observada / unbound |
| --- | --- |
| `wp13/handoff-persistence.test.ts:95:29` | Preparação: esperado ok, recebido stale; validade de escolha |
| `wp13/coverage-sensitivity-integration.test.ts:115:109` | Verificador aceitou objeto alterado após validação final: esperado false, recebido true; integridade de egress |
| `wp13/handoff-domain-integration.test.ts:392:39 (chamador :65:93)` | Canonical Procurement preparation unavailable |
| `wp13/handoff-c08-predispatch.test.ts:242:200` | Retomada: esperado ok, recebido conflict; idempotência |
| `wp13/handoff-canonical-integration.test.ts:176:200` | Retomada: esperado ok, recebido conflict; idempotência |
| `proof234/am04-c12-return.test.ts:78:18; c12-receipt-recovery/consumer.ts:81:43` | Authoritative receipt namespace unavailable |
| `wp12/native-execution-reevaluation.test.ts; wp12/native-portfolio-preparation.ts:150:26` | Total esperado null, recebido 240000; contrato de total/cobertura |
| `wp12/native-execution-purchase.test.ts (pending); wp12/native-procurement-preparation.ts:193:43` | Total esperado null, recebido 240000; contrato de total/cobertura |
| `wp12/native-execution-purchase.test.ts (complete); wp12/native-procurement-preparation.ts:193:43` | Total esperado null, recebido 240000; contrato de total/cobertura |
| `wp07/browser-ui.test.ts:45:41 (captura :500:21)` | Erro HTTP em /sucafina/auth/local; entrada legada |
| `ui-split/ui-source/draft-replay.test.ts:32:27` | Replay esperado 200, recebido 403; autorização |
| `ui-split/ui-work/guards.test.ts:23:18` | Guards exit 1, base0; arquivos protegidos |
| `integrated-proofs/am01/portfolio-recall-proof.test.ts:19 (declaração; budget :148)` | Timeout240000 ms sem stack do await interno |
| `integrated-proofs/am01/recall-five-profiles.test.ts:31:25; product/integration/product-authority.ts:77:15` | SF_PRODUCT_AUTHORITY_CONFIG_INVALID; configuração de autoridade |

### Shard 5 — enumeração B interrompida

[Run 44645913808](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44645913808), snapshot `f0bccdc48b42a9d000f3bda6565fa3d88286c845`, job 135988306632, attempt 1: **cancelled, N/D pass /N/D fail**. Não existe resumo Bun final. Foram observadas **20 falhas parciais**, listadas abaixo; esse número não substitui o total do shard. Job iniciou 00:26:45Z, Run tests cancelou 01:11:58Z, run encerrou 01:12:15Z. Intervalo compatível com timeout-minutes45 de `.github/workflows/test-ci.yml:25`, mas log só informa “The operation was canceled”; não há autoria de cancelamento exposta. Última fase: `planner-calculation.overlapping-revocation`, iniciando recall real do Atlas. Paths relativos a `modules/sucafina/Sucafinav1/test/product/`.

| Falha (file:line) | Causa observada / unbound |
| --- | --- |
| `installed-bi-closure/sensitivity-history.test.ts:19:11 (omitted)` | Deadline cooperativo165000 ms; custo de sensibilidade |
| `installed-bi-closure/sensitivity-history.test.ts:19:11 (confirmed)` | Deadline cooperativo165000 ms; custo de sensibilidade |
| `installed-bi-closure/sensitivity-history.test.ts:66:6` | Deadline165000 ms; histórico de escolha após treinamento |
| `similarity217/installed.test.ts:53:29 (AC01/02)` | ok→unavailable; recall/similaridade Atlas |
| `similarity217/installed.test.ts:99:29 (AC05)` | ok→unavailable; fonte histórica |
| `similarity217/installed.test.ts:137:28 (AC06/07)` | ok→unavailable; autoridade de atores |
| `wp12/native-execution-bi.test.ts:85:149 (sf_finance)` | Predicado true→false; evidência de BI |
| `wp12/native-execution-bi.test.ts:85:149 (sf_maestro)` | Predicado true→false; evidência de BI |
| `wp11/source-promotion-coverage.test.ts:182:67` | Igualdade da prova de cobertura diverge |
| `wp01/planner-monthly.test.ts:44:17` | Erro HTTP em /sucafina/auth/local; entrada legada |
| `wp00/contract-freeze.test.ts:19:72` | Digest de contrato versus freeze diverge; requer proveniência, sem re-pin especulativo |
| `wp10/integration/portfolio-promotion.test.ts:227:68 (fixture :43:14)` | Deadline cooperativo285000 ms; cobertura/autoridade |
| `wp10/integration/review-portfolio-http.test.ts:271:38` | Recusa esperada denied, recebida unavailable |
| `wp10/integration/review-portfolio-http.test.ts; wp10/integration/review-access-browser-fixture.ts:29:45` | WP10_REVIEW_BROWSER_TRANSPORT_DEADLINE10000 ms |
| `wp10/integration/bi-lifecycle.test.ts:202:33 (shell/refresh/sign-out)` | Erro HTTP de enrollment /sucafina/auth/local |
| `wp10/integration/bi-lifecycle.test.ts:202:33 (chamador :249:34)` | Erro HTTP de enrollment; resultado retido/revogação |
| `wp10/integration/bi-lifecycle.test.ts:202:33 (chamador :286:11)` | Erro HTTP de enrollment; limpar seleção |
| `wp10/integration/bi-lifecycle.test.ts:202:33 (chamador :315:29)` | Erro HTTP de enrollment; retorno da fonte |
| `wp10/integration/portfolio-exact-threshold.test.ts:43:19 (helper :213:41)` | denied/criterion-result-access-unavailable |
| `wp10/integration/planner-calculation.test.ts:615:58` | Recall Atlas esperado comprimento1, recebido 0 |


## Falhas observadas — shard 3

Prefixo: `modules/sucafina/Sucafinav1/test/`. Job136006716047 cancelled; cleanup136025186224 success. São255 marcadores PASS e21 FAIL; não há resumo final, marcador skip/todo nem Unhandled error. O grande HTML/diff pertence à falha procurement-integration:180, sem falha adicional oculta.

| File:line | Classe | Evidência / próximo passo |
| --- | --- | --- |
| `io-browser.test.ts:26` | unbound/UI legado | ERR_CONNECTION_REFUSED em :4110; primeira jornada. |
| `io-browser.test.ts:114` | unbound/UI legado | ERR_CONNECTION_REFUSED em :4110; segunda jornada. |
| `visual-layout.test.ts:37` | unbound/UI legado | POST ECONNREFUSED no serviço legado; caso declarado em :15. |
| `product/wp05/procurement-integration.test.ts:180` | falso positivo de fixture | O sentinel privado `hidden` colide com o atributo HTML legítimo `<fieldset hidden>`. A projeção e a seleção anteriores passaram. Próxima fatia: sentinel inequívoco no seed e em todos os checks, mantendo data privada e revogação. |
| `product/wp13/sensitivity-units-boundary.test.ts:54` | timeout/desempenho | Timeout Bun de 30000ms; duração observada de 74999ms, após replay-ready em ~73119ms. Await caro não isolado; manter orçamento. |
| `product/wp13/persistence-recovery.test.ts:21` | timeout/desempenho | Timeout Bun de 30000ms; duração de 31236ms na segunda variação portfolioRecovery(after). Await exato não isolado. |
| `product/operations-fixes/c12-concurrency.test.ts:34` | oracle C12 desatualizado | Esperado409, recebido200. A fixture altera só objective/version após receipt; apply.ts:125–162 reconcilia edits não relacionados e mantém fences de choice/change. Migrar a contraprova inteira, sem apenas trocar409 por200. |
| `product/operations-fixes/c12-concurrency.test.ts:103` | oracle C12 desatualizado | Mesma causa do caso anterior. O teste para antes de provar retry/reload; preservar controles de receipt e autorização. |
| `product/installed-bi-closure/numerical-coverage.test.ts:20` | timeout/desempenho | Caso omitted: deadline de165000ms em advantage.persist, após comparison.persist custar ~112–125s. Não há falha numérica comprovada. |
| `product/installed-bi-closure/numerical-coverage.test.ts:20` | timeout/desempenho | Caso confirmed: deadline de165000ms em advantage.persist, após comparison.persist custar ~112–125s. Não há falha numérica comprovada. |
| `product/installed-bi-closure/numerical-coverage.test.ts:20` | timeout/desempenho | Caso zero: deadline de165000ms em advantage.persist, após comparison.persist custar ~112–125s. Não há falha numérica comprovada. |
| `product/installed-bi-closure/numerical-coverage.test.ts:20` | timeout/desempenho | Caso null: deadline de165000ms em advantage.persist, após comparison.persist custar ~112–125s. Não há falha numérica comprovada. |
| `product/wp12/native-execution-bi-kpi.test.ts:312` | oracle de URL legado | HTTP200 e links autorizados; teste busca Budget+Overview/Budget%20Overview. apps/cli/src/sucafina-product/extended-source-links.ts:55–78 produz /orchestra/sf-dashboard/budget com year. Migrar URL/origin/ano mantendo proveniência, isolamento e reload. |
| `product/wp12/native-execution-bi-public-selection.test.ts:326` | oracle de URL legado | Mesma migração de rota Budget Overview para /orchestra/sf-dashboard/budget. Manter seleção pública, isolamento de caso e consumidores reais. |
| `product/bi-cost-waterfall/presentation.test.ts:17` | timeout/desempenho | Deadline cooperativo de105000ms em BI09.dispatch; não elevar orçamento nem atribuir a cleanup lento. |
| `product/bi-cost-waterfall/presentation.test.ts:66` | timeout/desempenho | Deadline cooperativo de105000ms em BI09.dispatch; não elevar orçamento nem atribuir a cleanup lento. |
| `product/bi-cost-waterfall/presentation.test.ts:97` | timeout/desempenho | Deadline cooperativo de105000ms em BI09.dispatch; não elevar orçamento nem atribuir a cleanup lento. |
| `product/bi-cost-waterfall/presentation.test.ts:113` | timeout/desempenho | Deadline cooperativo de105000ms em BI09.dispatch; não elevar orçamento nem atribuir a cleanup lento. |
| `product/bi-cost-waterfall/presentation.test.ts:133` | timeout/desempenho | Deadline de105000ms em portfolio.persist, após portfolio.select de ~49.5s. Custo de composição; não prova de erro numérico. |
| `product/bi-cost-waterfall/presentation.test.ts:242` | timeout/desempenho | Deadline de105000ms em BI10.dispatch; manter orçamento e asserções. |
| `product/wp00/baseline-corpus-coverage.test.ts:60` | unbound/inventário documental | docs/product-campaign/wp00/oracles/journeys-j01-j08.json não fornece fixtureBindings nem executionStatus nos8 registros. Não fabricar NOT_RUN/bindings. Eventual mudança documental exige evidência real e PR shared:. |

O último arquivo `product/wp08/review-answer-confirmation.test.ts` teve5 PASS e foi interrompido no sexto caso, `:228`, após `current-lease reply-denied-at-last-human-await`. Não contar essa interrupção como falha emitida.

### Arquivos não iniciados no shard 3

Caminhos relativos a `modules/sucafina/`:

- `Sucafinav1/test/product/c12-receipt-recovery/normal-retry.test.ts`
- `Sucafinav1/test/product/reports-draft-reconciliation/installed-read-integrity.test.ts`
- `Sucafinav1/test/product/review-fixes/finance-resume-performance/journey-phase.test.ts`
- `Sucafinav1/test/product/review-fixes/import-recovery/apply-restart.test.ts`
- `Sucafinav1/test/product/ui-split/ui-source/static-checks.test.ts`
- `Sucafinav1/test/product/ui-split/ui-work/static-gates.test.ts`
- `Sucafinav1/test/product/wp02/backup-consumer.test.ts`
- `Sucafinav1/test/product/wp02/keyed-update.test.ts`
- `Sucafinav1/test/product/wp02/kpi-comparison.test.ts`
- `Sucafinav1/test/product/wp02/prepared.test.ts`
- `Sucafinav1/test/product/wp02/review-completion.test.ts`
- `Sucafinav1/test/product/wp02/signals.test.ts`
- `Sucafinav1/test/product/wp02/workbench-recovery.test.ts`
- `Sucafinav1/test/product/wp06/documents/resolver.test.ts`
- `Sucafinav1/test/product/wp06/imports/dashboard-backup-e2e.test.ts`
- `Sucafinav1/test/product/wp06/imports/end-to-end.test.ts`
- `Sucafinav1/test/product/wp06/imports/planner-roundtrip-runtime.test.ts`
- `Sucafinav1/test/product/wp06/imports/roster-runtime.test.ts`
- `Sucafinav1/test/product/wp06/imports/sqlite-planner.test.ts`
- `Sucafinav1/test/product/wp08/answer-reuse.test.ts`
- `Sucafinav1/test/product/wp08/case-selection-cas.test.ts`
- `Sucafinav1/test/product/wp08/collaboration-journey.test.ts`
- `Sucafinav1/test/product/wp08/confirmation-real-dependencies.test.ts`
- `Sucafinav1/test/product/wp08/mutation-fence.test.ts`
- `Sucafinav1/test/product/wp08/work-presentation.test.ts`
- `Sucafinav1/test/product/wp10/integration/browser-bundle-literals.test.ts`
- `Sucafinav1/test/product/wp10/integration/dashboard-preview.test.ts`
- `Sucafinav1/test/product/wp10/integration/memory-services.test.ts`
- `Sucafinav1/test/product/wp10/integration/portfolio-reconciliation.test.ts`
- `Sucafinav1/test/product/wp10/integration/store-read-scope.test.ts`
- `Sucafinav1/test/product/wp10/integration/ui-authority.test.ts`
- `Sucafinav1/test/product/wp10/memory-integrity/identity.test.ts`
- `Sucafinav1/test/product/wp10/native-host/execution-host-guard.test.ts`


## Falhas do shard 6

Caminhos relativos a modules/sucafina/Sucafinav1/test/product/. Soma:23casos, sem contar novamente a lista repetida do sumário.

| File:line | Casos | Evidência | Classificação / encaminhamento |
| --- | ---: | --- | --- |
| dashboard-installed-closure/consumer-read.test.ts:64,179 | 2 | Inscrição antes de Hot Topics/summary | Migração de UI instalada; não restaurar console |
| wp13/semantic-union-source-scenario.test.ts:50 | 1 | stale/portfolio-selection-changed após180034ms; deadline180000 | unbound — desempenho,10404 leituras de cases/126564 revalidações |
| wp04/capabilities.test.ts:88 | 1 | unavailable/requisition-unavailable | C15 — CAS canônico requests:PR-1 ausente |
| wp04/ui-sourcing-analysis.test.ts:98 | 1 | 503 esperado, undefined recebido | Migração/integração; interface/http.ts:26,30 não admite workbench-sourcing-input |
| wp12/native-question-consumer.test.ts:149 | 1 | answer-reuse-unavailable; Planner17campos | Dependência shared existente #400; ainda sem gate deste teste nesse head |
| wp12/native-verifier-negatives.test.ts:147 | 1 | invalid-forecast-input após false-monthly-total | C14 — seleção HTTP com caseRef passada ao Forecast canônico |
| wp12/native-execution-documents-contract.test.ts:21 → native-procurement-preparation.ts:193 | 1 | null esperado,240000 recebido | C04 — fonte sem operações vs hipótese |
| wp01/http.test.ts:56 | 1 | workbench legado404, esperado200 | Migração de UI; não restaurar contrato retirado |
| wp01/import-receipt-browser.test.ts:26 | 1 | File encontra upload e checkbox | C13 — locator exato |
| wp01/alternative-contribution.test.ts:46 | 2 | Subtotal null/0; corpo de proposta ausente | Migração/apresentação; contribution-body.ts default vazio:53; payload/envelope passaram:37–42 |
| wp01/personal-views.test.ts:82 | 1 | Inscrição antes de ?page=OPEX | Migração de UI; :83–90 usa densidade e global legados |
| wp10/integration/calculation-ancestry-composition.test.ts:26 → composition-test-deadline.ts:5 | 1 | Deadline105000 em produce-outer | unbound — desempenho;573 leituras,102548ms na fase |
| wp10/integration/bi-case-access.test.ts:136 → bi-access-browser-fixture.ts:198 | 1 | Espera botão singular Abrir origem | C16 — opções reais de múltiplas origens; distinto de C06 |
| wp10/native-host/native-host-disposal.test.ts:38 | 7 | SessionSubagentModels ausente nos7modos | C12 — composição do host de teste |
| wp06/native/import-analysis.test.ts:156 → :326 | 1 | Contribuição persistida sem preview link renderizado | Migração do consumidor; persistência/importPreviewRef/mensagem passaram:148–155; não fabricarURL |

