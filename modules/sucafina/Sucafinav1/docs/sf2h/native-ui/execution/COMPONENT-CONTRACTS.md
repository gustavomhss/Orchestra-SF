# Contratos fechados das composições de UI

Estado: especificação de implementação, não componentes entregues. As assinaturas TypeScript em [component-signatures.ts](component-signatures.ts) são normativas para props, payloads, retornos e discriminators; este documento fixa sua semântica para autores em paralelo; os contratos financeiros, de autorização e de persistência continuam nos produtores. Um componente compartilhado não faz fetch, não escolhe endpoint, não calcula valores de negócio e não recebe um Snapshot privilegiado.

## 1. Regras comuns de assinatura

- Implementar componentes SolidJS no subtree exclusivo da ordem S correspondente. Exportar os nomes abaixo sem aliases. O integrador publica os entrypoints; não criar barrels concorrentes.
- Props são readonly; `children` e slots usam `JSX.Element`. Estado coordenado usa `createStore`. O componente emite eventos tipados; o consumidor possui a chamada de domínio.
- Texto recebe chaves de i18n e parâmetros; o leaf dictionary é propriedade da fatia. Formatação usa o locale e as unidades recebidas. Labels existentes do domínio preservam significado e versão; não são inventados a partir de property names.
- IDs de elemento são locais à instância; refs de domínio permanecem opacas. Identificador de linha não é o índice nem o título. Nenhum controle recebe papel, lease ou principal da tela como autoridade.
- A classificação de estado é fechada: `loading | ready | empty | filtered-empty | partial | not-found | invalid | stale | conflict | unavailable | denied | session-expired | outcome-unknown`. O adapter traduz o resultado tipado do produtor. O componente nunca infere revogação só de timeout, 404 ou falha de parsing.
- Nenhum callback de escrita é chamado por mount, render, preload, foco, mudança de tab, refetch ou restauração de estado. Escrita só vem de gesto explícito e usa a identidade de operação do client do owner.
- `busy` desabilita o novo disparo da mesma ação, preserva leitura/foco e anuncia o estado. `AbortSignal` cancela espera/consulta; não afirma desfazer efeito já admitido.

A tradução das variantes de superfície é fixa: `resolving-context → loading`; `read-only → ready` com controles readonly; `revoked → denied` mais purge imediato; `invalid-link → invalid`; `removed-not-found → not-found`; `filter-empty → filtered-empty` apenas como nome histórico, nunca como segundo estado implementado. As fases do draft são outra máquina: validating/reviewing mantêm a projeção autorizada; submitting/pending usam busy e a identidade pendente; falha de resposta após envio torna `outcome-unknown`. Não inferir estado final pelo nome de uma fase.

Todo leaf de página exporta o símbolo exato da sua work order e recebe somente `SfSurfaceProps = { readonly surfaceId: SurfaceId; readonly route: SfResolvedRoute }`. A definição única vive em `packages/app-shell/src/orchestra/chapters/sucafina/context/contracts.ts`, propriedade F01. `SurfaceId` vem do manifesto fechado; `SfResolvedRoute` é o resultado do resolver, não query arbitrária. O leaf usa `useSfContext()` do provider vigente para acessar o client e estado do owner. Não recebe principal, grant, lease, cookie ou client arbitrário por prop. I00 mantém a assinatura atual `ChapterPageProps` na entrada do shell e compõe o resolver F01 antes de montar esses leaves.

## 2. `SfPageFrame` e `SfStatePanel`

`SfPageFrame` recebe `titleKey`, `subtitleKey`, `eyebrow`, `context`, `tabs`, `activeTab`, `primaryAction`, `secondaryActions`, `density`, `layout` e `children`. `context` contém somente rótulos já autorizados de instalação/período/versão/moeda; não resolve acesso. `primaryAction` é ausente ou uma única descrição `{id,labelKey,disabled,reasonKey?,busy,onInvoke}`. `tabs` são `{id,labelKey,href,available}` da route manifest; tab indisponível não dispara consulta. A navegação é delegada ao route builder do owner, conservando contexto permitido.

