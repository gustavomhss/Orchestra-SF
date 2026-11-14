# WP12 — aplicabilidade do novo escopo de leitura de cálculos

**Conclusão: o trio publicado pelo WP10 não altera o caminho concreto do primeiro `ScenarioComparisonInput` que falhou no W20. Não recomenda intake ou reteste de Scenarios por esse motivo.**

O host instala os serviços de cálculo, mas a missão observada usa três referências Planner `record`, alternativas promovidas pelo C09, cobertura real e resultados lidos por `readHistoricalScenario`. Esse leitor passa `historical=true` e mantém `calculation=false`. A resolução BCS de uma referência Planner `record` não entra no callback de cálculo.

O delta de `planner-calculation-services.ts` entra em `issue`/`resolveEvidence`; o novo escopo observa os leitores canônicos dessa emissão. O delta histórico exige uma referência `calculation`, captura protegida e seleção do ledger. O helper desta missão não emite essas referências nem cria essas capturas. A preparação ainda percorre as mesmas releituras de caso, lookup, comparação de fontes e cobertura.

O relatório `audit.json` registra o caminho, os pins e os limites. `source-pins.json` confere 19 payloads completos por SHA-1 de blob e SHA-256. Os dois diffs preservam a comparação com W25. Não houve importação de produto, teste, typecheck, CI, alteração de fonte ou renovação de autoridade.

O voo observado permanece **FAIL**, com 0 pass / 1 fail e 101 assertions. A recusa `analysis-authority-changed` depois de aproximadamente 300 segundos não identifica a primeira causa interna. Este estudo não prova melhoria de duração e não transforma o resultado terminal em aceite. A closure de ativação do trio não foi ampliada após a conclusão de não pertinência ao caminho solicitado.
