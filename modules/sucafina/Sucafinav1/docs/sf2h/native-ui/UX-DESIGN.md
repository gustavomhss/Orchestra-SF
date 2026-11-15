# UX: Sucafina como centro do Orchestra SF

Estado: **design proposto, não implementado**. Referências de comportamento em [RESEARCH](RESEARCH.md); inventário e rotas em [SCREEN-INVENTORY](SCREEN-INVENTORY.md). As [pranchas](UX-BOARDS.pdf) usam dados sintéticos e ilustram a composição, sem afirmar serviço conectado ou prova de runtime.

## 1. Objetivo e hierarquia

A experiência deve permitir que uma pessoa reconheça o contexto, entenda o que mudou e execute a próxima ação autorizada sem reconstruir o raciocínio em várias telas.

A hierarquia de cada tela será:

1. **Onde estou:** perfil/instalação e área; período, moeda e versão explícitos quando relevantes.
2. **O que preciso entender:** título objetivo e uma frase curta; resumo com origem e cobertura.
3. **O que posso fazer agora:** uma ação primária da etapa atual.
4. **Onde trabalho:** lista, grid, comparação ou documento.
5. **Como verifico:** detalhes, fonte, histórico, perguntas e recibos em contexto.

A home da instalação SF será **Hoje**, resolvida após carregar o contexto autorizado. O Home técnico do Orchestra continua acessível no grupo complementar. Abrir um deep link nunca redireciona silenciosamente para Hoje.

Hoje e Dashboard têm funções diferentes: Hoje organiza responsabilidade e retomada; Dashboard explica situação, variações e riscos do negócio. Meu trabalho é a fila completa pesquisável, enquanto Hoje é uma seleção curta dessa mesma projeção. Não haverá estados de tarefa duplicados.

## 2. Sidebar única: ordem exata

Todos os itens SF abaixo são entradas reais de `navigation` e `chapterPages`. Grupos são disclosures sem rota; não abrem outra aplicação. Ordem estável entre papéis; somente visibilidade autorizada varia.

| Ordem | Grupo | Rótulo pt-BR / en | Chapter ID | Entrada padrão |
| --- | --- | --- | --- | --- |
| 01 | Sucafina | Hoje / Today | sf-home | /orchestra/sf-home |
| 02 | Sucafina | Dashboard / Dashboard | sf-dashboard | /orchestra/sf-dashboard/executive |
| 03 | Sucafina | Planner / Planner | sf-planner | /orchestra/sf-planner/overview |
| 04 | Sucafina | Procurement / Procurement | sf-procurement | /orchestra/sf-procurement/overview |
| 05 | Sucafina | Portfólio / Portfolio | sf-portfolio | /orchestra/sf-portfolio/overview |
| 06 | Sucafina | Decisões / Decisions | sf-decisions | /orchestra/sf-decisions |
| 07 | Sucafina | Meu trabalho / My work | sf-work | /orchestra/sf-work |
| 08 | Sucafina | Reuniões / Meetings | sf-reviews | /orchestra/sf-reviews/agenda |
| 09 | Gestão | Pessoas / People | sf-people | /orchestra/sf-people/overview |
| 10 | Gestão | Operações / Operations | sf-operations | /orchestra/sf-operations/service |
| 11 | Dados e inteligência | Análises / Analytics | sf-bi | /orchestra/sf-bi |
| 12 | Dados e inteligência | Documentos / Documents | sf-documents | /orchestra/sf-documents |
| 13 | Dados e inteligência | Importações / Imports | sf-imports | /orchestra/sf-imports |
| 14 | Dados e inteligência | Memória / Memory | sf-memory | /orchestra/sf-memory |
| 15 | Dados e inteligência | Rotinas / Routines | sf-routines | /orchestra/sf-routines |

**Sucafina e Gestão ficam abertas por padrão; Dados e inteligência fica recolhido, abre ao conter a rota ativa e conserva a preferência por proprietário do contexto.** Apoio, logo abaixo, mostra Chat e Inbox com seus IDs e rótulos existentes. O grupo recolhido Orchestra reúne Home, Board, Agents, Actions e os atuais itens avançados, preservando ordem relativa, rotas, condições WIP e ações de diálogo/comando. Settings permanece no fim. Nenhuma capacidade técnica é removida.

