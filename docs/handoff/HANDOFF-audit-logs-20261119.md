# Handoff — audit-logs-20261119

SHA: 2dcbd93a41608e171dfde8896e0721a42fbede6d (snapshot auditado); job135778309143 do run44585817131.
Data: 2026-11-19
Estado: partial

## Feito
- Leitura somente do log original de um job terminado. O conector de logs retornou Transport closed em duas tentativas; o fallback usa a API GitHub dentro de Actions.
- Extração limitada a nomes de falhas, posições e resumo, omitindo linhas potencialmente portadoras de credenciais.

## Pendente
- Resultado da leitura e correções nos arquivos apontados pelo log.

## Decisões e justificativas
- Nenhum teste reexecutado, timeout alterado, baseline/coverage/digest/GO produzido.
- Asserções removidas: nenhuma. O trecho preserva a referência ao run e snapshot originais.
- Não integrar este workflow temporário em sf-join-four.

## Como retomar
Ler docs/handoff/audit-logs-135778309143.txt nesta branch após o job; abrir somente os arquivos/linhas falhos e corrigir com gate estreito.

## Comandos e resultados
- github.fetch_workflow_job_logs: Transport closed, duas tentativas.
- Run [44587634664](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44587634664): falhou na leitura porque gh recusou as sequências ANSI presentes no log original; nenhum teste foi executado.
- Habilitada a leitura explícita de ANSI somente para o arquivo temporário, mantendo a remoção dessas sequências e o filtro de credenciais antes da publicação. Nova leitura pendente.
