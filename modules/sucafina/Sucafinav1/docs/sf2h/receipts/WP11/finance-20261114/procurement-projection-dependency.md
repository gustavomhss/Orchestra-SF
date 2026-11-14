# Procurement — dependência canônica para aplicação de duas superfícies

Estado: **fix presente no owner; não aplicado pelo Finance; execução composta pendente**. Fonte fixa: [COMPOSE6 `35b9fd4f532abeb1058f00281d4ad8885ca9966f`](https://github.com/gustavomhss/Orchestra-SF/tree/35b9fd4f532abeb1058f00281d4ad8885ca9966f). [JSON completo](procurement-projection-dependency.json) inclui Git blob, SHA256, imports e os suportes existentes.

## Falha observada e causa estática

O [run 43587138878](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43587138878), job 132423963070, executou W18 `92f6d97d2df5ebf53cd845f4cfe93355d10b0f6f` pelo envelope S `0faf62c7f5e10f5ae17037bb6bd8eb512396f2fd`. O caso `Planner applies and Procurement conflicts in one durable case; ordered receipts replay after restart without effects` falhou em 20.50 ms na emissão da fonte, com `Procurement source unavailable`, antes da aplicação. O log não contém a explicação da lista de campos; essa causa vem da inspeção de fonte.

No grupo, `product/procurement/sources.ts` (`7dd93cea781ad68d6db66e2d08e320c1d395d123`) emite o seletor `procurement-record-v1` com `approvalStage`. O `product/integration/procurement-projections.ts` antigo (`08fdfb878f6f9282f70ec71b3e66122f1b95f6f5`) exige digest de uma lista sem esse campo e retorna `undefined`. O projector correto já publicado pelo owner contém `procurementRequestFields`, admite o formato atual e a variante legada, valida período/moeda e conserva os fingerprints materiais.

## Closure mínima de imports observada

| Caminho relativo a Sucafinav1 | Blob publicado em Finance | Blob canônico COMPOSE6 |
| --- | --- | --- |
| `product/integration/procurement-projections.ts` | `08fdfb878f6f9282f70ec71b3e66122f1b95f6f5` | `3e8830c3dddc8b9609f583f877b2fe7458eccd28` |
| `product/procurement/source-projection.ts` | `ausente` | `ab9814817d11c0b477636ee54d1b2763d365f405` |
| `product/procurement/confirmation-fields.ts` | `ausente` | `a1e45e803105e76f147e695a7e92246257de9b16` |
| `product/procurement/monetary.ts` | `ausente` | `5ed7b1c7e8f140c2820d9e3095a7427374d10f69` |

O adapter delega para `source-projection.ts`, que usa `confirmation-fields.ts`; este importa `monetary.ts`. Os três últimos arquivos estão ausentes do snapshot Finance observado. Os demais imports existem e seus pins estão no JSON. A função exportada `digestProcurementSource` da Finance é byte a byte igual à da fonte COMPOSE6; o receipt não exige substituir o resolver inteiro apenas para fechar esses imports. O owner continua responsável por escolher e validar a composição completa compatível.

`monetary.ts` é o produtor financeiro canônico já publicado, citado como dependência. Este documento não concede autorização para alterá-lo, não copia suas fórmulas e não instala um projector de teste. Nenhuma fonte alheia foi editada. Não há typecheck ou execução comprovando essa closure isolada.

## Consumo e validação pelo owner

Integrar os bytes publicados sob astra-compose e validar o `cross-domain-execution.test.ts` corrente do grupo W19 (`2be9d8b282315bf6c030eea4b92e1fd39ed20d55`): conflito Procurement depois de Planner, sucesso nas duas superfícies, recibos ordenados, reabertura sem repetir efeitos e recusa de divulgação após revogação do recibo Procurement. Os testes de projector/confirmation do produtor também precisam da seleção afetada apropriada. Executar package `bun typecheck` e guards no head composto.

Não repetir um run com o mesmo conjunto incompatível de fontes nem enfraquecer assertions para contornar o gate. Os nove casos próprios de `apply.ts` que passaram em S12 não fecham essa integração. A composição continua exigindo prova humana/nativa, C/D e o bundle final de S0.
