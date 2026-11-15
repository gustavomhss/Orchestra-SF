# Missão179 — Rotinas / TS2774 — handoff terminal

**Epoch** `native-fix-e1-browser179`; source `sf-ux-a09` / [PR140](https://github.com/gustavomhss/Orchestra-SF/pull/140). Ator: ChatGPT via connected GitHub MCP; modelo GPT-6; sessionID não exposto. Goal pausada, **GLOBAL_RELEASE=false**.

## Diagnóstico realmente observado

No [compiler163 run43766055614 job132971280139](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43766055614) sobre W `690a34cdd81c12d7311f3717c19679b950276161` (tree `07133fe09922121f3cca3bffd6b4463053b48ece`), `native-ui/routines.ts:178:31` emitiu **TS2774**. `HostProducts.withCase` é obrigatório quando `nativeUiProducts` está montado, logo `products?.routines && products.withCase` testa uma função permanentemente definida no ramo não nulo. A disponibilidade real está no objeto host opcional. Os produtores mantêm próprios grants, original Request, C07, Relay e a operação sob `business.withCase`.

## Alteração aplicada — exclusivamente leaf A09

- Preflight head `30e68e97d6a9ea66141c32ff493de27413d11b94`, tree `a82a4660258e5ef0b98fc66e6c2108290aa587b7`. Fence precedente revoga novas escritas de 152 no escopo; não afirma encerramento de processo.
- ACK `e8b76958a3cd278516d6d2c2b081c9f48b8984f7` (tree `44ec0150c9b71ab87bb6b6b4f3d738c32d6b2601`); código `266692313ff21a76f0815312c25b77a29008848c` (tree `2502c9763c552ee121d824d53a997ad375c20328`), CAS `force=false`.
- `apps/cli/src/sucafina-product/native-ui/routines.ts`: blob `f7fd5dece84a8374e0fd89c8c357e94b843ba1b6` → `6948316a7dc0b07296180fed7f5b32f613bcc106`. Gate passa a ser `? products`, preservando retorno `native-routine-port-unavailable` quando não montado. Patch integral [PATCH.diff](./PATCH.diff).
- `modules/sucafina/Sucafinav1/test/native-ui-contract/routines.test.ts` permanece blob `f5e8046200167c6e224ac4d5ff85e8e9ed2725ee`. Ajuste puramente tipado: nenhum teste espelhado, nenhuma alteração em assertion/Schema/fixture/timeout.
- Import fix152 em Schema `9b6429dd66be4419e4f9d2b4f397a5485986170c` preservado. Os 12 IDs de rotina/projeção/Schedule, `ui.admit/validate/revalidate/finish`, `human.admit/authorize/finish`, `withCase`, CAS e readonly `runResult` não foram alterados.

## Consumer e patch inerte exclusivo de 162

Preimage verificada em `sf2-stack@913b6b8f143e6c3e869eee293d02f04259c7cdd1`, tree `99d4788774ce548d4cd64a96c0f2481db1fb15eb`: code `f7fd5dece84a8374e0fd89c8c357e94b843ba1b6`, teste `f5e8046200167c6e224ac4d5ff85e8e9ed2725ee`. **179 NÃO escreveu no consumer**; SHA/tree de consumer pós-aplicação são desconhecidos, `ACK=PENDING`. 162 deve aplicar somente o blob `6948316a7dc0b07296180fed7f5b32f613bcc106` após reconciliação de preimage/CAS, sem mergear a branch inteira. O host de consumo ainda não publica `nativeUiProducts` em `SfHostServices` nem no objeto `services`; o [INERT-162.diff](./INERT-162.diff) e [INERT-162.json](./INERT-162.json) entregam **proposta completa sem aplicação**, incluindo `routineServices.routines` + `business.withCase` reais e porta `scheduleDetails` estritamente opcional. Nenhuma Schedule/Relay/C07/grant/readiness fake. **Somente 162** pode aplicar/reconciliar essa proposta shared com seus próprios locks/preimages/CAS.

## Prova histórica, limites e pedidos

- [CI164 run43766390097](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43766390097), W `6d42d6752497fc37be59c64a72b272a3d0860961`: 10/10 casos `routines.test.ts` PASS (49/49 total das cinco specs). **É baseline anterior, não prova do novo blob**.
- [CI164 run43766970018 job132974180913](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43766970018): 5 PASS/3 FAIL F03/S01/S05, S02 PASS; **nenhuma spec A09 selecionada**, não atribuir a 179.
- Typecheck pós-patch, testes pós-patch, SDK, guards, integração, produção/instalação C07 e native live: **NOT_RUN** (sem checks locais). A falha antiga do compiler não vira PASS sem novo W hospedado.
- [REQUESTS-163-164.json](./REQUESTS-163-164.json): 162 ACK/CAS e novo W+tree; depois 163 executa `bun typecheck` em `apps/cli` sobre nova entrada (mais `modules/sucafina` se seam aceito), captura diagnóstico e guarda demais owners; 164 reutiliza os testes `Sucafinav1/test/native-ui-contract/routines.test.ts` em Linux **apenas se integração mudar comportamento** ou matriz exigir, com dedup por W/seleção/config. Nenhum dispatcher adicional e nenhuma repetição de input falho inalterado.

**Estados:** fonte `ARTIFACT_READY`; consumer `PENDING`; qualificação `NOT_RUN`; Native41/Relay/Schedule `HOLD`; GLOBAL_RELEASE=false. Critérios `A09-AC01/AC02/AC03` não foram afrouxados nem promovidos a PASS; revisões finais dependem do mesmo C real.
