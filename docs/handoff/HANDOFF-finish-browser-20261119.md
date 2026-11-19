# Handoff — finish-browser-20261119

SHA: código deste commit; base de integração 2b37f0aabe61be42fc0bab34a33464303f968efa; composição exercitada na auditoria 03d2a11f3b8ffe51888601c5ad50ae0b16058dea.
Data: 2026-11-19
Estado: partial

## Feito
- Atualizado o contrato exato do registry para as cinco extensões originais de edição de decisão e agenda/preservação/leitura de review. O catálogo I00 permanece nos mesmos 305 IDs e blob 31dbec1726fd8147156b01dc545726650ffd49e1.
- Fixtures de admissão UI49/UI50 agora publicam reviews.review-read, o leitor original que admite o dossiê de múltiplos domínios. Adicionada negativa explícita: somente dashboard.dashboard-review não admite a rota genérica.
- Preservadas todas as expectativas de métodos, efeitos, rotas, bytes reais, ausência de export legado e limites de admissão.

## Pendente
- Integração dos dois testes aguarda os branches de produto correspondentes; nenhuma falha restante nestes dois arquivos no gate abaixo.
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
- Gate [44589103071](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44589103071): SUCCESS, 5 pass, 0 fail, 2183 expect; snapshot 3fc5740182f8966719064bf80055a2cdf6633ca0, composição f568cb40f41ea7747866b346ae82b2ab5bab91b6. Jobs135789937911 e135791754465 success. Código deste WP 159085097266bfd9eb964ef9116a2ad1954e9ac6.

## Atualização — bindings originais sem campo surface

- As 48 operações já existentes no catálogo I00 com input fechado sem surface têm binding literal verificado: 29 Collaboration e 15 Decisions em dashboard; quatro C12 em procurement. A extensão posterior decisions.decision-edit também usa dashboard. Queries, métodos, efeitos, discriminadores e limites continuam comparados com a origem congelada.
- Os IDs atuais são uma união sem duplicação entre catálogo e extensões. O teste continua exigindo o conjunto exato de extensões e o hash original31dbec1726fd8147156b01dc545726650ffd49e1; nenhuma linha do catálogo305 foi modificada.
- Asserções removidas: nenhuma. O path antigo parametrizado continua provado no catálogo; o binding atual é comparado com o mapa explícito do adaptador original. Gate anterior44589103071 não qualifica este delta; nova execução estreita pendente.
