# Handoff — sf-shard-a

## Estado do checkpoint

- Estado: IN_PROGRESS — enumeração inicial; nenhuma correção de teste foi aplicada.
- Branch: `sf-shard-a`.
- Base fixa de código: `f7dd58e32bc834f1485df20b91adbf759b4c4ad0`.
- Escopo: CI-SF, shards 1, 2 e 3 de 8, módulo `modules/sucafina`.
- Acesso apenas pelo GitHub; verificação apenas por Actions. `sf-ci` não foi executado.
- Este checkpoint não declara testes verdes, cobertura completa nem GO.

## Preparação corrigida

Na base, o exemplo literal do briefing não é executável:

1. `.github/workflows/test-ci.yml:30-37` aceita somente branches `ci-run-linux-*`.
2. `script/test-ci-request.ts:96-98` exige `args` e valida o ambiente. Os únicos envs permitidos estão em `:12-15`; `SF_SUITE_ID`, `SF_SHARD_INDEX` e `SF_SHARD_COUNT` não são aceitos.
3. `script/test-ci-package.ts:20-35` resolve alias/nome registrado, não o caminho bruto `modules/sucafina`. `script/module-registry.json:35` registra alias `sucafina` para esse diretório.

Requisição efetiva: `package: "sucafina"`, `directory: "modules/sucafina"`, `runner: "bun"`, `args: ["--timeout", "30000", ...arquivosExatosDoShard]`, `env: { "ORCHESTRA_EXPERIMENTAL_OMNI_SPAWNER": "1" }`. O timeout de 30000 é o valor canônico de `.github/workflows/sf-ci.yml:410`; não foi aumentado.

As listas foram derivadas da árvore Git completa e das exclusões já presentes em `sf/ci/suites.json`, aplicando literalmente a partição de `script/sf-ci/gate.mjs:98-112`: SHA256 do caminho relativo ao módulo, primeiros 16 hexadecimais, módulo 8, índice iniciado em 1. Duas derivações independentes concordaram. 924 arquivos brutos menos 40 harness-owned menos 1 release-only = 883 selecionados. Contagens dos oito shards: 113, 107, 99, 118, 119, 109, 103, 115.

| Shard | Arquivos | SHA256 da lista ordenada unida por LF |
| --- | ---: | --- |
| 1 | 113 | `4e8be6efc441cc70161d6e0fcb7fa0ddf9af22c7cf30155c28353a8fc516de2a` |
| 2 | 107 | `821b4521fbf5c5727d52c280ad7a04e7742064b95b1e6c915b2e3df505d01eab` |
| 3 | 99 | `2ca0d89ae5a19956d5c1b62e67bb053c326d141f268862be3f19871217b6b553` |

Esses hashes identificam somente a seleção derivada, não uma cobertura executada.

## Runs de enumeração

| Shard | Run | Snapshot | Resultado observado neste checkpoint |
| --- | --- | --- | --- |
| 1 | [44646013868](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44646013868) | `a4bbf6b042526a0ee3f544243cfa67158236f871` | Run tests em andamento; contagem pendente |
| 2 | [44646018333](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44646018333) | `dcb0c68d7e866b4df2153eadd26fda2eab45b266` | Run tests em andamento; contagem pendente |
| 3 | Não iniciado | — | Aguarda vaga no limite de dois gates |

Os snapshots são commits filhos diretos da base, alterando apenas `.ci-run.json`; as branches temporárias são apagadas pelo próprio workflow. Cada requisição permanece legível no SHA do snapshot.

### Falhas de preparação, sem execução de testes

- [44645838424](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44645838424), shard 1, snapshot `c5eaa82f3c8af3200a2a75ee75ea7006efe4a4cf`, job `135988044990`: FAILURE em `script/test-ci-package.ts:35`, `TEST_PACKAGE_NOT_FOUND:modules/sucafina`.
- [44645842999](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44645842999), shard 2, snapshot `77fe323aa101ef11b9d382118ef81ea3f242f4c6`, job `135988061331`: mesma falha de preparação.

Nenhum teste Bun foi executado nesses dois runs; não equivalem a 0 pass / 0 fail. A requisição foi corrigida antes das novas enumerações, sem alteração dos testes da base.

## Feito / pendente

Feito: instruções de repositório lidas; branch isolada criada; seleção dos três shards conferida; requisição compatível com o runner existente; enumeração de 1 e 2 iniciada.

Pendente: concluir enumeração 1/2; iniciar 3 quando houver vaga; publicar cada falha com file:line e a contagem real; só depois corrigir por causa e validar a fatia no mesmo shard.

Asserções removidas: nenhuma. Testes pulados/removidos: nenhum. Produto, projeções, fixtures e workflows: nenhuma alteração.

## Como retomar

1. Consultar os runs acima e os logs dos jobs `135988658580` (shard 1) e `135988673159` (shard 2); não repetir gates idênticos.
2. Iniciar shard 3 na base, com a mesma requisição válida e seus 99 arquivos, em `ci-run-linux-sfa-3-enum`, somente após um dos dois workflows terminar.
3. Completar a lista de falhas de todos os três antes de qualquer correção.
4. Corrigir apenas causas comprovadas. Manter `runtime/application.ts` intacto. Não recriar console descomissionado, não alterar guards/timeouts nem falsificar baseline/coverage/digest/GO.
5. Mudanças compartilhadas fora do escopo devem ir a PR pequeno separado com `shared:` no título; integrador faz esse merge primeiro.
6. Registrar produtor sem dado requerido como `unbound`, com file:line. Atualizar este handoff com SHA e evidências finais.