`density` aceita `comfortable | compact`, com linhas de 44px e 36px respectivamente; preferência é de apresentação e owner-scoped. `layout` aceita `reading | work | split | comparison`. O canvas financeiro usa largura útil, sem mudar o kit global. Contexto secundário fechado não ocupa coluna vazia.

Uma única observação de largura por PageFrame determina `single`, `split` ou `split-context`: split exige no mínimo lista 320px + detalhe 480px + separador 1px, após padding; contexto adicional exige mais 320px + separador. A largura restante não é emprestada dos mínimos. A sidebar segue o shell e não se recria aqui. Em single, a rota de detalhe substitui a lista e exibe Voltar; o estado da lista permanece no owner.

`SfStatePanel` recebe `state`, `messageKey`, `detailsKey?`, `coverage?`, `onRetryRead?`, `onLogin?`, `onBack?` e `children`. Ready/partial mostram apenas dados autorizados. Empty significa coleção autorizada realmente vazia; filtered-empty mantém filtros; not-found informa detalhe removido ou não encontrado sem revelar existência fora da autorização e oferece retorno à lista; unavailable mantém contexto e permite retry de leitura. Denied/session-expired não exibem o children privado. Um erro solicitado pelo usuário aparece inline ou no toast existente, sem catch silencioso. `outcome-unknown` não oferece Salvar/Aplicar novamente: oferece a reconciliação definida pelo produtor.

`SfContextBar` recebe `selection`, `catalog`, `lockedReasons`, `onRequestChange` e `state`. Selection contém IDs opacos de ano/período/versão/moeda admitidos; catalog vem da projeção autorizada. O callback solicita mudança ao owner, passa pela regra de draft e só então altera rota/consulta. Não sincronizar seletores independentes de Dashboard, Planner, Serviço e Segurança. F03 possui esses três exports e os frames visuais `SfChartFrame`/`SfRunState`; a lógica de dados pertence aos consumidores.

## 3. `SfDataTable` e `SfRecordDetail`

`SfDataTable<Row>` recebe `rows`, `getRowKey`, `columns`, `selectedKey?`, `sort`, `page`, `onSort`, `onPage`, `onSelect`, `rowActions`, `captionKey`, `density` e `state`. Cada coluna é `{id,labelKey,align,widthPolicy,render,sortKey?}`; `render` só apresenta campo autorizado, não agrega. `page` recebe cursor/intervalo/total da projeção; total ausente é mostrado como desconhecido e não inferido do page size. Paginar não consulta outro owner. A seleção usa ref opaca estável e volta à mesma linha quando ainda existe.

Tabela de leitura usa table/caption/thead/th/scope, não role=grid. Ações permanecem alcançáveis por teclado e visíveis sem hover. O título da linha é link para o detalhe; outras ações não transformam a linha inteira em um botão aninhado. Ordenação é a suportada pelo produtor; se a fonte entrega coleção finita autorizada, ordenação local de apresentação é explicitamente marcada pelo adapter e não altera os totais.

`SfRecordDetail` recebe `title`, `secondaryId?`, `status`, `metadata`, `sections`, `primaryAction?`, `secondaryActions`, `sourceActions`, `onBack` e `onOpenPage`. `sections` são slots já definidos no surface-manifest. Formulário extenso usa a página completa; confirmação curta usa o DialogV2 existente, nunca modal sobre modal. Fechar detalhe restaura foco na linha acionadora ou cabeçalho da lista se removida.

`SfListDetail` recebe `list`, `detail`, `selectedRef?`, `onBack`, `onOpenPage` e `layoutMode` proveniente do PageFrame. É somente composição: não mantém outra cópia da seleção, não consulta dados e não muda o route builder. Single monta a superfície ativa e preserva o estado no owner; split mostra lista e detalhe, respeitando os mínimos. S01 possui os três componentes deste capítulo.

## 4. `SfMonthlyGrid`

Recebe `rows`, `months` (doze identificadores canônicos), `columns`, `getRowKey`, `cells`, `draftCells`, `activeCell`, `onNavigate`, `onEdit`, `onCommitCell`, `onCancelCell`, `onOpenRow`, `readOnlyReason?` e `state`. Célula usa a união de apresentação `known(value,unit,origin) | missing(reason) | inherited(value?,sourceRef,sourceVersion) | unavailable(reason)` e permissões calculadas pelo produtor. Zero conhecido é 0; ausente é texto acessível de ausência; herdado mostra valor resolvido e marcador de origem quando o produtor o fornece. Nunca substituir herança conhecida pela palavra “Herdado” e ocultar o número. Valor não resolvido continua ausência explícita, sem soma client-side.

