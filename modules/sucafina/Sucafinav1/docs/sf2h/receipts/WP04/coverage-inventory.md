# WP04 — inventário de cobertura e contrato de composição

Este inventário descreve o código de produção em `astra-wp04`; o recibo `ci-evidence.json` identifica o commit efetivamente executado. A matriz `criteria.json` contém os 111 critérios canônicos, sem substituir o plano aprovado. As provas hospedadas são de domínio, persistência, portas e HTML. Não constituem execução humana, SessionV2, aceitação residente nem qualificação global.

## Páginas e consumidores

| Página original | Produção e apresentação | Prova focada |
| --- | --- | --- |
| Dashboard | `runtime/procurement.ts#domain.view/render`; `src/procurement-screen.ts#procurementDashboard`; aprovado e emitido separados, moeda comparável e indisponibilidade explícita | `procurement-runtime.test.ts`; `wp04/money.test.ts` |
| Requests | View autorizada, detalhe Requisition/Sourcing/Purchase order/History, filtro/busca, origem dos dados e erros associados ao campo | `parity-procurement.test.ts`; `wp04/ui-guidance.test.ts`; `wp04/ui-queues.test.ts` |
| My approvals | Mesmo conjunto autorizado, três grupos por holder; entrada comprovada e ordenação visível; resumo por PR/sourcing/PO | `wp04/money.test.ts`; `wp04/ui-queues.test.ts`; `wp04/projection.test.ts` |
| Suppliers | Cadastro, campos comerciais/compliance, banco restrito, revalidação, linked requests e histórico | `procurement-runtime.test.ts`; `wp04/ui-supplier.test.ts` |
| Settings | Matriz, moedas, critérios, minQuotes, defaults/endereço, anexos, lembretes e reset preservados | `parity-procurement.test.ts`; `wp04/ui-supplier.test.ts` |

Todos os paths de testes acima são relativos a `modules/sucafina/Sucafinav1/test/`. As portas C02 estão em `product/procurement/port.ts`; `list` fornece queue, stock e aging do mesmo recorte. A UI comum ainda apresenta a view autorizada do domínio; esta entrega não afirma que a aplicação composta já consome C02 em todas as telas.

## Estado, próxima ação e autoridade

Esta tabela é descritiva. A autoridade final continua em `runtime/procurement.ts#domain.execute` e `modules/sucafina/porta/act.ts`, com a versão esperada, configuração corrente e holder. Papel, botão ou referência de seleção não concede autoridade. Decidir é uma chamada explícita.

| Estado registrado | Orientação da tela | Transição de negócio preservada |
| --- | --- | --- |
| `draft` | Completar e submeter a requisição | `submit_pr`; save e exclusão permitida permanecem sujeitos ao domínio |
| `pr_pending` | Aguardar a decisão da requisição | `approve` intermediário mantém pendência; último abre sourcing; `reject` exige motivo |
| `pr_rejected` | Rever motivo e corrigir requisição | Save e nova `submit_pr` nas condições originais |
| `sourcing` | Comparar propostas e submeter seleção | `select_quote`, `submit_sourcing`; nenhuma seleção automática pelo ranking |
| `src_pending` | Aguardar a seleção de fornecedor | `approve` intermediário mantém pendência; último libera `po_draft`; `reject` exige motivo |
| `src_rejected` | Rever seleção rejeitada | Correção/seleção/submissão nas condições originais |
| `po_draft` | Completar e submeter a PO | `submit_po` usa validação real e snapshot na submissão |
| `po_pending` | Aguardar a decisão da PO | `approve` intermediário mantém pendência; último aprova; `reject` exige motivo |
| `po_rejected` | Rever e corrigir PO | Save e nova submissão nas condições originais |
| `po_approved` | Aguardar emissão interna | `issue` por papel autorizado; não implica envio ao fornecedor |
| `po_issued` | Emissão interna registrada | Terminal para cancelamento/exclusão; não significa recebimento, pagamento ou entrega externa |
| `cancelled` | Pedido cancelado | Transições recusadas conforme domínio |
| Desconhecido/importado | Estado e próximo passo indisponíveis | Sem inventar etapa, autorização, data ou holder |

O cancelamento exige motivo e autoridade original (criador/admin) e não é acrescentado a estados terminais. A exclusão de pedido continua limitada a draft. As recusas de `porta/codigo.test.ts` e transições de `porta/linha.test.ts` estão na seleção hospedada; esconder um controle não substitui essas recusas.

## Recortes e papéis

