# X29 — resultado e comparação com X27

## Resultado preservado

**FAIL / HOLD da jornada integral.** Run [43628663680](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43628663680), tentativa 1: **0 pass, 1 fail, 3 expect calls, 1 teste, 1 arquivo, 285.80s**. O teste configurado conserva as 40 asserções e os prazos de 285000ms (cooperativo) e 300000ms (Bun), mas não avançou além das 3 asserções já alcançadas no X27.

- W29: `813806af6c2ce74b2a087139c544e90dd1adcbe4`; tree `06db6b04ee6bdb2af26b71d0b4031d769b76d219`.
- S: `d356d543298835b09b0452777fbd76cdaea77c85`; tree `d6e9e7e25fa52d292fb4d09b444e2440c4c3b728`; filho único de W29. Compare MCP contém somente `.ci-run.json`.
- Request: blob `e21191fec19858eeaf49109057fb9203ac72dd3b`, 281 bytes, SHA256 `821eb0a6ccf2937cf026854389f3f882a6cad60e2e9c14941c9327212f3e3cb4`.
- Seleção literal: `./Sucafinav1/test/product/wp10/integration/portfolio-exact-threshold.test.ts`, flags `--timeout 120000`. O header Bun comprova exatamente o único arquivo previsto.
- Teste: blob `fa4bdf61e69af2498b5668a5dfceb9286613d0bd`, idêntico byte a byte ao W27/X27.
- Job de teste `132550149012`: failure, 18:48:45–18:55:04Z.
- Cleanup `132551901878`: success, 18:55:06–18:55:12Z. Run completed/failure às 18:55:13Z.
- Artefatos: nenhum. Os logs brutos foram recuperados via GitHub MCP.
- Omni nonce `198da391adf18595b28e37401694ce3a`: not applicable; nenhuma declaração, spawn ou delegação. Este run não prova Omni.

Log de teste: 214753 bytes, SHA256 `95a34f8a0875ee7804868c6299bc188c6aca015b8eb6154024d69cc2f4c069ce`. Cleanup: 2312 bytes, SHA256 `60dff2ddd57eef9fcd0b5a6ae7739f99bdb62208595ee913b01fc9a2e445e87d`.

## Fases e limite da prova

A fixture completou em 8721ms; storage.before completou aos 8726ms. Três amostras iniciais (80/240/400), seus registros, probes de limiar e unidades canônicas retornaram ok. A gravação bruta da sensibilidade retornou ok aos 221651ms (1275ms de span). Isso não demonstra um resultado persistido utilizável pelo host.

O primeiro bind começou aos 221653ms. Sua primeira verificação independente começou aos 224058ms; a resolução da unidade devolveu ok após 23360ms, e as três reavaliações de amostras devolveram ok, a última aos 281581ms. O prazo cooperativo encerrou a operação aos 285244ms durante a leitura seguinte da mesma primeira prova. Os primeiros outcomes negativos observados aparecem nessa fronteira: case/scenario/source denied, proof false e bind denied. Não há recusa funcional anterior ao prazo demonstrada pelo trace.

`host.evaluate-and-store` não retornou ao teste; `storage.persisted`, releitura pelo serviço recomposto, retry da mesma operação e revogação permanecem **NOT_REACHED**. A recomposição prevista no teste cria novo serviço/verificador sobre o C08 ainda aberto; não é restart de processo nem reopen de SQLite. Nenhuma afirmação dessas etapas é autorizada por este run.

Leituras de ambiente: fixture 120, operação host 2067, total 2187. Trace final: aborted=true, active=[].

## Comparação controlada com X27

Baseline: W27 `ab8fb4f29d078d179742a77679ef85e5c549b114`, S `329a3b4547ec77c6b516ac1f28c732f0fc076902`, run `43623440133`, job `132533968037`. A request antiga não usava prefixo `./` e tinha as flags antes do arquivo; os dois logs mostram exatamente o mesmo arquivo completo. Teste, instrumentação e prazos são idênticos.