Não criar um item raiz clicável “Sucafina” que contenha todo o produto. Não introduzir reordenação automática por IA. A busca global existente pode localizar registros SF autorizados, mas não é o único caminho para uma área.

Uma conta com acesso apenas a Procurement vê seus destinos aplicáveis nessa mesma ordem. O servidor produz o catálogo de destinos e ações: não deduzir acesso somando papéis das três superfícies. Contratos dentro de Procurement continuam sujeitos ao domínio Dashboard. Crachás da sidebar são reservados a pendências comprovadas de Meu trabalho/Procurement, sem bolinhas arbitrárias em todos os módulos; indisponibilidade não vira zero.

## 3. Gramática de navegação interna

- **Chapter:** área duradoura de negócio.
- **Tabs horizontais:** vistas irmãs do mesmo assunto. Não usar segunda coluna de navegação.
- **Detalhe contextual:** seleção de linha mantém lista, filtro e posição. O detalhe tem URL própria e botão “Abrir página”.
- **Página completa:** edição extensa, comparação de alternativas, revisão de impacto, reunião e sensibilidade.
- **Dialog:** confirmação curta ou edição pequena; no máximo um modal por vez. Nunca um formulário de compra inteiro em modal.
- **Painel contextual:** fontes, atividade ou perguntas, um por vez; é conteúdo do objeto, não outro menu de módulos.
- **Ações:** importar, exportar, gerar relatório e pedir análise são ações em contexto. Seus fluxos também têm destinos rastreáveis nos chapters apropriados.

Tabs com excesso de largura preservam a rota e podem ir para um menu “Mais vistas” com a seleção visível. Não esconder estado ativo num overflow sem rótulo. Em Procurement os tabs são Visão geral, Pedidos, Minhas aprovações, Fornecedores, Contratos e Configuração; em largura curta, Contratos/Configuração vão para o menu de vistas. Configuração só aparece conforme autorização.

Detalhes usam título do objeto, identificador secundário, estado textual e metadados. A ação principal acompanha a etapa: “Continuar pedido”, “Revisar aprovação”, “Registrar escolha”, “Revisar mudanças”. “Aplicar” aparece apenas para uma proposta atual explicitamente revisada e admitida.

## 4. Contexto, filtros e retorno

Formato de rota estável proposto:

`/orchestra/<chapter>/<rest>?server=<encoded ServerConnection.Key>&project=<opaque projectId>&installation=<installationId>`

Os três parâmetros resolvem uma instalação conhecida no servidor selecionado. Não são credenciais ou grants. Links internos sempre os conservam; o servidor confirma o vínculo project/installation e retorna o directory autorizado. Não aceitar path arbitrário de filesystem na URL. Links sem contexto abrem o seletor do shell; escolher explicitamente só então resolve dados. Contexto incompatível mostra uma decisão legível; não consulta o servidor ativo por conveniência.

Após resolução, conservar em URL somente filtros não sensíveis: ano, período, versão, status, sort, cursor/seleção opaca e tab. Texto livre de busca potencialmente sensível permanece em memória por padrão; URL compartilhável é uma ação explícita com revisão. Notas, salários, conteúdo de documentos, prompts e rascunhos nunca vão para query.

Chave de estado local: servidor + projeto + instalação + principal + capítulo + vista + período/versão. Guardar scroll/linha selecionada e filtros; preferências duráveis usam o serviço existente de personal views. Não guardar dados privados em localStorage, nem restaurar rascunho entre principais. Troca de contexto cancela requests e limpa projeções antes de montar o próximo proprietário.

Planner mantém ano/versão e recorte budget/actual/forecast. Operações mantém mês/ano; Segurança mantém sua referência; Dashboard Executive mantém seu próprio ano. Um seletor não sobrescreve o outro. Anos válidos atuais 2024–2027 não são ampliados por redesign.

## 5. Material, escala e densidade

Aplicar `MxPage`, kit e tokens existentes. Fonte **Inter** do repositório. Título 30/600; seções 20/600; leitura 14; linhas de trabalho 13; metadados 12, sem texto operacional essencial a 10px. Valores usam algarismos tabulares; monospace só para código/IDs técnicos. Texto de célula nunca depende de cor para seu significado.

