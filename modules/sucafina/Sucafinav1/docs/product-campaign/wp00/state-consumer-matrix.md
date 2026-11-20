# WP00 — Matriz de estados C08 e formatos importáveis

## Resultado e limite do aceite

O levantamento de fontes está concluído para o **W6 `29f40e0f0fafa8d526df9b280151962187f1440d`**. O critério **WP00.T02.CHK.03 permanece PARCIAL**: há estados declarados ou gravados sem um par completo de produtor e consumidor de negócio. A matriz registra a lacuna, o responsável pelo delta e a implementação necessária; não atribui uma linha genericamente a “integração”.

> Para cada formato importável e cada estado novo persistido, apontar exatamente um produtor e o consumidor real; nenhum aparece como responsabilidade genérica da integração.

O arquivo [state-consumer-matrix.json](./state-consumer-matrix.json) é a matriz completa e legível por máquina. Cada endpoint contém export, membro quando aplicável, caminho completo, commit W6, SHA do blob e linhas observadas. A inspeção cobre os **255 arquivos TypeScript de implementação em `product/`**, excluindo contratos, e os **26 arquivos TypeScript da composição CLI SF**. O JSON conserva o inventário de caminhos e blobs, além da árvore de produto completa usada para delimitar as conclusões de ausência.

| Cobertura | Quantidade | Interpretação |
| --- | ---: | --- |
| Campos de produto C08 | 17 | Todos associados a famílias da matriz |
| Namespaces C08 | 12 | Inclui o namespace declarado `bi-artifacts` |
| Famílias de estado | 46 | Dicionários são separados por função de negócio |
| Famílias com produtor e consumidor localizados | 38 | Evidência estática de implementação |
| Famílias com produtor, sem leitor de negócio localizado | 4 | Não classificadas como par completo |
| Campos declarados sem produtor nem consumidor localizado | 4 | Não tratados como implementação |
| Campos exclusivos do provider | 5 | Metadados, separados dos produtores de negócio |
| Obrigações de rotina/schedule sem implementação | 4 | Sem inventar uma chave ou um namespace persistido |
| Caminhos de formato importável/documental | 14 | 10 workbook + 1 JSON + 3 formatos documentais |

