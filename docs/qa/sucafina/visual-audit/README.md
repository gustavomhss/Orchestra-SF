> **Verificação após as correções:** consulte [VERIFICATION.md](VERIFICATION.md) e [verification-runs.json](verification-runs.json) para os testes, capturas e limites da entrega do PR #710. O conteúdo abaixo é a auditoria histórica anterior às correções e permanece preservado.

# Auditoria de escopo completo — cobertura visual e lacunas — Orchestra-SF

**Data:** 22 de novembro de 2026.  
**Base auditada:** `dev@346af44f4aac7bf1eb9821d4c5482bacf233a706`.  
**Branch do relatório:** `sf-visual-audit`.  
**Objeto:** acabamento visual de todas as áreas, telas compartilhadas, perfil Teams, editores, revisões, diálogos e estados.

## Conclusão

As capturas confirmam inconsistência de acabamento entre áreas e estados. Há telas com uma composição bem definida ao lado de formulários e estados apresentados como texto cru. Os problemas recorrentes são: ações dispersas, eixos de alinhamento inconsistentes, comparação difícil entre versões, tabelas comprimidas, valores técnicos tratados como conteúdo principal e mensagens sem agrupamento ou hierarquia.

A existência de tokens, cartões, temas e reflow é real e deve ser aproveitada. A correção precisa aplicar esse padrão de maneira consistente, incluindo carregamento, vazio, erro, recusa de acesso, edição e confirmação. Marcas anteriores como MERGED, ACCEPTED_FOR_INTEGRATION ou PASS não encerram a revisão visual solicitada agora.

**Este documento registra a inspeção e a especificação das correções. Não implementa mudanças de produto e não constitui aprovação visual de todas as jornadas.** O escopo foi inventariado integralmente; a matriz distingue evidência visual disponível, código inspecionado e ausência de captura.

## Base, fontes e método

O inventário canônico e o registro de rotas coincidem em **70 áreas Sucafina e 165 padrões de rota**. Foram incluídas também **25 superfícies lógicas compartilhadas**, **5 camadas do perfil Teams** e um catálogo de **38 arquivos de componentes de diálogo**. São contagens de naturezas diferentes e com sobreposição; não devem ser somadas como páginas independentes.

Fontes principais:

