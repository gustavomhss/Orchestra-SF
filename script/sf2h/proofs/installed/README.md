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

A composição de preparação começa em dev `2fdc76d8b40cd62c2da4967a5b9533411af308df`, incluindo os hooks originais de #690/#688. Os helpers compartilhados e seus controles foram relidos em Migração `c9a9b0b3a85ea7f663b50d16527f45e977ccd3b5`: os nove arquivos consultados são byte-idênticos a `0001792ae7bb072f515b09af3c52b121cfa98108`. A branch da Migração não é movida por esta entrega. A configuração mantém o modo Decisions novo dessa fonte e acrescenta um modo native independente.

O transporte/UI consome os adapters originais de #681/#683; não define CRUD, ator ou autenticação substitutos. As rotas públicas conservam `/orchestra/sf-procurement/contracts`, `/orchestra/sf-dashboard/opex` e `/orchestra/sf-dashboard/capex`, com a query fechada `contractRevision, server, installationId, tenantId, teamObjectId`. CAP04/CAP05 incluem ano canônico 2024–2027; os casos originais usam 2026. CAP14 não aceita year. projectId e hostId são somente proveniência técnica.

Leituras usam os readers originais `/<mount>/api/ui/pages/CAP14|CAP04|CAP05` e o selector `x-sf-team-profile`; comandos usam `/<mount>/teams/<id>/dashboard`, incluindo fixedQuery e body originais. A fonte é validada pelo schema original, e owner/principal/revisões são comparados com F02 atual antes e depois do I/O.

**Percurso source preservado:** as duas suítes Budget exigem o destino autorizado CAP03 e o clique original “View source” para `/orchestra/sf-dashboard/budget`, mantendo Team e year=2026. O reader original somente de leitura, o transporte, o retorno OIDC e a rota/porta de período foram integrados por #693/#691. CAP03 conserva year/month opcionais no contrato original, sem ações de mutação nativas; os cenários source continuam usando year=2026. A inclusão desses componentes no candidato e seu funcionamento no tar instalado ainda devem ser comprovados. O registro só aceita o link produzido pela folha e admitido por F01/F02 atuais.

### Compatibilidade da apresentação original

A folha de detalhe atual preservada de #613 usa `[data-sf-opex-detail]` / `[data-sf-capex-detail]`. As jornadas abrem os painéis nativos `details.sf-opex-reference` e `details.sf-opex-annual-actions` pelos seus summaries, com a mesma igualdade exata `collection:id`, versão original, ações e CAS. Lista e detalhe são vistas distintas: o teste percorre Back antes de voltar à lista. A região mensal é “Monthly entries”; readonly não renderiza New. Os spans numéricos são comparados com a formatação original inglesa, e o atributo original da flag é comparado com seu código da fonte. Não se reintroduz markup histórico no produto nem se descarta a obrigação.

## Pré-requisitos do host

A execução requer a reserva isolada autorizada, os dois Teams, quatro contextos Microsoft já autenticados, dados originais e o tar G07 instalado no mesmo C/T. O checkout do workflow, o recibo G07, a factory, o processo real e a reserva devem concordar.

Cada invocação usa uma raiz privada diferente, real, pertencente ao UID do runner, mode 0700; arquivos regulares privados mode 0600, sem links. Os dados do plano e do registro ficam no host. Não publicar CDP, cookies, tokens, URLs privadas, GUIDs de atores, corpos do produto, relatório JSON bruto, screenshots, vídeo, traces, mensagens brutas de erro ou valores financeiros em artefatos públicos.

O plano original `sf-g08-private-plan-v1`, o recibo de pacote e o observador original `g08-installed-preflight.py` continuam obrigatórios. `readNativeInstalledHost` reutiliza seus validadores e observa novamente Linux x64: PID, start ticks, boot, UID não-root, unidade systemd, executável em C, argv da factory e bytes da factory. Não instala, reinicia ou altera serviços. Depois, o browser confirma peer HTTPS443/IP da reserva e rejeita Service Worker/redirect. O CDP apenas se anexa ao browser existente; caches e SW são bypassados nas páginas de teste. Não há launch, newContext, storageState ou cópia de autenticação.

As variáveis SF_G08 de pin/invocação exigidas pelo plano e as SF_NATIVE abaixo devem derivar da mesma invocação observada:

