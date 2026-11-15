# Missão48 — rota Reports instalada e autoridade de leitura

## Resultado proposto

O addendum em `addendum-manifest.json` contém dois patches completos e inertes: `extended-http.ts` e `product-authority.ts`. Os 18 patches anteriores permanecem intactos. O teste novo próprio é `test/product/reports-draft-reconciliation/installed-review-entry.test.ts`. Nenhum teste, servidor, build ou escrita remota foi executado por este autor; a qualificação permanece `NOT_RUN` até a execução hospedada pelo integrador.

## Causa demonstrada da falha nominal04

`runtime/application.ts` monta o formulário Reports como GET com `page` oculto igual à página atual. Em Budget Overview, o envio contém `page=Budget Overview`, `download=docx|pptx` e as seleções do usuário. `extended-http.ts` aceitava somente `page=Generate Report`. Esse valor é a legenda do botão, não o valor emitido pelo formulário.

O produto recebe a requisição antes do download legado. Como a condição não correspondia, a requisição seguia para `serveDownload`, que retorna um attachment. Isso explica os quatro snapshots nominal04 permanecerem na página original após Generate Report. O shell não instala um interceptor para `.report-form`. A região `Prepare review` e o botão `Load selection` existem no workspace real; não há justificativa para mudar os localizadores ou navegar por uma entrada alternativa.

O patch reconhece o GET de Office emitido pelo formulário e conserva a sentinela antiga. Validação de origem, superfície, método, chaves, duplicatas, formato, período, tópicos, título, admissão e descoberta autorizada de cada fonte continuam no mesmo caminho. Não há alteração de Agenda39, página/picker, grant ou autorização de fonte. Outros formatos continuam fora dessa entrada.

## Causa demonstrada do falso purge no focus

O focus probe usa a página `sf=review`. A admissão comum em `extended-http.ts` convertia todo resultado não `ok` em HTTP403. `ui.admit` produz legitimamente `unavailable/ui-identity-unavailable` quando não consegue obter identidade de comando. O patch preserva denied403, unavailable503, stale/conflict409 e needs-input400 para os modos de leitura de revisão. Os fluxos BI mantêm seu comportamento anterior.

`ui.validate` e `ui.revalidate` usam uma lease privada vinculada à Request. Retorno `false` continua negativo. Exceção durante validação, no entanto, ocorre antes de consumir a lease: `requestFor` ainda retorna undefined nessa etapa. O catch do novo handler usa uma flag de validação para que essa ausência não seja convertida em revogação. Após consumo, perda real da Request/lease e revalidação explicitamente falsa continuam403. Em qualquer saída, `finish` permanece no finally.

Também foi demonstrado que `product-authority.ts` engolia qualquer rejeição de `resolve` e a transformava em ausência de identidade. Isso tornava I/O indistinguível de revogação. O patch deixa rejeições chegarem às boundaries de leitura somente para `sf_review_prepare` e para aliases `sf-read:`/`sf-human:` cujo sufixo está no registro fechado `collaborationReads`. O caller instalado `host-context.ts` usa `sf-human:` para `admitRead`; por isso ambos os aliases são necessários. Retorno undefined real continua negativo. Nenhum grant novo é criado e nenhuma operação de escrita ou admissão nativa é alterada.

## Testes propostos e limites

Os três testes usam `financialCompositionFixture` existente: SQLite, `createSfProductAuthority`, identidade, grants, fontes e factories de produção reais. Não substituem resultados de autorização, projeções, respostas HTTP ou o bundle de browser.

- A rota emitida pelo formulário e a sentinela antiga precisam produzir o HTML/bootstrap reais com título, formato e item selecionado; tópico duplicado continua400; xlsx permanece fora dessa entrada.
- Header `x-operation` vazio aciona a ausência real de identidade de comando do fixture e precisa retornar503; uma nova leitura explícita recupera; `active=false` real retorna403.
- Falha pontual de `currentSnapshots`, depois de chamar o método real, cobre admissão, validação ainda não consumida e revalidação após o bundle real. Todas precisam retornar503 sem bootstrap e recuperar em nova leitura. Revogação real no mesmo gate de entrega retorna403. O alias registrado `sf-read:collaboration.storage.version` usa somente os grants já existentes e distingue rejeição de I/O de negação real.

As quatro jornadas nominais inalteradas ainda devem ser reexecutadas sobre a composição explícita com este addendum. Os testes de rota não qualificam interação DOM, edição, resposta perdida ou rollback de artefatos. Não adicionam um grant human para testar positivamente o alias `sf-human`; sua ligação instalada foi comprovada por leitura de `host-context.ts`.

As respostas antigas `unavailable` mapeadas para409 dentro das branches de produtores de `extended-http.ts` não foram massivamente normalizadas: são recuperáveis para o probe, e o addendum não afirma que todo status legado do módulo seja503. A leitura de `extended-review-cycle.ts` revelou ainda que seu `update` compacta a segunda leitura não `ok` em denied. Essa observação foi enviada ao root separadamente; não foi silenciosamente incluída nem declarada resolvida por estes dois patches.

## Proveniência

W3: `c44a3b80da2549c6a3bc4cbdb186a275d93370ab`. Ambos os preimages foram relidos e comparados por bytes em C19 `5b11f1460fa44426626ea7674ccb8baf0a083e0a`.

- `extended-http.ts`: blob `d8e0d149e37c640db8957f3e917f867088923d93`.
- `product-authority.ts`: blob `2c82d60d220d8d5365da8322bad648a64bbb62d2`.
- `ui-authority.ts`: blob `502fb1ab3a4116a62aeb504a4bb26040c66d81b2`, leitura integral.
- `host-context.ts`: blob `0705fe61bb1d8daa7341d3c9b312780424ad3c7c`, leitura focada das linhas 300–345, suficiente para o caller de `admitRead`.
- `financial-composition-fixture.ts`: blob `febb795303b8c4ada5fb6f39d6373667ee71dac1`, leitura integral.
- `extended-review-cycle.ts`: blob `cdbcf2d09cd82e352c41e5eb0b38055956f101e2`, leitura integral.

As leituras do formulário, shell, entry, composição e bootstrap constam de `READ-ACK.json`. A confirmação independente do localizador está no recibo do agente qualification em `../prepare-review-mount/locator-review.json`.
