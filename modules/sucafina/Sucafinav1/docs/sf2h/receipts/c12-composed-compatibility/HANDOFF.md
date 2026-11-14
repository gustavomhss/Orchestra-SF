# Missão32 — handoff para a sessão23: composição C9 qualificada

## Resultado e limite de fechamento

**A compatibilidade C12 foi implementada e comprovada na closure da composição real fixada nesta missão.** A reprodução distinguiu a reconciliação fresca legítima de um defeito material: o executor podia vincular o recibo do efeito150 a uma choice concorrente alterada para900. O delta agora recusa essa alteração, fecha a janela entre admissão e captura do executor e recusa identidades duplicadas, preservando o efeito e o recibo originais.

A prova atual da composição C9 tem **22/22 cenários aprovados em um run: 15 C12 e 7 OPS-REV-02, com 570 assertions**. O caso WP04 de alias é reutilizado separadamente por identidade da sua closure direta. Os resultados anteriores W0–W3 permanecem preservados; o run de W2 continua failure. Não se alega um run único verde de23 testes.

**Checks anteriores: CLI typecheck PASS e guards PASS; Sucafina typecheck FAIL pelo TS2741 herdado do caller WP14**, fora da autoridade C12. Após o ajuste autorizado da fixture, os checks da nova origem serão executados pelo mesmo workflow; este registro não antecipa seu resultado. O caller já está corrigido no bundle fixado, sem inferir um typecheck executado nesse bundle.

Entrega funcional: implementação/testes e patches entregues na mesma **PR60 / procurement-apply**, prontos para consumo pela sessão23. A integração em `sf2-stack` e a qualificação do SHA efetivamente integrado pertencem à sessão23; o aceite final permanece com o coordenador S0. **Nenhum aceite global é concedido.**

## Autoridade, predecessores e preservação

