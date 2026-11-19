# Handoff — finish-coverage-20261119

SHA: 8d3fcf421d0b412955d6a8f60bc190e24a9466f2 (código verificado; este handoff é o commit seguinte)
Data: 2026-11-19
Estado: complete

## Feito
- Alinhada a expectativa de ordem em `modules/sucafina/Sucafinav1/test/product/wp11/promotion-coverage-proof.test.ts:47–62` ao contrato do produtor `product/decisions/cost-coverage.ts:99–100,114–121`.
- A alternativa salva deve preservar exatamente a ordem de `evaluatedSourceRefs` da avaliação humana de baseline que já foi observada, em vez da ordem de coleta da base de fontes.
- Ambos os casos de ordem 0–1 e 1–0 passam, assim como as quatro recusas por prova ausente, revogação, alteração de fonte e alteração do caso entre observação e commit.

## Pendente
- Nenhuma pendência nesta fatia. Esta evidência não qualifica outros contratos de sensibilidade/recertificação nem o conjunto SF completo.

## Decisões e justificativas
- O produtor documenta a ordem da evidência como parte do digest da avaliação humana e preserva a ordem original em `orderBaselineCoverageEvidence`. A expectativa antiga usava `fixture.basis.sourceRefs`, uma ordem diferente em casos válidos.
- A igualdade continua exata, incluindo todos os objetos e sua ordem; não foi substituída por sort, comparação de tamanho ou mera pertinência.
- Asserções removidas: nenhuma. Permanecem os valores de negócio, cobertura, prova, digest de commit, idempotência e todas as negativas de autoridade.
- Nenhum código de produção, timeout, skip, baseline, coverage persistida ou recibo foi alterado.

## Como retomar
1. Partir de `finish-coverage-20261119`, código `8d3fcf421d0b412955d6a8f60bc190e24a9466f2`, mais este handoff.
2. Integrar a fatia em `sf-join-four` após revisão do diff e do run abaixo.
3. Para uma alteração posterior neste contrato, criar snapshot atômico de test-ci com `{"package":"sucafina","runner":"bun","args":["Sucafinav1/test/product/wp11/promotion-coverage-proof.test.ts"]}`.

## Comandos e resultados
- `bun typecheck` (app-shell): não executado nesta fatia de testes de módulo.
- `bun run check:guards --base origin/dev`: não executado nesta fatia; nenhum resultado de guards é afirmado.
- GitHub Actions test-ci: [run 44572956345](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44572956345), evento push, snapshot `5409cf396d1ed84d6848385ab990a5b27c4cf37a`, resultado **success**.
- Job `test (ubuntu-24.04)` `135732713541`: **success**, **6 pass / 0 fail / 118 expect() calls**, 1 arquivo, 6.92s.
- Job cleanup `135734129294`: **success**; removeu a branch de snapshot.
- O snapshot difere do código por `.ci-run.json`; esse arquivo não está na branch de trabalho. Depois do gate, apenas este handoff foi acrescentado.
