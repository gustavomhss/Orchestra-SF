# Handoff — sf-continuation

## SHA e estado

- Base solicitada: `f7dd58e32bc834f1485df20b91adbf759b4c4ad0`.
- **SHA do produto congelado: `3910a644c7fdab1a438c2b5b39d69afc19361709`.**
- Tree do produto: `5c0019a8aa7c0cf80c29f346b15bd5d4ebc8745c`.
- Branch de trabalho/documentação: `sf-continuation`. Seu commit inclui este handoff; não substituir o SHA do produto pelo SHA documental.
- Branch de pacote: `sfa-factory-package`, movida por fast-forward de `4372b98d8e4db09a56f8ad589fb298c8779c84bf` para o SHA congelado.
- Estado: **PARTIAL / BLOCKED — pacote qualificado; verificação final concluída com falhas; integração completa de UI/shards não qualificada.** Não há declaração de tudo verde, GO, deploy ou `SF_ORCHESTRA_WEB_PACKAGE_VERIFIED`.
- Toda inspeção/edição foi por GitHub; execução somente por Actions, sem shell local.
- Este documento substitui os checkpoints anteriores. Histórico completo preservado em [ea3cd2af / handoff anterior](https://github.com/gustavomhss/Orchestra-SF/blob/ea3cd2af85b63da949d850d20e675f5810bf0829/docs/handoff/HANDOFF-sf-continuation.md).

## O que foi mergeado e em que ordem

A tabela abaixo é a ordem real de primeiro-parent desde a base. A raiz executou somente #411, #407, #431, #460 e #395. Os demais merges foram observados em sessões concorrentes. Recortes de shards entraram antes da UI integral; compartilhados posteriores também entraram depois de recortes. Portanto a ordem pedida não foi cumprida integralmente pelo histórico concorrente. Não reescrevemos esse histórico nem apresentamos resultados parciais em runs vermelhos como gates globais verdes.

| Ordem | PR | Merge SHA | Autor da ação nesta sessão | Evidência observada |
|---:|---|---|---|---|
| 1 | [#399](https://github.com/gustavomhss/Orchestra-SF/pull/399) | `a5b15b51b78469a054ba97b0e87fd1e36e31f73a` | concorrente externo à raiz | 44654714455 success; lifecycle/typecheck |
| 2 | [#398](https://github.com/gustavomhss/Orchestra-SF/pull/398) | `589adb7cae06c584e1e51eeac9db7cd24dc987ea` | concorrente externo à raiz | 44654168008 success; 15/0 |
| 3 | [#404](https://github.com/gustavomhss/Orchestra-SF/pull/404) | `5efe5a3ff3a2c382a18b28f0d575825eafab5ede` | concorrente externo à raiz | 44657002119 success; 3/0 |
| 4 | [#401](https://github.com/gustavomhss/Orchestra-SF/pull/401) | `18a913220a6805bef1c62a58a26a310f991d6a0a` | concorrente externo à raiz | 44657153397 success; 9/0 |
| 5 | [#402](https://github.com/gustavomhss/Orchestra-SF/pull/402) | `08854f14d83ab12d8665b0e3787881edbfaabd53` | concorrente externo à raiz | 44658251806 success; 59/0 |
| 6 | [#400](https://github.com/gustavomhss/Orchestra-SF/pull/400) | `392cecab68288d4b669828adc5d1aaa738693d80` | concorrente externo à raiz | 44658520809 success; 1/0 |
| 7 | [#413](https://github.com/gustavomhss/Orchestra-SF/pull/413) | `72830e53adfcb2059575b249e76c88753beb04e8` | concorrente externo à raiz | 44658705334 success; 155 testes + typecheck |
| 8 | [#411](https://github.com/gustavomhss/Orchestra-SF/pull/411) | `7c42282e8b910cc0e10381980f040dee72cb2b19` | raiz Sessão5 | 44660432596 success; 14/0 |
| 9 | [#418](https://github.com/gustavomhss/Orchestra-SF/pull/418) | `c7fc8b4cfc809e8ba46ab7a3ad48dcae2ec46e61` | concorrente externo à raiz | 44661129868 success; 176 testes + typecheck/seleção |
| 10 | [#419](https://github.com/gustavomhss/Orchestra-SF/pull/419) | `c327aad168769ff68a7f700c85c7352a4adc40f8` | concorrente externo à raiz | documentação de evidência qualificada |
| 11 | [#409](https://github.com/gustavomhss/Orchestra-SF/pull/409) | `f4b62403fc2d9c74c6302d745bb4a057cfdd4439` | concorrente externo à raiz | 44661234622 success; 4/0 |
| 12 | [#415](https://github.com/gustavomhss/Orchestra-SF/pull/415) | `1222022bd54282c8086b1da45b0be6ad2f6520ea` | concorrente externo à raiz | 44661599225 success; 8/0 |
| 13 | [#417](https://github.com/gustavomhss/Orchestra-SF/pull/417) | `687759276c2c9121c2cfd20a5994b277ceb7ee4d` | concorrente externo à raiz | 44662549289 success; 5/0, freeze rev11 |
| 14 | [#407](https://github.com/gustavomhss/Orchestra-SF/pull/407) | `d548a76a4e7838bccdb20e98c1ad16fdeca0b391` | raiz Sessão5 | 44657226869 success; 4/0 |
| 15 | [#412](https://github.com/gustavomhss/Orchestra-SF/pull/412) | `d7fa94063e798207ed692026b557d27dfff1aef8` | concorrente externo à raiz | 44662953944 success; 2/0 |
| 16 | [#421](https://github.com/gustavomhss/Orchestra-SF/pull/421) | `d4ded81224e05f2d3b9789b3eec40b9de8a32fa1` | concorrente externo à raiz | 44663777161 success; 21/0 |
| 17 | [#422](https://github.com/gustavomhss/Orchestra-SF/pull/422) | `23f851dbc6b86c0a571dd95f4b2bb2558b9dc1cd` | concorrente externo à raiz | 44664293983 success; 5/0 |
| 18 | [#430](https://github.com/gustavomhss/Orchestra-SF/pull/430) | `838572713fcceb2df96086f9729347fcda87d9e7` | concorrente externo à raiz | 9 gates success; 27/0; recorte B, 12 blobs |
| 19 | [#406](https://github.com/gustavomhss/Orchestra-SF/pull/406) | `062506e92427f9ff41fcb952c0b1559e65076a4d` | concorrente externo à raiz | 44663906249 success; 9/0 |
| 20 | [#432](https://github.com/gustavomhss/Orchestra-SF/pull/432) | `e41c3e18330397ce508a349f52cb3bee8cb07639` | concorrente externo à raiz | 7 casos PASS dentro de runs FAILURE 44657265518/44661562191 |
| 21 | [#431](https://github.com/gustavomhss/Orchestra-SF/pull/431) | `295c2bdca05c2373f821d50aab5d3ee3d3fb218b` | raiz Sessão5 | 44666552454 success; 26/0 |
| 22 | [#427](https://github.com/gustavomhss/Orchestra-SF/pull/427) | `be192011d5cfccc7524fd81d53674b3317005091` | concorrente externo à raiz | 44667039756 success; 2/0 |
| 23 | [#435](https://github.com/gustavomhss/Orchestra-SF/pull/435) | `82d2041d80784e2d905f99dee3bca91c63ef8350` | concorrente externo à raiz | 44667463947 success; 3/0 |
| 24 | [#428](https://github.com/gustavomhss/Orchestra-SF/pull/428) | `573678d0acf9e91654efb7e67af7d30ebe45312b` | concorrente externo à raiz | 44667507711 success; 3/0, 13 filtrados |
| 25 | [#437](https://github.com/gustavomhss/Orchestra-SF/pull/437) | `b180588c63e41eecd6d73d839d078755d68cad3d` | concorrente externo à raiz | 44668705164 success; 18/0 |
| 26 | [#423](https://github.com/gustavomhss/Orchestra-SF/pull/423) | `9fb1514464e75646ec2f96d9ddaf940f1fe2062c` | concorrente externo à raiz | 44666208536 FAILURE; client5/0; Dashboard0/1 |
| 27 | [#440](https://github.com/gustavomhss/Orchestra-SF/pull/440) | `8eb020dd6cb776b18dc006a23403f8b3a5e4a0bf` | concorrente externo à raiz | 44669527682 success; 17/0 |
| 28 | [#425](https://github.com/gustavomhss/Orchestra-SF/pull/425) | `c74724c3e82f9a3fd3bdf2cd5492d966069caed8` | concorrente externo à raiz | 44668900773/44669419937 FAILURE; diagnósticos abaixo |
| 29 | [#426](https://github.com/gustavomhss/Orchestra-SF/pull/426) | `9391cd78afb37883964263f4a43b08aafead131b` | concorrente externo à raiz | 44669752250 success; 5/0/913, freeze rev12 |
| 30 | [#443](https://github.com/gustavomhss/Orchestra-SF/pull/443) | `95d3ffdc5478edcfa0ce012ba7f367ef7ab39259` | concorrente externo à raiz | 9 escopos success; WP05 44654104426 FAILURE12/1 |
| 31 | [#447](https://github.com/gustavomhss/Orchestra-SF/pull/447) | `cad07e37262ebc4888422b4cf549e06c37a9390d` | concorrente externo à raiz | 44669530310 success 3/0; 44670030550 success 1/0 (7 filtrados) |
| 32 | [#444](https://github.com/gustavomhss/Orchestra-SF/pull/444) | `124d5b5c7fbc4a7a57edc0fe1420d38496402a48` | concorrente externo à raiz | 44670481763 success 1/0 (8 filtrados) |
| 33 | [#450](https://github.com/gustavomhss/Orchestra-SF/pull/450) | `18d343f7eb8a3afaca94bb0789ae62bfc886c9c3` | concorrente externo à raiz | documentação de CI/performance pendente |
| 34 | [#438](https://github.com/gustavomhss/Orchestra-SF/pull/438) | `676584ba114e34da0a5ec523caa230746716591e` | concorrente externo à raiz | 44670811024 success 21/0; 44671622213 success 2/0 |
| 35 | [#451](https://github.com/gustavomhss/Orchestra-SF/pull/451) | `82ead34aa68b942b1174f06f8e2c6a0a1f043db9` | concorrente externo à raiz | NOT_REVALIDATED composição; PASS em A3 cancelado/C vermelho |
| 36 | [#456](https://github.com/gustavomhss/Orchestra-SF/pull/456) | `aa751dd731ce91f126a00488dfce16022bb8cb2d` | concorrente externo à raiz | C03 fonte44670314438 success 1/0; composição isolada NOT_REVALIDATED |
| 37 | [#442](https://github.com/gustavomhss/Orchestra-SF/pull/442) | `45514008d7ce275327003c5d92faaeeab2479739` | concorrente externo à raiz | 44673967393 success 18/0 |
| 38 | [#457](https://github.com/gustavomhss/Orchestra-SF/pull/457) | `a1fd4fb7a25814a82a690a6091f29d9041aa225f` | concorrente externo à raiz | 44674216763 FAILURE agregado; 15/16 comandos verdes |
| 39 | [#459](https://github.com/gustavomhss/Orchestra-SF/pull/459) | `a88def25ae2a2347d62e2aeb930e0a50a5ef692c` | concorrente externo à raiz | mesma prova estática44674216763; guard-dev esperado vermelho |
| 40 | [#453](https://github.com/gustavomhss/Orchestra-SF/pull/453) | `6a1cab15959d37d0df7bbc2982c0aaab0a59789e` | concorrente externo à raiz | mesma prova estática44674216763; guard-dev esperado vermelho |
| 41 | [#460](https://github.com/gustavomhss/Orchestra-SF/pull/460) | `a62ce06fd108d7ea274e80efb69bb18f7fd0728e` | raiz Sessão5 | 44674117714 success 3/3 + typecheckE2E; ingresso real |
| 42 | [#395](https://github.com/gustavomhss/Orchestra-SF/pull/395) | `c32e906a92193ae33d32b5106a82ee47b81c0ba4` | raiz Sessão5 | 44670544483 success 143/0; 5 blobs CI/factory qualificados |
| 43 | [#462](https://github.com/gustavomhss/Orchestra-SF/pull/462) | `7eeb29992852a48fccb72cc42c821a5eca3ba84d` | concorrente externo à raiz | 44675815817 success 3/0; Node half-close, C12 continua unbound |
| 44 | [#433](https://github.com/gustavomhss/Orchestra-SF/pull/433) | `3910a644c7fdab1a438c2b5b39d69afc19361709` | concorrente externo à raiz | 44675050868 success 16/0; suíte review-portfolio-http.test.ts completa |

#432, #423, #425, #443, #451 e #456 exigem preservar os limites descritos na tabela. Em particular, #423 mantém Dashboard unbound em `modules/sucafina/Sucafinav1/test/product/wp02/dashboard-browser.test.ts:97:72`; WP05 de #443 teve falha em `modules/sucafina/Sucafinav1/test/product/wp05/procurement-integration.test.ts:182:24`. #451 não ganhou qualificação só por composição de blobs.

O primeiro candidato foi c32e906a, após #395. Guards reais desse candidato foram executados. Antes do único dispatch final, a leitura fresca detectou os merges externos #462 e #433; seus runs concluíram success, o delta foi inspecionado e o freeze avançou para3910a644. Delta de três paths: `apps/cli/src/sucafina-product/review-read-integrity.ts`, `modules/sucafina/Sucafinav1/test/product/wp02/browser-driver-fixture.ts`, e o novo `browser-bridge-half-close.node-smoke.mjs`. Os blobs de CI/factory/ingresso/baselines permaneceram iguais.

### Avanços observados depois do freeze — fora deste CI e deste pacote

Outras sessões continuaram integrando depois do dispatch das04:44:39Z. A cadeia de `sf-join-four` avançou de F até **`3e396b258ab5e10476e9a4e0c38e54a54fa0022b`**, observado no encerramento da corrida. Estes sete merges não fazem parte do checkout testado, dos guards finais ou do pacote desta sessão:

| Ordem posterior | PR | Merge SHA | Horário UTC |
|---:|---|---|---|
| 45 | #467 | `723833ed811117a12b9dca9098a3573ef758a64d` | 2026-11-20T04:57:05Z |
| 46 | #463 | `ad7bf8a6bea5dc8bcc436f39ebd861eeb935f7ee` | 2026-11-20T05:00:44Z |
| 47 | #465 | `a8dab4400ba268402b65b872f3bcfff349176031` | 2026-11-20T05:00:49Z |
| 48 | #469 | `cf28ef09ffb4633854106b6f883a16cc56fb96a5` | 2026-11-20T05:04:56Z |
| 49 | #473 | `e79c2609042d1f54358a222463566fc4e1ee6e8e` | 2026-11-20T05:11:38Z |
| 50 | #466 | `152be1f2bb7f3f5218ea3de06b60c31f37d8093f` | 2026-11-20T05:12:44Z |
| 51 | #470 | `3e396b258ab5e10476e9a4e0c38e54a54fa0022b` | 2026-11-20T05:12:50Z |

O diff posterior contém18paths e21commits alcançáveis; a tabela distingue os sete merges do primeiro-parent dos commits de suas branches. O primeiro deles, #467, entrou às04:57:05Z. Entre os reparos posteriores há o pin de diagnóstico #463, C12 #465, vínculos Budget #467 e recuperação Atlas #466. Não se transfere a qualificação destes trabalhos para os resultados antigos de F.

`sfa-factory-package` permanece em F, e `sf-continuation` contém o código de F mais este handoff. Não houve segundo dispatch, rerun ou deslocamento retroativo dos recibos. Ler o head da integração separadamente antes de retomar.

Na última leitura de PRs abertos para sf-join-four havia **#392,#393,#394,#397,#403,#405,#410,#414,#420,#439,#445,#446,#448,#449,#452,#461,#468**. #461 e #468 estavam ready; os demais shared pendentes listados eram drafts, exceto #393, cuja condição de checks continua separada. O inventário pré-dispatch abaixo permanece como histórico do freeze, não como lista atual após esses merges.

## Parte A — auditoria concluída

### Handoffs e branches antigas

Na base fornecida foram lidos HANDOFF-lastmile-wp1..wp5, finish-ci e finish-units. Os handoffs finish-ingress e finish-operations não constavam desse diretório na base; foram lidos nas respectivas branches antigas, cuja divergência também foi inspecionada.

- `finish-operations-20261119`: head `ee565f567e11c27be68240841f6ebfbd49c9def1`, comparação inicial 49 ahead / 129 behind; handoff parcial, antigo run 44625548030 com1pass/4 fail. O reparo numérico novo não estava qualificado. Branch original preservada; correções isoladas descritas abaixo.
- `finish-ingress-20261119`: head `ba6784f63ffce73267435d38371ebd1956671fdc`, comparação inicial 65 ahead / 103 behind;17 arquivos mínimos já iguais à base. C12 já estava integrado por #391, com runs44632508338/44629501930 success; nenhum gate idêntico repetido. Resto nativo Decisions parcial. Branch original preservada.
- Só escopos novos isolados e qualificados foram integrados; não houve transplante integral das branches antigas.

### Run44631696084

[Run histórico](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44631696084):

- Primeiro erro temporal RPT01: `packages/app-shell/e2e/sucafina/reports-support/review-flow.ts:253:27`, espera da resposta CAP04 original expirada após180s.
- **Primeira asserção explícita RPT02: `packages/app-shell/e2e/sucafina/reports-support/review-flow.ts:177:29`: esperado HTTP200, recebido500 no GET original de dashboard download.** RPT03 teve o mesmo erro.
- RPT04: `review-flow.ts:341:153`, texto do relatório do owner corrente ausente.
- O link “Reports and backup” passou. A falha não se reduz ao link reparado pela Sessão1.
- Typechecks CLI/host/app/SF-E2E passaram. A fonte antiga divergia120ahead/4behind; não foi mergeada integralmente.
- Artefato14582523876 é diagnóstico histórico, não baseline.

### PRs expressamente condicionados

- **#393 OPEN**: head `d8938c31cd818648cfc78828eb32bcb68c04165e`; leitura final via APIs equivalentes a `gh pr checks`: **0 check-runs, 0 statuses, combined pending**. Não existe check failure para inventar, e a condição “todos success” não foi satisfeita. Não houve merge nem status sintético.
- Gate histórico do produtor44632446497 passou7testes/194 expects no snapshot df9280a8; não constitui check do head do PR. As composições Operations declaram dois blobs desse PR como dependência de teste e não podem ser mergeadas integralmente para contornar a condição.
- **#392 e #237 permanecem drafts**, sem ready/merge.
- #396 foi fechado sem merge após substituição pelo ingresso isolado #460; corpo aponta para a substituição e mantém Reports de negócio unbound.
- #257 permanece draft, retargetado para `sf-package-hold` no mesmo SHA da base anterior52d2c24f. Isso preserva o diff e evita sf-ci adicional no push do pacote.

## Escopos da raiz efetivamente qualificados

### #460 — ingresso original, completo somente neste escopo

Fonte de código345cebeedb2b04d3e349bd40f0678c82cfaac215; head documental06b1e5654e7aed2c4786c72263fd5da5c7891548; mergea62ce06f.

[Gate44674117714](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44674117714) **success 3/3 + typechecksE2E**, snapshot af21e61bf9cb52a73482cd99eebb61975395fdcc; jobs136081747586/136083875834 success. Specs originais wp03/native-ingress, bi-installed/installed-planner-ingress e novo reports-ingress. CLI real4174, origem pública3000, credencial/cookie privados emitidos, discovery/context200 com schema/bindings/actor, reload/refresh, logout204/context401 e retirada do DOM privado. Sem replay/fake da resposta. Privacidade de trace/video/screenshot desativada antes de credenciais.

Artefato14602300733,924306 bytes, ZIPsha256 `f5d57d0a477f6de2b7cdc42a8cd067399d62c7c16584b710069310f33ed35a4e`. Não qualifica jornadas completas Reports, Decisions ou BI.

### #395 — reparo factory e retenção factual de candidato a baseline

Head4c115e332f252136d3bccd504ab193a94ef3ff64; mergec32e906a. Reconciliação preservou #425 e mudou somente cinco paths de código/CI e dois handoffs.

[Gate44670544483](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44670544483) **success 143pass/0 fail/5 arquivos/623ms**; snapshot 07ed37e09e8eb7468a20b08fea64829cecaa455c; jobs136070172103/136070935106 success. Auditoria de bytes original do host: Gitblob 3f6863be244ce79dc6538564ac0c0b6b8b58e8c1,95024 bytes,SHA25651641a232525128ea4338034ff095a828204a5411dc7dd3334283c00fe6e57bd. Esse é hash de fonte, não baseline/pacote.

Blobs em F:
- sf-ci.yml `8e1f80672dc315b71806b4ada086e213401301be`;
- gate.test.mjs `f90b1a99b56cedf1ff3d9368e4e1407651157f9e`;
- sf-factory-package.yml `494615b3050bdbc153f5f7731d8e2395f9fab8ae`;
- factory-receipt-check.ts `caa18b28c0a4d732c8a8339f9de153a3c1c5a027`;
- factory-distribution-linux.test.ts `280e68985618c3d19b70425d2ac4b888f0685b90`.

A retenção UI exige teste original exit0 e minimização concluída; rejeição PENDING continua falhando. Retém somente report.json minimizado, nunca raw de credenciais/payload. Factory usa4120, extração fora do checkout, antiforgery/Web/runtime originais e recibo vinculado ao SHA.

Run factory pré-integração44652219809 foi success 13/0/21348 expects,34Omni spawns/0delegados,1413 arquivos/1310Web/0maps. ArchiveSha256 histórico2f25f518095ddf3ade0e4aca36f9c6ba63796655613d9eefa44fcb1fb329af44 **não é hash final**.

### Tipagem dos fixtures — completo e já substituído pela integração

A raiz corrigiu comparação de identidade com Object.is sem mudar semântica, tipagem dos IDs de saúde e AbsolutePath.make no fixture Budget. Composição `sf-native-fixture-types@236a1703278d87e478958a957269b04100e5af66`; código56c37078b7238619a16b9e5ae7273a4485c06b54.

[Gate44675334180](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44675334180) **success**: typecheck canônico com3644arquivos e4/4inputs; **14 pass/0 fail/1385 expects/3 arquivos**. Snapshot1831671428f708f9b7694eb49edd35cc2dc2d658; jobs136085695982/136086099888success. Controle temporário snapshot-only; nenhum relaxamento de compiler/test.

Enquanto o gate rodava, #459 já integrou o mesmo reparo e variante de tipo NonNullable no teste Import. Preservamos essa variante atual, validada na prova estática44674216763; nenhum PR duplicado/overwrite. Handoff completo/superseded no head3dd88c0d63d548bfcdc8b74a481a4a51278a5a01.

### Freeze contratual WP00

Revisão12 de #426: run44669752250success5/0/913, snapshot 690563b2ec4d9a3812f1ff7874fe7bcf0bbbc0ff. Manifest blob 7a8132250131b9d30aaca5a330720bd3e0fa97fa,38 pins verificados; só host e contracts-v1.md atualizados versusrev11. Preserva17contratos,5perfis,18skills,8packs,39operações,AM01–06 e proveniência; consumerAcceptance continua BLOCKED. Não confundir freeze de contrato com baseline de campanha.

## O que ficou aberto e por quê

Snapshot final pré-dispatch, nenhum ramo completo qualificado:

| Ramo | Head observado | Estado / PR | Limite |
|---|---|---|---|
| sf-ui-c02 | edcda3b3eef5318e69bab9601dd63ace540469df | blocked; sem PR integral | Procurement4/8, Reports0/4 |
| sf-shard-a | ace8a3263cf3a8c3546824ddb339a93e351cfb33 | PARTIAL; sem PR integral | A1/A2 failure; A3 cancelled,33 arquivos não iniciados |
| sf-shard-b | b880cb3fd1eed908dccbdcdcc2671c7e5c43d9e6 | IN_PROGRESS; #410 draft | B4/B6 failure; B5 cancelled,14 arquivos não iniciados |
| sf-shard-c | 13394b27c67ef079d467580982da0ed55fad6c39 | IN_PROGRESS; #397 draft | C7/C8 failure; C12 unbound |

PRs abertos observados **antes do dispatch** para sf-join-four: **#392,#393,#394,#397,#403,#405,#410,#414,#420,#434,#439,#445,#446,#448,#449,#452,#461,#463,#465**.

- #403/#405/#414/#420: originais vermelhos/unbound. #434/#439/#445/#446/#448/#449/#452: qualificação causal pendente.
- #461 ready, porém corpo exige aguardar gate composto; o run 44674551510 citado é failure que revelou a causa. Não mergear pela ausência de draft.
- #463 draft de pin C8 aguardando115arquivos; #465 draft de concorrência C12 com gate pendente.
- Verdes focais e gates com casos filtrados não qualificam o ramo completo.
- #425 teve falhas de infraestrutura em ci-efficiency-proof.yml:194 (LFS/worktree) e ci-efficiency-guards.yml:35 (spawn-imports). Prova posterior44674216763 teve15/16comandos0, incluindo7typechecks, geração, E2EshowConfig/compile/inclusion, Web e spawn; só guard-dev saiu1 com0errors/2 gates. Agregado permaneceu failure, sem reclassificação.

### Operations — partial / unbound

Último gate produto [44673130503](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44673130503): **failure 1pass/4 fail**, snapshot e422f2a253414d286df916829727a757eb1f956f, fonte `sf-ops-import-observed@7a22b1a622c10191d58240cdd6acf34ca9cedad7`. E2Etypechecks e ClamD reais passaram. Test136078549491failure; cleanup136080762997success.

- PROC01 passou.
- PROC02/03:60000ms nas declarações `packages/app-shell/e2e/sucafina/operations.spec.ts:18:3` e `:23:3`; não existe nova stack interna. Evidência histórica44666025425 aponta `operations-support/runtime.ts:176`, espera captured.promise após SaveSourcing. Sem causa nova demonstrada, **unbound, parar gates idênticos**.
- Import: UI55 única/pronta passou; controle Source ausente em `operations-support/imports.ts:153:60`.
- Documents: admissão retornou200/ok:true; expectativa antiga value.name falhou em `operations-support/documents.ts:120:24`.
- Artefato14601485562,66737520 bytes, ZIPsha256c0fe6a91c9c6a256ef6d0eb5c98429d0b29834413091e54734f19349e99ffd99.
- Não integrar composição inteira: contém dois blobs não autorizados do #393 e trabalho UI parcial como dependências de teste declaradas.

Dois reparos concretos de oráculo ficaram preparados, sem gate/merge: `sf-ops-oracles@8a0f2961319f651405d9ee2eb08a0330b624a311`, código99162bd58df649763612f0f866582499e6fcc78c. Import usa role combobox com nomes exatos source/Destination em vez de label recursiva que inclui options. Documents prova admissão real por CAP27 UI antes/depois, schema, seleção, contexto, CAS+1, único asset novo, metadados preservados e POSTfilename/bytes; mantém download/digest/reload/revogação. API pública deliberadamente devolve sóok:true. Nenhuma edição do application.ts. Handoff próprio HANDOFF-sf-ops-oracles.md: PARTIAL/ActionsPending.

### Reports — partial / unbound

Último gate produto [44668834875](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44668834875): **failure 0/4**, snapshot cf75dc20a4e42b6945ef4beadffcfc903a323ab3, fonte `sf-reports-retained@6b0af4a38e15d98b82d37c6479ca0695fe50292f`. TypechecksE2E passaram; test136064632432failure,cleanup136068663037success.

- RPT01: request original cancelado durante preparação; `reports-support/retained-response.ts:41:17` /listener77:62.
- RPT02: `reports-support/review-flow.ts:109:29`, UI48 ausente no prazo original10s.
- RPT03:180000ms; cancelamento posterior é secundário, não causa provada.
- RPT04: request original cancelado; retained-response.ts41:17/callback90:69.
- Artefato14598804475,361100 bytes, ZIPsha256da103f3cb2af36383236a38fc21af5b169f7db049fc201276de6710bebd1c5fa. Não é baseline completo.
- Retainer CDP lê corpo original e continua a mesma resposta; exige URL/método/payload/status/cardinalidade e rejeita cancelamentos/redirects; não há fulfill/refetch/replay. Não está qualificado globalmente.

Reader independente [44672368527](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44672368527) **success 1/0**; snapshot 2bdbc66a5b19a3416b151e7014185e62a5eb18f3, handoff `sf-reports-audit@dfca6fde02dd73357ad95ea0551e64c32ce29a4a`. Digest/tamanho do artefato real foram conferidos. RPT04 mostrou confirmação de preservação no snapshot, apesar do cancelamento observado pelo teste. **Correção de inferência:** Playwright1.59.1 captura error-context no fechamento do browser, depois do teardown Reports; portanto o snapshot não prova DOM durante a asserção. Não há causa demonstrada de F01 negado, CSS, loop de discovery ou abort incondicional no transporte. Não relaxar cancelamentos/prazos nem repetir produto sem causa nova.

### Decisions / UI / shards — locais conhecidos para retomada

- Decisions fontefba289d4; gate44654471102failure2/5. Primeiro assert `packages/app-shell/e2e/sucafina/decisions-support/planner-sources.ts:19:24` (esperado1,obtido0); procurement `decisions.spec.ts:26` timeout; discovery `decisions-support/journey.ts:124:24` controle antigo.
- Controles preparados `sf-decisions-controls@caed56eb465eefc80fe5ab2ae0b4e4f8f00dc621`, PARTIAL/não gateados. Contratos de criação de alternativa inicial e catálogo nativo permanecem sem equivalência provada; não substituir por outro produtor/API.
- UI Procurement: `packages/app-shell/e2e/sucafina/wp04/procurement.spec.ts:287`, `:359`, `:502`. Em502 há conflito real: runtime/procurement552–558 omite stored quando não há ação; o teste exige stored cancelado. Não fabricar campo nem alterar política para pintar verde.
- C12: `modules/sucafina/Sucafinav1/test/product/wp02/browser-driver-fixture.ts:385:35` e `modules/sucafina/Sucafinav1/test/product/wp02/recovery-ui.test.ts:210:27` na evidência anterior. #462 qualifica fechamento Node, não startup Chrome/C12 original.
- Shared scenario B6: `semantic-union-source-scenario.test.ts:50:44`; Dashboard97:72 e procurement-integration182:24 já registrados acima.

## Guards

**Resultado no SHA final: 0 errors, 2 GATE herdados, 213 warnings.** O comando original `bun run check:guards --base origin/dev` foi executado pelo job `sf/static-and-contracts` (136089567130) do [sf-ci 44676428710](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44676428710), após todos os merges incluídos em F.

| Comando / base | Resultado real |
|---|---|
| `bun run check:spawn-imports` | exit 0 |
| `bun run check:guards --base origin/dev` | exit 1; 78 regras, 6.261 paths, 0 errors, 2 GATE, 213 warnings |
| Guards contra merge-base do PR | exit 0; 78 regras, 406 paths, 0 errors, 0 GATE, 23 warnings |

Base canônica dev: `c777c057b23f40d835c2c26387954202d4bad4c4`. Merge-base: `1e37b23a27d78a9e2e6dcebf43efb9db00e470d1`. Os dois únicos GATE são `godfile-waivers.json` e `script/spawn-allowlist.json`, ambos `protected-paths`. Em workflow_dispatch não existe label de PR para aprová-los: o job estático permanece **failure esperado** nessa etapa. Geração, sete typechecks, inclusão E2E e build Web passaram.

Evidência original: [artefato 14602533052](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44676428710/artifacts/14602533052), `sf-guard-bases-3910a644c7fdab1a438c2b5b39d69afc19361709-1`, 8.597 bytes, ZIPsha256 `1a53713f2e0e7d2d6ac7346c2a99d54baf0f23adc076a6c1a21b44a318a44fb4`.

O [leitor 44677479946](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44677479946), job 136092650953 **success**, verificou ID/SHA/run, os bytes da ZIP e os quatro checksums internos e imprimiu somente o recibo/contagens reais. **Não reexecutou nenhum comando de produto ou guard.** Recibo factual publicado no [artefato 14602900764](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44677479946/artifacts/14602900764), ZIPsha2567f12ab1e8e82376c351bc5f5d60ec940732894443c8d26c726a52029b749332f. O success do leitor prova a integridade da evidência; não transforma a saída1 dos guards em success.

O guard anterior44675778676 no candidato c32e906a teve0errors/2 GATE/211 warnings. Está preservado apenas como histórico; o recibo final acima vincula3910a644.


## sf-ci — run único e resultado por job

**[Run44676428710](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44676428710): COMPLETED / FAILURE — 6 jobs success,14 jobs failure.** Workflow420530405, eventworkflow_dispatch, refsf-join-four, attempt1; head `3910a644c7fdab1a438c2b5b39d69afc19361709`. Criado04:44:39Z; conclusão publicada05:13:07Z.

Único dispatch desta sessão. Driver `sf-final-dispatch@dc60b94da88eb9f1d067d4c689b8e966fd3b39f0`, run 44676417113/job136089209667success; log confirma POSTúnico HTTP204 e o ID acima. O único outro workflow_dispatch listado para o branch era44541767066cancelled, anterior à sessão. Não houve rerun, segundo POST ou alteração dos prazos.

| Job | ID / conclusão | Resultado observado |
|---|---|---|
| sf/preflight | [136089252901](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44676428710/job/136089252901) **success** | Manifesto de8suítes e6provas AM independente validado; seletores/geração passaram. |
| sf/linux-native-omni | [136089252495](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44676428710/job/136089252495) **success** | Binários Linux X64 válidos; artefato 14602585614. |
| sf/static-and-contracts | [136089567130](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44676428710/job/136089567130) **failure** | Geração,7typechecks, inclusãoE2E eWebbuild passaram. Guard-dev exit1 por2GATE herdados;0 errors. |
| sf/procurement-queue-integration | [136089567166](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44676428710/job/136089567166) **success** | 4 pass /0 fail /101 assertions. |
| sf/test-CI-CLI | [136089567193](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44676428710/job/136089567193) **success** | 34 pass /0 fail /198 assertions /12 arquivos; receipt real. |
| sf/test-CI-APP-SRC | [136089567359](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44676428710/job/136089567359) **success** | 2.408 pass /0 fail /14.456 assertions /273 arquivos; receipt real. |
| sf/test-CI-APP-BROWSER | [136089567158](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44676428710/job/136089567158) **failure** | 138 pass /0 fail /3.486 assertions /37 arquivos. Receipt recusado: inventário do baseline existente, script/sf-ci/gate.mjs:300:5. |
| sf/test-CI-ATLAS-BUSINESS | [136089567265](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44676428710/job/136089567265) **success** | 8 pass /0 fail /49 assertions /4 arquivos; receipt real. |
| sf/test-CI-SF-1 | [136089567246](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44676428710/job/136089567246) **failure** | PARCIAL: 613 pass / 14 fail / 1 skip; timeout do step aos26min. Primeira falha: `modules/sucafina/Sucafinav1/test/product/dashboard-installed-closure/consumer-read.test.ts:64:16`. |
| sf/test-CI-SF-2 | [136089567306](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44676428710/job/136089567306) **failure** | PARCIAL: 417 pass / 10 fail; timeout do step aos26min. Primeira falha: `modules/sucafina/Sucafinav1/test/io-browser.test.ts:26:35`. |
| sf/test-CI-SF-3 | [136089567257](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44676428710/job/136089567257) **failure** | PARCIAL: 331 pass / 7 fail; timeout do step aos26min. Primeira falha: `modules/sucafina/Sucafinav1/test/business-browser.test.ts:22:26`. |
| sf/test-CI-SF-4 | [136089567205](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44676428710/job/136089567205) **failure** | PARCIAL: 344 pass / 8 fail; timeout do step aos26min. Primeira falha: `modules/sucafina/Sucafinav1/test/product/installed-bi-closure/sensitivity-history.test.ts:19:11`. |
| sf/test-CI-SF-5 | [136089567206](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44676428710/job/136089567206) **failure** | PARCIAL: 515 pass / 7 fail / 3 skip; timeout do step aos26min. Primeira falha: `modules/sucafina/Sucafinav1/test/product/wp01/personal-views.test.ts:82:17`. |
| sf/test-CI-SF-6 | [136089567464](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44676428710/job/136089567464) **failure** | PARCIAL: 146 pass / 5 fail; timeout do step aos26min. Primeira falha: `modules/sucafina/Sucafinav1/test/product/wp10/integration/composition-test-deadline.ts:5:29`. |
| sf/test-CI-SF-7 | [136089567188](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44676428710/job/136089567188) **failure** | PARCIAL: 437 pass / 2 fail; timeout do step aos26min. Primeira falha: `modules/sucafina/Sucafinav1/test/product/canonical-read-cost/diagnostic-cost.test.ts:13:26`. |
| sf/test-CI-SF-8 | [136089567320](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44676428710/job/136089567320) **failure** | PARCIAL: 481 pass / 8 fail; timeout do step aos26min. Primeira falha: `modules/sucafina/Sucafinav1/test/product/installed-bi-closure/numerical-coverage.test.ts:20:11`. |
| sf/test-CI-UI-OPERATIONS | [136089567197](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44676428710/job/136089567197) **failure** | 0 pass /2 fail /3não executados. packages/app-shell/e2e/sucafina/operations-support/runtime.ts:32:27: Esperado /wp04/first; recebido /sucafina. Falhou antes dos oráculos de negócio; ClamD passou. |
| sf/test-CI-UI-DECISIONS | [136089567135](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44676428710/job/136089567135) **failure** | 0 pass /2 fail /3não executados. packages/app-shell/e2e/sucafina/decisions-support/planner-sources.ts:19:24: Detalhe do Planner: esperado count1, recebido0 após10s. Segundo teste em decisions.spec.ts:26:1 expirou em180s criando a requisição. |
| sf/test-CI-UI-REPORTS | [136089567176](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44676428710/job/136089567176) **failure** | 0 pass /2 fail /2não executados. packages/app-shell/e2e/sucafina/reports-support/review-flow.ts:39:47: HTTP200 passou; discovery.json() falhou em Network.getResponseBody/No data found. Segundo caso: review-flow.ts:47:23, Add to agenda presente porém disabled. |
| sf/verify | [136099287356](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44676428710/job/136099287356) **failure** | Bloqueio por static=failure, unit=failure, unit-sf=failure e ui=failure; script/sf-ci/gate.mjs:475:5. Coleta/verificação de receipts skipped. |

### Contagens parciais dos oito shards

**Os oito steps foram interrompidos pelo limite original de26minutos, sem footer Bun e sem JUnit final utilizável.** As contagens SF da tabela são marcadores `(pass)`/`(fail)` observados no run.log; não são totais finais ou inventário validado. Os oito timings registram `capture:"missing", files:0, cases:0, partial:true`. Esses zeros descrevem a ausência de relatório final, não ausência de testes executados.

O receipt não foi alcançado nos oito shards ou nos três jobs UI. Logo esses failures são testes/infra/deadlines reais, anteriores à eventual rejeição PENDING. A declaração de baseline pendente permanece intacta; não explica esses resultados.

### Unbound no checkout final — primeiras falhas

| Escopo | file:line | Evidência |
|---|---|---|
| SF1 | `modules/sucafina/Sucafinav1/test/product/dashboard-installed-closure/consumer-read.test.ts:64:16` | page.goto: ERR_HTTP_RESPONSE_CODE_FAILURE no ingresso local. |
| SF2 | `modules/sucafina/Sucafinav1/test/io-browser.test.ts:26:35` | ERR_CONNECTION_REFUSED ao tentar http://localhost:4110/sucafina/planner?page=Versions. |
| SF3 | `modules/sucafina/Sucafinav1/test/business-browser.test.ts:22:26` | ERR_CONNECTION_REFUSED ao tentar http://localhost:4110/sucafina/procurement?page=Settings&filter=All; chamada em :49:11. |
| SF4 | `modules/sucafina/Sucafinav1/test/product/installed-bi-closure/sensitivity-history.test.ts:19:11` | Deadline cooperativo165000ms em product/wp10/integration/composition-test-deadline.ts:5:29. |
| SF5 | `modules/sucafina/Sucafinav1/test/product/wp01/personal-views.test.ts:82:17` | tab.goto: ERR_HTTP_RESPONSE_CODE_FAILURE no ingresso local. |
| SF6 | `modules/sucafina/Sucafinav1/test/product/wp10/integration/composition-test-deadline.ts:5:29` | bi09-complete-covered-costs: deadline105000ms; última fase comparison.persist, aborted:true. Stack Bun também reporta bi-cost-waterfall/presentation.test.ts:66:50; a criação do deadline está na linha74 da fonte F. |
| SF7 | `modules/sucafina/Sucafinav1/test/product/canonical-read-cost/diagnostic-cost.test.ts:13:26` | Pin de state-provider.ts divergente; os dois outros pins coincidem. |
| SF8 | `modules/sucafina/Sucafinav1/test/product/installed-bi-closure/numerical-coverage.test.ts:20:11` | installed-bi-training-omitted: deadline165000ms em composition-test-deadline.ts:5:29; última fase advantage.persist, aborted:true. |
| CI-UI-OPERATIONS | `packages/app-shell/e2e/sucafina/operations-support/runtime.ts:32:27` | Esperado /wp04/first; recebido /sucafina. Falhou antes dos oráculos de negócio; ClamD passou. |
| CI-UI-DECISIONS | `packages/app-shell/e2e/sucafina/decisions-support/planner-sources.ts:19:24` | Detalhe do Planner: esperado count1, recebido0 após10s. Segundo teste em decisions.spec.ts:26:1 expirou em180s criando a requisição. |
| CI-UI-REPORTS | `packages/app-shell/e2e/sucafina/reports-support/review-flow.ts:39:47` | HTTP200 passou; discovery.json() falhou em Network.getResponseBody/No data found. Segundo caso: review-flow.ts:47:23, Add to agenda presente porém disabled. |
| CI-APP-BROWSER | `script/sf-ci/gate.mjs:300:5` | Todos138testes passaram; inventário do baseline existente divergiu. |
| Verify | `script/sf-ci/gate.mjs:475:5` | Falhou ao receber quatro grupos upstream em failure. |

SF1 teve a primeira asserção posterior em `modules/sucafina/Sucafinav1/test/product/wp01/http.test.ts:56:29`: esperado HTTP200, recebido404.
SF5 teve a primeira asserção posterior em `modules/sucafina/Sucafinav1/test/product/wp04/ui-sourcing-analysis.test.ts:98:59`: esperado503, recebido undefined.

O pin SF7 de state-provider.ts esperava `bf0a5639bd41f903c67a89096b733269fbcd9eaf25392dde8c062fdcc13434c1` e recebeu `bd90848a7e75e62d457901666d6dfc6409e9ce3578092958ee9e794bb210a141`; criterion-comparison/result-store coincidiram. O reparo diagnóstico de #463 entrou depois do freeze e não altera este recibo.

No SF4, `product/wp12/native-execution-bi-kpi.test.ts:312:131` também falhou em readSourceLinks (caller125:21), antes do reparo posterior #467. Os deadlines SF4/SF6/SF8 são os limites cooperativos existentes; nenhuma causa interna adicional foi demonstrada para justificar sua alteração.

**Desvio da regra de porta:** os testes originais de SF2 e SF3 efetivamente tentaram `localhost:4110` e falharam. Nenhum listener foi recriado, mas não se alega cumprimento integral da proibição de uso dessa porta pelo workflow herdado. Esses caminhos ficam unbound e devem migrar para o ingresso nativo com seus oráculos originais; não restaurar o console morto.


## Artefato / baseline

`sf/ci/suites.json` permanece byte a byte no blob `57937b0e9df670fb7ccf10a18de5f5a83dec734d`. **CI-SF, CI-UI-REPORTS e CI-UI-DECISIONS mantêm `PENDING_REAL_COMPLETE_RUN`.** Nenhum hash, caso, coverage ou status foi inventado.

**Nenhum candidato de baseline UI foi produzido.** As três jornadas falharam antes de exit0, sanitização e receipt; todos os steps `Preserve minimized UI baseline candidate after receipt rejection` foram skipped. Os artefatos abaixo são diagnóstico original de falha, não baseline completo:

| Suíte | Artefato | Bytes | Digest ZIP informado pelo GitHub |
|---|---|---:|---|
| CI-UI-OPERATIONS | [sf-ui-failure-CI-UI-OPERATIONS (14602626515)](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44676428710/artifacts/14602626515) | 22347 | `9416b989d0bd1cc7d11161a36e7a119de4ffffa952ea4c8267f4d6dfc1ae7d83` |
| CI-UI-DECISIONS | [sf-ui-failure-CI-UI-DECISIONS (14602720895)](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44676428710/artifacts/14602720895) | 726964 | `40a9f80118e65465212aab3bbc375f38813fbe9e75e625b51fe5c33717b41e7b` |
| CI-UI-REPORTS | [sf-ui-failure-CI-UI-REPORTS (14602174970)](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44676428710/artifacts/14602174970) | 11264 | `05f8b65b3ee9f59165d2f4c3b970a001a8cc7c8d4c16ad1e9aaa3af51cdd164f` |

CI-APP-BROWSER tem baseline histórico com mínimos114casos/32 arquivos. Os138casos/37 arquivos finais passaram, mas a verificação exata de inventário recusou o receipt em gate.mjs:300:5. Isso é uma divergência adicional aos três PENDING; não se infere qual item mudou apenas das contagens. Foi preservado `sf-timings-CI-APP-BROWSER-1`, artefato 14602153529, ZIPsha2563ec109743a8e8f95ebc479a813d8eb1a0bc62a8f1daacbf1889a5d6196169e4c; timing não substitui recibo/candidato completo.

Os recibos válidos de CLI, APP-SRC e Atlas estão nos artefatos14601593937,14602108655 e14602760116, respectivamente. Os oito shards terminaram por timeout sem JUnit final. Nenhum artefato sf-evidence-CI-SF-shard-* ou candidato completo de baseline CI-SF foi produzido. Os logs autênticos abaixo servem para diagnóstico; não qualificam um baseline completo.


### Artefatos SF originais preservados

Metadados dos34artefatos do run foram lidos com per_page=100; não houve omissão pela primeira página. Digests abaixo são das ZIPs reportadas pelo GitHub, separados do archiveSha256 factory.

| Artefato de falha | ID / link | Bytes | SHA256 da ZIP |
|---|---|---:|---|
| sf-shard-failure-CI-SF-1 | [14603167752](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44676428710/artifacts/14603167752) | 46155 | `f381ea9340be5cd146e1a647aecec726d3aacf4032cfacc3626dbdbfc67097c8` |
| sf-shard-failure-CI-SF-2 | [14604120024](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44676428710/artifacts/14604120024) | 53773 | `f6adda6cb9e9b2e796298d79c1e16135395dba43e7d5465325f3e706c148bcec` |
| sf-shard-failure-CI-SF-3 | [14603982190](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44676428710/artifacts/14603982190) | 34238 | `a874975f4c45218c16196f78f746025f6af6b7e5ca63cd296be70a3eacb128e7` |
| sf-shard-failure-CI-SF-4 | [14603068765](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44676428710/artifacts/14603068765) | 31792 | `52e005f64922ae9665635d4c72899074d512d1e0a6d4c03fff28ce50388f3263` |
| sf-shard-failure-CI-SF-5 | [14603871900](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44676428710/artifacts/14603871900) | 43154 | `73519b741e652b45fa73a5f8390235e3ba991a3a6bd38d5d3bf6a138ae381f37` |
| sf-shard-failure-CI-SF-6 | [14602998174](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44676428710/artifacts/14602998174) | 18345 | `ac38d0f9d4d54961557fe8d5b227299c0bb377afc5c383c5707a2861b3c1669d` |
| sf-shard-failure-CI-SF-7 | [14603197842](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44676428710/artifacts/14603197842) | 38347 | `e844678172466441532ca2dd2b83e8c95751aaddec5ad2776a32069f6d7a9385` |
| sf-shard-failure-CI-SF-8 | [14603692617](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44676428710/artifacts/14603692617) | 42971 | `8c1d3984610803a0093749eb0e116e51cd7cbd54533d68092362989410d7c61c` |

Os oito timings são separados de aceitação e indicam captura ausente/parcial. Exports originais também foram preservados em SF2/SF4/SF6/SF7/SF8, sem dumps de binários no log. O diretório de artefatos da corrida é a referência completa; não há baseline fabricado ou promovido a partir desses parciais.


## Pacote final e sha256

**[Run 44676459520](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44676459520): SUCCESS**, workflow 420750908, push `sfa-factory-package`, attempt 1; job 136089350283 success. Head `3910a644c7fdab1a438c2b5b39d69afc19361709`.

- Arquivo: `orchestra-sf-factory-linux-x64-baseline.tar.gz`.
- **archiveSha256 real: `749d8d800a5b7458ca4dbb6507c6f987b8e33d524f8177cbe5bec55a5824811f`.**
- O empacotador publicou `SF_FACTORY_PACKAGE_QUALIFIED` às 04:47:27Z e o auditor independente confirmou `SF_FACTORY_RECEIPT_VERIFIED` às 04:48:38Z. Ambos contêm o mesmo hash; sourceSHA, checkoutSHA, expectedSourceSHA e workflowSHA vinculam a fonte congelada.
- **13 pass / 0 fail / 21.348 assertions**: sourcemaps 9/0/73; factory 3/0/1.482; Web/native instalado 1/0/19.793. O último controle registrou 34 spawns Omni e 0 delegações.
- Auditoria do tar.gz real: 1.413 arquivos, 1.310 Web, zero sourcemaps publicados; 735 inputs do compilador e 24 assets. Execução extraída fora do checkout, origem `http://localhost:4120`.
- [Artefato 14602393532](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44676459520/artifacts/14602393532): `sf-factory-package-44676459520-1-3910a644c7fdab1a438c2b5b39d69afc19361709`, 91.550.445 bytes, quatro arquivos, expira em 2026-11-27T04:48:39Z.
- Digest da ZIP GitHub, separado do tar.gz: `e33b71ec0dc622e3d58bdbc38fa05ea2ff57776e126f8a3a7e3e2d613e5b9ef2`.
- Manifest SHA-256: `694cb05d15f615e80a6e91dc791f3c9b204da28b9d4dd5d36bcca6e63daafba3`.
- Nenhum unbound no factory. Esse resultado não qualifica as jornadas de negócio ou os shards incompletos. Sem GO, deploy ou `SF_ORCHESTRA_WEB_PACKAGE_VERIFIED`.


## Como retomar

1. Ler este freeze e o head atual de sf-join-four separadamente. Não presumir que novas sessões pararam de publicar; não mover o pacote nem reclassificar o recibo de3910a644 com outra fonte.
2. Resolver causas dos unbounds no owner adequado, incluindo as tentativas legadas de localhost:4110 em io-browser.test.ts e business-browser.test.ts; migrar o ingresso preservando os oráculos, sem recriar o console. PROC02/03 requer evidência nova antes de novo gate; Reports requer causalidade da resposta original/ciclo de vida. Não aumentar timeout, descartar cancelamento ou repetir gate idêntico.
3. Qualificar os reparos preparados de Import/Documents em escopo isolado, sem arrastar #393/UI parcial. O typecheck concluído de fixtures não cobre esses helpers posteriores.
4. Só integrar #393 quando os checks efetivos do head satisfizerem todos-success. Manter #392/#237 drafts. Revisar os outros shared pendentes e os ramos completos pelos próprios handoffs e gates.
5. O único sf-ci desta sessão é44676428710, attempt1; **não rerodar nem fazer segundo dispatch**. Uma futura campanha exige decisão própria e correções concretas; não consumir um segundo gate idêntico nesta sessão.
6. Usar somente artefato real elegível como entrada de revisão independente de baseline. `sf/ci/suites.json` permanece inalterado; nenhum hash foi inventado.
7. O pacote é candidato técnico, sem GO/deploy/marcador de verificação. Registrar qualquer limitação real da corrida final antes de promoção futura.

## Regras e desvios observados

Nenhuma edição da raiz em `modules/sucafina/Sucafinav1/runtime/application.ts`; nenhum console morto ou listener4110 foi recriado. Contudo, os testes originais SF2/SF3 efetivamente tentaram localhost:4110 e receberam conexão recusada; essa ocorrência viola a proibição de uso da porta e está registrada como unbound. Os perfis UI selecionados usam4174 e factory4120. Não se alega cumprimento integral da restrição de porta no sf-ci herdado. Nenhum push para close-final-candidate, sf-red-clusters, go-live-close ou sf-frontend-bundle. Nenhuma asserção enfraquecida, baseline/coverage/digest/GO forjado. reviews.export.docx/pptx continuam Schema.Never; bytes reais somente pelo GET original?sf=review-download. No máximo2 gates controlados pela raiz simultâneos; houve implementação autorizada e revisão por agentes, mas nenhum dispatch próprio; os disparos de CI permaneceram centralizados na raiz.
