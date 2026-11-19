# Handoff — finish-bi-native-20261119

SHA: ee0481af14c07a28bc51a29f14a963da746f7431 (código; este documento é o commit seguinte)
Data: 2026-11-19
Estado: partial

## Feito
- WP3 — packages/app-shell/e2e/sucafina/bi-installed/installed-fixture.ts:396 — usa o formulário nativo OPEX comprovado em wp03/planner-mounted.spec.ts:326, com count1 e rota exata /orchestra/sf-planner/opex. O scoped selector anterior retornou0 apesar de o DOM original mostrar o formulário.
- installed-fixture.ts:409 — operação Planner só admite rotas CAP18/CAP23 fechadas; o GET original deve confirmar capabilityId, status, dados e CAS. A revisão mantém zero POST antes da confirmação e exatamente um POST depois; sem retry.
- installed-fixture.ts:51 — criação de decisão entra pelo enterWorkbench original e botão New case; usa section.sf-n24-create form, como o ingresso nativo já qualificado. Mantém todos os campos, payload original, resposta, identidade e leitura do caso.
- installed-fixture.ts:324 — seleção da célula Forecast preservada; texto TSV entra no controle nativo Paste tab-separated values e Review pasted values, que chama o mesmo produtor de preview. Não usa clipboard de automação, cujo bloqueio já foi observado no mesmo S02 no gate WP4. Todas as linhas, 12 meses, zeros explícitos, valores40k/240k, preview/apply e reload continuam assertados.

## Pendente
- installed-fixture.ts:255 — repetir os specs BI instalados no snapshot composto; os gates atuais ainda não qualificaram o corpus completo.
- installed-fixture.ts:51 e :125 — authoring de casos/alternativas/coverage/comparações depois do Planner ainda não foi alcançado pelo BI4; contratos e asserções originais preservados.
- Nenhuma mudança de produto foi feita neste branch; eventual problema de renderer ou produtor exige diagnóstico do próximo run.

## Decisões e justificativas
- Asserções removidas: nenhuma asserção de valor, identidade, autorização, CAS, contagem de POST, cobertura, comparação, persistência ou recarga foi removida. A inferência de capability pelo ancestor data-sf-surface foi substituída por rota fechada mais capabilityId real do produtor.
- A seleção do formulário continua estrita e única. A origem do browser continua3000 e os JSON producers originais continuam em /sucafina/...; nenhuma página do console morto foi criada.
- Nenhum dado calculado, digest, baseline, custo não cotado ou valor de coverage foi inventado. Esta alteração mantém o corpus de entrada já escrito no fixture.
- UI39 e Planner submitReview foram conferidos após o diagnóstico SolidStore de Operations: ambos constroem objetos de comando com campos escalares. Nenhum unwrap ou alteração de schema foi adicionado por hipótese.
- Sem aumento de timeout, skip ou mudança global em withCase/F01.

## Como retomar
1. Partir do código ee0481af14c07a28bc51a29f14a963da746f7431; compor somente installed-fixture.ts com assembly26 e dependências de ingresso já integradas.
2. A raiz cria o próximo ci-run-linux-bi5-20261119 com os mesmos specs BI instalados e .ci-run.json package app, runner playwright, config e2e/playwright.production.config.ts.
3. Atualizar este documento com SHA, run e resultado; triar a primeira falha real posterior sem repetir gates já conhecidos.

## Comandos e resultados
- BI4: https://github.com/gustavomhss/Orchestra-SF/actions/runs/44608425452 — FAILURE, 2 failed e1 did not run; tipos passaram; snapshot34ce87ea86a6ff8d7546afce24df6ed6dbdf784e; job135858221767. CAP23 criação/edição já avançaram, falha em addLine CAP18.
- Auditoria: https://github.com/gustavomhss/Orchestra-SF/actions/runs/44612788838 — SUCCESS somente extração de evidência original; docs/handoff/observed-dashboard6-bi4-20261119.md na branch audit-dashboard6-bi4-20261119. Não constitui PASS UI.
- Ingresso isolado já integrado, sem repetição: https://github.com/gustavomhss/Orchestra-SF/actions/runs/44607176525 — SUCCESS, 2 passed; PR382. Não qualifica todo o BI.
- bun typecheck (app-shell) neste commit: não rodado; somente Actions autorizado.
- bun run check:guards --base origin/dev neste commit: não rodado; responsabilidade da raiz.
- bun run test:ci neste commit: não rodado; aguardando composição e gate estreito.
