# HANDOFF-FINAL — missão26 / cobertura de typecheck E2E

**Estado: IMPLEMENTED_READY_FOR_INTEGRATION — COMPILER_NOT_RUN.**
A correção executável está publicada nesta branch; o compilador e o CI final não foram executados.
A sessão23 integra os seis arquivos de tooling/configuração. S0 conserva o despacho e o aceite finais.

## Identidades e autoridade

- Repositório: `gustavomhss/Orchestra-SF`; branch existente `astra-compose`; PR32.
- Pai reconciliado e preservado: `5c41125e7ef17a6c7eff9c9fb2329fe8f85ce982`;
  tree `49a2dbddfb6043b4131790bf11a33318864fae2f`.
- Handoff anterior: `docs/sf2h/receipts/final-ci-preparation/attempt-01/HANDOFF.md`.
- Missão e COMMON: `6da04cd66eb268362ee58509271fef773ac2a62e`.
- Planejamento e pack S0-C: `dbf9547211d9b0fade619790de7c19c0869b7c7d`.
  Pack completo, três apêndices, START/WORKFLOW/COMMON e AGENTS foram lidos pela equipe;
  hashes e limites em `reading-and-authority.json`.
- Snapshot inicial: `sf2-stack@9cc27888581a13b55992cdb5dfbd27e43479ac29`,
  tree `5a0f4aae93e4df629816982a36a0720754c4d3d9`.
- Antes da publicação, o bundle avançou três commits para
  `402a091485e11d60dff433049c7dedd7fcead687`, tree `006339cc3a61de9bf99d2ba17069181bd5d8a02e`.
  O compare completo contém 131 paths, quatro deles no grafo anterior, e nenhum dos seis
  arquivos de tooling. Os inputs, a admissão e o grafo foram reavaliados nesse snapshot;
  a reconciliação está em `consumer-freshness.json`. Não é C aceito.
- Os resultados abaixo usam esse segundo snapshot de fontes com o delta de tooling desta missão.
  O commit que contém este handoff identifica a entrega; a descrição da PR registra seu SHA real.
- Publicação por GitHub MCP, pai único e expected-head CAS, sem force ou merge.
  Esta missão não herda o lease antigo de dispatcher nem a escrita de `sf2-stack`.
  A escrita de produto desta missão termina com sua publicação; nenhuma retomada de Goal ou supervisor foi iniciada.

## Implementação para a sessão23

Consumir os postimages e preimages exatos de `intake-files.json`:

| Arquivo | Alteração |
| --- | --- |
| `packages/app-shell/tsconfig.sf-e2e.json` | Novo projeto estrito, sem emissão, com os três specs obrigatórios, todos os TS/TSX Sucafina, config de produção e reporter |
| `packages/app-shell/package.json` | Apenas acrescenta `typecheck:sf-e2e: tsgo -p tsconfig.sf-e2e.json` |
| `script/sf2h/final-bundle/verify-e2e-typecheck.mjs` | Inventário declarado e verificação da configuração/programa realmente emitidos pelo compilador |
| `script/sf2h/final-bundle/build-artifact.py` | Gera o job adicional obrigatório no workflow existente |
| `.github/workflows/sf2-epic.yml` | Job independente `sf-e2e-typecheck`, artifact e dependência no agregador |
| `script/sf2h/final-bundle/README.md` | Procedimento, alcance e limites atuais |

**Não integrar a árvore inteira desta branch antiga sobre o bundle novo.**
O package tem apenas uma chave nova de script; se seu owner avançar o manifesto, aplicar esse delta
sem perder outras mudanças. Os configs anteriores e todos os specs, helpers, assertions e
dependências permanecem inalterados nesta missão.

A causa era concreta: o check app incluía `src`; o config E2E anterior também não selecionava
`e2e/sucafina`. Os comandos anteriores foram preservados. O novo config herda o app,
mantém strictness/resolução, desativa composite para aceitar os imports reais fora dos roots,
define `rootDir` como a raiz do repositório e usa `noEmit`.
Não foram acrescentados ignores, tipos permissivos ou exclusões.

O conjunto amplo Sucafina inclui helpers iniciados por strings, em particular
`wp03/installation-setup.ts`, `wp04/host.ts` e `reports-support/production-state.ts`.
O reporter `e2e/utils/flaky-reporter.ts`, também iniciado por caminho textual, recebe include explícito.
O helper `wp00/prepare-installation.ts` entra no mesmo glob.
As entradas reais `local/prepare.ts`, `local/enroll.ts` e `local/entry.ts` seguem no
`local/**/*.ts` do typecheck SF; `apps/cli/src/index.ts` segue no projeto CLI retido.

