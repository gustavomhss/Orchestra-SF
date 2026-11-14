> **Validação final pelo integrador:** produto `dae18b4f43f0daecf46264e876810025684a919d`; Bun 257 pass, Playwright 10 pass, zero falhas/skips/retries, geração oficial e typecheck aprovados. Recibos e escopo em [ci-evidence.json](ci-evidence.json). O texto histórico abaixo conserva a atribuição e o estado da revisão em sua data; estes resultados hospedados não são atribuídos a execução pelo revisor. Permanecem 10 limites nativos e 4 observações humanas.

# WP04 — inventário final de implementação e cobertura

## Estado deste inventário

Leitura da implementação W6 e do delta autorizado W7 de downloads. Este documento identifica **cobertura escrita**, consumidores reais e limites; não declara PASS de CI. O recibo final deve vincular os resultados hospedados ao commit e aos blobs finais, incluindo eventuais correções de tipo. Nenhum teste de produto foi executado localmente para preparar este inventário.

Os nomes entre aspas são nomes reais de testes. Os paths são relativos à raiz do repositório. Para reduzir repetição, **M** significa `modules/sucafina/Sucafinav1`, **T** significa `modules/sucafina/Sucafinav1/test` e **B** significa `packages/app-shell/e2e/sucafina/wp04`.

## 1. As cinco páginas originais

`M/runtime/procurement.ts` exporta exatamente `Dashboard`, `Requests`, `My approvals`, `Suppliers` e `Settings`. Requisition, Sourcing, Purchase order e History são seções do detalhe, sem sexta entrada de navegação.

| Página | Implementação e comportamento preservado | Cobertura focada escrita |
| --- | --- | --- |
| Dashboard | `domain.view/render` sobre o recorte autorizado; contagens e valores de PO aprovada e emitida separados por OPEX/CAPEX; subtotal conhecido e itens não conversíveis explicitados. Não interpreta emissão interna como gasto realizado. | `T/procurement-runtime.test.ts`: “procurement required pages contain functional controls or nonempty read views”; `T/product/wp04/money.test.ts`: “submitted PO uses its frozen exchange rate and approved and issued totals remain separate”. |
| Requests | Filtros Open/Awaiting approval/Requisition/Sourcing/Purchase order/Closed/All; busca por pedido, requester, buyer, etapa e holder/nome resolvido; tabela C02 no host composto; detalhe autorizado com estado, próxima ação, versão, origem dos campos, comparação e formulários da etapa. | `T/product/wp04/queue-view.test.ts`; `T/product/wp04/ui-queues.test.ts`: “request search covers stored requester, buyer and holder identifiers and authorized directory names”; `T/parity-procurement.test.ts`: “request query opens its authorized target, includes closed rows and leaves other rows closed” e “request query cannot reveal a record omitted by the authorization-filtered view”. |
| My approvals | C02 fornece os dados e os três grupos Waiting for you/Waiting for others/Unassigned. Entrada comprovada na etapa, datas indisponíveis ao fim, identificador como desempate. A decisão continua sujeita ao domínio e ao holder atual. | `T/product/wp04/queue-view.test.ts`; `T/product/wp04/ui-queues.test.ts`: “approval queues sort only by proven entry, keep unavailable history and do not use a save timestamp”; `T/product/wp04/money.test.ts`: “approval queue retains missing steps and does not invent holder names or actions”. |
| Suppliers | Cadastro e manutenção, quatro estados, busca por nome/número/taxId, filtro, contatos/comercial/compliance, banco restrito, linked requests, histórico e CSV. Valores de enum já registrados fora do catálogo ficam selecionados como Recorded value. | `T/product/wp04/ui-supplier.test.ts`: “real supplier lifecycle covers all four states, authorized search, linked requests and audit without granting buyer status powers” e “recorded supplier enum values outside the current options remain selected through a real form save”; `T/parity-procurement.test.ts` cobre deeplinks e exclusão de fornecedor fora da view. |
| Settings | Configuração existente, matriz de aprovação, FX, critérios técnicos/comerciais, mínimos, termos/categorias/incoterms, defaults de endereço, anexos/lembretes e reset secundário. Reset preserva registros, identificadores e snapshots submetidos. | `T/parity-procurement.test.ts`: “settings reset restores the original complete defaults and preserves procurement records” e “default addresses and FX update date save, read, render and reset to empty defaults”; `T/product/wp04/ui-supplier.test.ts`: “Settings exposes complete baseline policy controls and secondary reset without inventing defaults”; browser B8 abaixo. |

