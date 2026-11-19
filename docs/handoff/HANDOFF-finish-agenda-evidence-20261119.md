# Handoff — finish-agenda-evidence-20261119

SHA base: 8a279c2e011954b3fa27e9f69f7b1fb78b4d3104
Data: 2026-11-19
Estado: partial

## Feito
- UI47 agenda simples e múltiplos domínios agora exibem a coluna Evidence/Evidência.
- Cada célula traduz exatamente value.evidenceState do contrato original, sem calcular ou inferir estado.
- Enum confirmado em packages/schema/src/sucafina/reviews.ts: confirmed, estimated, hypothetical, absent.
- Rótulos EN: Confirmed, Estimated, Hypothetical, Absent; PT: Confirmado, Estimado, Hipotético, Ausente.
- Valores, moeda/unidade, período, origem e referências permanecem visíveis e intactos.

## Pendente
- packages/app-shell/e2e/sucafina/reports-support/review-flow.ts:69: root deve acrescentar o quarto texto de cada linha no esperado existente.
- packages/app-shell/e2e/sucafina/review-agenda-support/first-agenda.ts:202: mesma alteração no esperado do preview múltiplo.
- Gate de navegador do composto com os ajustes dos helpers sob posse root; nenhum resultado afirmado por este checkpoint.

## Asserções removidas
Nenhuma. Nenhum teste foi editado nesta branch; os helpers continuam sob posse root.
As verificações de valores/períodos/origens devem permanecer e ganhar a evidência por valor.

## Como retomar
Root absorve somente os 3 blobs UI/copy deste commit em finish-reports, preservando seus helpers atuais.
Mapeamento do quarto texto: ({confirmed:"Confirmed", estimated:"Estimated", hypothetical:"Hypothetical", absent:"Absent"})[value.evidenceState].
Nenhuma inferência baseada em value null, moeda, origem ou disponibilidade.

## Runs
- Não executado nesta branch. Esta alteração será qualificada no próximo gate Reports autorizado, junto aos helpers equivalentes.