O [layout C08](<https://github.com/gustavomhss/Orchestra-SF/blob/29f40e0f0fafa8d526df9b280151962187f1440d/modules/sucafina/Sucafinav1/product/contracts/state-layout.ts>) é a fonte dos campos e namespaces. As [regras de migração e de escopo das provas](<https://github.com/gustavomhss/Orchestra-SF/blob/29f40e0f0fafa8d526df9b280151962187f1440d/modules/sucafina/Sucafinav1/docs/product-campaign/wp00/contracts-v1.md>) continuam valendo: definição ou leitura de fonte não comprova compatibilidade do provider, commit durável, restart, UI autenticada ou GNATIVE. Nenhum teste, typecheck, bootstrap, fluxo de browser ou execução nativa foi rodado para produzir esta matriz.

## Como ler a matriz

“Produtor” identifica uma única entrada canônica que cria o estado ou normaliza o input de negócio naquela linha. Atualizações legítimas do mesmo registro continuam existindo; a escolha de uma entrada canônica não afirma que a função seja o único ponto de escrita de todo o domínio.

“Consumidor” identifica uma implementação que lê o estado ou aplica o input em um fluxo de negócio. Import de tipo, declaração de schema e conferência feita dentro da própria escrita não substituem um leitor ausente. Quando o consumo passa por um adapter, o JSON também registra o leitor ou a composição concreta, sem acrescentar outro produtor canônico.

O campo `owner` expressa a responsabilidade de negócio pelo endpoint. `pathOwner` vem dos grants publicados em `ownership-v1.json`. Um `pathOwner: null` conserva uma lacuna de grant exato; este levantamento não concede escrita, muda ownership ou autoriza publicação em outro prefixo.

## Estados persistidos e declarados

As famílias ativas e históricas estão separadas quando seus consumidores diferem. Isso evita que a existência de um leitor da preferência ativa seja usada como prova de consumo do histórico preservado.

| Família | Produtor canônico | Consumidor selecionado | Situação |
| --- | --- | --- | --- |
| `preferences.personal-views` | `createSfPersonalViews · save` (WP01) | `handleSfViews · open/list` (WP01) | Fonte localizada |
| `preferences.baseline-coverage-active` | `createDecisionBaselineCoverage · register` (WP11) | `createDecisionBaselineCoverage · resolveForecastCoverage` (WP11) | Fonte localizada |
| `preferences.baseline-coverage-history` | `createDecisionBaselineCoverage · register` (WP11) | **Ausente no W6** | Lacuna explícita |
| `preferences.coverage-classification-active` | `createDecisionBaselineCoverage · register` (WP11) | `createDecisionBaselineCoverage · readClassification` (WP11) | Fonte localizada |
| `preferences.coverage-classification-history` | `createDecisionBaselineCoverage · register` (WP11) | **Ausente no W6** | Lacuna explícita |
| `preferences.proposal-coverage` | `createProposalCoverageRegistry · registerProposalCoverage` (WP11) | `createProposalCoverageRegistry · resolveForecastCoverage` (WP11) | Fonte localizada |
| `preferences.criterion-rule-active` | `createCriterionRuleRegistry · register` (WP11) | `createCriterionRuleRegistry · evaluate` (WP11) | Fonte localizada |
| `preferences.criterion-rule-history` | `createCriterionRuleRegistry · register` (WP11) | **Ausente no W6** | Lacuna explícita |
| `preferences.sensitivity-binding` | `createCriterionResultBindings · bind` (WP11) | `createCriterionResultBindings · read` (WP11) | Fonte localizada |
| `preferences.comparison-binding` | `createCriterionComparisonBindings · bind` (WP11) | `createCriterionComparisonBindings · read` (WP11) | Fonte localizada |
| `preferences.portfolio-selection-active` | `createDecisionPortfolioSelection · register` (WP11) | `createPortfolioResultBindings · proofs` (WP11) | Fonte localizada |
| `preferences.portfolio-selection-history` | `createDecisionPortfolioSelection · register` (WP11) | `createPortfolioResultBindings · readHistoricalBinding` (WP11) | Fonte localizada |
| `preferences.portfolio-binding` | `createPortfolioResultBindings · bind` (WP11) | `createPortfolioResultBindings · read` (WP11) | Fonte localizada |
| `preferences.native-session-reservation` | `createSfNativeEvidenceStore · reserveSession` (WP10) | `createSfNativeEvidenceStore · isSfOwned` (WP10) | Fonte localizada |
| `preferences.native-token-receipts` | `createSfNativeEvidenceStore · persistTokenReceipt` (WP10) | **Ausente no W6** | Lacuna explícita |
| `reviews.preserved` | `createReviewPort · preserve` (WP07) | `prepareReport` (WP07) | Fonte localizada |
| `relations.confirmed` | `createRelationPort · create` (WP08) | `createCollaborationDispatch · execute(sf_relation_read)` (WP08) | Fonte localizada |
| `relations.version` | `createRelationPort · create` (WP08) | `createRelationPort · readVersioned` (WP08) | Fonte localizada |
| `relations.assignment` | `createRelationPort · create` (WP08) | `createCollaborationWorkPort · list` (WP08) | Fonte localizada |
| `relations.retired` | `createRelationPort · remove` (WP08) | `createRelationPort · create` (WP08) | Fonte localizada |
| `relations.hot-topic-correlation` | `createHotTopicPort · create` (WP02) | `createHotTopicPort · create (retry)` (WP02) | Fonte localizada |
| `threads.conversation` | `createThreadPort · create` (WP08) | `createCollaborationDispatch · execute(sf_answer_read)` (WP08) | Fonte localizada |
| `confirmations.human-record` | `createConfirmationPort · confirm` (WP08) | `createCollaborationWorkPort · list` (WP08) | Fonte localizada |
| `cases.decision-case` | `createDecisionCasePort · draft` (WP11) | `createDecisionCasePort · read` (WP11) | Fonte localizada |
| `cases.reconciled-domain-receipts` | `createPreparedExecution · returned application handler` (WP11) | `createPreparedExecution · retry/reconciliation` (WP11) | Fonte localizada |
| `claimBindings.contract-only` | **Ausente no W6** | **Ausente no W6** | Lacuna explícita |
| `commandProposals.contract-only` | **Ausente no W6** | **Ausente no W6** | Lacuna explícita |
| `compositeScenarios.contract-only` | **Ausente no W6** | **Ausente no W6** | Lacuna explícita |
| `biArtifacts.contract-only` | **Ausente no W6** | **Ausente no W6** | Lacuna explícita |
| `decisionResults.typed-results` | `createSfDecisionResultStore · write` (WP11) | `createSfDecisionResultStore · read` (WP11) | Fonte localizada |
| `contributions.typed-output` | `createSfRunStore · publish` (WP12) | `createSfContributionReader · returned reader` (WP12) | Fonte localizada |
| `nativeRuns.analysis` | `createSfRunStore · create` (WP12) | `createSfAnalysisHost · revalidate` (WP12) | Fonte localizada |
| `documents.asset-catalog` | `admitSfDocumentAsset` (WP06) | `createSfDocumentBytePort · read` (WP06) | Fonte localizada |
| `documents.field-schema` | `createSfDocumentSchemas · register` (WP06) | `createSfDocumentSchemas · resolve` (WP06) | Fonte localizada |
| `documents.lexical-index` | `indexSfDocument` (WP06) | `searchDocumentEvidence` (WP06) | Fonte localizada |
| `documents.evidence-candidate` | `extractDocumentEvidence` (WP06) | `confirmDocumentEvidence` (WP06) | Fonte localizada |
| `documents.evidence-confirmed` | `confirmDocumentEvidence` (WP06) | `readDocumentEvidence` (WP06) | Fonte localizada |
| `documents.import-file` | `createSfStagedImportFiles · admit` (WP06) | `parseAdmittedImport` (WP06) | Fonte localizada |
| `documents.import-preview` | `createSfImportPreviewStore · save` (WP06) | `createSfImportHost · apply` (WP06) | Fonte localizada |
| `documents.import-receipt-summary` | `settleSfImportReceipt` (WP06) | `createSfImportHost · detail` (WP06) | Fonte localizada |
| `documents.review-artifact` | `createReviewArtifactStorage · put` (WP07) | `createReviewDownloadHandler · returned GET handler` (WP07) | Fonte localizada |
| `receipts.prepared-command` | `createSfPreparedApply · executePrepared` (WP11) | `createSfPreparedApply · readReceipt` (WP11) | Fonte localizada |
| `receipts.import-planner` | `settleSfImportReceipt` (WP06) | `createSfPlannerImportAtomic · returned apply handler (retry)` (WP06) | Fonte localizada |
| `receipts.import-dashboard` | `settleSfImportReceipt` (WP06) | `createSfDashboardImportAtomic · returned apply handler (retry)` (WP06) | Fonte localizada |
| `atlas.business-memory` | `createSfAtlasMemory · emitFromLedger` (WP10) | `createSfAtlasMemory · recall` (WP10) | Fonte localizada |
| `outbox.case-ledger` | `enqueueSfLedgerEvent` (WP10) | `createSfAtlasMemory · emitFromLedger` (WP10) | Fonte localizada |

Os recibos C04 e C12 têm finalidades distintas. `settleSfImportReceipt` grava o recibo da importação e o resumo que será mostrado no detalhe; `createSfPreparedApply.executePrepared` registra o resultado do comando de domínio preparado. A reconciliação em `cases[].receipts` ocorre depois pelo fluxo de decisão. O par de funções do JSON permite seguir esses limites sem pressupor uma transação global entre todos os domínios. Fontes: [import store](<https://github.com/gustavomhss/Orchestra-SF/blob/29f40e0f0fafa8d526df9b280151962187f1440d/modules/sucafina/Sucafinav1/product/imports/store.ts>), [prepared apply](<https://github.com/gustavomhss/Orchestra-SF/blob/29f40e0f0fafa8d526df9b280151962187f1440d/modules/sucafina/Sucafinav1/product/decisions/prepared-apply.ts>) e [case reconciliation](<https://github.com/gustavomhss/Orchestra-SF/blob/29f40e0f0fafa8d526df9b280151962187f1440d/modules/sucafina/Sucafinav1/product/decisions/apply.ts>).

A correlação `sf:hot-topic:` pertence ao fluxo de Hot Topic/handoff C06. Ela não cobre a correlação C07 de admissão/run/resultado. O [produtor Dashboard](<https://github.com/gustavomhss/Orchestra-SF/blob/29f40e0f0fafa8d526df9b280151962187f1440d/modules/sucafina/Sucafinav1/product/dashboard/hot-topics.ts>) cria ou reutiliza a ação, e o [host de colaboração](<https://github.com/gustavomhss/Orchestra-SF/blob/29f40e0f0fafa8d526df9b280151962187f1440d/modules/sucafina/Sucafinav1/product/collaboration/hot-topic-host.ts>) persiste a correlação no mesmo fluxo protegido.

### Lacunas dos pares de estado

| Família | Responsável pelo delta | Constatação delimitada ao W6 | Delta concreto |
| --- | --- | --- | --- |
| `preferences.baseline-coverage-history` | WP11 | No business reader of this historical family was found. The write guard only rejects reuse of a history key. | Expose an authorized historical baseline reader and connect it to decision history/review; preserving bytes alone is not a consumer. |
| `preferences.coverage-classification-history` | WP11 | The only occurrence of this family is its write path; no historical business reader was found. | Bind an authorized historical classification read to the preserved baseline/review evidence. |
| `preferences.criterion-rule-history` | WP11 | No business read of the history family was found; current evaluation resolves the active rule. | Provide an authorized historical rule reader for comparison/review provenance and bind a real consumer. |
| `preferences.native-token-receipts` | WP10 | The inspected sources only initialize, validate and append tokenReceipts; no business/audit reader of saved receipts was found. | Expose a protected evidence read for an admitted run and connect the qualification/diagnostic consumer; never disclose token-bearing runtime credentials. |
| `claimBindings.contract-only` | WP11 | Zero lexical references to this field in all 255 product implementation .ts files and all inspected CLI composition .ts files at W6. Declaration and tests are not a producer or consumer. | Implement an authorized human-confirmation writer and a case-field reader that revalidates the source; a DocumentEvidence confirmation is not this binding. |
| `commandProposals.contract-only` | WP11 | Zero lexical references to this field in all 255 product implementation .ts files and all inspected CLI composition .ts files at W6. Declaration and tests are not a producer or consumer. | Implement proposal creation/read for the existing domain command path and explicit human review; do not bypass PreparedApplyPort. |
| `compositeScenarios.contract-only` | WP11 | Zero lexical references to this field in all 255 product implementation .ts files and all inspected CLI composition .ts files at W6. Declaration and tests are not a producer or consumer. | Implement an owner of composite evaluation and a case consumer that exposes partial coverage, while retaining the request and domainApplied:false. |
| `biArtifacts.contract-only` | WP05 | Zero lexical references to this field in all 255 product implementation .ts files and all inspected CLI composition .ts files at W6. Declaration and tests are not a producer or consumer. | Implement the artifact producer and authorized read/download consumer, tied to the real BI projection; add the provider-owned bi-artifacts migration under WP10. |

Para os quatro campos sem referência na implementação, a ausência se refere ao inventário explícito de 281 arquivos pinados. Os tipos em [state.ts](<https://github.com/gustavomhss/Orchestra-SF/blob/29f40e0f0fafa8d526df9b280151962187f1440d/modules/sucafina/Sucafinav1/product/contracts/state.ts>) permanecem o contrato; os objetos opcionais não são um banco já populado nem um serviço de negócio. Os três históricos sem leitor continuam sendo escritos, mas preservar os bytes e recusar uma chave repetida não demonstra um fluxo que os consuma. O mesmo cuidado vale para `tokenReceipts`: o [store nativo](<https://github.com/gustavomhss/Orchestra-SF/blob/29f40e0f0fafa8d526df9b280151962187f1440d/modules/sucafina/Sucafinav1/product/integration/native-evidence.ts>) os valida e acrescenta, enquanto o leitor de ownership só classifica a sessão.

### C07 e schedules

| Obrigação | Produtor | Consumidor | Responsável e delta |
| --- | --- | --- | --- |
| Admissão de rotina | Ausente | Ausente | WP09: factory de rotina existente, receita publicada/pinada, principal/write scope e recibo durável de admissão |
| Recibo de run de rotina | Ausente | Ausente | WP09: produzir e ler o resultado real do workflow admitido; análise nativa não substitui Relay |
| Correlação da rotina | Ausente | Ausente | WP09: ligar admissão, run, resultado e ação canônica sem duplicar trabalho |
| Binding de schedule | Ausente | Ausente | WP09: compor create/update/pause/list/readRun com o serviço existente; ativação não é aprovação de workflow |

A árvore W6 não contém `product/routines/`; a consulta pinada desse diretório retornou 404. O [host CLI](<https://github.com/gustavomhss/Orchestra-SF/blob/29f40e0f0fafa8d526df9b280151962187f1440d/apps/cli/src/sucafina-product/host-context.ts>) atribui explicitamente `unavailable` a `catalog`, `prepareAdmission`, `readAdmission`, `readRun` e `run`. O [chamador de análise](<https://github.com/gustavomhss/Orchestra-SF/blob/29f40e0f0fafa8d526df9b280151962187f1440d/modules/sucafina/Sucafinav1/product/ai/analysis-port.ts>) apenas delega a esse port. A referência de tipo a `../routines/factory.ts` em [host-context do contrato](<https://github.com/gustavomhss/Orchestra-SF/blob/29f40e0f0fafa8d526df9b280151962187f1440d/modules/sucafina/Sucafinav1/product/contracts/host-context.ts>) não é uma implementação.

## Formatos importáveis e seus comandos reais

Para uma linha de formato, o produtor é quem normaliza o input para o comando ou evidência de negócio. O consumidor é a execução real daquele comando ou operação documental. Não se atribui a um exportador XLSX a produção de todos os arquivos XLS recebidos de fora.

| Formato e família | Produtor de input de negócio | Consumidor real | Aplicação e composição persistente |
| --- | --- | --- | --- |
| `planner.financial.xlsx` | `preparePlannerWorkbook` (WP06) | `domain · execute -> importWorkbook` (WP03) | `createSfPlannerImportAtomic` → `createSfImportServices` |
| `planner.roster.xlsx` | `preparePlannerWorkbook` (WP06) | `domain · execute -> importWorkbook (All Members)` (WP03) | `createSfPlannerImportAtomic` → `createSfImportServices` |
| `dashboard.members.xlsx` | `buildDashboardWorkbookCommand` (WP06) | `domain · execute -> importMembers` (WP02) | `createSfDashboardImportAtomic` → `createSfImportServices` |
| `dashboard.projects.xlsx` | `buildDashboardWorkbookCommand` (WP06) | `domain · execute -> importProjectRows` (WP02) | `createSfDashboardImportAtomic` → `createSfImportServices` |
| `dashboard.tickets.xlsx` | `buildDashboardWorkbookCommand` (WP06) | `domain · execute(import-month)` (WP02) | `createSfDashboardImportAtomic` → `createSfImportServices` |
| `planner.financial.xls` | `preparePlannerWorkbook` (WP06) | `domain · execute -> importWorkbook` (WP03) | `createSfPlannerImportAtomic` → `createSfImportServices` |
| `planner.roster.xls` | `preparePlannerWorkbook` (WP06) | `domain · execute -> importWorkbook (All Members)` (WP03) | `createSfPlannerImportAtomic` → `createSfImportServices` |
| `dashboard.members.xls` | `buildDashboardWorkbookCommand` (WP06) | `domain · execute -> importMembers` (WP02) | `createSfDashboardImportAtomic` → `createSfImportServices` |
| `dashboard.projects.xls` | `buildDashboardWorkbookCommand` (WP06) | `domain · execute -> importProjectRows` (WP02) | `createSfDashboardImportAtomic` → `createSfImportServices` |
| `dashboard.tickets.xls` | `buildDashboardWorkbookCommand` (WP06) | `domain · execute(import-month)` (WP02) | `createSfDashboardImportAtomic` → `createSfImportServices` |
| `dashboard.backup.json` | `createSfDashboardImportPreview · returned preview handler; backup command branch` (WP06) | `executeDashboardBackupImport` (WP02) | `createSfDashboardImportAtomic` → `createSfImportServices` |
| `documents.evidence.pdf` | `extractAuthorizedDocument` (WP06) | `extractDocumentEvidence` (WP06) | `extractDocumentEvidence` → `createSfDocumentServices` |
| `documents.evidence.docx` | `extractAuthorizedDocument` (WP06) | `extractDocumentEvidence` (WP06) | `extractDocumentEvidence` → `createSfDocumentServices` |
| `documents.evidence.txt` | `extractAuthorizedDocument` (WP06) | `extractDocumentEvidence` (WP06) | `extractDocumentEvidence` → `createSfDocumentServices` |

O [parser admitido](<https://github.com/gustavomhss/Orchestra-SF/blob/29f40e0f0fafa8d526df9b280151962187f1440d/modules/sucafina/Sucafinav1/product/imports/files.ts>) aceita XLSX, XLS e JSON; os workbooks usam [parseWorkbookDetailed](<https://github.com/gustavomhss/Orchestra-SF/blob/29f40e0f0fafa8d526df9b280151962187f1440d/modules/sucafina/Sucafinav1/runtime/workbooks.ts>). Os parsers e os comandos permanecem separados:

- **Planner financeiro:** `Info/OPEX/CAPEX/Headcount/Rate cards/FX rates` seguem o comando `import-workbook`.
- **Planner roster:** `All Members` segue o mesmo comando de domínio, com validação própria de roster; não se confunde com a importação de membros no Dashboard.
- **Dashboard membros:** `Talent Review/import`.
- **Dashboard projetos:** `Projects Import` e `All Projects` são aliases do formato consumido por `All Projects/import`.
- **Dashboard operações:** `Ticket Register` gera `IT Operations/import-month` para um mês completo; SLA/Availability/Heat Map não são inputs desse comando.
- **Dashboard JSON:** `backup-import` usa o [produtor de backup existente](<https://github.com/gustavomhss/Orchestra-SF/blob/29f40e0f0fafa8d526df9b280151962187f1440d/modules/sucafina/Sucafinav1/runtime/dashboard-backup.ts>) e a [proteção de import](<https://github.com/gustavomhss/Orchestra-SF/blob/29f40e0f0fafa8d526df9b280151962187f1440d/modules/sucafina/Sucafinav1/runtime/dashboard-import.ts>); não autoriza importação de `__sfProductV1`.
- **PDF digital, DOCX e texto:** produzem evidência C14 através de [extractAuthorizedDocument](<https://github.com/gustavomhss/Orchestra-SF/blob/29f40e0f0fafa8d526df9b280151962187f1440d/modules/sucafina/Sucafinav1/product/documents/extract.ts>) e [extractDocumentEvidence](<https://github.com/gustavomhss/Orchestra-SF/blob/29f40e0f0fafa8d526df9b280151962187f1440d/modules/sucafina/Sucafinav1/product/documents/capabilities.ts>), com confirmação humana separada. São entradas documentais, sem comando financeiro implícito.

CSV financeiro, importação PPTX, OCR/imagens, JSON Planner e workbook financeiro Procurement não são inferidos como formatos admitidos por essas entradas. A composição concreta usa [createSfImportServices](<https://github.com/gustavomhss/Orchestra-SF/blob/29f40e0f0fafa8d526df9b280151962187f1440d/apps/cli/src/sucafina-product/import-services.ts>) ou [createSfDocumentServices](<https://github.com/gustavomhss/Orchestra-SF/blob/29f40e0f0fafa8d526df9b280151962187f1440d/apps/cli/src/sucafina-product/document-services.ts>); uma tabela não comprova que o bootstrap atual conseguiu montar todos esses serviços.

## Provider C08 e decisão sobre CHK.03

`schemaVersion`, `revision`, `versions`, `incarnation` e `transactions` têm produtor/leitor concretos em `createSfProductState`, registrados em seção própria. Eles não ocupam o lugar de um produtor de caso, revisão, importação ou documento.

O [provider W6](<https://github.com/gustavomhss/Orchestra-SF/blob/29f40e0f0fafa8d526df9b280151962187f1440d/modules/sucafina/Sucafinav1/product/host-binding/state-provider.ts>) ainda enumera onze namespaces, enquanto o contrato tem doze. O código também não implementa `checkNamespaces`, a migração aditiva declarada e os guards de ownership dos quatro campos novos sem referências de implementação. O responsável por esse delta é **WP10**, especificamente o provider já existente. A migração não deve ser simulada por inicialização de fixture ou por outro store.

**Decisão do levantamento:** a documentação de rastreabilidade foi completada; **CHK.03 não recebe PASS**, porque quatro famílias gravadas ainda não têm leitor de negócio localizado e quatro campos declarados não têm produtor/consumidor implementado. As obrigações C07/schedule também permanecem explícitas. Nenhuma alteração de provider, contrato ou domínio foi feita nesta tarefa. O aceite exige implementar os deltas no owner indicado e observar os consumidores reais nas provas coordenadas; não exige reinterpretar uma tabela como execução.

