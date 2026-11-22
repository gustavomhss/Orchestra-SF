# Jornadas nativas instaladas de G08 — F04, U15, U39 e U40

Esta rota recupera as jornadas completas da fonte original `687759276c2c9121c2cfd20a5994b277ceb7ee4d` e aplica a mudança de contrato Teams exigida pelo plano `736a5087c223629be4d73c8a4535d615fcafd96a`. O registro, o typecheck, a listagem e os controles deste executor são preparação. Nenhum deles, nem um arquivo preenchido manualmente, comprova uma execução LIVE.

## Inventário preservado e execução separada

| Grupo | Obrigações | Executor | Estado desta entrega |
| --- | ---: | --- | --- |
| U15 | 6 | Playwright / CAP14, contextos originais via CDP | Implementado; execução instalada pendente |
| U39 | 22 | Playwright / CAP04 OPEX | Implementado; execução instalada pendente |
| U40 | 22 | Playwright / CAP05 CAPEX | Implementado; execução instalada pendente |
| F04 | 3 | Bun + HappyDOM, sem CDP | Implementado; execução instalada pendente |

Os títulos e a ordem das 50 jornadas estão em `case-contract.ts`. Somente o título do cenário de troca tardia foi atualizado de project para Team, conservando seu oráculo. U15 registra cinco seleções para seus seis casos. Cada suíte Budget registra **oito**: entry, empty, source, readonly, denied, revoked, stale e late. `nativeSelectedCase` propaga o caso exato para o harness; títulos desconhecidos falham.

U15 conserva leitura, edição com CAS, ator negado, segundo escritor original/409, resposta perdida e acessibilidade. Não acrescenta anexos. U39/U40 conservam todos os contratos originais de CRUD, mensal, anual, year amount, desvio, navegação, fonte, vazio, readonly, recusa, revogação, concorrência, validação, submitting, resultado incerto, troca tardia, acessibilidade e valores originais sem cálculos adicionais.

## Fontes, escopo e composição

A composição de preparação começa em dev `2fdc76d8b40cd62c2da4967a5b9533411af308df`, incluindo os hooks originais de #690/#688. Os helpers compartilhados e seus controles foram relidos em Migração `0001792ae7bb072f515b09af3c52b121cfa98108`. A branch da Migração não é movida por esta entrega. A configuração mantém o modo Decisions novo dessa fonte e acrescenta um modo native independente.

O transporte/UI consome os adapters originais de #681/#683; não define CRUD, ator ou autenticação substitutos. As rotas públicas conservam `/orchestra/sf-procurement/contracts`, `/orchestra/sf-dashboard/opex` e `/orchestra/sf-dashboard/capex`, com a query fechada `contractRevision, server, installationId, tenantId, teamObjectId`. CAP04/CAP05 incluem ano canônico 2024–2027; os casos originais usam 2026. CAP14 não aceita year. projectId e hostId são somente proveniência técnica.

Leituras usam os readers originais `/<mount>/api/ui/pages/CAP14|CAP04|CAP05` e o selector `x-sf-team-profile`; comandos usam `/<mount>/teams/<id>/dashboard`, incluindo fixedQuery e body originais. A fonte é validada pelo schema original, e owner/principal/revisões são comparados com F02 atual antes e depois do I/O.

**Dependência concreta do cenário source:** as duas suítes Budget exigem o destino autorizado CAP03 e o clique original “View source” para `/orchestra/sf-dashboard/budget`, mantendo Team e year=2026. O bridge inicial de três CAPs não entregava CAP03. O cenário foi preservado e falha fechado enquanto a composição do candidato não entregar esse destino. Um link fabricado, um fallback projectId ou a exclusão do caso não resolvem a obrigação.

## Pré-requisitos do host

A execução requer a reserva isolada autorizada, os dois Teams, quatro contextos Microsoft já autenticados, dados originais e o tar G07 instalado no mesmo C/T. O checkout do workflow, o recibo G07, a factory, o processo real e a reserva devem concordar.

Cada invocação usa uma raiz privada diferente, real, pertencente ao UID do runner, mode0700; arquivos regulares privados mode0600, sem links. Os dados do plano e do registro ficam no host. Não publicar CDP, cookies, tokens, URLs privadas, GUIDs de atores, corpos do produto, relatório JSON bruto, screenshots, vídeo, traces, mensagens brutas de erro ou valores financeiros em artefatos públicos.

O plano original `sf-g08-private-plan-v1`, o recibo de pacote e o observador original `g08-installed-preflight.py` continuam obrigatórios. `readNativeInstalledHost` reutiliza seus validadores e observa novamente Linux x64: PID, start ticks, boot, UID não-root, unidade systemd, executável em C, argv da factory e bytes da factory. Não instala, reinicia ou altera serviços. Depois, o browser confirma peer HTTPS443/IP da reserva e rejeita Service Worker/redirect. O CDP apenas se anexa ao browser existente; caches e SW são bypassados nas páginas de teste. Não há launch, newContext, storageState ou cópia de autenticação.

