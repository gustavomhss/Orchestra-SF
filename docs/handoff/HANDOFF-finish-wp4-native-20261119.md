# Handoff — finish-wp4-native-20261119

SHA do código: a4d29fff44349d058324c3e54c041d5cf0cad859
Data: 2026-11-19
Estado: partial

## Feito

- Branch a partir do sf-join-four 8eb6c37106e12ac9e79644872e70c717df3db875, após o merge da foundation qualificada. Os quatro arquivos partem do conteúdo da composição 24 (d2e9f9e09f5aca36d1b7be02dd12336b8676fb3a); este checkpoint acrescenta somente as correções observadas abaixo.
- Planner WP03: usa o campo nativo “Paste tab-separated values” e “Review pasted values”, que chama o mesmo preparePaste original de S02. A navegação por teclado continua exigida antes da colagem. A prévia original A02, zero efeitos antes de Apply, exclusão da linha inválida, texto bruto preservado, exatamente duas aplicações e leitura após reload continuam.
- CAP03: o select de ano ganha aria-label com a mesma tradução Year já exibida. O label anterior envolve o próprio select e todas as opções; o screenshot original mostrou Year2026 e os dados, enquanto getByLabel exact não encontrava o controle. Não muda seleção, cálculo ou requisição.
- WP10 Decisions: entra pelo helper enterWorkbench já qualificado e aciona New case. O formulário é section.sf-n24-create form, como no journey original; conserva a criação única, payload, critérios, leitura persistida e reabertura.
- BI01: o produtor dashboard/port.ts:272–277 publica 12 fatos categóricos budget:YYYY-MM:basis além das 36 medidas das séries. A tabela nativa agora mostra esses 12 textos, seus períodos, granularidade, evidência e referência originais. O gráfico, cálculos e coverage permanecem do produtor e das séries existentes. Não inventa moeda para basis.
- Asserção de BI conserva 48 valores e 49 linhas, exige os 36 itens das séries e os 12 IDs basis exatos, e compara cada texto basis recebido com o renderizado.

### Arquivos

- packages/app-shell/e2e/sucafina/wp03/planner-mounted.spec.ts
- packages/app-shell/e2e/sucafina/wp10/composition.spec.ts
- packages/app-shell/src/orchestra/chapters/sucafina/dashboard/budget/index.tsx
- packages/app-shell/src/orchestra/chapters/sucafina/bi/finance/model.ts

## Pendente

- packages/app-shell/e2e/sucafina/wp10/composition.spec.ts:305 — screenshot original mostra “Sucafina route not admitted”. O sufixo /requests/<ref>/sourcing/compare é o mesmo que passou no OP-PROC-01; a identidade synthetic-po-1 e a admissão original ainda precisam ser conferidas. Não há ID ou rota substituídos por hipótese.
- packages/app-shell/e2e/sucafina/wp10/composition.spec.ts:391 — o run original encerrou em extended-ui com “Target page, context or browser has been closed”; Effect mascarou a origem como “All fibers interrupted without error”. Ainda falta localizar a etapa concreta antes de corrigir.
- packages/app-shell/e2e/sucafina/wp03/planner-mounted.spec.ts:307 — o novo caminho de entrada TSV aguarda gate. O snapshot original confirma as duas linhas gravadas, sem prévia nem alerta; não prova ainda que o clique nativo completa A02.
- Gate do checkpoint e integração: coordenados pela raiz; nenhum gate WP4 novo foi disparado por este agente.

## Decisões e justificativas

- Asserções removidas: nenhuma prova de negócio. Não foram alterados timeout, retries, zero/one/two-effect checks, revisão humana, exclusão da linha inválida, reload, requisições anônimas nem redaction.
- A expectativa incompatível de 48 IDs em presentation.series foi remapeada para 36 IDs de séries e 12 fatos basis autorizados. O produtor dashboard/bi.ts:6 contém exatamente três séries numéricas; os textos basis já existiam em projection.values e estavam omitidos do renderer.
- O uso de clipboard da automação foi trocado pelo textarea nativo de S02. O payload continua sendo o mesmo TSV original e as provas de navegação de grade por teclado continuam no spec.
- Nenhuma mudança em F01, runtime/application.ts, host-context, UI54 ou arquivos de Operations. O WP5 confirmou que o renderer UI12 já tem requestSummary/sourceVersion e que o OP-PROC-01 passou; o caso sintético WP10 ainda precisa de diagnóstico próprio.

## Como retomar

1. Compor os quatro arquivos deste branch sobre o candidato atual da raiz; preservar os demais deltas qualificados.
2. Resolver os dois unbound de composição acima com o contrato e evidência originais.
3. Executar uma vez o narrow WP03 planner-mounted.spec.ts + WP10 composition.spec.ts via ci-run-linux-* e registrar o run terminal.
4. Integrar pelo coordenador apenas após o resultado. Este checkpoint não declara GO.

## Comandos e resultados