O shell continua com sidebar de 230px, linhas de navegação de 31px, inset de 12px e gutters de 6px. Uma extensão local dos chapters SF permite canvas amplo para grid/comparação: padding horizontal 32px em desktop, 24px em tablet, 16px em mobile. A coluna de leitura continua próxima da largura atual de 1020px; superfícies de trabalho podem ocupar a largura restante até aproximadamente 1440px. É uma variante local proposta, não alteração silenciosa do kit de todos os chapters.

| Elemento | Composição proposta |
| --- | --- |
| Cabeçalho | Eyebrow de perfil/área, título, frase curta; ação à direita; contexto abaixo, sem repetir breadcrumb sobre o próprio chapter |
| Resumo executivo | Até quatro medidas essenciais em uma faixa, com unidade/variação e cobertura; sem grade de dezenas de cards |
| Fila | Uma superfície elevada, toolbar, cabeçalho de colunas, linhas 44px padrão / 36px compactas e paginação |
| Lista + detalhe | Lista 320–380px, separador único, painel restante com padding 24–32px; coluna ampla para leitura |
| Grid mensal | Cabeçalhos e rótulos fixos dentro da área rolável; números alinhados; mês ativo claramente marcado |
| Contexto lateral | 320–360px quando há espaço; abre sob demanda, sem reduzir a matriz principal abaixo do limite legível |
| Cards | Agrupar uma ideia/decisão por superfície; raios e sombras existentes; evitar superfícies aninhadas |
| Cor | `--orchestra-text/body/muted/accent/warm/success/danger`, `--mx-raised/soft/line/primary`; sem paleta paralela SF |
| Movimento | Transições existentes de 120/180ms; sem animação que mova linhas sob interação; reduced-motion respeitado |
| Gráficos | Cores semânticas do tema, rótulos diretos, tabela equivalente; ausência explícita, sem gráfico decorativo |

As pranchas mostram Light e Dark para direção visual. Implementação deverá preservar Dark, Light, Graphite, Gruvbox, GitHub, Nord e AMOLED; legibilidade não pode depender de um fundo branco específico. Saída gerada de paleta nunca é editada manualmente.

## 6. Composições das quinze áreas

### Hoje

Cabeçalho curto: “Hoje” e contexto atual. Bloco dominante **Precisa de você**, derivado de Meu trabalho: aprovação, pergunta decisiva, confirmação material e ação atribuída. Cada linha mostra objeto, motivo, prazo apenas se real e próximo passo. Ordenação inicial: vencidos comprovados, vencimento próximo, restante por data; sem score de urgência inventado.

Coluna secundária: próxima pauta preservada/autorizada, análises em andamento e “Retomar” com referências válidas. Um bloco “Mudou desde sua revisão” aparece apenas com sinais materiais verificáveis. Estado sem pendência oferece Dashboard/Meu trabalho, sem KPI zero que finja cobertura completa. Não exibir caixa de chat como elemento dominante.

### Dashboard

Tabs Visão executiva, Orçamento, OPEX, CAPEX, Hot Topics. Primeira dobra: período/cobertura e até quatro medidas; depois trajetória financeira e tabela de fatores do desvio. Faixa inferior: riscos/compromissos e agenda de marcos. Card/linha abre a fonte exata, conservando contexto.

Manutenção de dados fica no objeto ou na vista correspondente, sem uma parede de formulários abertos no Dashboard. Hot Topics é lista de ações operacionais canônicas com responsável, prazo, status, notas, histórico e vínculo à origem. Meu trabalho e reuniões apontam para a mesma ação.

### Planner

Header compacto com ano, versão, estado Oficial/Bloqueada/Hipótese e moeda. Tabs Overview, OPEX, CAPEX, Headcount, Entidades e alocações, FX, Versões. Overview explica Budget, Actual fechado, Forecast aberto e Outlook do mesmo contrato.

OPEX/CAPEX usam grid mensal. Congelar descrição/total sem ocupar a largura inteira; período fechado e células herdadas são distinguíveis por texto/ícone/estilo. Modo ler separado de editar. Editar cria rascunho local; uma barra dentro da superfície informa alterações e oferece descartar/revisar/salvar conforme comando. Spread/reset exigem prévia de escopo. Branco não vira zero.

