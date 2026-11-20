# Orchestra-SF — blast radius por fronteira e plano exato de testes

**Base desta investigação:** `sf-join-four@687759276c2c9121c2cfd20a5994b277ceb7ee4d`.  
**Tree:** `c3ac6f64b79e75fc5a178c90692f36435e99d236`.  
**Data:** 19/11/2026, America/Sao_Paulo.  
**Entrega:** planejamento e investigação de código. **Implementação NOT_STARTED; testes, Actions, build, migração e tenant NOT_RUN.**

## 1. Resultado e precedência

A lista inicial de candidatos foi substituída por matrizes que dão a cada arquivo uma decisão, a obrigação de teste, o runner e o gate de execução. Esta investigação segue o caminho completo: entrada → contexto admitido → serviço/cache → store → resposta/evento/job → consumidor → teste. Ela não se limita a procurar a palavra `profile`.

Este anexo e [teams-profile-test-plan.json](./teams-profile-test-plan.json) passam a reger **seleção de testes, classificação de helpers, cobertura adicional e qualificação final** sobre a base acima. O [plano de migração](./teams-profile-migration.md) conserva a arquitetura e os 46 cenários de aceite; a [cold review anterior](./teams-profile-cold-review.md) é evidência histórica, não certificação deste delta. As matrizes de [Core](./teams-profile-radius-core.md), [identidade](./teams-profile-radius-identity.md) e [shell](./teams-profile-radius-shell.md), com os respectivos JSON, contêm o detalhe por arquivo.

A base foi congelada para concluir a análise. Antes de implementar, o integrador compara a base escolhida com este pin e atualiza somente o delta: caminhos movidos, contratos novos, testes novos e seleção real. Isso não reinicia o estudo nem autoriza ignorar evidência já fechada.

**Cobertura consolidada:** **638 arquivos de teste únicos**: 590 existentes e 48 propostos. Decisões: 323 CHANGE_CONTRACT, 121 CHANGE_FIXTURE, 140 KEEP_REGRESSION, 6 REMOVE_SF_CASE e 48 NEW. São 631 arquivos com gate final SF; sete ficam fora dessa lane, com justificativa e obrigação substituta. Há 154 paths de suporte (152 arquivos e dois diretórios gerados), mais 224 testes pais adicionais identificados estruturalmente e cobertos pelo CI-SF completo. Estes 224 não entram na contagem de corpos de teste revisados. Foram fechados os 213 candidatos indiretos originais, os 40 membros do pool e os 46 critérios de aceite.

Os números contam arquivos, não casos executados. Scan lexical, leitura semântica, leitura focal, import graph e execução são evidências distintas. Não foi realizada uma varredura semântica de todo o monorepo ou inspeção do artefato final. A prova de ausência de resíduos pertence ao gate G09 e só existe depois da implementação e do build reais.

## 2. Fronteiras que a lista anterior não fechava