| Perfil | Recorte e limite preservados |
| --- | --- |
| Requester puro | Apenas seus requests, inclusive filas, totais e drilldowns |
| Buyer | Visão permitida ampliada, sourcing/PO e criação de fornecedor conforme domínio |
| Approver | O nome do papel não substitui o holder atual; decide sob as regras existentes |
| Supplier admin | Ativação, bloqueio/inativação e banco sob as permissões existentes |
| Admin | Configuração e operações admitidas; não recebe override de holder alheio |
| Viewer | Leitura autorizada, sem escrita por `canWrite`/nome de papel isolados e sem dados bancários restritos |
| Combinações existentes | O recorte de requester puro não restringe indevidamente um papel ampliado; combinações não eliminam regras de edição/holder |

Holder ausente aparece como não atribuído. A política já existente para passos sem holder é preservada, sem inventar pessoa, concessão nova ou aprovação automática. `blockSelfApproval` permanece configurável.

## Proveniência da idade e valores

`approvalStageEntry` localiza a última submissão da etapa atual. Para o primeiro holder usa esse evento; para um holder posterior exige o evento de aprovação do nível anterior, depois daquela submissão. Save, criação e importação não são substitutos. Evento/data inválidos, ausência de pending step ou histórico insuficiente deixam a entrada/idade indisponíveis. O produtor C02 usa horário de observação confiável. A fila mantém esses pedidos, coloca datas conhecidas primeiro por antiguidade e usa o identificador como desempate; não cria SLA nem prioridade numérica.

`procurementMonetaryFacts` e `requestValue` reconciliam valor original, moeda, taxa, fonte e base. Moeda ausente, seleção ambígua, linhas inválidas, overflow ou FX indisponível não viram zero. Snapshots submetidos não são reinterpretados por taxa/base posteriores; taxas string são rejeitadas nas fronteiras de apresentação. `procurement-money-v2` entra nas dependências C06 somente quando campos financeiros foram selecionados. A comparação usa o motor de scoring existente; arredondamento é de apresentação e não muda cálculo ou ordem.

Referências `contractRef`, `assetRef`, centro de custo e expenseType continuam texto/classificação. Não criam vínculo orçamentário, contrato validado nem saldo disponível.

## Portas reais entregues

| Export próprio | Consumidor/obrigação |
| --- | --- |
| `createProcurementPort`, `projectProcurementSource` | C02 de pedido/fornecedor/contrato/comparação e queue/stock/aging |
| `createProcurementSourceResolver`, `createProcurementCollectionRegistry`, `createProcurementCollectionMemberIssuer` | Emissão/resolução privada, seleção autorizada, continuidade, reissue e evidência individual |
| `projectProcurementScope` | Instalar em `createSfSourcePersistence.projectScope` em todas as mutações duráveis; não apenas em leitura |
| `createProcurementCapabilities`, `createProcurementUiBindings` | `sf_request_read`, `sf_sourcing_compare`, `sf_supplier_read`, `sf_contract_read`; dispatcher comum e schemas fechados |
| `createProcurementConfirmationObserver` | WP08: observe/fence/verifyManifest/fenceManifest; preservar matéria C06 e rotear `sf-procurement-c06:` |
| `createProcurementSourcingEvidence` | WP10: entrada autorizada do verificador com critérios e regras reais |
| `createProcurementDecisionPreparation` | WP09: request/comparison/limitations determinísticos, somente leitura e revalidação pelo consumidor |
| `createProcurementC12Bridge` | WP11: prepareScenario/reviewDomain/resolveMutation/receiptVersion; confirmação humana, CAS e recibo atômico continuam no consumidor |

O host deve consumir esses exports, sem cópia de fórmula nem novo store. Detalhes, pins e deltas revisáveis estão em `integration-requests.md`. O CI próprio injeta o projector exportado no seam real do lifecycle e usa SQLite; isso não prova a instalação na aplicação comum.

## Limites de evidência

- Não houve testes locais, execução de modelo residente, MCP de usuário montado, GNATIVE, C/G7, D/G8 ou AM01–AM06.
- Não houve medição humana de 30 segundos, observação de foco/teclado em browser ou prova de bytes HTTP de todos os downloads.
- Os testes novos de estratégia usam saves reais e um estado PO independente para provar a recusa; não são descritos como jornada browser completa.
- Os testes de comparação preservam os valores binários do motor. Proximidade numérica só trata ruído IEEE; valores originais, taxa, ranking, metadados e texto formatado têm assertions próprias.
- O resultado do typecheck do package é reportado integralmente, mesmo quando os diagnósticos restantes estão fora do ownership. Nenhuma exclusão, cast permissivo ou supressão foi introduzida para esconder erros estrangeiros.