- Run original [44602654358](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44602654358): FAILURE, dois testes; snapshot 9f766ac329f50589dc348ae1a75fdb169a894a10, código 15388053117883174329454207e60e2a878f5426, job 135837894807.
- [44608770375](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44608770375): SUCCESS somente da extração do artifact original 14569559143; nenhum teste repetido. Documento em audit-wp4-observations-20261119/docs/handoff/observed-wp4-original-20261119.md.
- [44609084639](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44609084639): SUCCESS somente da extração compacta do estado final do Planner. Documento no mesmo branch, docs/handoff/observed-wp4-planner-tail-20261119.md.
- [44609354099](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44609354099): SUCCESS somente da retenção dos screenshots sintéticos originais de Budget e Requests; disponíveis em audit-wp4-screens-20261119/docs/handoff/evidence/wp4-{budget,requests}-original-20261119.png. Nenhum resultado de UI é inferido dessas auditorias.
- Typecheck, Playwright e guards deste checkpoint: pendentes do gate composto pela raiz.

## Observação do GET BI05 em extended-ui

- Código d992d1064b7da595bca0cb04457f3e347a8d6616, somente packages/app-shell/e2e/sucafina/wp10/extended-flows.ts:73–99. O original run44602654358 recebeu HTTP200 para o terceiro bi-data, BI05, e o observador registrou net::ERR_ABORTED nesse GET; o fluxo terminou em responseBody/Target closed sob o escopo de instalação. Evidência original preservada em audit-wp4-observations-20261119/docs/handoff/observed-wp4-original-20261119.md, audit44608770375 SUCCESS apenas extração.
- O fixture captura somente GET /sucafina/dashboard?sf=bi-data&viewId=BI05 por route.fetch({maxRetries:0,maxRedirects:0}), retém a mesma APIResponse original e faz route.fulfill({response:original}). Nenhum status, header, byte, campo, seleção ou corpo é reescrito; nenhum GET adicional, redirect, retry ou POST é executado.
- A leitura do teste usa o buffer original já existente em reports-support/model.ts, que prova identidade da Request e igualdade de status. Mantidos explicitamente status200, response.finished()===null, request.failure()===null, decode do schema, selectionRef igual ao catálogo e tabela original visível. Nenhuma asserção removida ou timeout alterado.
- Dependência de composição: exports retainReportResponse/observedReportResponse de reports-support/model.ts já presentes em assembly28 a7286859312e8a27bd47367fc30333577ae929ae; não foram duplicados nem editados neste branch.
- Pendente/unbound: extended-flows.ts:97 precisa comprovar o término no próximo gate; se o aborto persistir, reter o diagnóstico original e não omitir a asserção. composition.spec.ts:305 continua aguardando causa de admissão CAP25, em paralelo ao diagnóstico original UI48 da raiz. O restante de WP4 não foi ampliado neste checkpoint.
- Como retomar: compor somente o novo extended-flows.ts sobre assembly28, preservando os quatro blobs anteriores2e787. Integrador decide o único próximo gate WP4 após resolver a admissão; este delta ainda não tem run de qualificação. Não declarar PASS/GO a partir da auditoria.


## CAP25 — diagnóstico de admissão original após falha

- Código a4d29fff44349d058324c3e54c041d5cf0cad859, estado partial; somente wp10/composition.spec.ts. O caso original de Requests do run44602654358 mostrou Sucafina route not admitted e não fez GET CAP25/C02. As asserções de summary, sourceVersion, todas as colunas, três fornecedores, scores87.9/85.0 e30240USD/FX1.08 continuam intactas.
- Conferência de código: local/entry.ts monta createSfProcurementProjectionHandlers e observeSfDomainHealth como o factory Operations. domain-health.ts:98–114 exige sf_request_read original e a fonte procurement-request-selection/all; não exige período global persistido. Não foi aplicada a correção de seleção C12 a esse fluxo, nem alterada disponibilidade F01.
- Feito: o observer conserva somente em memória a URL do último GET context original. Se a asserção do summary falhar, a fixture faz uma releitura autenticada nessa mesma URL, decodifica SfContextResult e registra apenas HTTPstatus/status, destination CAP25 (capabilityId/canRead/allowedActionIds) e availability CAP25. Nenhuma identidade, query, header, cookie ou token é publicado. Depois relança a mesma falha; em sucesso não faz essa leitura extra.
- Asserções removidas: nenhuma. Não aumenta timeout, não espera falsamente um C02 que nunca foi emitido, não cria fonte, grant ou resultado. O diagnóstico serve para distinguir ausência de admissão, fonte ou handler com fatos do produtor.
- Pendente/unbound: wp10/composition.spec.ts:316 precisa coletar o diagnóstico se a recusa persistir no próximo gate composto; wp10/extended-flows.ts:42 ainda requer qualificação do buffer original BI05 d992; wp03/planner-mounted.spec.ts:11 mantém a qualificação pendente do TSV nativo anterior. Nenhum novo WP4 gate foi lançado aqui.
- Retomar: compor este blob de composition.spec.ts junto do buffer d992 e dos quatro deltas2e787 já descritos; coordenar um único gate WP4 com a raiz. Se CAP25 recusar novamente, usar facts.cap25Destinations/cap25Availability do artefato original antes de qualquer mudança de produto.
