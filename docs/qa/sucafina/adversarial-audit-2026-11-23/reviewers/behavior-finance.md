# Suplemento adversarial — Finance Planner CAP17, CAP18 e CAP19

## Resultado e fronteira de evidência

**Foram abertos diretamente os 27 PNGs originais com hash único deste percurso: 19 desktop de 1440×1100 e oito mobile de 320×900.** São 26 capturas nomeadas e um `test-finished` único. O artefato oferece 28 paths; o outro `test-finished` é byte a byte igual ao editor CAP19 PT-BR/320 e não foi recontado. Nenhuma imagem aberta pelo root foi atribuída a este agente.

A inspeção acrescenta um refinamento P3: a revisão de comandos financeiros abandona a apresentação semântica que o formulário já oferece, mostrando código de mês e números sem agrupamento. Não foi encontrado novo defeito funcional neste suplemento. A família de referências técnicas em primeiro plano BA-05 também aparece em CAP19; não é contada outra vez.

[Manifesto de inspeção e hashes](sandbox:artifact-extract/behavior-finance-supplement.json). Todos os arquivos foram lidos como dados. Nenhum build, teste local, novo CI ou alteração de produto ocorreu.

## Proveniência

- [Run 45101169602](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45101169602), job `137452102840`, snapshot `edbc27f05879de702ba30161e97561bd740ec923`.
- Produto capturado: `10a7aaa7b69b6f80d8dfbac454007e7742f89bc2`; dev auditado: `5b48dab52621037168ad4e3a6243c79a4fe5ad6e`.
- Artefato `14785164854`, SHA-256 `0fca628c31339500603bf915112fd5910447f71072b992ec12bf06c46bd10421`.
- Resultado histórico do spec: dois casos passaram, zero falhas/skips/retries; bundle production, Chromium, um worker, uma repetição. Este suplemento examina apenas o segundo caso, CAP17/18/19, de 60.144 ms. Não representa dois novos ensaios.
- [Receipt publicado no repositório](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/docs/qa/sucafina/visual-audit/verification/finance-final-runtime.json) e [cópia local lida](sandbox:artifact-extract/behavior-finance-runtime-receipt.json).

### Paridade com o dev

