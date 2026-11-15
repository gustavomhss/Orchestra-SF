# Missão52 — handoff financeiro, revisão8

## Último resultado real: Requests503 no nominal15 sobre C45 + P11 isolado

**A jornada financeira obrigatória permanece FAIL antes de qualquer criação ou mutação financeira.** No [nominal15, run43680980170](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43680980170), a navegação para `/sucafina/procurement?page=Requests` retornou **HTTP503**, `application/json;charset=utf-8`. O DOM registra `{"status":"unavailable","reason":"procurement-queue-unavailable"}`. O formulário original esperado1 foi observado0, sob a expectativa original10000ms. Duração do caso: **14734ms**; primeiro step10064ms; budget180000ms, retry0.

Este é um resultado efetivamente observado no W15 sobre C45 mais o terminal71 documental, com P11 no candidato isolado. Substitui nominal13 como último resultado financeiro funcional; não foi previsto por diferença estática, Unit04 ou diagnóstico14. A71 permanece ENDED no corte de autoridade executado; source52 `20944c7cc1ef0fb7254793a421468ac12300356d` está ACTIVE no envelope. Este draft não encerra a lease52 nem escreve target.

A identidade é **CI-UI-DECISIONS — require a real Procurement proposal and approval before Apply and recover its unique receipt**, `e2e/sucafina/decisions.spec.ts:21`. É o caso2 na ordem do spec e a família financeira obrigatória entre as cinco. O caso5 é recuperação C09 de criação incerta, não recuperação financeira C12.

O artifact15 contém `bodyCompleted:false`, `observations:[]`, `requests:[]` e o GET503 na captura de rede. A assertion falha em `decisions-support/procurement-source.ts:7`, antes de preencher ou enviar o formulário. **Nenhuma requisição financeira foi criada.** Propostas, evidências financeiras, aprovação, preparação, Apply e recuperação de recibo continuam **NOT_REACHED**. O503 não identifica sozinho o ramo interno nem demonstra ausência de identidade do ator.

### Identidades e integridade do run15

| Campo | Nominal15 |
| --- | --- |
| Run / job / cleanup |43680980170 /132711320639 /132712239127; job failure, cleanup success |
| Base executada |C45 + terminal71 documental, `384f9eb172f0e6761a2af1e92d8b4bb11d9b01df` |
| Base tree |`3115f239fe8bcdc5ea38b5089b6208224620d214` |
| W / tree |`c725f9b8307a84562258c478414ec0b39d428b99` / `44d2d591fac429609ff1a1e02c892185cfed4944` |
| S / tree |`5e84420631d4b162f38956aef6e0828e23a39e82` / `900eae757fddcdb1d6587c6635b84e3e93229dff` |
| Source52 publicado / tree |`20944c7cc1ef0fb7254793a421468ac12300356d` / `ca67b33deb0fe3586c996db925922bedcc5d9ac7`, ACTIVE no corte |
| Código próprio efetivo no envelope |`56239d138ed4ae7cac9ac6b01e68a3ee78d1bf4f`; separado do checkpoint documental e de W/S |
| Artifact |14148631878,3971407bytes,17arquivos |
| ZIP SHA256 |`0f5debd1e00cc8296ecf2e1e124cf65fd6ce7d1a9d231858a951d900bbf8bb20` |
| Recibo consolidado15 SHA256 |`24ab7a11603e37cc9703d83a39f0896c7951ab8a140aa459877162dec6c22f16` |
| Playwright runtime original SHA256 |`92eb4cd7f216cada183029f6827321838747e995dec8d74e2ac6011ae2c55a04` |
| Runtime extraído SHA256 |`6eb7ccd34a96dbb9191793b21742ba676b1ae5c3e0bab6511e956de3d5642065` |
| Observações financeiras SHA256 |`ea915e9246ad04991b194b6f48d60d5ce5317a9f16234064076fc47af1c81e73` |
| DOM financeiro SHA256 |`b66c78721311dddd1d351ab8c65ece81cae65ba08c890d45ed9618f6a2b2081c` |
| CLI financeiro SHA256 |`1aeac5dceb263a1f49c3008eb9b644c2e237c9b0899e88d72e43d87f39fe5ff0` |

O request original fixa S `5e844206…`, Playwright, `e2e/sucafina/decisions.spec.ts`, config de produção e `ORCHESTRA_CHANNEL=prod`. O envelope retém28postimages anteriores e acrescenta os dois arquivos compartilhados P11 e seu teste:31overlays,43entradas de raiz preservadas. Não há instrumentação diagnóstica, profile_records0, nem mudança das cinco identidades/assertions/budgets. Os paths Procurement/C12 e o Application86 não são sobrepostos pelo P11.

