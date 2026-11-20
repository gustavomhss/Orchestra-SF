# Handoff — sf-continuation-package

## SHA e estado

- Estado: **complete — correções qualificadas por Actions; integração e pacote final pendentes**.
- Base: `f7dd58e32bc834f1485df20b91adbf759b4c4ad0`.
- Fonte qualificada da fábrica: `98e56b260a2b36030f6edd9711d77b1cebc907be`, PR [#395](https://github.com/gustavomhss/Orchestra-SF/pull/395).
- Fonte do gate unitário: `143cbb9227c2a33251ec55a95a2b6432effbbb43`; snapshot `e8927363e763c8defe57599abf826589143b356b`.
- Esta atualização posterior modifica somente o handoff e usa `[skip ci]`, para não repetir gates idênticos sem mudança de código. Os SHAs acima identificam a execução real.

## O que foi corrigido

1. Factory configura, inicia e verifica a distribuição real extraída em `http://localhost:4120`. Origem, requests, Origin, receipt e checker independente são coerentes. Permanecem as provas do executável compilado, extração fora do checkout, sessão/identidade, console autenticado desativado 404, comando e caso reais, bytes Web, archive e adulteração.
2. O step UI em `sf-ci.yml` só emite `minimized=true` após testes originais com exit zero e sanitização real bem-sucedida. Se o receipt falhar depois, publica exclusivamente `report.json` minimizado no artifact distinto `sf-baseline-candidate-<suite>-<sha>-<attempt>`. Não publica um receipt aprovado nem muda a conclusão do job.
3. `gate.test.mjs` executa o trecho real do workflow com bash/git/gate.mjs em fixtures isoladas: falha do teste original, JSON inválido, baseline pendente e baseline válido exclusivamente de teste. Os cinco novos testes incluem o contrato do upload. Não há baseline sintético do produto.
4. O workflow factory admite a qualificação prévia somente para PR interno com head `sf-continuation-package` e base `sf-join-four`. Checkout/evento/identidade/testes/receipt/upload originais permanecem. A entrada existente por push em `sfa-factory-package` será usada apenas após o congelamento final.

## Gates concluídos

| Gate | Run / job | SHA real | Resultado |
| --- | --- | --- | --- |
| Retenção/minimização | [44652105730](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44652105730), test 136009258700, cleanup 136010485063 | e8927363e763c8defe57599abf826589143b356b | **success**, 57 pass / 0 fail; 1 arquivo; 926 ms; artifacts 0 |
| Factory integral | [44652219809](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44652219809), job 136009638049 | 98e56b260a2b36030f6edd9711d77b1cebc907be | **success**, attempt 1 |
| Web distribution | Mesmo job factory | Mesmo source | 9 pass / 0 fail / 73 expect |
| Compilação e extração factory | Mesmo job factory | Mesmo source | 3 pass / 0 fail / 1482 expect |
| Lifecycle Web/native | Mesmo job factory | Mesmo source | 1 pass / 0 fail / 19793 expect; 34 spawns Omni reais, 0 delegados |

Identidade real da fábrica: `sourceSHA=checkoutSHA=expectedSourceSHA=98e56b260a2b36030f6edd9711d77b1cebc907be`; `workflowSHA=cdbdf5164df473dcc07b1c34b21850acb8f8d856` é o merge ref sintético; runID `44652219809`, attempt `1`. O head possui check real `linux-factory (compiled + extracted)` concluído success.

Os marcadores `SF_FACTORY_PACKAGE_QUALIFIED` e `SF_FACTORY_RECEIPT_VERIFIED` foram observados nos logs. Origem 4120; extração fora do checkout true; status 200; gate sem autenticação 303; dashboard autenticado 404; current-choice autenticado 200/ok. A auditoria independente verificou 1413 arquivos, 1310 Web e zero sourcemaps Web.

## Artifact e hash da qualificação prévia

- [Artifact 14591363180](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44652219809/artifacts/14591363180).
- Nome: `sf-factory-package-44652219809-1-98e56b260a2b36030f6edd9711d77b1cebc907be`.
- Conteúdo: archive factory, distribution.json, factory-closure.json e factory-package-receipt.json.
- Archive: `orchestra-sf-factory-linux-x64-baseline.tar.gz`.
- **archiveSha256: `2f25f518095ddf3ade0e4aca36f9c6ba63796655613d9eefa44fcb1fb329af44`** — idêntico nos dois marcadores reais.
- manifestSha256: `2d954ed6db265eef1a100290dd27b22b7e76d60015c070c1e00472f800caaefc`.
- ZIP do artifact GitHub, distinto do pacote: `788e491f8daa17925fbf4e4e063191b43a4ada88fe3fae38030dd07f59d716df`.
- Tamanho do artifact: 91528003 bytes; expiração registrada 2026-11-27T01:18:45Z.

Este artifact qualifica o reparo no PR. **Não é o pacote da Parte C nem qualifica o futuro SHA integrado.**

## Baseline e restrições

`sf/ci/suites.json` permanece intocado. `PENDING_REAL_COMPLETE_RUN` continua recusado. O upload real do candidato UI só poderá ser comprovado na única sf-ci final, se os testes terminarem bem e o relatório for minimizado. Se os testes falharem antes, não há candidato válido a publicar.

Não houve execução local, shell local, GO, deploy ou `SF_ORCHESTRA_WEB_PACKAGE_VERIFIED`. Não houve escrita em application.ts ou nas branches proibidas.

## Pacote final e proteção da corrida única

O draft #257 não podia ser retargetado diretamente para sf-join-four: GitHub recusou com 422 porque seu head atual já é ancestral da integração. Foi preservado aberto/draft e retargetado para `sf-package-hold@52d2c24f4f8cb776889b97894131df6ada43ce98`, uma ref com exatamente o SHA de sua base anterior. Seu diff histórico foi preservado e nenhuma branch protegida foi movida. Isso evita sf-ci incidental pelo synchronize no futuro push final. O head de sfa-factory-package não foi movido neste checkpoint.

## Como retomar

1. Integrar este PR uma vez, na posição coordenada dos restos qualificados, após os itens anteriores elegíveis. Usar o SHA esperado e preservar mudanças concorrentes.
2. Após todos os merges, executar os guards canônicos com histórico completo. Wrapper existente: `modules/sucafina/Sucafinav1/test/product/ui-split/ui-work/guards.test.ts`. Request: pacote script, runner bun, args `--timeout 120000 --preload ../../script/test-omni-control.ts ../../modules/sucafina/Sucafinav1/test/product/ui-split/ui-work/guards.test.ts`, env Omni 1. Registrar o resultado real; não enfraquecer a asserção de exit zero. Os dois GATE herdados esperados produzem falha do wrapper em guards.test.ts:23.
3. Disparar sf-ci 420530405 exatamente uma vez em sf-join-four, depois dos merges. Registrar todos os jobs, artifacts e causas reais.
4. Congelar o SHA, verificar ancestralidade/lease e mover sfa-factory-package por fast-forward para ele. Verificar que #257 continua draft na base hold.
5. Registrar run/artifact e archiveSha256 novos, vinculados ao SHA final/run/attempt reais. Não reutilizar o hash da qualificação prévia.
