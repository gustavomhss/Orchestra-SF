# HANDOFF — sf-native-fixture-types

## SHA e estado
Estado: PARTIAL — aguarda compilação real dos inputs alterados e os três testes originais por Actions.
Código: 56c37078b7238619a16b9e5ae7273a4485c06b54.
Tree de código: 428827d866ab2c466247e6aa94356660f630af31.
Base integrada: 45514008d7ce275327003c5d92faaeeab2479739.
Parents adicionais de proveniência: sf-health-types4d6be1b15ff3fa9b6563ad2b7dbf403434ce6c26; sf-budget-path131b3b928354038af5cec307df8b447bd6493b3a; sf-import-identity455f64a689f000cdb4c0ed88fdcd229a4de81992.

## Causas reais e deltas
O static proof44672678428/job136077072943 falhou, inclusive em mudanças anteriores da sessão5. Este recorte assume essas causas sem promover resultados vermelhos a verdes:
- import-health.ts:31:45, TS2367: Object.is compara a mesma identidade de objetos entre interfaces declaradas sem sobreposição. Todos os fences e identidades posteriores permanecem exatos.
- asset-health.test.ts:68/85/87 e import-health.test.ts:79/99, TS2769: listas esperadas eram inferidas como string[]. Os aliases derivam operationId diretamente do retorno original dos observers; arrays/cases são contextualizados. Nenhum expect, valor, ordem, filtro ou callback muda.
- budget-deviation-projection.test.ts:67:48, TS2322: o diretório absoluto realmente criado por mkdtemp(realpath(tmpdir())) recebe o construtor canônico AbsolutePath.make, como Summary já faz. Nenhuma asserção muda.

Blobs qualificados apenas após o gate:
| Path | Blob candidato |
|---|---|
| apps/cli/src/sucafina-product/native-ui/import-health.ts | 817f50ae7dab6c092d13f342cb0f33edc82c0c53 |
| modules/sucafina/Sucafinav1/test/native-ui-contract/asset-health.test.ts | 5d2f67d3b0a71dc10516f4e6558a2dfda0c0504d |
| modules/sucafina/Sucafinav1/test/native-ui-contract/import-health.test.ts | 1208354d5e8260f615b75900bc6ce457f29dea22 |
| modules/sucafina/Sucafinav1/test/native-ui-contract/budget-deviation-projection.test.ts | b75a837a419dfb791438659de0d55dc2ced6fcff |

## Gate coordenado
A raiz prepara um snapshot temporário ci-run-linux-sfc-fixture-types:
1. Config de diagnóstico estende modules/sucafina/Sucafinav1/tsconfig.json original, preservando opções estritas, e declara somente os três arquivos alterados e suas dependências transitivas.
2. O wrapper original bun run typecheck executa tsgo --noEmit --project tsconfig.sfc-fixture-types.json --pretty false --listFiles. Exit nãozero nunca é filtrado; a evidência confirma inclusão dos três arquivos.
3. O runner canônico executa os três arquivos Bun originais, sem alteração de asserts, filtros ou timeouts.
4. Config/step/workflow/request de diagnóstico pertencem somente ao snapshot e não serão mergeados.

Este gate não é typecheck integral do projeto. Erros de outros owners, incluindo AM02 e analysis-stale-calculation, continuam com suas fontes e donos; não são ocultados nem declarados corrigidos por este recorte.

## Estado, artefatos e retomada
Nenhum gate foi executado neste checkpoint, nem merge/GO/deploy. suites.json e freeze12 permanecem intactos. Não há pacote ou baseline produzido por este recorte.
O typecheck E2E no Operations44673130503 passou com o mesmo blob Object.is; a jornada global terminou failure1/5 e não qualifica esta correção de fixtures por si.
Atualizar este handoff somente com o run/snapshot/jobs reais da compilação e testes. Em success, integrar apenas estes quatro paths e documentação; os dois handoffs de origem são históricos. Em failure, registrar file:line e corrigir a causa antes de outro gate.
