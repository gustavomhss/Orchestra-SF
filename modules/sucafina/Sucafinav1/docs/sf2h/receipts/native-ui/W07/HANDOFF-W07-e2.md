# W07 / S02 — handoff de autoria e2 (ARTIFACT_READY)

**Estado:** `ARTIFACT_READY`, **não** integrado, qualificado, fechado nem liberado. Branch `sf-ux-w07`, PR #124 (draft) → `sf2-stack`. Epoch `ux-native-w07-e2`; e1 revogado. Sessão efetiva GPT-6; ID runtime não exposto.

## Proveniência e fencing

- Fence / HEAD de entrada: `3caf1209b6a0faafac24fcd2bf10871119443f9f`, S0 `S0-FENCE-e2.json`.
- ACK real: `94a6f9c56db915bdf6bde642d907efff8ce8cb51` (`ACK-W07-e2.json`).
- Promoção integral do staging aos paths de produto: `a10c880807031f2b40523f1c646749a74a543919`.
- Correções de privacidade, foco, cópia, bloqueio de apply e testes DOM: `aa23f73d742a99266f71e430ab707ecea07f4c81` (árvore `6dab39b4f13b3a82685e9e2cef1cd09f34ab09aa`).
- Todas as atualizações GitHub foram fast-forward com CAS por HEAD, sem reset/force.

## Arquivos exclusivos — preimage inexistente

| Destino | Blob final | Origem staged |
| --- | --- | --- |
| `packages/app-shell/src/orchestra/chapters/sucafina/shared/monthly-grid/types.ts` | `c6764437b9021c4eccae91329df7f4710409eefe` | `c6764437b9021c4eccae91329df7f4710409eefe` |
| `packages/app-shell/src/orchestra/chapters/sucafina/shared/monthly-grid/index.tsx` | `8da2af9dd881d5879eb89b6bd83e073697fe4a10` | `116584617a26e21d48952ce0d5767d804e73f0fd` |
| `packages/app-shell/src/orchestra/chapters/sucafina/shared/monthly-grid/monthly-grid.css` | `81849360c8972c68edf5c1e5e8d00a903257f084` | `81849360c8972c68edf5c1e5e8d00a903257f084` |
| `packages/app-shell/src/i18n/orchestra-chapters/sf-s02.ts` | `2ce5a8747c99df7aff33bce7b0a41172664bd498` | `2ce5a8747c99df7aff33bce7b0a41172664bd498` |
| `packages/app-shell/test-browser/sucafina-native/s02.test.ts` | `a32178e91f85119c8d111c169899b0e2303c529b` | `232365ecba46cb94933618ff97932dfeb9119a83` |

Os originais `staged/*.txt` e handoff e1 permanecem preservados. Não editar o registry compartilhado. Evitar intake da branch inteira: contém artefatos históricos da campanha, não exclusivamente S02.

## Contrato / consumidores

- `SfMonthlyGrid<Row>` publica exatamente props, tipos e callbacks de `component-signatures.ts@e283b202`, sem assumir fetch, ACL ou cálculo financeiro.
- Teclado grid com um tab stop, range Shift+setas, Ctrl+Home/End, editor Enter/F2/Esc/Tab, foco no editor, cópia raw do input, foco/restauração; estados fechados/locked/actual impedem edição.
- Valores `0`, ausente, herdado nulo, herdado com número e indisponível ficam semanticamente distintos; sem parse financeiro local.
- TSV bruto, CRLF, vazios finais, erros de dimensão/formato, status e revisões por linha; apply passa somente linhas `ready` limpas; retry somente `failed|conflict` por ação humana; em `applying` bloqueia paste/edit concorrente.
- `SfPasteRequest.range` mantém meses 0..11. **Só A02/W15** faz a conversão única ao `MonthlyDraft.cells.month` 1..12 e chama `planner.monthly.preview/apply` reais. Antes/depois do host real só podem ser apresentados em uma surface de review autorizada; `SfPasteState` congelado não possui esses campos, portanto S02 não os inventa.
- Breakpoint móvel entrega 12 competências por linha e textarea de TSV multi-linha, sem compactação de 12 colunas.

### Patch compartilhado (114 exclusivo)

`packages/app-shell/src/i18n/orchestra.ts`: aplicar apenas pelo integrador import `{ SF_S02_COPY, SF_S02_COPY_BR }` de `./orchestra-chapters/sf-s02` e spreads `...SF_S02_COPY` / `...SF_S02_COPY_BR`. Patch completo: `modules/sucafina/Sucafinav1/docs/sf2h/receipts/native-ui/W07/shared/orchestra.ts.patch.txt`, preimage histórica `2eeaa42e02a45b3301fc765c6c92635af5101079`, postimage histórica `b2ed4f1adbaab1b6469c53f52e6b484cd24f0029`; reconciliar nova preimage da composição de 114, nunca aplicar o postimage antigo cegamente.

### Pendências controladas

1. **114:** intake cirúrgico de S02 com F01/F03/A02 e i18n comum no mesmo C; registrar consumer ACK e resolver apresentação do `before/after` real.
2. **120:** somente depois de composição autorizada, executar seleção hospedada `packages/app-shell/test-browser/sucafina-native/s02.test.ts` com dedup real. **NOT_RUN** por W07.
3. **119:** compiler `packages/app-shell` e guards no candidato composto. **NOT_RUN** por W07.
4. `S02-AC01/02/03`, `WP01.T02`, `WP03.T02` possuem artefato implementado; todos os testes e provas ainda `NOT_RUN`.

Produtores C58 conferidos: `monthly-edit.ts@8cbcb05`, `monthly-host.ts@b8bdf6e`, `planner-http.ts@2befb1d`. Sem permissões fingidas, cálculo financeiro paralelo, mês convertido duas vezes, tests locais, merge, deploy, Azure ou reativação da Goal.

**Lease e2:** terminal de autoria `ARTIFACT_READY_HANDOFF_TO_114`; não é prova de integração, fechamento ou liberação global.