Só existe um tab stop do grid; setas navegam sem wrap nas bordas; Home/End percorrem a linha; Ctrl+Home/End vão ao primeiro/último item carregado com posição anunciada. PageUp/PageDown deslocam a quantidade visível de linhas; não fazem bulk fetch ilimitado. Enter/F2 inicia edição autorizada. No editor, setas movem o cursor, não a célula. Enter confirma a célula no draft local; Esc cancela essa edição e devolve foco à célula. Tab conclui a edição local e segue a sequência da página; nenhum desses eventos salva o domínio. Seleção em massa, colagem de matriz e atalhos de planilha não previstos no produtor não são acrescentados nesta migração.

O editor usa texto numérico com parser/precisão do contrato atual; não converter vazio para 0, nem aplicar Number/parseFloat permissivo para valores locais. Spread/reset são comandos do produtor com revisão explícita de escopo. Totais, outlook, FX e deltas vêm do DTO. Actual/oficial/locked permanecem somente leitura conforme domínio.

Na superfície single, `onOpenRow` abre editor por linha e mês com título completo, valor/base/origem, controles e revisão; as doze competências continuam acessíveis. Não comprimir doze colunas para caber em 320px. A rolagem bidimensional pertence à área do grid; cabeçalho e ações fazem reflow.

## 5. `SfChangeReview` e `SfEvidencePanel`

`SfChangeReview` recebe `operation`, `base`, `current`, `proposed`, `effects`, `coverage`, `blockingReasons`, `confirmation`, `state`, `onConfirm`, `onRevise`, `onCancel` e `onReconcile?`. Todos os valores são resultados de preview/review reais, identificados por versão/ref. O componente não fabrica diff financeiro, policy ou recibo. `confirmation` declara label, propósito e revalidação; o botão só é habilitado quando o produtor admitiu exatamente aquela base/proposta. Uma nova versão invalida essa admissão e pede revisão, preservando o draft autorizado.

Efeitos são listados por domínio; sucesso parcial mostra quais efeitos e recibos existem. Cancelar fecha revisão sem executar domínio. Aprovar, Salvar, Escolher, Submeter e Aplicar permanecem ações separadas conforme action binding. Em confirmação destrutiva, foco inicial fica na ação menos destrutiva; resumo longo recebe foco no título, mantendo tab trap e retorno de foco do DialogV2.

`createSfDraft<Value>` recebe o `SfDraftInput<Value>` normativo: `ownerKey`, `editScopeKey` estável, `surfaceId`, `identity` discriminada entre registro persistido e intenção local, `baseVersion`, `base` e `value`. Base/versão podem ser nulas antes de uma entidade existir. A chave de lookup é owner + editScopeKey + surface + identity; **baseVersion é conteúdo mutável, nunca parte da chave**. `snapshot` é accessor readonly da união `SfDraftState`; callbacks e resultados são os do arquivo TypeScript. `receiveRemote` não sobrescreve Value dirty: registra uma base candidata; `confirmSave` consome somente a operação correspondente e distingue projeção autoritativa de confirmação sem projeção. Não promover o payload enviado a versão atual lida.

O registry pertence ao provider F01; o raw controller S03 tem lifecycle privado. As páginas recebem somente a facade de UI pelo contexto, sem métodos de restore/quarantine/revoke. Restauração de quarentena exige reautorização real e a regra de rebind do host, não posse de uma ownerKey antiga. S03 não faz merge automático, persistência em storage nem dispatch e possui `createSfDraft`, `SfChangeReview` e `SfReceiptView`.

`SfReceiptView` recebe `operationRef`, `producerStatus`, `effects`, `receipts`, `state`, `onReconcileRead?` e `onOpenSource?`. Distingue recibo real de confirmação por releitura quando o produtor não emite recibo. Dados do recibo são a projeção autorizada, não JSON bruto. Reconciliar consulta; nunca reenvia a mutação. Um botão de retry de escrita somente é publicado pelo consumidor quando a operação catalogada oferece essa garantia e uma nova ação humana a autoriza.

