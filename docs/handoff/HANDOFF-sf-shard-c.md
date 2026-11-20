# Handoff — sf-shard-c

SHA: f7dd58e32bc834f1485df20b91adbf759b4c4ad0 (base de código; primeira publicação documental)
Data: 2026-11-20T00:27:03Z
Estado: partial

## Feito

- Branch isolada `sf-shard-c` criada exatamente na base `f7dd58e32bc834f1485df20b91adbf759b4c4ad0`.
- Leitura de `AGENTS.md`, `.github/workflows/test-ci.yml`, `script/test-ci-request.ts`, `script/test-ci-package.ts`, `script/sf-ci/gate.mjs` e `sf/ci/suites.json`.
- Requests originais preservados sem execução (`[skip ci]`): `ci-run-sfc-7` @ `da35a4b6854a29e43daebfa1b2b2a6aa8774ca6d` e `ci-run-sfc-8` @ `fe76b8d9683ce868683ca8b6bb2f2cee2f88112b`.
- Reconstrução estática independente da partição da base: 924 arquivos descobertos, 40 harness-owned + 1 release-only excluídos pelo manifest existente, 883 selecionados; contagens por shard: 113/107/99/118/119/109/103/115. Nenhuma exclusão foi acrescentada.
- Enumeração por Actions iniciada com requests suportados, mantendo o código da base:
  - Shard 7: [run 44645952434](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44645952434), `ci-run-linux-sfc-7` @ `0cc9380fdc452c2da328a787e207396c4040c5e1`, 103 arquivos.
  - Shard 8: [run 44645956665](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44645956665), `ci-run-linux-sfc-8` @ `13f88387091b7db295a73aca0d20fb3859a56ae7`, 115 arquivos.

## Pendente

- Aguardar logs dos dois runs, registrar N pass / M fail e cada falha com file:line antes de corrigir.
- Corrigir por causa dentro de `modules/sucafina/Sucafinav1/test/**`; código fora desse escopo exige PR `shared:` separado.
- Reconsultar resultados de `sf-shard-a` e `sf-shard-b` antes de fechar a tabela agregada.
- `.github/workflows/test-ci.yml:30-35`: prefixo original `ci-run-sfc-*` é recusado antes do checkout.
- `script/test-ci-request.ts:90-93`: request precisa de `args` e env é restrito; `SF_*` não é permitido.
- `script/test-ci-package.ts:34`: seletor suportado é alias `sucafina`, não caminho `modules/sucafina`.

## Decisões e justificativas

- Asserções removidas: nenhuma. Nenhum teste foi alterado nesta fase.
- Os snapshots Linux usam `package: sucafina`, `directory: modules/sucafina`, `runner: bun`, `args: ["--timeout", "30000", ...arquivos do shard]`, `env: { ORCHESTRA_EXPERIMENTAL_OMNI_SPAWNER: "1" }`.
- A seleção explícita segue a regex, exclusões e hash de `gate.mjs` na base. Isto é enumeração diagnóstica via `test-ci`; não produz recibo canônico de `sf-ci`, baseline, coverage, digest de execução nem GO.
- `test-ci` usa controle Omni `declared` para arquivos explícitos; o gate canônico aplica os próprios controles de suite/união. Não declarar equivalência de release.
- Controles que não existem: nenhum declarado sem observar os logs.
- Sem shell, sem execução local, sem `sf-ci`, sem alteração de `runtime/application.ts`, sem console legado, sem uso de `:4110`, sem push nas branches proibidas.

## Tabela agregada — primeira leitura

| Shard | Responsável | Run | Pass | Fail | Causas | Unbound |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | sf-shard-a | N/D | N/D | N/D | Não enumeradas | Branch/handoff ausentes; nenhum run encontrado |
| 2 | sf-shard-a | N/D | N/D | N/D | Não enumeradas | Branch/handoff ausentes; nenhum run encontrado |
| 3 | sf-shard-a | N/D | N/D | N/D | Não enumeradas | Branch/handoff ausentes; nenhum run encontrado |
| 4 | sf-shard-b | N/D | N/D | N/D | Não enumeradas | Branch/handoff ausentes; nenhum run encontrado |
| 5 | sf-shard-b | N/D | N/D | N/D | Não enumeradas | Branch/handoff ausentes; nenhum run encontrado |
| 6 | sf-shard-b | N/D | N/D | N/D | Não enumeradas | Branch/handoff ausentes; nenhum run encontrado |
| 7 | sf-shard-c | 44645952434 | N/D | N/D | Run em execução | Ainda sem resultado |
| 8 | sf-shard-c | 44645956665 | N/D | N/D | Run em execução | Ainda sem resultado |

As consultas A/B retornaram 404 para branch/handoff e zero runs tanto em `ci-run-sfa/sfb-*` quanto em `ci-run-linux-sfa/sfb-*`. N/D não significa 0 pass / 0 fail.

## Como retomar

1. Partir de `sf-shard-c` na base de código acima; ler a versão atual deste handoff.
2. Obter os jobs e logs dos runs 44645952434 e 44645956665 pelo GitHub MCP.
3. Enumerar antes de corrigir; um commit por causa, um gate por correção, no máximo dois gates ativos. Após duas falhas do mesmo gate no mesmo ponto, registrar unbound e parar a causa.
4. Atualizar este handoff com evidência real e a tabela dos oito shards.

## Comandos e resultados

- `bun typecheck` (app-shell): não rodado; nenhuma alteração no app-shell.
- `bun run check:guards --base origin/dev`: não rodado manualmente; o shard 7 inclui um teste que executa esse guard.
- `bun run test:ci ...`: não executado em shell; snapshots equivalentes submetidos pelo GitHub MCP ao workflow `test-ci`.
- `sf-ci`: não rodado.