## 2. Comandos e estados originais

A autoridade está em `M/runtime/procurement.ts#execute`, nos adaptadores de `M/src/procurement.ts`, nos validadores de `M/src/form.ts` e em `modules/sucafina/porta/act.ts`. Visibilidade de botão, papel nominal, fonte C02 ou link não concede execução. O adaptador conserva a versão esperada, edição por etapa, validator e chamada final existente.

| Superfície | Comandos completos | Responsabilidade e prova escrita |
| --- | --- | --- |
| Requests / My approvals | `create`, `save`, `submit_pr`, `select_quote`, `submit_sourcing`, `submit_po`, `approve`, `reject`, `issue`, `cancel`, `delete` | Create/edição de PR respeitam ownership; sourcing/PO respeitam buyer/admin e etapa; approve/reject respeitam holder, configuração e motivo; emissão é interna; cancel exige motivo e autoridade; delete continua restrito a draft. `T/procurement-runtime.test.ts`: “request fields survive creation, save, submission and actual holder decisions”, “request ownership, self-approval flag and independent record versions are enforced”, “dual-role request transitions retain porta authorization without permitting foreign PR edits” e o roundtrip completo. |
| Suppliers | `create`, `save`, `activate`, `block`, `inactivate`, `delete`, `change-bank` | Criação exige buyer; manutenção segue buyer/admin/supplier admin; banco e estados administrativos exigem os papéis existentes; delete só pending sem pedido vinculado. `T/procurement-runtime.test.ts`: “supplier creation persists and deletion never reuses its SUP allocation”; `T/product/wp04/ui-supplier.test.ts` cobre todo o ciclo e recusas de buyer. |
| Settings | `save`, `reset` | Admin, CAS e validação real da matriz/moedas; preço automático não pode ser removido pelo editor. Cobertura de reset/paridade acima e browser B8. |

As seguintes transições são descrições do comportamento existente, não novas regras:

| Estado | Continuidade preservada |
| --- | --- |
| `draft` | Save da PR, `submit_pr`, exclusão permitida e cancelamento autorizado. |
| `pr_pending` | Aprovação intermediária conserva a pendência; última aprovação abre sourcing; rejeição vai a `pr_rejected`. |
| `pr_rejected` | Correção e nova submissão da PR nas condições originais. |
| `sourcing` | Editar propostas, selecionar e submeter; ranking não seleciona nem aprova automaticamente. |
| `src_pending` | Aprovações intermediárias conservam pendência; última libera `po_draft`; rejeição vai a `src_rejected`. |
| `src_rejected` | Corrigir, selecionar e submeter conforme validação vigente. |
| `po_draft` | Editar e submeter a PO. |
| `po_pending` | Aprovações intermediárias conservam pendência; última vai a `po_approved`; rejeição vai a `po_rejected`. |
| `po_rejected` | Corrigir e submeter novamente conforme domínio. |
| `po_approved` | Emissão interna pelo papel autorizado. |
| `po_issued` | Emissão registrada; cancelamento/exclusão recusados. Não prova envio ao fornecedor, recebimento ou pagamento. |
| `cancelled` | Transições recusadas conforme domínio. |
| Desconhecido/importado | C02 apresenta status/entrada/valor indisponíveis onde não há evidência suficiente; não inventa etapa ou autoridade. |

`modules/sucafina/porta/linha.test.ts` contém as contraprovas nomeadas `L-create`, `L-submit-pr`, `L-approve-pr-resta/ultimo`, `L-reject-pr`, `L-select`, `L-submit-sourcing`, `L-approve-src-resta/ultimo`, `L-reject-src`, `L-submit-po`, `L-approve-po-resta/ultimo`, `L-reject-po`, `L-issue` e `L-cancel`. `modules/sucafina/porta/codigo.test.ts` cobre recusas de read-only, transição, cancelled, already-issued, no-step, requester/buyer/canceller, no-override, not-approver, self-approval, reason, quote/selection/PO, expense type, supplier blocked e FX. O renderer não substitui essas recusas.

## 3. Campos de negócio e roundtrip

Os grupos abaixo correspondem aos allowlists e às estruturas repetidas reais de `M/runtime/procurement.ts`. Campos derivados, snapshots e identidade preservados não são apresentados como novos controles editáveis.