- [Inventário canônico](https://github.com/gustavomhss/Orchestra-SF/blob/346af44f4aac7bf1eb9821d4c5482bacf233a706/docs/qa/sucafina/design/inventory.json).
- [Registro de rotas](https://github.com/gustavomhss/Orchestra-SF/blob/346af44f4aac7bf1eb9821d4c5482bacf233a706/packages/app-shell/src/orchestra/chapters/sucafina/route-registry.ts).
- Galerias persistidas das waves one a four: **396 JPEGs**, cobrindo as primeiras **41 áreas**.
- Capturas originais e quadros dos vídeos recuperados de onboarding, inclusive navegação, carregamento, indisponibilidade e interfaces compartilhadas.
- Galeria candidata da PR #613, em `sf-design-next@0a1247db9a16f9eead04788a76d25723672c7e6a`, examinada separadamente. As **15 áreas UI42–UI56** dessa proposta não foram tratadas como integradas na base.
- Código da base auditada de componentes, estilos e estados, usado para verificar a persistência estrutural de achados específicos.

A inspeção usou folhas de contato para triagem e originais para confirmar problemas. Os registros anexos informam o nível real de inspeção por imagem. Nos JPEGs recuperados do Git, o SHA de blob retornado foi conferido contra o inventário; isso comprova a identidade do arquivo, não que a captura foi produzida no commit-base. Os manifestos preservam `sourceProduct` e `sourceRun`.

Capturas de dados sintéticos demonstram composição e legibilidade nos estados mostrados. Não comprovam autenticação real, integração em produção ou disponibilidade de todas as operações. Dados livres de fixture em outro idioma não foram classificados automaticamente como falha de tradução.

### Limites importantes da conclusão

Não foi executado um novo render do produto. Contraste numérico, foco, restauração de foco, zoom a 200%, teclado, comportamento de rolagem e transições completas não foram aprovados por imagem estática. Recorte de uma tabela prova o que está visível; não prova que a rolagem está quebrada.

A aparência do host local com HuGR, projeto e Git não comprova a aparência do novo perfil Teams. Da mesma forma, um frame de “acesso não admitido” permite avaliar a apresentação da recusa, mas não a página admitida que existiria atrás dela.

## Cobertura efetiva da inspeção

| Material | Arquivos visualizados | Originais detalhados | O que isso cobre |
|---|---:|---:|---|
| Galeria persistida na base dev | 366 de 396 JPEGs | 94 | 41 áreas; triagem de todas as famílias e estados selecionados. |
| Candidata da PR #613 | 30 selecionados | 18 | 14 das 15 áreas candidatas; fonte separada da dev. |
| Material recuperado do onboarding | 98 prints/quadros distintos por caminho | 98 | Capturas originais, frames de vídeo e edição; estados locais/shared. |

As 30 imagens de dev não selecionadas são variações semanticamente repetidas de tema/idioma na galeria Planner/Procurement. Isso não equivale a uma auditoria integral de tradução.

A galeria canônica contém pixels de **55 das 70 áreas: 41 de dev e 14 candidatas**. **UI43 não tem imagem de resultado alcançado; UI57–70 não têm JPEG na galeria canônica examinada.** O vídeo cobre alguns estados dessas últimas, descritos na matriz. As 477 capturas históricas da candidata foram inventariadas; somente as 30 selecionadas foram visualmente revisadas.

### Candidata: achados e limites específicos

As capturas da candidata também mostram IDs/caminhos e valores de implementação como conteúdo principal: critérios por UUID, operador lte, campo opexOwners[id:…].budget, autor macos:…, referência de confirmação e diff /versions/@id=…/lines/@id=…/f/0. Esses pontos alimentam AV-05/09.

Há pontos adicionais de apresentação: valores muito pequenos e períodos repetidos dificultam a leitura de um gráfico de BI; a comparação móvel repete procedência extensa; fonte desatualizada recebe pouco destaque; entradas de relatório/proposta indisponível oferecem pouca orientação. Estão registrados em CAN-02 a CAN-05.

**CAN-01 é limite de jornada, não um defeito puramente estético:** na última tentativa preservada, UI42 termina em Running/prévia indisponível; UI44 em conexão perdida, revisão preservada e confirmação inativa; UI43 não foi alcançada. Isso não demonstra incidente em produção agora e não deve ser mascarado por um redesign.

### Áreas sem captura canônica

A leitura de UI57–70 encontrou frame, estado e estilos de formulário diretos ou delegados em todas as 14 áreas. Portanto, a ausência de galeria não sustenta a afirmação de que essas páginas não têm estilo. Os problemas visuais históricos de contexto, documentos e recusa de rota permanecem evidência dos estados filmados; o render da base precisa ser conferido.

O código da base também apresenta três pontos para verificar em nova captura: labels literais currency/knownSubtotal/total em UI60, lista técnica de contexto em UI67 e identificadores de páginas nos checkboxes de UI69. São achados de código e hipóteses de apresentação, separados dos pixels observados.


## Frentes de correção

As prioridades abaixo são **prioridades de acabamento e usabilidade**, não classificações de incidente, segurança ou disponibilidade. Achados repetidos entre vídeo e galeria foram agrupados. Os registros individuais mantêm seus IDs para rastreabilidade.

### AV-01 — Composição de página e estados sem acabamento — P1

**Evidência:** Context and access, Documents, Import/Exports e estados de Signals/Routines no vídeo mostram controles ou mensagens fora do contêiner principal. Em contexto, Server/Project/Installation/Identity ficam em linhas pouco diferenciadas. Em rotas recusadas, a mensagem “Sucafina route not admitted” aparece como texto solto.

**Correção:** usar o mesmo frame de página nos estados de carregamento, pronto, vazio, erro e recusa. Título, contexto, corpo e ações devem compartilhar eixo. Conta e instalação precisam de resumo humano; referência técnica permanece disponível em detalhes. O estado deve explicar a situação e oferecer somente a recuperação autorizada.

**Critério de aceite:** a mudança de estado não desloca título/contêiner; mensagens mantêm hierarquia e largura legível; controles de acesso ficam em localização estável. A recusa continua efetiva.

**Rastreabilidade:** SH-01, NV-01/02, BUS-05/06/07. O código da base auditada de UI67 ainda contém uma lista de definição sem classes específicas; a posição antiga dos botões exige nova captura antes de afirmar persistência exata.

### AV-02 — Cabeçalhos, retornos e ações dispersas — P1

**Evidência:** Case summary, Alternatives, Assumptions e Questions distribuem ações por três faixas: principal no topo, Refresh/Edit abaixo e Back em outra linha. Algumas páginas estendem Back à largura total. Editores e detalhes acrescentam outro retorno em eixo diferente.

**Correção:** definir um cabeçalho responsivo comum, com identidade da página/registro, retorno, contexto e ações. O formulário deve ter ações próprias claramente vinculadas ao que está sendo editado. Evitar que ações de página concorram visualmente com confirmar/cancelar.

**Critério de aceite:** principal, secundárias e retorno distinguíveis sem depender só da cor; ordem estável entre desktop e estreito; nenhum título genérico supera o nome do registro no detalhe.

**Exemplo:** [editor do caso](https://github.com/gustavomhss/Orchestra-SF/blob/346af44f4aac7bf1eb9821d4c5482bacf233a706/docs/qa/sucafina/design/wave-four/evidence/decisions/UI34-dark-desktop-editor-test-data.jpg).  
**Rastreabilidade:** WD-01, NV-05, PP-15.

### AV-03 — Comparação de alterações e revisões — P1

**Evidência:** Original e Current source aparecem na primeira linha; Proposed values fica sozinho abaixo. Mesmo uma mudança pequena repete fichas extensas. Nas revisões citadas, a diferença efetiva não recebe destaque suficiente. Projetos possui destaque de alterações em sua revisão e serve como referência interna. O problema reaparece em Visões salvas, Hot topics, Planner, requisições, sourcing e aprovações.

**Causa confirmada no código:** `SfChangeReview` renderiza três snapshots. A grade usa `repeat(auto-fit, minmax(min(100%, 17rem), 1fr))`; no espaço oferecido por vários editores, cabem duas colunas e o terceiro cartão quebra de linha.

**Correção:** comparar por campo, preservando base, fonte atual e proposta; alternativamente, três painéis alinhados quando a largura permitir. Destacar valores alterados e conflitos. Em tela estreita, agrupar as versões do mesmo campo para reduzir a distância de leitura. Manter integralmente a informação de concorrência e proveniência.

**Critério de aceite:** uma alteração simples pode ser identificada sem reler três fichas inteiras; a comparação não cai num arranjo 2+1 acidental; operação e objeto aparecem junto da confirmação.

**Exemplo:** [revisão de visão salva](https://github.com/gustavomhss/Orchestra-SF/blob/346af44f4aac7bf1eb9821d4c5482bacf233a706/docs/qa/sucafina/design/wave-four/evidence/work/UI32-dark-desktop-existing-view-review.jpg).  
**Código:** [componente](https://github.com/gustavomhss/Orchestra-SF/blob/346af44f4aac7bf1eb9821d4c5482bacf233a706/packages/app-shell/src/orchestra/chapters/sucafina/shared/change-review/index.tsx), [estilos](https://github.com/gustavomhss/Orchestra-SF/blob/346af44f4aac7bf1eb9821d4c5482bacf233a706/packages/app-shell/src/orchestra/chapters/sucafina/shared/change-review/s03.css).  
**Rastreabilidade:** WD-03, PP-02, BUS-02, FF-05. Essas revisões são painéis inline; o tratamento de diálogos sobrepostos é registrado em AV-12.

### AV-04 — Legibilidade de tabelas e planejamento mensal — P1

**Evidência:** a comparação de cotações quebra “Unavailable” no meio da palavra. A última coluna fica fora do quadro. No estreito, aparecem apenas as primeiras colunas. Grades mensais repetem métricas e ações em cada célula; a comparação anual exige muita navegação.

**Correção:** larguras mínimas por tipo de conteúdo; números e unidades com apresentação consistente; quebra por palavra em textos comuns; rolagem horizontal perceptível quando necessária, com identidade de linha preservada. Para meses, distinguir leitura e edição, reduzir repetição e manter a navegação por teclado existente.

**Critério de aceite:** palavras de estado e valores financeiros permanecem legíveis; é possível descobrir e alcançar colunas adicionais; os controles não dominam os números. Não converter valores ausentes em zero nem inventar moeda.

**Exemplo:** [comparação de cotações](https://github.com/gustavomhss/Orchestra-SF/blob/346af44f4aac7bf1eb9821d4c5482bacf233a706/docs/qa/sucafina/design/wave-four/evidence/procurement/CAP25-light-desktop-recorded-quote-comparison-test-data.jpg).  
**Rastreabilidade:** PP-01/11/12, BUS-01/16/17, FF-08, PO-06, CAN-03. A rolagem precisa de verificação funcional posterior; sua falha não foi inferida.

### AV-05 — Nomes, estados e referências técnicas — P1

**Evidência:** GUIDs aparecem como líder, responsável, projeto, distribuição e cotação escolhida. Status como `src_pending`, `progress`, `mitigating`, `on` e `ahead` são mostrados no fluxo. Divergências exibem sequências como `coverage:service_overlap:...`. A candidata também apresenta caminhos e referências no lugar do resumo humano.

**Correção:** usar nomes disponíveis na fonte autorizada; localizar enums conhecidos; indicar honestamente quando o nome não foi informado. Agrupar condições por categoria com resumo de negócio. IDs completos e payloads ficam em detalhes copiáveis, sem perder auditabilidade. Nomes, descrições e outros dados livres não devem ser traduzidos indiscriminadamente.

**Critério de aceite:** o usuário reconhece objeto, estado, motivo e próxima ação sem decodificar UUID ou nome de contrato; detalhes técnicos continuam acessíveis.

**Exemplo:** [Premissas e divergências](https://github.com/gustavomhss/Orchestra-SF/blob/346af44f4aac7bf1eb9821d4c5482bacf233a706/docs/qa/sucafina/design/wave-four/evidence/decisions/UI36-dark-desktop-test-data.jpg).  
**Rastreabilidade:** WD-02/07, PP-03/08, FF-01/03/07, PO-01/02, SH-03, CAN-02. Persistência de render direto foi confirmada em componentes de Today, decisões e revisões.

### AV-06 — Confirmações e consequências de ações — P1

**Evidência:** confirmações alternam “Confirm once”, “Confirm action”, “Save” e verbos específicos. Exclusão de contrato usa confirmação genérica; a revisão de exclusão de risco diz que o registro já está indisponível antes de confirmar. Remoção de visão salva repete os valores existentes como proposta.

**Correção:** verbo e objeto no botão e no título; estado futuro correto (“será removido”); consequência visualmente identificável. Usar o padrão nativo de ações destrutivas de forma consistente, sem acrescentar confirmações redundantes ou remover as já necessárias.

**Critério de aceite:** o usuário sabe exatamente o que será criado, alterado, rejeitado ou removido; estado anterior à confirmação não parece resultado já aplicado.

**Exemplo:** [remoção de visão salva](https://github.com/gustavomhss/Orchestra-SF/blob/346af44f4aac7bf1eb9821d4c5482bacf233a706/docs/qa/sucafina/design/wave-four/evidence/work/UI32-light-desktop-removal-review.jpg).  
**Rastreabilidade:** WD-04, PP-07, FF-04, PO-03/04. A cor azul sozinha não define o defeito; a inconsistência de tratamento e a representação do efeito sustentam o achado.

### AV-07 — Indisponibilidade, vazio e pré-requisitos — P1

**Evidência:** Sync roster indisponível abre três cartões vazios e repete o bloqueio. Analysis mostra aviso de modelo ausente, selects sem opções e botão inativo. Exports tem ação desabilitada sem requisito visível no quadro. Agenda combina indisponibilidade com skeleton. Workflows sem Git conserva convite para criar apesar das ações bloqueadas.

**Correção:** um estado principal por condição, sem comparadores vazios nem mensagens duplicadas. Explicação próxima da ação bloqueada e recuperação adequada ao ambiente. Distinguir sem dados, ainda não consultado, carregando, sem acesso, pré-requisito ausente, conflito e resultado desconhecido.

**Critério de aceite:** motivo legível e contextual; nenhum skeleton permanente junto de erro conclusivo; nenhum convite executável quando a operação está indisponível. Permissões e regras de admissão permanecem intactas.

**Rastreabilidade:** PP-04, WD-06, BUS-09/14, SH-09/11/12, CAN-04/05. No Git/Checking/provider ausente são condições do host; uma captura não demonstra travamento.

### AV-08 — Formulários e contexto de leitura — P2

**Evidência:** Analytics do vídeo apresenta campos pouco diferenciados; descrições longas usam input de uma linha; alguns filtros se misturam a avisos de importação. O contexto de Choice diz “Choose an existing case” sobre um valor somente leitura. Formulário centralizado, aviso largo e histórico largo criam eixos distintos.

**Correção:** mesmo padrão de campo, rótulo, ajuda e validação; textarea quando o conteúdo é longo; agrupar filtros separadamente de mensagens. Rotular contexto como “Caso atual” quando não houver seletor. A largura de leitura pode variar, desde que a relação com cabeçalho e estados seja intencional e coerente.

**Critério de aceite:** distinguir leitura, edição e indisponibilidade; labels não sugerem controles inexistentes; conteúdo longo pode ser revisado integralmente.

**Rastreabilidade:** NV-03, WD-05/06, PP-06/16, BUS-08/13, FF-03.

### AV-09 — Densidade de metadados, ausência de moeda e proveniência — P2

**Evidência:** “Source currency not specified” se repete em cada célula de comparações; Purchase order aparece em títulos consecutivos; estado, versão e valores reaparecem em parágrafos soltos. Configurações mostram limite em bytes e modos internos sem tradução.

**Correção:** organizar metadados em grupos; explicar ausência de moeda no contexto apropriado mantendo a identificação por célula quando necessária; distinguir resumo, aviso e referência técnica. Apresentar limites em unidades compreensíveis, mantendo o valor exato disponível.

**Critério de aceite:** os avisos relevantes permanecem visíveis sem ocupar a maior parte da comparação; título não se repete sem função; dados técnicos têm hierarquia secundária.

**Rastreabilidade:** PP-05/09/14, NV-06, BUS-04/12, CAN-02/03.

### AV-10 — Tipografia, espaçamento e tamanho de conteúdo — P2

**Evidência:** na grade mensal móvel, moeda aparece colada a nome/valor. O editor de System prompt ocupa mais de 400px mesmo para uma linha curta, com texto pequeno no topo. Caminhos, descrições longas e metadados disputam a mesma hierarquia.

**Correção:** aplicar consistentemente a escala tipográfica e tokens existentes do Orchestra: título de página, seção, campo, corpo e texto auxiliar com papéis claros. Usar escala comum de espaçamento e separar número/unidade explicitamente. Ajustar editor ao conteúdo com limites úteis e expansão disponível.

**Critério de aceite:** nenhum token colado por ausência de gap; labels/valores consistentes entre módulos; espaçamento entre seções maior que dentro de um grupo; áreas vazias não resultam de altura mínima arbitrária.

**Código confirmado:** System prompt usa min-block-size de 420px; grade mensal renderiza quantidade e unidade em spans adjacentes.  
**Rastreabilidade:** FF-02/06, SH-06, BUS-11.

### AV-11 — Navegação, localização e identidade do registro — P2

**Evidência:** breadcrumbs mantêm Today em Search, Overview em partes do Planner, Requests em fornecedores/configurações e Import file em Exports. Lista extensa de Extensions e rótulos genéricos dificultam encontrar módulos. Settings de compras espalha sete links por várias linhas.

**Correção:** trilha com capítulo e página atual; rótulos estáveis; agrupamento de navegação por tarefa/domínio; tabs com seleção clara. Detalhes usam nome do registro como identidade principal. Manter disponibilidade condicionada ao perfil.

**Critério de aceite:** breadcrumb, título e seleção lateral concordam sobre onde o usuário está; navegação continua alcançável em telas estreitas.

**Rastreabilidade:** WD-08, SH-02, PP-10/13, BUS-10, NV-05. A captura não prova que um item escondido pela rolagem seja inacessível.

### AV-12 — Diálogos e interfaces compartilhadas de IA — P2

**Evidência:** o diálogo de leitura de Skill usa caminho absoluto do runner como subtítulo de várias linhas, Markdown cru em textarea e Cancel para leitura. Catálogo de agentes expõe nomes técnicos; Overview dedica grande área a avatares. Tools/Skills têm listas densas. O Chat local mantém um painel vazio de revisão/Git que ocupa espaço numa conversa de negócio.

**Correção:** leitura de Skill com conteúdo formatado e “Fechar”; diagnóstico de caminho em detalhe. Catálogo com nome/função humana preservando ID; personalização de avatar sob demanda; agrupamento e busca onde o volume exigir. No Chat corporativo, verificar composição apropriada ao perfil efetivamente utilizado.

**Critério de aceite:** título, corpo e rodapé dos diálogos alinhados; conteúdo longo rola no corpo sem perder ações; modo leitura não parece edição cancelável. Foco e teclado requerem verificação funcional, não foram aprovados pelas imagens.

**Rastreabilidade:** SH-03/05/06/07/08/10/13. O modal de Skill observado está centralizado; o defeito comprovado é de conteúdo e hierarquia. O painel de Git observado pertence ao host genérico e não pode ser atribuído ao Chat Teams.

## Padrão visual a aplicar em todo o escopo

A base já possui tokens e componentes adequados. O objetivo é consolidar seu uso:

| Elemento | Regra de consistência |
|---|---|
| Frame | Mesmo eixo e largura de conteúdo em loading, pronto, vazio, erro e acesso recusado. |
| Gutter | Reaproveitar os gutters responsivos existentes do frame; evitar offsets próprios em páginas isoladas. |
| Tipografia | Uma escala por função, usando os tokens existentes; ID/monoespaçado apenas como detalhe técnico. |
| Espaçamento | Grupos internos compactos e separação previsível entre seções; sem controles encostados em metadados. |
| Ações | Uma principal por contexto; secundárias agrupadas; retorno estável; confirmar/cancelar vinculados ao formulário. |
| Revisão | Diferença legível por campo e semântica explícita de criação/edição/exclusão; contexto de concorrência preservado. |
| Tabela | Identidade, número, moeda e estado com regras próprias; rolagem perceptível quando necessária. |
| Formulário | Rótulos persistentes, ajuda junto ao campo, affordance de edição e estados consistentes. |
| Estado | Causa, efeito e recuperação; sem conteúdo vazio que pareça uma operação disponível. |
| Diálogo | Largura responsiva, título e ações previsíveis, corpo rolável, distinção entre ler e editar. |
| Proveniência | Resumo legível primeiro, referência completa disponível em detalhe; nenhum dado inventado. |
| Perfil | Identidade e navegação do host correto, incluindo Teams; capturas locais não encerram essa verificação. |

### Ordem de implementação recomendada

1. **Componentes transversais:** frame/estados, cabeçalhos, SfChangeReview, tabela e grade mensal. Corrigem recorrências em vários módulos.
2. **Conteúdo de negócio:** enums, nomes, datas/competência, moedas, ações e consequências; revisão das condições técnicas longas.
3. **Exceções por área:** Documents/Imports/Exports, Analytics, Settings, diálogos e interfaces de agentes/skills.
4. **Perfil Teams e estados sem evidência:** render no host correto, validar entrada/perfil/admin/configuração/chat e as rotas disponíveis.
5. **Verificação visual das correções:** comparar antes/depois em claro/escuro, desktop e larguras estreitas; abrir os estados de edição, revisão, menus/diálogos e erro que não aparecem na tela principal.

Uma correção transversal precisa ser conferida em representantes de cada família e em todas as exceções que sobrescrevem seu estilo. O fechamento é por tela/estado da matriz, não apenas por sucesso de build ou por screenshot da página inicial.

## Teams: incluído e ainda sem aceite visual

Estão no escopo: login e entrada Microsoft, seleção/troca de Team e perfil, administração, configuração compartilhada e Chat nativo. O registro canônico localizado declara `COMPONENT_VERIFIED`, `liveMicrosoftProof=false` e `installedQualification=false`. Nenhuma galeria autenticada dessas superfícies foi localizada no recorte canônico examinado.

A ponte de rotas Teams no código-base contém bindings CAP03/CAP04/CAP05/CAP14. Isso descreve o host observado e **não reduz o escopo de 70 áreas** solicitado para a auditoria.

O achado CAN-06 registra essa separação de hosts. O vídeo com HuGR/local/project/No Git não substitui prova visual do perfil Teams. Para fechar essa parte, é necessária captura do host correto, com identidade do Team, seleção, menus, administração/configuração, conversa vazia/carregada e falhas/revogação. A ausência de captura é uma lacuna de evidência, não prova de que o componente inexiste.

[Registro Teams](https://github.com/gustavomhss/Orchestra-SF/blob/346af44f4aac7bf1eb9821d4c5482bacf233a706/docs/qa/sucafina/teams-native-chat-components.json) · [Entrada de perfil](https://github.com/gustavomhss/Orchestra-SF/blob/346af44f4aac7bf1eb9821d4c5482bacf233a706/packages/app-shell/src/pages/team-profile.tsx).

## O que esta auditoria não marcou como defeito

- Assimetria intencional, coluna de leitura estreita e espaço em branco não foram automaticamente reprovados.
- Reflow para uma coluna em 320px e rolagem de tabelas extensas não foram tratados como falha por si.
- Zero registros, provider desconectado, modelo indisponível e ausência de Git foram diferenciados de falha de render.
- Textos livres de teste e descrições de agentes em outro idioma foram separados dos enums controlados pela aplicação.
- O indicador de disponibilidade de Agents possui title e aria-label no código da base auditada.
- Zoom, lower thirds e retângulos da edição do vídeo foram classificados como montagem. O vídeo já aceito para apresentação permanece fora da correção de produto.

## Como usar os anexos

- [coverage.json](./coverage.json) contém as 70 áreas com todos os 165 padrões de rota, as superfícies compartilhadas, Teams e o catálogo de componentes de diálogo.
- [findings.json](./findings.json) preserva os relatos de inspeção, evidências, nível de visualização, origem e confirmação por código. Há repetição intencional entre relatos de fontes distintas; os achados únicos são agrupados nas 12 frentes acima.
- A matriz abaixo resume a cobertura efetiva. “Galeria vista” significa os estados capturados, não toda a jornada e não novo render no commit-base.


## Matriz das 70 áreas Sucafina

As rotas completas, variantes, componentes e evidências por arquivo estão em [coverage.json](./coverage.json). Estados não capturados permanecem pendentes mesmo nas áreas com galeria.

| Área | Tela/área | Padrões de rota | Imagens vistas | Cobertura e foco |
|---|---|---:|---:|---|
| CAP01 | [Dashboard executivo](https://github.com/gustavomhss/Orchestra-SF/blob/346af44f4aac7bf1eb9821d4c5482bacf233a706/packages/app-shell/src/orchestra/chapters/sucafina/dashboard/executive/index.tsx) | 1 | 9 dev | Galeria histórica de dev. Densidade de ausência de dados; preservar boa estrutura. |
| CAP02 | [Hot topics](https://github.com/gustavomhss/Orchestra-SF/blob/346af44f4aac7bf1eb9821d4c5482bacf233a706/packages/app-shell/src/orchestra/chapters/sucafina/dashboard/hot-topics/index.tsx) | 4 | 16 dev | Galeria histórica de dev. Diferenças em revisão e identidade da ação. |
| CAP03 | [Visão de orçamento](https://github.com/gustavomhss/Orchestra-SF/blob/346af44f4aac7bf1eb9821d4c5482bacf233a706/packages/app-shell/src/orchestra/chapters/sucafina/dashboard/budget/index.tsx) | 1 | 11 dev | Galeria histórica de dev. Competência humana e escopo da revisão. |
| CAP04 | [OPEX — realizado e previsão](https://github.com/gustavomhss/Orchestra-SF/blob/346af44f4aac7bf1eb9821d4c5482bacf233a706/packages/app-shell/src/orchestra/chapters/sucafina/dashboard/opex/index.tsx) | 4 | 15 dev | Galeria histórica de dev. Padrões de formulário, tabela e revisão. |
| CAP05 | [CAPEX — realizado e previsão](https://github.com/gustavomhss/Orchestra-SF/blob/346af44f4aac7bf1eb9821d4c5482bacf233a706/packages/app-shell/src/orchestra/chapters/sucafina/dashboard/capex/index.tsx) | 4 | 11 dev | Galeria histórica de dev. Mês, valores, hierarquia de edição e ações repetidas. |
| CAP06 | [Pessoas — visão geral](https://github.com/gustavomhss/Orchestra-SF/blob/346af44f4aac7bf1eb9821d4c5482bacf233a706/packages/app-shell/src/orchestra/chapters/sucafina/people/overview/index.tsx) | 1 | 5 dev | Galeria histórica de dev. Tabela estreita e descoberta de rolagem. |
| CAP07 | [Estrutura e membros](https://github.com/gustavomhss/Orchestra-SF/blob/346af44f4aac7bf1eb9821d4c5482bacf233a706/packages/app-shell/src/orchestra/chapters/sucafina/people/structure/index.tsx) | 6 | 16 dev | Galeria histórica de dev. Detalhe, retorno e consistência da ação destrutiva. |
| CAP08 | [Talentos](https://github.com/gustavomhss/Orchestra-SF/blob/346af44f4aac7bf1eb9821d4c5482bacf233a706/packages/app-shell/src/orchestra/chapters/sucafina/people/talent/index.tsx) | 5 | 15 dev | Galeria histórica de dev. Nome do líder, perspectiva localizada e data. |
| CAP09 | [Portfólio — visão geral](https://github.com/gustavomhss/Orchestra-SF/blob/346af44f4aac7bf1eb9821d4c5482bacf233a706/packages/app-shell/src/orchestra/chapters/sucafina/portfolio/overview/index.tsx) | 1 | 5 dev | Galeria histórica de dev. Preservar estrutura; fechar estados sem captura. |
| CAP10 | [Projetos](https://github.com/gustavomhss/Orchestra-SF/blob/346af44f4aac7bf1eb9821d4c5482bacf233a706/packages/app-shell/src/orchestra/chapters/sucafina/portfolio/projects/index.tsx) | 5 | 17 dev | Galeria histórica de dev. Identidade do projeto e tabela; preservar destaque de alterações. |
| CAP11 | [Serviço e SLA](https://github.com/gustavomhss/Orchestra-SF/blob/346af44f4aac7bf1eb9821d4c5482bacf233a706/packages/app-shell/src/orchestra/chapters/sucafina/operations/service/index.tsx) | 4 | 16 dev | Galeria histórica de dev. Revisão/estado destrutivo; validar largura de 320px. |
| CAP12 | [Segurança](https://github.com/gustavomhss/Orchestra-SF/blob/346af44f4aac7bf1eb9821d4c5482bacf233a706/packages/app-shell/src/orchestra/chapters/sucafina/operations/security/index.tsx) | 5 | 16 dev | Galeria histórica de dev. Ação destrutiva consistente e data localizada. |
| CAP13 | [Riscos](https://github.com/gustavomhss/Orchestra-SF/blob/346af44f4aac7bf1eb9821d4c5482bacf233a706/packages/app-shell/src/orchestra/chapters/sucafina/operations/risks/index.tsx) | 4 | 13 dev | Galeria histórica de dev. Intenção de excluir vs registro indisponível. |
| CAP14 | [Contratos](https://github.com/gustavomhss/Orchestra-SF/blob/346af44f4aac7bf1eb9821d4c5482bacf233a706/packages/app-shell/src/orchestra/chapters/sucafina/procurement/contracts/index.tsx) | 4 | 10 dev | Galeria histórica de dev. Verbo e consequência explícitos na exclusão. |
| CAP15 | [Stakeholders](https://github.com/gustavomhss/Orchestra-SF/blob/346af44f4aac7bf1eb9821d4c5482bacf233a706/packages/app-shell/src/orchestra/chapters/sucafina/operations/stakeholders/index.tsx) | 4 | 11 dev | Galeria histórica de dev. Preservar estrutura; fechar estados sem captura. |
| CAP16 | [Desempenho operacional](https://github.com/gustavomhss/Orchestra-SF/blob/346af44f4aac7bf1eb9821d4c5482bacf233a706/packages/app-shell/src/orchestra/chapters/sucafina/operations/performance/index.tsx) | 3 | 16 dev | Galeria histórica de dev. Estados de trimestre localizados. |
| CAP17 | [Planner — visão geral](https://github.com/gustavomhss/Orchestra-SF/blob/346af44f4aac7bf1eb9821d4c5482bacf233a706/packages/app-shell/src/orchestra/chapters/sucafina/planner/overview/index.tsx) | 1 | 5 dev | Galeria histórica de dev. Eixo constante entre loading e pronto. |
| CAP18 | [Planner OPEX](https://github.com/gustavomhss/Orchestra-SF/blob/346af44f4aac7bf1eb9821d4c5482bacf233a706/packages/app-shell/src/orchestra/chapters/sucafina/planner/opex/index.tsx) | 4 | 11 dev | Galeria histórica de dev. Moeda separada, grade legível e densidade. |
| CAP19 | [Planner CAPEX](https://github.com/gustavomhss/Orchestra-SF/blob/346af44f4aac7bf1eb9821d4c5482bacf233a706/packages/app-shell/src/orchestra/chapters/sucafina/planner/capex/index.tsx) | 5 | 10 dev | Galeria histórica de dev. Nome de responsável/projeto e descrição longa. |
| CAP20 | [Headcount](https://github.com/gustavomhss/Orchestra-SF/blob/346af44f4aac7bf1eb9821d4c5482bacf233a706/packages/app-shell/src/orchestra/chapters/sucafina/planner/headcount/index.tsx) | 6 | 6 dev | Galeria histórica de dev. Roster bloqueado, revisão vazia e estados. |
| CAP21 | [Alocações](https://github.com/gustavomhss/Orchestra-SF/blob/346af44f4aac7bf1eb9821d4c5482bacf233a706/packages/app-shell/src/orchestra/chapters/sucafina/planner/allocations/index.tsx) | 3 | 5 dev | Galeria histórica de dev. Entidades legíveis na distribuição; revisão. |
| CAP22 | [Câmbio / FX](https://github.com/gustavomhss/Orchestra-SF/blob/346af44f4aac7bf1eb9821d4c5482bacf233a706/packages/app-shell/src/orchestra/chapters/sucafina/planner/fx/index.tsx) | 1 | 5 dev | Galeria histórica de dev. Proveniência legível, JSON técnico em detalhe. |
| CAP23 | [Versões e comparação](https://github.com/gustavomhss/Orchestra-SF/blob/346af44f4aac7bf1eb9821d4c5482bacf233a706/packages/app-shell/src/orchestra/chapters/sucafina/planner/versions/index.tsx) | 4 | 9 dev | Galeria histórica de dev. Comparação, moeda ausente e verbos de versão. |
| CAP24 | [Compras — visão geral](https://github.com/gustavomhss/Orchestra-SF/blob/346af44f4aac7bf1eb9821d4c5482bacf233a706/packages/app-shell/src/orchestra/chapters/sucafina/procurement/overview/index.tsx) | 1 | 2 dev | Galeria histórica de dev. Metadados, títulos e breadcrumb. |
| CAP25 | [Requisições, fila e sourcing](https://github.com/gustavomhss/Orchestra-SF/blob/346af44f4aac7bf1eb9821d4c5482bacf233a706/packages/app-shell/src/orchestra/chapters/sucafina/procurement/requests/page.tsx) | 8 | 11 dev | Galeria histórica de dev. Comparação de cotações, leitura e revisão. |
| CAP26 | [Aprovações](https://github.com/gustavomhss/Orchestra-SF/blob/346af44f4aac7bf1eb9821d4c5482bacf233a706/packages/app-shell/src/orchestra/chapters/sucafina/procurement/approvals/pr/index.tsx) | 3 | 5 dev | Galeria histórica de dev. Identidade de cotação, verbos de aprovação/rejeição. |
| CAP27 | [Fornecedores](https://github.com/gustavomhss/Orchestra-SF/blob/346af44f4aac7bf1eb9821d4c5482bacf233a706/packages/app-shell/src/orchestra/chapters/sucafina/procurement/suppliers/index.tsx) | 4 | 6 dev | Galeria histórica de dev. Retorno, nomes e confirmação de criação. |
| CAP28 | [Configurações de compras](https://github.com/gustavomhss/Orchestra-SF/blob/346af44f4aac7bf1eb9821d4c5482bacf233a706/packages/app-shell/src/orchestra/chapters/sucafina/procurement/settings/index.tsx) | 1 | 4 dev | Galeria histórica de dev. Navegação interna, unidades e revisão. |
| UI29 | [Hoje / Today](https://github.com/gustavomhss/Orchestra-SF/blob/346af44f4aac7bf1eb9821d4c5482bacf233a706/packages/app-shell/src/orchestra/chapters/sucafina/home/index.tsx) | 1 | 9 dev | Galeria histórica de dev. Estados de prioridade/risco localizados. |
| UI30 | [Meu trabalho](https://github.com/gustavomhss/Orchestra-SF/blob/346af44f4aac7bf1eb9821d4c5482bacf233a706/packages/app-shell/src/orchestra/chapters/sucafina/work/index.tsx) | 1 | 7 dev | Galeria histórica de dev. Referências e status com rótulos humanos. |
| UI31 | [Busca Sucafina](https://github.com/gustavomhss/Orchestra-SF/blob/346af44f4aac7bf1eb9821d4c5482bacf233a706/packages/app-shell/src/orchestra/chapters/sucafina/search/index.tsx) | 1 | 6 dev | Galeria histórica de dev. Breadcrumb e localização; estrutura preservada. |
| UI32 | [Visões salvas](https://github.com/gustavomhss/Orchestra-SF/blob/346af44f4aac7bf1eb9821d4c5482bacf233a706/packages/app-shell/src/orchestra/chapters/sucafina/views/index.tsx) | 3 | 9 dev | Galeria histórica de dev. Comparação 2+1 e consequência de remoção. |
| UI33 | [Casos / Decisões](https://github.com/gustavomhss/Orchestra-SF/blob/346af44f4aac7bf1eb9821d4c5482bacf233a706/packages/app-shell/src/orchestra/chapters/sucafina/decisions/cases/index.tsx) | 2 | 13 dev | Galeria histórica de dev. Preservar criação estruturada; conferir demais estados. |
| UI34 | [Intenção do caso](https://github.com/gustavomhss/Orchestra-SF/blob/346af44f4aac7bf1eb9821d4c5482bacf233a706/packages/app-shell/src/orchestra/chapters/sucafina/decisions/intent/index.tsx) | 1 | 6 dev | Galeria histórica de dev. Ações, identidade, constraints e editor. |
| UI35 | [Alternativas](https://github.com/gustavomhss/Orchestra-SF/blob/346af44f4aac7bf1eb9821d4c5482bacf233a706/packages/app-shell/src/orchestra/chapters/sucafina/decisions/alternatives/index.tsx) | 3 | 7 dev | Galeria histórica de dev. Cabeçalho e contexto da comparação. |
| UI36 | [Premissas e divergências](https://github.com/gustavomhss/Orchestra-SF/blob/346af44f4aac7bf1eb9821d4c5482bacf233a706/packages/app-shell/src/orchestra/chapters/sucafina/decisions/assumptions/index.tsx) | 1 | 5 dev | Galeria histórica de dev. Divergências humanas, agrupamento e alinhamento. |
| UI37 | [Perguntas e respostas](https://github.com/gustavomhss/Orchestra-SF/blob/346af44f4aac7bf1eb9821d4c5482bacf233a706/packages/app-shell/src/orchestra/chapters/sucafina/decisions/questions/index.tsx) | 1 | 7 dev | Galeria histórica de dev. Cabeçalho, composer e estados de fonte. |
| UI38 | [Escolha da decisão](https://github.com/gustavomhss/Orchestra-SF/blob/346af44f4aac7bf1eb9821d4c5482bacf233a706/packages/app-shell/src/orchestra/chapters/sucafina/decisions/choice/index.tsx) | 1 | 4 dev | Galeria histórica de dev. Rótulo de caso atual e motivo de bloqueio. |
| UI39 | [Alterações preparadas](https://github.com/gustavomhss/Orchestra-SF/blob/346af44f4aac7bf1eb9821d4c5482bacf233a706/packages/app-shell/src/orchestra/chapters/sucafina/decisions/changes/index.tsx) | 2 | 4 dev | Galeria histórica de dev. Contexto de caso e orientação de indisponibilidade. |
| UI40 | [Histórico e recibos](https://github.com/gustavomhss/Orchestra-SF/blob/346af44f4aac7bf1eb9821d4c5482bacf233a706/packages/app-shell/src/orchestra/chapters/sucafina/decisions/receipts/index.tsx) | 2 | 4 dev | Galeria histórica de dev. Contexto de caso e estado de recibo. |
| UI41 | [Análises](https://github.com/gustavomhss/Orchestra-SF/blob/346af44f4aac7bf1eb9821d4c5482bacf233a706/packages/app-shell/src/orchestra/chapters/sucafina/decisions/analyses/index.tsx) | 2 | 4 dev | Galeria histórica de dev. Eixo formulário/alerta/histórico e pré-requisito. |
| UI42 | [Cenários de portfólio — lista](https://github.com/gustavomhss/Orchestra-SF/blob/346af44f4aac7bf1eb9821d4c5482bacf233a706/packages/app-shell/src/orchestra/chapters/sucafina/portfolio/scenarios/index.tsx) | 2 | 3 candidata | Candidata; sem render atual de dev. IDs de critérios e jornada de resultado incompleta. |
| UI43 | [Cenário de portfólio — detalhe](https://github.com/gustavomhss/Orchestra-SF/blob/346af44f4aac7bf1eb9821d4c5482bacf233a706/packages/app-shell/src/orchestra/chapters/sucafina/portfolio/scenarios/index.tsx) | 1 | — | Código; sem captura qualificada. Sem captura de resultado alcançado. |
| UI44 | [Sensibilidade](https://github.com/gustavomhss/Orchestra-SF/blob/346af44f4aac7bf1eb9821d4c5482bacf233a706/packages/app-shell/src/orchestra/chapters/sucafina/portfolio/sensitivity/index.tsx) | 2 | 3 candidata | Candidata; sem render atual de dev. IDs/operador e falha de conexão preservada. |
| UI45 | [Catálogo de BI](https://github.com/gustavomhss/Orchestra-SF/blob/346af44f4aac7bf1eb9821d4c5482bacf233a706/packages/app-shell/src/orchestra/chapters/sucafina/bi/catalog/index.tsx) | 1 | 2 candidata | Candidata; sem render atual de dev. Catálogo e estados de seleção de BI. |
| UI46 | [Visão contextual de BI](https://github.com/gustavomhss/Orchestra-SF/blob/346af44f4aac7bf1eb9821d4c5482bacf233a706/packages/app-shell/src/orchestra/chapters/sucafina/bi/catalog/index.tsx) | 1 | 2 candidata | Candidata; sem render atual de dev. Valores/gráficos e contexto humano. |
| UI47 | [Agenda de revisão](https://github.com/gustavomhss/Orchestra-SF/blob/346af44f4aac7bf1eb9821d4c5482bacf233a706/packages/app-shell/src/orchestra/chapters/sucafina/reviews/agenda/index.tsx) | 1 | 2 candidata | Candidata; sem render atual de dev. Agenda e estado de fonte. |
| UI48 | [Revisões preservadas](https://github.com/gustavomhss/Orchestra-SF/blob/346af44f4aac7bf1eb9821d4c5482bacf233a706/packages/app-shell/src/orchestra/chapters/sucafina/reviews/preserved/index.tsx) | 3 | 2 candidata | Candidata; sem render atual de dev. Valores técnicos e fonte desatualizada. |
| UI49 | [Comparação de revisões](https://github.com/gustavomhss/Orchestra-SF/blob/346af44f4aac7bf1eb9821d4c5482bacf233a706/packages/app-shell/src/orchestra/chapters/sucafina/reviews/compare/index.tsx) | 1 | 2 candidata | Candidata; sem render atual de dev. Comparação e proveniência extensa. |
| UI50 | [Relatórios](https://github.com/gustavomhss/Orchestra-SF/blob/346af44f4aac7bf1eb9821d4c5482bacf233a706/packages/app-shell/src/orchestra/chapters/sucafina/reviews/reports/index.tsx) | 2 | 2 candidata | Candidata; sem render atual de dev. Entrada por referência manual e orientação. |
| UI51 | [Relações](https://github.com/gustavomhss/Orchestra-SF/blob/346af44f4aac7bf1eb9821d4c5482bacf233a706/packages/app-shell/src/orchestra/chapters/sucafina/collaboration-pages/relations/index.tsx) | 3 | 2 candidata | Candidata; sem render atual de dev. Relações identificadas por UUID. |
| UI52 | [Conversas e threads](https://github.com/gustavomhss/Orchestra-SF/blob/346af44f4aac7bf1eb9821d4c5482bacf233a706/packages/app-shell/src/orchestra/chapters/sucafina/collaboration-pages/threads/index.tsx) | 1 | 2 candidata | Candidata; sem render atual de dev. Autor macos e identidade da conversa. |
| UI53 | [Confirmações](https://github.com/gustavomhss/Orchestra-SF/blob/346af44f4aac7bf1eb9821d4c5482bacf233a706/packages/app-shell/src/orchestra/chapters/sucafina/collaboration-pages/confirmations/index.tsx) | 1 | 2 candidata | Candidata; sem render atual de dev. Referência de seleção e confirmação. |
| UI54 | [Propostas de hot topics](https://github.com/gustavomhss/Orchestra-SF/blob/346af44f4aac7bf1eb9821d4c5482bacf233a706/packages/app-shell/src/orchestra/chapters/sucafina/dashboard/hot-topics/proposals/index.tsx) | 1 | 2 candidata | Candidata; sem render atual de dev. Proposta/recibo indisponíveis duplicados. |
| UI55 | [Nova importação](https://github.com/gustavomhss/Orchestra-SF/blob/346af44f4aac7bf1eb9821d4c5482bacf233a706/packages/app-shell/src/orchestra/chapters/sucafina/imports/index.tsx) | 1 | 2 candidata | Candidata; sem render atual de dev. Entrada e detalhes de mudanças legíveis. |
| UI56 | [Prévia da importação](https://github.com/gustavomhss/Orchestra-SF/blob/346af44f4aac7bf1eb9821d4c5482bacf233a706/packages/app-shell/src/orchestra/chapters/sucafina/imports/index.tsx) | 1 | 2 candidata | Candidata; sem render atual de dev. Diff técnico; preservar separação simular/aplicar. |
| UI57 | [Histórico, recibo e revisão de importação](https://github.com/gustavomhss/Orchestra-SF/blob/346af44f4aac7bf1eb9821d4c5482bacf233a706/packages/app-shell/src/orchestra/chapters/sucafina/imports/index.tsx) | 3 | — | Código; sem captura qualificada. Capturar histórico/recibo/revisão completos. |
| UI58 | [Documentos](https://github.com/gustavomhss/Orchestra-SF/blob/346af44f4aac7bf1eb9821d4c5482bacf233a706/packages/app-shell/src/orchestra/chapters/sucafina/documents/index.tsx) | 3 | — | Vídeo: entrada vazia, upload inicial e loading; sem viewer.. Frame, upload, viewer e estados. |
| UI59 | [Evidências de documentos](https://github.com/gustavomhss/Orchestra-SF/blob/346af44f4aac7bf1eb9821d4c5482bacf233a706/packages/app-shell/src/orchestra/chapters/sucafina/documents/index.tsx) | 1 | — | Código; sem captura qualificada. Capturar evidências e seleção. |
| UI60 | [Cenários de documentos](https://github.com/gustavomhss/Orchestra-SF/blob/346af44f4aac7bf1eb9821d4c5482bacf233a706/packages/app-shell/src/orchestra/chapters/sucafina/documents/index.tsx) | 1 | — | Código; sem captura qualificada. Capturar cenário; rótulos currency/knownSubtotal/total. |
| UI61 | [Sinais de memória](https://github.com/gustavomhss/Orchestra-SF/blob/346af44f4aac7bf1eb9821d4c5482bacf233a706/packages/app-shell/src/orchestra/chapters/sucafina/memory/index.tsx) | 2 | — | Vídeo: somente recusa de rota.. Apresentação da recusa e captura admitida. |
| UI62 | [Casos semelhantes](https://github.com/gustavomhss/Orchestra-SF/blob/346af44f4aac7bf1eb9821d4c5482bacf233a706/packages/app-shell/src/orchestra/chapters/sucafina/memory/index.tsx) | 1 | — | Código; sem captura qualificada. Capturar busca/lista/detalhe de semelhantes. |
| UI63 | [Resultados / Outcomes](https://github.com/gustavomhss/Orchestra-SF/blob/346af44f4aac7bf1eb9821d4c5482bacf233a706/packages/app-shell/src/orchestra/chapters/sucafina/memory/index.tsx) | 2 | — | Código; sem captura qualificada. Capturar resultados/outcomes. |
| UI64 | [Catálogo de rotinas](https://github.com/gustavomhss/Orchestra-SF/blob/346af44f4aac7bf1eb9821d4c5482bacf233a706/packages/app-shell/src/orchestra/chapters/sucafina/routines/catalog/index.tsx) | 3 | — | Vídeo: somente recusa de rota.. Apresentação da recusa e catálogo admitido. |
| UI65 | [Execuções de rotinas](https://github.com/gustavomhss/Orchestra-SF/blob/346af44f4aac7bf1eb9821d4c5482bacf233a706/packages/app-shell/src/orchestra/chapters/sucafina/routines/runs/index.tsx) | 2 | — | Vídeo: somente recusa de rota.. Apresentação da recusa e execução/resultado. |
| UI66 | [Agendamentos](https://github.com/gustavomhss/Orchestra-SF/blob/346af44f4aac7bf1eb9821d4c5482bacf233a706/packages/app-shell/src/orchestra/chapters/sucafina/routines/schedules/index.tsx) | 3 | — | Código; sem captura qualificada. Capturar agenda e edição de agendamento. |
| UI67 | [Contexto da instalação](https://github.com/gustavomhss/Orchestra-SF/blob/346af44f4aac7bf1eb9821d4c5482bacf233a706/packages/app-shell/src/orchestra/chapters/sucafina/context/index.tsx) | 1 | — | Vídeo: Context and access local, carregado.. Contexto legível e ações no frame. |
| UI68 | [Exportações e arquivos](https://github.com/gustavomhss/Orchestra-SF/blob/346af44f4aac7bf1eb9821d4c5482bacf233a706/packages/app-shell/src/orchestra/chapters/sucafina/imports/index.tsx) | 1 | — | Vídeo: entrada de exportação; sem arquivo concluído.. Pré-requisito, geração e resultado da exportação. |
| UI69 | [Administração local](https://github.com/gustavomhss/Orchestra-SF/blob/346af44f4aac7bf1eb9821d4c5482bacf233a706/packages/app-shell/src/orchestra/chapters/sucafina/local-administration/index.tsx) | 1 | — | Código; sem captura qualificada. Capturar administração; labels de páginas humanas. |
| UI70 | [Residentes](https://github.com/gustavomhss/Orchestra-SF/blob/346af44f4aac7bf1eb9821d4c5482bacf233a706/packages/app-shell/src/orchestra/chapters/sucafina/routines/residents/index.tsx) | 1 | — | Código; sem captura qualificada. Capturar catálogo/configuração de residentes. |

## Matriz das 25 superfícies compartilhadas

As 17 entradas sem captura receberam leitura de código, incluindo 103 estados nominais. Isso amplia o mapa de cobertura e não constitui inspeção visual desses estados.

| Superfície | Evidência visual | Estados/pendência principal |
|---|---|---|
| Inbox | Sem captura qualificada; código lido | Lista de mensagens/notificações/todos; Filtro de status waiting/all, origem e busca; Nenhum item, nenhum resultado e nenhum item selecionado |
| Flight Engineer | Sem captura qualificada; código lido | Sessão/reunião atual; Lista de reuniões; Detalhe da reunião por ID |
| Lean | Sem captura qualificada; código lido | Resumo de bytes/tokens/chamadas e itens ativos; Perfil habilitado/pausado; Busca e categoria; lista vazia/sem correspondência |
| MCP servers | Sem captura qualificada; código lido | Catálogo e busca; Loading, falha, vazio e sem correspondência; Servidor conectado/desabilitado/failed/needs_client_registration |
| Skills | Histórica; estados listados | catalog filtered sf-; read modal sf-enquadrar-decisao; read modal sf-comparar-sourcing |
| Actions / CI/CD | Sem captura qualificada; código lido | Biblioteca de workflows; Histórico de execuções geral/por workflow; Workflow/graph/source |
| Environment | Sem captura qualificada; código lido | Importar arquivo de ambiente e lista/busca; Valores ocultos/revelados; Vazio e indisponível |
| Agents | Histórica; estados listados | catalog filtered sf_; maestro tools; maestro skill tree; sf_maestro overview; sf_portfolio overview; sf_reviewer overview; sf_finance skill tree/system prompt; sf_procurement skill tree/system prompt |
| Workspaces | Sem captura qualificada; código lido | Lista de workspaces, branches e seleção; Repositório ausente/Git obrigatório; Loading/falha de leitura |
| Dock | Sem captura qualificada; código lido | Abas nativas compartilhadas com Apps do Chat; Loading; Falha com Retry |
| Plugins | Sem captura qualificada; código lido | Catálogo de comportamentos/plugins e busca; Loading, vazio, sem correspondência; Ativar/desativar |
| Providers | Histórica; estados listados | Claude mode; disconnected provider list |
| Integrations | Histórica; estados listados | empty accounts |
| Keyboard shortcuts | Sem captura qualificada; código lido | Lista e busca de atalhos; Não atribuído e sem correspondência; Editar combinação em diálogo |
| Schedule | Sem captura qualificada; código lido | Fonte server ou fallback device; Lista/busca; vazio/sem resultado; Loading, erro e dados stale |
| Settings | Sem captura qualificada; código lido | Sem projeto: general, servers, shortcuts, trust; Com projeto: permissions, providers, models, agents, mcp, shortcuts, general, servers, trust; Permissões herdadas/bloqueadas |
| Workflows | Histórica; estados listados | empty; Git-admission blocked; templates |
| Hooks | Sem captura qualificada; código lido | Biblioteca de hooks; Editor; Activity referenciada na cópia/rota |
| Atlas | Histórica; estados listados | home with zero claims |
| RAG Studio | Sem captura qualificada; código lido | Files: lista de fontes e texto selecionado; loading/erro/vazio; Files: recusas por Atlas/permissão e texto não gravado; Question: pergunta, fonte/tipagem, prompt, resultado/erro e trechos descartados |
| Board | Sem captura qualificada; código lido | Visão geral de projetos; Board de estágios, lista e timeline; Epic page |
| Technical Home | Sem captura qualificada; código lido | Projeto selecionado: dashboard; Nenhum projeto: iniciar/escolher pasta; Projetos existem: escolher projeto |
| Technical Chat and new session | Histórica; estados listados | new session empty; model selector popup; full prompt composer; completed session and empty Review |
| Native shell chrome | Histórica; estados listados | Shell, sidebar e contexto local nos vídeos |
| Application error/recovery | Sem captura qualificada; código lido | Erro formatado e cadeia de causas; Reiniciar; Exportar logs no desktop |

**HuGR Claw:** as capturas disponíveis denominadas Claw mostram compras/contratos/PO com texto editorial. Não há prova visual de um painel Claw próprio nesse recorte.

## Matriz das 5 camadas Teams

| Camada | Estados incluídos | Situação visual |
|---|---|---|
| Microsoft login and installation entry | loading; unavailable; invalid; unauthenticated/login; denied; authenticated | Código inventariado; sem galeria autenticada localizada |
| Team selection and profile | selection-required; no-teams; revoked; denied; selected Team; switch Team; logout; logout failure; draft-discard consent | Código inventariado; sem galeria autenticada localizada |
| Team administration | loading; denied; unavailable; ready profiles; enable form; disable control; invalid Team; busy; saved; conflict; outcome-unknown | Código inventariado; sem galeria autenticada localizada |
| Shared Team configuration | loading; denied; unavailable; ready; empty document; model/default-agent edit; invalid; busy; saved; conflict; outcome-unknown | Código inventariado; sem galeria autenticada localizada |
| Native Team Chat | idle/loading; unavailable; stream stopped; ready; recent empty/list/search/more; closed sessions/reopen; ephemeral-window notice; open tabs; new chat empty; thread loading; thread unavailable/retry; transcript ready; pending operations/check request; queued prompt admitted; unsupported attachments | Código inventariado; sem galeria autenticada localizada |

## Diálogos, menus e estados transitórios

O catálogo contém 38 arquivos de componentes de diálogo e um diálogo inline Teams. Não são 38 modais visualmente aprovados. A evidência compartilhada inclui o diálogo de leitura de Skill e o seletor de modelo; as revisões financeiras/compras citadas são majoritariamente inline. Os demais diálogos exigem captura aberta, validação de largura, corpo/rodapé, conteúdo longo, foco, teclado e retorno à origem.

Listagem integral e origens: [coverage.json](./coverage.json), campos dialogComponentPaths e overlayCatalog.

## Fontes históricas adicionais

Os diagramas lean/pipeline/relay do README são ilustrações produzidas de HTML; não fecham cobertura de UI. Home-dashboard é referência promocional sem manifesto de build/captura localizado. Os arquivos archives/visual-evidence e visual-handoff correspondem a recuperação histórica de 1–4 de outubro de 2026, com seus próprios commits. Foram classificados como históricos, sem restaurar ou promover esse material a prova da base auditada.

## Estado de entrega

Inventário e revisão do material disponível registrados nesta branch. Nenhum arquivo de produto, permissão, guard, fonte de negócio ou vídeo foi alterado. Não houve execução local, build, teste, CI novo, merge ou publicação de produto. A implementação e a captura de verificação das correções permanecem trabalhos posteriores, orientados pelas frentes e pela matriz.