### Resultados individuais no mesmo run15

| Identidade original | Resultado | Duração | Limite da prova |
| --- | --- | --- | --- |
| CI-UI-DECISIONS — attach evidence, compare two alternatives and preserve the human choice after a source change |FAIL |68388ms |Duas comparações200/ok e regra numérica registrada200; terceira comparação requestfailed net::ERR_ABORTED sem resposta observada. Choice/histórico/P9 não alcançados. |
| CI-UI-DECISIONS — require a real Procurement proposal and approval before Apply and recover its unique receipt |FAIL |14734ms |Requests503/form0, nenhuma mutação financeira. |
| CI-UI-DECISIONS — create, edit and reopen the same durable case through Workbench |PASS |11667ms |Corpo original concluído. |
| CI-UI-DECISIONS — alternative discovery consumes a real Decisions catalog, not HTML 200 |PASS |7698ms |Corpo original concluído. |
| CI-UI-DECISIONS — recover a lost creation response by reading the same case without resubmitting |PASS |7351ms |Corpo original concluído. |

Total **3PASS/2FAIL**, skipped0, flaky0, setup_failed0, retry0. Todos os casos mantêm180000ms; o deadline configurado de comparação da UI é10000ms. A duração HTTP não foi medida neste run. Duração de teste ou step composto não é latência exclusiva do endpoint.

**Histórico preservado:** nominal13/C44 teve3PASS/2FAIL, J2 Requests503 em14880ms e J1 abortado na primeira comparação; seu recibo `3d0da5d176d63e1533222abc5c91c7a8288885288abccdc62d11262fbb056e8c` e os drafts anteriores continuam intactos. Nominal12/C41 também teve3PASS/2FAIL e J2 Requests503 em15955ms. Nominal11/C35 alcançou escolha200/retry retido/histórico antes de falhar após a mudança Planner; isso não preenche os trechos não alcançados em15. Nominal10 teve falha de setup EADDRINUSE em J2 e não é prova de Requests503. O diagnóstico14 e seus tempos instrumentados permanecem uma execução separada.

## C45 atual: aplicação86 e terminal71 reconciliados

| Referência | SHA / tree | Significado |
| --- | --- | --- |
| C44 executado no nominal13 | `eecbdacb21734695094332deb6142aa35d5c9c3c` / `4d4b149917a2c74cfeb73e45774fe098666c208d` | Base histórica do nominal13, preservada sem transferência para15. |
| C45 material | `5585e57f90d7b8d45e0577a8f0f4aa7884d3b58d` / `5bb9151ba20f606c42b8a073f246365e49d6e116` | Filho diretoC44, integração de export-egress86 por71. |
| Terminal71 / base atual P11 | `384f9eb172f0e6761a2af1e92d8b4bb11d9b01df` / `3115f239fe8bcdc5ea38b5089b6208224620d214` | Filho diretoC45,203 arquivos exclusivamente documentais sob o prefixo de recibos71; zero mudança de produto nesse commit. |
| Source52 | `20944c7cc1ef0fb7254793a421468ac12300356d` / `ca67b33deb0fe3586c996db925922bedcc5d9ac7` | Checkpoint ACTIVE informado pela raiz; separado de W/S isolados e do target. |

Os dois commits e os produtores financeiros abaixo foram lidos diretamente via GitHub MCP nos SHAs fixos. Os conteúdos lidos foram conferidos contra seus Git blob SHAs. O C45 altera21paths:17 documentos, `runtime/application.ts` e três arquivos de testes/helpers de exportação. O delta de produto é somente a aplicação; o terminal seguinte não acrescenta produto.

