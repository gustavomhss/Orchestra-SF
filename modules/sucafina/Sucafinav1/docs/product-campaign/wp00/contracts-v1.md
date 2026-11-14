# Contratos de produto v1

Fonte: plano `dbf9547211d9b0fade619790de7c19c0869b7c7d`, canônico SHA-256 `703dd257274bed829a978705de548cd1383225bf7aac76445104c053e2bb5fba`. O inventário `product/contracts/freeze-v1.json`, revisão 8, liga C01–C17 aos bytes atuais, módulos, exports, produtores, consumidores, cinco perfis, dezoito skills, oito packs, 39 operações e seis provas. Os hashes fixam conteúdo; não autenticam uma carga nativa nem atestam aceite do consumidor. As divergências e provas históricas de consumidores permanecem pinadas em [consumer-deltas.md](consumer-deltas.md); o aceite da árvore composta exige seus próprios checks, consumidores e evidências. Este documento não declara G0, GNATIVE ou liberação global.

| Contrato | Exemplo admitido | Exemplo recusado ou pendente |
| --- | --- | --- |
| C01 | Seletores de período explícito, moeda e referência; identidade injetada pelo host autenticado. | `principalRef`, provider ou concessões nos argumentos; período ausente ou impossível. |
| C02 | Componentes calculados pelo domínio com origem, granularidade, ausência e drilldown. | Um total de BI recalculado por outra fórmula; soma de moedas sem conversão comprovada. |
| C03 | Comando com versão esperada, alvo/encarnação e chave/digest idempotentes. | Versão velha, mesma chave com outro conteúdo ou alvo substituído. |
| C04 | Prévia sobre a mesma origem e comandos canônicos; manifest público aponta para operações privadas. | Prévia que grava, Apply sem reprévia após mudança ou metadados de instalação importados. |
| C05 | Captura preservada com fontes, versões, competência e comentários históricos. | Reescrever revisão antiga após mudança da origem; exportar sem revalidar acesso. |
| C06 | Confirmar o escopo observado com fingerprint canônico e CAS da unidade de armazenamento. | Confundir versão observada com versão de armazenamento; tratar ausência como zero ou revisão como aprovação. |
| C07 | Receita publicada/pinada, admissão vigente, run nativo e retorno revisável. | Run inventado, nova aprovação financeira implícita ou recursão de `routine-result`. |
| C08 | Uma Persistence existente, metadados protegidos, Request mantido no host e operação direta pela UI. | Quarto Surface, listener/store paralelo, papel Dashboard usado como acesso transversal ou Session de IA obrigatória para edição. |
| C09 | Caso persistido, fontes C17 resolvidas, alternativas, escolhas históricas e recibos. | Caso fictício em memória para satisfazer GNATIVE; alterar silenciosamente a escolha histórica. |
| C10 | Inventário versionado de custos; comparação `conditioned` mantém diferença completa nula. | Omitir training para obter `complete`, dobrar componente compartilhado ou chamar subtotal de benefício confirmado. |
| C11 | Saída decodificada por tipo, versões, modelo real e proveniência de execução. | Payload desconhecido marcado ready, resultado atrasado sobre versão nova ou import-preview apresentado como domínio aplicado. |
| C12 | Aplicação pelo domínio, recibo no mesmo snapshot e recuperação depois de resposta perdida. | Prometer atomicidade entre surfaces ou repetir mutação porque o caso ainda não recebeu o recibo. |
| C13 | Reavaliação e recall autorizados, com diferenças atuais e escolha original preservada. | Selo de atualidade em cache depois de revogação; causalidade inventada. |
| C14 | PDF digital, DOCX ou texto com origem/trecho e confirmação; portfólio com cobertura explícita. | Alegar OCR, aceitar caminho arbitrário, confundir extração com fato confirmado ou combinação incompleta com elegível-completo. |
| C15 | Cinco perfis, dezoito fontes reais, digests de bytes/instruções e carga observada antes do prompt. | Catálogo sem carga, digest pendente, fonte com hash de si própria ou Revisor na execução do autor. |
| C16 | Lease privada por identidade, Tool.Context real, skill/grant/ACL atuais e transporte MCP privado. | Binding/lease/UI fabricados por JSON, provider homônimo, reuso de lease ou bypass de skill no harness direto. |
| C17 | Ledger oficial, referência empresarial, scanner real e Atlas derivado no commit protegido. | Owner técnico/PR fictício, referência sem autorização atual, sucesso antes do commit ou memória local substituindo Atlas. |

