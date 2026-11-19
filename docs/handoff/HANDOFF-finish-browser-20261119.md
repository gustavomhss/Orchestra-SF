# Handoff — finish-browser-20261119

SHA: código deste commit; base de integração 2b37f0aabe61be42fc0bab34a33464303f968efa; composição exercitada na auditoria 03d2a11f3b8ffe51888601c5ad50ae0b16058dea.
Data: 2026-11-19
Estado: partial

## Feito
- Atualizado o contrato exato do registry para as cinco extensões originais de edição de decisão e agenda/preservação/leitura de review. O catálogo I00 permanece nos mesmos 305 IDs e blob 31dbec1726fd8147156b01dc545726650ffd49e1.
- Fixtures de admissão UI49/UI50 agora publicam reviews.review-read, o leitor original que admite o dossiê de múltiplos domínios. Adicionada negativa explícita: somente dashboard.dashboard-review não admite a rota genérica.
- Preservadas todas as expectativas de métodos, efeitos, rotas, bytes reais, ausência de export legado e limites de admissão.

## Pendente
- packages/app-shell/test-browser/sucafina-native/transport-contract.test.ts:32 e reviews-route.test.ts:22: executar gate estreito sobre a composição com as extensões e rotas originais correspondentes.
- packages/app-shell/test-browser/sucafina-native/procurement-draft-leaves.test.ts:15: falha independente com fieldset presente; correção a cargo de finish-operations-20261119.
- Integrar somente após a composição e o gate correspondente; este branch isolado depende das mudanças de produto de Reports/Bindings ainda em revisão.

## Decisões e justificativas
- Asserções removidas: nenhuma. Os valores antigos de fixture do leitor Dashboard foram substituídos pelo leitor genérico original, e a capacidade insuficiente do leitor antigo foi acrescentada como negativa.
- Não modificado baseline, digest, coverage, catálogo congelado nem política de autorização.

## Como retomar
Compor estes dois arquivos de teste com os SHAs atuais de Reports/Bindings; executar via test-ci os dois arquivos test-browser. Depois incluir a correção independente de Procurement e repetir somente o gate necessário.

## Comandos e resultados
- Auditoria [44585817131](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44585817131), job135778309143: 110 pass, 4 fail, 895 expect, 114 testes em 32 arquivos. Estas mudanças tratam as três falhas de catálogo/rotas; a quarta é de Procurement.
- Leitura do log original via Actions [44588580717](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44588580717): success na extração; não é execução de teste.
- Gate após esta correção: pendente.
