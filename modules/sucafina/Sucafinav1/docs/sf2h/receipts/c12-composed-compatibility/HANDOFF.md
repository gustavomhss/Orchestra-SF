# Missão32 — handoff terminal para a sessão23

## Resultado e limite de fechamento

**A compatibilidade C12 foi implementada e comprovada na closure da composição real fixada nesta missão.** A reprodução distinguiu a reconciliação fresca legítima de um defeito material: o executor podia vincular o recibo do efeito150 a uma choice concorrente alterada para900. O delta agora recusa essa alteração, fecha a janela entre admissão e captura do executor e recusa identidades duplicadas, preservando o efeito e o recibo originais.

A prova funcional combina **23 cenários distintos aprovados: 15 C12, 7 OPS-REV-02 e 1 WP04**. São 22 passes individuais no W2 e o caso restante aprovado isoladamente no W3. O run de W2 continua **failure**; não existe nem se alega um run único verde com 23 testes.

**CLI typecheck PASS e guards PASS. Sucafina typecheck FAIL exclusivamente pelo TS2741 herdado do caller WP14**, fora da autoridade C12. O workflow de checks da origem permanece **failure**. O caller já está corrigido no bundle fixado, mas isso não representa um typecheck executado nesse bundle.

Estado terminal: implementação/testes e patches entregues na mesma **PR60 / procurement-apply**, prontos para consumo pela sessão23. A integração em `sf2-stack` e a qualificação do SHA efetivamente integrado pertencem à sessão23; o aceite final permanece com o coordenador S0. **Nenhum aceite global é concedido.**

## Autoridade, predecessores e preservação