As variáveis SF_G08 de pin/invocação exigidas pelo plano e as SF_NATIVE abaixo devem derivar da mesma invocação observada:

- `SF_NATIVE_CANDIDATE_SHA`: C do plano, igual ao checkout efetivo.
- `SF_NATIVE_INVOCATION_ID`: nonce32hex da invocação.
- `SF_NATIVE_INSTALLED_MANIFEST`: arquivo privado produzido pelo registro.
- `SF_NATIVE_BROWSER_ENDPOINT_FILE`: descriptor CDP loopback privado, do host autorizado.
- `SF_NATIVE_PRIVATE_REPORT`: exatamente `<raiz>/native-playwright.json`.
- U15: as cinco URLs retornadas por `u15RegisteredEnvironment`, passadas no ambiente privado antes da importação da suíte.

`GITHUB_RUN_ID`, tentativa, C/T, digest do tar, host e reserva são revalidados; metadata não concede acesso.

## Registro e seleção por caso

`registerInstalledProofFromHost` é uma função de host, não uma CLI que aceite “PASS”. Seu adapter `ApprovedInstalledHost` deve oferecer o registro original de conexão aprovada, páginas dos quatro contextos existentes, resultado original F01 e um ID atualmente observado no produtor/UI. O consumidor confere esses resultados com a UI real, o resolver original, F02, principal, disponibilidade e leitura independente. Sem esse adapter original e os contextos existentes, o registro é bloqueado. A interface não autoriza login ou dados sintéticos.

O registro produz:

1. `sf2h.native-installed-manifest.v2`, preservando o writer/reader v2 da Migração.
2. `sf2h.native-context-observations.v2`, contextos F02 realmente observados, privados; o requester é usado somente como entrada histórica do negativo zero-network F04.
3. `sf2h.native-selected-installation.v2`, com C, invocation completo, hash do manifest e todas as seleções.

A invocation inclui treeSha, runId, runAttempt, role, invocationId e archiveSha256. Cada seleção inclui caso, ator, target completo, URL/route F01 original, principal observador, intenção, stamp F02 e ref/CAS original. Valores serializados não substituem as leituras atuais. `consumeInstalledSuiteFromHost` e a fixture repetem F01/F02/source para cada escolha.

### Vazio real e isolamento

DashboardBudget.view projeta a coleção autorizada completa; duas identidades diferentes não tornam uma coleção povoada vazia por si. Por isso somente `empty` seleciona a **Team B realmente autorizada na mesma reserva/C/T/tar/host**. A leitura original deve retornar zero rows, no registro e no consumo. Não se apaga, filtra ou fabrica dado. A Team A dos demais casos permanece explícita. No caso B, wrongTeam aponta para A; um owner nunca pode ser seu próprio negativo.

Estar autorizado em B não permite transportar draft/intent de A. O cenário late segura a resposta original de A, troca a escolha completa e exige que o dado privado anterior desapareça. O seam filtra o selector original e exclui requests do observador: o GET legítimo de B não satisfaz o contador de A.

### Readonly, revogação e segundo escritor

Readonly é selecionado por F02 atual com leitura e sem ações de mutação. Não é promovido a edit pelo nome de um ator nem por um botão. Denied usa seu principal original, com a rota observada separadamente por um principal autorizado; nunca reutiliza o requester como ator negado.

O callback de revogação usa o endpoint administrativo Teams original e a revisão CAS corrente para desabilitar somente a Team reservada. Ele exige admissão administrativa real; o nome dashboardAdmin não concede essa permissão. F02 e a UI reobservam a recusa e o descarte. No teardown, uma restauração original enable é feita apenas com a revisão efetivamente pertencente à operação, e catálogo, configuração e acesso são relidos. Resultado incerto ou mudança concorrente impedem cleanup positivo.

O callback de concorrência escolhe outro contexto/principal original, confirma o mesmo ref/CAS e edita pela folha nativa original. Observa o POST real e sua resposta, relê a versão avançada e restaura apenas a mudança própria, com CAS e observação independente. Os casos não recebem `committed:true` de um manifesto manual.

O cleanup registra somente páginas próprias e mudanças dos callbacks. Os casos originais podem deixar resultados de mutações cuja resposta foi perdida; o descarte seguro do dataset reservado continua obrigação explícita do host. Não se faz compensação automática de intenção incerta.

## Comandos originais após admissão

Executar cada suíte separadamente, dentro de `packages/app-shell`, com o ambiente privado já registrado. A raiz do relatório deve ser0700 e o shell deve usar umask077.

