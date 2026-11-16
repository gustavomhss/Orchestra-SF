# 206 → 189 — patch inerte de comportamento compartilhado
**Destinatária única:** 189/PR65 (integração S0-C); **não aplicado** nesta branch.
**Fonte já preservada:** 195 / handoff `679e17ecdfec23ab53ce4b23206594874617528d`; não refazer F04 nem canRead/save.

## Patch completo de produto
- `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure206/patches/189-budget-surface.inert.patch`, Git blob `5436359403ebf6a738ddd58ed4fa11fb62100534`.
- Metadata: `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure206/patches/189-budget-surface.json`, blob `c790cf4da67a8ab69c195087c84d33e42af762b6`.
- Path de produto a ser alterado **apenas por 189**: `packages/app-shell/src/orchestra/chapters/sucafina/dashboard/opex/surface.tsx` (compartilhado pelos componentes U39/U40).
- Preimage exata no HEAD reservado `0dd0ee1275f5b85d6658e1f094617e9b4eaefccb`: blob `ed94efe4d919eb80e4592057170d03c4b2348eb6`; postimage **inerte** blob `1ba0272bee68c30175f779e733eb77bf4485c3f9`. São dez hunks com contexto para aplicação por preimage, sem merge automático.
- Objetivos: retenção volátil do filtro/sort após detalhe/retorno escopada à registry real do F01; estado observável `submitting` sem segunda confirmação enquanto resultado original está pendente; proteger `finally` atrasado ao mudar owner/geração, sem expor draft alheio.
- Consumidores: `U39-AC02` e `U40-AC02`, S03/UI-change-review, F01 owner registry, F04 instalado.
- Regras: não inserir totals/planner paralelos, não presumir autorização, não alterar contratos de produtor, não afrouxar testes. **Não é patch aplicado nem validado.**
- 189 compara preimage real em sua branch e reconcilia drift, consumindo apenas hunks compatíveis com o produtor atual. Após integração, 200 precisa executar suites via F04 real.

## Outra dependência fora da lease
199 mantém o F04; hoje U39/U40 só recebem seleção `entry`. A exigência de cenário autenticado, snapshot original e callbacks do produtor está registrada em `modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure206/REQUIREMENTS-199.json`. **Não** é autorização para editar fixture pela 206.

## Estados
Todos os 44 casos declarados: `NOT_RUN`; patch: `INERT_NOT_APPLIED`; CI 200: somente solicitação. Goal nativa pausada; `GLOBAL_RELEASE=false`.
