# Handoff — finish-bi-native-20261119

SHA: 484c61f87a3be55580f2571a40898ef11e03a2b6 (código; este documento é o commit seguinte)
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


## BI5 — comandos originais e controles CAP18

- Run [44615378884](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44615378884), snapshot d7d10e1a2a1e62ceea82d529c4cd1b7eaf005c16, job 135882522614: FAILURE, 2 failed / 1 did not run; os três typechecks e cleanup 135885787142 passaram. A regressão parou no save da versão existente: resposta original HTTP200 application/json, seguida de net::ERR_ABORTED; nenhum reenvio. O cenário principal criou e editou a versão2027 e chegou ao CAP18, onde o formulário visível não foi encontrado pelo seletor de atributos.
- Evidência extraída dos artefatos originais: audit [44617274066](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44617274066), doc audit-dashboard7-bi5-20261119/docs/handoff/observed-dashboard7-bi5-20261119.md, contém a região OPEX, versão correta e Name/Owner/Element/Currency/Annual budget/Save. Audit [44618520535](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44618520535), doc audit-dashboard7-bi5-transport-20261119/docs/handoff/observed-dashboard7-bi5-transport-20261119.md, retém o observer bi62-regression-canonical-setup.json. SUCCESS nesses dois runs significa só extração, nunca BI qualificado.
- Código 3aca6a6e8cbe0b9bf7ed1d4b635f5aba4e28ddc7, somente installed-fixture.ts: o fixture retém a resposta original completa de POST /sucafina/planner?page=Versions ou OPEX, sem sf, com route.fetch maxRetries0/maxRedirects0 e fulfill da própria resposta. Usa os helpers Reports existentes, sem inventar resultado/status/headers, sem POST adicional e sem retry. O observer continua recusando qualquer requestfailed ou outcome-unknown; os guards de HTTP200/body.ok e exatamente1POST permanecem.
- addLine usa agora a região nativa OPEX única e seus labels reais Name, Owner, Element, Currency e Annual budget, conferidos no renderer planner/opex/budget-view.tsx:867–898 e no DOM original. Mantém a rota fechada CAP18, count1, controle visível, owner original, USD, valores literais, confirmação humana, CAS e leitura original da linha criada. O seletor técnico form[data-page][data-command][data-record] deixou de ser necessário; nenhuma comparação de dado ou resultado foi removida.
- Asserções removidas: nenhuma asserção de negócio, autoridade, contagem de POST, ID, moeda, período, treinamento40000, zeros, coverage ou reload. Não aumentou timeout. Pendente/unbound: installed-fixture.ts:407 (criação de linha), :419 (comando observado) e :344 (grade mensal) dependem do gate; os cenários BI09/BI10 ainda não chegaram à comparação.
- Retomar: compor o único blob deste código sobre o candidato com reports-support/model.ts original de retainReportResponse/observedReportResponse. Executar somente installed-bi.spec.ts e installed-bi-regressions.spec.ts, uma vez no gate coordenado pela raiz. Os resultados antigos não qualificam este novo checkpoint.


## BI6 — aborto depois de200; diagnóstico mantendo falha terminal

- Run [44620048170](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44620048170), snapshot 5c07b0984bedc50e0efc3ffa0fb9c92c645c796a, composição c00178c2101e3c8810c7d37ee5d0a2db0c823b6b, job135898959034: FAILURE, 2 failed / 1 did not run. Três typechecks e cleanup135902481507 passaram.
- As duas preparações falharam no primeiro Versions/save: o observador reteve POST200 application/json e depois requestfailed net::ERR_ABORTED; nenhum comando foi reenviado. Auditorias [44621448575](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44621448575) e [44622349690](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44622349690) passaram somente na extração dos artefatos originais, sem novo teste. Docs em audit-bi6-original-20261119 e audit-bi6-context-20261119.
- O DOM final principal mostrou Sucafina route not admitted, porém owner-runtime231.ts:261/273–285 usa esse texto também em resolving; não prova negação terminal. O artefato não reteve trace ou corpo ctx.context. Revisão focal confirmou que UI46 limpa commandAbort antes do readback, modelo limpa pending antes de publicar page e plannerHref preserva tuple completo/year; não houve correção especulativa de F01/F02.
- Código 484c61f87a3be55580f2571a40898ef11e03a2b6: installed-fixture.ts:450–540 acrescenta observação fechada dos GETs originais de discovery/context/CAP23 durante o comando. No mesmo ponto fatal, registra pathname, nomes de query, year, presença do tuple, estados públicos F01 e contagem; se o browser pediu contexto, relê exatamente essa URL com a sessão atual e guarda somente status/destino/disponibilidade da capability. Nenhum owner selector, cookie ou header é publicado.
- O diagnóstico não muda condições de sucesso, prioridade do requestfailed, timeout, número de POSTs, payload, CAS, readback, corpus financeiro ou a perda de resposta. A exceção original continua fatal. Nenhuma asserção foi removida.
- Estado: partial. Pendente/unbound: installed-fixture.ts:539, localizar quem cancela a confirmação usando os fatos originais; installed-bi.spec.ts:12 e installed-bi-regressions.spec.ts:42/:84 permanecem sem qualificação. Não interpretar diagnóstico como aprovação.
- Retomar: compor este único arquivo sobre Assembly32 b75cd49fc53701209c116511fc6643693b09c2d7 e executar os mesmos dois specs uma vez para observar o ponto fatal autorizado pela raiz. Ler o resultado e corrigir somente a causa comprovada.