| Grupo | Campos preservados |
| --- | --- |
| PR | `title`, `type`, `description`, `estAmount`, `costCenter`, `needBy`, `justification`, `recurring`, `frequency`, `estAnnual`, `expenseType`, `category`, `requesterName`; derivado `contractRecommended`. |
| Sourcing | `quotes`, `evaluator`, `selectedId`, `fewQuotesJustification`, `selectionJustification`, `contractStrategy`, `weights`. Pesos técnicos/comerciais e critérios preservam nomes, pesos e `auto`. |
| Cotação | `id`, `supplier`, `supplierId`, `currency`, `total`, `qty`, `unitPrice`, `techPass`, `scores`, `cscores`, `description`, `notes`, `attachments`. |
| PO | `currency`, `expenseType`, `supplier`, `supplierId`, `description`, `lines`, `paymentTerms`, `deliveryDate`, `deliveryConditions`, `contractRef`, `incoterm`, `incoterms`, `assetRef`, `supplierContact`, `quoteRef`, `billingAddress`, `deliveryAddress`, `acceptance`, `warranty`, `notes`. Linhas preservam `description/desc`, `unit/uom`, `notes`, `qty` e `unitPrice`. |
| Supplier | `legalName`, `tradingName`, `type`, `country`, `address`, `taxId`, `regNo`, `contactName`, `contactEmail`, `contactPhone`, `financeEmail`, `paymentTerms`, `currency`, `incoterm`, `riskRating`, `dueDiligence`, `sanctionsDate`, `nda`, `dpa`, `certifications`, `categories`, `contacts`, `commercial`, `compliance`, `notes`. Contatos: name/email/phone; comercial/compliance: notes. |
| Banco | `iban`, `account`, `bankName`, `swift`, `accountHolder`, `bankCountry`, sob política separada de leitura/escrita e criptografia existente para IBAN/account. |
| Settings | `currency`, `levels` (id/name/threshold/holderId), `prApprovalMode`, `blockSelfApproval`, `fxRates` (code/rate), `minQuotes`, `techWeight`, `commWeight`, `criteria`, `commCriteria`, `requireActiveSupplier`, `paymentTerms`, `categories`, `incoterms`, `billingAddress`, `defaultDeliveryAddress`, `fxUpdated`, `reminderDays`, `escalationDays`, `uploadCap`. |
| Identidade e evidência persistida | Números PR/PO/SUP, criador, buyer, versões, history, attachments, sourceQuoteId, issuedAt, validação de fornecedor, approvals, fxSnapshot/fxRate e approvalBaseCurrency. Campos restritos continuam fora de views/audits não autorizados. |

`T/procurement-runtime.test.ts`, “complete procurement field roundtrip and frozen approvals survive settings edits”, grava PR completa, duas cotações com metadados, duas linhas de PO distintas, fornecedor completo com dois contatos e Settings com duas alçadas. Executa select/submit/approve/issue e compara os campos preservados; mudar a configuração não troca o holder da aprovação já submetida. A mesma fixture conserva `PO-2026-9999` e aloca `PO-2026-10000`. “imported high-water marks and deleted requests do not reuse issued numbers” e “supplier creation persists and deletion never reuses its SUP allocation” cobrem PR/SUP. “asset metadata survives business transitions and deletion returns the deleted record” cobre metadados e retorno da exclusão permitida.

Referências textuais como `contractRef`, `assetRef`, centro de custo e expenseType não se tornam vínculo orçamentário, contrato verificado ou saldo disponível.

### Formulários parciais, origem e metadados omitidos

`M/product/procurement/guided-request.ts` e `M/src/screen-shell.ts` associam erros aos controles, preservam nome acessível e usam descrição adjacente, mantêm inputs/comentário e focam o campo ou a revisão. Um 409 informa `currentVersionCAS`; a adoção explícita da versão não reenvia o comando. A resposta tardia de um save não apaga uma edição posterior.

`retainedFormRows/structuredInput` conserva metadados antes da compactação dos arrays e depois dos gates de CAS/edição. Cotações existentes são ligadas por ID único; linhas de PO usam referência do request e dos metadados omitidos, com índice como indicação de origem. Preço/quantidade e avanço de CAS não invalidam a referência. Novas linhas não herdam metadados; alterações explícitas prevalecem; duplicação/mismatch é recusado atomicamente; `_new`, `_remove` e `_rowRef` não persistem.