- `SF_G08_PRIVATE_ROOT`: raiz absoluta privada da invocação, igual a `scratchRoot` do plano.
- `SF_NATIVE_CANDIDATE_SHA`: C do plano, igual ao checkout efetivo.
- `SF_NATIVE_INVOCATION_ID`: nonce32hex da invocação.
- `SF_NATIVE_INSTALLED_MANIFEST`: exatamente `<raiz>/native-installed-manifest.json`, produzido pelo registro.
- `SF_NATIVE_BROWSER_ENDPOINT_FILE`: arquivo de texto privado diretamente sob essa raiz, contendo o endpoint CDP loopback do browser existente no host autorizado; a integração #698 usa `<raiz>/browser-endpoint.txt`.
- `SF_NATIVE_PRIVATE_REPORT`: exatamente `<raiz>/native-playwright.json`.
- U15: as cinco URLs retornadas por `u15RegisteredEnvironment`, passadas no ambiente privado antes da importação da suíte.

`GITHUB_RUN_ID`, tentativa, C/T, digest do tar, host e reserva são revalidados; metadata não concede acesso.

## Registro e seleção por caso

A CLI concreta de #700 está em `execute-registration.ts`; o adapter original está em `packages/app-shell/e2e/sucafina/native/fixture/original-host-adapter.ts`, reexportado por `host-adapter.ts`. Executada na raiz do checkout admitido, ela aceita exatamente um grupo:

```sh
bun script/sf2h/proofs/installed/execute-registration.ts U15
bun script/sf2h/proofs/installed/execute-registration.ts U39
bun script/sf2h/proofs/installed/execute-registration.ts U40
bun script/sf2h/proofs/installed/execute-registration.ts F04
```

Essas linhas são invocações alternativas: cada grupo exige seu próprio plano, nonce e raiz privada. A CLI não carrega callbacks, módulos, shell ou credenciais de um arquivo. `createOriginalInstalledHost` relê plano/G07/processo, anexa o cliente CDP ao browser existente e observa os quatro principais Microsoft em contextos distintos. A conexão vem de `SfTrustedInstallationSource.current`, pela descoberta original `/api/sucafina/installations?select=current&contractRevision=sf-team-profile/1`, com descriptor fechado, peer HTTPS da reserva e F02 antes/depois. Isso observa a instalação atual aprovada; não simula o registro geral de `ServerProvider`.

Para U15/U39/U40, `registerInstalledProofFromHost` usa esse adapter. O destino deve existir como âncora real da navegação Team; o clique, a URL atual, o resolver F01, o principal e as permissões são relidos. Quando há referência de registro, o ID/CAS deve aparecer na projeção original e na linha da UI. Em CAP14, o Edit original navega pelo `buildHref` da folha e o registro exige o editor real dessa referência. O adapter não fabrica uma URL de registro a partir de um ID fornecido pelo plano.

A CLI publica arquivos privados exclusivos:

| Arquivo | Contrato e finalidade |
| --- | --- |
| `native-installed-manifest.json` | `sf-g08-native-installed-v1`, com C/invocation e as fronteiras efetivamente usadas por G08. |
| `native-context-observations.json` | `sf-g08-native-context-observations-v1`, F02 dos contextos realmente observados. |
| `native-installed-u15.json`, `native-installed-u39.json` ou `native-installed-u40.json` | `sf2h.native-selected-installation.v2`, somente para a suíte solicitada, com todas as seleções e o hash do manifesto. |
| `native-runner-environment.json` | Somente U15: as cinco URLs retornadas pelo produtor original `u15RegisteredEnvironment`. |
| `native-registration-observations.json` | Descoberta, F01 e stamps observados; permanece privado. |
| `native-registration.json` | `sf-g08-native-registration-v1`, estado `REGISTERED_ONLY_NOT_EXECUTED`, hashes e cleanup do registro. |

O contrato G08 é aditivo e não contém `wrongServer`, negativa que essas 50 jornadas e F04 não exercitam. O `manifest-contract.ts` histórico da Migração permanece byte-idêntico e seu v2 continua exigindo todas as fronteiras originais, inclusive servidor estrangeiro. `validateInstalledNativeManifest` escolhe explicitamente entre os schemas; um v2 incompleto nunca é reinterpretado como G08. `readG08NativeManifest` conserva leitura privada canônica, nonce/C/run e rejeição de aliases/duplicatas.

A invocation inclui treeSha, runId, runAttempt, role, invocationId e archiveSha256. Cada seleção inclui caso, ator, target completo, URL/route F01 original, principal observador, intenção, stamp F02 e ref/CAS original. Valores serializados não substituem as leituras atuais. `consumeInstalledSuiteFromHost` e a fixture repetem F01/F02/source para cada escolha.

F04 usa role `teams` e prepara somente manifesto/observações de contexto, sem seleções nativas. O cliente CDP é desconectado antes do processo Bun/HappyDOM separado. Nos demais grupos, as páginas próprias também são fechadas; os contextos e páginas anteriores são preservados. A CLI relê processo/plano/pacote após o cleanup e só então publica o recibo. Esse recibo mantém `installed`, `liveQualified`, `g08Closed`, `finalCandidate` e `productionCutover` em false: não comprova o corpo de qualquer jornada nem substitui o exit real, o host-after ou a proveniência independente.