Comparação de versões usa página ampla com componentes do delta, cobertura e diferenças por linha. HR expõe FTE/custo somente conforme papel, sem salários em tooltips, totais ou buscas não autorizados. “Sincronizar roster” explicita origem e impacto. FX ausente bloqueia a conclusão correspondente, não assume paridade.

### Procurement

Visão geral mostra volume por etapa, pendências e aging comprovado. Pedidos usa lista/tabela com número/título, etapa, responsável atual, valor/moeda, última alteração, próximo passo. Filtros de papel, status, período e responsabilidade se mantêm ao retornar.

Detalhe tem cabeçalho do pedido e progressão **Solicitação → Sourcing → PO → Emissão interna** refletindo o estado do domínio. Formulário progressivo por seção reduz carga, mas todos os campos/controles originais continuam disponíveis. Dados reaproveitados mostram fonte; ajustes negociados não são sobrescritos.

Minhas aprovações apresenta um resumo por PR/sourcing/PO: valor, diferença em relação à referência, moeda/FX, versão congelada, holder e pendências. Revisar aprovação abre a decisão completa. Aprovar não salva silenciosamente uma edição não submetida. M31/MI07 permanece bloqueio de produtor, conforme handoffs.

Fornecedores: ficha com Geral, Contatos, Comercial, Compliance, Banco, Pedidos e Auditoria em seções/tabs; dados bancários mascarados conforme regra. Ativar/bloquear/inativar/excluir ficam explícitos por estado. Contratos reaproveita os registros e ACL de Dashboard, com entrada contextual em Decisões e vínculo ao pedido sem lançamento financeiro automático.

### Portfólio

Tabs Visão geral, Projetos, Cenários, Sensibilidade. Visão geral explica saúde, compromissos e marcos; Projetos é manutenção da mesma coleção, sem duplicação. Detalhes comportam responsável, datas, budget/outlook, riscos, marcos e fonte.

Cenários de portfólio é um espaço amplo: universo/candidatos, restrições/compromissos e matriz de combinações. Cada resultado declara viável, condicionado, incompleto ou inviável; cobertura incompleta não ganha selo de recomendação. Sensibilidade expõe variável, unidade, base e limite; não cria probabilidade. Escolher encaminha ao caso de Decisões; aplicação continua nos produtores existentes. P03 é pré-condição de aceite desta jornada.

### Decisões

Lista de casos por estado, contexto e responsabilidade. Detalhe com Resumo, Alternativas, Premissas, Perguntas, Mudanças e Histórico. A comparação dispõe alternativas em colunas limitadas (duas ou três visíveis) e critérios em linhas; mais alternativas têm seleção explícita, não colunas infinitas.

Faixa de consequência: composição financeira, prazo, cobertura e condições. Proveniência abre fonte autorizada; diferenças de premissa são legíveis. A pessoa registra alternativa, critérios e justificativa. Depois, a página Mudanças mostra efeitos por domínio e a revisão necessária antes de aplicar.

IA auxilia a formular intenção, encontrar contradições, propor perguntas e criticar alternativas. Entrada de análise é contextual, com contexto editável e modelo/sessão reais quando admitidos. Exibir execução, espera por informação, cancelamento, falha, resultado parcial e resultado stale. Uma resposta não aprova nem aplica. Recibos e retomada parcial continuam visíveis após perda de resposta.

### Meu trabalho

Fila unificada derivada de fontes canônicas. Vistas Para mim, Perguntas, Confirmações, Aprovações e Ações; não converter tudo em um board de tarefas paralelo. Cada item declara fonte, escopo, período, versão relevante, responsável e próxima ação. Comentários e esclarecimentos não se confundem com aprovação. “Revisei e nada mudou” confirma o recorte material, não a versão global inteira.

### Reuniões

Tabs Pauta, Revisões, Relatórios. Pauta permite selecionar e ordenar conteúdo autorizado com período por seção; seleção ampla mostra cobertura e pendências. Preservar gera revisão identificável; leitura ao vivo e revisão preservada têm rótulos distintos.

