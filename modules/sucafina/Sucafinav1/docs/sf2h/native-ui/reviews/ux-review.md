# Cold review independente — UX e cobertura

Baseline examinada: `sf-sidebar-plan@2f143330a0a44d34eb764ebfb851804c504edb6d`, PR76. Fontes de domínio examinadas no C27 `b10c424a6b318879fc30f11d03ba1cfeffda7d1a`; canônico `dbf9547211d9b0fade619790de7c19c0869b7c7d`. Revisão documental e visual; zero execução de produto, teste, servidor ou CI. As linhas abaixo referem-se à baseline, antes das correções.

## Parecer

**HOLD para despacho de executores na baseline examinada.** A direção visual é coerente, mas os 70 nomes de inventário e 1610 apontadores não fecham a paridade operacional. Há comandos omitidos, uma atribuição de comando à superfície errada, preferência de entrada sem resolução e rotas insuficientes para tarefas sem caso. A descrição ainda transfere decisões relevantes a autores paralelos.

## Findings

### UX-01 — P1 — Excluir rascunho de compra desapareceu do inventário fechado

- Evidência: `SCREEN-INVENTORY.md:43,107` enumera create/save/submit/select/approve/reject/issue/cancel. `runtime/procurement.ts:429–446` admite também `delete` para Requests/My approvals; `:613` encaminha esse comando para `deleteDraft`.
- Sequência causal: autor U11 usa a lista da migração como contrato → implementa Cancelar pedido mas não Excluir rascunho → tarefa original desaparece apesar de CAP25 marcado coberto. Cancelar não substitui excluir: são comandos distintos do produtor.
- Correção: matriz de paridade por action ID e source page; explicitar `Requests/delete` → menu do rascunho → confirmação curta → resultado original/refetch → lista preservada. `cancel` mantém motivo e transição original. Nenhum desses comandos pode ser deduzido da aparência/role do botão.
- Fechamento: o inventário deve enumerar ambos; um executor recebe rotas, input original, affordance, revisão e pós-condição diferentes. Futuro teste verifica rascunho deletado, pedido cancelado e negações sem fundir semânticas.

### UX-02 — P1 — Importação e exportação de membros atribuídas à página produtora errada

- Evidência: `SCREEN-INVENTORY.md:25` coloca importação/exportação em Team Structure. Em `runtime/dashboard-people.ts:36–73`, `import` e `exportAllMembers` pertencem a `pages[3]`, Talent Review, e exigem admin. Team Structure admite apenas `saveCio`, `saveLeader`, `deleteLeader`, `saveMember`, `deleteMember`.
- Sequência causal: adapter recebe CAP07/Team Structure/import por seguir a tabela → produtor responde 400; um autor tenta corrigir alterando gate ou realocando para API genérica → risco de regressão de autorização de Talent.
- Correção: controles podem ser colocados no contexto Pessoas, mas a matriz deve fixar source surface Dashboard, source page Talent Review e action ID original. Na migração fechada, deixar import/export na vista Talent e apontar da Estrutura apenas quando essa capability é autorizada.
- Fechamento: nenhuma operação `Team Structure/import` ou `Team Structure/exportAllMembers` é gerada; o manifesto registra provenance e papel originais sem conceder acesso novo.

### UX-03 — P1 — Hoje obrigatório elimina a entrada pessoal canônica

- Evidência: `UX-DESIGN.md:17` fixa home em Hoje. WP01.T04 `/tasks/3/work/0` exige escolher entrada preferida; `/tasks/3/axioms/completeness_criteria/0` inclui preferência existente e registro removido/inacessível. `TRACEABILITY.md:58` declara essa obrigação preservada, mas não há precedência ou UX da escolha.
- Sequência causal: usuário já escolheu aprovações como entrada → abre contexto sem deep link → router sempre manda a Hoje → migração perde preferência, obriga passos extras e contradiz fonte canônica.
- Correção: deep link explícito autorizado tem precedência; sem deep link, preferência do mesmo owner válida; depois Hoje autorizado; depois primeiro destino autorizado em ordem fixa. Deep link inválido/negado apresenta estado e retorno explícito, nunca fallback silencioso. Configurar entrada no seletor de vistas, com um controle opcional “Usar como entrada”. Preferência inválida é informada, não força versão inexistente nem é apagada como se houvesse logout.
- Fechamento: quatro casos determinísticos (novo, preferência válida, preferência removida, deep link válido/negado) e subdestino por permissão, incluindo ator com apenas Contracts.

### UX-04 — P1 — Rotas não representam detalhe de compra nem relação sem caso