## Cobertura e seleção: o que foi observado

No snapshot fixo `402a091`:

- **47 roots declarados:** 45 arquivos TypeScript da árvore Sucafina, config de produção e reporter.
  Lista completa e hashes em `declared-inputs.json`.
  O novo `operations-support/installation.ts` entra no glob existente e também é importado
  por `wp04/host.ts`; não foi necessário ampliar ou relaxar a configuração.
- Os três specs contêm **13 declarações nominais**: Operations 5, Decisions 4 e Reports 4.
  Títulos e blobs estão em `nominal-selection.json`. É leitura de fonte, não coleta Playwright.
- **Oito requests admitidas** pelo resolver/validator reais, com os 35 manifests do registry disponíveis.
  `request-preflight.json` contém os resultados normalizados e hashes;
  `request-inputs.json` identifica todos os inputs usados nessa admissão.
- O grafo lexical conservador possui **1.399 arquivos de fonte e 8.707 arestas**, com quatro arestas
  de helpers iniciados por string registradas separadamente. `source-files.json` identifica
  1.412 blobs de fontes/metadados; todos foram rechecados contra seus Git hashes, sem divergência.
  `static-graph.json` preserva todas as arestas por índice de nó, com legenda de colunas.
- Há uma resolução que depende da instalação:
  `operations-support/imports.ts → modules/sucafina/node_modules/exceljs`.
  É pendência de resolução pelo compilador instalado, não diagnóstico TypeScript inventado.

**O grafo lexical não é o programa do compilador.** Ele trata exports condicionais como união conservadora.
Não há contagem fictícia de arquivos compilados: `compiler_files=[]` e `compiler_status=NOT_RUN`
no inventário desta missão. O manifesto efetivamente compilado será produzido pelo gate no executor de S0.

## Gate executável e falha fechada

O job novo roda independentemente de `sf-static`, de modo que um erro herdado em outro pacote
não impeça sua tentativa. Em `packages/app-shell`:

```bash
bun run typecheck:sf-e2e --showConfig
bun run typecheck:sf-e2e --listFiles --pretty false
```

O workflow captura os dois exit codes, separa stderr do JSON efetivo, preserva o log integral e
chama o verificador. Este exige todos os roots no `showConfig` e no `--listFiles`,
programa não vazio, opções estritas, identidades de candidato/tree e hashes dos arquivos;
registra também run/attempt.
Erro do compilador, entrada ausente, omissão ou evidência ausente falha. O shell também falha
diretamente por qualquer código não zero, independentemente do verificador.
Não há testes-wrapper nem execução de testes no script de verificação.

O artifact `sf-e2e-typecheck-<C>-<attempt>` é enviado mesmo em falha, com
`effective-config.json`, `config.stderr.log`, `typecheck.log`, `bun-version.txt`
e `inclusion.json`. O último contém a lista emitida pelo compilador, diagnósticos e hashes.

## Verificações desta entrega

| Verificação | Resultado |
| --- | --- |
| Regeração canônica e builder `--check` | MATCH |
| YAML, sintaxe dos 63 blocos Bash, parser Python e sintaxe Node do novo script | PASS |
| Comparação estrutural de todos os jobs anteriores | PASS: oito jobs intactos; agregador só ganha a dependência nova |
| Cinco checks de packages e oito recipes | Preservados |
| Delta de package/dependências e configs anteriores | Só um script adicionado; nenhum outro campo/config alterado |
| Inventário dos inputs no snapshot com delta | INPUTS_PRESENT_COMPILER_NOT_RUN; 47 roots |
| Admissão real das requests | 8 VALID / 0 BLOCKED; execução NOT_RUN |
| Conferência de Git blobs da inspeção de fontes | 1.412 iguais / 0 divergências |
| Patch externo completo, `git apply --check` no preimage antigo | PASS histórico; superado pelo produto atual; não aplicar |
| Revisão independente estática | PASS limitado ao tooling e refresh de escopo; omissão inicial do reporter corrigida |
| Bun/typechecks/showConfig/listFiles reais | NOT_RUN: Bun e dependências instaladas indisponíveis |
| actionlint | NOT_RUN: indisponível |
| Geração Atlas, guards e spawn gate | NOT_RUN; continuam obrigatórios |
| Coleta/execução Playwright, testes locais/hosted, epic, AM01–AM06 | NOT_RUN |