### Planos por invocação e principais distintos

O plano das nove obrigações Teams conserva seus quatro atores e o administrador sem Team. Ele não é reutilizado implicitamente para todas as jornadas. Cada U15/U39/U40 tem um plano e uma invocation próprios, vinculados à mesma reserva autorizada, C/T, tar e VM, com `approvals.actorsReference` explícito para os principais daquela invocação. O manifesto G08 conserva as quatro chaves de atores originais; seus valores devem ser idênticos ao plano e observados em quatro contextos Microsoft originais distintos. O reader histórico v2 permanece separado e estrito.

U39/U40 exigem dois editores reais, um principal readonly e um principal negado. A revogação exige também autorização administrativa original. Uma composição possível, que o registro só aceita após observá-la, é requester e holder como editores, denied sem leitura e dashboardAdmin como administrador com leitura empresarial sem ações de mutação. O nome de qualquer chave não concede esses papéis. A autorização administrativa e a empresarial são verificadas separadamente. Se os quatro contextos autorizados não satisfizerem essa combinação, o registro falha; não cria um quinto ator, não troca um principal por metadata e não reutiliza o admin sem Team do grupo nove como readonly.

O recibo inclui hashes dos bytes canônicos do plano e de `actorsReference`, além da seleção e do manifesto que vincula principal/owner/caso. O agregador deve conferir a referência de autorização original e a reserva comum entre invocações; a referência ou seu hash isolados não são aprovação nem prova de autenticação.

### Vazio real e isolamento

DashboardBudget.view projeta a coleção autorizada completa; duas identidades diferentes não tornam uma coleção povoada vazia por si. Por isso somente `empty` seleciona a **Team B realmente autorizada na mesma reserva/C/T/tar/host**. A leitura original deve retornar zero rows, no registro e no consumo. Não se apaga, filtra ou fabrica dado. A Team A dos demais casos permanece explícita. No caso B, wrongTeam aponta para A; um owner nunca pode ser seu próprio negativo.

Estar autorizado em B não permite transportar draft/intent de A. O cenário late segura a resposta original de A, troca a escolha completa e exige que o dado privado anterior desapareça. O seam filtra o selector original e exclui requests do observador: o GET legítimo de B não satisfaz o contador de A.

### Readonly, revogação e segundo escritor

Readonly é selecionado por F02 atual com leitura e sem ações de mutação. Não é promovido a edit pelo nome de um ator nem por um botão. Denied usa seu principal original, com a rota observada separadamente por um principal autorizado; nunca reutiliza o requester como ator negado.

O callback de revogação usa o endpoint administrativo Teams original e a revisão CAS corrente para desabilitar somente a Team reservada. Ele exige admissão administrativa real; o nome dashboardAdmin não concede essa permissão. F02 e a UI reobservam a recusa e o descarte. No teardown, uma restauração original enable é feita apenas com a revisão efetivamente pertencente à operação, e catálogo, configuração e acesso são relidos. Resultado incerto ou mudança concorrente impedem cleanup positivo.

O callback de concorrência escolhe outro contexto/principal original, confirma o mesmo ref/CAS e edita pela folha nativa original. Observa o POST real e sua resposta, relê a versão avançada e restaura apenas a mudança própria, com CAS e observação independente. Os casos não recebem `committed:true` de um manifesto manual.

O cleanup registra somente páginas próprias e mudanças dos callbacks. Os casos originais podem deixar resultados de mutações cuja resposta foi perdida; o descarte seguro do dataset reservado continua obrigação explícita do host. Não se faz compensação automática de intenção incerta.

## Comandos originais após admissão

A integração operacional #698 foi incorporada em dev, merge `b7776698e61934ed2cb820658408ff8a8207ec62`. No checkout do candidato admitido, o ponto de entrada do grupo é, na raiz do repositório:

```sh
bash script/sf-ci/g08-installed-run.sh U15
bash script/sf-ci/g08-installed-run.sh U39
bash script/sf-ci/g08-installed-run.sh U40
bash script/sf-ci/g08-installed-run.sh F04
```

Cada linha usa a raiz e o plano próprios daquela invocação; não executar todos os grupos sobre os mesmos arquivos. O wrapper executa host-before antes do registro, observa o exit real da CLI, mantém stdout/stderr privados e executa host-after no finalizador, inclusive quando o registro ou a suíte falham. Para U15, rederiva as cinco URLs da seleção original para o ambiente do subprocesso; na inspeção posterior, analisa `native-runner-environment.json` e o confere por `validateU15RegisteredEnvironment`, baseado em `u15RegisteredEnvironment`. Não usa `source` ou `eval`. O manifesto usa a entry da suíte derivada por `nativeJourneyEntryHref`, enquanto o plano conserva sua entrada sf-home/context; os demais bindings de owner/instalação/host permanecem iguais.

