# Handoff — sf-shard-c

SHA de código C: d0ccac815e8e688aab1b7e699f586cc0d4be0af6
Base original: f7dd58e32bc834f1485df20b91adbf759b4c4ad0
Integração observada: sf-join-four em 82ead34aa68b942b1174f06f8e2c6a0a1f043db9
C incorpora a integração até 82ead34aa68b942b1174f06f8e2c6a0a1f043db9 (#451), pelo merge22087359e99bca5cf965bafbcb46ba6ee0662ae0. O superset da sentinela privada de C, com título e três asserções adicionais, permanece. O novo fixC12 d0ccac815e8e688aab1b7e699f586cc0d4be0af6 está em qualificação; o PR principal397 não é declarado verde.
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

- [#417](https://github.com/gustavomhss/Orchestra-SF/pull/417), revisão11 do contrato com proveniência; source f86d423436380812e4ce0835d4dbe4efced1d825, merge 687759276c2c9121c2cfd20a5994b277ceb7ee4d. Gate44662549289:5/0,913expects. Os merges posteriores407 e431 alteraram o produtor host pinado; revisão12 #426 foi emendada com as duas proveniências, passou5/0 e foi mergeada. O verde11 sozinho não qualificava a árvore posterior.
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


### Integrações qualificadas posteriores

| PR | Mudança | Head qualificado | Merge em sf-join-four | Evidência e limite |
| --- | --- | --- | --- | --- |
| [423](https://github.com/gustavomhss/Orchestra-SF/pull/423) | Cliente do primeiro desvio com mapa vazio canonicamente admitido | 4039640ef1acffd79b8e27c7186b3e231a5dddd9 | 9fb1514464e75646ec2f96d9ddaf940f1fe2062c | 5/0,58expects no44666208536; produtor43718/0 já integrado. Dashboard original0/1 no mesmo run permanece UNBOUND |
| [440](https://github.com/gustavomhss/Orchestra-SF/pull/440) | ParserCaseRef preserva IDs/tipagem reais; nega IDvazio/versão<1 | 602c5953f22d7b3de8319afa2f596c7cc347830e | 8eb020dd6cb776b18dc006a23403f8b3a5e4a0bf | 44669527682:17/0,327expects8.88s; inclui16Workbench e1identidade |
| [426](https://github.com/gustavomhss/Orchestra-SF/pull/426) | WP00 revisão12 com proveniência real407+431 | 42926f460f6e1b5195aad2be39ecf200e4a5ef71 | 9391cd78afb37883964263f4a43b08aafead131b | 44669752250:5/0,913expects178ms;38artefatos/ordem/proveniências anteriores/consumerAcceptanceBLOCKED preservados |
| [443](https://github.com/gustavomhss/Orchestra-SF/pull/443) | Dez causasC qualificadas,21blobs de testes | b14a9caf25dcb8635d364ae4c77ba9bae98f4951 | 95d3ffdc5478edcfa0ce012ba7f367ef7ab39259 | pin/Atlas/source-observation/AM02/import/WP05/public-state/procurement/AM04/Workbench; o único diff procurement inicial são2linhasexpectSpawn; sentinela separada451 |
| [447](https://github.com/gustavomhss/Orchestra-SF/pull/447) | Histórico de Planner e chooserBI com autoridade atual | 310e03056d2eda701724dd40fe23c32f944db35c | cad07e37262ebc4888422b4cf549e06c37a9390d | 44669530310:3/0,168expects80.24s;44670030550:1/0,73expects69.57s; dois commits causais |
| [444](https://github.com/gustavomhss/Orchestra-SF/pull/444) | Recusa exata de revogação do escopo, sem value | 44ea482e56f8fd31fb861d3ca7e18583c3115c35 | 124d5b5c7fbc4a7a57edc0fe1420d38496402a48 | 44670481763:1/0,20expects,8filtered26.60s;13asserts internas mantidas; casos anuais105s não incluídos |
| [438](https://github.com/gustavomhss/Orchestra-SF/pull/438) | Observação histórica bounded de analysis, fallback opaco paralelo e pin real | 43a2dcebfed2cabfa01934f8b9bee0987dc134ac | 676584ba114e34da0a5ec523caa230746716591e | 44670811024:21/0,148expects40.85s; pin44671622213:2/0,40expects35.45s; B6 excluído e continuaUNBOUND |
| [451](https://github.com/gustavomhss/Orchestra-SF/pull/451) | Sentinela específica do pedido privado, sem colisão com atributoHTML hidden | def79021902e903641f4c01cedddfa2ec87a0db3 | 82ead34aa68b942b1174f06f8e2c6a0a1f043db9 | CasoA3PASS1845.38ms em44665621967, helperBun; composiçãohelperNode NOT_REVALIDATED.56expressõesexpect preservadas; C mantém superset de título adicional |

Também incorporados de outras sessões: #435 (AlternativeDraft persistido, merge82d2041d80784e2d905f99dee3bca91c63ef8350, gate3/0) e #425 (CI, mergec74724c3e82f9a3fd3bdf2cd5492d966069caed8). #425 mede timings reais e liga seleção/source/pais; não representa um recibo completo1–8. Suas provas Core/Sucafina/spawn focado passaram, mas as execuções amplas tiveram falhas históricas de LFS/guards/setup, registradas no PR. Nenhuma aprovação foi fabricada.

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
| C7.5 import/report legado | product/wp02/import-report-consumer.test.ts:100:25 | Migração nativa4758184b6ef9abc61bf57ec7b08481bb78d5c8c3; gate44656058658:1/0,71expects; transportado e mergeado em443 |
| C7.5 Dashboard legado | product/wp02/dashboard-browser.test.ts:74:66 | Migração3e23044; 44663298380=0/1,25expects,60.40s. Segundo44666208536=0/1,25expects,55.64s no Save:97:72; controles #423=5/0,58expects. Chrome conectou em ambos, não é falha de launch. UNBOUND. Causa adicional de produção: mapa deviations canonicamente ausente; #437produtor mergeado após18/0 e #423cliente mergeado com5/0. O original continua UNBOUND; sem terceiro gate focado. |
| C7.6 cache Atlas single-use | product/wp10/analysis-composition/historical-memory.test.ts:292:100 | PR398 mergeado; gate44654168008:15/0,1495expects em5arquivos |
| C7.7 recuperação Atlas | product/wp10/atlas-business/atlas-recovery.test.ts:137:32 | Fix36c7989ecf8b836af893de22a293092e4cbd09ba; gate44650347644:1/0,37expects; mergeado443 |
| C7.8 estático | product/work-split/work-reuse/static-gates.test.ts:12;budget:28 | TypecheckSucafina corrigido/verde399;425 qualificou Core/Sucafina e gates focados. Aprovação real dos2paths protegidos continua ausente. #453 propõe provaActions isolada dos7typechecks, geração, E2E, Web, spawn e guards estritos; composição b5d3371e6288ba445e2af5480f7b2e052e6f1b68 em execução, sem sf-ci |
| C7.9 admissão removida | product/diagnostics/calculation/source-observation.test.ts:86:29 | Fixccde74734b19f78aab0aa64ac0f301e5a4d379c0; gate44650428648:2/0,27expects; mergeado443 |
| C7.10 identidade + oracle AM02 | product/integrated-proofs/am02/performance-public-c16-reopen.test.ts:160:42;175:43 | Fixes9643737ac1b2a0c475af283dddc72db70d81a81c +e24aa85b0c8d88d0cd007b977ff84ff73eca8f30; gate44653652279:1/0,194expects,revogação final alcançada; mergeado443 |
| C8.1 pin/proveniência | product/canonical-read-cost/diagnostic-cost.test.ts:13:26 | Fix328960a664ed64c4db46e69bf30f24f9efb04c51; gate44649157618:2/0,40expects, mergeado443. Após438, pin realC2b3584b9 atualizado e gate44671622213:2/0,40expects,35.45s; produtor+pin mergeados atomicamente438 |
| C8.2 driver original Node | product/wp05/planner-origins.test.ts:83:77 | Fix8392356be8a13c33eb4dec83e4e198f7b1806b37; caso PASS3.669s no44654104426; dois casos sensibilidadeA2 também PASS; helper e oito consumidores comexpectSpawn mergeados443 |

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
| WP00 contrato11 | [44662549289](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44662549289) | 5/0 | d9284bc1079b580af9d6224c5d2b141ee02a0d6f | f86d423;913expects174ms; merge417;38artefatos/aceitação BLOCKED preservados;407posterior invalidava somentepinhost; revisão12 #426 posteriormente5/0mergeada |

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
| Runtime native | [44668010002](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44668010002) | 3/1 | 2030026bbd1c3329f4b492d7e3b3d642caec9e7c | sourcefdbf7c790fb7838009243b323b6c72530679d92b;26expects;browser45s,hostready11.838s,Chromeconnected11.925s depois; UNBOUND diagnóstico insuficiente: bloqueio entre runtime-http:173–183 após goto172PASS; sem DOM/trace capaz de identificar o await, sem novo gate especulativo |
| Canonical deviation projection | [44668705164](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44668705164) | 18/0 | 3f6c0e11f319770b91e98605e5025e9614b491b2 | #43754f0e9d;1386expects1219ms;mergeb180588 |
| Native public-state | [44668708981](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44668708981) | 3/0 | c5125ef206690b1f5464275aa82eb00d80d378f0 | C2a71e601a50d990f27381f649d705ff5f38b0b15;source084226;25expects3.91s;timeoutoriginal30s |
| Procurement explicit draft/refusals | [44669199777](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44669199777) | 4/0,55expects12.76s | 65db150c81c01b1ee3667fa9c34a310ab469c96b | C7e133b7+1cc82d5;source084226;intençãofalse explícita e recusa real de PO |
| AM04 receipt collision | [44669202348](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44669202348) | 1/0,24expects7.77s | 7b85405efc1d3a7767166733e1ca28304a936ac7 | C16a7026;source084226;mesma Request admitida e recibo/digest reais, sem leasefabricada |


### Gates causais recentes

| Causa | Run | Pass/fail | Fonte | Snapshot / observação |
| --- | --- | --- | --- | --- |
| Workbench nativo + CaseRef440 | [44669527682](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44669527682) | 17/0,327expects8.88s | 124f767dc0542b3f0a3c25ff5d24f7c00919a495 | 2ad694730945c99a9c8ad98fa4e08f90ad5ef8ce;16Workbench+1CaseRef; fixCf2e13d29f9238a736dab23fc3b0ac26201790327 |
| HistóricoPlanner | [44669530310](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44669530310) | 3/0,168expects80.24s | be37121d52fe4522db79288a585e877612e9aec0 | 79dd251a1cd75d2d2cb48a27278f8f216539405b; Cfix049ed587a22103b7e49aa6a5a0e066748689fe21 |
| Revisão12WP00 | [44669752250](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44669752250) | 5/0,913expects178ms | 42926f460f6e1b5195aad2be39ecf200e4a5ef71 | 690563b2ec4d9a3812f1ff7874fe7bcf0bbbc0ff |
| Analysis-observer inicial | [44670026731](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44670026731) | 20/1,145expects40.50s | a75cb770a51319639a7b3b8a10e8138f8d3e9925 | 3184dc29525f6dab67128b08ab63d483ad6d738f; novo teste189:8 esperava par de refusals errado; os4recovery e9scenario-batch passaram |
| BI chooser original | [44670030550](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44670030550) | 1/0,73expects7filtered69.57s | 0126d7330ebe36549a9c9b70ffb3ea95327d0219 | caad3ab06959818138ea7f7bb6ea298c1c84e2d6; Cfix8e71e07e907b02be635d4f98aaf0638816f7b429 |
| Revogação escopo | [44670481763](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44670481763) | 1/0,20expects8filtered26.60s | 0126d7330ebe36549a9c9b70ffb3ea95327d0219 | 8dfb6c091e53b8a348fee83dae2670c933a32d25; resposta denied/case-selection-authority-changed evalueausente |
| Analysis-observer corrigido | [44670811024](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44670811024) | 21/0,148expects40.85s | 53df24e94fccd448d36e7512ff7bde250def9241 | 51475bf7f369c8abd097163023df376de6f43b2d; par ordenado unavailable/result-unavailable,denied/result-access-unavailable;3reads4cases4sources |
| Pin real após438 | [44671622213](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44671622213) | 2/0,40expects35.45s | 43a2dcebfed2cabfa01934f8b9bee0987dc134ac | 3f5dac23c8c06b906cb536353cec6901cfbda930; SHA256result-store d35d43b872eee637c913397ec72157757fba9c4daa29d8a9dee499b030879722 |
| C12 native receipt recovery | [44672589617](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44672589617) | 0/2,10expects87.55s | d0ccac815e8e688aab1b7e699f586cc0d4be0af6 | 0b15101cfe495422ffc72eab36bcf558171786a5;2casosoriginais120s/90s; Review/Apply humanos, resposta perdida, same-key retry, CAS, reopenSQLite e Recover reais |
| Static Actions isolado453 | [44672678428](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44672678428) | EM EXECUÇÃO | d0ccac815e8e688aab1b7e699f586cc0d4be0af6 +1885dd769e8100520b15e0596e76bf8525e23b28 | b5d3371e6288ba445e2af5480f7b2e052e6f1b68;16comandosreais,1job22min,strictguardssemaprovação, não sf-ci |

## Tabela agregada dos oito shards

Resultados pedidos aos branches sf-shard-a/sf-shard-b e conferidos nos handoffs, snapshots e logs. Esta tabela registra a última enumeração observada, completa ou explicitamente parcial. Nenhum PASS focal é subtraído dos FAIL históricos. Os índices pertencem à partição histórica de883arquivos; o planoLPT atual deve ser derivado de novo para uma verificação final.

| Shard | Branch | Run | Pass | Fail | Causas | Unbound / limite atual |
| --- | --- | --- | ---: | ---: | --- | --- |
| 1 | sf-shard-a | [44657265518](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44657265518) | 576 | 29 | UIlegada;C12;Portfolio;HTTP;histórico/revogação;documentos;deadlinesanuais | Completo605tests113files. Workbench/public-state/procurement/AM04/histórico/revogação já têm gates verdes e merges443/447/444; runtime3/1UNBOUND; BI fallback sem equivalente nativo integral; C12emgate. Dois casosanuais105s permanecem |
| 2 | sf-shard-a | [44661562191](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44661562191) | 508 | 6 | Chrome;recall;chooserBI;Atlas3 | Completo515tests107files,+1skip+1error. Chooser4471/0;Atlas3983casosPASS;WP05Node4432sensibilidadePASS. Recall120s aberto. Gates não tornam esta enumeração verde |
| 3 | sf-shard-a | [44665621967](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44665621967) | 250 emitidos | 22 emitidos | Consolelegado;capacity/semanticWP05;WP13/BIdeadlines;C12oráculos;URLsBIlegadas;corpusWP00 | CANCELADO,semfooter.66/99arquivosiniciados,33nãoiniciados;review-answer-confirmation interrompido semFAIL do caso99. Sentinela procurementPASS;corpus415qualificado fora desta fonte |
| 4 | sf-shard-b | [44645900692](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44645900692) | 497 | 14 | AM01;C03browser;nativeexecution;recovery;S10 | Completo511tests118files.430/406fatiasmergeadas. C03novo44670314438=1/0. S10repetiu2pontos no44667978696=16/2→UNBOUND |
| 5 | sf-shard-b | [44645913808](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44645913808) | 576 emitidos | ≥21 observadas | Performance/sensibilidade;Atlas;linksBI;coverage;freeze;UI/transporte;cálculo | CANCELADO,semfooter.20marcadoresFAIL+1asserçãoadicionalsemmarcador,+1skip;105/119arquivosiniciados14nãoiniciados.398Atlas,426freeze12e430fatiasverdes;restantesabertos |
| 6 | sf-shard-b | [44651628624](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44651628624) | 409 | 23 | UInativa;Portfolio;CAS;Planner/Forecast;baseline;locator;AlternativeDraft;chooser;hostlifecycle | Completo434tests109files,+2skip. B6semantic-union2gates→UNBOUND. NativeSourcing3/0 e4353/0 são recortes.441bloqueado: captura do request ocorre depois do primeiroawait; gate não cobre a janela |
| 7 | sf-shard-c | [44645952434](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44645952434) | 518 | 12 | Cenários;dependencies;Planner;BI2;import;Dashboard;Atlas;static;admissão;AM02 | Cenários/dependencies/Dashboard2falhas→UNBOUND. Demaiscausasfocadasqualificadas400/401/398/443;423cliente5/0+437produtor18/0mergeados. Static453emexecução,guardsprotegidossemaprovação |
| 8 | sf-shard-c | [44645956665](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44645956665) | 618 | 2 | Pinrealprodutor;driverNode | Duascausasfocadasverdes;443integradotransporte;438novopin2/0mergeado. Ainda sem fullshard na composição atual |

Não há totalglobal completo ou GO:3/5não terminaram; não há oito shards verdes na composição atual. Os arquivos/linhas originais estão nos apêndices; a nova enumeraçãoA3 está detalhada antes dos registros históricos.

## Pendente

1. C12run44672589617 terminou **0/2,10expects87.55s**: primeiro falhou no bridge Node apósChromeconectado (browser-driver-fixture.ts:385:35), segundo aguardando decision-review emrecovery-ui.test.ts:210:27. Nenhum aumento de prazo; investigarF01/Review e só executar outrogate apósfixconcreto. Static453run44672678428/snapshotb5d3371e6288ba445e2af5480f7b2e052e6f1b68 é o único gate próprio ativo. O estático executa os comandos canônicos e preserva falhas, inclusive os guards protegidos; não substitui sf/verify nem fornece aprovação.
2. #403cenários, #414/#420B6, #424dependencies e Dashboard original atingiram duas falhas: **UNBOUND; não repetir terceiro gate focado**. #43821/0 e os controles423/437 verdes não mudam esse estado.
3. Runtime nativo:44668010002=3/1,26expects. HTTP3casosPASS;goto:172PASS; espera restante está entre173–183, semDOM/trace de falha. **UNBOUND por diagnóstico insuficiente**, sem patch especulativo/prazo maior.
4. BI fallback lifecycle: apósenrollment303 a fixture serve503 em/ e a página legada404; a UInativa exigeF01bi-options e não possui o contrato antigo de refresh30s/purge físico. **UNBOUND: não há migração integral demonstrada**, sem recriarconsole/reduzirasserts.
5. B441: request/case/source/criteria podem mudar enquanto selectedCase aguarda antes de captura. Fonte91bcd283b6c4fbd9bc9575d232cbc62ddea9630b e teste571f35a5843fc4b77c7e413169440f9cd0bb1d97 ainda contêm a janela. Comentário de revisão publicado em441; não mergear mesmo se gate atual passar sem a regressão. Ao compor424, preservar resolveMany/sequential dentro de readMetricCanonical.436não apresentou esse bloqueio estático; gate memória em andamento.
6. InvestigarA3c12-concurrency200vs409 com o contrato receipt-first atual, preservando edição concorrente/mesmorecibo/nenhumefeitoextra e controlesindeterminados. Não duplicar442 (reserva/abortpré-COMMIT); sem patchemapplication.ts.
7. Aprovação real de protected-paths permanece ausente. Transporte402 não concede aprovação; static453 apenas registra o resultado estrito. Pathsherdados:godfile-waivers.json e script/spawn-allowlist.json. Não aplicar label/variável falsa.
8. Continuar coletaB:44670599697Portfolio e44670534535memory ainda em execução no momento desta atualização; C03novo44670314438=1/0 deve ser transportado isoladamente se ainda não mergeado. Não duplicar gates de outras sessões.
9. Compor somente as fatias qualificadas e rederivar o plano atual1–8 para verificação final autorizada por fix concreto. Sem sf-ci. #397todo permanece draft e inclui causasUNBOUND; não mergear todaC como se fosse verde. Pin precisará proveniência real se442alterarstate-provider; qualquer alteração futura deprodutor exige reavaliação.

## Decisões e justificativas

- Mantidos console descomissionado e runtime/application.ts intacto. Nenhuma navegação à porta proibida. Fixtures novas pertencem ao host nativo, porta0, identidade criptografada original, comandos reais eSQLite.
- Sem reduzir asserções/controles, inventar baseline/coverage/digest/GO ou aumentar prazos.
- PinC8 tem cadeia de proveniência do produtor real; AM02 compara exatamente seis efeitosC08 idempotentes e mantém snapshot completo/última revogação.
- Memória Atlas cria nova observação após consumo, verificando novamente fonte/C08; não retag de token gasto. BI cache contém prova completa original no escopo real, nunca autoridade global.
- A aprovação dos guards é decisão humana efetiva e verificável. Não foram aplicados labels de aprovação. Resolver valida snapshot único, blobrequest original, PR/head/base/labels/permissões atuais e repete verificação antes de transmitir; falhafecha. Basesorigin/dev ePRreal mantidas.
- Se mesmo ponto falhar2x, parar essa causa e registrar unbound; mudança posterior exige causa concreta distinta. Não há rerun idêntico para obter número melhor.

## Como retomar

Ler o HEAD de sf-shard-c, este handoff e os PRs397/410; colher os dois gates atuais e resultados dos agentes antes de novos disparos. RevisarC12, static453, C03 e a investigaçãoC12concurrency. Fontes/snapshots registrados acima; criar snapshot focado como filho com somente.ci-run.json. Static453 usa prefixoci-static-sfc-* e não dispara test-ci/sf-ci. Respeitar no máximo2gates próprios simultâneos, sem repetiridenticamente e sem ultrapassar2falhas no mesmo ponto. Para integração, conferir diff/blob exato e mergear a PR isolada comCASdohead. Nunca escrever nos quatro branches proibidos.

## Comandos e resultados

Nenhum comando foi executado em shell. Requisições Actions usam package sucafina,directory modules/sucafina,runnerbun,args[--timeout,30000,...caminhos],envOmni=1. A forma literal SF_SUITE_ID/SF_SHARD_INDEX/SF_SHARD_COUNT não é aceita pelo validador da base; a enumeração inicial derivou suites.json +SHA256(path)mod8 e branchesci-run-linux-*. Seleção inicial883arquivos:113,107,99,118,119,109,103,115. Depois #413 introduziu script/sf-ci/shard-plan.mjs com LPTdeterminístico e cobertura/disjunção completas do manifesto atual. Custos históricos parciais são heurística, não recibo de cobertura. Derivar a partição final da árvore real; não chamar sf-ci.
- bun typecheck canônico: exit0 no44654714455; antes21erros reais da fixture.
- check:guards --base origin/dev: resultado original2GATE,194WARN,0errors;#425tambémobservouosmesmos2protegidossemNOVOgate. SemPASSglobalreal; aprovação específica ainda pendente.
- Testes de transporte de aprovação:59/0 no44658251806, sem efeitos de aprovação.
- sf-ci: nunca executado.
- Merges próprios qualificados:399/398/404/401/402/400/409/411/415/417/412/421/422/430/406/432/427/428/437/423/440/426/443/447/444/438/451 em sf-join-four; SHAs acima. #451temPASScausalA3 e composiçãoNodeNOT_REVALIDATED. Outrosmerges da sessão deintegração estão no handoffsf-continuation.


## Atualização agregada — A3 terminal e gates B posteriores

### Shard 3: enumeração mais recente, cancelada

[Run44665621967](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44665621967), [job136054050430](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44665621967/job/136054050430), fonte `a86e22c9654663a72bd55586059a4254f548c742`, snapshot `3caf96c9115b30f8a1150532e08b4a1714345a4a`. O job foi cancelado; cleanup136070755205 terminou success. Contagem direta: **250 PASS /22 FAIL emitidos, sem footer Bun**,66/99arquivos iniciados,33não iniciados. Não são totais de uma execução completa.

O caso da sentinela procurement passou em1845.38 ms. As falhas capacity e semantic-discriminants são novas nesta enumeração, que ainda usava o helper anterior sob Bun. A contagem menor de PASS também inclui quatro casos finais não alcançados. Não inferir regressão da composiçãoNode443 a partir dessa árvore anterior.

Caminhos abaixo relativos a `modules/sucafina/Sucafinav1/test/`. Linhas vêm do log, exceto a declaração de timeout indicada explicitamente.

| # | Falha file:line | Causa observada |
| ---: | --- | --- |
| 1 | `io-browser.test.ts:26:35` | Console retirado; conexão recusada na jornada Planner XLSX. |
| 2 | `io-browser.test.ts:114:16` | Console retirado; conexão recusada na jornada Documents/supplier CSV/Members XLSX. |
| 3 | `visual-layout.test.ts:37` | POST ao console retirado; ECONNREFUSED. |
| 4 | `product/wp05/capacity-numeric.test.ts:76:22` | Click aguardava marca visível/estável (10 s), seguido do timeout do caso de180 s; nova falha nesta enumeração. |
| 5 | `product/wp05/semantic-discriminants.test.ts:85` | Timeout de90 s do segundo caso; linha de declaração, sem await interno identificado. |
| 6 | `product/wp13/sensitivity-units-boundary.test.ts:54` | Timeout de30 s reportado76670.17 ms; replay-ready só em74764 ms. |
| 7 | `product/wp13/persistence-recovery.test.ts:21` | Lost-binding reply; timeout de30 s reportado31838 ms. |
| 8 | `product/operations-fixes/c12-concurrency.test.ts:34:44` | Esperava409, recebeu200; investigar oráculo histórico versus receipt-first atual. |
| 9 | `product/operations-fixes/c12-concurrency.test.ts:103:106` | Esperava409, recebeu200; mesma família, ainda sem fix qualificado. |
| 10 | `product/installed-bi-closure/numerical-coverage.test.ts:20:11 (omitted training)` | Deadline165 s; último estágio advantage.persist. |
| 11 | `product/installed-bi-closure/numerical-coverage.test.ts:20:11 (confirmed training)` | Deadline165 s; último estágio advantage.persist. |
| 12 | `product/installed-bi-closure/numerical-coverage.test.ts:20:11 (zero training)` | Deadline165 s; último estágio advantage.persist. |
| 13 | `product/installed-bi-closure/numerical-coverage.test.ts:20:11 (null training)` | Deadline165 s; último estágio advantage.persist. |
| 14 | `product/wp12/native-execution-bi-kpi.test.ts:312:131` | HTTP200, mas URL esperada do BudgetOverview legado não apareceu. |
| 15 | `product/wp12/native-execution-bi-public-selection.test.ts:326:146` | HTTP200, mesmo contrato de URL legado. |
| 16 | `product/bi-cost-waterfall/presentation.test.ts:17:20` | Promoções sequenciais/totais pendentes: deadline105 s. |
| 17 | `product/bi-cost-waterfall/presentation.test.ts:66:50` | Custos confirmados completos: deadline105 s. |
| 18 | `product/bi-cost-waterfall/presentation.test.ts:97:14` | Contribuições zero/opostas: deadline105 s. |
| 19 | `product/bi-cost-waterfall/presentation.test.ts:113:19` | Custos null/missing: deadline105 s. |
| 20 | `product/bi-cost-waterfall/presentation.test.ts:133:11` | Equivalência Portfolio persistida: deadline105 s. |
| 21 | `product/bi-cost-waterfall/presentation.test.ts:242:19` | Current source/BI10/BI11: deadline105 s. |
| 22 | `product/wp00/baseline-corpus-coverage.test.ts:60:231` | Metadados arquivais fixtureBindings/executionStatus ausentes nesta fonte; restauração415 já qualificada em outra árvore. |

Em `product/wp08/review-answer-confirmation.test.ts`, o primeiro caso:14 passou em81077.31 ms. O caso:99 estava em execução no cancelamento, último marcador `edit-stale real-answer-edit` aos45735 ms; **não emitiu FAIL**. Os casos:127/:161/:188/:228 não começaram.

Os33arquivos não iniciados foram conferidos comparando os99argumentos do snapshot com66headers distintos do log. Caminhos relativos a `modules/sucafina/Sucafinav1/test/product/`:

```text
c12-receipt-recovery/normal-retry.test.ts
reports-draft-reconciliation/installed-read-integrity.test.ts
review-fixes/finance-resume-performance/journey-phase.test.ts
review-fixes/import-recovery/apply-restart.test.ts
ui-split/ui-source/static-checks.test.ts
ui-split/ui-work/static-gates.test.ts
wp02/backup-consumer.test.ts
wp02/keyed-update.test.ts
wp02/kpi-comparison.test.ts
wp02/prepared.test.ts
wp02/review-completion.test.ts
wp02/signals.test.ts
wp02/workbench-recovery.test.ts
wp06/documents/resolver.test.ts
wp06/imports/dashboard-backup-e2e.test.ts
wp06/imports/end-to-end.test.ts
wp06/imports/planner-roundtrip-runtime.test.ts
wp06/imports/roster-runtime.test.ts
wp06/imports/sqlite-planner.test.ts
wp08/answer-reuse.test.ts
wp08/case-selection-cas.test.ts
wp08/collaboration-journey.test.ts
wp08/confirmation-real-dependencies.test.ts
wp08/mutation-fence.test.ts
wp08/work-presentation.test.ts
wp10/integration/browser-bundle-literals.test.ts
wp10/integration/dashboard-preview.test.ts
wp10/integration/memory-services.test.ts
wp10/integration/portfolio-reconciliation.test.ts
wp10/integration/store-read-scope.test.ts
wp10/integration/ui-authority.test.ts
wp10/memory-integrity/identity.test.ts
wp10/native-host/execution-host-guard.test.ts
```

### Gates B verificados depois das enumerações

| Causa | Run | Resultado | Fonte | Snapshot | Falha/limite |
| --- | --- | --- | --- | --- | --- |
| C03 transporte | [44667407691](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44667407691) | 0/1,10.37s | 16fc1f1cf07a52f4cb6d02c3b509c29384cc97f9 | 6c529ac61e56d777dc0c42d12bb4540d2588079f | wp07/browser-ui.test.ts:257:11; navegação de enrollment interrompe goto autenticado com chrome-error://chromewebdata |
| C03 enrollment isolado | [44668069860](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44668069860) | 0/1,17.68s | c94011c7ad425389e3a91392d6d16203bc816241 | 08082b4996eeab03d7ba3f815b3339f00eadf9b3 | browser-ui.test.ts:233:29; launch15000ms antes de enrollment; ponto diferente do run anterior |
| C03 corrigido | [44670314438](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44670314438) | **1/0,28.47s** | 42209cab9081705f63133ca3fe8b4ef28ff660df | 82bbd5b7dfa0bd9de444c0a58cb3f419e3c08412 | job136069432415,cleanup136070089399 success; caso28136.72ms, driverexit0/cleanupfísico. PR isolada em preparação; ainda não confundir com merge |
| S10 composição | [44667978696](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44667978696) | **16/2,288expects1007.23s** | e325d5b2382267e1bc7a9df4f29453f4a365cec8 | eeffac552972d6c9b1e41f668127a358409bd732 | coverage-sensitivity-integration.test.ts:22,300s e:141→renewal-choice-fixture.ts:65→fixture-trace.ts:15,180s; repetem44657814166:UNBOUND |
| NativeSourcing | [44668567443](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44668567443) | 3/0,27expects422ms | c6dde2ba43db83445e2043d9064eaa41dbade9fb | 51eba3c3f73eb79112fdc065b80ec426e1dc3e5e | NativeHTTP503 quando runtimeausente e403origin/path; não prova execução real de modelo |
| shared435 | [44667463947](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44667463947) | 3/0,30expects169ms | 0a31f6c8fe5c5020165c6225212ad1b3a13c3548 | cb3103d440c34074a8669ab3ff19c0b87abd90d7 | AlternativeDraftnull/zero/stale; merge82d2041d80784e2d905f99dee3bca91c63ef8350, não B6 |
| Portfolio441 composto | [44670599697](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44670599697) | Em execução | 91bcd283b6c4fbd9bc9575d232cbc62ddea9630b | af31e465c7dc4a69c9cb4b2d0327350506b54c05 | A regressão pre-await pedida pela revisão não está neste snapshot; não qualifica441 sozinho |
| Memória436 composta | [44670534535](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44670534535) | Em execução | 91bcd283b6c4fbd9bc9575d232cbc62ddea9630b | 032dcd4942b8992c2ed639233d0fbcd7700f40ee | O follow-up corrige envelope real de state.read da fixture, preservando storageVersion/aggregateRevision/incarnation |

No S10, os16PASS são5negativas de integração,4sensitivity-read-scope,4renewal-case-read-scope e3renewal-read-scope. O primeiro caso continuou emitindo marcadores durante o bootstrap do segundo; não há prova de duas causas independentes de lentidão.

AuditoriaWP05 na integração124d:42arquivosTypeScript,8consumidores deinspectWp05Browser, todos comexpectSpawn. semantic-discriminants, consumer-dashboard e render-completion-browser usam chromium.launch direto e não foram alterados pela migração443.

## Nota sobre os apêndices históricos

Os apêndices seguintes preservam as enumerações e diagnósticos disponíveis em cada checkpoint. Quando divergem do estado atual (por exemploA3anterior ouC8chooser), prevalecem as tabelas atuais, sem apagar a evidência histórica. Gates focais e resultados parciais continuam separados de um shard completo.

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

