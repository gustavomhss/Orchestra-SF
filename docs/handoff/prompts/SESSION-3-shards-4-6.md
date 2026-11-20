# Sessão 3 — shards SF 4, 5 e 6

Branch a criar: `sf-shard-b`
Base: `f7dd58e32bc834f1485df20b91adbf759b4c4ad0` (sf-join-four)
Acesso: apenas GitHub (`gustavomhss/Orchestra-SF`). Sem shell. Verificação por Actions.

## Objetivo
Shards **4, 5 e 6** de `CI-SF` verdes, ou cada falha restante classificada.

## Passo 1 — enumerar
Para cada shard, branch `ci-run-sfb-<n>` no SHA base e `.ci-run.json` na raiz:

```json
{ "package": "modules/sucafina", "runner": "bun",
  "env": { "SF_SUITE_ID": "CI-SF", "SF_SHARD_INDEX": "4", "SF_SHARD_COUNT": "8" } }
```

Repita com `5` e `6`. Cole por shard a lista de falhas com `file:line` e `N pass / M fail`.

## Passo 2 — corrigir por causa
Uma fatia por causa; se várias falhas compartilham raiz, corrija juntas e gate uma vez.
Cada fatia: commit na `sf-shard-b` + um gate no shard correspondente.

## Passo 3 — código compartilhado
Mudança fora de `modules/sucafina/Sucafinav1/test/**` vai em PR separado com título `shared:`.
Não rebaseie outros branches; diga no handoff a ordem de merge.

## Economia de CI (obrigatório)
- **Um gate por causa corrigida**, não por arquivo.
- Nunca repita um gate idêntico sem mudança de código.
- Gate só depois de um fix concreto — não para "ver como está".
- No máximo 2 gates simultâneos.
- Mesmo gate falhando 2x no mesmo ponto sem mudança: pare e registre `unbound`.
- Não rode `sf-ci`.

## Regras
- Não recrie console morto (`#content`, `data-surface`, `details/summary`, `form[data-command]` como contrato).
- Não edite `modules/sucafina/Sucafinav1/runtime/application.ts`.
- Não aponte browser para `:4110`.
- Não enfraqueça asserção.
- Não forje baseline/coverage/digest/GO.
- Nada de push em `close-final-candidate`, `sf-red-clusters`, `go-live-close`, `sf-frontend-bundle`.

## Handoff (obrigatório, mesmo parcial)
`docs/handoff/HANDOFF-sf-shard-b.md` no template: SHA, estado, por shard `N pass / M fail` e falhas, feito/pendente com `file:line`, justificativas, runs, como retomar.

## Retorno
Por shard: `shard | run id | N pass / M fail | falhas(file:line) | SHA do fix`.
