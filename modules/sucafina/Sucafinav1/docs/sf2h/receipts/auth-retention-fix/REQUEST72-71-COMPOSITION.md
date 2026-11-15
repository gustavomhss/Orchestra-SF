# Solicitação72 → 71: qualificação cirúrgica da composição

**Status: NOT_DISPATCHED.** Nenhum run ou commit de runner foi criado para esta solicitação. O metadata completo está em `composition/REQUEST-COMPOSED71.json`; o payload puro da interface existente está em `composition/composed-ci-request.json`.

A seleção tem **14 arquivos explícitos**. Ela repete os 24 casos fonte72 sobre o LocalStore composto, os casos existentes de sessão Microsoft e os testes diretamente relacionados a readonly59 e à instalação Microsoft. Não há filtro, aumento de timeout ou seleção ampla do pacote.

## Seleção exata

Todos os paths são relativos a `modules/sucafina/`.

| Arquivo Bun | Cobertura pretendida |
| --- | --- |
| `Sucafinav1/test/product/auth-retention-fix/unknown-handles.test.ts` | Handles nunca emitidos e idempotência de logout |
| `Sucafinav1/test/product/auth-retention-fix/retention.test.ts` | Expiração absoluta, correlação consumida e limites de coleta |
| `Sucafinav1/test/product/auth-retention-fix/capacity.test.ts` | Quotas partilhadas, bytes, refresh e backlog legado |
| `Sucafinav1/test/product/auth-retention-fix/races.test.ts` | Callbacks, refresh, Graph, duas instâncias, restart e CR72-01 |
| `Sucafinav1/test/product/auth-retention-fix/maintenance.test.ts` | Ciclo de vida independente de tráfego e dispose |
| `Sucafinav1/test/microsoft-session.test.ts` | Regressões existentes de sessão Microsoft, criptografia e corridas |
| `Sucafinav1/test/product/runtime-readonly-root/runtime.test.ts` | Contrato da raiz readonly e proibição de escritas/nested scopes |
| `Sucafinav1/test/product/runtime-readonly-root/wrappers.test.ts` | Wrappers canônicos Source/CurrentChoice |
| `Sucafinav1/test/product/runtime-readonly-root/freshness.test.ts` | Frescor SQL e isolamento de observações |
| `Sucafinav1/test/product/runtime-readonly-root/cost.test.ts` | Custo do caminho canônico readonly59 |
| `Sucafinav1/test/product/auth-retention-fix/readonly-composed.test.ts` | Dois casos novos: Graph/logout enfileirado; manutenção aninhada envenena a raiz |
| `Sucafinav1/test/microsoft-composition.test.ts` | Quatro testes da instalação, loader CLI, bootstrap, rotas e privacidade |
| `Sucafinav1/test/microsoft-node.test.ts` | Dois testes de preflight serve e ingresso HTTP pelo adaptador Node |
| `Sucafinav1/test/microsoft-routes.test.ts` | Cinco testes de autenticação/grants/logout nas rotas reais |

Os outros arquivos existentes da qualificação fonte R1 não são repetidos por esta proposta, na ausência de novas alterações materiais que justifiquem sua inclusão.

`microsoft-node.test.ts` importa `bun:test`, usa APIs Bun e resolve o adaptador `@effect/platform-node` existente da CLI. Todos os arquivos desta seleção usam **runner bun**. O runner `node` da interface existente aceita somente `*.node-smoke.mjs`; não há requisição Node separada necessária e não se deve enviar esse `.test.ts` ao runner Node. Esta seleção não deve ser apresentada como execução pelo binário Node.

## Pré-condições do snapshot de 71

1. Instalar o pacote readonly59 completo preservando seus quatro arquivos de produto, suas quatro suítes e `canonical-fixture.ts`.
2. Compor a fonte72 sobre o store com readonly59, preservando as quatro alterações de readonly59. Instalar a fixture própria72 e materializar os dois testes inertes em `test/product/auth-retention-fix/readonly-composed.test.ts`.
3. Reconciliar a fixture Microsoft49 com o mapa dos **bytes canônicos efetivamente instalados**, mantendo todos os fences do manifesto49 e dos arquivos arquivados de pre/post.
4. Se missão74 ou outra contribuição mudar qualquer um dos três arquivos abaixo, regenerar o mapa antes da seleção. Não reutilizar os hashes do mapa72 calculado sobre os bytes anteriores.

Os três canônicos conferidos pelo mapa são:

- `modules/sucafina/Sucafinav1/local/entry.ts`
- `apps/cli/src/sucafina-product/installation.ts`
- `apps/cli/src/commands/handlers/serve.ts`

O helper `build-map72.py` entregue originalmente recebe apenas o entry novo e assume os dois arquivos CLI de C28. Essa hipótese só é válida se os dois arquivos CLI continuarem byte-idênticos aos preimages registrados. Caso74 altere um deles, 71 deve regenerar também seus hashes e pre/post contra os bytes instalados; executar cegamente o helper antigo não qualifica a composição.

O ponteiro proposto da fixture permanece `docs/sf2h/receipts/auth-retention-fix/composition/microsoft49-composition.json`. O mapa deve registrar corretamente o target/base utilizado por 71, além de atualizar `postimage_blob` e `postimage_sha256` dos três canônicos. Preservar a linhagem e os fences do release49; não enfraquecer a fixture.

## Interface de execução existente

O payload usa `package=sucafina`, `packageSelector=packages/sucafina`, `directory=modules/sucafina`, `runner=bun`, `env={}` e os 14 arquivos explícitos. O `--timeout 120000` é o padrão existente, sem aumento. Não há glob, diretório de testes ou filtro por nome.

Depois de reconciliar e revisar W, 71 deve usar a coordenação/deduplicação da lane existente, criar S cujo pai é esse W e cujo único delta é `.ci-run.json`, e registrar run/job/logs/nonce/cleanup reais. Esta proposta não solicita novo workflow nem compilador fora da autoridade45.

Nenhuma execução desta composição foi feita pela missão72. A qualificação de fonte R1 permanece separada; a solicitação não atribui PASS à composição ou à aceitação FINAL.