Os comandos abaixo documentam os subprocessos originais da execução. Eles não substituem o wrapper nem a coleta de proveniência. Cada suíte roda separadamente, dentro de `packages/app-shell`, com o ambiente privado já registrado. A raiz do relatório deve ser 0700 e o shell deve usar umask 077.

```sh
bunx --no-install playwright test --config e2e/playwright.production.config.ts e2e/sucafina/native/journeys/u15.spec.ts --workers=1 --retries=0 --repeat-each=1 --reporter=json
bunx --no-install playwright test --config e2e/playwright.production.config.ts e2e/sucafina/native/journeys/u39.spec.ts --workers=1 --retries=0 --repeat-each=1 --reporter=json
bunx --no-install playwright test --config e2e/playwright.production.config.ts e2e/sucafina/native/journeys/u40.spec.ts --workers=1 --retries=0 --repeat-each=1 --reporter=json
```

O modo native não inicia webServer, build ou fixture local; workers=1/retries=0/repeat=1, sem traces/video/screenshots. `--list` é inerte e não exige manifesto nem browser. Não misturar native com Operations/Decisions na mesma invocação. Para execução, a configuração fixa também PLAYWRIGHT_JSON_OUTPUT_FILE no arquivo privado, inclusive quando o comando usa --reporter=json; um destino divergente ou only-failures é recusado. Essa variável é o contrato documentado do [JSON reporter original](https://playwright.dev/docs/test-reporters#json-reporter).

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

`sf2h.native-report-observation.v2` vincula o relatório original, todos os casos, owner/caso, arquivo de detach, hash do pacote/host/reserva e a mesma invocation. `sf2h.f04-report-observation.v2` exige os três títulos/arquivo originais, propriedades Bun de C/run, exit code 0 e um único Omni fresco. Ambos mantêm **installed=false, liveQualified=false, g08Closed=false, finalCandidate=false**: um parser e arquivos de entrada não estabelecem a proveniência do job/artefato nem a cadeia LIVE.

A integração #698 confere a execução original do workflow/job, SHA/árvore, artefatos e hashes, serviço antes/depois, tar, reserva e cleanup do dataset, usando a proveniência independente da #701. O recibo do grupo também vincula `native-registration.json`, as observações e o exit real da CLI. Missing/extra/skip/retry e composições de C/T/tar/reserva/VM diferentes são recusados. A agregação ocorre em invocação posterior, após os produtores originais concluídos; o registro ou seu hash isolado não são prova LIVE. Esta rota não altera `gate.mjs` nem inventa um modo normativo nele.

As nove obrigações Teams, as três jornadas, F04 e AZ02 continuam separadas. AZ02 preserva seus 32 casos históricos e os cinco aditivos da composição moderna, 37 no total; não é uma quinta suíte Playwright. A reunião desses grupos não fecha por si G01–G10 nem decide go/no-go.

## CI de preparação

`.github/workflows/g08-native-journeys.yml` executa somente controles de metadata, arquivos privados, recusa de recibos, typecheck e listagem inerte. Seu recibo `sf-g08-native-controls-v1` fixa source C/T, run/tentativa/workflow, hashes de fontes/logs/inventário, controles Node/Bun, Omni e baseline origin/dev. Os 50 casos ficam LISTED_NOT_RUN e F04 fica NOT_RUN. Não há tenant, sessão ou host instalado nesse job.

A preparação de #700 acrescentou a CLI/adapter concretos, o schema G08 aditivo e a navegação original Edit CAP14. Seu focal Actions `45055263348`, fonte `9991d8bb4df736f6d4abcab195a4f4138d7c339c`, verificou 40 Node, 42 Bun, 21 DOM, tipos nativos/AppShell/Client e guards; os 50 casos continuaram LISTED_NOT_RUN e F04 NOT_RUN. O recibo `sf-g08-native-adapter-controls-v1` qualifica somente esses controles. A extração literal do contrato de tipo mantém a resolução de rota original; não é prova do ambiente instalado.

Antes da execução instalada ainda são necessários o candidato final confirmado por Migração+Release, tar verificado desse SHA, reserva/host/contextos originais, pré-requisitos reais por caso e a execução completa pelo wrapper/agregador/proveniência já integrados. A CLI, CAP03, wrapper, agregador e proveniência já estão implementados e integrados; sua presença e funcionamento no candidato final/tar permanecem parte da admissão e da prova instalada. Nenhuma dessas dependências operacionais é preenchida com prova de candidato anterior ou aprovação presumida.