| Fronteira | Evidência no pin | Alteração obrigatória e prova |
|---|---|---|
| Microsoft/Teams | `graphDirectory` aparece em contratos opcionais, sem produtor/consumidor implementado no corpus runtime/local/product examinado. | Implementar o leitor real e o contrato de elegibilidade/revisão; fixtures atuais de grupos/papéis não provam Teams. Testes de páginas incompletas, expiração, revogação, nomes iguais, tenant e convidado precisam ser próprios. |
| Contexto público | Schema, discovery, URL, owner, expected binding e stamp ainda transportam `projectId`. | Versionar e trocar a cadeia inteira; rejeitar payload híbrido, selector duplicado e downgrade. Regenerar clientes e editar o transporte nativo escrito à mão. |
| Sessão existente | Core pode adotar ID existente antes de comparar novo Location/agent/model/parent. | Reautorização vem antes do atalho de idempotência; preservar retry exato no mesmo dono. Dois usuários no mesmo Team não podem adotar estado privado um do outro. |
| Configuração/cache | `LocationServiceMap`, MCP, modelos e plugins capturam contexto de diretório; updateGlobal recarrega referências de serviços. | Configuração empresarial passa ao store admitido; diretório permanece somente colocação técnica. Contexto A nunca é reutilizado para B por compartilharem pasta. |
| Credencial MCP | `mcp-auth.json` é global, indexado por nome do servidor. | Namespace da conexão/credencial precisa distinguir instalação, principal e escopo admitido. Dois MCPs com mesmo nome não compartilham OAuth; logout/rebind não apagam ou transferem segredo alheio. |
| Principal indireto do servidor | [principal.ts](https://github.com/gustavomhss/Orchestra-SF/blob/687759276c2c9121c2cfd20a5994b277ceb7ee4d/packages/server/src/principal.ts) deriva usuário do sistema operacional, com fallback local. | Não usar esse valor como principal Teams de Relay/Atlas ou ação owner. Teste sem cookie corporativo, Basic correto e sessão conhecida deve negar antes de consulta/efeito. |
| Local operator | Positivos de negócio em local-entry/export e alguns controles Operations usam operador local/macOS. | Retirar esse positivo do contrato SF; manter utilitários legítimos de instalação/backup sem lhes conceder dados de negócio. Substituir por fixture corporativa e negativa de operador. |
| Eventos | Stream global e serialização memoizada podem preceder a projeção de contexto. | Autorizar antes de produzir/enfileirar/serializar a vista; revalidar revogação no replay/reconnect. Provar dois usuários no mesmo Team e dois Teams na mesma pasta. |
| Browser de verdade | Persistência web usa `windowID = "browser"`; home selection é server-global. | Criar identidade real de janela e namespace privado. Duas janelas mantêm seleções distintas; logout/revogação invalida ambas. Um teste com dois objetos da mesma store não prova duas janelas. |
| Drafts e blobs | IndexedDB `orchestra-drafts` e chave de blob por SHA não carregam dono suficiente. | Ownership e epoch em abertura, lookup, URL de blob e GC; texto, anexos e resultado incerto não atravessam conta/equipe. Não apagar dados de outro principal durante limpeza. |
| Bootstrap em corrida | Teste atual aceita resultado antigo bem-sucedido quando leitura nova falha. | Preservar somente a corrida dentro da mesma autoridade; A→B com erro em B deve deixar B sem dados A. Não substituir toda expectativa por reset indiscriminado. |
| Engine/continuity | Claude usa `settingSources: ["project"]`; continuity pode ler `.atlas` do repositório. | Remover esses produtores do contexto SF ou restringi-los a dados técnicos sem autoridade/profile. Provar que arquivos perto do cwd não alteram política, tools, contexto ou memória empresarial. |
| CLI entregue | [index.ts](https://github.com/gustavomhss/Orchestra-SF/blob/687759276c2c9121c2cfd20a5994b277ceb7ee4d/apps/cli/src/index.ts) registra comandos genéricos; o build SF compila o mesmo entrypoint. | `api/run/attach/session/import/export/stats/mcp/agent` precisam passar pelo host admitido. Help oculto não é remoção; requests de diretório/Basic não podem ler nem escrever perfil/dados SF. |
| Conteúdo entregue ao agente | Build inclui skills, prompts e playbooks completos; folhas ensinam configuração e trust por projeto. | Alterar a composição SF, referências e conteúdo selecionado. Validar o mapa produzido e o conteúdo extraído, incluindo instructions transitivas; atualizar só `docs/` não muda o que chega ao agente. |
| Prova do browser instalado | Writer do manifesto exige origens diferentes onde reader exige iguais. | Corrigir contrato comum e testar round-trip produtor→leitor com fronteiras negativas reais, antes de usar F04 como prova da migração. |
| Owner/health operacional Azure | `owner_config`, probe e AZ02 ainda transportam o triplet com `projectId`; rollback chama o mesmo health. | Versionar owner/health/proof; separar health administrativo sem Team de saúde do contexto empresarial; acrescentar testes de contrato e prova operacional real. |
| Instalação e recibo do pacote | Assembler prod, factory-v1 e azure-bundle usam formatos/layouts distintos; upload factory omite o recibo web-native da raiz. | Adaptador versionado valida bytes/layout/hash antes de writes; upload explícito e recibos por papel, sem reetiquetar factory dev como prod. |
| Seleção de testes | CI-SF exclui 40 consumidores do pool ordenado; helpers e scripts Electron se parecem com testes. | Criar execução ordenada explícita, resolver teste pai de cada helper e executar com runtime correto. Um workflow verde sem esses casos não fecha a mudança. |

As fontes, símbolos e assertions individuais ficam nas matrizes de domínio. Essa tabela não afirma incidentes de produção: ela identifica relações de código e obrigações de migração.

### Contradição F04 confirmada

Em [installed-manifest.ts](https://github.com/gustavomhss/Orchestra-SF/blob/687759276c2c9121c2cfd20a5994b277ceb7ee4d/packages/app-shell/e2e/sucafina/native/fixture/installed-manifest.ts), `registerNativeInstalledManifest` rejeita igualdade entre a origem target e as origens de wrongProject/wrongInstallation. Em [readiness.ts](https://github.com/gustavomhss/Orchestra-SF/blob/687759276c2c9121c2cfd20a5994b277ceb7ee4d/packages/app-shell/e2e/sucafina/native/fixture/readiness.ts), `readNativeManifest` rejeita a desigualdade dos mesmos campos. Um manifesto não satisfaz ambos.

A correção planejada é uma validação compartilhada com teste de round-trip em `packages/app-shell/test/sucafina-native/installed-manifest-contract.test.ts`. Na migração, wrongProject vira o controle de Team correto, sem remover wrongServer/wrongInstallation nem reduzir a independência dos atores. A topologia negativa deve testar mudança de escopo no mesmo host e host/instalação alheios de forma explícita. Origem diferente sozinha não prova isolamento dentro da mesma origem.

## 3. Destino cirúrgico do código e dos dados

O limite da remoção é o **modelo de profile por repositório no produto SF**. Nenhum caminho ativo pode escolher, autorizar, configurar ou recuperar profile empresarial a partir de Git, cwd, root commit, diretório, trusted project ou ausência de seleção.

| Classe | Destino obrigatório | Evidência que fecha |
|---|---|---|
| Seletor/store/handler exclusivo de repo-profile | Remover depois de migrar callers e dados. Não manter wrapper morto, alias permissivo, flag ou fallback. | Nenhum import/caller/route/command ativo; teste de negação do protocolo antigo; scanner de fonte e pacote. |
| Directory/Location usado para arquivo ou execução | Preservar significado técnico; nunca converter em identidade Teams. | Mesmo diretório, duas equipes e duas contas isoladas; o profile continua funcionando sem Git. |
| `projectId` em evidência durável e digests | Preservar origem histórica verificável ou fazer migração formal com ponte admitida; não rehash para fabricar origem. | Histórico, projeção atual reautorizada e handles transitórios têm destino distinto; testes de adulteração e owner divergente. |
| Config/model/MCP/plugin/instruction/skill do repositório | Retirar da resolução SF; selecionar fontes empresariais autorizadas. | Arquivos venenosos perto do cwd não afetam o contexto SF; produtores e consumers testados juntos. |
| Dados privados sem owner demonstrável | Quarentena privada; não associar à primeira equipe, ao operador ou ao global. | Dry-run com ambiguidade, inspeção sem conteúdo alheio, reexecução e backfill sem perda. |
| Credenciais/cookies/drafts | Ownership privado e controle de revisão; conexão compartilhada não transforma segredo pessoal em segredo do Team. | A/B, mesmo Team com contas distintas, rename/rebind, logout, revogação, crash e GC. |
| Sessões/jobs/Inbox/Relay/Lean/RAG/Atlas/reuniões | Ownership durável + autorização corrente antes de leitura e efeito. | Parent/fork/import/replay, paginação, job vencido, revogação, retry e saída assíncrona. |
| Migrations imutáveis, protocolo histórico, profile de workflow/seat | Manter com classificação exata e teste da fronteira ativa. | Nenhuma identidade SF deriva dessas ocorrências; não apagar dados históricos ou guards por substituição textual. |
| UI/Desktop fora do alvo | Remover o caso da qualificação SF e documentar o destino do código compartilhado. | SF Web sem fallback Dock/pasta; Electron exige sua própria qualificação se seu host for alterado, nunca é substituto de Linux Web. |

A migração precisa preservar o que já aconteceu: receipts, prompts admitidos, slots consumidos, dedup, cancelamentos/tombstones e identificadores emitidos. Restaurar um checkpoint antigo não autoriza repetir efeitos posteriores. A46 permanece bloqueante; sem prova suficiente, os consumidores com efeito ficam suspensos.

Também permanece bloqueante A45: o administrador corporativo admitido precisa entrar na administração/recuperação sem Team selecionável. Isso não transforma operador local, admin de superfície ou owner de Team em administrador supremo; não concede acesso geral de negócio.

## 4. Testes: decisão por arquivo, sem apagar obrigações

A matriz consolidada usa:

- **CHANGE_CONTRACT:** editar fixture/assertion no arquivo indicado; preservar os invariantes listados e incluir os negativos descritos.
- **CHANGE_FIXTURE:** adaptar construtor, owner, stamp ou fonte da fixture; preservar as assertions de negócio explicitamente indicadas. Não reescrever resultados comerciais para acomodar a migração.
- **KEEP_REGRESSION:** rodar a prova existente com seu significado técnico preservado; nenhuma alteração meramente lexical.
- **REMOVE_SF_CASE:** retirar o caso antigo da jornada SF, com substituto nomeado. Não significa apagar o arquivo inteiro ou colocá-lo em skip.
- **NEW:** caminho proposto, comportamento e runner definidos. Não existe no pin e só pode entrar na seleção depois de implementado.
- **SUPPORT:** helper/fixture que muda, associado a executável pai. Não conta como arquivo de teste rodado.
- **OUTSIDE_SF:** ocorrência que permanece por significado técnico/histórico ou outra plataforma, com razão; não conta como prova da migração.

O JSON principal é o índice por path e o contrato de execução. Cada linha aponta ao registro completo em [Core e ferramentas](./teams-profile-tests-core-and-tooling.json), [produto/identidade](./teams-profile-tests-product.json) ou [shell](./teams-profile-tests-shell.json), que mantém a decisão, assertions, preservações, fonte e runner. [Suportes](./teams-profile-test-support.json) e [pais estruturais adicionais](./teams-profile-test-parent-closure.json) ficam separados para não confundir helpers com testes executáveis. A contagem de CHANGE não significa que todo o arquivo será reescrito: muda somente a parte do contrato indicada.

### Casos que precisam mudar com cuidado

1. **Readoção de Session ID:** manter retry exato legítimo; acrescentar owner/contexto errado antes do shortcut.
2. **Listagem global/por diretório:** mudar para projeção autorizada antes de paginação, cursor, contagem e busca. Filtrar no browser depois de receber os dados não serve.
3. **Bootstrap stale-success:** o dado antigo pode continuar utilizável somente dentro da mesma identidade/revisão admitida; em switch de autoridade deve desaparecer.
4. **Primeiro login/folder/Git:** substituir por entrada sem repositório e seleção de equipe; zero Team fica explícito.
5. **Operador local:** casos SF de negócio que esperam 200 por login local devem virar negativa e positivo corporativo; backup/utilitários legítimos continuam.
6. **Cookies/profile registry:** renomear Team ou reciclar ID não autoriza reatribuir storageKey; preservar provas contra compartilhamento indireto.
7. **Origem e digest:** não atualizar snapshots/fixtures para aceitar reescrita de evidência histórica.
8. **Config e skills:** preservar behavior profiles de seats e workflow compiler; remover fonte por repo do caminho SF e testar ausência no conteúdo empacotado.


### 4.1 Fecho dos consumidores indiretos

Os 213 candidatos adicionais da frente de identidade foram divididos por ordem determinística e revistos nas partes que constroem contexto/fixture e verificam autoridade. O fecho está em [teams-profile-fixture-review.json](./teams-profile-fixture-review.json), com referências aos três relatórios completos. São 159 executáveis e 54 helpers/readers: 71 decisões `CHANGE_CONTRACT`, 131 `CHANGE_FIXTURE` e 11 `KEEP_REGRESSION`, sem candidato residual nessa lista. `factory-distribution-linux.test.ts` já estava no catálogo root e é contado uma vez na união.

O fecho não termina nos imports diretos. Os 31 consumidores restantes do pool, somados aos nove já mapeados, recebem disposição própria em [teams-profile-pool-review.json](./teams-profile-pool-review.json). Assertions de URL, envelope, retomada e storage continuam sendo verificadas. Helpers têm seus pais enumerados; a existência de uma aresta estrutural não é anunciada como revisão semântica do corpo do pai.

Exemplos materiais dessa extensão:

- `wp11/renewal-operation-verifier.ts`, usado por 19 pais, exige schema de evidência e igualdade de `projectId`. O matcher passa a separar origem histórica de owner atualmente admitido, sem recalcular o digest.
- `wp13/renewal-restart-reader.ts` mantém a mesma fronteira depois de restart e cache hit; executar o pai que realmente inicia esse leitor em processo filho.
- `wp14/signal-registry.test.ts` tem loops explícitos de troca de contexto: incluir tenant/Team/revisão/epoch em ambas as fases, preservando HMAC, recibo, resultados vazios e corridas.
- Os positivos de negócio por `local-operator` no browser, memória, export e factory viram negativo de operador e positivo corporativo. `projectId` de CAPEX e outras entidades comerciais permanece com seu significado.

O [mapa A01–A46](./teams-profile-acceptance-map.json) exige assertions concretas. A revisão acrescentou expressamente: dry-run sem escrita para A28; ownership e reautenticação no rebind de storageKey para A40; auditoria do archive real para A33; e uma spec Linux de restore real para A46. Uma ligação por nome parecido de teste não fecha um cenário.


### 4.2 As três jornadas principais de UI

A revisão [teams-profile-ui-fixture-review.json](./teams-profile-ui-fixture-review.json) fecha os três pais Playwright e 23 helpers/suportes de runner. Mantém os **14 casos originais: cinco Operations, cinco Decisions e quatro Reports**, com títulos e assertions inventariados. Há dois novos helpers E2E test-only, além da fixture corporativa central já proposta; não há nova spec nessa extensão.

As três cadeias atuais autenticam por operador local real. A migração exige compor o caminho real de validação Microsoft/factory/host/SQLite com OIDC/JWKS/PKCE/Graph controlados no limite remoto, usando `createMicrosoftInstallation(..., { fetch, now })`. HTTPS e cookies Secure continuam corretos. Trocar `authMode`, mudar prefixo de principal ou injetar cookie não satisfaz esse contrato.

A classe dessas suites será **CONTROLLED_MICROSOFT_INSTALLED_PRODUCT**. Ela protege os produtores reais do produto sob identidades controladas; não é Entra/Teams LIVE nem atestação do pacote final. G08 e G10 exigem seus contextos corporativos originais, tenant e archive reais.

| Achado no código | Correção e obrigação mantida |
|---|---|
| Leitor Operations exige `/wp04/{key}`; produtor publica `/sucafina`. | Um contrato canônico entre produtor e leitor, preservando validação de origem/mount e distinção por principal. |
| OP-IMPORT abre viewer no BrowserContext do primeiro ator; cookies por principal podem coexistir, mas o host nega mais de uma sessão válida. | BrowserContext separado para viewer; conservar a recusa de credenciais ambíguas e o logout real do primeiro ator. |
| RPT03 chega ao `UNBOUND WP1` de `removeOne:true`. | Implementar o produtor real; preservar 24/25 registros, fonte intacta e criação de revisão explícita. Não remover, pular ou simular o resultado. |
| RPT04 revoga sessão e reenrola o mesmo ator. | Preservar a prova existente; acrescentar troca de principal e revogação de membership como negativas distintas. |
| Helpers de Reports limpam query e reconstruem apenas parte do contexto. | Usar builder canônico com selector Team completo, preservando versão, origem, digest e recepção da escolha humana. |
| Mensagem antiga diz que Operations não é selecionado. | Corrigir o diagnóstico; o selector atual já inclui Operations e o setup correspondente já provisiona ClamD. |

Esses bloqueios foram encontrados por leitura. Nenhuma falha de CI foi reproduzida nesta investigação. Eles recebem correção explícita antes da qualificação; não reduzem a obrigação de preservar os cenários.

### Complemento CLI e conteúdo empacotado

| Arquivo | Decisão | Gate final | Motivo / assertions |
|---|---|---|---|
| `apps/cli/src/commands/handlers/agent/agent.test.ts` | KEEP_REGRESSION | G02-TARGETED-REQUESTS | Preservar geração, deny de ferramentas não selecionadas, colisão de arquivo e remoção da sessão temporária no CLI genérico. A integração SF deve negar caminho/diretório/operator como identidade; essa negativa pertence ao teste instalado novo, não ao stub de list/create. |
| `apps/cli/src/commands/handlers/mcp/mcp.test.ts` | KEEP_REGRESSION | G02-TARGETED-REQUESTS | Preservar parser remoto/local, erros de flags, OAuth, logout e relatório mascarado no transporte técnico; não trocar expectativas por sucesso SF sem principal. Novas negativas reais de MCP config/auth/logout por instalação+principal+Team em CLI-ADMISSION e core/server. |
| `apps/cli/src/commands/handlers/run.test.ts` | KEEP_REGRESSION | G02-TARGETED-REQUESTS | Preservar dedup stream/history, steers, continue/fork, permissões e erros. '--continue latest root' permanece positivo somente em contexto técnico admitido; nova integração SF impede último chat global, sid alheio, fork ou --auto de contornar admissão. |
| `apps/cli/src/commands/handlers/session.test.ts` | KEEP_REGRESSION | G02-TARGETED-REQUESTS | Preservar list/delete/JSON e erro tipado vs 404 genérico. location.directory em fixture técnica não é profile Teams; provar no teste instalado que list/delete não expõem outro principal/equipe. |
| `apps/cli/src/commands/handlers/transcript.test.ts` | KEEP_REGRESSION | G02-TARGETED-REQUESTS | Preservar paginação de 250 mensagens e import que não sobrescreve sessão. Nova integração SF bloqueia import sem ownership, export latest global e leitura entre equipes antes de emitir conteúdo. |
| `apps/cli/src/commands/handlers/stats.test.ts` | KEEP_REGRESSION | G02-TARGETED-REQUESTS | Preservar aritmética, paginação, filtros técnicos e falha sem total parcial. '--project' não seleciona profile SF; nova negativa instalada garante filtragem autorizada antes de paginação/agregação. |
| `apps/cli/src/commands/handlers/api.test.ts` | KEEP_REGRESSION | G02-TARGETED-REQUESTS | Preservar resolução de operationId, encoding e erro de parâmetro; raw api não ganha autoridade SF por resolver URL. |
| `apps/cli/src/commands/handlers/attach.test.ts` | KEEP_REGRESSION | G02-TARGETED-REQUESTS | Preservar erros fork/session e diretório remoto técnico. Basic/password é transporte do host; nova negativa SF deve negar leitura corporativa mesmo com senha correta. |
| `apps/cli/test/commands-help.test.ts` | KEEP_REGRESSION | G02-TARGETED-REQUESTS | Manter prova de que hidden não torna comando inexequível; ausência no help nunca será usada como prova de remoção/admissão. |
| `apps/cli/test/packaged-skills-build.test.ts` | CHANGE_CONTRACT | G02-TARGETED-REQUESTS | Preservar byte closure/roots/references da composição genérica; acrescentar composição de produção SF com o mesmo produtor do binário e provar que instruções/configuração repo-profile retiradas não são materializadas nem anunciadas. |
| `modules/maestro/coordination/test/seat-skills-build.test.ts` | CHANGE_CONTRACT | G02-TARGETED-REQUESTS | Manter extração Bun/Node fora do source, referências e erro de módulo ausente. Acrescentar seleção SF, conteúdo/prompt e referências transitivas corretos; o mapa de todos os playbooks genéricos não pode ser o oráculo único do pacote SF. |
| `modules/maestro/coordination/test/v2-skills.test.ts` | CHANGE_CONTRACT | G02-TARGETED-REQUESTS | Preservar visibilidade por seat e anti-shadow de playbook; acrescentar runtime SF sem fontes de skill/config do repositório e sem instruções de trust por pasta. |
| `modules/maestro/coordination/test/seat-skill-root.test.ts` | KEEP_REGRESSION | G02-TARGETED-REQUESTS | Preservar extração verificada, hashes por versão/conteúdo, rollback, limites de diretório, symlink e concorrência; profile de equipe não altera integridade de conteúdo empacotado. |
| `modules/maestro/coordination/test/roster.test.ts` | KEEP_REGRESSION | G02-TARGETED-REQUESTS | Profile de comportamento/seat e routing IDs não são profile por repositório: preservar identidade estável, grants e aliases. Só ajustar fixtures se a composição SF separar conteúdo; não remover garantias por busca da palavra profile. |
| `apps/cli/test/distribution-web.test.ts` | KEEP_REGRESSION | G07-LINUX-PACKAGE | Provar publicação web/native conjunta, bytes/hashes e rejeição de sourcemaps/overlap/tampering; executado na lane factory Linux. |
| `apps/cli/test/distribution-web-native.test.ts` | KEEP_REGRESSION | G07-LINUX-PACKAGE | Prova Linux real do payload e browser assets da mesma fonte; manter fonte/digest/recibos. Não equivale a autenticação Microsoft nem à brand SF de produção. |
| `apps/cli/test/factory-distribution-linux.test.ts` | CHANGE_CONTRACT | G07-LINUX-PACKAGE | Preserve the technical compiled Linux factory/archive/extraction proof. Its local-operator business success must become an explicit business denial; the equivalent corporate positive moves to G08 using the exact SF prod archive. Preserve actual enrollment/SQLite recognition only for legitimate maintenance/status; operator-only credentials cannot create/read C08 business state. Assert denial before any business effect. Version the produced factory receipt and factory-receipt-check.ts together so it does not require local-operator business200; distinguish technical packaging proof from required G08 corporate business proof. Preserve source revision, actual extracted bytes/hash, no-checkout dependency, tamper checks, current-choice fence and explicit fixture Team binding where the controlled authority component is exercised. Add actual checker/adapter negative cases for legacy operator-positive receipt, wrong technical proof role and candidate/tree/archive mismatch; do not duplicate the oracle. The factory technical receipt is independently verifiable before G08. Rejection of a missing corporate-positive G08 receipt belongs to the final aggregator and gate.test.mjs, not to a circular dependency in this factory step. |
| `script/sf-ci/gate.test.mjs` | CHANGE_CONTRACT | G01-CONTRACT-STATIC | Cobrir wiring/receipt das lanes suplementares obrigatórias, cobertura completa/disjunta e separação dos 40 consumidores ordenados; preservar reprovação de skip, baseline vazio, artefato extra e SHA diferente. |
| `apps/cli/test/sucafina-command-admission.test.ts` | NEW | G03-SF-INTEGRATED | Exercitar o handler+host SF real com Teams fixture autorizada; chamadas CLI run/continue/fork/attach/api/session list-delete/export-import/stats/mcp add-auth-logout/agent create sem contexto corporativo ou com owner errado negam antes de consulta ou efeito; incluir sucesso no mesmo owner e zero leituras/escritas alheias. |
| `script/sf-ci/browser-pool.test.mjs` | NEW | G04-ORDERED-BROWSER-POOL | Provar seleção exata dos 40 consumidores, registro uma vez, lifecycle real com startup antes dos casos e teardown depois, cleanup mesmo em falha, sem sharding ou filtros; impedir success com zero casos e com arquivo perdido. |
| `script/sf-ci/team-profile-residue.test.mjs` | NEW | G09-RESIDUE | Controles do auditor de resíduos: injectar repo fallback/caller indireto/conteúdo empacotado antigo faz falhar; preservar referência técnica explicitamente classificada; rejeitar exclusão ampla, ocorrência não classificada e inventário/bundle de outro SHA. |
| `modules/relay/tests/test_arm_binding.py` | KEEP_REGRESSION | G02-TARGETED-REQUESTS | Preservar binding pelo transcript do próprio subagente, recusa de tokens ambíguos e agent_id diferente. Teams authority é verificada no bridge Core antes de despachar; o token do arm não vira identidade corporativa. |
| `modules/relay/tests/test_arm_runtime.py` | KEEP_REGRESSION | G02-TARGETED-REQUESTS | Preservar lock concorrente, rollback de append falho, comando lossless e não duplicação de grade/charge/advance, com runtime real. Paths são workdir técnico, nunca seletor de profile SF. |
| `modules/relay/tests/test_arm_state.py` | KEEP_REGRESSION | G02-TARGETED-REQUESTS | Preservar terminalidade de escalation, orçamento de regressão e recusa de path traversal/ambiguidade de arm. |
| `modules/relay/tests/test_ledger_provenance.py` | KEEP_REGRESSION | G02-TARGETED-REQUESTS | Preservar oracle, origin, generation e policy stamp dentro da cadeia; não recalcular hashes históricos de ledger para disfarçar migração de projectId. |
| `modules/relay/tests/test_orchestra_relay_gates.py` | KEEP_REGRESSION | G02-TARGETED-REQUESTS | Preservar aprovação antes de nó, replay de decisão sem executar novamente e erro de edge. Nome do diretório é rótulo técnico do grafo nesta fixture, não Team ou principal. |
| `modules/relay/tests/test_orchestra_relay_ledger.py` | KEEP_REGRESSION | G02-TARGETED-REQUESTS | Preservar golden ledger byte-for-byte TS/Python, tamper detection e verificador vendorizado; migração de profile não reescreve cadeia aceita. |
| `script/sf-ci/team-profile-scanner.test.mjs` | NEW | G06-SCANNER | Validar admissão própria do candidato Teams: exact three controls, snapshot só .ci-run.json com parent único=produto, branch/digest correspondentes, setup e arquivo de ferramentas íntegros; rejeitar mistura da missão histórica, sourceBranch inventado, arquivo extra, seleção vazia/parcial, runner/env não admitidos e receipt de outro SHA. Provar cleanup/error ClamD setup sem reduzir controles reais. |

Na factory, a decisão é explícita: preservar instalação/extração/status e converter o acesso de negócio por operador em negativa. A obrigação positiva de criar o primeiro C08/current-choice, com seus fences, passa à spec G08 sobre o mesmo archive SF prod. Versionar conjuntamente o recibo e `factory-receipt-check.ts`; o verificador final exige a prova positiva G08 e não aceita factory isolada como conclusão.

Os positivos genéricos dos handlers CLI são regressões técnicas. O teste novo `sucafina-command-admission.test.ts` usa o host SF real para negar Basic/operator/diretório/ID conhecido sem contexto corporativo, cobrindo comandos de leitura e de efeito. Um stub que devolve 403 não prova que o servidor faz a verificação.

`test_profile_compile.py` e `test_shipped_profiles.py` do Relay tratam profiles de workflow, não o profile empresarial. Foram classificados e mantidos. O arquivo de compiler tem um caso opcional dependente de outro repositório no HOME; isso não é evidência da migração SF e não é contado no gate. Os seis arquivos de runtime/ledger Python explicitamente selecionados preservam concorrência, terminalidade e cadeia de prova; a nova autoridade Teams é exercitada no bridge Core/servidor.

## 5. Seleção exata e runners

As receitas no JSON são templates de planejamento; **nenhuma foi enviada ao CI**. Cada request tem alias validado, paths relativos ao pacote e runner explícito. `changeScopedRequest` serve aos recortes durante a implementação; na qualificação final, executar somente `finalRequest` não nulo. Os arquivos já selecionados pelo G03 completo não precisam de uma segunda execução idêntica: sua seleção e resultado reais no mesmo candidato devem ser demonstrados. Arquivos novos aparecem marcados como futuros, e helpers/scripts especiais não são misturados aos selectors.

### Correção do exemplo anterior

O selector correto é `"package": "sucafina"`, que o registry resolve para `modules/sucafina`. O path físico `"modules/sucafina"` não é um selector aceito pelo resolver deste pin. A alias legada `packages/sucafina` é aceita, mas as novas receitas usam o alias curto. Fonte: [test-ci-package.ts](https://github.com/gustavomhss/Orchestra-SF/blob/687759276c2c9121c2cfd20a5994b277ceb7ee4d/script/test-ci-package.ts) e [module-registry.json](https://github.com/gustavomhss/Orchestra-SF/blob/687759276c2c9121c2cfd20a5994b277ceb7ee4d/script/module-registry.json).

```json
{
  "package": "sucafina",
  "runner": "bun",
  "args": ["./Sucafinav1/test/microsoft-entra-client.test.ts"],
  "env": { "ORCHESTRA_EXPERIMENTAL_OMNI_SPAWNER": "1" }
}
```

O request de exemplo cobre um arquivo existente. A seleção completa da migração está em `requestTemplates`, incluindo contratos novos ainda não implementados.

| Tipo | Execução correta | Erro que o plano proíbe |
|---|---|---|
| Core/server/schema/protocol/CLI/módulos TS | `test-ci`, alias correto, `runner: bun`, arquivos explícitos. | Package path físico, nome aproximado, diretório/substr como se fosse arquivo exato. |
| app-shell src e test | Bun com condição `solid`, conforme runner; preservar preloads do pacote/CI. | Tratar como Vitest ou Playwright. |
| app-shell test-browser | Bun, condição `browser`, Omni preload e happy-dom. | Declarar que provou browser real, cookies reais ou duas janelas reais. |
| Jornadas Operations/Decisions/Reports | Playwright, config production, spec exata, workers 1, retries 0, repeat 1. | Usar coverage de uma spec como cobertura automática da nova Teams spec. |
| Operations E2E | `test-ci` e `sf-ci` já provisionam ClamD para a spec Operations. | Confundir isso com a lane especial dos controles `.check.ts`. |
| Python Relay | `package: relay`, `runner: pytest`; arquivos `tests/test_*.py` explicitamente listados. | Mandar Python ao Bun, ou chamar profile de workflow de profile por repositório. |
| HTTP exercise | Script real em modos coverage/auth/effect, todos com fail-on-missing e fail-on-skip. | Passar helper `test/httpapi-exercise/*.ts` ao Bun e contar zero testes como PASS. |
| Node de CI | `node --test script/sf-ci/*.test.mjs` no job planejado. | Usar `test-ci runner: node` para arquivo arbitrário: ele só aceita `*.node-smoke.mjs`. |
| Desktop Dock | Scripts próprios que compilam/iniciam Electron; fora do gate SF Web. | Chamar scripts standalone `.test.ts` de Bun unit ou prova Linux Web. |
| F04 transport-integration | Bun/Happy DOM dedicado, manifest real e GITHUB_ACTIONS verdadeiro; HTTP guest/malformed real e stale-before-dispatch. Não consome CDP. | Mandá-lo ao test-ci genérico ou tratar HTTP guest como login corporativo positivo. |
| Jornadas Teams/nativas instaladas | Playwright Linux com manifest privado, registry aprovado e contextos Microsoft originais anexados por CDP. | Inventar cookies/storageState ou passar variáveis de manifest pela allowlist genérica do test-ci. |

Alguns consumidores CI-SF são **Bun que abre Chrome real**: `consumer-dashboard.test.ts`, `decision-controls.test.ts`, `bi-lifecycle.test.ts`, `personal-views.test.ts` e `host-workbench.test.ts`. Isso não os transforma em specs Playwright. Preservar `channel: chrome`, Node/Omni quando usados e as deadlines; provisionar ou verificar o executável, versão e launch real antes da suite. O setup Chromium do test-ci hoje é condicionado a `runner: playwright`; disponibilidade de Chrome na imagem hospedada não foi observada neste estudo.

As cinco specs antigas `e2e/orchestra/*` ficam numa lane explícita de regressão compartilhada com `e2e/orchestra/playwright.config.ts`; essa config não cabe na allowlist do test-ci. Como ela faz build mas omite `metadata.bundle=production`, corrigir metadata/expectativas built-versus-dev antes de executá-la. Ausência de WIP/DebugBar e RTL real passam a ter assertions efetivas na spec SF; retorno antecipado de um caso não conta como prova.

Os recortes Bun preservam os defaults de canal dos pacotes para não mudar silenciosamente o significado das regressões. O canal de produção é explícito no Playwright production e nos builds/instalações G07/G08. Contexto corporativo nos unitários é construído pelo contrato do teste; uma env não prova a brand do binário entregue.

O request normal só admite `ORCHESTRA_CHANNEL=prod` e valores suportados de `ORCHESTRA_EXPERIMENTAL_OMNI_SPAWNER`. Variáveis SF de shard, manifest/CDP ou approval não são transportadas por esse campo. O job configura o que lhe pertence; os gates especiais têm contrato próprio.

### Baseline antes da implementação

Os requests contêm também `existingOnlyBaselineRequest`, sem arquivos futuros. A fase inicial observa os resultados reais no pin e nas seleções atuais, preservando assertions. Os bloqueios encontrados por leitura — inclusive fixtures de UI e provas nativas incompletas — não são falhas de CI já observadas. Registrar o baseline e dar destino explícito aos bloqueios; nenhum deles vira desconto permanente no gate final. Baselines pendentes só mudam depois de execução completa e revisão, e o candidato final precisa de nova prova vinculada ao seu conteúdo.

## 6. Sequência final obrigatória

Os dez gates abaixo formam a qualificação da mudança. Os comandos, cwd, entradas, pré-condições e arquivos exatos estão em `gates` e `requestTemplates` do JSON.

| Gate | O que rodar | Evidência exigida |
|---|---|---|
| G01 — contratos/static | Geração oficial, typechecks, compiler inclusion E2E, build web, guards/spawn, gate.test.mjs e seis testes de contrato operacionais. | Resultado real dos comandos; teste de wiring não substitui typecheck/guard. |
| G02 — recortes explícitos | 30 requests Bun/Python/Playwright para os 299 arquivos atribuídos ao G02, mais a lane própria das cinco specs Orchestra. | Arquivos selecionados, cases executados, exit status e Omni; snapshot ligado ao candidato. |
| G03 — SF integrado | As oito suites atuais, CI-SF em oito shards, static obrigatório e integração das lanes adicionais. | Todos os resultados no mesmo candidato; cobertura completa/disjunta, baseline real e nenhum job obrigatório ausente/skipped/cancelled. |
| G04 — pool ordenado | Executor explícito dos 40 arquivos fonte, com lifecycle pertencente à suite. | Startup antes dos casos, teardown após, cleanup em erro, cada caso atribuído e executado uma vez. |
| G05 — HTTP | `test:httpapi` equivalente aos três comandos exatos coverage/auth/effect. | Todos endpoints e negativas de autoridade cobertos, missing/skip falham. |
| G06 — scanner | Três `.check.ts` reais de ClamD/malformed/private-admission em lane admitida para o candidato. | Scanner e conteúdo reais; nova identidade não enfraquece os controles anteriores. |
| G07 — pacote Linux | Factory compile/extract, distribution web/native e assembler SF prod/branded, com digest e fonte reais. | Arquivo entregue auditado fora do checkout; build genérico/dev não substitui SF prod. |
| G08 — Teams instalado | Spec nova de Teams e provas nativas existentes indicadas na matriz, em Linux, com principal e tenant reais. | Sem repo/Git; A/B/A, contas distintas, duas janelas, revogação e admin sem Team. |
| G09 — resíduos | Auditor de fonte + caller/import graph + schema/client gerado + conteúdo e inventário do arquivo final. | Zero legado ativo, zero ocorrência relevante sem classificação e zero órfão; controles negativos plantados falham. |
| G10 — migração/restore | Ensaio real em Azure Linux descartável: checkpoint → corte → efeito confirmado → restore → restart → retry, acompanhado pelos contratos unitários de migração. | Dados e efeitos reconciliados; quarantine privada; nenhum replay indevido ou perda silenciosa. |

### 6.1 Pool ordenado: trabalho de CI definido

O [manifesto atual](https://github.com/gustavomhss/Orchestra-SF/blob/687759276c2c9121c2cfd20a5994b277ceb7ee4d/sf/ci/suites.json) exclui 40 arquivos porque eles alcançam `wp01/browser-fixture.ts`. Essa fixture valida argv, mas isso não atesta a ordem real de execução do Bun. Portanto não basta enfileirar 40 paths.

Criar `script/sf-ci/browser-pool.mjs`, seu teste Node e `Sucafinav1/test/product/wp01/browser-selection.test.ts`. O entrypoint único possui startup/teardown e registra os casos da seleção exata; adaptar a fixture e os dois arquivos de lifecycle para evitar dupla execução. O manifesto preserva o conjunto de provas e o relatório atribui os casos aos arquivos de origem. Integrar a lane ao `verify.needs` e ao verificador de pré-requisitos, mantendo as oito suites atuais.

### 6.2 Scanner e pacote: contratos especiais

Os três `.check.ts` são testes executáveis, não helpers. A campanha atual `sf-operations-scanner` verifica branch/envelope/missão/digest e parent do snapshot. O setup também restringe branches; não funciona como script genérico de `sf-ci`. Antes de executar no candidato Teams, acrescentar o job `teams-profile-controls` ao workflow existente e o validador `script/sf-ci/team-profile-scanner.mjs`, com teste Node irmão. A admissão usa namespace `tp-scan-*`, envelope `teams-profile-scanner-v1`, SHA/tree reais, request exato com três arquivos e snapshot de parent único que só altera `.ci-run.json`. Adaptar setup/service somente para esse modo comprovado, preservando digest, ownership de portas, clean/EICAR/size-error e cleanup. A campanha histórica permanece intacta. Não falsificar `sourceBranch`, missão ou approval para reutilizar uma receita.

A lane factory atual só dispara em `sfa-factory-package` ou PR elegível para `close-final-candidate`; não tem dispatch genérico. A receita final escolhida usa um PR elegível do candidato para `close-final-candidate`, e verifica que o checkout é o head exato desse PR. Para `sf-ci`, usar dispatch na branch isolada já pinada ao mesmo candidato; um run de PR sobre merge sintético não vira evidência do head por conveniência. Criar uma branch de implementação não dispara automaticamente a prova factory.

### 6.3 F04 instalado e tenant

As funções existentes `registerInstalledProofFromHost` e `consumeInstalledSuiteFromHost` não constituem um instalador/workflow pronto. Precisam de `ApprovedInstalledHost` real. A lane planejada é `qualify-teams-profile-linux`, no novo `.github/workflows/teams-profile-linux-qualification.yml`, sem deploy implícito. A expansão de register/consume para o tipo de prova Teams é explícita: hoje as APIs suportam U15/U39/U40. Ela usa:

- `SF_NATIVE_INSTALLED_MANIFEST`: manifesto privado derivado do registry aprovado;
- `SF_NATIVE_CANDIDATE_SHA`: SHA exato do candidato;
- `SF_NATIVE_BROWSER_ENDPOINT_FILE`: arquivo 0600, em raiz privada 0700, apontando para CDP loopback;
- contextos Microsoft reais anexados, sem criar/importar sessão autenticada artificial.


O arquivo existente `packages/app-shell/test-browser/sucafina-native/transport-integration.test.ts` recebe `CHANGE_CONTRACT` e um step Bun próprio nessa lane. Preservar os três casos: guest real sem cookie rejeitado, selector inválido rejeitado e geração antiga sem nenhuma chamada de rede. O test-ci genérico força `GITHUB_ACTIONS=false` para Bun, enquanto `readNativeManifest()` exige `true`; essa prova não cabe no runner genérico nem na allowlist de env. Ela usa o manifesto real, mas não consome CDP nem comprova um login positivo. A spec Teams instalada fornece as jornadas autenticadas.


As três suites existentes `e2e/sucafina/native/journeys/u15.spec.ts`, `u39.spec.ts` e `u40.spec.ts` também recebem `CHANGE_CONTRACT` e permanecem obrigatórias, em três invocações separadas, com seus capítulos/bundles reais. A nova spec Teams não as substitui. A leitura focal identificou outro bloqueio pré-existente: U39/U40 registram apenas `entry`, enquanto seus testes exigem `empty`, `source`, `readonly`, `denied`, `revoked`, `stale` e `late`; o harness não entrega `selectedCase` nem os callbacks reais de revogação/segundo writer. Corrigir o modelo por caso, inclusive readonly sem edit e empty sem registro individual, e fornecer as operações reais antes de qualificar a suite inteira. Não basta ampliar uma enum ou mapear todos os títulos para `entry`.

O pai unitário `test-browser/sucafina-native/fixture/journeys.test.ts` também muda: URLs e command.query preservam o selector Team completo, além das rejeições de outro shell/capítulo/hash. Esse teste pertence ao Bun/Happy DOM da CI-APP-BROWSER; ele não exige manifesto LIVE.

O `sf-release.yml` atual falha deliberadamente por ativação Azure ainda não composta. Esta investigação não muda esse estado nem afirma release pronta. Primeiro corrigir o round-trip F04 e compor a lane Linux; depois executar a spec exata registrada. Falta de ambiente real é falta de prova, nunca justificativa para aceitar um teste mock como LIVE.


### 6.4 Artefato, recibos e recuperação operacional

O job novo `teams-profile-artifact`, dentro de `sf-ci`, faz checkout do candidato exato, executa o assembler SF de produção com `SOURCE_REVISION` igual ao HEAD real, grava o tar fora do checkout e publica bytes, inventário e SHA-256. `teams-profile-residue` depende desse job e verifica o mesmo archive. A instalação e a recuperação posteriores devem consumir esses bytes; o recibo de factory genérica/dev não pode ser reetiquetado como pacote SF prod.

Os recibos suplementares usam namespace próprio `teams-profile-evidence-*`. O verificador atual exige um inventário exato de `sf-evidence-*`; acrescentar jobs apenas em `needs` não faz o verificador ler os novos resultados. A extensão planejada em `gate.mjs` valida nomes, seleção, blobs, cases, identidade de produto/artefato e resultado dos jobs, preservando as oito suites e suas baselines. Requests de recorte têm um SHA de snapshot diferente do candidato: validar parent único e diff exclusivo de `.ci-run.json`, conservando ambos os SHAs. Nunca converter o SHA do recibo para fazê-lo parecer o candidato.

A spec nova `e2e/sucafina/native/teams-profile-recovery-linux.spec.ts` pertence ao job `migration-restore-linux` do workflow de qualificação Linux, numa instalação descartável admitida. O runner Playwright existe; a spec, o contrato operacional e sua integração ainda serão implementados. Exige checkpoint real, efeito e recibo pós-checkpoint, restore pela superfície autorizada, restart e retry sem repetição. Ausência de recibo suspende o efeito. O administrador corporativo sem Team deve poder recuperar a instalação, sem ganhar leitura geral do negócio.

O modo planejado `gate.mjs verify-teams-profile` encerra a qualificação somente depois de verificar os recibos G01–G10, incluindo restore. Paths nativos aninhados têm seleção/validação própria: a suite SF ordinária não os descobre automaticamente. Logs/relatórios LIVE completos permanecem privados; publicar somente evidência minimizada e vinculada ao conteúdo real.


### 6.5 Produtores operacionais e testes Azure

O [complemento de qualificação](./teams-profile-qualification-review.json) fecha 12 achados de pipeline e 13 fontes operacionais. `sf/azure/vm/deploy.py`, `sf/azure/runtime/identity_health.py`, `sf/azure/vm/probe-serving.py`, `sf/azure/identity/az02-proof.cjs` e `sf/azure/recovery/recovery.py` fazem parte do corte de identidade. O owner/probe antigo usa `projectId`; o health exige destinations de negócio; rollback depende dele. A recuperação administrativa sem Team precisa de contrato explícito próprio e da autorização real do produto — executar um script como root não demonstra essa autorização.

Preservar os 13 casos existentes de `test_contracts.py` e `test_flamengo_demo_contract.py`. Eles protegem estrutura/hash/permissões do bundle e configuração pública de Microsoft/grupos de papéis; não provam tenant, Team ou restore. Acrescentar quatro arquivos: `test_teams_profile_identity_contract.py`, `test_teams_profile_artifact_contract.py`, `test_teams_profile_recovery_contract.py` e `az02-proof.test.cjs`, nos paths completos do catálogo. Os seis arquivos rodam no job novo `teams-profile-operations-contracts`, com comandos Python stdlib/Node explícitos, incluído nos prerequisites e no inventário de recibos. O nome deste job prevalece sobre a sugestão genérica Orchestra-regression do complemento.

O executor AZ02 existente também muda e preserva seus 32 casos em seis fases. A receita exata e as flags de cada fase estão no complemento; são prova HTTP operacional com inputs privados reais, separada dos testes unitários do validador. Candidato, tree, tar interno e binário têm hashes distintos e precisam de observação independente.

Os comandos atuais de recovery são `checkpoint`, `verify-clone`, `vault-backup`, `vault-restore-disks` e `rollback-code`. Cada um tem uma classe limitada de prova. Um checkpoint para o serviço e o mantém parado; clone comprova integridade de arquivos; job Azure concluído não comprova retomada segura da aplicação; rollback de código não restaura banco. A sequência G10 ainda exige composição explícita e ambiente Azure descartável observado, incluindo IMDS/LUN/volumes/serviço, approvals de ação já exigidos e fonte monotônica de recibos fora do snapshot.

No workflow factory, retirar a restrição de paths do PR de qualificação para `close-final-candidate`: ela pode omitir mudanças apenas de Core/Server/Schema/engine/assembler. Publicar também o recibo/tar web-native gravado na raiz de `distribution-logs`, hoje fora do upload `<run>-<attempt>`. Ausência desse artifact não será transformada em PASS por existir outro recibo da mesma execução.

## 7. Prova de “sem sujeira”

O auditor de resíduos deve produzir um ledger por ocorrência relevante: arquivo, símbolo/linha, produtor, callers, destino, dono técnico, gate e motivo para o que permanece. A busca abrange source, configs, testes, fixtures, código gerado, i18n, builders/parsers de URL, comandos, docs ativos, prompts e skills empacotados. São necessárias duas passagens: árvore de fonte do candidato e arquivo SF de produção entregue.

As sementes incluem `repo-`, `appDockProfile`, `McpProjectConfig`, `trusted_projects`, `profileProject`, `ProjectID.global`, fallback de cwd/diretório, `settingSources: project`, profile/global/default do Dock e chaves legadas de persistência. Identificadores `projectId/project_id` precisam de análise do papel; não são banidos cegamente.

Cada remoção exige também eliminar export morto, rota registrada, schema aceito, caller indireto, writer, migration automática de restore e mensagem/instrução que reproduza o modelo antigo. Testes de negação devem acionar esses caminhos; esconder a UI ou desligar uma flag não remove a lógica.

O aceite G09 exige `activeLegacy = 0`, `unclassified = 0` e `orphan = 0` no escopo real SF, com detalhes verificáveis. Os números não foram medidos neste estudo. O próprio auditor recebe controles negativos que introduzem fallback/caller/conteúdo antigo e devem fazê-lo reprovar. Nenhuma exclusão ampla de `tests/`, `docs/`, gerados ou módulos permite “zerar” o resultado.

## 8. Organização da implementação

1. **Contrato único:** dono de Schema/Protocol/authority define TeamProfileRef, owner privado, revisions, política/admin sem Team e formato de URL/stamp. Transporte escrito à mão e gerados mudam no mesmo corte.
2. **Runtime e stores:** config, session, eventos e efeitos recebem o contexto admitido; mapa de migração e fence são definidos antes de backfill. Integrações não preservam fallback por diretório para a UI antiga.
3. **Shell:** estado por janela/conta/equipe, drafts, caches, UI narrow, novos chats e URLs migram em conjunto. Resposta tardia de outra autoridade é descartada, inclusive quando a leitura nova falha.
4. **Dados e credenciais:** dry-run/quarantine/retomada; preservar evidência e efeitos. Sem associação automática de material ambíguo.
5. **Conteúdo e entradas secundárias:** CLI, engines, plugins, skills, prompts e paths indiretos recebem a mesma barreira; remover código antigo sem consumidor.
6. **Qualificação:** gates direcionados durante as mudanças; uma passagem integrada no candidato final, seguida das provas de arquivo/instalação/tenant/restore que não pertencem ao Bun unit.

Os caminhos e decisões já enumerados não voltam a ser “investigar no WP0”. O trabalho restante de WP0 é reconciliar o delta da base de execução, materializar o ledger final de ocorrências e obter o censo de dados reais — coisas que não podem ser inferidas deste código. A implementação só fecha depois das provas; a preparação fecha quando cada fronteira tem destino e cada obrigação tem teste e runner.

## 9. Evidência e limites

Este trabalho usou leituras e alterações documentais pelo GitHub. Nenhum checkout, build, teste local, Actions, sessão de browser, tenant, Azure ou dado de produto foi alterado. As branches auxiliares contêm apenas relatórios de investigação; somente blobs documentais conhecidos são consolidados em `teams-profile-plan`.

Os contratos de teste e scripts foram inspecionados, não executados. A validação estrutural da matriz não equivale a rodar o validator do repositório. A execução futura deve verificar paths novos existentes, seleção não vazia e requisitos de cada runner, sem silenciar guards ou diminuir a cobertura.

A consolidação passou por **19 verificações documentais de consistência**, sem divergência restante: unicidade, pin/blob, propostas separadas, gates, substitutos, A01–A46, pais de helpers, cobertura do pool e dos 213 candidatos, aliases/selectors/env e partição dos requests. Isso é validação do documento, não execução do código do repositório.

O catálogo registra 44 receitas para trabalho incremental, das quais **30 finalRequest não nulos selecionam 299 arquivos**, sem duplicação entre requests finais. Os testes já incluídos no G03 completo não exigem recorte redundante, mas continuam exigindo casos/resultados reais no mesmo candidato. A regressão estrutural adicional de 224 pais tem blobs do pin e relações de import/helper verificadas; seus corpos não foram revisados individualmente neste complemento.

Não há certificado de ausência de resíduos, baseline PASS, aprovação de ambiente, tenant validado ou produto implementado nesta entrega. A preparação agora contém destinos e provas determinados; o aceite da implementação depende dos dez gates reais.
