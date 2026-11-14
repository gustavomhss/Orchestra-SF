# C12 — correção do gate documental, checkpoint 03

Status ao commit: **FUNCTIONAL PROOF PASSED / DOCUMENTATION GATE FIXED / HOSTED GUARD RECHECK PENDING**.

Produto, testes, configuração, fixtures e consumidor permanecem byte a byte iguais a W2 `0b483fbf2040e0551f817ea6211d54c7cb2e2d14`. Não há alteração comportamental neste checkpoint.

## Resultados já observados

- Testes afetados: run `43636531401`, job `132574441676`, **PASS — 7 testes, 225 expectativas**, Omni pass ligado ao nonce. Os resultados e eventos observados estão em `../attempt-02/TESTS.json`.
- Os dois controles CAS/concorrência C12 e dez regressões OPS-REV-02/WP04 permanecem atribuídos aos passes individuais do primeiro run, preservado como FAIL agregado; não houve mudança em suas entradas.
- Checks sobre W2: run `43636913954`, job `132575624294`. CLI PASS; Sucafina FAIL apenas pelo TS2741 herdado em WP14; guards FAIL por um único gate introduzido por esta missão. Resultado completo e artefato em `../attempt-02/CHECKS.json`.

## Correção do próprio gate

A regra `agent-scratch` recusou `attempt-01/TESTS.log`: saída bruta de ferramenta não pertence à árvore de código. O arquivo é removido, sem renomeá-lo nem esconder seu conteúdo em outro formato. A saída bruta do segundo run também não será publicada.

Os resultados estruturados incluem SHAs, seleções, contagens, diagnósticos, eventos observados, identidade dos recibos, hashes dos logs e links dos jobs. Isso preserva a análise e a evidência requerida sem commitar arquivos de trabalho.

O recibo histórico `attempt-01/TESTS.json` permanece imutável e descreve aquele checkpoint. Seu campo `durableExcerpt.path` refere-se ao log no commit W2, no qual foi observado; o blob histórico `8e5994e551ba022028250506d0b603b79f268149` continua acessível no Git. Essa referência histórica não significa que o arquivo deva permanecer na árvore final:

[Log histórico em W2](https://github.com/gustavomhss/Orchestra-SF/blob/0b483fbf2040e0551f817ea6211d54c7cb2e2d14/modules/sucafina/Sucafinav1/docs/sf2h/receipts/c12-receipt-recovery/attempt-01/TESTS.log).

Nenhuma regra, ignore, permissão ou label de aprovação foi alterada. O erro WP14 continua com seu owner externo; sua fixture compartilhada não foi editada.

## Revalidação delimitada

Apenas checks serão reexecutados. O workflow existente `astra-operations-check.yml` aceita modo restrito de guards somente para o fechamento documental WP04/WP06; o prefixo C12 não pertence àquela condição. Portanto, usa-se novamente o envelope padrão, sem mudar ou contornar o validador. Isso executará typecheck Sucafina, typecheck CLI e guards em sequência no novo SHA.

A repetição dos typechecks é consequência do workflow canônico disponível para esta árvore documental, não uma nova seleção de testes. Os testes de produto não serão repetidos: nenhum de seus inputs mudou. O primeiro resultado de checks continua FAIL e o resultado seguinte terá seu próprio W/S/run/artifact, sem reclassificação retroativa.
