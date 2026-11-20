# Handoff — finish-captures-20261119

SHA: d8f36a9e8c9bbd8ec29e2e6ff45080d48bf30c57 (código verificado; este handoff é o commit seguinte)
Data: 2026-11-19
Estado: complete

## Feito
- `test/product/mixed-source-contracts/capture-prerequisite.test.ts` agora prova a preparação real de edição de draft e a captura autorizada do original pelo produtor existente.
- Sem admissão humana de preparação, o produtor nega e os snapshots/caso permanecem idênticos.
- Com admissão genuína, o comando é exatamente Requests.save, valor 150 e `confirmed: false`. A captura tem a evidência original, encarnação física corrente, projeção contendo 100, digests consistentes e um recibo canônico de preferences.
- A preparação HTTP cria uma alteração planned, conserva a escolha e a captura original, não aplica o valor e não aprova a requisição. Material, estágio draft, snapshots de domínio e recibos de aplicação permanecem intocados; após revogação a nova preparação retorna 403 sem alteração.
- `test/product/review-fixes/procurement-apply/real-apply.test.ts` exige também `confirmed: false` no comando exato. Todas as provas de revisão, digest incorreto, outro principal, CAS, idempotência, recibo único e revogação foram mantidas.

## Pendente
- Nenhuma pendência nesta fatia. A captura não é uma declaração de disponibilidade geral de histórico nem de aprovação financeira do PR.
- Nenhum capítulo, produtor, workflow, runtime/application.ts ou política de autorização foi alterado.

## Decisões e justificativas
- `product/procurement/scenario-preparation.ts:33–55` já usa o lifecycle real para preparar save-estimate, exigindo `requiresExplicitAction: true`, `approvalGranted: false`, receipt nulo e comando `confirmed: false`.
- `product/procurement/decision-host.ts:67–101,126–128` já persiste a fonte original autorizada e seu recibo dentro do lock de domínio/preferences. O teste antigo exigia o blocker `financial-approval-command-unavailable` mesmo para essa edição de draft e exigia ausência da captura que esse produtor realiza.
- Expectativas obsoletas substituídas: blocker needs-input, ausência de value, HTTP 400 e ausência de qualquer escrita após preparação autorizada. Foram substituídas por negativa sem admissão, preparação exata sem aprovação, integridade da captura real e prova de nenhuma aplicação. Asserções de material, escolha, recibos de aplicação e revogação permanecem ou foram reforçadas.
- O teste de captura passou de 17 para 42 chamadas estáticas de expect. Nenhum timeout foi aumentado; nenhum teste foi apagado ou ignorado.
- Os digests são verificados contra os dados produzidos e persistidos. O teste não escreve recibos, captures, grants ou cobertura artificialmente.

## Como retomar
1. Partir de `finish-captures-20261119`, código `d8f36a9e8c9bbd8ec29e2e6ff45080d48bf30c57`, mais este handoff.
2. Integrar após revisão do contrato de draft separado da aprovação financeira e do run.
3. Se o produtor mudar, criar snapshot test-ci com `{"package":"sucafina","runner":"bun","args":["Sucafinav1/test/product/mixed-source-contracts/capture-prerequisite.test.ts","Sucafinav1/test/product/review-fixes/procurement-apply/real-apply.test.ts"]}`.

## Comandos e resultados
- `bun typecheck` (app-shell): não executado nesta fatia de testes de módulo.
- `bun run check:guards --base origin/dev`: não executado; nenhum PASS é afirmado.
- GitHub Actions test-ci: [run 44577219415](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44577219415), snapshot `6937e82b186d874249566f38a3a3603395c3a48d`, **success**.
- Job `test (ubuntu-24.04)` `135747841798`: **success**, **4 pass / 0 fail / 114 expect() calls**, 2 arquivos, 23.65s.
- Log medido: archiveCountBefore=0, archiveCountAfter=1, preparedChangeCount=1, historicalCaptureCreated=true, financialApprovalGranted=false.
- Job cleanup `135749021775`: **success**; removeu a branch de snapshot.
- Depois do gate, apenas este handoff foi acrescentado. `.ci-run.json` não está na branch de trabalho.