Modo reunião ocupa a superfície principal, mantém o shell e reduz ferramentas de edição; navegação entre seções usa lista de conteúdo recolhível/controle de sequência, não uma segunda sidebar de módulos. Comparar revisões exige compatibilidade. Relatórios exportam conteúdo completo em PPTX/DOCX com páginas/continuações, notas longas e todos os registros. Download revalida acesso. Falha temporária conserva rascunho; revogação real bloqueia conteúdo.

### Pessoas

Overview de headcount e capacidade; Estrutura organiza líderes/equipe; Talent Review expõe classificação/outlook e ações conforme autorização original. Detalhe de pessoa preserva campos atuais, histórico, importações e vínculos. Não confundir visão de equipe com planejamento salarial do Planner. A ausência de permissão elimina informação do DTO, não apenas da tela.

### Operações

Tabs Serviço, Segurança, Riscos, Relacionamento e Performance. Serviço usa mês e tickets/heatmap, com configuração de categorias e importação mensal em fluxos explícitos. Segurança conserva KPIs, ações e referência própria. Riscos usa lista por impacto/resposta; stakeholder e performance contract conservam responsáveis, objetivos, status e edição contextual. Dados inexistentes não viram séries temporais fabricadas.

### Análises

Catálogo de perguntas de negócio, com entrada contextual nas telas de origem. Cada visual mostra período, unidades, cobertura e “Ver dados”. Gráficos BI01–BI11 seguem o produtor: trajetória, waterfall, contribuições, FTE/custo, estoque, aging, tickets, marcos, composição, consequências e sensibilidade. Seleção/drilldown via referência autorizada. Não incluir um construtor arbitrário de consultas ou um motor financeiro no browser.

### Documentos

Lista com tipo, versão, disponibilidade e vínculo de negócio. Detalhe separa fonte do documento, extração candidata e fatos confirmados. Comparar trecho e campo proposto lado a lado; confirmação por pessoa com escopo. Texto ausente, parser ocupado, scanner indisponível, documento substituído e acesso perdido são estados diferentes. A mesma evidenceRef alimenta cenário e dossiê. Conteúdo do documento nunca vira instrução privilegiada.

### Importações

Fluxo em quatro etapas: Arquivo e destino → Prévia → Revisão do impacto → Recibo. Mostrar formato/aba/versão de destino, itens adicionados/alterados/removidos/ignorados, avisos e total reconciliado. Revisão oferece abrir detalhes; aplicar só na base atual. Mudança concorrente conserva seleção e pede nova prévia. Cancelar não altera o domínio. Histórico lista manifests/receipts reais, sem tratar upload como aplicação.

### Memória

Vistas Sinais, Casos semelhantes e Previsto × observado. Materialidade, recorte/cutoff, base e fonte acompanham o resultado. Distinguir sinal irrelevante, material, duplicado, stale e indisponível. Comparar resultados não declara causalidade. Atlas é infraestrutura reaproveitada; a área de negócio não expõe configuração técnica ou memórias de outros usuários.

### Rotinas

Catálogo orientado à tarefa: preparar revisão, revisar forecast, preparar sourcing, consolidar encaminhamentos, analisar/reavaliar decisão. Ficha de rotina mostra entrada, cobertura, receita/versão e condição de disponibilidade. Histórico mostra run, estado, resultado e retomada.

Recorrência usa Schedule nativo existente, com timezone, pausa e ocorrências; apenas disponível após admissão real. Sem serviço qualificado, informar indisponibilidade com motivo legível. O scheduler não é recriado no chapter. Resultado propõe ações e pede confirmação humana para efeitos admitidos.

## 7. Estados e microcopy

| Estado | Tratamento | Exemplo pt-BR proposto |
| --- | --- | --- |
| Carregando | Skeleton da área específica; preservar dimensões e contexto | “Carregando pedidos desta instalação…” |
| Vazio real | Dizer o recorte e oferecer ação autorizada | “Nenhum pedido neste período.” |
| Filtro sem resultado | Manter filtros visíveis e limpar explicitamente | “Nenhum resultado com estes filtros.” |
| Parcial | Cobertura e parte ausente; valores conhecidos mantidos | “2 fontes indisponíveis. O total está incompleto.” |
| Validação | Mensagem junto ao campo e resumo navegável | “Informe a moeda antes de comparar.” |
| Conflito/stale | Comparação base/atual/rascunho; sem sobrescrever | “O pedido mudou. Revise a versão atual antes de continuar.” |
| Falha temporária | Retry de leitura; preservar draft e identidade pendente | “Não foi possível confirmar o resultado. Consultar recibo.” |
| Acesso revogado | Remover conteúdo restrito, interromper calls e explicar | “Seu acesso a este conteúdo mudou.” |
| Sessão expirada | Login Microsoft; sem repetir mutação automaticamente | “Entre novamente para retomar a revisão.” |
| Serviço não admitido | Estado indisponível, sem CTA que finge execução | “Esta rotina ainda não está disponível nesta instalação.” |