Provas escritas em `T/product/wp04/ui-guidance.test.ts`:

- “recurring draft values survive collapsing and saving the nonrecurring section”.
- “contract strategy changes preserve saved references and existing-contract submission uses the real validator”.
- “saved order terms survive source suggestions and ambiguous supplier identity supplies no terms”.
- “rendered order rows retain omitted metadata across consecutive saves, reorder, removal and a new row”.
- “rendered quotation saves retain omitted metadata by quote ID and never transfer removed metadata to a new quote”.

Os dois últimos extraem controles do renderer real e chamam `domain.execute`, inclusive dois saves sem rerender e repetição após remoção. São testes do adaptador/formulário real, sem alegação de browser para esses casos específicos. As jornadas de browser B1–B5 cobrem os comportamentos de foco, conflito e reutilização visíveis.

## 4. C02 real na fila e limite do renderer isolado

Composição atual: `apps/cli/src/sucafina-product/business-services.ts` cria `createProcurementQueuePageView`; `host-context.ts` o entrega como `SfHostServices.productView`; `M/runtime/application.ts` prepara fora do lock, revalida dentro da transação autorizada e só então passa os dados ao renderer. `M/product/procurement/queue-page.ts` verifica autoridade corrente, recorte, papéis, moeda, continuidade e digest dos mesmos registros. Falha não entra em fallback legado.

`M/product/procurement/queue-view.ts` aceita apenas a apresentação emitida em processo a partir de `port.list`; Requests e My approvals consomem seus campos, sem recomputar dinheiro/idade. A tabela usa subject/status/holder/nextStep/valores C02; My approvals usa a aprovação submetida, motivo e entrada comprovada. Requester/buyer/nome autorizado e `approvalDecision` permanecem ligados ao registro do mesmo recorte. Links contêm `data-source-ref`, `data-source-digest` e `data-source-version`; o GET de drilldown passa `request=id`, reautoriza e abre o detalhe. O ref efêmero não vira ticket de autorização durável.

`T/product/wp04/queue-view.test.ts`:

- “authorized Requests and My approvals render the actual C02 queue across baseline states”: todos os estados conhecidos e importado desconhecido, três grupos, proveniência, recorte e detalhe real.
- “the page fence refuses material changes and revocation between C02 preparation and rendering”: alteração material e revogação entre preparação/render fecham o caminho.

`T/product/wp04/queue-lifecycle.test.ts`, “durable queue selection, counts and drilldowns keep requester scope across unrelated changes”, cobre seleção/durabilidade. `M/src/procurement-screen.ts#approvalStageEntry` usa a submissão da etapa e, para holder posterior, a aprovação anterior comprovada; created/save não substituem esse evento.

**Limite mantido:** chamadas isoladas a `render` sem `productView` ainda têm apresentação legada. Seus testes não demonstram montagem C02 por si. O host comum e `B/host.ts` montam o hook; os testes acima e os marcadores verificados nas oito jornadas distinguem esse caminho. Dashboard continua descrito por seu consumidor autorizado próprio; este inventário não afirma que todas as cinco páginas usam o hook de fila.

## 5. Valores, FX, comparação e snapshots

`M/src/procurement-screen.ts#requestValue`, `M/product/procurement/monetary.ts#procurementMonetaryFacts`, `M/src/form.ts#quoteAssessment/quoteComparisonPresentation` e `M/product/procurement/port.ts` são os produtores usados. O identificador monetário atual é `procurement-money-v3`. Ausência/invalidade, seleção ambígua, linhas inválidas, overflow e snapshot ausente não viram estimativa substituta ou zero. Base atual incompatível com a submetida torna a comparação indisponível e conserva a denominação histórica.

`T/product/wp04/finance-material.test.ts` cobre o cenário A USD32.400 / B EUR28.000×1,08 / C não conforme: A87,9333…, B85, C sem ranking, prêmio USD2.160/7,142857…%. Também cobre empate sem nova regra, moeda/PO incompletas, overflow, rejected com moeda submetida e PR congelada após troca da base. “C06 preserves zero versus absence and fingerprints compensating financial inputs” distingue entradas diferentes com o mesmo total.