- Evidência: `SCREEN-INVENTORY.md:43` só dá `/sf-procurement/requests` para criar/editar/submeter todo ciclo. `:76` usa `/sf-decisions/:caseRef/relations` para relações gerais. `UX-DESIGN.md:53–57` exige URL de detalhe e retorno. WP01.DOD.03 e WP01.T05 exigem operação direta sem caso obrigatório para tarefas simples.
- Sequência causal: relação contrato↔pedido sem caso precisa deep link → único template requer caseRef → executor cria caso fictício, inventa nova rota ou perde deep link; dois autores implementam templates diferentes. Pedido não tem contrato comum para selecionar etapa/edição/reload.
- Correção: manifesto de rotas exato por entrada, criação, detalhe, edição e review; relação independente em `/sf-work/relations/:relationRef` com refs autorizadas da origem, e alias de caso somente quando vínculo existe. Templates de pedido sob `/sf-procurement/requests/:requestRef/...`. Owner, filtros e retorno são compartilhados e não transportam conteúdo sensível.
- Fechamento: cada destino do inventário resolve sem inventar refs; nenhum fluxo simples exige criar caso. Rotas parametrizadas ficam no manifesto único de I00; componentes consomem route builders publicados.

### UX-05 — P2 — Responsividade e conservação do draft deixam decisões materiais abertas

- Evidência: `UX-DESIGN.md:200–212` especifica 320–767, 768–1023 e ≥1440; não define 1024–1439. As dimensões de lista/detalhe/contexto `:80–96` competem pela largura útil. Estados de draft são descritos em `:73,110–112,188–198`, sem tabela de eventos de navegar/fechar aba/refetch/trocar owner/expirar sessão.
- Sequência causal: em notebook 1280/1366 os autores escolhem breakpoints distintos → tela de compra conserva três painéis e Planner faz outra escolha; ao mudar rota um componente destrói draft enquanto outro o retém. Verificação apenas 320/768/1440 não fixa o caso mais frequente intermediário.
- Correção: congelar layout pela largura útil da superfície e cobrir 1024/1280/1366; lista/detalhe simultânea somente com mínimos legíveis, contexto sob demanda ocupando a área de detalhe quando faltam pixels. State table comum: refetch não substitui dirty; navegação interna do mesmo owner preserva draft em store efêmero; mudança owner/logout/revogação limpa após decisão explícita quando a ação é voluntária, sem retardar revogação. Reload/fechar aba avisa antes de perder draft sem simular persistência sensível.
- Fechamento: matriz de eventos e resultados única consumida por todos os editores; fixtures em cada limite e notebook; títulos longos e zoom sem corte. A p16 ilustra 360px e não comprova 320px — isso é limitação declarada, não bug visual.

### UX-06 — P2 — Pranchas e linguagem de BI não fecham o contrato do gráfico

- Evidência: PDF p2 apresenta a trajetória com legendas apenas Outlook/Budget; canônico WP05.T01 exige trajetória budget/actual/outlook e actual ausente versus zero (`WP05.json:201,211–216`). PDF p11 imprime `BI01`, `BI02`, `BI03`, `BI09–BI11` como texto de produto; WP01.QLT.01 exige linguagem de negócio, e detalhes de evidência ficam sob demanda.
- Sequência causal: executor imita a prancha → deixa actual apenas como KPI e copia IDs de requisito para cards → aparência bate com PDF mas semântica/copy diverge do produto exigido.
- Correção: declarar PDF r1 conceitual e especificação operacional prevalente; BI01 mostra séries e corte conforme DTO, actual com lacuna real e sem interpolação, tabela equivalente e dados acessíveis. Labels de gráfico são nomes de negócio; IDs de prova só em anotação de planejamento/metadata de diagnóstico autorizada. Fixar fixture por ID/ano/versão para não conectar visualmente uma cotação 2027 a uma hipótese 2026 sem explicação.
- Fechamento: contrato/manifesto de série e corpus determinístico referenciado; PDF/adendo deixa explícita a correção antes de executor copiar referência.

## Cobertura efetivamente examinada

- Os nomes CAP01–CAP28 correspondem a 16 Dashboard + 7 Planner + 5 Procurement em `src/nav.ts`; 28 IDs únicos e UI29–UI70, 42 IDs únicos.
- Os 15 destinos do UX-DESIGN estão presentes nominalmente. Esta revisão não tratou a mera contagem como prova de ações/campos/estados.
- Li as 17 pranchas renderizadas. Não há overflow comprovado no título da aprovação p16: bbox PDF x524–829,54 está dentro do cartão x500–860. Uma impressão visual inicial foi retirada após medição, sem virar finding.
- Li WP01 integral e trechos relevantes do WP05/canônico; confronto de domínio cobriu os seis arquivos runtime principais. Inventário de ações novo usa esses arquivos pinados e deve passar por reconciliação de blobs antes de despacho no candidato vigente.
- Os 1610 IDs em criteria-trace apontam para owners/task mappings. Isso é rastreabilidade documental; não constitui prova independente de completude semântica, readiness de contrato ou produto.

## Correção produzida nesta rodada

A pedido do root, este revisor passou a autorar o suplemento `execution/SURFACE-SPECS.md` e `execution/surface-manifest.json`. Esses suplementos precisam de leitura cruzada por outro agente; este parecer frio se refere à baseline original e não aprova automaticamente a própria correção.