Exemplos de texto são decisões de produto propostas; entram em i18n, não literais em JSX. Erros técnicos têm reason code para diagnóstico protegido, sem stack, segredo, email de outro ator ou identificador restrito na mensagem.

## 8. Responsividade e acessibilidade

- **1440px e acima:** lista/detalhe simultâneos quando úteis; grid amplo; contexto lateral somente se há espaço.
- **768–1023px:** sidebar pelo comportamento adaptativo do shell; lista ou detalhe conforme largura útil; toolbar quebra em linhas; cabeçalhos e totais continuam legíveis.
- **320–767px:** uma superfície de tarefa por vez; navegação global em drawer do mesmo shell, retorno visível; tabelas simples podem ter linhas resumidas sem perder campos no detalhe. Grid mensal oferece editor por linha/mês e rolagem localizada; não comprimir 12 meses em números ilegíveis.
- **Zoom 200%:** reflow preserva tarefa, foco e ação; comparação pode virar seleção de duas alternativas e seções sequenciais.
- Tabelas de leitura usam table/headers/caption; grids interativos implementam APG. Tab entra/sai do grid; setas navegam; Enter/F2 editam; Esc cancela a edição da célula; salvar global nunca ocorre por navegação.
- Labels explícitos em formulário, tooltip acessível em ícones; alvos mínimos e espaçamento WCAG 2.2; meta 44px para toque.
- Foco retorna à linha acionadora ao fechar detalhe/modal, com fallback ao cabeçalho se removida; erro de envio foca resumo; seleção não muda foco arbitrariamente.
- Headers/rodapés sticky não encobrem foco. Texto ≥4, 5:1, ícones/controles ≥3:1 conforme referência real, verificados nos temas.
- Status anunciado com aria-live com parcimônia; não ler toda a lista a cada polling. Não usar cor como único sinal; gráficos têm tabela e descrição.
- Paginação e virtualização, se necessária por volume medido, preservam anúncio de total autorizado e posição lógica. Não virtualizar prematuramente todas as listas.

## 9. Jornadas de referência

**Compras:** Hoje → Revisar aprovação → pedido/etapa/versão/valor → fontes → decidir → confirmação do resultado → voltar ao mesmo filtro. Edição não salva nunca é substituto do valor congelado para aprovação.

**Forecast:** Dashboard/desvio → Planner/versão → explicar composição → editar hipótese → revisar delta → salvar → comparar → criar/abrir caso de decisão. Actual e oficial não mudam por efeito de navegação.

**Contrato até decisão:** Contratos → abrir caso contextual → confirmar intenção/premissas/documentos → comparar alternativas → responder pergunta → registrar escolha → revisar mudanças por domínio → aplicar cada efeito admitido → consultar recibos → acompanhar reavaliação.

**Reunião:** pauta autorizada → escolher ordem/competência → preservar → apresentar → registrar pergunta/encaminhamento → exportar completo → comparar revisão seguinte. Conteúdo preservado e comentários posteriores são explicitamente separados.

## 10. Limites do desenho e decisão de revisão

O plano define composição completa, mas não declara aprovação estética final nem comprovação de usabilidade. A revisão deve confirmar os quinze destinos, ordem/prioridade, distinção Hoje/Dashboard/Meu trabalho, redistribuição de Pessoas/Operações/Contratos e a direção das pranchas.

A primeira implementação autorizada deve comprovar que esses padrões funcionam com dados e autorização reais. Refinamentos de espaçamento, colunas e microcopy são esperados após esse piloto; alterações de domínio, escopo ou gates precisam seguir o planejamento existente.
