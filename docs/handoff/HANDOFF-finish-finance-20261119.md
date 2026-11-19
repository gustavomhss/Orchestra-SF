# Handoff — finish-finance-20261119

SHA: 76dfef0d8a2dccf5f2d5698f667e49600ebc3de7 (código verificado; este handoff é o commit seguinte)
Data: 2026-11-19
Estado: complete

## Feito
- `test/product/wp05/engine-fixture.ts`: a opção de cobertura usada por WP13 calcula as avaliações antes de gravar cenários C08, caso, regra e bindings. O caminho padrão dos demais consumidores permanece com o inventário inicial pendente.
- `test/product/wp13/coverage-preview-fixture.ts`: a classificação já existente, produzida por `classifyCoverage` e `assessCostCoverage` sobre componentes reais do Planner, é fornecida antes da persistência, em vez de ficar somente em cópias retornadas após a criação dos C08.
- As duas declarações privadas de escopo já existentes passam pela resolução de evidência da mesma fixture. Sua revogação também chega a essa resolução; não foram acrescentados papéis, grants ou fontes externas.
- `persisted-recertification.test.ts` preservou o threshold real de 55000, recertificação sem outra busca, witness de um ULP, união exata de evidência, isolamento do root e revogação final.
- `coverage-preview.test.ts` manteve os cinco estados de treinamento e os limites reais 55000/55001 e 15000/15001, além das negativas de fonte, regra, acesso, métricas forjadas e FX ausente.

## Pendente
- Nenhuma pendência nesta fatia. Os testes de continuidade de threads e os demais consumidores do catálogo SF são trabalhos separados.
- Typecheck e guards globais não foram executados por este gate Bun.

## Decisões e justificativas
- `product/portfolio/planner-sensitivity.ts:96–101` corretamente exige cobertura avaliada nos cenários C08 antes de emitir threshold exato. A fixture antiga persistia ambos com todas as entradas pendentes e só depois construía avaliações para o callback de cobertura; o C08 continuava sem elas.
- A correção altera a ordem da composição da fixture. Nenhum número financeiro, threshold, digest, recibo, baseline ou resultado de produção é preenchido artificialmente. Os mesmos produtores calculam os valores e o C08 original grava seus resultados.
- Asserções removidas: nenhuma. Os dois specs usados no gate não foram alterados, e nenhum timeout foi aumentado.
- A revogação de declaração permanece explícita e privada à fixture, sendo agora observada também pelos leitores C08 e regras que dependem dessa evidência.

## Como retomar
1. Partir de `finish-finance-20261119`, código `76dfef0d8a2dccf5f2d5698f667e49600ebc3de7`, mais este handoff.
2. Integrar a fatia em `sf-join-four` após revisão do diff e do run.
3. Se o contrato mudar, repetir por snapshot atômico test-ci com `{"package":"sucafina","runner":"bun","args":["Sucafinav1/test/product/review-fixes/finance-resume-performance/persisted-recertification.test.ts","Sucafinav1/test/product/wp13/coverage-preview.test.ts"]}`.

## Comandos e resultados
- `bun typecheck` (app-shell): não executado nesta fatia de fixtures do módulo.
- `bun run check:guards --base origin/dev`: não executado; nenhum resultado de guards é afirmado.
- GitHub Actions test-ci: [run 44575131915](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44575131915), snapshot `9cab29233d2da9985d7be6f457e09806f30d5a77`, **success**.
- Job `test (ubuntu-24.04)` `135740447470`: **success**, **6 pass / 0 fail / 116 expect() calls**, 2 arquivos, 208.39s.
- Recertificação: positive accepted=true; forged-evidence, root-poison e late-lease-revocation accepted=false; searches=0 em todas as quatro verificações.
- Job cleanup `135743847081`: **success**; removeu a branch de snapshot.
- O snapshot adiciona somente `.ci-run.json` ao código. Depois do gate foi acrescentado apenas este handoff; não há configuração CI na branch de trabalho.