- Campanha: `sf2h-integral-20261112`; T0: `2026-11-13T04:01:10Z`; planejamento fixo: `dbf9547211d9b0fade619790de7c19c0869b7c7d`; lease: `c12-browser32`.
- Missão32 lida integralmente em `86dfe5cd709a4d1701a21b877c2feb92924b08c8`, blob `78a9f99ae73afe10349db06518f8cdcfb657c746`. COMMON da validation-wave, blob `6cdf29c62aa06307aa4d5fb4137b34b1baa84dc1`.
- AGENTS, blob `643ec9f8f960895b2e3294f7f2cc25db6f8488e4`; START, WORKFLOW, execution/COMMON e pack S4-A completo com anexos em `docs/sf2h-plan/`, no planejamento fixo. Pack blob `75ead4aae6187f440df6d9f9cdda6b10e444da13`; COMMON de execução `d61f32af03fe10747a50274233f953af044decf6`.
- Protocolo CI em `a3d29d011ba3607a57914701300f09117a3e2de9`; interface existente preservada.
- Antes da edição, o head da PR60 foi conferido como `c8a03c4f689025ca70a1c815fd292af22b6261cd`, igual ao observado pela missão. O [handoff terminal19](https://github.com/gustavomhss/Orchestra-SF/blob/c8a03c4f689025ca70a1c815fd292af22b6261cd/modules/sucafina/Sucafinav1/docs/sf2h/receipts/c12-receipt-recovery/HANDOFF.md), blob `f4fe7dafe006297ec4fe8644ac9ecd0f88945152`, permanece byte-idêntico no head verificado antes deste commit documental.
- O `increment-01.json` da sessão23, blob `ab183d90ae95c243f52c39a915b5c403b617e460`, foi consumido como observação estática a reproduzir, sem presumir qual lado estava errado.
- O escopo integral da campanha continua preservado: 15 WPs, 74 tarefas, 17 contratos e 1.610 critérios. Esta missão não os reclassifica como aprovados.

A base da PR continua `astra-operations`. Todos os avanços da origem usaram GitHub MCP com expected-head CAS e `force:false`. Nenhum arquivo anterior foi removido. Os recibos OPS-REV-02 e C12 da missão19 foram conservados, inclusive seus FAILs e limites.

## Closure composta

A composição inicialmente observada era `253baad3f2ff4af5beac695feae4c2f6372dc2e7`. A reconciliação inicial fixou seu filho documental publicado `402a091485e11d60dff433049c7dedd7fcead687`, tree `006339cc3a61de9bf99d2ba17069181bd5d8a02e`.

O candidato final é **W3 `796f7d75310eba98a847a5ad9a5d4a5cec7e3de7`**, tree `62e159dbeab941069f702bfb7718ec5faa7e8dce`. Seus subtrees são:

| Subtree do W3 | SHA |
| --- | --- |
| product | `7fbf29cfcf13f0e88977bc3c1b04e6e053e7b53a` |
| test | `ce7f2507957738c51134538f13911bad7995b67e` |
| runtime | `46c24e8b1e54af03501b1b401a251285fa008d82` |

[closure.json](closure.json) distingue explicitamente os trees da base dos trees do W3 e fixa os caminhos/blobs de produto, testes/helpers, CI, manifests e lockfile. O root tree identifica toda a closure rastreada; o delta em relação à base limita-se a dez caminhos autorizados.

A origem final de código/testes é `6f61cc332b4ebfa4a45313cd69da9dd99d4ab4fe`. O executor da origem, blob `605ad1fbd9167b8234aa614a01638724e87f36f5`, continua distinto do executor composto, blob `65d2a0518427b1454aa665ef744bce7564ed8049`. Não se substituiu o executor Finance por uma fixture ou pelo arquivo antigo da origem. Reservas `application-attempt`, clones, releituras autoritativas, reconciliação fresca e retenção final foram preservados.

## Correção efetiva

| Arquivo permitido | Delta desta missão |
| --- | --- |
| `product/decisions/apply.ts` | Captura digest da escolha original; exige identidade única de choice e PreparedChange; recusa alteração material/duplicação antes de vincular o recibo. |
| `product/procurement/decision-host.ts` | Vincula a autorização ativa à choice da admissão canônica, sem abrir leitura persistente aninhada; exige identidade única e fecha a janela admissão→captura. |

`product/procurement/decision-http.ts` e `product/ui/decision-apply.ts` não foram alterados nesta continuação; seus blobs permanecem `fa83ce380647f02d8942f01ffbc1981cf1b2494d` e `a182c632c1714e3c48e6be07142adc7ed87d8f13`.

O comportamento preserva CAS e review no primeiro Apply. A reconciliação fresca é permitida para edição alheia que conserve a intenção original. Recuperação explícita resolve o recibo original sob autoridade atual; a ausência de recibo nunca concede novo dispatch. Estado parcial com Planner pendente permanece verdadeiro.

Não houve edição em Finance producer/result-store, state-provider, case-port, UI de choices/alternativas, host compartilhado, engines, dependências ou arquivos da sessão31. Nenhum teste fora dos namespaces próprios foi modificado.

## Prova funcional observada

| Cenário | Resultado executado |
| --- | --- |
| Edição alheia após commit | Apply200, retry200 e recover200; efeito único, recibo único, case3→5, choice/objetivo preservados, zero mutações no replay. Recibo `a280993e-9a21-417a-bdca-bebf4a4ecc55`. |
| Resposta perdida com recibo ainda não vinculado | Resposta interna real503 descartada no transporte; retry normal409; após reabrir serviços/C08/SQLite e criar browser context novo com storages vazios, recovery200→200 com recibo `a814f8ff-1af0-4840-995a-f02eb0315b3d`. Um efeito150, versão de domínio1/Alice/um Saved; case3→4→5. |
| Resposta200 já reconciliada perdida | Recuperação200 do mesmo recibo `40788edb-10f0-4d7f-a361-ed107ef7aa98`, sem nova mutação/efeito. |
| Segunda edição depois da captura fresca | Primeiro recovery503 `case-reconciliation-pending`; edição preservada; próxima recuperação200, mesmo recibo `b6f3c7fe-7872-4167-b3ce-d42285aa7a28`, sem duplicação. |
| Choice150→900 depois do efeito | Apply409 `prepared-choice-changed`; um efeito/recibo150, zero vínculo novo; case3→4 e edição material preservados. Recuperação posterior409 por incompatibilidade da intenção. |
| Alteração entre admissão e captura | Recovery403 `case-access-unavailable`, sem ID divulgado; nova admissão409 `application-intent-mismatch`; único efeito/recibo e edição preservados. |
| Choice ou PreparedChange com ID duplicado antes da admissão | Dois casos409 `prepared-case-changed`; original mantido primeiro, duplicata divergente preservada, snapshot durável idêntico depois da recusa, zero redispatch/vínculos novos. |
| Review falso / versão antiga antes do primeiro dispatch | 403 / 409; recovery sem recibo503; domínio100/versão0, zero efeitos/recibos. |
| Intenção durável sem recibo | Recovery503 e retry comum503 indeterminado; zero efeitos/recibos. |
| Principal, payload, digest, case, choice/change, alvo, chave ou encarnação divergentes | Recusas conforme fronteira, sem divulgação/alteração durável. Restaurar os bytes originais permite recuperar o recibo original. |
| Revogação na retenção final | Original recover chamado uma vez, retorno interno exato `unavailable/receipt-authority-changed`; HTTP403 exato `denied/case-selection-authority-changed`. Sem ID/alteração durável; reautorização permite200; recriação física recebe403; zero efeitos duplicados. |
| Execução parcial | Procurement recupera seu recibo; recuperação estrangeira409; Planner continua planned, sem recibo/efeito/aprovação fabricados. |
| Regressões preservadas | Sete OPS-REV-02 e o teste WP04 de retenção dos inputs preparados passaram sobre o produto corrigido. |

Os IDs acima são recibos sintéticos realmente emitidos pelo harness. Os marcadores estruturados e as assertions estão preservados em [validation-02/result.json](validation-02/result.json) e [validation-03/result.json](validation-03/result.json), com links aos logs Actions.

## Cada oráculo alterado

[ORACLES.md](ORACLES.md) contém os pointers canônicos exatos de C12/C03/C08/C09/C16 e dos anexos. [ORACLES-EGRESS.md](ORACLES-EGRESS.md) trata a diferença final entre executor e HTTP composto.

1. O helper novo interrompe somente o retorno depois do commit real de domínio/recibo e de uma edição C08. Assim preserva o cenário canônico de recibo durável ainda não vinculado, agora com primeiro retorno503. O helper antigo que apenas edita e retorna é conservado no positivo fresco200.
2. Em normal-retry, identidade HTTP e UI, as expectativas do primeiro retorno passam a503 porque o ponto de interrupção mudou. Valores, versões, audit/history, escolhas, unicidade e ausência de vínculo permanecem obrigatórios. O retry normal continua409.
3. A segunda edição do teste de CAS é disparada na quarta leitura do recibo, depois da captura fresca. O CAS perdido retorna503 `case-reconciliation-pending`; a edição e o próximo recovery200 continuam obrigatórios.
4. A revogação final conserva a recusa interna `receipt-authority-changed` por observador que chama e devolve o resultado original sem alterá-lo. O HTTP exige o403 e o motivo exato da reautorização de saída integrada. A restauração positiva200, a recriação negativa403 e os bytes duráveis permanecem verificados.

Nenhum oráculo foi convertido simplesmente de409 para200. Não houve remoção de assertions de intenção nem aumento de budgets/timeouts.

## W/S, runs e resultados

| Rodada | W | S | Run / job | Resultado |
| --- | --- | --- | --- | --- |
| Reprodução | `7fd76f647a57e9b9bc1415a4d516791e13b719b4` | `ca03f3f48e19b16acdea15e2b46976180208c139` | [43642218184](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43642218184) / `132592073292` | FAIL: 0 pass/3 fail, 30 assertions. Executor ainda sem correção. |
| Candidato inicial | `05b9486f7c96f3aa793f030d5157c17b7b340ac1` | `7660065a030c5e0e128c1d5947ce6c41d798d583` | [43642889681](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43642889681) / `132594136855` | FAIL: 8 pass/6 fail/6 erros, 122 assertions; helper sem fechamento. |
| Produto corrigido W2 | `9cf37f42eefb080940c7c71e4c2b1c5539459295` | `26cb97baa6ff8be3a4f020cad9ccfccbb1a6d860` | [43643559235](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43643559235) / `132596171206` | FAIL agregado: 22 pass/1 fail, 567 assertions, 23 testes/10 arquivos, 319,41s. |
| Oráculo final W3 | `796f7d75310eba98a847a5ad9a5d4a5cec7e3de7` | `0a316164ce059b113e966810dc0c09cf47e0f76b` | [43644467464](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43644467464) / `132599028141` | PASS: 1 pass/0 fail/4 filtrados, 28 assertions, 26,71s. |
| Checks da origem | `067b5cd37c09b2066dbd1a847942f8cac2ff8c40` | `e94f8ba7a91a1f384f96cd5f02b5e25d0caec428` | [43644816495](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43644816495) / `132600114060` | FAIL agregado apenas pelo TS2741 herdado; CLI e guards PASS. |

Cada S de teste é filho direto do W e acrescenta apenas `.ci-run.json`. O S de checks acrescenta somente `.astra-operations-check.json`. Não houve testes locais, servidores locais, epic/full suite, rerun inalterado ou dispatcher novo.

A reprodução permanece vermelha. O erro sintático inicial e o mismatch de egress foram registrados, diagnosticados e corrigidos antes de suas repetições. W2→W3 altera apenas o corpo do teste que falhou e seu diagnóstico. Produto, fixtures, imports e os demais 22 corpos permanecem idênticos; o filtro exato reexecutou somente o caso afetado. Os oito passes de W1 não são necessários para a prova final.

Omni em W2: **pass**, nonce `cfd0dacd26fb9d185882853d79a0cdc1`, dois spawns e zero delegated. Nas seleções sem browser, os controles foram **not applicable**, sem alegar prova Omni. Os runs Bun produziram zero artefatos; os logs permanecem hospedados e os fatos estruturados estão commitados.

## Typecheck e guards

[checks-01/result.json](checks-01/result.json) registra o resultado completo. W da origem: `067b5cd37c09b2066dbd1a847942f8cac2ff8c40`, tree `bd1e44cbd05e3f55b716a77a8c5ab7d91a85c15c`. O check executou `bun typecheck` em modules/sucafina e apps/cli, e `bun run check:guards --base origin/dev`.

- Sucafina: único TS2741 em `test/product/wp14/source-access-atlas.test.ts(167,41)`, falta de `procurementEvidenceWrites`; blob herdado `fbe627ffde443ff7e2d3b1204bbcf67523404f41`.
- CLI: PASS.
- Guards: PASS, 78 regras, 880 paths acumulados contra dev, 0 gates, 11 warnings, 0 erros. Os 11 WARNs são byte-idênticos aos da missão19, fora do delta C12. A skill `guardrail-usage` foi lida; nenhum ignore, aprovação, regra ou limite foi alterado.
- Base dev: `a1d37698a7bb097c1578f827eba6a19b9917ef07`.
- [Artefato14132869022](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43644816495/artifacts/14132869022): cinco arquivos, 1.578 bytes, SHA256 `eee122db140edc28d012bf3470d428f271b131170e3f3233ef69160921e70fa9`. Download feito pelo GitHub MCP; nenhum log bruto foi commitado.

O patch externo [OPS-CONSUMER-02.patch](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/modules/sucafina/Sucafinav1/docs/sf2h/receipts/WP06/operations-20261114/OPS-CONSUMER-02.patch), blob `2ab9a6b6f18709d5bad95f58247c70ba286a00aa`, já foi consumido no bundle: o caller tem postimage `d7d2a69837560f42438d470b83724c1a61939a73`. Não reaplicar; a pendência da origem é separada. Não houve necessidade de novo patch de teste fora da autoridade desta missão.

Typecheck/guards não foram executados no W composto: o workflow Operations correspondente não existe nessa closure. Não se importou workflow nem se acionou epic para contornar isso. Esse gate do candidato integrado permanece para a qualificação da sessão23/S0.

## Patches consumíveis e próxima ação

| Entrega | Identidade |
| --- | --- |
| [bundle-product.patch](patches/bundle-product.patch) | SHA256 `7b28a6edce5627d7eb14b5865e414805e0cc96a5fc45b764c67165568af77bb8`; dois caminhos de produto. |
| [bundle-tests.patch](patches/bundle-tests.patch) | SHA256 `38947723e50391ca8748d376ae827f482b9d4a49a3fb74393437cf597f55ab80`; oito caminhos próprios de testes/helpers. |
| [manifest.json](patches/manifest.json) | Base402a091, target796f7d7, todos os preimages/postimages e integridade de10/10 hunks. |
| [INTEGRATION.md](INTEGRATION.md) | Procedimento de consumo e fronteiras entre origem, bundle e candidato integrado. |

A sessão23 deve reconciliar o head atual, conferir os preimages e consumir os deltas completos sobre o executor Finance retido, preservando seus demais avanços. Copiar `apply.ts` inteiro da origem perderia diferenças de composição. Se seu tree divergir, requalificar o delta e atribuir a evidência ao SHA efetivamente executado.

Este commit terminal só acrescenta HANDOFF/checks e esclarece duas referências documentais: origem intermediária histórica e subtrees da base versus W3. Não altera produto, testes ou CI, e não recebe execução nova por inferência.

Permanecem fora deste fechamento: aceite global IOPS02/first-save/lost-register, AM04 integral, toda a navegação Workbench, execução IA/nativa e C/D/GLOBAL_RELEASE. A prova UI usa shell GET mínimo com renderer/script e POSTs reais; a reabertura reconstrói serviços/C08/SQLite no mesmo processo Bun. Não houve restart do Orchestra, merge/deploy/Azure/credenciais/mudanças de engines, mensagem a terceiros ou novo controlador. Todos os runs desta missão terminaram.