O workflow gerado tem SHA256
`5c87488dbb717ad4e5a410aa69cc0cb15264465512d8546838497c2ae58301b8`, 54.846 bytes.
Os cinco comandos `bun typecheck` continuam nos packages Atlas, SF, Core, CLI e app.
Oito seleções finais, E2E completo e suites herdadas, generation/check:generated,
Omni, guards e spawn gate continuam obrigatórios.
Os recibos `validation.json`, `workflow-preservation.json` e `review.json` delimitam cada afirmação.
`command-results.json` mapeia cada um dos cinco comandos de package e os dois comandos E2E
a seu diretório, script e resultado NOT_RUN, sem exit code ou diagnósticos inventados.

## Diagnósticos e patch fora da fronteira

Nenhum diagnóstico do compilador foi produzido nesta missão, porque ele não foi executado.
Isso não afirma zero erros. O FAIL histórico de Check15, citado no predecessor da PR32
(run `43604348151`, 14 diagnósticos SF naquele snapshot), permanece histórico e não foi
requalificado ou dispensado. Ver `diagnostics-and-pending.json`.

A inspeção inicial encontrou um pré-requisito funcional fora dos paths autorizados:
o seletor WP04 não reconhecia o nominal Operations. O blob antigo
`7224825eb470a2f172e7dc32172f83a6b05a5787` foi confirmado no snapshot `9cc2788`
e no owner `astra-wp04@49d29bf4d6512d130307f46e145885949f213ea8`.
Antes da publicação, o bundle `402a091` incorporou uma correção própria, blob
`1bfa058531fc84f012dcb8b601d471abd8fa0aad`: ambos os filenames, inclusive a forma
ancorada em `$`, são reconhecidos. Estado: **SUPERSEDED_BY_CURRENT_SOURCE**.

A entrega conserva o **patch completo e postimage completo históricos**, sem escrever no arquivo do owner:

- `owner-patches/operations-host-selection.patch`;
- `owner-patches/selection.ts.txt`;
- `owner-patches/manifest.json`, com preimage, hashes, rota ao owner e validação exigida.

**Não aplicar esse patch ao bundle atual.** Ele documenta o achado inicial e seu preimage;
a correção já presente no produto deve ser preservada. A inspeção do seletor e da montagem
não comprova execução dos cinco E2Es nem resolve automaticamente dados/contratos/consumidores
da fixture. Prova funcional continua com o source owner e S0.

O host atual lê `SF_OPERATIONS_CLAMD_PORT` e exige um serviço ClamD real previamente aprovado.
Sem endpoint, o scanner recusa a admissão. O workflow inspecionado não declara esse ambiente
ou serviço; a prontidão real do executor e eventuais composite actions não foram avaliadas.
É um pré-requisito ambiental pendente de S0/owner, não diagnóstico de compilador nem falha
observada de E2E. Nenhum serviço foi provisionado por esta missão. Fontes e blobs estão em
`diagnostics-and-pending.json`.

## Próxima ação concreta

1. **Sessão23:** aplicar os seis postimages de `intake-files.json` sobre o bundle atual,
   preservando os novos produtores/specs/helpers. Reconciliar a chave de package, sem merge integral desta branch.
2. Na árvore realmente composta, executar os preflights estáticos:
   `build-artifact.py --repo-root . --check`, `validate-requests.mjs` e
   `verify-e2e-typecheck.mjs --inventory`.
3. **S0:** obter o resultado real dos cinco package checks e do novo check E2E em executor autorizado.
   Sem interface/handoff vigente, manter NOT_RUN e usar os comandos concretos acima;
   não transformar uma request de teste em wrapper de typecheck nem mover uma check-ref alheia.
4. Para cada erro real, preservar log/local/TS-code/SHA e encaminhar ao source owner.
   Corrigir tooling desta frente; para fontes externas, usar patch completo revisado sobre o blob atual.
5. S0 congela C, deduplica e despacha o bundle final somente quando a composição estiver pronta.
   Os oito recipes, gates herdados, seis AMs e três pareceres ainda pertencem ao aceite global.

Esta alteração de configuração/workflow é input de produto anterior a C.
O namespace `receipts/typecheck-e2e-gate-closure/` não é automaticamente admitido no envelope final D.
Não há declaração de C aceito, D válido, G7/G8 ou GLOBAL_RELEASE.