O [candidatoC45-export-egress86](https://github.com/gustavomhss/Orchestra-SF/blob/384f9eb172f0e6761a2af1e92d8b4bb11d9b01df/modules/sucafina/Sucafinav1/docs/sf2h/receipts/integration/release-wave-71/candidates/C45-export-egress86.json), blob `b9b92cfa33c4058ec5fe8f32a0ba10bc99b9d23c`, permanece `MATERIAL_COMPOSED_VALIDATION_NOT_RUN`, `GLOBAL_RELEASE:false`. A unidade completa86 tinha cinco paths: quatro mudanças foram integradas e o quinto, oracle legado de Procurement `5c25f109c4df835761e8aba8351686174ac6d7aa`, já coincidia com C37. Não houve transferência de 50PASS da fonte86 para a instalação52.

### Application mudou; a alteração é limitada à saída de downloads

`runtime/application.ts` mudou de `81f469822a2756b3e1ca87effbf5fd865a56010d` no C44 para **`a0deff8a3b272019f472aa2f93499d1940a78370`** no C45. Não se afirma que o arquivo inteiro permaneceu igual.

A comparação textual direta confirma que todo o prefixo anterior a `serveDownload` e todo o sufixo desde `canViewProcurementRequest` são byte-idênticos. Os únicos acréscimos estão em `serveDownload` e no helper `downloadSnapshotDigest`:

- Linhas714/770: a captura autorizada do download inclui digest dos dados públicos e versões.
- Linhas784–798: após gerar os bytes, uma nova transação somente leitura reautentica principal/papéis e confere ator e digest. Revogação retorna403; fonte pública alterada retorna409; nenhum byte é liberado nesses casos.
- Linhas815–818: o digest usa `publicSfData(snapshot.data)` e `snapshot.versions`, preservando a exclusão do estado privado de produto.

O despacho existente nas linhas79–80 chama esse produtor apenas para método diferente de POST com parâmetro **`download`**. A navegação financeira observada é `/sucafina/procurement?page=Requests`, sem esse parâmetro. `application.product` nas linhas68–70 e `productView` nas linhas83–84 ficam idênticos. A86 não adiciona uma ação de moeda, não monta o provider admission53 e não altera submit/approval/Apply. Isso é conclusão estática do delta, não previsão do HTTP de um futuro run15.

A fonte86 terminal é `fe27e295f3cfdf5707716e47021c269d643bc30e`, tree `ecdb27690d87301e20d1f7b86c76b30cd6d7aed5`, lease `egress-privacy-browser86` encerrada. Seu [handoff arquivado](https://github.com/gustavomhss/Orchestra-SF/blob/384f9eb172f0e6761a2af1e92d8b4bb11d9b01df/modules/sucafina/Sucafinav1/docs/sf2h/receipts/integration/release-wave-71/source-outputs/export-egress86/HANDOFF.md), blob `2aa5ada19eaaaf2718f42c6995dc9749f753f031`, informa50PASS/0FAIL/1077assertions no run43675046935, sobre W `e890d8cd79138dcb036a980c877319708dd220ac` e S `a99e224afdd5f830268a81d1087b6a1f43e83bec`. É prova de fonte de exportação/privacidade, não a jornada financeira de Decisões.

### Blobs financeiros relidos no terminal C45

Os paths sem prefixo na tabela estão sob `modules/sucafina/Sucafinav1/`.

| Path | Blob atual | Fato conferido |
| --- | --- | --- |
| `apps/cli/src/sucafina-product/business-services.ts` | `7f77d2443c220ba153cf38ee538a15a7f9a4b78d` | Byte-idêntico C44→C45. `contextFor`,96–113, exige Request, período autorizado, ator atual e moeda de `formSettings`. |
| `runtime/procurement.ts` | `a4ab021f646c0fc819b3afdde18796630fb9603f` | Byte-idêntico C44→C45. Mantém privacy73, settings persistidas, matriz e lifecycle canônico. |
| `product/procurement/queue-page.ts` | `91784d3ea3358565e19b62922c8867f134af9ac4` | Byte-idêntico C44→C45. Requests/My approvals requerem admissão e seleção; unavailable retorna503 sem formulário. |
| `product/procurement/scenario-preparation.ts` | `82b7d822ec5ca65ba9450cde74c5e8f39da84493` | Byte-idêntico C44→C45. Linhas41–45 mantêm `financial-approval-command-unavailable`. |
| `product/procurement/decision-host.ts` | `9b48c999661e4b8a10593ae7cd5d6e2ed1e2f635` | Fetch direto no target confirma o produtor conhecido; nenhuma alteração emC45. Preparação válida precede a captura do original. |
| `product/procurement/decision-preparation.ts` | `b75e0923535f4b91b71a2f2d79eef9cefde45db4` | Byte-idêntico C44→C45. Ciclo53 de editar draft, submit e aprovação de snapshot persistido. |
| `docs/sf2h/receipts/integration/closure-intake-57/consumer-ack53.json` | `81a26f9dd69634057ea1406626e096205ac78184` | Byte-idêntico; `admission:HOLD_INERT`, M31 OPEN, MI07 OPEN. |
| `docs/sf2h/receipts/integration/release-wave-71/source-outputs/mixed61/checks/M31-S0.json` | `a6f59190656be518311cb203d2ad1dd30e255a1f` | Fetch direto confirma M31_closed:false, MI07_closed:false e PASS_FOR_REFUSAL_ONLY da fonte61. |

## BloqueioA — pré-condição Requests observada, causa interna não isolada

O último fato UI52 é **HTTP503 Requests/form0 no nominal15**, antes de qualquer mutação financeira. O JSON não identifica qual ramo interno falhou, não demonstra ausência de identidade de ator e não é evidência de erro na aprovação formal, que nem foi alcançada.

O código fornece uma condição suficiente para a indisponibilidade: `business-services.ts:96–113` obtém a moeda por `domain.view(...).data.formSettings.currency` em transação Procurement autenticada; moeda vazia recusa o contexto. `queue-page.ts:27–28/46–57` converte falha da seleção/contexto/projeção em503 `procurement-queue-unavailable`. Não foi feito SELECT direto no SQLite da jornada para atribuir retrospectivamente esse ramo específico.

`runtime/procurement.ts:142–149/679–724/929–942` mantém settings persistidas, sem USD implícito. O formulário canônico é `form[data-page="Settings"][data-command="save"]`, com Save settings, CAS e papel admin. Salvar exige moeda e matriz de aprovação válida; não há ação pública de somente moeda. Preencher USD numa configuração vazia continua insuficiente e o código prevê422 `Invalid matrix or currencies`, sem commit. Esse POST não foi enviado pela missão52.

Reset/defaults, inventar holder ou matriz, mudar thresholds/selfapproval e impor fallback USD seriam decisões de política. Não foram usados para contornar o bloqueio. Uma mensagem mais acionável ou um link a Settings pode melhorar diagnóstico, mas não entrega a pré-condição sem uma decisão autorizada de configuração.

## BloqueioB — aprovação formal do replacement não escrito, estático e NOT_REACHED52

Os produtores atuais continuam distinguindo **escolha humana** de **aprovação financeira formal**. `scenario-preparation.ts:41–45` documenta que Approve exige uma requisição pending e aprova o valor submetido já persistido. A aprovação final sai dos estágios de edição. Não existe nesse produtor uma aprovação destacada do replacement ainda não escrito, e o retorno permanece `needs-input / financial-approval-command-unavailable`.

`decision-host.ts:114–131` prepara os comandos reais e devolve qualquer recusa antes de capturar o original protegido. Não é legítimo antecipar ou inventar essa captura para fabricar uma aceitação histórica positiva. `M31-S0.json` da fonte61 confirma apenas a recusa real, HTTP400 e arquivo protegido0→0; seu caso usa100→150 e não é o caso52 de100→140.

O ciclo53 válido permite editar draft100→140, submeter140 e aprovar o snapshot140 conforme holder/política. O contrato da jornada52 preserva a PR física100/v1/draft após escolher140, exige aprovação formal exata desse efeito e só então Apply com recuperação de recibo. Editar a PR antes da aprovação, aprovar100 ou tratar Choice como aprovação não satisfaz as assertions originais. M31/MI07 permanecem **abertos por contrato** e **não alcançados no runtime52/15**.

### Correções integradas que devem ser preservadas

- **C24/C25,53:** lifecycle de edição/submit/aprovação e composição mista foram integrados. A proposta separada de admission/application53 permanece HOLD_INERT; o consumer-ack registra que não há provider concreto `existingUiContextFor/requestFor` montado por aquela proposta.
- **C32,MixedSource61:** corrigiu a forma da projeção Procurement e reforçou fontes/autoridade. Não se descreve o antigo desencontro estrutural37 como defeito atual. A release61 mantém M31/MI07 abertos.
- **C33,C12-recovery65:** reforçou intenção original, reserva, recibo e recuperação. Não introduziu nova aprovação financeira. Apply `a2d08250d5104285dcdee87d86e39076535cf554`, prepared-apply `a2bb5e7f74d7f1ac7c29ff3c604df14e11d30119` e receipt-review-binding `b8c6af0cd15dbafc70c543901ca922701748537a` pertencem ao material integrado preservado; C45/terminal71 não altera esses paths.
- **C37,privacy73 e C45,egress86:** mantêm visibilidade/privacidade de Requests/anexos e entrega autorizada de downloads. Não fornecem aprovação destacada nem moeda inicial.
- **C42/C43/C44,80/76/74:** custo, leitura de resultados e transporte foram integrados antes de13. Seus resultados de fonte não são aceitação financeira52; produto89 não foi consumido neste trabalho.

Os pins completos dessas integrações e suas releases permanecem no draftv6, SHA256 `e38bfcd4ca96ee27cabbb04abe53e86e573599bbbb9f67d837a542e17e30c7f8`, e nos artifacts citados ali. Esta revisão preserva esse histórico sem declarar atuais os blobs de Application anteriores ao86.

## Assertions e decisão necessária do proprietário

A identidade financeira e suas assertions continuam: criação pela UI de USD100/v1/draft; fontes reais Planner e Procurement; alternativas120/140; diferença conhecida1200 e completa null; regra numérica humana; escolha140 com subtotal conhecido2400 e total null; releitura da PR ainda100/v1/draft; aprovação formal exata140 por holder/estágio corretos; Apply C12 e recuperação do único recibo. Essas etapas posteriores a Requests **não foram executadas com sucesso pelo caso15**.

O próximo ato pertence a **S0/WP00 e aos proprietários Procurement/C12 autorizados**. Há duas decisões separadas: liberar uma pré-condição inicial legítima para a instalação e definir o comando canônico compatível de aprovação/admissão do replacement ainda não escrito. Esse comando precisa vincular ator, holder, política, source/target incarnation, case/choice/version, amount/currency e digest; consumo único e recibo recuperável continuam necessários. Não é possível fornecer um patch funcional honesto dessa semântica antes da decisão do proprietário.

Os cinco casos e seus budgets180000ms, expectativas originais, ações UI e identidades permanecem obrigatórios. O caso financeiro não é removido; suas falhas não viram skips. A missão52 não substitui o fluxo por seeds, chamadas diretas de mutação, aprovação fabricada, componente isolado ou timeout ampliado. A matriz83 da missão continua independente desta revisão; esta auditoria não promove critérios.

## P11 de autenticação: proposta inerte, sem aprovação financeira

P11 é um patch compartilhado entregue ao proprietário para qualificação isolada; não está integrado ao target. Os dois arquivos são `runtime/local-store.ts` (`d9eaac043514141abb2f1f978a6fd2ceaf4040d6` → `5d7bccf29c38bc6a6b83ec2f2b3d543640b8dada`) e comentário em `runtime/auth-maintenance.ts` (`af6e6749f7b61e07c419c90a264fdc48f3b32e21` → `6f024be93e31329270cc266742038a6e58807b1c`). O material integral tem SHA256 `03a6d04820708feba67fa634c37b36fa6d4f40d4293911bef9a0504dd0f9284f`; patch `e302481a39c252682c98f9d446de41f7b4b284dc598cfc7f0489bc4ca0838615`.

A proposta reutiliza somente uma conexão de SELECT independente em autocommit, conservando cada leitura de credencial, revalidação e revogação. Mantém checagens de scope, aborto, lifecycle e identidade física do banco antes/depois, sem cache de ator/ACL/valor e sem mudar filas/writers. A ordem real de concorrência é liberar a raiz BEGIN IMMEDIATE antes do COMMIT do peer; a revogação local pendente é outro mecanismo.

O recibo real de [Unit04, run43680704374](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43680704374), job132710474992, registra **20PASS/0FAIL/194expects**, três arquivos, sobre o mesmo W `c725f9b8307a84562258c478414ec0b39d428b99` usado no nominal15. São dez casos novos P11 e dez controles Auth72 existentes; o recibo tem SHA256 `af67a6584935c670ea3d8cfd0ae5dd4d4ae6fe7fa6bf3c052547a5af4beabbf5`. Esse resultado comprova apenas os contratos selecionados de autenticação. Não aprova a jornada financeira, não promove M31/MI07 e não demonstra ganho de latência. A revisão estática independente atual continua SHA256 `d85a0aa646c46da2b22873365f98eee7dc4847111da01d2cedbdb83fe2e486b6`.

O nominal15 executou P11 no candidato isolado e ainda terminou3PASS/2FAIL. J1 alcançou duas comparações200 e registro de regra200, mas a terceira comparação terminou requestfailed sem resposta observada. O run não possui perfis de servidor; não atribuímos o abort a SQL, CPU, P11 ou um estágio do produtor a partir de duração de teste/step. Choice e a captura P9 continuam NOT_REACHED nesse run. O problema financeiro permaneceu a pré-condição Requests, observado novamente em15, sem extrapolação do13.

## Autoridade e destino do handoff

O [AUTHORITY terminal71](https://github.com/gustavomhss/Orchestra-SF/blob/384f9eb172f0e6761a2af1e92d8b4bb11d9b01df/modules/sucafina/Sucafinav1/docs/sf2h/receipts/integration/release-wave-71/AUTHORITY.json), blob `8578861cbb3c7a028802e90770a89578e2d2391d`, declara **ENDED_AFTER_TERMINAL_DOCUMENTARY_CAS**, epoch `S0-C-e13-browser71`. Seu [HANDOFF](https://github.com/gustavomhss/Orchestra-SF/blob/384f9eb172f0e6761a2af1e92d8b4bb11d9b01df/modules/sucafina/Sucafinav1/docs/sf2h/receipts/integration/release-wave-71/HANDOFF.md), blob `9d1f4b7169fe32f4fcb35429125fe644e080d54e`, entrega C45, mantém M31/MI07/C12 e exige nova designação S0, reconciliação e ACK para outro writer. O ACK71 histórico `4a8d61f0cf8ad10a7ff4414bb0558f7a18f890d2` não mantém a lease ativa após esse terminal.

**47 continua como destinatário solicitado do handoff52**, através da sucessão registrada; não é tratada como integradora ativa.52 não assume autoridade de47,71 ou um sucessor. **Target writes52=0.** Source52 `20944c7cc1ef0fb7254793a421468ac12300356d` permanece ACTIVE conforme o checkpoint atual informado pela raiz; este draft não publica terminal52. O censo71, blob `ca5890ed5addf5924a572dd089fedb001729743b`, fotografa um checkpoint52 mais antigo, `554e4e692318c952fdd1b365eb233d7c1b6d8cf5`; não é usado como HEAD atual da fonte nem como resultado das tentativas posteriores.

Checks/lanes45 e aceite finalS0 conservam seus escopos. Reports48, workflows45, Procurement/C12 e CurrentChoice46 permanecem sob seus proprietários. Nenhum resultado de86, Auth72, componenteP11 ou outro autor é transferido para52. **GLOBAL_RELEASE=false.**

## Limites de aceitação depois do nominal15

O resultado é **3PASS/2FAIL**, com cinco casos executados, zero skips, zero retry e budgets originais. Não há quatro jornadas independentes concluídas neste corte, nem aceite financeiro. O progresso parcial de J1 e os20PASS de autenticação não completam Choice/histórico/P9/C12. A próxima execução precisará de evidência própria no SHA realmente executado; nenhum resultado futuro é presumido.

## Índice de evidências desta revisão

- Auditoria remota atual: `/workspace/scratch/fec39c0682b3/m52-audit/financial-current-c45-read-audit.json`, SHA256 `4c36168a024221e19107612a6d67576310ba5c5d0ae5c04f672b41a8b24d720f`. Inclui os conteúdos diretos atuais, hashes, commitsC45/terminal, manifesto86, autoridade71, consumer53 e M31-S0.
- Delta textual completo de aplicação: `/workspace/scratch/fec39c0682b3/m52-audit/financial-c44-c45-application.diff`, SHA256 `c0c754f22b5ef7ee3d97478b2c1c6e173428884c62e1e48f994c4a2d0958af89`.
- Runtime financeiro mais recente: `/workspace/scratch/fec39c0682b3/m52-audit/nominal15-43680980170/nominal-15-receipt.json`, SHA256 `24ab7a11603e37cc9703d83a39f0896c7951ab8a140aa459877162dec6c22f16`; ZIP e evidências individuais na tabela inicial.
- Extração financeira independente15: `/workspace/scratch/fec39c0682b3/m52-audit/financial-nominal15-final-evidence.json`, SHA256 `666e1c5c041ec81770997034a4649f616a515eed345868aa25fbf4158eccc09d`; confirma título, form0, GET503, nenhuma mutação e pins do envelope.
- Preimages e análise anteriores: `financial-current-c44-read-audit.json`, SHA256 `49588ae44cba90516744260948de38b19e6e644f8c36685ddec480ad29c4ef4b`; draftv6 e revisões anteriores preservados.

Atividade deste auditor: GitHub MCP somente leitura e escrita de artifacts derivados em scratch. Zero execução de produto, testes, builds, typechecks, dispatches, mudança de política ou escrita remota. O CI pertence à raiz; os resultados citados são recibos existentes, com escopo separado das inferências estáticas.