- Campanha: `sf2h-integral-20261112`; T0: `2026-11-13T04:01:10Z`; planejamento fixo: `dbf9547211d9b0fade619790de7c19c0869b7c7d`; lease: `c12-browser32`.
- Missão32 lida integralmente em `86dfe5cd709a4d1701a21b877c2feb92924b08c8`, blob `78a9f99ae73afe10349db06518f8cdcfb657c746`. COMMON da validation-wave, blob `6cdf29c62aa06307aa4d5fb4137b34b1baa84dc1`.
- AGENTS, blob `643ec9f8f960895b2e3294f7f2cc25db6f8488e4`; START, WORKFLOW, execution/COMMON e pack S4-A completo com anexos em `docs/sf2h-plan/`, no planejamento fixo. Pack blob `75ead4aae6187f440df6d9f9cdda6b10e444da13`; COMMON de execução `d61f32af03fe10747a50274233f953af044decf6`.
- Protocolo CI em `a3d29d011ba3607a57914701300f09117a3e2de9`; interface existente preservada.
- Antes da edição, o head da PR60 foi conferido como `c8a03c4f689025ca70a1c815fd292af22b6261cd`, igual ao observado pela missão. O [handoff terminal19](https://github.com/gustavomhss/Orchestra-SF/blob/c8a03c4f689025ca70a1c815fd292af22b6261cd/modules/sucafina/Sucafinav1/docs/sf2h/receipts/c12-receipt-recovery/HANDOFF.md), blob `f4fe7dafe006297ec4fe8644ac9ecd0f88945152`, permanece byte-idêntico no head verificado antes deste commit documental.
- O `increment-01.json` da sessão23, blob `ab183d90ae95c243f52c39a915b5c403b617e460`, foi consumido como observação estática a reproduzir, sem presumir qual lado estava errado.
- O escopo integral da campanha continua preservado: 15 WPs, 74 tarefas, 17 contratos e 1.610 critérios. Esta missão não os reclassifica como aprovados.

A base da PR continua `astra-operations`. Todos os avanços da origem usaram GitHub MCP com expected-head CAS e `force:false`. Nenhum arquivo anterior foi removido. Os recibos OPS-REV-02 e C12 da missão19 foram conservados, inclusive seus FAILs e limites.

## Closure composta C9

A composição inicialmente observada era `253baad3f2ff4af5beac695feae4c2f6372dc2e7`. A reconciliação inicial fixou seu filho documental publicado `402a091485e11d60dff433049c7dedd7fcead687`. A conferência final encontrou uma publicação material C9, **`2c44f5d63b6f1a09bd81610be6fe3a1087f6daa0`**, root tree `2dba7fd244afcd39b837b1e61406de1e43450bb5`, doze commits após a base inicial. Essa base foi fixada para uma única requalificação delimitada, sem mover `sf2-stack` ou acompanhar indefinidamente seus próximos heads.

O candidato atual é **W4 `ba731ff646d8ed7a1c7fb15bf82f4e8c5a2ef81a`**, tree `c46c6dbb4d0e1bdc84da7ab21812f16e4bcc9b04`, filho direto da publicação C9. O snapshot S4 é `114b1c3ff83a038b515f4afcf5db0fc795d59b6d`, tree `3978a370af7a9da7ffee4db1eaf8ba137162df60`, acrescentando apenas `.ci-run.json`.

| Subtree do W4 | SHA |
| --- | --- |
| product | `9a1cc43bf51e6115d2edf2d7a87ca6e33567f9cb` |
| test | `8a1a822601ef3d44b94df0a2d94c24af071eeff8` |
| runtime | `46c24e8b1e54af03501b1b401a251285fa008d82` |

[closure.json](closure.json) fixa o tree completo, os onze deltas permitidos (dois de produto e nove de testes/helpers) e as dependências por SHA/path/blob. A [closure anterior](https://github.com/gustavomhss/Orchestra-SF/blob/8b7497a271c5afbd8604927f75b2a86a4f960bae/modules/sucafina/Sucafinav1/docs/sf2h/receipts/c12-composed-compatibility/closure.json) e o primeiro handoff terminal permanecem no commit8b7497a, com seus W/S e resultados intactos.

| Dependência publicada preservada | Blob na base C9 e em W4 |
| --- | --- |
| `product/decisions/case-port.ts` | `2bbcf63bb0fa56dd3a93190f7711f99aef2efb74` |
| `product/host-binding/state-provider.ts` | `71ce2ba1b04d3c7f63f7c444ca23dd084a8e2b0c` |
| `apps/cli/src/sucafina-product/business-services.ts` | `ce3a281bf07819f90af7fad10f98861980f3273b` |
| `apps/cli/src/sucafina-product/host-context.ts` | `2bf1e6e66c13dd099029ec16b1f1ddf1f698dae6` |

Os dois primeiros paths são relativos a `modules/sucafina/Sucafinav1/`. A origem final de código/testes é `a20f8701f8e8d8a5e75a1dc66e47de1ef8a2dfe1`. Seu executor, blob `605ad1fbd9167b8234aa614a01638724e87f36f5`, continua distinto do executor composto, blob `65d2a0518427b1454aa665ef744bce7564ed8049`. Reservas application-attempt, clones, releituras autoritativas, reconciliação fresca e retenção final do Finance integrado são preservadas. Copiar o executor antigo da origem não constitui consumo válido.

A fixture C12 agora encaminha o callback original para C08 quando o hook final não está armado, preservando a identidade do seletor da publicação C9. Quando o hook está armado, conserva o wrapper e seu ponto real de revogação antes da autorização final. Isso não altera dados, resultado ou assertion e não concede aceite de desempenho C08. Não há aceite de Routines inferido dessa seleção.

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
| Edição alheia após commit | Apply200, retry200 e recover200; efeito único, recibo único, case3→5, choice/objetivo preservados, zero mutações no replay. Recibo `73e6cfc9-ef08-4e35-980a-73cbad3caf74`. |
| Resposta perdida com recibo ainda não vinculado | Resposta interna real503 descartada no transporte; retry normal409; após reabrir serviços/C08/SQLite e criar browser context novo com storages vazios, recovery200→200 com recibo `f1289bf2-4d96-48a3-b14d-b35349275898`. Um efeito150, versão de domínio1/Alice/um Saved; case3→4→5. |
| Resposta200 já reconciliada perdida | Recuperação200 do mesmo recibo `f75b5328-d5bd-4d1d-b510-17c2123c9632`, sem nova mutação/efeito. |
| Segunda edição depois da captura fresca | Primeiro recovery503 `case-reconciliation-pending`; edição preservada; próxima recuperação200, mesmo recibo `c86094d8-3f32-49ed-9427-4b6b4b639b92`, sem duplicação. |
| Choice150→900 depois do efeito | Apply409 `prepared-choice-changed`; um efeito/recibo150, zero vínculo novo; case3→4 e edição material preservados. Recuperação posterior409 por incompatibilidade da intenção. |
| Alteração entre admissão e captura | Recovery403 `case-access-unavailable`, sem ID divulgado; nova admissão409 `application-intent-mismatch`; único efeito/recibo e edição preservados. |
| Choice ou PreparedChange com ID duplicado antes da admissão | Dois casos409 `prepared-case-changed`; original mantido primeiro, duplicata divergente preservada, snapshot durável idêntico depois da recusa, zero redispatch/vínculos novos. |
| Review falso / versão antiga antes do primeiro dispatch | 403 / 409; recovery sem recibo503; domínio100/versão0, zero efeitos/recibos. |
| Intenção durável sem recibo | Recovery503 e retry comum503 indeterminado; zero efeitos/recibos. |
| Principal, payload, digest, case, choice/change, alvo, chave ou encarnação divergentes | Recusas conforme fronteira, sem divulgação/alteração durável. Restaurar os bytes originais permite recuperar o recibo original. |
| Revogação na retenção final | Original recover chamado uma vez, retorno interno exato `unavailable/receipt-authority-changed`; HTTP403 exato `denied/case-selection-authority-changed`. Sem ID/alteração durável; reautorização permite200; recriação física recebe403; zero efeitos duplicados. |
| Execução parcial | Procurement recupera seu recibo; recuperação estrangeira409; Planner continua planned, sem recibo/efeito/aprovação fabricados. |
| Regressões preservadas | Sete OPS-REV-02 passaram novamente em W4. O caso WP04 de inputs preparados é evidência separada de W2, com closure direta inalterada. |

Os IDs acima são recibos sintéticos realmente emitidos pelo harness em W4. Os marcadores e resultados estão em [validation-04/result.json](validation-04/result.json). Os recibos validation-02 e validation-03 preservam separadamente os IDs e conclusões da qualificação anterior.

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
| Composição publicada C9, W4 | `ba731ff646d8ed7a1c7fb15bf82f4e8c5a2ef81a` | `114b1c3ff83a038b515f4afcf5db0fc795d59b6d` | [43646007759](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43646007759) / `132603819490` | PASS: 22/22, 570 assertions, nove arquivos, 402,01s. |
| Checks anteriores da origem | `067b5cd37c09b2066dbd1a847942f8cac2ff8c40` | `e94f8ba7a91a1f384f96cd5f02b5e25d0caec428` | [43644816495](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43644816495) / `132600114060` | FAIL agregado apenas pelo TS2741 herdado; CLI e guards PASS. |

Cada S de teste é filho direto do W e acrescenta apenas `.ci-run.json`. O S de checks acrescenta somente `.astra-operations-check.json`. Não houve testes locais, servidores locais, epic/full suite, rerun inalterado ou dispatcher novo.

A reprodução permanece vermelha. O erro sintático inicial e o mismatch de egress foram registrados, diagnosticados e corrigidos antes de suas repetições. W2→W3 altera apenas o corpo do teste que falhou e seu diagnóstico. Produto, fixtures, imports e os demais 22 corpos permanecem idênticos; o filtro exato reexecutou somente o caso afetado. Os oito passes de W1 não são necessários para a prova final. A publicação material C9 e o encaminhamento do seletor pela fixture motivaram W4; os22 cenários afetados foram reexecutados uma vez. O alias WP04 não foi repetido porque sua closure direta permaneceu idêntica.

Omni em W4: **pass**, nonce `2518f58e18caab01f544b1da18395a25`, dois spawns e zero delegated. O PASS histórico de W2 e seu nonce permanecem no respectivo recibo. Nas seleções sem browser, os controles foram **not applicable**, sem alegar prova Omni. Os runs Bun produziram zero artefatos; os logs permanecem hospedados e os fatos estruturados estão commitados.

## Typecheck e guards anteriores; atualização pendente

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
| [bundle-tests.patch](patches/bundle-tests.patch) | SHA256 `32c2af29218e696992d42a67884d4b8d7ac64f68a2868872fe26642644c816ca`; nove caminhos próprios de testes/helpers. |
| [manifest.json](patches/manifest.json) | Base2c44f5d, targetba731ff, todos os preimages/postimages e integridade estática dos11/11 paths. |
| [INTEGRATION.md](INTEGRATION.md) | Procedimento de consumo e fronteiras entre origem, bundle e candidato integrado. |

A sessão23 deve reconciliar o head atual, conferir os preimages e consumir os deltas completos sobre o executor Finance retido, preservando seus demais avanços. Copiar `apply.ts` inteiro da origem perderia diferenças de composição. Se seu tree divergir, requalificar o delta e atribuir a evidência ao SHA efetivamente executado.

A publicação documental de C9 registra o resultado real do W4, atualiza os patches consumíveis e conserva o primeiro fechamento no commit8b7497a. O check da origem após a mudança da fixture será registrado separadamente; nenhuma evidência da origem é transferida ao bundle.

Permanecem fora deste fechamento: aceite global IOPS02/first-save/lost-register, AM04 integral, toda a navegação Workbench, execução IA/nativa e C/D/GLOBAL_RELEASE. A prova UI usa shell GET mínimo com renderer/script e POSTs reais; a reabertura reconstrói serviços/C08/SQLite no mesmo processo Bun. Não houve restart do Orchestra, merge/deploy/Azure/credenciais/mudanças de engines, mensagem a terceiros ou novo controlador. Todos os runs funcionais desta missão terminaram; o novo check da origem ainda será registrado antes do fechamento terminal.
