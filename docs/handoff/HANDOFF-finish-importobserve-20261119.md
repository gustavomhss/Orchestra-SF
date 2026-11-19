# Handoff — finish-importobserve-20261119

SHA de código: 1a1d830379c810b5ff1a7500f690bfe06ff09ab7
Data: 2026-11-19
Estado: partial

## Feito
- packages/app-shell/e2e/sucafina/operations-support/imports.ts:70 captura somente POST original /planner?page=Versions, action=save, enquanto o clique de confirmação nativa acontece.
- Correlação por identidade da Request do browser; encaminhamento único com maxRetries0/maxRedirects0; status/headers/bytes originais entregues ao navegador sem transformação. Nenhum segundo POST ou resposta sintética.
- Leitura do body usa a resposta original retida antes de o Chromium descartar o recurso CDP. Cleanup remove somente este handler após entrega.
- Payload exato, identidade nova, CAS/readback,72000→84000 de Imports,518000 preservado,6linhas/ fórmulas XLSX,1Apply e recuperação read-only permanecem. A asserção de encaminhamento único foi acrescentada.

## Pendente
- packages/app-shell/e2e/sucafina/operations-support/imports.ts:196: descoberta de destinos ainda não sai do navegador; o codec original files.import-targets não está composto em SfNativeOperationBindings (bindings.ts:98–107 só inclui files.export.members). A correção é compartilhada com o upload de WP5.
- packages/app-shell/e2e/sucafina/operations-support/imports.ts:206: scanner/preview/Apply/recovery continuam unbound. Operations9 atravessou criação/renomeação de versão com os dois POSTs originais200/ok, readbacks, seed72000/518000, export6linhas e UI55read-state ready; não chegou à seleção de destino.
- operations-support/documents.ts:103 e procurement-snapshot.ts:136: causas separadas sob responsabilidade WP5; compor antes do próximo operations.spec.ts.

## Asserções removidas
Nenhuma. Nenhum timeout ou expectativa foi reduzido/relaxado. A resposta200/ok continua obrigatória; falha de encaminhamento/parse preserva erro.

## Como retomar
Compor este único arquivo com as correções causais de Operations8. Executar e2e/sucafina/operations.spec.ts no production config com ClamD real, worker1/retries0. Não alegar prova de importação a partir de criação de versão.

## Runs e resultado
- [44625548030](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44625548030): FAILURE1pass/4fail, snapshot e30d34135eb42381621039dd0afbc797bb30b3eb. CLI/app/SF-E2E types e ClamD SUCCESS. Job135918265809; cleanup135923391917 SUCCESS.
- Imports recebeu POSTVersions200 e falhou emimports.ts:82 com Network.getResponseBody NoData antes de UI55. Artifact14579851540.
- [44630165380](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44630165380): FAILURE1pass/4fail; snapshot117a5c071147c8ebde46dd8bba0f497555e817c5 sobreAssembly35. CLI/app/SF-E2E typechecks e ClamD SUCCESS. Test135934353886 failure; cleanup135939416199 success; artifact14581832230.
- O observador de POSTVersions passou suas duas invocações e asserções de entrega única. Falha posterior aguardando import-targets emimports.ts:120/196. Não é qualificação de preview/Apply.
- A causa comum files não é suprida por aumentar timeout ou declarar disponibilidade: o transporte usa bindings.ts que só compõe o codec especial members. Incorporar os codecs originais já validados mantendo o catálogo, modos bytes/JSON e todos os fences; próximo gate de Operations deve atravessar o produtor real.
