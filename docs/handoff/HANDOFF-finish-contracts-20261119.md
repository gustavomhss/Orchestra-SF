# Handoff — finish-contracts-20261119

SHA: base beddc4189bc94e0c647ae26cfd8609c98a077a5d; conteúdo de teste deste commit.
Data: 2026-11-19
Estado: partial

## Feito
- Atualizadas somente as listas exatas dos dois contratos unitários para as operações de produtores originais já publicadas: decisions.decision-edit e reviews.review-read/review-agenda-options/review-agenda/review-preserve.
- Preservados todos os IDs anteriores e todas as asserções sobre payload fechado, falta de grants, CAS, resultados, limites, bytes Office Schema.Never e ausência de retry automático.

## Pendente
- modules/sucafina/Sucafinav1/test/native-ui-contract/decisions.test.ts:21 e modules/sucafina/Sucafinav1/test/native-ui-contract/reviews.test.ts:34: gate estreito pendente com as extensões na composição integrada.

## Decisões e justificativas
- Nenhuma asserção removida. A igualdade continua exata; cinco operações literais são acrescentadas, não aceitas por prefixo ou contagem genérica.
- O catálogo congelado de 305 operações não foi modificado. Os produtores posteriores são extensões explícitas; este teste não reivindica autorização instalada.

## Como retomar
Compor estes dois arquivos sobre a composição que contém os produtores de edição e de reviews, executar test-ci package=sucafina runner=bun nos dois arquivos e registrar o resultado antes de integrar.

## Comandos e resultados
- [44585817131](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44585817131): audit FAILURE; shards1/5 falhavam somente na lista literal desatualizada de cada contrato.
- Gate da correção: pendente.
