# Handoff — finish-bi-origins-20261119

SHA: b32a7a1fc9f9280aa54ca1708fe8764ef48c5ae6 (código; documento posterior)
Data: 2026-11-19
Estado: complete

## Feito

- Corrigida a restauração de foco do consumidor BI: a marca SVG visível do mesmo valueId tem precedência sobre os botões de origem da tabela. A origem escolhida, o contexto, o período e as referências emitidas permanecem intactos.
- O harness visual WP05 abre Chrome diretamente em about:blank. O teste já monta uma função pura de renderização e recebe dados produzidos pelos ports canônicos de Planner/C17 no processo do teste; não consumia a instalação/enrollment de localBrowser. Essa dependência removida fazia navegação do browser para :4110, incompatível com a regra atual.
- planner-origins.test.ts permaneceu byte a byte igual: valores590000/602000, contribuições zero/nãozero, origensA/B, mouse, teclado, cancelamento, foco, tabela, composição, readBiDestination e negativa da terceira origem continuam executáveis.
- Nenhum comando de negócio, grant, origem, digest, recibo, dado financeiro ou resultado de teste é fabricado.

## Pendente

- Nenhuma pendência nesta correção específica: a seleção integral passou em Actions.
- Esta fatia é um teste de renderer/C17 com produtor canônico; não qualifica o capítulo nativo instalado nem substitui as suítes BI/Operations.

## Decisões e justificativas

- Asserções removidas: nenhuma.
- A falha observada na auditoria era expect(true) recebendo false no foco da marca, não uma falha de origem ou valor. restoreBiFocus retornava true ao focar primeiro a tabela. A ordem de candidatos agora corresponde ao contrato testado e conserva fallback para a origem quando não existe marca visível.
- Nenhum console foi reativado e nenhum browser aponta para :4110 nesta seleção WP05. A prova de autoridade real continua nos ports do próprio teste.

## Como retomar

1. Branch finish-bi-origins-20261119, código b32a7a1fc9f9280aa54ca1708fe8764ef48c5ae6, base sf-join-four@2b37f0aabe61be42fc0bab34a33464303f968efa.
2. Resultado terminal confirmado: run44590270877 SUCCESS, job135794077900, 1pass/0fail/178expect; testes22,64s, processo23,37s.
3. Corrigir somente defeito observado, sem mudar os valores/proveniência/asserts do teste ou aumentar timeout.
4. Root revisa e integra a fatia qualificada; nenhum merge é feito por este agente.

## Comandos e resultados

- GitHub Actions: https://github.com/gustavomhss/Orchestra-SF/actions/runs/44590270877 — SUCCESS, completed.
- Snapshot f85c4ca344ee0a064d6f9a422f6d55d4c4b8dba2; .ci-run.json = {"package":"sucafina","runner":"bun","args":["Sucafinav1/test/product/wp05/planner-origins.test.ts"]}.
- Auditoria de origem: run44585817131, shardSF8 informado pelo root, 617 pass / 3 fail /30558expect; primeira falha deste caso planner-origins.test.ts:97. Não é um recibo de aprovação desta correção.
- Sem shell, testes locais, novo sf-ci, rerun ou pacote nesta fatia.

- [Job135794077900](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44590270877/job/135794077900): 1 pass /0fail /178expect. Os dois percursos BI02/BI03 chegaram a WP05 browser assertions completed. Nenhuma etapa de matrícula/login foi usada pelo harness visual.
- O gate Bun não executou typecheck app/CLI/E2E separado; não há declaração dessa cobertura nesta fatia.
