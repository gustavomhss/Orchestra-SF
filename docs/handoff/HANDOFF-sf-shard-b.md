# HANDOFF — sf-shard-b

## SHA e estado

- Estado: **PARTIAL — enumeração em execução; nenhum resultado de produto declarado.**
- Base imutável: `f7dd58e32bc834f1485df20b91adbf759b4c4ad0` (`sf-join-four`).
- Branch de trabalho: `sf-shard-b`.
- Escopo: CI-SF, shards 4, 5 e 6 de 8; somente GitHub; verificação por Actions.
- Esta atualização é documental; não contém correção de produto.
- Não foi executado `sf-ci`.

## Por shard

| Shard | Run | SHA testado | N pass / M fail | Estado |
| --- | --- | --- | --- | --- |
| 4 | [44645900692](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44645900692) | `dd45d888617943df40e02815d58b59f88d8a18f7` | ainda indisponível | Run tests em andamento |
| 5 | [44645913808](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44645913808) | `f0bccdc48b42a9d000f3bda6565fa3d88286c845` | ainda indisponível | Run tests em andamento |
| 6 | ainda não iniciado | pedido preparado: `204a74491764dcde4da22ebe558efc318e04a777` | ainda indisponível | aguarda uma das duas vagas |

## Feito e justificativas

1. Criada a branch de trabalho exatamente na base solicitada.
2. Lidos AGENTS.md, contrato do runner, manifesto e seletor canônico.
3. Calculada a seleção a partir da árvore completa `modules/sucafina` (`e5f72dac9b060a2b371e0ec77b8f5fe957b02836`, sem truncamento ou symlinks): 924 testes, menos 40 arquivos do harness ordenado e 1 release-only, resultando em 883 arquivos. Partição independente conferida por outro agente.
4. Shards 4/5/6: 118 / 119 / 109 arquivos, respectivamente. Nenhum arquivo removido das seleções.
5. Receita adaptada ao contrato presente na base:
   - `.github/workflows/test-ci.yml:30-37` exige `ci-run-linux-*`.
   - `script/test-ci-request.ts:96-98` exige `args`.
   - `script/test-ci-request.ts:12-15,133-140` e `.github/workflows/test-ci.yml:144-159` não admitem as três variáveis `SF_*`.
   - `script/test-ci-package.ts:21-35` resolve o alias `sucafina`, não o caminho `modules/sucafina`.
   - O runner genérico não chama `gate.mjs select`; por isso os pedidos usam os caminhos exatos da partição canônica em `args`, timeout 30000 e Omni=1.
6. `runtime/application.ts:76-81,91-95,382` foi somente lido: respostas HTML legadas permanecem descomissionadas, inclusive `?page=` e HTML do Workbench.

## Incidentes de admissão — zero testes de produto

- Runs 44645786965 e 44645800154 foram disparados na criação das branches no SHA base antes de existir `.ci-run.json`; falharam com ENOENT no passo Read request.
- Runs 44645789826 e 44645801987 receberam os arquivos exatos, mas falharam com `TEST_PACKAGE_NOT_FOUND:modules/sucafina` em `script/test-ci-package.ts:35`.
- As quatro execuções terminaram sem executar testes. Elas não são contadas como falhas de produto.
- Houve sobreposição transitória desses runs de admissão acima do limite de dois; não se declara cumprimento retroativo desse limite.
- Correção de publicação: criar árvore e commit completos via Git Data API ANTES de criar a ref `ci-run-linux-*`. Cada novo pedido passa a disparar somente um workflow. Pedidos seguintes usam o alias registrado e no máximo duas execuções ativas.
- Nenhum gate idêntico foi repetido; os pedidos atuais corrigem o seletor de pacote.

## Limite da evidência

São execuções cirúrgicas de todos os arquivos dos shards, no Actions. O `test-ci` não produz o recibo completo de `sf-ci`, não executa sua verificação de cobertura e usa Omni no escopo `declared` para seleções explícitas. Não há alegação de baseline, coverage, digest de execução ou GO. Os hashes de seleção são cálculos de inventário, não recibos.

## Pendente / como retomar

1. Aguardar os runs 44645900692 e 44645913808; extrair contagens e TODAS as falhas com arquivo e linha dos logs finais.
2. Quando houver vaga, criar somente a branch `ci-run-linux-sfb-6` apontando ao commit já preparado `204a74491764dcde4da22ebe558efc318e04a777`.
3. Concluir a enumeração dos três shards antes de corrigir produto/testes.
4. Agrupar falhas por causa, preservar asserções de negócio, separar código compartilhado em PR com título `shared:`, e registrar ordem de merge.
5. Atualizar este documento com causas, commits e gates; classificar qualquer falha restante sem mascarar testes.

## Ordem de merge

Ainda não há correções ou dependências compartilhadas a integrar. Não integrar como resultado verde.