O [compare completo de 68 arquivos / 22 commits](https://github.com/gustavomhss/Orchestra-SF/compare/10a7aaa7b69b6f80d8dfbac454007e7742f89bc2...5b48dab52621037168ad4e3a6243c79a4fe5ad6e) não altera os módulos específicos de CAP17/18/19, `shared/monthly-grid`, `shared/change-review`, os componentes de chart/frame nem os tokens globais de tema. Há mudanças em `shared/detail` e `shared/table`: o header do `SfRecordDetail` ganhou outra estrutura e o `SfDataTable` recebeu padding/altura para sort.

Essas capturas usam o detalhe e a tabela locais `sf-u07`, `SfMonthlyGrid` e `SfChangeReview`; CAP17 usa `SfChartFrame`. O código de imports e markup não usa `SfRecordDetail`/`SfDataTable` nessas telas. A análise sustenta continuidade dos pontos específicos examinados, mas **não é uma nova renderização integral de dev nem uma qualificação das novas versões desses componentes compartilhados**.

Fontes: [budget-view.tsx](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/planner/opex/budget-view.tsx) (imports 23–38; detalhe local 994–1004), [overview/index.tsx](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/planner/overview/index.tsx) (imports 10–14) e [compare local registrado](sandbox:artifact-extract/finance-extra.json).

## BF-01 — P3: código de mês e valor cru na etapa de revisão

O seletor Closed through usa nome de mês, mas a revisão exibe somente 0→2. O detalhe OPEX mostra Annual budget 120,000, enquanto a revisão mobile apresenta 120000→126000 e a criação 36000 sem agrupamento; CAP19 spread mostra 240000. O usuário perde pistas de leitura justamente antes de confirmar.

**Causa:** `fields()` converte `annual` e `period` em `textual(String(value))`. O seletor associa os valores de 1 a 12 aos nomes de mês e o 0 a todos os meses abertos, mas a revisão recebe apenas o código. O detalhe usa `Intl.NumberFormat`; a revisão recebe texto. O componente compartilhado possui suporte a valores numéricos semânticos, porém esse caminho não o utiliza.

**Correção proposta:** adicionar apresentação semântica preservando integralmente codec, payload, valor canônico e binding da confirmação. Exibir o nome localizado do mês, tratar 0 como todos os meses abertos e agrupar valores financeiros cuja natureza/unidade já esteja estabelecida. Manter dado original disponível. Não inferir moeda ausente nem recalcular orçamento.

**Limite:** trata-se de legibilidade e consistência. Não há evidência de valor alterado, cálculo errado ou confirmação de um mês diferente. A revisão de fechamento foi cancelada no percurso.

Fontes:

- [packages/app-shell/src/orchestra/chapters/sucafina/planner/opex/budget-view.tsx (597–629; 762–764; 968–978)](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/planner/opex/budget-view.tsx).
- [shared/change-review/index.tsx (44–73)](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/shared/change-review/index.tsx).
- [Spec de origem (379–413; 508–511)](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/e2e/sucafina/design-wave-three-finance.spec.ts).

Imagens examinadas:

- [CAP18-dark-320-record-review-actions-test-data.png](sandbox:artifact-extract/additional/finance-final/packages/app-shell/e2e/test-results/sucafina-design-wave-three-c1cdf-9-original-planner-commands-chromium/CAP18-dark-320-record-review-actions-test-data.png).
- [CAP18-dark-desktop-closed-month-review-test-data.png](sandbox:artifact-extract/additional/finance-final/packages/app-shell/e2e/test-results/sucafina-design-wave-three-c1cdf-9-original-planner-commands-chromium/CAP18-dark-desktop-closed-month-review-test-data.png).
- [CAP18-dark-desktop-create-review-test-data.png](sandbox:artifact-extract/additional/finance-final/packages/app-shell/e2e/test-results/sucafina-design-wave-three-c1cdf-9-original-planner-commands-chromium/CAP18-dark-desktop-create-review-test-data.png).
- [CAP18-dark-desktop-record-editor-test-data.png](sandbox:artifact-extract/additional/finance-final/packages/app-shell/e2e/test-results/sucafina-design-wave-three-c1cdf-9-original-planner-commands-chromium/CAP18-dark-desktop-record-editor-test-data.png).
- [CAP19-dark-desktop-spread-review-test-data.png](sandbox:artifact-extract/additional/finance-final/packages/app-shell/e2e/test-results/sucafina-design-wave-three-c1cdf-9-original-planner-commands-chromium/CAP19-dark-desktop-spread-review-test-data.png).

## Cobertura finita

| Área | Evidência realmente examinada | O que permanece sem prova |
| --- | --- | --- |
| CAP17 | Resumo desktop dark/light e PT-BR; série mensal desktop; resumo e comparação de versões EN/light/320. Rótulos, valores e zeros visíveis. | Gráfico mobile completo; PT-BR/320; tooltip, teclado e screen reader; zoom real. |
| CAP18 | Grid desktop no início e em dezembro com identidade fixa; light/dark e PT-BR desktop; paste preview do produtor; detalhe/anual; revisões criar, editar, fechar mês e split; início de cartão mensal mobile e footer da revisão mobile. | Todos os 12 meses mobile pintados: apenas a contagem DOM foi assegurada. Alterações de orçamento, fechamento e split foram revisadas/canceladas, não confirmadas neste percurso. Não há revisão PT-BR capturada. |
| CAP19 | Grid desktop dark/light e PT-BR; cartões de projeto desktop/mobile; editor EN/PT-BR/320; footer de revisão mobile; um save original confirmado, seguido de reentrada e leitura da descrição persistida; revisão spread cancelada. | Endpoint dezembro CAP19; grid mobile inteiro; spread/delete/reset confirmados; rejeição por versão stale; todas as combinações PT-BR/light. |
| Teclado e rolamento | Teste CAP18 usa End/Home e asserções de aria-activedescendant, viewport, foco e separação de headers sticky. verifyNativeScroller usa scrollTo vertical programático. | Wheel/trackpad/touch, seleção completa, IME, teclado virtual e zoom real. Screenshots não substituem interação. |
| Estabilidade | Run histórico 2/2 casos, retries 0 e repeatEach 1. Nosso escopo é o único caso Planner de 60.144 ms. Prazo de 15.000 ms vinculado à resposta original CAP19; timeout externo de 300.000 ms. | Nenhuma campanha de flakiness; nenhum disparo forçado do timer ou prova de cancelamento; nenhuma execução nova. |

O source do teste sustenta End/Home em CAP18, preservação da identidade de linha e moeda em dezembro e foco de volta a janeiro (linhas 327–349). `verifyNativeScroller` usa `element.scrollTo`, linhas 561–568: isso não é ensaio de wheel/trackpad. Em mobile, a contagem de 12 labels no DOM não significa que 12 meses completos ficaram visíveis no PNG.

[Fonte dos percursos e suas asserções](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/e2e/sucafina/design-wave-three-finance.spec.ts).

### Qualidade da execução histórica

O save CAP19 instala o observador original, mantém o limite explícito de 15.000 ms e exige exatamente um POST adicional, resposta original `{ok:true}`, fechamento da revisão e reentrada nativa para ler a descrição persistida. O timeout externo de 300.000 ms não substituiu esse limite da resposta. A fonte e o receipt não acrescentam rejeição CAS/stale nem forçam o ramo de timeout. O temporizador limita a espera; não demonstra cancelamento de um POST em voo. O run único não mede taxa de flakiness.

### Observações que não viraram defeito

Não se classificou como defeito a presença de overflow local em uma tabela de 12 meses, valores ausentes honestos, zeros fornecidos pelo produtor ou recorte horizontal de um input nativo longo. CAP17 apresenta `actualYTD` e série mensal como campos distintos entregues pelo produtor; sua aparente divergência no fixture não prova um cálculo incorreto do cliente.

CAP19 acrescenta evidência da família BA-05: `projectReference()` concatena nome e UUID, repetindo o conjunto em três colunas de revisão; Owner usa identificador técnico no cartão/editor. Melhorar a hierarquia sem inventar um nome humano que o produtor não ofereça. Fonte: [budget-view.tsx (579–582; 606–607; 954–955)](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/planner/opex/budget-view.tsx).

## Inventário dos originais abertos

A lista abaixo inclui somente os 27 paths efetivamente abertos por `behavior_audit`; hashes, dimensões, run e fonte estão no JSON. Os nomes não são usados como prova de conteúdo ou interação.

- [CAP17-dark-desktop-summary-and-series-test-data.png](sandbox:artifact-extract/additional/finance-final/packages/app-shell/e2e/test-results/sucafina-design-wave-three-c1cdf-9-original-planner-commands-chromium/CAP17-dark-desktop-summary-and-series-test-data.png).
- [CAP17-light-320-summary-test-data.png](sandbox:artifact-extract/additional/finance-final/packages/app-shell/e2e/test-results/sucafina-design-wave-three-c1cdf-9-original-planner-commands-chromium/CAP17-light-320-summary-test-data.png).
- [CAP17-light-320-version-comparison-test-data.png](sandbox:artifact-extract/additional/finance-final/packages/app-shell/e2e/test-results/sucafina-design-wave-three-c1cdf-9-original-planner-commands-chromium/CAP17-light-320-version-comparison-test-data.png).
- [CAP17-light-desktop-summary-test-data.png](sandbox:artifact-extract/additional/finance-final/packages/app-shell/e2e/test-results/sucafina-design-wave-three-c1cdf-9-original-planner-commands-chromium/CAP17-light-desktop-summary-test-data.png).
- [CAP17-pt-BR-dark-desktop-test-data.png](sandbox:artifact-extract/additional/finance-final/packages/app-shell/e2e/test-results/sucafina-design-wave-three-c1cdf-9-original-planner-commands-chromium/CAP17-pt-BR-dark-desktop-test-data.png).
- [CAP18-dark-320-record-review-actions-test-data.png](sandbox:artifact-extract/additional/finance-final/packages/app-shell/e2e/test-results/sucafina-design-wave-three-c1cdf-9-original-planner-commands-chromium/CAP18-dark-320-record-review-actions-test-data.png).
- [CAP18-dark-320-source-months-test-data.png](sandbox:artifact-extract/additional/finance-final/packages/app-shell/e2e/test-results/sucafina-design-wave-three-c1cdf-9-original-planner-commands-chromium/CAP18-dark-320-source-months-test-data.png).
- [CAP18-dark-desktop-closed-month-review-test-data.png](sandbox:artifact-extract/additional/finance-final/packages/app-shell/e2e/test-results/sucafina-design-wave-three-c1cdf-9-original-planner-commands-chromium/CAP18-dark-desktop-closed-month-review-test-data.png).
- [CAP18-dark-desktop-create-review-test-data.png](sandbox:artifact-extract/additional/finance-final/packages/app-shell/e2e/test-results/sucafina-design-wave-three-c1cdf-9-original-planner-commands-chromium/CAP18-dark-desktop-create-review-test-data.png).
- [CAP18-dark-desktop-monthly-grid-december-test-data.png](sandbox:artifact-extract/additional/finance-final/packages/app-shell/e2e/test-results/sucafina-design-wave-three-c1cdf-9-original-planner-commands-chromium/CAP18-dark-desktop-monthly-grid-december-test-data.png).
- [CAP18-dark-desktop-monthly-grid-start-test-data.png](sandbox:artifact-extract/additional/finance-final/packages/app-shell/e2e/test-results/sucafina-design-wave-three-c1cdf-9-original-planner-commands-chromium/CAP18-dark-desktop-monthly-grid-start-test-data.png).
- [CAP18-dark-desktop-original-producer-paste-preview-test-data.png](sandbox:artifact-extract/additional/finance-final/packages/app-shell/e2e/test-results/sucafina-design-wave-three-c1cdf-9-original-planner-commands-chromium/CAP18-dark-desktop-original-producer-paste-preview-test-data.png).
- [CAP18-dark-desktop-record-editor-test-data.png](sandbox:artifact-extract/additional/finance-final/packages/app-shell/e2e/test-results/sucafina-design-wave-three-c1cdf-9-original-planner-commands-chromium/CAP18-dark-desktop-record-editor-test-data.png).
- [CAP18-dark-desktop-split-review-test-data.png](sandbox:artifact-extract/additional/finance-final/packages/app-shell/e2e/test-results/sucafina-design-wave-three-c1cdf-9-original-planner-commands-chromium/CAP18-dark-desktop-split-review-test-data.png).
- [CAP18-light-desktop-grid-test-data.png](sandbox:artifact-extract/additional/finance-final/packages/app-shell/e2e/test-results/sucafina-design-wave-three-c1cdf-9-original-planner-commands-chromium/CAP18-light-desktop-grid-test-data.png).
- [CAP18-pt-BR-dark-desktop-test-data.png](sandbox:artifact-extract/additional/finance-final/packages/app-shell/e2e/test-results/sucafina-design-wave-three-c1cdf-9-original-planner-commands-chromium/CAP18-pt-BR-dark-desktop-test-data.png).
- [CAP19-dark-320-project-editor-test-data.png](sandbox:artifact-extract/additional/finance-final/packages/app-shell/e2e/test-results/sucafina-design-wave-three-c1cdf-9-original-planner-commands-chromium/CAP19-dark-320-project-editor-test-data.png).
- [CAP19-dark-320-project-review-actions-test-data.png](sandbox:artifact-extract/additional/finance-final/packages/app-shell/e2e/test-results/sucafina-design-wave-three-c1cdf-9-original-planner-commands-chromium/CAP19-dark-320-project-review-actions-test-data.png).
- [CAP19-dark-320-projects-test-data.png](sandbox:artifact-extract/additional/finance-final/packages/app-shell/e2e/test-results/sucafina-design-wave-three-c1cdf-9-original-planner-commands-chromium/CAP19-dark-320-projects-test-data.png).
- [CAP19-dark-desktop-confirmed-project-test-data.png](sandbox:artifact-extract/additional/finance-final/packages/app-shell/e2e/test-results/sucafina-design-wave-three-c1cdf-9-original-planner-commands-chromium/CAP19-dark-desktop-confirmed-project-test-data.png).
- [CAP19-dark-desktop-monthly-grid-test-data.png](sandbox:artifact-extract/additional/finance-final/packages/app-shell/e2e/test-results/sucafina-design-wave-three-c1cdf-9-original-planner-commands-chromium/CAP19-dark-desktop-monthly-grid-test-data.png).
- [CAP19-dark-desktop-spread-review-test-data.png](sandbox:artifact-extract/additional/finance-final/packages/app-shell/e2e/test-results/sucafina-design-wave-three-c1cdf-9-original-planner-commands-chromium/CAP19-dark-desktop-spread-review-test-data.png).
- [CAP19-dark-desktop-projects-test-data.png](sandbox:artifact-extract/additional/finance-final/packages/app-shell/e2e/test-results/sucafina-design-wave-three-c1cdf-9-original-planner-commands-chromium/CAP19-dark-desktop-projects-test-data.png).
- [CAP19-light-desktop-monthly-grid-test-data.png](sandbox:artifact-extract/additional/finance-final/packages/app-shell/e2e/test-results/sucafina-design-wave-three-c1cdf-9-original-planner-commands-chromium/CAP19-light-desktop-monthly-grid-test-data.png).
- [CAP19-pt-BR-dark-320-project-editor-test-data.png](sandbox:artifact-extract/additional/finance-final/packages/app-shell/e2e/test-results/sucafina-design-wave-three-c1cdf-9-original-planner-commands-chromium/CAP19-pt-BR-dark-320-project-editor-test-data.png).
- [CAP19-pt-BR-dark-desktop-test-data.png](sandbox:artifact-extract/additional/finance-final/packages/app-shell/e2e/test-results/sucafina-design-wave-three-c1cdf-9-original-planner-commands-chromium/CAP19-pt-BR-dark-desktop-test-data.png).
- [test-finished-1.png](sandbox:artifact-extract/additional/finance-final/packages/app-shell/e2e/test-results/sucafina-design-wave-three-c1cdf-9-original-planner-commands-chromium/test-finished-1.png).
