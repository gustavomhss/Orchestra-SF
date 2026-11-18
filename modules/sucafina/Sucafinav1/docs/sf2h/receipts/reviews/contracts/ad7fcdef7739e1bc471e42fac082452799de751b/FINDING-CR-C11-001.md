# CR-C11-001 — Observação de stale perdida no wrapper do host

- **Classificação:** BUG
- **Severidade:** P2 / média. Correção obrigatória antes de aceitar esta rota C11; não é alegação de incidente ou exposição.
- **Candidato examinado:** `ad7fcdef7739e1bc471e42fac082452799de751b`, tree `885ce466354d2b8dcf674472561c9c1fc3b632ff`, [PR #44](https://github.com/gustavomhss/Orchestra-SF/pull/44).
- **Norma:** C11; WP12.T04.DOD.10 e WP12.T04.QLT.10; WP10.T01.DOD.01/QLT.01 e WP10.QLT.40, no plano `dbf9547211d9b0fade619790de7c19c0869b7c7d`.
- **Owner lógico:** WP10, wrapper e montagem do host; contrato do produtor deve ser reconciliado com WP12.
- **Método:** revisão estática independente de produtor, wrapper, montagem e testes existentes. Nenhum teste novo foi executado.

## Contradição verificável

O intake R03 incorpora o produtor novo de lifecycle. `createSfAnalysisHost.markStale` recebe e encaminha o quarto argumento `observation`; `createSfRunStore.markStale` exige essa observação para reconciliar um run já `ready`, conservando a identidade observada e os bytes da saída persistida.

O host composto monta esse store por `createSfStaleAnalysisAccess(...).wrapStore(...)`. O wrapper conserva a assinatura antiga de três argumentos e chama o store interno sem a observação. A informação se perde antes da guarda do produtor.

| Fronteira | Path no candidato | Local | Blob Git |
|---|---|---|---|
| Emissor do fallback | `modules/sucafina/Sucafinav1/product/ai/analysis-port.ts` | 121–142, 167–173: captura observação e a passa a `host.markStale` | `47e25de4ed1e743a2366c234a56baf2633c805bb` |
| Adapter atualizado | `modules/sucafina/Sucafinav1/product/ai/analysis-host.ts` | 53–55: encaminha quatro argumentos | `79bc5b933253daf8db73171d20e84f77436f5bbe` |
| Wrapper desatualizado | `apps/cli/src/sucafina-product/analysis-stale-commit.ts` | 152–190; especificamente 183: recebe/encaminha apenas três argumentos | `299979047340dd76d7cc2db667b826da675a1e2e` |
| Produtor atualizado | `modules/sucafina/Sucafinav1/product/ai/run-store.ts` | 227–248: `ready && !expected` recusa; observação fixa run/output no CAS | `978e4d54d2d54d1308152b7a4e9625f5c54b36ae` |
| Montagem real | `apps/cli/src/sucafina-product/host-context.ts` | 462–464, 561–575: instala wrapper, passa store ao adapter e executa `runSfAnalysis` | `834b3c967d73411771e1f5aa82b683c6427e6769` |

Todas as referências desta tabela usam [a árvore examinada](https://github.com/gustavomhss/Orchestra-SF/tree/ad7fcdef7739e1bc471e42fac082452799de751b). O quarto parâmetro opcional permite que o wrapper antigo continue compatível no tipo; typecheck isolado não detecta essa perda semântica.

## Reprodução estática discriminante

1. Considerar um run nativo já persistido em `ready`, com `outputRef`, saída original e autoridade atual válidos.
2. Observar run/saída com a observação pinada usada por `publishSfContribution`.
3. Passar essa observação como quarto argumento a `markStale` do store devolvido por `wrapStore`, com preflight permitido.
4. O wrapper da linha 183 chama `store.markStale(runRef, reason, call)`. O produtor recebe `observation === undefined`.
5. Em `run-store.ts:232`, `original.state === "ready" && !expected` determina `conflict / invalid-run-transition`, antes de qualquer CAS. A reconciliação de metadata não ocorre.

O caminho de produção relevante aparece quando a publicação já gravou `ready`, a checagem de saída detecta mudança material e a tentativa de preservar conteúdo é recusada: o fallback de lifecycle em `analysis-port.ts:129` passa a observação, que o wrapper elimina. Nem todo resultado tardio passa por esse fallback: `preserveStale` pode completar primeiro, ou a autorização pode recusar antes. O defeito demonstrado é precisamente a impossibilidade dessa transição de metadata pela montagem atual, não uma falha universal de stale.

## Evidência existente e seu limite

[Run 43618683440, job 132519270810](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43618683440/job/132519270810) executou 66 testes / 795 assertions em W `e1a1888bd2117616d53c5af5f5014e81c4b4e530`, snapshot S `5a658cfcceeb618b5167315cc1dbc161a8c9516e`.

O teste `test/product/wp12/publication-lifecycle.test.ts`, blob `6bf1130c94bca4b3cd1377875492b8f910b4259a`, cria `createSfRunStore` diretamente (linhas 9, 70) e injeta a fronteira de autoridade/lifecycle (101–131). O cenário 255–265 espera `stale` após commit de `ready` e mudança de fonte. A fixture não importa nem monta `createSfStaleAnalysisAccess`. Assim, o green do componente é válido e não cobre o wrapper que perde o argumento.

A ressalva de closure CLI no intake R03 e os gates nativos já abertos são preservados. Este finding identifica um defeito concreto dentro dessa closure; não acusa o autor de ocultar uma aprovação global.

## Consequência e ação mínima

A recuperação por metadata pode retornar conflito e deixar o lifecycle persistido como `ready`, em vez do `stale` recuperável esperado. As leituras do host possuem revalidação adicional; esta revisão **não demonstrou vazamento de conteúdo, reaplicação financeira ou incidente nativo**.

A menor correção pertence ao owner: adaptar o wrapper para conservar a observação e sua identidade através dos awaits/preflight, mantendo CAS, revalidação atual, cancelamento e ausência de escrita de conteúdo no fallback. O recheck deve atravessar o wrapper/montagem reais e incluir pós-commit, alteração concorrente da observação/saída, revogação e o positivo que preserva os bytes originais. Não remover a guarda do produtor para obter um green.

## Estado

**OPEN — requer correção e recheck do delta relevante.** Este parecer não edita produto, não concede GLOBAL_RELEASE e não substitui as três aprovações finais no candidato integrado. Publicação independente, sem autoria nos arquivos julgados.