`SfEvidencePanel` recebe `items`, `selectedRef?`, `state`, `onSelect`, `onOpenAuthorizedSource` e `onClose`. Item contém ref/versão/recorte/cobertura e trecho permitido. Não recebe URL arbitrária executável nem Snapshot. Abrir fonte revalida ACL via operação catalogada. Texto de documento é conteúdo, nunca instrução ou HTML executável. Um painel aberto por vez; sem espaço para terceiro pane, ele ocupa o detalhe com ação Voltar.

`SfAttachmentField` recebe `attachments`, `acceptedFormats`, `limit`, `admissionState`, `recordRef`, `recordVersion`, `onSelectFile`, `onAdmit`, `onRemoveReference` e `onDownload`. Formatos/limites são os do produtor da ação, sem política global mais permissiva. Escolher arquivo não cria vínculo nem comprova scan; admitido, bloqueado, scanner indisponível, substituído e revogado são estados separados. S04 possui os componentes desta seção; bytes e downloads passam pelo transporte homologado, nunca por URL arbitrária.

## 6. `SfChartFrame` e `SfRunState`

`SfChartFrame` recebe `titleKey`, `questionKey`, `context`, `coverage`, `series`, `table`, `selection`, `state`, `onSelect`, `onOpenSource` e `children`. Série contém IDs, unidades, valores/ausências e significado do produtor. O frame não recalcula, interpola ausência, converte FX ou cria tendência. Cada gráfico tem tabela equivalente, rótulos, fonte e estado vazio/parcial acessíveis. A interação oferece a mesma seleção pela tabela/teclado. IDs BI01–BI11 pertencem à evidência técnica e não aos títulos visíveis.

BI01 exibe budget, actual e outlook conforme o contrato, distinguindo fechamento de actual e forecast aberto. A ausência de actual cria lacuna real; 0 é observado. Não conectar visualmente períodos incompatíveis ou obter um total somando pixels/séries no browser. Gráficos são SVG nativo + tabela sem nova dependência de charts; o adapter entrega os valores calculados.

`SfRunState` recebe `SfRunStateProps` do arquivo TypeScript: `identity` distingue `unadmitted` de `run`, e o descritor `task` distingue rotina (recipeRef/version) de análise (profile/skill/version). Antes da admissão, somente unavailable/ready/needs-input são possíveis, sem runRef, progresso ou resultado fabricados. Com run real, preserva inputVersion e os estados `unavailable | ready | queued | running | needs-input | cancelling | cancelled | failed | partial | complete | stale`, mais modelo/sessão, cobertura, ações e callback tipados. Progress percentual só aparece quando o produtor fornece medida real; caso contrário usa atividade indeterminada. Nova informação pode exigir nova versão/run conforme produtor; o componente não reinicia. Complete não aplica resultado nem aprova decisão.

Os renderizadores concretos são exports distintos: U20 `SfFinancialFigure`, U21 `SfOperationalFigure` e `SfBiCatalog`, U22 `SfDecisionFigure`. Recebem `{viewId, projection, selection, onSelect, onOpenSource}` com o DTO fechado da família BI. I00 compõe o mapa de viewId→componente; nenhum desses autores escreve o wrapper ou a pasta do outro. Não há um `SfBiFigure` com três donos.

## 6.1. Composição de colaboração S05

`SfRelations` recebe `sourceRef`, `relations`, `candidates`, `state` e callbacks `onSearchTargets`, `onCreate`, `onRemove`, `onOpen`. Refs têm tipo e identidade originais; nome igual não vincula objetos. A relação não exige caseRef. Criar/remover só usa ação catalogada e confirmação quando requerida.

`SfThread` recebe `threadRef`, `incarnation`, `version`, `messages`, `draft`, `state`, `onEditDraft`, `onPost`, `onReconcileRead` e `onOpenOrigin`. Mensagens mantêm IDs/versões e autoria retornados; postar uma vez conserva pendingOperation se resposta não chegar. Indisponibilidade não apaga o draft, revogação real limpa o conteúdo. Não criar thread paralela se a origem já tem uma.

