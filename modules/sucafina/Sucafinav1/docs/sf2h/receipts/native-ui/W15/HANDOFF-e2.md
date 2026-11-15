# W15/A02 — handoff da sessão sucessora e2

**Estado: código das 39 operações A02 materializado no LEAF, não integrado nem homologado. PR #116 permanece draft. P03 = HOLD/sem prova.**

## Fencing real e preservação

- Repositório `gustavomhss/Orchestra-SF`, branch existente `sf-ux-w15`, PR #116 para `sf2-stack`; nenhum reset, force-push, merge, deploy, Azure ou Goal resume.
- Missão `UX20-W15-R2`, pacote `W15-e2.json` no commit controlador `49a92b9c6bd2c23cf30686a279aa17d2d7aabb5a`.
- Entrada HEAD conferida: `d7785e020d9661e1557840838c321fe83e8c5ed4` = expected_head e2. S0 autorização exclusiva: `8852ed4a060f6eb3b49c142b894852d0af49740f`. Epoch `ux-native-w15-e2` substitui e1 revogado.
- ACK e2 real publicado por CAS no commit `4ccafd97257a318465b15fbeab719904ee16250f`. O pacote e1, preflight e histórico foram preservados e não são autoridade de conclusão.
- O bloco anterior `HANDOFF-BLOCKED.md` reflete a fase e1. **Este handoff e2 o sucede; não reescrever evidência histórica.**

## Implementação exclusiva

| Arquivo | Entrega |
|---|---|
| `packages/schema/src/sucafina/planner.ts` | `SfPlanner.operations` e 39 descriptors com operationIds literais, exports `schemaExport` do catálogo, query/payload/discriminador e schemas estruturados; não há `Schema.Any` nem dispatch livre |
| `packages/client/src/sucafina/planner.ts` | `createSfPlannerClient(transport)`: 39 métodos literais e tipados usando somente `SfTransport.execute`; nenhuma tentativa automática de repetição |
| `packages/client/src/sucafina/planner/monthly.ts` | `prepareSfPlannerMonthlyRange`, conversão 0–11 → 1–12 uma única vez e retenção de linhas/células brutas em erro parcial/perda de resposta |
| `apps/cli/src/sucafina-product/native-ui/planner.ts` | `createSfPlannerProjectionHandlers(deps)`: sete handlers JSON GET CAP17–CAP23; projeções filtradas sobre `domain.view` e `projectMonthlyGrid` canônicos, não HTML/snapshot bruto |
| `modules/sucafina/Sucafinav1/test/native-ui-contract/planner.test.ts` | Specs de 39 IDs, formatos fixos, conversão de mês, zero/null, preview domínio puro, row CAS e incerteza. **Arquivos de teste adicionados; execução não realizada.** |

## Matriz de 39 IDs

- `7` GET: `domain.page.CAP17`, `domain.page.CAP18`, `domain.page.CAP19`, `domain.page.CAP20`, `domain.page.CAP21`, `domain.page.CAP22`, `domain.page.CAP23`.
- `29` comandos legados: `domain.command.CAP17.import-workbook`, `domain.command.CAP18.save`, `domain.command.CAP18.delete`, `domain.command.CAP18.spread`, `domain.command.CAP18.reset`, `domain.command.CAP18.import-workbook`, `domain.command.CAP19.save`, `domain.command.CAP19.delete`, `domain.command.CAP19.spread`, `domain.command.CAP19.reset`, `domain.command.CAP19.import-workbook`, `domain.command.CAP20.save`, `domain.command.CAP20.delete`, `domain.command.CAP20.sync`, `domain.command.CAP20.import-workbook`, `domain.command.CAP21.save`, `domain.command.CAP21.delete`, `domain.command.CAP21.common`, `domain.command.CAP21.import-workbook`, `domain.command.CAP22.save`, `domain.command.CAP22.delete`, `domain.command.CAP22.import-workbook`, `domain.command.CAP23.save`, `domain.command.CAP23.copy`, `domain.command.CAP23.official`, `domain.command.CAP23.lock`, `domain.command.CAP23.unlock`, `domain.command.CAP23.delete`, `domain.command.CAP23.import-workbook`.
- `3` ports canônicos: `planner.monthly.preview`, `planner.monthly.apply`, `planner.forecast.prepare`.