```sh
bunx --no-install playwright test --config e2e/playwright.production.config.ts e2e/sucafina/native/journeys/u15.spec.ts --workers=1 --retries=0 --repeat-each=1 --reporter=json
bunx --no-install playwright test --config e2e/playwright.production.config.ts e2e/sucafina/native/journeys/u39.spec.ts --workers=1 --retries=0 --repeat-each=1 --reporter=json
bunx --no-install playwright test --config e2e/playwright.production.config.ts e2e/sucafina/native/journeys/u40.spec.ts --workers=1 --retries=0 --repeat-each=1 --reporter=json
```

O modo native não inicia webServer, build ou fixture local; workers1/retries0/repeat1, sem traces/video/screenshots. `--list` é inerte e não exige manifesto nem browser. Não misturar native com Operations/Decisions na mesma invocação. Para execução, a configuração fixa também PLAYWRIGHT_JSON_OUTPUT_FILE no arquivo privado, inclusive quando o comando usa --reporter=json; um destino divergente ou only-failures é recusado. Essa variável é o contrato documentado do [JSON reporter original](https://playwright.dev/docs/test-reporters#json-reporter).

F04 permanece um processo Bun/HappyDOM separado, sem CDP, com CI/GITHUB_ACTIONS, controle Omni declared/strict e nonce novo:

```sh
bun test --conditions=browser --preload ../../script/test-omni-control.ts --preload ./happydom.ts --reporter=junit --reporter-outfile "$SF_G08_PRIVATE_ROOT/f04.junit.xml" ./test-browser/sucafina-native/transport-integration.test.ts
```

O wrapper autorizado deve manter stdout/stderr em `f04.log`, preservar o exit code real em `f04-exit-code.txt`, executar o observador original antes e depois, conferir checkout limpo e só então analisar os arquivos. Não copiar cookie para esse fetch Bun: guest é realmente não autenticado. Malformed cobre duplicate/partial/mixed/legacy. O terceiro caso usa o client Team canônico e exige contract-mismatch, um generation check e zero chamadas de rede.

## Recibos e limites da agregação

A fixture emite um `sf2h.native-case-observation.v2` privado por teste, com ID ordinal, hash do título, caso efetivo, C/invocation/owner/principal, hash da seleção e cleanup observado. O worker só emite `sf2h.native-browser-detached.v2` depois de preservar os contextos originais e desconectar seu cliente CDP.

O verificador possui os comandos abaixo na raiz do checkout, após a execução real. O modo record usa Bun para importar os validadores TypeScript originais.

```sh
bun script/sf-ci/g08-native-journeys.mjs record U15 "$SF_G08_PRIVATE_ROOT"
bun script/sf-ci/g08-native-journeys.mjs record U39 "$SF_G08_PRIVATE_ROOT"
bun script/sf-ci/g08-native-journeys.mjs record U40 "$SF_G08_PRIVATE_ROOT"
bun script/sf-ci/g08-native-journeys.mjs record-f04 "$SF_G08_PRIVATE_ROOT"
```

`sf2h.native-report-observation.v2` vincula o relatório original, todos os casos, owner/caso, arquivo de detach, hash do pacote/host/reserva e a mesma invocation. `sf2h.f04-report-observation.v2` exige os três títulos/arquivo originais, propriedades Bun de C/run, exit0 e um único Omni fresco. Ambos mantêm **installed=false, liveQualified=false, g08Closed=false, finalCandidate=false**: um parser e arquivos de entrada não estabelecem a proveniência do job/artefato nem a cadeia LIVE.

O agregador final deve conferir a execução original do workflow/job, SHA/árvore, artefato bruto privado e hashes, serviço antes/depois, tar, reserva e cleanup do dataset. Deve rejeitar missing/extra/skip/retry e composições de C/T/tar diferentes. Esta entrega não altera `gate.mjs`, não inventa o modo normativo nele ainda ausente e não emite aprovação final. O coordenador integra esse contrato à cadeia original antes de aceitar LIVE.

As nove obrigações Teams, as três jornadas, F04 e AZ02 continuam separadas. AZ02 preserva seus32 casos históricos e os cinco aditivos da composição moderna,37 no total; não é uma quinta suíte Playwright. A reunião desses grupos não fecha por si G01–G10 nem decide go/no-go.

## CI de preparação

`.github/workflows/g08-native-journeys.yml` executa somente controles de metadata, arquivos privados, recusa de recibos, typecheck e listagem inerte. Seu recibo `sf-g08-native-controls-v1` fixa source C/T, run/tentativa/workflow, hashes de fontes/logs/inventário, controles Node/Bun, Omni e baseline origin/dev. Os50 casos ficam LISTED_NOT_RUN e F04 fica NOT_RUN. Não há tenant, sessão ou host instalado nesse job.

Antes de execução instalada ainda faltam candidato final confirmado por Migração+Release, tar verificado desse SHA, reserva/host/contextos originais, adapter original de registro, CAP03 na composição, pré-requisitos reais por caso e a integração do agregador. Nenhuma dessas dependências é preenchida com prova de candidato anterior ou aprovação presumida.
