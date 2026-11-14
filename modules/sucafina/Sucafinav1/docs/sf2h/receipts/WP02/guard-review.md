# WP02 — revisão dos 11 WARN do Guardrail em W1

## Resultado

**Os 11 WARN estão em quatro arquivos herdados, fora dos 25 paths publicados pelo WP02 em W1. Os quatro blobs são idênticos no seed e em W1.** O propósito das dez dependências tem suporte nos manifests, no lock e nos consumidores reais identificados abaixo. O double cast é um achado real que continua pendente de correção pelo WP11; este parecer não o aprova nem o suprime.

O log registra `78 rules, 581 changed paths, 0 gate and 11 warn findings, 0 errors` para `bun run check:guards --base origin/dev`. Esse comando compara contra o merge-base de `origin/dev`, portanto inclui as mudanças acumuladas da stack. Não corresponde apenas ao delta WP02. O resultado de Guardrail não torna o job completo verde: o typecheck de W1 falhou separadamente.

Não houve execução local, alteração de produto, edição de regras, comentário de ignore ou aplicação de label de aprovação nesta revisão.

## Método e pins

- Skill aplicada integralmente: [.orchestra/skills/guardrail-usage/SKILL.md](https://github.com/gustavomhss/Orchestra-SF/blob/abe64592bb08858b55495b9f4710289bd357d64a/.orchestra/skills/guardrail-usage/SKILL.md), blob `c2333f8b46d780f6b52bba2ae9f6696e840d18a0`. A skill distingue WARN consultivo de GATE bloqueante e orienta corrigir o tipo ou estreitar o valor quando há double cast. Não exige aprovação para documentar WARN.
- W1 observado pelo checkout do job: `abe64592bb08858b55495b9f4710289bd357d64a`.
- Seed WP02: `855c17f66fd71964d88a63ca53fd90240159eb08`.
- Fonte do resultado: `inputs/ci-attempt1-checks.log`, SHA-256 `1582431a8bdc6812d23501c64508a163c19f3d240ef99f4a10ee785aa793d7c6`.
- Delta WP02 cruzado: `inputs/publish-manifest.json`, 25 paths, SHA-256 `e3b78da7e565f04b8a4250673ced28f6cce5413175a9e0e4818552cd13d58799`. Interseção com os quatro arquivos sinalizados: vazia.
- Ownership: [docs/sf2h-plan/ownership.json](https://github.com/gustavomhss/Orchestra-SF/blob/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan/ownership.json), pin `dbf9547211d9b0fade619790de7c19c0869b7c7d`, blob `843e41749fdca2a87160d2afba8c694dd4c395b9`; cópia em `inputs/ownership-plan.json`.

| Arquivo sinalizado | Quantidade | Blob no seed e em W1 | Owner segundo o manifesto pinado |
|---|---:|---|---|
| `apps/cli/package.json` | 1 | `b1385b685c2af5ae8f88d5962be87d3363f5085c` | Sem path exato/prefixo concedido. Encaminhar a S0/WP10, responsável pela composição, para alocação; não presumir lease para esse manifest. |
| `modules/atlas/boundary/package.json` | 3 | `6a5e7bddf5b9ea31dd0fb795f38be4fc98a231b7` | WP10, exceção exata de WP10.T07/S0-A. |
| `modules/sucafina/package.json` | 6 | `0fabcdd9148286629ba67bcbda4860783ab9c487` | WP10, arquivo existente exato. |
| `modules/sucafina/Sucafinav1/product/decisions/analysis-acceptance.ts` | 1 | `440fdb53772e871cadc2703bad991b1517120b89` | WP11, prefixo `product/decisions/`. |

## Dez dependências: identidade e propósito observados

Todas as referências de código nesta tabela apontam para W1. `workspace:*` resolve para pacotes internos com o mesmo nome declarado nos manifests. O [bun.lock](https://github.com/gustavomhss/Orchestra-SF/blob/abe64592bb08858b55495b9f4710289bd357d64a/bun.lock), blob `c190f0e6158ffff3a73fd0d84df72d3d1ba0b31f`, contém as dez resoluções; as cinco dependências de registry têm versão e integridade registradas. O setup do job concluiu a instalação de 2.953 pacotes, mas também registrou `Saved lockfile`: essa instalação não é prova de imutabilidade do lock publicado.

| WARN `dep-new-added` | Dependência declarada | Identidade/resolução e propósito comprovável |
|---|---|---|
| `apps/cli/package.json:37` | `@orchestra/llm`, `workspace:*` | Resolve para `packages/llm`, cujo manifest declara esse nome. [token-count.ts](https://github.com/gustavomhss/Orchestra-SF/blob/abe64592bb08858b55495b9f4710289bd357d64a/apps/cli/src/sucafina-product/token-count.ts) importa `InvalidRequestReason`, `LLMError` e o tipo `RequestExecutor` de `@orchestra/llm/route` para o controle de contagem/orçamento de tokens. |
| `modules/atlas/boundary/package.json:66` | `@orchestra/script`, `workspace:*` | Resolve para `packages/script`, cujo manifest declara esse nome. O [gerador Atlas](https://github.com/gustavomhss/Orchestra-SF/blob/abe64592bb08858b55495b9f4710289bd357d64a/modules/atlas/boundary/script/build.ts) importa `hits` de `@orchestra/script/spawn-imports` e o usa para recusar imports de spawn na entrada e no bundle de memória. |
| `modules/atlas/boundary/package.json:67` | `typescript`, `catalog:` → `5.8.2` | O mesmo gerador importa a API TypeScript e chama `createSourceFile` e predicados de AST para conferir imports, acesso dinâmico e exports da fronteira. Uso concreto no gerador; não apenas dependência de editor. |
| `modules/atlas/boundary/package.json:68` | `esbuild`, `0.25.12` | O gerador importa `build` no ramo `business-memory-ports`, empacota a entrada ESM para Node e aplica resolução explícita da aresta de scanner para o subpath canônico `native-memory`. |
| `modules/sucafina/package.json:17` | `@orchestra/core`, `workspace:*` | Resolve para `packages/core`. A [ponte MCP](https://github.com/gustavomhss/Orchestra-SF/blob/abe64592bb08858b55495b9f4710289bd357d64a/modules/sucafina/Sucafinav1/product/host-binding/sf-mcp-bridge.ts) consome o tipo `Mcp` de `@orchestra/core/mcp`; contratos de runtime também referenciam as portas nativas de Core. |
| `modules/sucafina/package.json:18` | `effect`, `catalog:` → `4.0.0-beta.83` | A ponte MCP importa `Effect` e chama `Effect.runPromise(mcp.config())`. O pacote integra o modelo de execução já usado pelas portas nativas; a versão vem do catálogo e está no lock. |
| `modules/sucafina/package.json:19` | `@modelcontextprotocol/sdk`, `1.32.0` | A ponte MCP importa `Client`, `Server`, `InMemoryTransport`, `CallToolRequestSchema` e `ListToolsRequestSchema` do nome exato declarado; cria o par de transportes e cliente/servidor. Há consumo concreto do SDK na ponte. |
| `modules/sucafina/package.json:20` | `@orchestra/atlas-boundary`, `workspace:*` | Resolve para `modules/atlas/boundary`. [atlas-memory.ts](https://github.com/gustavomhss/Orchestra-SF/blob/abe64592bb08858b55495b9f4710289bd357d64a/modules/sucafina/Sucafinav1/product/host-binding/atlas-memory.ts) importa `createMemoryEmit`, `createMemoryRead` e `versioned` de `business-memory-ports`, subpath publicado pelo manifest. |
| `modules/sucafina/package.json:21` | `@orchestra/rag-studio`, `workspace:*` | Resolve para `modules/rag-studio`, cujo manifest publica `.` e `./extract`. [rag-adapter.ts](https://github.com/gustavomhss/Orchestra-SF/blob/abe64592bb08858b55495b9f4710289bd357d64a/modules/sucafina/Sucafinav1/product/documents/rag-adapter.ts) usa `memoryStore`; [parser-worker.ts](https://github.com/gustavomhss/Orchestra-SF/blob/abe64592bb08858b55495b9f4710289bd357d64a/modules/sucafina/Sucafinav1/product/documents/parser-worker.ts) importa e chama `extract` do subpath. Consumidor documental: WP06; manifest de composição: WP10. |
| `modules/sucafina/package.json:22` | `unpdf`, `1.4.0` | `parser-worker.ts` importa `getDocumentProxy` e `getResolvedPDFJS`; inicializa PDF.js e abre os bytes do PDF. O manifest de RAG Studio também declara `unpdf` nessa versão. Consumidor documental: WP06; manifest de composição: WP10. |

Essas observações sustentam a justificativa das dependências na descrição da PR. Não foram introduzidas pelo delta WP02 e não foram removidas ou alteradas nesta revisão. Não se infere desses imports que a composição integrada já passou seus testes.

## Double cast: acompanhamento obrigatório do owner

**WARN `ts-double-cast` em `product/decisions/analysis-acceptance.ts:46`, owner WP11.**

No replay de um recibo de aceitação, o código verifica `id`, `incarnation`, `version` e se `ledger` é array; depois usa `(saved as unknown as DecisionCase).ledger.filter(...)`. O propósito observado é localizar o evento `analysis-accepted` correspondente ao run, caso, versão e principal, antes de compará-lo com o ledger canônico.

Essas verificações do contêiner não validam a estrutura de cada evento nem demonstram que `saved` é um `DecisionCase`. O cast, portanto, contorna a verificação de tipos exatamente como a regra descreve. O acompanhamento proposto ao WP11 é estreitar/validar os dados do recibo ou localizar o evento no objeto canônico já tipado, preservando os fences de versão/digest/autoridade. A implementação e sua contraprova devem ser feitas pelo owner; este parecer não declara correção, falso positivo ou exceção aceita.

## Texto conciso para a PR

> Guardrail de W1 executado contra `origin/dev`: 0 GATE, 11 WARN e 0 erros de execução. Os 11 WARN estão em quatro blobs idênticos ao seed, fora do delta WP02. As dez dependências têm resolução no lock e consumo concreto nos módulos de contagem de tokens, geração da fronteira Atlas, ponte MCP, memória e extração documental; os detalhes estão neste parecer. O double cast herdado em `analysis-acceptance.ts:46` permanece como correção do WP11. Não foram usados ignores, alterações de regras ou labels de aprovação. O typecheck do job é reportado separadamente e não é considerado verde por esse resultado de Guardrail.

## Confirmação no candidato final W2

O run [43516071214](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43516071214) examinou `38d340a8857b96904f7246320091c14c051f1929`: 78 regras, 584 paths contra origin/dev, 0 GATE, 11 WARN, 0 erros. Os quatro arquivos sinalizados não foram alterados entre W1 e W2; o parecer acima permanece aplicável. O typecheck final continua reprovado com 131 diagnósticos externos, registrados em [typecheck-blockers.json](typecheck-blockers.json).
