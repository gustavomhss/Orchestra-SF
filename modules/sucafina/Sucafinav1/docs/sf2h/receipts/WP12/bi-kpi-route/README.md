# WP12 — driver BI01 com conferência KPI real

Este incremento acrescenta somente `native-execution-bi-kpi.test.ts` e seus recibos próprios. Ele preenche a implementação de driver que faltava para `sf_kpi_explain` em `required_operations` de `sf-produzir-bi-contextual`. Os testes BI08 existentes, o mapa D21 e o adendo publicado em W22 continuam imutáveis. Código escrito e revisão estática não são execução hosted nem upgrade de aceite.

## Composição e discriminantes

O caso recebe duas referências emitidas por portas públicas: `Budget Overview / budgetSeries` para BI01 e `Budget Overview / budgetMetrics` para o KPI. As duas pertencem ao mesmo período anual, mas seus escopos são distintos. A skill precisa ler o caso real por `sf_case_read`, descobrir a segunda referência e qualificá-la pelo formato público de `dashboardMetricSelector`. O objetivo não contém uma identidade opaca ou privada de seleção, artefato ou tabela.

Os registros de origem têm um orçamento anual cadastrado de 120.000 e doze overrides mensais explícitos de 1.000 a 12.000. O produtor deve fornecer a série efetiva não uniforme e o total 78.000. A conferência compara os componentes e valores efetivamente devolvidos pelas portas Dashboard e KPI; não cria outro motor financeiro.

A célula `actual` de janeiro contém o número zero. A propriedade de fevereiro está ausente; `forecast` de abril também está ausente. O teste exige `0 / confirmed` para a primeira e `null / absent` para as demais, além das lacunas anuais de actual/forecast. As somas de verificação recusam qualquer valor ausente ou não numérico antes de somar. Todos os valores mantêm a moeda `unspecified` do produtor. O USD escolhido pelo humano para o caso não é aplicado aos valores do Dashboard e não há FX.

O dispatcher UI real deve recusar tanto o KPI qualificado pela fonte errada da série quanto a alteração do período autorizado. As recusas não substituem o ramo nativo: havendo modelo instalado, o teste exige `sf_case_read`, as quatro operações normativas da skill, os recibos efetivos e a contribuição validada.

## Proveniência e consumidores

O produtor de BI01 cria o input e o artefato reais. O consumidor WP05 abre a apresentação, a tabela equivalente e o drilldown da série antes e depois de reabrir o host. A tabela e a proposta mantêm a referência exclusiva da série BI.

A conferência KPI é auxiliar. Seu resultado, sua referência `budgetMetrics` e seu recibo nativo permanecem na Session real. O driver verifica os digests de payload e resultado, IDs de chamada/run/sessão/principal e a igualdade entre o total anual e os doze componentes da série. Quando existe missão nativa concluída, reabre também esses registros da Session e o consumidor HTTP da contribuição. O WP05 não é declarado consumidor de um novo campo KPI, e nenhum campo extra é inserido em `ContextualBIProposal`.

Sem modelo instalado, o teste registra somente a disponibilidade observada, a preparação, os resultados UI e os consumidores determinísticos reais. Não fabrica modelo, recibo, execução ou contribuição. Um modelo disponível que não conclua a missão causa falha.

## Limites que permanecem explícitos

A rota AM02 `sf_finance / sf-explicar-forecast / sf_kpi_explain` continua uma obrigação distinta. Este driver não a substitui. Ele cobre a implementação de um witness normativo da skill BI e utiliza sua rota Finance `sf_bi_view`.

O finding `WP12-BI-MODEL-ARTIFACT-IDENTITIES` também permanece: o contrato de input e as ferramentas consumidas não expõem os identificadores persistidos de projeção/tabela que o verificador exige. A leitura de C08 usada nas assertions é separada e nunca alimenta o modelo com esses IDs. O novo driver não anuncia fechamento desse gate de composição.

`implementation.json` identifica o arquivo e sua seleção hosted, os critérios canônicos, os dois consumidores e o estado de prova. `source-pins.json` conserva as fontes públicas lidas com commit/blob/hash. `independent-review.json`, quando publicado junto deste pacote, é revisão estática somente. Nenhum teste de produto ou typecheck foi executado localmente; o teste tem limite próprio de 360 segundos e marcadores de fases para diagnóstico no GitHub Actions.