Os 29 comandos continuam no `createApplication` + `domain.execute` existentes. Não existe mutação extra no handler de projeção. `planner.monthly.preview/apply` usam somente o contrato real `{action,input:{page,versionId,drafts}}` do `handleSfPlannerMonthly`: sem operação/entidade inventada. `planner.forecast.prepare` reutiliza `handleSfForecastInput` e seu `sf_forecast_compare`/caseRef. A rota do forecast é publicada pela composição F02/I00, não pelo leaf W15.

## Invariantes e limites

- Leitura: `readContext(request)`, CAP e destino concedidos, query fechada, `Application.authenticate(request,{surface:"planner",roleMap})` dentro da transação original, `plannerKeys`, snapshot público `publicSfData`, projeção com whitelist e revisão de contexto após a leitura. Falha 401/403, infra indisponível, mudança de stamp e versão desconhecida mantêm estados distintos.
- Zero explícito **não é** ausência; forecast vazio herda orçamento na projeção original; manual/closed/HR sintético são derivados do `projectMonthlyGrid` existente. O helper UI nunca faz parsing monetário, spread, FX, YTD ou recomputação de forecast.
- `version` CAS é responsabilidade de cada comando original e cada linha mensal; CAS/owner fencing seguem validados no produtor. Preview não equivale a commit. Apply pode ter resultados parciais; linhas com falha continuam intactas. Qualquer falha de transporte após envio pode ser resultado desconhecido e **não recebe retry automático**.
- `readContext` e admissões da 114 permanecem autoridades dos ID/contextos; nenhuma declaração de `P03`, recibo de integração ou prova desktop pode ser deduzida de mocks/fixtures.

## Fontes remotas efetivamente revisadas

- `runtime/application.ts` blob `a0deff8a3b272019f472aa2f93499d1940a78370`; drift revisado no preflight não altera contrato de planner, mas novas autorizações de download Procurement não devem ser perdidas por integradores.
- `runtime/planner.ts` `17c65e08c833dfd1fcad582ef4eaac78a1c5ea4b`.
- `product/interface/planner-http.ts` `2befb1d4c7964b30830311abe1c93c7c575b8f70`; `forecast-http.ts` `b814872f18556d1137820cfb33c46048066a1c6e`.
- `product/planner/monthly-grid.ts` `9e90db55e0b9354b49df68edd372fe9a551e2380`; `monthly-edit.ts` `8cbcb05fb09b3a5edff59e6e76a9c8f9beafd3a1`; `monthly-host.ts` `b8bdf6ef06a9883952faa010efdec80f8d3b69d5`.
- `CONTRACTS.md` `94553a3119826ef1c44271966233dd58042ddd70`; `host-signatures.ts` `e99e094fc3ad5e74832a55aa2639c6bdb27f5255`; `contract-catalog.json` `31dbec1726fd8147156b01dc545726650ffd49e1`; `surface-manifest.json` `50e2993a881e207aa3b2a1cd250a7da84cea5855`.

## Integração compartilhada e qualificação ainda NÃO feitas

1. **114 / I00 + F01/F02:** consumir `PATCH-114-e2.md`; publicar exports estáticos Schema/Client, codecs exatos 39 no map admitido, conexão do host GET ao router e vínculo às rotas HTTP originais. Não colar fragmentos em fontes de outros escritores. `Schema.decodeUnknown` deve rejeitar excess properties; não descartar campos perigosos silenciosamente.
2. **119:** checar compiler/guards após o merge autorizado de F01/F02/I00; especialmente tipos `SfNativeHostDependencies`, descriptor `Schema.Schema` recursivo, `MonthlyValue` e Shape dos envelopes reais. Não alterar generated manualmente.
3. **120:** somente Actions cirúrgicos do workflow autorizado. Cobrir 39 codecs, 7 GET Request/Response autenticados, 29 POST reais, os 3 ports, 401/403/409/422/503, trocas de owner e revogação, dual-installation, zero/null, preview/apply parcial, CAS e perda de resposta. Não usar falsa autorização de fixture para declarar instalação hospedada.
4. **114 / P03:** permanece **HOLD**, requer composição e evidência hospeda real; sem prova/captura do desktop nem liberação global.
5. Não fazer merge nem marcar PR como ready antes dos gates; `GLOBAL_RELEASE=false`.

Os arquivos e2 estão no diretório W15. A PR deve permanecer draft até a 114 registrar composição/qualificação; a ausência de F01/F02 na branch isolada é dependência, não permissão para adicionar backend paralelo.