`T/product/wp04/comparison-review.test.ts`: “producer with missing submitted FX suppresses every score and rank despite a current rate”, “producer with absent weights or incomplete human assessments withholds ranking”, “a stated total mismatch in one proposal suppresses the whole producer ranking” e “runtime and producer present the same submitted quote amount and FX source”. A discrepância entre total declarado e qty×unitPrice é exposta; não altera silenciosamente preço, seleção ou política. B6 verifica a decomposição e o mesmo valor no detalhe/fila antes e depois de editar FX.

## 6. Permissões, fornecedor e downloads

Requester puro permanece em seus pedidos; papéis ampliados usam o recorte permitido existente. Viewer não ganha escrita por canWrite isolado. Admin não ganha override de holder alheio; combinações de papéis não permitem edição de PR estrangeira. Provas: testes de ownership/dual-role citados, `T/product/wp04/ui-conflict.test.ts` e recusas Porta.

Fornecedor: legalName duplicado gera warning de sucesso com taxIds distintos; taxId duplicado é recusado. Banco alterado por papel permitido muda active→pending, limpa validatedAt/validatedBy, registra nomes de campos sem seus valores e exige nova ativação. A lista de pré-requisitos usa rótulos humanos e não declara verificação externa de sanctions. B7 chega novamente a active com autoridade atual e verifica viewer sem leitura/escrita bancária.

`M/runtime/downloads.ts` produz os bytes de `suppliers`, `register` e `po`. Supplier CSV aplica a mesma política existente aos seis campos bancários; register e documento PO omitem material restrito e respeitam o recorte do requester. Documento preserva fornecedor, linhas, termos, endereços, referências e aprovador. `T/product/wp04/ui-supplier.test.ts` contém:

- “the real supplier CSV keeps business fields and grants every bank field only to existing privileged roles”: buyer/viewer versus supplier admin/admin, todos os seis campos e chave ausente.
- “real register and purchase-order downloads preserve recorded business terms and omit restricted bank material”: bytes efetivos CSV/HTML, documento de outro requester recusado e snapshot inalterado.
- “real register bytes distinguish missing quotation values and currency from recorded zero and reject ambiguous selection”.
- “real PO and register bytes keep missing lines prices currency and frozen FX unavailable”.
- “real financial downloads preserve frozen submitted currency after base changes and retain explicit zero”.

O delta W7 substitui coerção monetária legada nos exports: total declarado da cotação exige campo finito, moeda registrada e ID único; subtotais, total de PO e conversão usam o helper canônico. A ausência não vira `0.00`; zero explicitamente registrado permanece zero. As colunas anteriores permanecem, com contexto adicional de base/FX/fonte/estado e valor/moeda/taxa submetidos. Trocar a base para GBP não relabela uma aprovação USD108; o valor original EUR100 continua separado da conversão atual indisponível. Uma PO pending/approved sem linhas também conserva a aprovação USD108/FX1,08 registrada, embora total original e conversão atuais estejam indisponíveis; essa contraprova de CSV/HTML está no terceiro teste novo. Essa prova de bytes não é descrita como download pelo browser de todos os formatos.

## 7. Oito cenários no host real

Arquivo: `B/procurement.spec.ts`. `B/host.ts` monta a aplicação, SQLite, identidade/operator e os serviços/autoridade/lifecycle de produção, incluindo C02. Identidades e registros são sintéticos; a UI e os comandos são reais. O setup não cria uma página alternativa com regras duplicadas. Configuração: `packages/app-shell/e2e/playwright.production.config.ts`; `B/selection.ts` reconhece a seleção canônica sem alterar o validador, e `--list` não inicia o servidor adicional.

