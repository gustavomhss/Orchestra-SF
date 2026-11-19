# Handoff — finish-handoffs-20261119

SHA: 8b637b9bf9558410c6267f97666389eef8c07aff (código verificado; este handoff é o commit seguinte)
Data: 2026-11-19
Estado: complete

## Feito
- `test/product/wp13/handoff-c08-integration.test.ts`: a fixture conserva o mesmo Request admitido em todos os leitores C08, conforme a verificação de identidade de `product/decisions/result-store.ts:122`.
- Os dois testes de handoff agora distinguem um retry da intenção original de uma requisição com case.version alterada. Esta última é recusada explicitamente por `original-intent-mismatch`; a original devolve o mesmo resultado e não repete o recibo.
- O teste C08 foi separado em duas execuções com stores privados independentes: indisponibilidade antes do despacho e indisponibilidade após a reserva durável.
- Antes do despacho: não há tentativa reservada; a retomada chega aos valores 40/60, com duas aplicações e dois recibos reais, uma vez cada.
- Após a reserva: o fornecedor pode voltar, mas duas tentativas de retomada continuam devolvendo `application-indeterminate-reconciliation-required`. Permanecem uma tentativa reservada, somente o recibo da primeira alteração, valores 40/50, plannerCalls=1, procurementCalls=0 e igualdade exata do caso/tentativas/recibos.

## Pendente
- Nenhuma pendência nesta fatia. A reconciliação externa de um resultado indeterminado não é simulada nem concedida pelo teste.
- Nenhum resultado global de guards ou sf-ci é afirmado.

## Decisões e justificativas
- A fixture antiga criava um novo Request a cada consulta, contrariando a identidade exigida pelos leitores atuais.
- `product/decisions/apply.ts:57–62` liga o retry à intenção original. Usar uma nova versão do caso não é repetição idêntica; o teste agora mantém uma negativa explícita para essa alteração e uma positiva para a intenção original.
- `product/decisions/apply.ts:73–100` reserva a tentativa antes de cruzar a fronteira do domínio e proíbe novo despacho sem recibo. A indisponibilidade injetada em resolveMutation ocorria após essa reserva. O primeiro gate confirmou a recusa real; ela permanece no caso after-reservation, junto da prova de nenhuma reaplicação.
- Asserções removidas: nenhuma prova de negócio foi removida. A expectativa antiga de sucesso com intenção alterada foi corrigida para a recusa exata e acompanhada da repetição idêntica bem-sucedida. O cenário indeterminado foi preservado explicitamente; a retomada válida é exercitada em uma instalação isolada separada.
- Nenhum produtor, timeout, skip, baseline, coverage ou recibo foi alterado ou fabricado.

## Como retomar
1. Partir de `finish-handoffs-20261119`, código `8b637b9bf9558410c6267f97666389eef8c07aff`, mais este handoff.
2. Integrar após revisão dos dois cenários e do run final.
3. Se o contrato mudar, criar snapshot test-ci com `{"package":"sucafina","runner":"bun","args":["Sucafinav1/test/product/wp13/handoff-c08-integration.test.ts","Sucafinav1/test/product/wp13/handoff-integration.test.ts"]}`.

## Comandos e resultados
- `bun typecheck` (app-shell): não executado nesta fatia de testes de módulo.
- `bun run check:guards --base origin/dev`: não executado; nenhum PASS é afirmado.
- Primeiro test-ci: [run 44575887911](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44575887911), snapshot `d97c91aae52d58c49305f1f2b3d44f6201ef9d1c`, código `22df043dc4a6b78149c589e9dba38a02d09c4a0b`: **failure**, 1 pass / 1 fail / 73 expectativas. Job `135743147450`; a falha foi a recusa correta após reserva, em handoff-c08-integration.test.ts:240. Cleanup `135744248964`: success.
- Gate final: [run 44576825831](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44576825831), snapshot `0b9ec9988f105cff5108ea3d26838e56f9341df9`: **success**, **3 pass / 0 fail / 144 expect() calls**, 2 arquivos, 1.58s.
- Job final `test (ubuntu-24.04)` `135746437385` e cleanup `135747506717`: **success**.
- Configurações `.ci-run.json` existem somente nos snapshots removidos pelo workflow. Depois do gate final, apenas este handoff foi acrescentado.
