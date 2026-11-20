# Sessão 2 — shards SF 1, 2 e 3

Branch a criar: `sf-shard-a`
Base: `f7dd58e32bc834f1485df20b91adbf759b4c4ad0` (sf-join-four)
Acesso: apenas GitHub (`gustavomhss/Orchestra-SF`). Sem shell. Verificação por Actions.

## Objetivo
Deixar os shards **1, 2 e 3** de `CI-SF` (suíte `CI-SF`, 8 shards, `modules/sucafina`) verdes, ou com cada falha restante classificada.

## Passo 1 — enumerar (não conserte antes disso)
Para cada shard do seu intervalo, crie uma branch `ci-run-sfa-<n>` no SHA base e commite `.ci-run.json` na raiz:

```json
{ "package": "modules/sucafina", "runner": "bun",
  "env": { "SF_SUITE_ID": "CI-SF", "SF_SHARD_INDEX": "1", "SF_SHARD_COUNT": "8" } }
```

Troque `SF_SHARD_INDEX` para `2` e `3`. O workflow `test-ci` roda e apaga a branch.
Cole, por shard, a lista de falhas com `file:line` e a contagem (`N pass / M fail`).

O particionamento é disjunto por construção (`script/sf-ci/gate.mjs:98`): arquivos do seu shard não aparecem nos outros.

## Passo 2 — corrigir em fatias
- Uma fatia = uma causa. Se várias falhas têm a mesma raiz, corrija juntas; o handoff `finish-reviewtests` é o exemplo (23 pass / 0 fail com uma única causa).
- Cada fatia: commit na `sf-shard-a` + gate `ci-run` com o mesmo shard.
- Nunca apague, pule, aumente timeout ou troque asserção por check vazio.
- Se o produtor não carrega o dado que o teste exige, registre `unbound` com `file:line` e siga.

## Passo 3 — código compartilhado
Se precisar mudar algo fora de `modules/sucafina/Sucafinav1/test/**` (produto, projeção, fixture compartilhada):
- abra um PR **pequeno e separado** marcado `shared:` no título;
- não rebaseie os outros branches;
- descreva no handoff qual sessão precisa mergear primeiro.
O integrador mergeia `shared:` antes dos de teste.

## Gate de cada fatia
Branch `ci-run-sfa-<n>-<m>` no SHA do commit, `.ci-run.json` com o shard correspondente.
Cite `run id`, conclusão e a contagem final (`N pass / M fail`).

## Economia de CI (obrigatório)
- Um gate por causa corrigida; nunca repita gate idêntico sem mudança de código.
- Gate só depois de um fix concreto; não use gate para "ver como está".
- No máximo 2 gates simultâneos.
- Mesmo gate falhando 2x no mesmo ponto sem mudança: pare e registre `unbound` com `file:line`.
- Não rode `sf-ci`.

## Regras
- Não recrie console morto (`#content`, `data-surface`, `details/summary`, `form[data-command]` como contrato).
- Não edite `modules/sucafina/Sucafinav1/runtime/application.ts`.
- Não aponte browser para `:4110`.
- Não forje baseline/coverage/digest/GO. `reviews.export.docx/pptx` são `Schema.Never`; bytes reais só por `GET ?sf=review-download`.
- Não rode `sf-ci`. Não faça push em `close-final-candidate`, `sf-red-clusters`, `go-live-close`, `sf-frontend-bundle`.

## Handoff (obrigatório, mesmo parcial)
`docs/handoff/HANDOFF-sf-shard-a.md` com: SHA, estado, por shard o resultado (`N pass / M fail`) e a lista de falhas, feito/pendente com `file:line`, justificativas de asserção removida, runs com id, como retomar.

## Retorno
Por shard: `shard | run id | N pass / M fail | falhas(file:line) | SHA do fix`.
