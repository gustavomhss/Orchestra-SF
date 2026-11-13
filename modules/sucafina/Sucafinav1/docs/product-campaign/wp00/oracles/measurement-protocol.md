# WP00.T03 — protocolo proposto de medição

Estado: corpus preparado no SQLite real e tentativa hospedada executada; bootstrap bloqueado em C15 antes de autenticação, com zero medições de UI. Todos os datasets são sintéticos e não representam volume conhecido da Sucafina.

## Carga e repetição

- Gerar/preparar 1.000 linhas financeiras, 200 pedidos e 100 projetos por `test/product/wp00/fixtures/volume.ts#createVolumeCorpus`, conforme `corpus-v2.json`. O mesmo gerador é consumido por `corpus-consumer.test.ts`; os totais esperados independentes estão em `consumer-inputs.json`. Registrar digest dos dados gerados e ambiente candidato usado quando a medição for executada.
- Executar pelo menos 30 repetições por fluxo comparável: abrir/filtrar Dashboard, comparar cenário Planner, ranquear Procurement, pesquisar/preparar relatório e prévia/reimportação exata.
- Registrar cada repetição individualmente. Separar tempo até a resposta visual utilizável de conclusão da tarefa e correção do resultado. Não misturar essas medidas em uma média única.
- Fixar e registrar runtime, sistema, dispositivo, browser, commit candidato, viewport, zoom, estado de cache e forma de carga. Se um campo não puder ser observado, registrar como ausente.
- Usar viewports de 320, 768 e 1440 px e zoom de 200%; anotar overflow, controles inacessíveis, perda de conteúdo e necessidade de resumo explícito.
- Reportar observações brutas, mediana e p95 por fluxo/configuração, juntamente com falhas e cancelamentos; não declarar limiar de desempenho porque o plano não fornece um.

## Baseline

O baseline de comparação deve ser medido no mesmo ambiente e com o mesmo corpus antes de comparar com o candidato. Não existe resultado temporal observado nesta proposta. Não converter uma medida de laboratório em afirmação sobre dados reais ou produção.

## Registro obrigatório por repetição

O recibo deve conter `candidateCommit`, `baselineCommit`, `datasetDigest`, `flow`, `repetition`, `startedAt`, `runtimeVersion`, `operatingSystem`, `device`, `browserVersion`, `viewportWidth`, `viewportHeight`, `zoomPercent`, `cacheState`, `visualReadyMs`, `completionMs`, `outcome`, `resultEvidenceRef` e `failureReason` quando aplicável. Campo não observado fica `null` acompanhado de razão; não preencher com zero. Repetições são identificadas de 1 a pelo menos 30 para cada fluxo/configuração comparável; uma tentativa falha permanece no conjunto bruto, sem retry oculto.

`visualReadyMs` exige observação do consumidor visual utilizável, não a conclusão de uma função de domínio. `completionMs` cobre a conclusão da tarefa e seu resultado correto. Uma amostra sem interface não pode satisfazer a primeira medida. `candidateCommit` deve coincidir com a árvore de produto efetivamente executada no recibo CI; registrar separadamente o SHA do envelope CI quando houver.

## Cobertura que já pode ser executada no CI cirúrgico

`baseline-corpus-coverage.test.ts` consome o mesmo corpus pelo Planner real, pelo `quoteAssessment` real e por ambos os renderizadores DOCX/PPTX. `corpus-consumer.test.ts` cobre conversão/FX ausente, domínios sintéticos e volume. Isso valida os inputs e resultados declarados, sem validar latência visual, persistência após reload, toda a autorização do host ou jornadas nativas.

As medições de 30 repetições, os três viewports e zoom 200% permanecem **NOT_RUN** enquanto não houver observação real. A futura execução deve anexar dados brutos e artefatos verificáveis; o relógio de um teste unitário não substitui esse recibo.

## Harness da instalação real

`packages/app-shell/e2e/sucafina/wp00/baseline-ui.spec.ts` usa o runner Playwright existente com `e2e/playwright.production.config.ts`. O helper no mesmo prefixo prepara uma instalação privada com o corpus sintético pelo `openLocalStore.transaction` existente. O teste inicia o CLI e o `local/entry.ts` originais por `AppProcess`, autentica pelo mecanismo real de operador local e visita as rotas do produto. Não substitui bundle residente, identidade, provider nem resposta HTTP.

O escopo implementado desse primeiro harness é 30 repetições de filtro anual do Dashboard e abertura da tabela Procurement por viewport de 320, 768 e 1440 px. Resposta visual exige resultado de negócio atual visível; conclusão exige os demais valores e identidades esperados. Os anexos `wp00-raw-measurements` e `wp00-server.log` preservam a etapa e a causa quando o bootstrap falha, sem preencher tempos ausentes. O SHA do snapshot é registrado pelo runner e o recibo da entrega liga esse snapshot ao produto W.

Esse harness é parcial: comparação Planner, ranking sourcing, preparação de relatório, reimportação exata, atores restritos, zoom real de 200% e tempo do baseline histórico continuam requisitos separados. A configuração de typecheck no prefixo próprio inclui explicitamente spec e helper; o job confere a configuração resolvida pelo script oficial do app antes de compilá-los. O resultado observado, inclusive zero medições em caso de falha, deve ser lido no recibo CI mais recente; a existência do harness não demonstra execução.

## Resultado hospedado atual

O run [43522985791](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43522985791), produto `70476b99e0a34c4432d48f5d2f3710c26562aa1b`, preparou o corpus 1000/200/100 com digest `7b37f785864261ec218f53368b42c2f5a3a181ae3bb95197676e96b00ca7ccea`. O CLI real encerrou com `Profile policy mismatch: sf_portfolio` antes de readiness/autenticação. O recibo registra `authenticated: false`, `cacheState: null` e `observations: []`. Não há mediana/p95, comparabilidade temporal, viewport aprovado ou zoom observado. A configuração e o typecheck do harness passaram separadamente no run [43522928224](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43522928224). O [recibo completo](../../../sf2h/receipts/WP00/ui-bootstrap-observations.json) preserva as duas tentativas e a correção dos metadados históricos.