`runtime.ts` fornece as assinaturas das factories T06. `TrustedCallContext` nativo e `TrustedUiContext` pertencem a registries privados distintos; seus campos e brands não autenticam por si. A ponte MCP aceita somente o caminho nativo. Ambos convergem no handler de domínio, que reautentica o Request e aplica a ACL/CAS vigente. Recibos discriminam proveniência nativa, UI e recusa sem binding: não há run ou generation fictícios para UI.

O provider C08 usa `expectedStorageVersion` por namespace, separado da versão observada da fonte e da revisão agregada. `additionalNamespaces` admite uma operação atômica de metadados, por exemplo Atlas e outbox, somente com autorização e CAS de todas as seções. Não cria transação global entre domínios. `preview` não é commit; retry exato revalida autoridade e encarnação atual antes de recuperar o resultado. Import, export, projeções e auditoria genérica ainda precisam integrar a proteção em seus entrypoints reais antes do aceite de produto.

Os schemas das 25 contribuições, 39 saídas de operação, dezoito entradas de skill e um envelope são gerados dos tipos por `bun run modules/sucafina/Sucafinav1/product/contracts/generate-output-schemas.ts`. `--check` exige os mesmos bytes; `schema-admission.ts` recusa argumentos extras, referências sem definição e estados estruturais incompatíveis. Validação estrutural não substitui a autorização, os cálculos originais ou as verificações semânticas dos produtores.

As dependências adicionadas em `@orchestra/sucafina` são necessárias às portas já previstas: `@orchestra/core` e `effect` para o host nativo, `@modelcontextprotocol/sdk` 1.32.0 para o par MCP em memória, `@orchestra/atlas-boundary` para os módulos canônicos e `@orchestra/rag-studio` para documentos. Os três pacotes Orchestra são workspaces existentes; Effect usa o catálogo existente e o SDK usa a versão já pinada pelo Core. Nenhum cliente ou serviço global é instalado.

O corpus financeiro v2 usa os vetores FX01/FX03 explicitamente fornecidos: budget 600000, actual fechado 400000 e forecast aberto 190000, com a licença de 72000 já incluída em novembro. Substituí-la por 84000/78000 produz outlook 602000/596000. O v1 de staging foi rejeitado para consumo; volume e medições só recebem aceite após os consumidores e provas correspondentes.

## Consumer corrections before G0

### Emenda de compatibilidade C11: AlternativeDraft

O tipo existente de `sf_alternative_draft` também é uma saída de contribuição `AlternativeDraft` para `sf_portfolio` e `sf-compor-portfolio`. A proposta conserva `domainApplied: false`, o resultado determinístico e sua cobertura; a origem, o digest e o recibo pertencem ao envelope C11. A confirmação humana para incorporar a proposta à campanha permanece separada em C08. A emenda não adiciona operações ou grants. A revisão 7 de `freeze-v1.json` inclui a mesma matriz do contrato normativo. Os assets distribuídos do WP12 presentes no seed ainda omitem `AlternativeDraft`; `createResidentAiBundle` recusa essa divergência. O teste positivo de consumidor exige a carga real dos bytes pelo loader e não converte essa recusa em aceite.

DecisionCase stores its append-only CaseLedgerEvent ledger; read returns AuthorizedCaseProjection. Its context discriminates native (profileId required) from UI (no resident profile fabricated). The case factory receives a host-resolved creation target tied to the current installation and a privately validated operation identity. Only an explicitly uninitialized state admits section version zero; invalid stored state fails closed. Case membership and each current evidence reference are authorized before disclosure and rechecked at egress without nested cross-surface transactions.

Directory lookup returns authorized IDs only. Public backups, legacy projections, dataset conflicts and audit rendering exclude __sfProductV1; imported private product metadata is refused and existing private state survives ordinary business dataset replacement. These boundaries require hosted acceptance; this document is not their execution proof.

## Vocabulário e resultados de erro

| Termo | Contrato de interpretação |
| --- | --- |
| Registro | `surface` + tipo + ID + `incarnation`. Reutilizar o ID textual depois de substituição não conserva a identidade anterior. |
| Versão de origem | Versão efetivamente lida do registro; difere da revisão do namespace de armazenamento e da revisão agregada de produto. |
| Exercício | Ano de planejamento do domínio. Uma comparação explicita também o intervalo `Period`; não presume que o ano selecionado resolve todos os meses. |
| Moeda | Unidade explícita. Conversão usa a cotação identificada pelo domínio; falta de FX não vira zero e soma sem conversão não é total comparável. |
| Período de referência | Datas de calendário válidas e inclusivas `start`/`end`; meses e agregados retêm a granularidade e as fontes. |
| Atualização | `observedAt` e versão identificam a observação, não concedem validade permanente. Leitura, retorno e reutilização revalidam acesso e dependências. |
| Fonte | `SourceRef`/`BusinessEvidenceRef` são seletores versionados; o resolver confirma origem, encarnação, digest e autorização atual. Um digest sozinho não autentica o autor. |
| Capacidade de acesso | Vem do principal autenticado, perfil/skill carregados, grant e regra vigente. Nome de ferramenta, owner ou perfil não cria autoridade. |
| Ausência | `null`/`absent`, campo omitido, zero observado, valor herdado, estimativa e hipótese conservam significados separados. |

