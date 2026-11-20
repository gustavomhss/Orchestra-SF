# Handoff — sf-shard-c

SHA: 328960a664ed64c4db46e69bf30f24f9efb04c51 (último commit de código; este checkpoint documental vem depois dele)
Data: 2026-11-20T00:54:40Z
Estado: partial

## Feito

- Branch isolada `sf-shard-c` criada exatamente em `f7dd58e32bc834f1485df20b91adbf759b4c4ad0` (`sf-join-four`).
- Toda a operação foi feita pelo GitHub MCP; testes somente em GitHub Actions. Nenhum shell foi utilizado.
- Leitura de `AGENTS.md`, do workflow `test-ci`, validadores de request/pacote, seletor canônico `script/sf-ci/gate.mjs` e manifest `sf/ci/suites.json`.
- Partição estática reconstruída e revisada independentemente: 924 arquivos descobertos, menos 40 harness-owned e 1 release-only já excluídos pelo manifest, resultando em 883 arquivos. Distribuição dos oito shards: **113 / 107 / 99 / 118 / 119 / 109 / 103 / 115**. Nenhuma exclusão acrescentada.
- Shard 8 enumerado: **618 pass / 2 fail**, 620 testes em 115 arquivos, 1004,17 s, no [run 44645956665](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44645956665).
- Uma causa corrigida no commit [328960a664ed64c4db46e69bf30f24f9efb04c51](https://github.com/gustavomhss/Orchestra-SF/commit/328960a664ed64c4db46e69bf30f24f9efb04c51): atualização comprovada de uma identidade de produtor em `test/product/canonical-read-cost/diagnostic-expected.ts`.
- Um único gate para essa correção: [44649157618](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44649157618), **2 pass / 0 fail**, 40 asserções, 43,10 s; diagnóstico real mais controle de autorização de namespace. O log registrou o hash atual do produtor e `pending: 0`.
- Falha restante do shard 8 classificada como **unbound — interação/teardown de browser**, sem alteração especulativa de produção ou enfraquecimento do teste.
- Primeira leitura dos handoffs e runs de `sf-shard-a` e `sf-shard-b` registrada na tabela agregada abaixo.

## Enumeração e gates

Os caminhos de falhas abaixo são relativos a `modules/sucafina/Sucafinav1/`.

| Shard / gate | Run id | Snapshot executado | Pass / fail | Falhas (file:line) | SHA do fix |
| --- | --- | --- | --- | --- | --- |
| 7 — enumeração | [44645952434](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44645952434) | `0cc9380fdc452c2da328a787e207396c4040c5e1` | N/D / N/D — ainda em execução | Lista final ainda indisponível | — |
| 8 — enumeração | [44645956665](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44645956665) | `13f88387091b7db295a73aca0d20fb3859a56ae7` | **618 / 2** | `test/product/canonical-read-cost/diagnostic-cost.test.ts:13:26`; `test/product/wp05/planner-origins.test.ts:83:77` | `328960a664ed64c4db46e69bf30f24f9efb04c51` resolve a primeira causa em gate focado |
| Pin do produtor + autorização de namespace | [44649157618](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44649157618) | `96211198e61056d3ee17d1710d74ea4b0f16bcad` | **2 / 0** | Nenhuma | `328960a664ed64c4db46e69bf30f24f9efb04c51` |

O resultado 618/2 é o resultado integral medido na base. Não foi convertido em uma contagem hipotética após o fix. O gate focado não é uma nova execução completa do shard 8.

### C8.1 — identidade do produtor desatualizada: corrigida e validada

- Falha: `test/product/canonical-read-cost/diagnostic-cost.test.ts:13:26`.
- Pin anterior de `product/host-binding/state-provider.ts`: `ba10043704bbb1a25eb0f4a8edddcdca814ec7610157bc7c4d9d88d2970467f5`.
- Bytes atuais na base: `bf0a5639bd41f903c67a89096b733269fbcd9eaf25392dde8c062fdcc13434c1`.
- Proveniência: [c00b150b48f576a79a7c8b33f15c4fb55d72dfd1](https://github.com/gustavomhss/Orchestra-SF/commit/c00b150b48f576a79a7c8b33f15c4fb55d72dfd1), cujo pai é `2682f82da2650314e3437ab48b5c65e52c5b3fe4`, acrescentou `preferences`/`receipts` à união de tipos e à admissão de `selectSfNamespaceHealth`, nas linhas 39–40. Recomputação SHA256 dos arquivos obtidos do GitHub confirmou ambos os hashes. Aplicar somente essas duas alterações ao arquivo do pai reproduz integralmente os bytes atuais.
- Fix restrito a `modules/sucafina/Sucafinav1/test/product/canonical-read-cost/diagnostic-expected.ts`: um pin e seu comentário de proveniência. Os demais pins, teste, probe, recibo histórico e revisão histórica permanecem intactos.
- Gate executou `diagnostic-cost.test.ts` e `native-ui-contract/namespace-health.test.ts`. Os controles de autoridade original, autoridade incorreta, revogação e ausência de conteúdo privado passaram.
- O diagnóstico mede trabalho real; ele não contém asserção de teto numérico de custo. Esse verde confirma a execução com a identidade correta e controles existentes, sem demonstrar melhoria de desempenho nem qualificar P03.

### C8.2 — clique no chooser e cleanup pendente: unbound

- Falha primária: `test/product/wp05/planner-origins.test.ts:83:77`, origem B do BI03. O locator encontrou o botão correto, visível, habilitado e estável; o clique travou em “scrolling into view if needed” e excedeu 10 s.
- Falha secundária de encerramento: `test/product/wp05/browser.ts:61` aguarda `fixture.dispose()`/`browser.close()` sem deadline depois de cancelar o timer. O log não registra fechamento/desconexão desse browser antes do timeout externo de 180 s.
- Linha do tempo do run atual: BI02 concluiu entre 00:37:33.498Z e 00:37:35.719Z; BI03 começou às 00:37:36.131Z; origem A passou por mouse, foco, teclado e tabela; origem B começou às 00:37:36.935Z; o erro de clique foi registrado às 00:37:46.976Z; timeout externo às 00:40:33.426Z.
- Contraprova histórica: [run 44590270877](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44590270877), job 135794077900, snapshot `f85c4ca344ee0a064d6f9a422f6d55d4c4b8dba2`, fix [b32a7a1fc9f9280aa54ca1708fe8764ef48c5ae6](https://github.com/gustavomhss/Orchestra-SF/commit/b32a7a1fc9f9280aa54ca1708fe8764ef48c5ae6) / PR #376: **1 pass / 0 fail**, 178 asserções, 23,37 s.
- Blobs idênticos entre esse snapshot e a base atual: `product/analytics/view.ts`, `product/analytics/source-navigation.ts`, `test/product/wp05/browser.ts`, `test/product/wp05/planner-origins.test.ts` e `test/product/wp03/planner-fixture.ts`.
- Runner image observada: verde histórico `ubuntu-24.04 / 20261116.376.1`; shard atual `ubuntu-24.04 / 20261111.370.1`. A diferença não estabelece causa. O verde histórico não é transferido ao shard atual.
- Nenhuma troca de mouse por teclado, clique forçado/JavaScript, ampliação de timeout ou alteração de foco foi realizada. Corrigir só o cleanup não demonstraria solução para o clique. Sem fix causal concreto, não foi gasto rerun idêntico.

## Pendente

- Finalizar a enumeração do shard 7 — [run 44645952434](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44645952434), job 135988445022 — ainda no passo `Run tests`; o endpoint de log ainda retorna BlobNotFound. Não há contagem final para inferir.
- Resolver C8.2 — `test/product/wp05/planner-origins.test.ts:83:77` / `test/product/wp05/browser.ts:61` — causa inicial do scroll/transport ainda não demonstrada.
- Receber resultados finais dos shards 1–6 via handoffs/runs de A/B; N/D indica ausência de enumeração concluída, não zero falhas.
- Admissão canônica de CI-SF — `script/sf-ci/gate.mjs:98` e controles do workflow canônico — não executada nesta sessão; o usuário proibiu `sf-ci`. Não existe recibo canônico de união produzido por estes runs diagnósticos.

## Decisões e justificativas

- **Asserções removidas: nenhuma.** Nenhum skip, exclusão nova, baseline, coverage, digest de execução ou GO foi fabricado.
- **Controles que não existem nesta evidência:** o runner diagnóstico não executa a admissão estática de imports nem produz recibo canônico/união de `sf-ci`; não permite afirmar equivalência de release. O harness WP05 não tem deadline no cleanup (`test/product/wp05/browser.ts:61`). Não houve prova de que essa ausência causou o timeout inicial do clique.
- O request literal solicitado não é admitido na base: `.github/workflows/test-ci.yml:30–37` rejeita prefixos que não sejam `ci-run-linux-*` (erro na linha 36); `script/test-ci-request.ts:96–98` exige `args` e valida env contra a whitelist (linhas 12–15, 133–141); `SF_SUITE_ID`, `SF_SHARD_INDEX` e `SF_SHARD_COUNT` não são admitidos. `script/test-ci-package.ts:35` exige o alias suportado `sucafina`.
- Requests literais preservados sem execução (`[skip ci]`): [ci-run-sfc-7](https://github.com/gustavomhss/Orchestra-SF/blob/da35a4b6854a29e43daebfa1b2b2a6aa8774ca6d/.ci-run.json) @ `da35a4b6854a29e43daebfa1b2b2a6aa8774ca6d` e [ci-run-sfc-8](https://github.com/gustavomhss/Orchestra-SF/blob/fe76b8d9683ce868683ca8b6bb2f2cee2f88112b/.ci-run.json) @ `fe76b8d9683ce868683ca8b6bb2f2cee2f88112b`.
- Snapshots executáveis usam `package: sucafina`, `directory: modules/sucafina`, `runner: bun`, `args: ["--timeout", "30000", ...arquivos exatos do shard]`, `env: { ORCHESTRA_EXPERIMENTAL_OMNI_SPAWNER: "1" }`. Os arquivos explícitos seguem descoberta, exclusões e SHA256-módulo-8 do seletor canônico da base. Nenhum workflow, validator ou manifest foi alterado.
- Checksums das listas, não de execução: shard 7 `206d8fd9d791f9abd4b8e32b8eb66cc802f04944456f87ae5f998331016ea6b4`; shard 8 `921e07bec2f62adb05f4a35b55fcf1b645a6b40a15b0c80e24caea6ec1c7a8ae`.
- `test-ci` usou Omni `declared`; no shard 8 o controle passou com 117 spawns Omni e zero delegações. O gate focado do pin não possui processo declarado. Não confundir esse modo com os controles de suite/união do runner canônico.
- Economia da sessão C: duas enumerações simultâneas; após conclusão de 8 e seu cleanup, um gate focado da correção junto ao 7. Máximo de dois gates ativos. Zero reruns idênticos, um gate para uma causa corrigida.
- Nenhum código fora de `modules/sucafina/Sucafinav1/test/**` foi alterado. Portanto, nenhum PR `shared:` foi necessário. O único outro arquivo alterado em `sf-shard-c` é este handoff.
- Sem shell, sem `sf-ci`, sem alteração de `runtime/application.ts`, sem console legado, sem uso de `:4110`, sem push nas quatro branches proibidas.

## Tabela agregada — primeira leitura dos oito shards

Leitura de A/B atualizada em 2026-11-20T00:54Z. Contagens desta tabela são exclusivamente de enumerações integrais medidas; gates focados não são somados.

| Shard | Responsável | Run | Pass | Fail | Causas | Unbound / pendência |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | sf-shard-a | [44646013868](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44646013868) | N/D | N/D | Ainda não enumeradas | `Run tests` em execução |
| 2 | sf-shard-a | [44646018333](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44646018333) | N/D | N/D | Ainda não enumeradas | `Run tests` em execução |
| 3 | sf-shard-a | Não iniciado | N/D | N/D | Ainda não enumeradas | Aguarda vaga na sessão A |
| 4 | sf-shard-b | [44645900692](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44645900692) | N/D | N/D | Ainda não enumeradas | `Run tests` em execução |
| 5 | sf-shard-b | [44645913808](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44645913808) | N/D | N/D | Ainda não enumeradas | `Run tests` em execução |
| 6 | sf-shard-b | Não iniciado | N/D | N/D | Ainda não enumeradas | Aguarda vaga na sessão B |
| 7 | sf-shard-c | [44645952434](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44645952434) | N/D | N/D | Ainda não enumeradas | `Run tests` em execução |
| 8 | sf-shard-c | [44645956665](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44645956665) | **618** | **2** | Pin de identidade corrigido; clique/cleanup de browser | **1 causa unbound**; fix do pin verde em gate 2/0 |

Fontes de A/B: [HANDOFF-sf-shard-a.md](https://github.com/gustavomhss/Orchestra-SF/blob/sf-shard-a/docs/handoff/HANDOFF-sf-shard-a.md), blob `f03918419c9ac60ac3359cfb9c0409b9ac679511`; [HANDOFF-sf-shard-b.md](https://github.com/gustavomhss/Orchestra-SF/blob/sf-shard-b/docs/handoff/HANDOFF-sf-shard-b.md), blob `2960b4e13181840f25aa2f683fbe37b8bc5774c7`, confrontados com os jobs dos runs acima. Runs antigos recusados em preflight por `TEST_PACKAGE_NOT_FOUND:modules/sucafina` não fornecem contagem de testes e não substituem as enumerações válidas.

Snapshots A/B: 1 `a4bbf6b042526a0ee3f544243cfa67158236f871`; 2 `dcb0c68d7e866b4df2153eadd26fda2eab45b266`; 4 `dd45d888617943df40e02815d58b59f88d8a18f7`; 5 `f0bccdc48b42a9d000f3bda6565fa3d88286c845`. Shard 6 tem request preparado em `204a74491764dcde4da22ebe558efc318e04a777`, ainda sem run nesta leitura.

## Como retomar

1. Partir de `sf-shard-c`, que contém o fix `328960a664ed64c4db46e69bf30f24f9efb04c51`, e ler a versão mais recente deste handoff.
2. Obter jobs/logs de 44645952434 pelo GitHub MCP; enumerar pass/fail e todas as falhas com file:line antes de corrigir qualquer causa do shard 7.
3. Para C8.2, localizar a causa do travamento de scroll/transport preservando o clique real e os controles A/B. Se o trabalho envolver produção ou infraestrutura fora de test/**, preparar PR `shared:` separado.
4. Consultar handoffs A/B e seus runs; acrescentar 3/6 quando iniciados e resultados finais quando existirem. Não declarar união verde com células N/D.
5. Um commit por causa, um gate por correção concreta, no máximo dois gates ativos. Se o mesmo gate falhar duas vezes no mesmo ponto, parar e registrar unbound; não repetir gate idêntico.

## Comandos e resultados

- `bun typecheck` (app-shell): não rodado; nenhuma alteração no app-shell.
- `bun run check:guards --base origin/dev`: não rodado manualmente; shard 7 inclui `test/product/work-split/work-reuse/static-gates.test.ts`, que invoca typecheck do pacote, fetch da base e guards. Resultado ainda não disponível; nenhuma aprovação foi simulada.
- `bun run test:ci ...`: não executado em shell. Requests equivalentes submetidos por snapshots GitHub ao workflow `test-ci`: enumeração 7 em curso, enumeração 8 = 618/2, gate da causa C8.1 = 2/0.
- `sf-ci`: não rodado.
