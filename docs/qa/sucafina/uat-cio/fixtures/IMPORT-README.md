# Workbook sintético de import — contrato do produtor

**Fonte inspecionada:** `packages/app-shell/e2e/sucafina/operations-support/imports.ts` no branch `close-final-candidate` (16/11/2026), que usa `ExcelJS`, sheet **OPEX** e colunas `Line ID`, `Cost element`, `Vendor / item`, `Currency`, `Measure`, `Jan`. A mídia real é `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.

- `IMPORT-OPEX-VALID.xlsx`: uma linha Renewal USD Forecast Jan 84.000. **Não é script de seed**; requer versão Planner editável e a linha OPEX correspondente, com `sourceRef` real atribuído pelo produto. Comece do estado Renewal 72.000 e Fixed 518.000 do oráculo existente. Não use a palavra "sucesso" antes de observar o produtor.
- `IMPORT-OPEX-ADVERSARIAL.xlsx`: 12 linhas, sendo 10 registros distintos, 1 repetição exata de ID e 1 valor negativo. A contagem de linhas é sintética; o comportamento esperado deve ser reconciliado com o contrato instalado. O teste pretende descobrir aceitação indevida, falta de visibilidade de validação e persistência parcial. Não assumir que a aplicação de 10 linhas será permitida.

Se a instalação utilizar uma versão diferente do parser/destino, registrar `BLOCKED_SCHEMA_DRIFT` e refazer o workbook somente após reconciliar o contrato atual. O arquivo NÃO contém IDs de usuário/tenant nem dados financeiros reais.
