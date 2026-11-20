# Sessão 4 — shards SF 7 e 8

Branch a criar: `sf-shard-c`
Base: `f7dd58e32bc834f1485df20b91adbf759b4c4ad0` (sf-join-four)
Acesso: apenas GitHub (`gustavomhss/Orchestra-SF`). Sem shell. Verificação por Actions.

## Objetivo
Shards **7 e 8** de `CI-SF` verdes, ou cada falha restante classificada.
Ao terminar, você também faz a **primeira leitura agregada** dos oito shards: pede aos branches `sf-shard-a` e `sf-shard-b` os resultados e monta o mapa final de falhas.

## Passo 1 — enumerar
Branches `ci-run-sfc-7` e `ci-run-sfc-8`, `.ci-run.json` na raiz:

```json
{ "package": "modules/sucafina", "runner": "bun",
  "env": { "SF_SUITE_ID": "CI-SF", "SF_SHARD_INDEX": "7", "SF_SHARD_COUNT": "8" } }
```

Repita com `8`. Cole por shard `N pass / M fail` e a lista de falhas com `file:line`.

## Passo 2 — corrigir por causa
Uma fatia por causa, commit na `sf-shard-c`, um gate por correção.
Código fora de `modules/sucafina/Sucafinav1/test/**` vai em PR `shared:` separado.

## Passo 3 — mapa agregado
Reúna os resultados dos shards 1–8 (os seus e os dos branches `sf-shard-a`/`sf-shard-b`) numa tabela única no handoff: shard, pass, fail, causas, unbound.

## Economia de CI (obrigatório)
- Um gate por causa; nunca repetir gate idêntico sem mudança.
- Gate só depois de fix concreto.
- No máximo 2 gates simultâneos.
- Mesmo gate falhando 2x no mesmo ponto: pare e registre `unbound`.
- Não rode `sf-ci`.

## Regras
- Não recrie console morto; não edite `runtime/application.ts`; não use `:4110`.
- Não enfraqueça asserção; não forje baseline/coverage/digest/GO.
- Nada de push em `close-final-candidate`, `sf-red-clusters`, `go-live-close`, `sf-frontend-bundle`.

## Handoff (obrigatório, mesmo parcial)
`docs/handoff/HANDOFF-sf-shard-c.md` no template, incluindo a tabela agregada dos oito shards.

## Retorno
Por shard: `shard | run id | N pass / M fail | falhas(file:line) | SHA do fix` + tabela agregada.