| Caso e nome exato | Assertions centrais escritas |
| --- | --- |
| B1 — “keyboard submission uses current entries and focuses the real 422 field without clearing the draft” | Submissão por teclado, erro real 422, nome/descrição acessíveis, foco no controle, inputs preservados e submissão corrigida. |
| B2 — “two authenticated actors review an actual CAS conflict and submit only after an explicit version choice” | Dois atores, 409 real/currentVersionCAS, conteúdo local preservado, revisão/adoption explícitas sem POST automático, save deliberado e foco/contexto. |
| B3 — “a stale approval preserves the typed comment and refuses to revive an action after cancellation” | Comentário preservado após outro ator cancelar; conflito real, estado atual cancelado e ausência de reaplicação. |
| B4 — “a real committed save cannot clear edits typed before its response arrives” | Resposta de uma gravação real é retida para produzir a corrida; edição posterior permanece dirty e não recebe falso Saved. |
| B5 — “a recurring request reaches an internally issued PO with source values and negotiated entries preserved” | PR→sourcing→PO→emissão; recurring false/true e existing/new conservam entrada; fornecedor/moeda/quantidade são reaproveitados; falta de contractRef dá 422; Net60/endereços negociados sobrevivem aos defaults; total final USD103,68. |
| B6 — “the A B C comparison shows score components and retains submitted FX in the real detail and queue” | Decomposição, elegibilidade, ranking/prêmio, FX1,08 congelado após configuração2, mesmo valor detalhe/fila. Filtros e busca via Home/ArrowDown/End/Tab/texto/Enter mostram exclusão e retorno do pedido. |
| B7 — “an authorized bank change requires supplier revalidation and a real viewer cannot read or update bank details” | Alteração permitida→pending/validação apagada; viewer sem campos/valores, POST403; reativação real→active pelo ator atual; observer permanece mascarado. |
| B8 — “settings reject invalid currencies with visible feedback and reset restores defaults without changing a submitted request” | FX0→422 sem limpar inputs; save1,2; foco preservado; Reset descoberto/acionado por Tab/Enter/Tab/Space; defaults restaurados e pedido/snapshot submetidos intactos. |

Cada login exige marcadores de fonte C02 no link visível. Screenshots e JSON de observações são anexados também no sucesso dos cenários principais; banco permitido é mascarado na captura. O JSON registra `humanTimingMeasured: false`. Contagem de cenários e assertions são cobertura codificada, ainda dependente do CI vinculado aos bytes finais.

## 8. Dois testes isolados de controlador, com limite explícito

Arquivo separado: `B/sourcing-controller.spec.ts`.

- “isolated sourcing controller survives shell refresh while preparing, running and uncertain until an observed terminal read”.
- “isolated sourcing controller cannot repeat an unconfirmed start after history or shell refresh”.

Usam o script de produção `M/product/procurement/sourcing-analysis.ts`, o histórico compartilhado de `M/product/interface/forecast-analysis.ts` e o shell real, com transporte controlado para as corridas. `data-dirty` protege preparing/active/unknown; history refresh genérico não libera Start. Somente leitura terminal autorizada libera. Generation/readSequence/runRef descartam respostas fora de ordem, incluindo terminal antigo após cancelamento e início de outro run. A anotação do próprio spec declara isolamento e ausência de prova nativa.

A entrada real Sourcing é montada por `M/product/interface/http.ts`, `M/product/procurement/sourcing-input-http.ts` e `apps/cli/src/sucafina-product/sourcing-inputs.ts`. `T/product/wp04/ui-sourcing-analysis.test.ts` verifica fonte autorizada, catálogo fornecido, manifest real e indisponibilidade sem dependência. `T/product/wp04/finance-sourcing-integration.test.ts`, “case-bound sourcing input crosses the real business composition and HTTP authority boundary”, cobre o builder e a fronteira real. Esses testes não convertem os dois cenários isolados em execução de modelo ou aceitação residente.

## 9. Fronteiras de integração e qualificação

`T/product/wp04/host-integration.test.ts` tem testes reais de composição C06/WP09, HTTP C12 com efeito durável, material histórico, substituição de Request, origem/autoridade, conflito entre recibo e reconciliação e recuperação após perda de resposta. `T/product/wp04/capabilities.test.ts`, “supplier export requires a consumed UI grant and preserves current scoped source failures”, e `T/product/wp04/contracts.test.ts`, “contract capability reads only the issued Dashboard scope and rejects revocation and ABA”, cobrem os exports de fornecedor/contrato pelo dispatcher/autoridade reais, inclusive direto sem concessão, stale, indisponibilidade e revogação. São provas no escopo indicado por esses testes; resultado nativo/MCP/residente deve vir do recibo correspondente.

Este inventário substitui as limitações antigas de W2 que diziam não haver montagem C02, browser/teclado ou teste de bytes dos downloads citados. Ele mantém os limites efetivos: não há medição humana de 30 segundos; automação não qualifica compreensão humana, modelo residente, SessionV2 ou campanha global; o conjunto de testes representa estados e riscos concretos, sem alegação de produto cartesiano de todos os papéis × campos × transportes. O mapa dos 111 critérios e a evidência hospedada final continuam sendo a autoridade para qualificação.
