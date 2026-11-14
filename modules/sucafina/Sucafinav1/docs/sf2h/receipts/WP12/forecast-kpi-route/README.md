# Forecast → KPI auxiliar selecionado pela pessoa

**Implementação candidata; produto e typecheck ainda não executados para este arquivo.** O driver isolado cobre as ausências originais6 e12: a operação necessária `sf_kpi_explain` da skill `sf-explicar-forecast` e sua rota AM02 exata sob `sf_finance`. A fonte publicada de base é W26; nenhum contrato, helper existente ou produtor alheio foi modificado.

A pessoa seleciona um indicador Budget Overview e dois forecasts para o mesmo caso e período. O propósito é conferir se o indicador orçamentário representa uma medida comparável ou uma grandeza distinta antes de confundi-lo com a mudança contra a base. O seletor auxiliar é público e sua seleção humana aparece no objetivo; não há alegação de descoberta autônoma. O contexto e as três fontes são resolvidos pelas portas reais.

O KPI mantém a moeda `unspecified` devolvida pelo Dashboard, enquanto o Planner mantém USD. O próprio produtor KPI recusa comparação monetária sem base definida. O teste preserva essa recusa e não calcula margem ou conversão entre os produtores. Os valores de orçamento coincidentes não são tratados como prova de uma origem financeira comum.

`FinancialAnalysis` continua fechado: payload igual ao replay de `sf_forecast_compare`, duas referências de forecast, diferença conhecida6000 e diferença completa nula/conditioned. O KPI auxiliar fica no resultado e recibo próprios da ferramenta, auditados na Session quando há execução nativa. O consumidor HTTP da contribuição só recebe a análise canônica; não se afirma que o gráfico Forecast consumiu o KPI auxiliar.

Com modelo instalado, o driver exige Session/SkillLoadReceipt reais, quatro operações efetivas, os três recibos de leitura de fontes, contexto retornado numa mensagem anterior à chamada KPI, publicação real e consumo/releitura após restart. Sem modelo, os produtores e recibos UI permanecem explicitamente separados e nenhuma contribuição é fabricada.

As contraprovas usam o produtor errado, período não selecionado, Request não admitido, comparação sem moeda definida e remoção da fonte auxiliar após os consumidores. A última recusa também relê qualquer output nativo já concluído, independentemente da disponibilidade do catálogo na reabertura. O prazo do novo teste é360000ms; não há aumento de lease ou retry oculto.

`sf_import_preview` permanece a obrigação de outra missão já existente. A preparação deste witness não prova inferência, consumo nativo, GNATIVE ou fechamento de todos os required_operations da skill. Os pins completos, o texto AM02 e a matriz das provas estão em `source-pins.json` e `preparation.json`.