`PortResult` distingue `needs-input`, `stale`, `denied`, `unavailable`, `conflict`, `provider-conflict` e `failed`. `CapabilityResult` mantém a recusa sem payload; o recibo discrimina native/UI/unbound. `SfStateResult` distingue leitura/escrita `ok`, `preview` sem commit e `denied`/`unavailable`/`conflict`. Os consumidores preservam esses estados; não substituem erro por lista vazia, total zero ou selo de completude. Detalhes restritos não seguem na causa pública.

## Formato → parser → comando → persistência

Todos os paths abaixo são relativos a `modules/sucafina/Sucafinav1/`. O parser e a composição de importação são WP06; Dashboard e Planner continuam donos dos comandos; WP10 continua dono da autoridade e de `Persistence`.

| Entrada | Parser/normalização WP06 | Comando puro existente | Composição persistente |
| --- | --- | --- | --- |
| XLSX/XLS Planner e roster `All Members` | `product/imports/files.ts#parseAdmittedImport` → `runtime/workbooks.ts#parseWorkbookDetailed` | `product/imports/planner.ts#preparePlannerWorkbook` usa `runtime/planner.ts` / `import-workbook`; nenhum total calculado é importado | `product/imports/planner-atomic.ts`, `createSfImportHost`, `DomainPortHost` e `Persistence` WP10 |
| XLSX/XLS Dashboard membros/projetos/tickets | Mesmo parser; `product/imports/dashboard-command.ts#buildDashboardWorkbookCommand` seleciona planilha e período | `Talent Review/import`, `All Projects/import`, `IT Operations/import-month` nos domínios existentes | `product/imports/dashboard-atomic.ts`, `createSfImportHost` e mesma `Persistence` |
| Backup JSON Dashboard | `product/imports/files.ts#parseAdmittedImport`, migração canônica de backup | `backup-import` existente, sem aceitar metadados privados da entrada | Mesmo caminho atômico Dashboard, preservando `__sfProductV1` confiável |
| PDF digital, DOCX e texto | WP06 `product/documents/parser.ts`, `docx.ts`, `rag-adapter.ts`; não são imports financeiros | C14 `DocumentEvidence`, confirmação humana e fonte C17; nenhuma alteração oficial pela extração | WP10 porta documental e namespace `documents`; C09 recebe referência autorizada |

`sf_import_preview` é a única operação de importação do catálogo MCP. Produz `ImportManifest` público; não transporta `PreparedCommand.command` e não aplica. `product/imports/apply.ts#applyImport` exige entrada UI, confirmação humana, reprévia e a operação atômica do host. O catálogo detalhado do proprietário é `product/imports/FORMATS.md`.

## Layout C08 e migração requerida

`state-layout.ts` congela a correspondência entre os doze namespaces e seus campos. É um contrato declarativo, consumível por WP10; não implementa outro store. `schemaVersion` permanece 1 porque os acréscimos são aditivos.

| Namespace | Campos próprios |
| --- | --- |
| `cases` | `cases`, `claimBindings`, `commandProposals`, `compositeScenarios`, `decisionResults` |
| `contributions` | `contributions`, `nativeRuns` |
| `bi-artifacts` | `biArtifacts` |
| `preferences`, `reviews`, `relations`, `threads`, `confirmations`, `documents`, `receipts`, `atlas`, `outbox` | Campo homônimo |

`schemaVersion`, `revision`, `versions`, `incarnation` e `transactions` são metadados exclusivos do provider. Na migração de um v1 antigo, WP10 preserva dados, recibos e encarnação existentes e inicializa apenas o namespace/campos aditivos ausentes em staging. Ler ou retornar `preview` não persiste migração. Uma escrita confirmada grava a migração e o efeito no mesmo commit existente. Repetir a mesma chave/digest recupera o recibo sem executar callback nem avançar novamente as versões. Tipo ou revisão inválidos não são reparados silenciosamente.

