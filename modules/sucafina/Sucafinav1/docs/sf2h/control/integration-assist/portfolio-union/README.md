# Missão21 — proposta de união semântica WP13

**Entrega documental completa para aplicação seletiva pela sessão14. Produto e provas funcionais: NOT_RUN. WP13 permanece aberto.**

A branch `sf2-portfolio-union` parte de `sf2-control@10a7b3dbc8140d95eb9ded97dd1377bf05043321`. Todos os arquivos desta PR ficam em `docs/sf2h/control/integration-assist/portfolio-union/`. A PR não é uma branch de produto e nunca deve ser mesclada integralmente em `sf2-stack`.

## Conteúdo pronto

- [patch-manifest.json](patch-manifest.json): quatro patches, 15 destinos propostos, hashes Git de preimage/postimage, dependências e ordem.
- [disposition.json](disposition.json): todos os 31 arquivos retidos, sem exceção; 19 KEEP_CURRENT, 12 SEMANTIC_PATCH, zero TAKE_SOURCE.
- [preimages/](preimages/) e [postimages/](postimages/): conteúdo integral de todos os 31 held, do suplemento C08 já admitido e dos dois novos testes. Os novos destinos têm prova de ausência em vez de preimage fictício. Arquivos `.txt` têm exatamente os bytes do arquivo correspondente, sem cercas Markdown.
- [criteria-map.json](criteria-map.json): os 68 critérios completos de S4-C, com consumidores, testes e obrigações restantes. Todos NOT_RUN.
- [dispatcher/selection.json](dispatcher/selection.json): seleções U01–U06 e follow-up de consumidores U07, para a árvore efetivamente aplicada.
- [INTEGRATION.md](INTEGRATION.md): instrução operacional de integração.
- [COMPATIBILITY.md](COMPATIBILITY.md): formas de resultado histórico, autoridade e escolhas de união.
- [input-manifest.json](input-manifest.json), [READING-RECORD.md](READING-RECORD.md) e [STATIC-REVIEW.json](STATIC-REVIEW.json): pins, leituras e limites da inspeção.
- [open-findings.json](open-findings.json): pendências originais e atualização observada dos owners.
- `HANDOFF.md`: recibo terminal com os commits e a PR, acrescentado depois do commit que contém estes payloads.

## O que a proposta muda

A correção de produto fica no finalizador de sensibilidade e no seu verificador. O bundle perdeu o identificador `known-subtotal-threshold` ainda exigido por seus consumidores; a PR37 introduziu `known-components-threshold`; PR36 também conservava as condições dos cenários originais e um ordenamento próprio de evidência. A união conserva os dois identificadores e a proveniência original em resultados condicionados. Reproduz explicitamente as formas históricas, sempre com prova canônica atual e digest integral igual. Não relaxa cobertura, não infere zero, não usa o número persistido como prova e não repete a busca numérica eliminada por Finance.

Os testes preservam todas as 432 linhas de assertions pré-existentes nos dez arquivos de teste alterados, além dos budgets existentes. Entram seis testes unitários novos do serializador, três variantes históricas com C08/binding reais, o scalar falso da PR37, histórico N/N, CAS na última callback, classificação C10 canônica e seleção explícita de envelopes C08 equivalentes. A jornada admitida com baseline único continua intacta.

A jornada real C08 de handoff da PR37 já existe no bundle em `handoff-c08-integration.test.ts`. P02 modifica esse destino por hunks pequenos, sem duplicar o teste. Ambos os testes de handoff mantêm seus asserts e distinguem indisponibilidade antes de dispatch de falha após reserva. O contrato C12 após reserva e seus testes reais permanecem preservados.

## Base de comparação

| Papel | Commit |
| --- | --- |
| Missão/base documental inicial | `10a7b3dbc8140d95eb9ded97dd1377bf05043321` |
| Planejamento imutável | `dbf9547211d9b0fade619790de7c19c0869b7c7d` |
| Bundle de referência | `46cb4dd02f0a6d11b3fa7a0deac7f839e7b7af3c` |
| PR37 retida | `7defe5c9930774c6aa5a15a5f677b4406d08683c` |
| Intelligence PR36 | `48486a2186c0cc07a3a5558e34e2aa94c89ad5e9` |
| Finance W2 | `5a029e77bfd9d8ba19494966a95c908e3f05043d` |
| sf2-stack reconferido | `d8ab1d3321a76870ed3092ba043fe1b5781a2c23` |
| Finance com handoff terminal reconferido | `d8d586e19c824f75a88494a9c3677faac617e81d` |

Os 31 held e o suplemento C08 têm os mesmos preimages no bundle de referência e no sf2-stack reconferido. A comparação é por conteúdo, contrato e consumidor; nenhum arquivo foi escolhido pela data. Os três pares idênticos são read-scope-fixture, read-scope.test e term-defer-boundary.

