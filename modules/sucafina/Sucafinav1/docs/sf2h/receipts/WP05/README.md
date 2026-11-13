# WP05 — candidato Astra

Estado inicial: **DRAFT / AWAITING_CI**. Este recibo acompanha a implementação; a execução e os SHAs examinados serão registrados em `ci-evidence.json` e na PR. Não constitui PASS de critérios nem runtime.

## Pins e escopo

- Handoff: `c4bd6592718b3862afbc7bb601c001365e593c20`.
- Plano imutável: `dbf9547211d9b0fade619790de7c19c0869b7c7d`.
- Seed real: `b33541ede0fd715fc0990aebeb3fe484d0991cb7` (tree `89fae3f30d4dc319dcd96aba68798a2e3410ec08`).
- Base da PR: `sf2-stack`; branch própria: `astra-wp05`.
- Produto/testes alterados exclusivamente em `product/analytics/`, `test/product/wp05/` e estes recibos. O workflow `.github/workflows/astra-wp05-check.yml` é a exceção expressamente autorizada por `control/handoff/astra/CI.md`.

## Implementação

O consumidor `dispatchBiPresentation` usa o dispatcher e a autoridade reais, valida a saída C16 e exige que a apresentação mantenha exatamente a projeção entregue. O factory fixa o produtor por contexto e request; mudanças entre fases assíncronas falham sem fornecer dados. Snapshots são separados dos objetos de callbacks antes das verificações assíncronas.

`readBiDestination` revalida a marca e sua referência C17 inteira, resolve essa referência e verifica acesso na saída. O recorte `visualPeriod` do brush preserva o período de autorização e só pode reduzi-lo para exibição. O teste de Dashboard usa persistência, issuer, C02 e resolver C17 reais; a seleção realmente emitida pelo browser retorna ao consumidor com nova admissão.

Os filtros de etapa/responsável/buyer pedem uma nova seleção autorizada ao host. O BI não calcula contagem, aging ou autoridade. Ausência não produz marca nem escala numérica. Waterfall mostra totais/endpoints fornecidos pelo domínio e sinais das contribuições; não calcula residual. Marcos sem data permanecem após o brush. Há tabela equivalente da sensibilidade e qualificador junto ao limiar.

A fixture própria dos motores substitui uma importação ausente de WP13 sem remover asserções. Os testes usam os motores e o store reais; controles da fronteira do host continuam explicitamente identificados como fixtures.

## Validação planejada

`ci-request.json` seleciona os 27 arquivos do seed e seis novos arquivos (33 no total). `request-validation.json` registra a validação por funções reais do candidato e os hashes do request. Nenhum teste de produto foi executado localmente.

Actions examina W (produto) e S (snapshot descendente com apenas `.ci-run.json`). O workflow específico executa `bun typecheck` em `modules/sucafina` e `bun run check:guards --base origin/dev` com a base disponível e registrada. Os resultados devem ser lidos nos jobs/logs, sem atribuir green de outro WP a este candidato.

## Aceitação e dependências

`criteria.json` contém exatamente os 108 IDs do pack, textos canônicos, implementação candidata, consumidor e discriminantes. A matriz será enriquecida com resultados reais; teste preparado não significa critério aceito.

Há dependências concretas fora do ownership: contratos e schema BI de WP00, composição/authority/store e oito destinos do host WP10, produtores Dashboard/Procurement e o caminho de sensibilidade/cobertura WP11/WP13. `engine-boundary.md` descreve por que solver exato isolado não é limiar integrado, e por que duas variantes reais de treinamento não provam confirmação humana/reconsideração na mesma instância. Esses bloqueios exigem PR draft; não são dispensas dos critérios.

C/G7, D/G8, AM01–AM06, GNATIVE e as oito seleções finais continuam sem alegação de PASS nesta entrega. Não houve merge, deploy nem alteração de infraestrutura, autenticação ou plano.
