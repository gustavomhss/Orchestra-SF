# UX20-W07 / S02 — handoff para 114

**Estado:** `BLOCKED_ADMISSION_WITH_COMPLETE_INERT_IMPLEMENTATION_PROPOSAL`. ACK real [bd5a996](https://github.com/gustavomhss/Orchestra-SF/commit/bd5a996f1e633df229f1cbde915c6fc4b0dfbdbf). Sem GO S02/W07, nenhum path de produto ou shared registry foi modificado.

## Implementação preparada (source em .txt deliberadamente inerte)

- `packages/app-shell/src/orchestra/chapters/sucafina/shared/monthly-grid/types.ts` ← `modules/sucafina/Sucafinav1/docs/sf2h/receipts/native-ui/W07/staged/types.ts.txt` (blob `c6764437b9021c4eccae91329df7f4710409eefe`, preimage ausente)
- `packages/app-shell/src/orchestra/chapters/sucafina/shared/monthly-grid/index.tsx` ← `modules/sucafina/Sucafinav1/docs/sf2h/receipts/native-ui/W07/staged/index.tsx.txt` (blob `116584617a26e21d48952ce0d5767d804e73f0fd`, preimage ausente)
- `packages/app-shell/src/orchestra/chapters/sucafina/shared/monthly-grid/monthly-grid.css` ← `modules/sucafina/Sucafinav1/docs/sf2h/receipts/native-ui/W07/staged/monthly-grid.css.txt` (blob `81849360c8972c68edf5c1e5e8d00a903257f084`, preimage ausente)
- `packages/app-shell/src/i18n/orchestra-chapters/sf-s02.ts` ← `modules/sucafina/Sucafinav1/docs/sf2h/receipts/native-ui/W07/staged/sf-s02.ts.txt` (blob `2ce5a8747c99df7aff33bce7b0a41172664bd498`, preimage ausente)
- `packages/app-shell/test-browser/sucafina-native/s02.test.ts` ← `modules/sucafina/Sucafinav1/docs/sf2h/receipts/native-ui/W07/staged/s02.test.ts.txt` (blob `232365ecba46cb94933618ff97932dfeb9119a83`, preimage ausente)

Os blobs de source correspondem aos conteúdos completos dos arquivos-alvo, não placeholders. Só promover após admissão explícita pela 114, verificação de preimages e instalação de F01/F03/A02. O titular da autoria tem lease reservada `ux-native-w07-e1`, **não ativa**.

## Contrato

Componente puro: grid ARIA com roving focus único, navegação sem wrap, seleção retangular, TSV shape-only preservando bytes/crlf/blank/zero, inline edit sem salvar, mobile 12 meses, estados privados, preview por linha/resultado CAS parcial e retry apenas explícito. O produtor real `monthly-edit.ts`/`monthly-host.ts` é o único parser financeiro/host CAS; mês do renderer 0..11 nunca é convertido neste componente — A02 converte +1 uma vez no DTO `MonthlyDraft`.

**Pendência normativa:** O DTO congelado `SfPasteState` não carrega o `before/after` da simulação do produtor; o componente não pode exibir tal simulação sem novo DTO ou composição em superfície de review do A02. Nada foi inventado.

## Shared path (patch completo, não aplicado)

`packages/app-shell/src/i18n/orchestra.ts`: preimage `2eeaa42e02a45b3301fc765c6c92635af5101079`; postimage proposta `b2ed4f1adbaab1b6469c53f52e6b484cd24f0029`, com diff em `modules/sucafina/Sucafinav1/docs/sf2h/receipts/native-ui/W07/shared/orchestra.ts.patch.txt`. A114 deve reconciliar sobre seu HEAD atual e aplicar apenas após liberação de owner.

## Qualificação e próximo passo

S02-AC01/02/03 ainda `NOT_RUN`. A120 deve selecionar exclusivamente `s02.test.ts` após composição válida; A119 compila/guards. Nenhum teste, parser, typecheck, deploy, merge ou operação Azure local foi executada. Público: `SfMonthlyGrid` + tipos. Consumidores: 114, W02, W04, W15, 120 e 119.

**114:** verificar intake S0, registrar GO ou recusa causal S02/W07, confirmar locks/source do C58 e instalar os 5 arquivos de produto por blobs exatos; integrar leaf i18n por patch rebaseado; não importar a branch inteira; exigir prova de Actions no mesmo material C.