| Marco (ms desde início) | X27 | X29 |
|---|---:|---:|
| Fixture completa | 7766 | 8721 |
| Terceira amostra inicial produzida | 42546 | 47086 |
| Terceira amostra inicial gravada | 45498 | 50276 |
| Gravação bruta de sensibilidade concluída | 209914 | 221651 |
| Environment reads nesse write | 1919 | 1919 |
| Primeiro bind iniciado | 209916 | 221653 |
| Primeira prova iniciada | 212103 | 224058 |
| Última das três amostras reavaliada pela prova | 268073 | 281581 |
| Trace final | 285167 | 285248 |
| Total environment reads | 2246 | 2187 |

Ambos encerram na primeira prova do primeiro vínculo. No X27 a terceira emissão de unidades chegou a começar antes do abort; no X29 o deadline ocorreu antes dessa chamada. Contagens finais menores em X29 refletem trabalho truncado em outro ponto pelo deadline e **não comprovam redução causal**. O raw write foi mais tardio nesta amostra, mas um único run hospedado não estabelece regressão geral de desempenho.

Os spans abaixo são **inclusivos, sobrepostos e não podem ser somados como tempo de parede**. A comparação de totais também é censurada pelo deadline; o arquivo JSON preserva todos os outcomes, completions e throws.

| Span | Calls X27 | Calls X29 | Inclusive ms X27 | Inclusive ms X29 | Max ms X27 | Max ms X29 |
|---|---:|---:|---:|---:|---:|---:|
| phase.fixture.complete | 1 | 1 | 7766 | 8721 | 7766 | 8721 |
| shared.sources.resolveForecastSource | 4885 | 4762 | 189597 | 172169 | 142 | 120 |
| shared.cases.read | 177 | 172 | 97897 | 98601 | 1501 | 1508 |
| shared.evidence.context | 1003 | 976 | 269829 | 268186 | 820 | 810 |
| shared.sources.resolveForecastCoverage | 370 | 365 | 39850 | 39224 | 1419 | 1463 |
| shared.results.write | 6 | 6 | 3717 | 3885 | 1367 | 1275 |
| shared.results.readHistoricalScenario | 245 | 235 | 154478 | 153789 | 1844 | 1883 |
| shared.scenarios.resolveMany | 24 | 22 | 73923 | 69234 | 6108 | 6178 |
| shared.evidence.resolve | 80 | 76 | 15545 | 15687 | 414 | 404 |
| phase.storage.before | 1 | 1 | 6 | 5 | 6 | 5 |
| phase.host.evaluate-and-store | 1 | 1 | 277391 | 276519 | 277391 | 276519 |
| shared.results.readByRequest | 5 | 5 | 135 | 166 | 36 | 40 |
| shared.scenarios.resolve | 44 | 44 | 124342 | 129400 | 6314 | 6519 |
| primary.planner.simulateScenario | 22 | 22 | 12318 | 11950 | 1240 | 1201 |
| primary.hostUnits.issue | 3 | 2 | 31935 | 20609 | 12179 | 10357 |
| shared.results.read | 10 | 10 | 12337 | 12897 | 1507 | 1526 |
| primary.sensitivityBindings.bind | 1 | 1 | 75247 | 63592 | 75247 | 63592 |
| primary.proof.verifySensitivity | 1 | 1 | 73060 | 61186 | 73060 | 61186 |
| primary.hostUnits.resolve | 1 | 1 | 22807 | 23360 | 22807 | 23360 |

## Gates preservados e pendências

C29 preserva PASS dos dois testes completos próprios de observação de cálculo, incluindo duas observações, autorização/revalidação e fences; o run C29 inteiro permanece FAIL por UI. F29 preserva PASS dos três arquivos completos de fences: 10 testes, 132 asserções. Esses gates permitem manter a correção estrutural, mas não promovem a jornada X29 a PASS.

A coleta não disparou outro run, não mudou prazos e não executou testes locais. A próxima decisão deve usar hipótese discriminante adicional; este recibo não solicita nem realiza repetição automática.
