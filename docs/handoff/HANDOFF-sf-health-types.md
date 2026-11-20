# HANDOFF — sf-health-types

## SHA e estado

- Estado: **PARTIAL — correção estática publicada, Actions pendente**.
- Branch: `sf-health-types`.
- Base congelada da integração: `45514008d7ce275327003c5d92faaeeab2479739`.
- Código: `519af3c6ae1eb26022e2f4a0f2a5cc35aa0bd1da`.
- Tree do código: `734933a39af91c61641c9275c9697f1751387118`.
- O tip foi lido antes da escrita. Os dois arquivos nessa base estavam idênticos aos revisados no candidato de ingresso `345cebeedb2b04d3e349bd40f0678c82cfaac215`.
- Nenhum gate, PR ou merge foi executado por este agente. Root centraliza qualificação e integração.

## Causa concreta

O [run44672678428](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44672678428), job `136077072943`, publicou cinco erros **TS2769** nos testes de observação introduzidos pelo recorte de Files. Os overloads de `expect(...).toEqual(...)` recebem o tipo real da lista observada: uma união literal dos IDs de operação. As listas esperadas, sem anotação, foram inferidas como `string[]`; no array de casos a união incluía também `never[]`.

| Arquivo, linhas na fonte que falhou | Tipo do valor esperado informado pelo compilador | Tipo exigido |
| --- | --- | --- |
| `test/native-ui-contract/asset-health.test.ts:68:64` | `string[]` | IDs literais de link/download/upload |
| Mesmo arquivo `:85:75`, `:87:75` | `string[]`, vindo de `ids.slice(0, 2)` | Mesma união literal de Assets |
| `test/native-ui-contract/import-health.test.ts:79:64` | `string[]`, vindo de `allIds` | Os seis IDs literais de Import |
| Mesmo arquivo `:99:85` | `string[] | never[]`, vindo de `cases[].ids` | Mesma união literal de Import |

O prefixo dos paths é `modules/sucafina/Sucafinav1/`. É um problema de inferência das constantes esperadas; o log não indica uma falha de autoridade, CAS ou runtime nesses pontos.

## Correção publicada

1. `asset-health.test.ts`: deriva o alias local `AssetOperationId` de `Awaited<ReturnType<typeof observeSfAssetHealth>>[number]["operationId"]` e anota a array `ids`.
2. `import-health.test.ts`: deriva `ImportOperationId` do observer original, anota `readIds` e `allIds`, e contextualiza `cases` com `policy: Parameters<typeof importFixture>[0]` e `ids: ImportOperationId[]`.

Os valores esperados continuam explicitamente enumerados no teste; não são calculados da observação recebida. As anotações apenas verificam que cada literal pertence ao contrato do retorno. Não há `as`, `any`, supressão de erro ou cast que contorne o compilador. A contextualização de `cases` é necessária para que a linha de política humana com `[...readIds, "files.import-preview"]` não volte a ampliar o elemento para string.

Nenhum valor, callback, filtro, slice, ordem, comportamento de fixture ou linha de `expect` foi alterado. As provas originais de identidade, política restrita, zero dispatch/scan e estado sem mutação continuam intactas.

## Escopo e verificação

- Diff de código contra a base: exatamente dois arquivos; Assets +2/-1, Import +4/-3.
- Blobs publicados: Assets `5d2f67d3b0a71dc10516f4e6558a2dfda0c0504d`; Import `1208354d5e8260f615b75900bc6ce457f29dea22`.
- Readback dos dois arquivos confere integralmente com o conteúdo proposto.
- Linhas de `expect` comparadas e preservadas exatamente.
- Acesso somente GitHub. Nenhuma execução local ou alteração de produto.
- Actions para este código: **pendente**. Não declarar resolução dinâmica ou typecheck verde por esta revisão.
- A comparação de identidade do produtor em `import-health.ts:31` é outro fix, `455f64a689f000cdb4c0ed88fdcd229a4de81992` (blob `817f50ae7dab6c092d13f342cb0f33edc82c0c53`), revisado separadamente. Este commit não o reescreve.
- Erros de Budget AbsolutePath, AM02 e analysis-stale do mesmo log não pertencem a este patch. Nada nesses owners foi alterado ou ignorado.

## Como retomar

Root deve compor os dois blobs com as correções qualificáveis de seus demais responsáveis e executar a verificação real por Actions. O comando precisa incluir o typecheck que acusou esses cinco overloads; executar somente Bun tests não prova a resolução de TS2769. O resultado deve registrar também quaisquer erros remanescentes, sem desabilitar arquivos ou checks.

O gate de ingresso preparado em outra branch permanece uma qualificação distinta. Este patch não transforma Reports, Decisions, BI ou a campanha SF em completos, nem altera baseline, freeze, coverage, pacote, GO ou deploy.