`expectedStorageVersion` protege o namespace escrito; `additionalNamespaces` exige autorização e CAS para todas as outras escritas. `checkNamespaces` exige leitura autorizada e a versão esperada das dependências sem avançar suas revisões. A releitura no retorno também precisa confirmar a mesma autoridade. Alterar um campo pertencente a outro namespace recusa o commit, inclusive os seis campos aditivos. O provider no seed não satisfaz integralmente este contrato; as assertions positivas de `contract-consumers.test.ts` mantêm o bloqueio observável.

## Escopo das provas

`contract-freeze.test.ts` confere bytes, cardinalidades, schemas, grants/rotas, exports dos contratos e ownership dos campos. Isso comprova a integridade da definição, sem executar as 39 operações. `contract-consumers.test.ts` exige também os exports reais de todos os produtores e usa o loader distribuído real e o provider C08 real com o fixture sintético de Persistence do repositório; qualifica compatibilidade e recusas do provider, sem alegar durabilidade de produção ou autenticação empresarial.

As provas nativas C07/GNATIVE e AM01–AM06 continuam exigindo host, modelo, Session/SkillLoadReceipt, MCP privado, domínios e consumidores reais. O seam ratificado é `Tools.Service`/`Tool.Context` por Location, e os nove paths de empacotamento Atlas permanecem exclusivamente de WP10.T07 conforme `normative-contracts.json.packaging.exact_atlas_paths`. Nenhum teste estrutural, scanner substituto ou catálogo isolado fecha essas provas.

## Revisão 8 — composição do host e proveniência dos bytes

Esta revisão reconcilia a definição WP00 com a composição Astra na PR #32. A base publicada observada é `ff7a99753d1fd1bc8b68b4f2642fed26e3cadbdf`; o conjunto documental de origem vem da PR #20 em `0a5ce33012d008af1f56d11596a1f1f4eaba5b9d`. A revisão 7 do freeze é preservada como origem na proveniência do manifesto. O commit que contiver esta revisão identifica o candidato de produto; nenhum SHA futuro, check futuro ou aceite é presumido.

O contrato privado `host-context.ts` conserva `productView`, `forecastInputs` e `sourcingInputs` já compostos e publica o tipo canônico `SfAnalysisInputPort` e o membro opcional `analysisInputs`. `prepare` recebe `TrustedUiContext`, a requisição de análise sem um `contextFingerprint` escolhido pelo consumidor e a seleção a revalidar; retorna `PortResult`. O adaptador CLI usa o mesmo tipo canônico. Isso descreve uma preparação humana autorizada no host existente: não acrescenta operação MCP, perfil, skill, grant, autoridade financeira, store ou engine. As verificações efetivas de contexto, principal e seleção continuam responsabilidade das implementações e de seus consumidores reais.

O manifesto confere os bytes finais de 20 artefatos de contrato, dos 17 documentos WP00 incorporados e do consumidor CLI de `SfAnalysisInputPort`. Os paths de `artifacts` são relativos ao diretório de contratos. A inclusão dos documentos cobre também os três inputs importados pelos testes de baseline/ownership; registros e patches históricos mantêm seus pins e são conteúdo documental, não instruções para substituir código composto. `consumer-deltas.patch` não é aplicado por esta revisão.

As definições C01–C17, cinco perfis, dezoito skills, oito packs, 39 operações, AM01–AM06 e schemas normativos permanecem idênticos à revisão 7. `normative-contracts.json`, `generate-output-schemas.ts` e `output-schemas.ts` conservam seus bytes; a emenda de host não altera schemas de entrada ou saída de operações. As oito seleções finais, três revisões independentes, C/G7 e D/G8 permanecem obrigatórios.

O erro observado no primeiro CI da composição foi uma divergência de digest: o freeze ainda fixava `host-context.ts` em `76aa3e83af0cf7e8a568fe0f9ce988c9c6fa30d8278cc34559bf6512e335a02b`, enquanto o candidato executou `de63ec47412f45367e0be68eb8ee59c8f8149c8a8c31220e75a319e2197432f2`. Esta revisão vincula o contrato final staged a `0476febc21bf87c35a734e4cae028bc4fee2f72ccfebfd30a0490ecf44fae055`. A assertion de revisão passa de 7 para 8; a igualdade exata de cada digest, a exclusão do próprio freeze e todas as assertions da matriz continuam exigidas.

A preparação desta emenda calcula hashes e compara metadados sem executar testes de produto localmente. O resultado anterior de CI permanece pertencendo ao seu W/S. A revisão 8 fica `NOT_REVALIDATED` até o CI cirúrgico do candidato composto, com `bun typecheck` no package e guards correspondentes. Documentação, hashes e compatibilidade de tipos não autenticam execução nativa, C15 carregado, persistência de produção, GNATIVE ou GLOBAL_RELEASE.