`SfQuestion` recebe `questionRef?`, `sourceRef`, `recipientOptions`, `question`, `answer?`, `state` e callbacks `onPrepare`, `onSubmit`, `onAnswer`, `onOpen`. Destinatário é referência autorizada e resolvida pelo serviço; não inferir por nome/email nem enviar mensagem externa como efeito colateral.

`SfConfirmation` recebe `selectionRef`, `materialVersion`, `status`, `coverage`, `state`, `onConfirm` e `onRevalidate`. Confirmar sem mudança usa o recorte C06 real; diferença fora dele não cobra confirmação novamente. Não trata comentário ou pergunta como aprovação financeira. Os quatro componentes usam a mesma gramática de estados e drafts, sem um segundo motor de tarefas.

## 7. Estado de draft e navegação

O store efêmero do owner fica acima da boundary keyed por chapter, abaixo dos providers do shell. F01 controla lifecycle e a transferência explícita de quarentena para novo authEpoch após a revalidação abaixo. Um subcomponente ou polling não é dono dessa vida útil. Cada draft usa chave owner + editScopeKey estável + surface + identity (recordRef ou newIntentRef). baseVersion é estado mutável da base, nunca componente do lookup; refetch de revisão não cria outro draft. Não usar localStorage, URL ou cache de service worker para conteúdo privado.

| Evento | Decisão fechada |
| --- | --- |
| Refetch da mesma base | Atualizar leitura não editada; não sobrescrever draft/foco/seleção/scroll |
| Fonte muda durante edição | Conservar draft autorizado, marcar stale e pedir nova revisão; não salvar automaticamente |
| Troca de chapter/objeto no mesmo owner | Conservar draft em memória e indicador de retomada; não duplicar entidade nem salvar domínio |
| Reload/fechar janela com draft | Usar mecanismo de aviso existente antes de saída; sem alegar que aviso garante persistência; abandonar explicitamente perde draft efêmero |
| Troca voluntária de owner | Antes de trocar, oferecer permanecer ou descartar; depois cancelar recursos e limpar dados do owner antigo antes de montar o novo |
| Logout voluntário | Guard de draft pode oferecer permanecer ou descartar antes do ato; depois de confirmado logout/saída definitiva, limpeza imediata dos dados afetados |
| Revogação comprovada | Limpeza imediata dos dados afetados; não esperar confirmação de descarte para cumprir perda de acesso |
| Sessão expirada | Ocultar/bloquear UI privada; quarentena efêmera somente sem revogação comprovada. F01 pode transferir para novo authEpoch após revalidar mesmo servidor/identidade de transporte/origin/principal/instalação/projeto e autorização atual da entidade/campos. Logout/revogação confirmados nunca restauram; identidade ou acesso incompatível purga o conteúdo afetado |
| Timeout/503 no mesmo owner ainda autorizado | Conservar draft e operação pendente; retry só de leitura/reconciliação, sem redispatch de comando |
| Escrita confirmada | Atualizar base com resposta autoritativa e limpar apenas draft confirmado; não limpar outra edição independente |

`beforeunload` não substitui receipt de comando: efeito já admitido é reconciliado pelo produtor após reabertura. Nenhum componente promete recuperação de um draft local após fechar o processo.

## 8. Prova mínima por composição

F03: estados distintos, uma CTA, 320/768/1024/1280/1440, foco e contexto. S01: seleção/retorno/teclado, lista extensa, total ausente, sem nested interactive. S02: teclas, parser, zero/ausente/herdado, bloqueios e editor por linha. S03: base alterada, Cancelar sem efeito, resultado incerto, perda de acesso e confirmação única. S04: fontes/anexos admitidos, scanner e acesso. S05: relações/threads/perguntas/confirmação com identidade atual. U20–U22: tabela equivalente/ausência e seleção de gráficos. O estado assíncrono comum é exercitado no F03 e nas ligações próprias de U27/U37.

Essas verificações são executadas no harness hospedado quando os componentes existirem. Não repetir cada teste compartilhado em toda tela. Cada consumidor acrescenta apenas a ligação ao seu domínio e os riscos próprios; a matriz final canônica permanece integral.
