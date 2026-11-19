# Handoff — finish-importhealth-20261119

SHA de código: ccc45d4ecedaae152ad5bbcb49c409f7ee4add1e
Data: 2026-11-19
Estado: partial

## Feito
- `apps/cli/src/sucafina-product/native-ui/import-health.ts:16`: observador das seis operações de importação já publicadas. Confere registry/método/query, produtor realmente montado, mesmas instâncias de serviço/handler/persistência, descriptor original sf_import_preview e identidade do Request.
- Readiness exige admissão/validação sf_import_preview, stamp original, C08 documents em modo read/write correspondente e dupla leitura consistente. Apply também observa receipts/write, pois store.ts:22–35 atualiza ambos atomicamente.
- As ações humanas imports.admit/imports.apply são verificadas antes e depois das leituras; o produtor continua responsável por target, conteúdo, scanner, CAS e autorização na execução.
- `apps/cli/src/sucafina-product/host-context.ts`: callback liga somente o importHttp/service existentes e Assets da mesma persistência. `modules/sucafina/Sucafinav1/product/contracts/host-context.ts`: seis IDs acrescentados ao contrato privado de observação de binding.
- Sem alteração de registry305, grants, frozen baseline, live-context, schema de payload ou runtime/application.ts. Nenhum arquivo é admitido e nenhum comando é executado pelo observador.
- Fonte conferida: import-services.ts:26–158; product/interface/import-http.ts (todas as rotas/ações), imports/host.ts, store.ts e staged-files.ts. O scanner real continua chamado por staged-files.ts:56 para os bytes reais.

## Pendente
- `apps/cli/src/sucafina-product/native-ui/import-health.ts:16`: código ainda sem typecheck/gate; compor com os outros fixes causais de Operations6 e executar operations.spec.ts com ClamD real.
- `packages/app-shell/e2e/sucafina/operations-support/imports.ts:167`: UI55 não montou no run44619924653 porque files.import-targets estava unavailable/operationalfalse. O próximo gate deve provar a ligação e o fluxo completo, não só o botão.
- `apps/cli/src/sucafina-product/host-context.ts:969`: compor os hunks deste observer com UI38/documents do WP5; não substituir o arquivo inteiro de uma branch antiga.
- Assets/documents e exports têm observadores diferentes; este checkpoint não qualifica essas famílias.

## Decisões e justificativas
- Asserções removidas: nenhuma. Inputs/valores, seis linhas do XLSX, 72000→84000, 518000 inalterado, CAS e recuperação read-only continuam no spec.
- A disponibilidade observada é de infraestrutura do produtor com autoridade atual. Ela não certifica um arquivo como seguro nem a mutação como aplicada. ClamD/target/confirm/receipt são aferidos na operação original.
- O grant sf_import_preview já está na política original do fixture Operations (operations-support/installation.ts:73–77); nenhum grant novo foi fabricado.
- Apply não é disparado pelo probe. A UI precisa conservar a leitura privada do manifesto e a ação humana original; C08 é lido sem commit.
- O catálogo live-context já contém os seis IDs; a causa era ausência de observação operacional, não um nome de operação ausente.

## Como retomar
1. Base composta b75cd49fc53701209c116511fc6643693b09c2d7; aplicar somente os três arquivos/hunks do código dfbc0ce6c61226a17bf3042c7587944a33f6c57b. Preservar os observers de UI38/C12/UI54.
2. Compor o restante das causas observadas em Operations6, preparar .ci-run.json package app, runner playwright, config e2e/playwright.production.config.ts, args ["e2e/sucafina/operations.spec.ts"].
3. O nome exato do spec ativa o ClamD real do workflow. Registrar run e resultado terminal; não alegar sucesso antes dele.

## Comandos e resultados
- Operations6 [44619924653](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44619924653): FAILURE, 1 pass/4 fail. CLI/app/SF-E2E types e ClamD SUCCESS; cleanup135903491809 SUCCESS. Snapshotca3727278c379646a7dc7a91e13940ab53b849c9.
- Auditoria de DOM [44621812706](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44621812706): SUCCESS; apenas artifact original14577090913. UI55 ausente, status route not admitted.
- Auditoria de trace [44622222711](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44622222711): SUCCESS; últimos contexts originais200/ok marcam files.import-targets e outras files.* unavailable/operationalfalse. Doc em audit-opscontext-20261119/docs/handoff/observed-opscontext-44619924653.md.
- `bun run typecheck`, `bun run check:guards --base origin/dev` e gate deste checkpoint: não executados.

- Cold review independente do ci_resume emdfbc0ce: não encontrou defeito no binding/grants/C08/fences. A lacuna de scanner foi fechada neste checkpoint: só files.import-admit observa scan original com bytesvazios antes de readiness. runtime/local-scanner.ts:4–6 não rejeita vazio; :35–49 envia INSTREAM completo e :9/22–31 aceita somente stream: OK\\0. Nenhum asset/recibo é criado; bytes reais continuam escaneados separadamente em staged-files.ts:56. Falha/ausência do scanner mantém admissão unavailable; leituras e Apply de arquivo já admitido não dependem desse probe.