## Disposição dos arquivos retidos

| Arquivo relativo a Sucafinav1 | Disposição | Patch | Recheck específico |
| --- | --- | --- | --- |
| `product/portfolio/README.md` | SEMANTIC_PATCH | P04 | Conferir C |
| `product/portfolio/handoff.ts` | KEEP_CURRENT | — | Conferir C |
| `product/portfolio/planner-sensitivity.ts` | SEMANTIC_PATCH | P01 | Sim, Finance |
| `product/portfolio/port.ts` | KEEP_CURRENT | — | Conferir C |
| `product/portfolio/result-store.ts` | KEEP_CURRENT | — | Conferir C |
| `product/portfolio/sensitivity-store.ts` | KEEP_CURRENT | — | Conferir C |
| `product/portfolio/sensitivity-v6.ts` | KEEP_CURRENT | — | Conferir C |
| `product/portfolio/sensitivity.ts` | KEEP_CURRENT | — | Conferir C |
| `product/portfolio/threshold-proof.ts` | KEEP_CURRENT | — | Sim, Finance |
| `product/portfolio/verification.ts` | SEMANTIC_PATCH | P01 | Sim, Finance |
| `test/product/wp13/analysis-recovery.test.ts` | KEEP_CURRENT | — | Conferir C |
| `test/product/wp13/campaign.test.ts` | SEMANTIC_PATCH | P02 | Conferir C |
| `test/product/wp13/coverage-preview.test.ts` | KEEP_CURRENT | — | Conferir C |
| `test/product/wp13/coverage-sensitivity-integration.test.ts` | SEMANTIC_PATCH | P01 | Conferir C |
| `test/product/wp13/coverage.test.ts` | KEEP_CURRENT | — | Conferir C |
| `test/product/wp13/handoff-integration.test.ts` | SEMANTIC_PATCH | P02 | Conferir C |
| `test/product/wp13/handoff.test.ts` | SEMANTIC_PATCH | P02 | Conferir C |
| `test/product/wp13/history-provenance.test.ts` | SEMANTIC_PATCH | P02 | Conferir C |
| `test/product/wp13/persistence-recovery.test.ts` | KEEP_CURRENT | — | Conferir C |
| `test/product/wp13/persistent-store.test.ts` | KEEP_CURRENT | — | Conferir C |
| `test/product/wp13/planner-sensitivity-boundary.test.ts` | KEEP_CURRENT | — | Conferir C |
| `test/product/wp13/portfolio.test.ts` | SEMANTIC_PATCH | P03 | Conferir C |
| `test/product/wp13/reconciliation.test.ts` | SEMANTIC_PATCH | P03 | Conferir C |
| `test/product/wp13/sensitivity-fixture.ts` | KEEP_CURRENT | — | Conferir C |
| `test/product/wp13/sensitivity-read-scope-fixture.ts` | KEEP_CURRENT | — | Conferir C |
| `test/product/wp13/sensitivity-read-scope.test.ts` | KEEP_CURRENT | — | Conferir C |
| `test/product/wp13/sensitivity-units-boundary.test.ts` | KEEP_CURRENT | — | Conferir C |
| `test/product/wp13/sensitivity-v6.test.ts` | SEMANTIC_PATCH | P01 | Conferir C |
| `test/product/wp13/sensitivity.test.ts` | SEMANTIC_PATCH | P01 | Conferir C |
| `test/product/wp13/source-scenario.test.ts` | KEEP_CURRENT | — | Conferir C |
| `test/product/wp13/term-defer-boundary.test.ts` | KEEP_CURRENT | — | Conferir C |

As justificativas completas, critérios, consumidores, pins de PR37/bundle/Finance e artefatos por arquivo estão no manifesto. KEEP_CURRENT não significa dispensar a validação do candidato; significa não sobrescrever comportamento admitido por uma alternativa redundante ou regressiva.

## Estado de prova

Nenhum teste, CI, typecheck ou guard foi executado nesta sessão. A reconstrução textual dos 15 destinos prova somente que os hunks correspondem aos preimages/postimages declarados. Os hashes Git foram emitidos pelo GitHub para o conteúdo integral.

Finance W2 mantém inalterados os três arquivos portfolio sobrepostos. Seu handoff terminal relata seleção curta na fonte e falha da jornada S3 na guarda 180000; essa prova não se transfere para esta união. Os dois deltas W2 de Finance pertencem ao intake separado desse owner. Não copiar a branch Finance inteira, pois ela contém alternativas herdadas que perderiam proteções admitidas.

Permanecem pendentes a aplicação/validação desta união, FIN-IND-005, Memory, C17 entre observações, CurrentChoice, C05/C12 e os demais gates/consumidores do integrador. Nenhum status desta entrega fecha WP13 ou autoriza GLOBAL_RELEASE.
