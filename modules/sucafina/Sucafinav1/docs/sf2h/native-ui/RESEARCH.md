# Pesquisa de UX e decisões aplicadas

Consulta: 15 de novembro de 2026 UTC. Fontes primárias; leitura de padrões, não adoção de bibliotecas externas. “SOTA” aqui significa uma proposta informada por práticas atuais e pelo produto real. Beleza, eficiência e compreensão ainda precisam ser demonstradas com usuários e na implementação.

## Evidência e tradução para Orchestra SF

| Fonte primária | Princípio observado | Aplicação concreta | Limite |
| --- | --- | --- | --- |
| [Fluent 2 — Nav](https://fluent2.microsoft.design/components/web/react/core/nav/usage) | Navegação concisa; categorias organizam destinos; hierarquia limitada e estado ativo claro | Uma sidebar, grupos sem rota, cada área SF é chapter. Ordem estável e busca como atalho | Não importar React/Fluent, nem mudar a semântica do sidebar Orchestra |
| [Carbon — Data table](https://www.carbondesignsystem.com/building-blocks/core/components/data-table/guidelines) | Tabela com título, toolbar, linhas e paginação; ações em contexto; detalhe amplo quando a expansão fica apertada | Filas Procurement/Meu trabalho; toolbar curta; lista + detalhe; ações de lote apenas onde já autorizadas | Grid mensal financeiro exige comportamento próprio; tabela genérica não resolve edição de planilha |
| [SAP — Flexible column layout](https://learning.sap.com/courses/developing-an-sap-fiori-elements-app-based-on-a-cap-odata-v4-service/configuring-the-flexible-column-layout_b5066855-aa7c-4943-a64b-64050ccfea75) | Lista e objeto podem coexistir para manter o contexto da seleção | Lista + detalhe em compras e trabalho; detalhes profundos e comparações abrem página ampla | Não copiar três colunas para telas estreitas; nunca segunda sidebar |
| [GOV.UK — Check answers](https://design-system.service.gov.uk/patterns/check-answers/) | Revisão compreensível antes do envio, com possibilidade de corrigir | Aprovação mostra etapa, versão, valor, diferença e origem; import mostra impacto antes de Aplicar | Revisar não é aprovar; o contrato canônico determina a transição |
| [W3C APG — Grid](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) | Grid interativo requer gerenciamento explícito de foco e teclado | Planner: navegação por célula, entrada e saída do modo de edição; tabelas de leitura usam semântica table | Colocar role=grid sem comportamento completo piora acessibilidade |
| [WCAG 2.2 — Focus not obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html) | Elemento em foco não pode ficar totalmente oculto por conteúdo criado pelo autor | Foco visível sob headers, rodapés e painéis; meta de produto é visibilidade integral | Evidência depende do layout real e de zoom, não da prancha |
| [WCAG 2.2 — Target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) | Alvos de 24 CSS px ou exceções/espaçamento previstos | Controles compactos respeitam alvo; ações de toque miram 44 px como escolha de design | 44 px é meta proposta para toque, não descrição do requisito AA |
| [Microsoft HAX — Guidelines](https://www.microsoft.com/en-us/haxtoolkit/ai-guidelines/) e [pesquisa original](https://www.microsoft.com/en-us/research/blog/guidelines-for-human-ai-interaction-design/) | Diretrizes de interação humano–IA tratam capacidades, erros, controle e evolução | IA contextual com origem, cobertura e limites; pessoa edita premissas e registra escolha; cancelar e corrigir são visíveis | Base de pesquisa não é novidade de 2026; não prova confiabilidade de nenhum modelo ou deste produto |
| [Orchestra DESIGN em C27](https://github.com/gustavomhss/Orchestra-SF/blob/b10c424a6b318879fc30f11d03ba1cfeffda7d1a/packages/app-shell/src/orchestra/DESIGN.md) | Material, tipografia, densidade, estados e composição próprios | Inter, tokens semânticos, MxPage, uma ação primária, superfícies contidas, temas reais | A extensão de largura para trabalho financeiro é proposta local, não mudança global do design system |

## Síntese de design

1. **Trabalho antes de ferramentas.** A entrada deve responder “o que precisa de mim?” e permitir passar ao objeto real. Não abrir com um catálogo de agentes ou uma conversa vazia.
2. **Leitura progressiva.** Título e contexto; uma ação principal; resumo decisivo; objeto de trabalho; evidência sob demanda. A mesma página não deve competir com cinco áreas de destaque.
3. **Densidade deliberada.** Espaço generoso nos títulos e agrupamentos, linhas compactas onde comparação exige proximidade. Não representar cada número como um card independente.
4. **Contexto persistente.** Lista/detalhe conserva filtro e seleção; operações complexas ganham página própria com retorno exato.
5. **Confiança verificável.** Valores incluem período, moeda, versão e cobertura. Branco, zero, herdado e parcial têm representações distintas. Uma sugestão de IA não ganha aparência de dado aprovado.
6. **Controle antes de efeito.** Revisar, salvar, submeter, escolher e aplicar são ações distintas quando os contratos assim exigem. A interface reduz dúvida, não remove etapas de autorização.
7. **Estética Orchestra.** A qualidade vem de alinhamento, escala, contraste e hierarquia. O material do shell já define a identidade; não se propõe tema Sucafina independente.

## Pesquisa aplicada ao conteúdo e linguagem

Rótulos propostos em português nas pranchas são parte da revisão de UX. Na implementação, inglês e pt-BR entram pelas APIs tipadas de i18n e os demais locales seguem o fallback atual. O app exige verificação de terminologia com corpora oficiais e revisão de todas as strings iguais ao inglês; esse trabalho está em N2/N10, não foi declarado concluído.

“Planner”, “Procurement” e “Dashboard” ficam preservados porque foram explicitamente pedidos e já nomeiam capacidades do produto. Descrições explicam planejamento, compras e visão executiva. “Portfólio” descreve projetos/cenários; “Decisões” descreve casos e escolhas; “Reuniões” abriga pauta, revisões preservadas e relatórios.

## Como verificar se o redesenho é bom

Realizar revisão de tarefas por papéis reais depois do piloto, usando corpus autorizado/sintético: encontrar a próxima aprovação, explicar seu valor e versão; editar um mês sem alterar actual; localizar uma diferença de cenário; identificar um custo ausente; voltar sem perder filtro; preservar e exportar uma reunião. Registrar dificuldade, caminho, erros e interpretação. Conservar o critério canônico de compreensão do resumo de aprovação em 30 segundos; não inventar métricas já alcançadas.

As pranchas permitem julgar composição e direção. A aceitação depende também de teclado, leitores de tela, dados extensos, responsividade, estados adversos e comportamento real. Não aceitar somente semelhança visual.
