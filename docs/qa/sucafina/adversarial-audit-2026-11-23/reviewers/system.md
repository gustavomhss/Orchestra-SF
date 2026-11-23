# Auditoria independente — sistema visual, Foundation e Teams

**Base auditada:** `dev@5b48dab52621037168ad4e3a6243c79a4fe5ad6e`.

**Conclusão:** a linguagem visual nativa tem coesão perceptível nas capturas examinadas, mas a interface ainda não merece ser chamada de impecável. Há quatro problemas concretos ou inferidos de fonte que pedem correção: o material de Teams termina antes do conteúdo em desktop; um campo vazio essencial tem contraste insuficiente; um cancelamento interno aparece como erro ao usuário; e um token inexistente remove a diferenciação de warnings. Há também dívida de densidade e hierarquia em telas pequenas.

Este parecer é **somente leitura**. Nenhum código, branch de produto, PR ou comentário externo foi alterado. Não houve build/teste local nem nova sessão interativa. Os screenshots foram extraídos de Actions e verificados por SHA256 pelo agente principal. Ele também confirmou a paridade dos arquivos relevantes de Foundation e Teams com o SHA auditado. São fixtures de componente, não dados de produção.

## Cobertura efetivamente realizada

Foram abertos e examinados com visualizador **128 arquivos PNG únicos: 54 de Foundation e 74 de Teams**. Cada caminho está no JSON anexo. Duplicatas de hash não contam como novas inspeções.

| Área | O que foi visto |
|---|---|
| Foundation/Home | KPIs desktop e móvel, claro/escuro, períodos, ausência/erro/parcial, troca de projeto/servidor, exemplos inglês e português, telas320/390 e intermediária700 |
| Foundation/Providers | Lista, conexões, falhas, confirmação de desconexão, picker e diálogo de autorização, desktop e390 |
| Foundation/Skills | Listagem, vazio, draft/falha/save, reader móvel, claro/escuro, um checkpointRTL |
| Teams/access | Sem seleção, selecionado, signed-out, administração aberta e fim da lista, configuração compartilhada |
| Teams/chat | Composer, histórico expandido, administração aberta e fim da lista, atualização parada, confirmação de descarte |
| Teams/matriz visual | Claro/escuro,1440×1000,320×900 e390×844; fixtures em inglês |

A revisão de fonte compreendeu theme/shell/kit e componentes SF compartilhados de frame, tabela, grade mensal, detalhe, estados e revisão de alterações; fontes de diálogo legado/V2; páginas Foundation e Teams relacionadas aos achados. Houve varredura de **138 folhas CSS não geradas de app-shell e 7 folhas geradas de paleta**, além das duas folhas de tema do pacoteUI. As instruções AGENTS da raiz, app-shell eui e o DESIGN.md de Orchestra foram lidos.

Essa cobertura não equivale a aprovação de todos os estados do produto. Não foram certificados todos os contrastes, todas as paletas/wallpapers, zoom200/400%, teclado virtual móvel, leitores de tela, Safari/Firefox, animação/performance ou todas as sequências assíncronas.

## Avaliação direta do acabamento visual

### Profundidade, material, sombras e volume

Nas capturas nativas de Home, Providers e Skills, a identidade é reconhecível: shell e painel de conteúdo deixam o fundo participar com baixa frequência visual; cards ficam um nível acima; modais recebem superfície própria e scrim com desfoque. O contraste entre capítulo, card e modal é legível visualmente, sem evidência nas imagens analisadas de sombras isoladas em direções inconsistentes ou recortes fora dos raios. Isso descreve os checkpoints vistos; não é uma medição de todos os fundos.

O desvio mais claro é **SYS-01**: o painel de Teams/chat fecha a borda no meio do conteúdo quando a administração cresce no desktop. O resultado não é apenas espaçamento estranho: a lista muda de material durante a rolagem e o chat passa a parecer solto fora do painel. Esse defeito quebra precisamente a sensação de objeto contínuo e de profundidade organizada que a linguagem nativa tenta construir.

Os cards claros de KPI ausente mantêm grande volume e sombra apesar de quase não terem conteúdo. Essa repetição cria peso desnecessário no celular. É uma avaliação de composição/densidade, não uma proposta de substituir o material original. Um ajuste deve preservar os mecanismos nativos de glass, blur e sombra, conforme DESIGN.md.

### Fontes, tamanhos e hierarquia

Os títulos nativos de capítulo, nomes de cards e títulos de modal têm hierarquia visível e consistente na maior parte da amostra. Em Home móvel 320, o português quebra o título em mais linhas sem colisão observada com o seletor de período. IDs de Teams são monoespaçados, mantêm leitura e quebram no espaço disponível; títulos longos de equipes também quebram sem invadir as ações nas capturas.

O contraste entre **diálogos ProviderV2 e diálogos nativos** ainda é perceptível: o picker/erro tem título menor e enquadramento diferente do modal de desconexão e do editor/reader de Skills. Isso já integra o escopo informado de **#716**, portanto não foi contado como novo defeito independente.

A escala é explícita na fonte: `theme.css` define 10, 11, 12, 13, 14, 16, 20, 24 e 30 px. O kit usa título de capítulo de 30 px/1,2, reduzido a 24 px abaixo de 640 px; descrição de 13 px/1,6; eyebrow de 11 px; título de modal de 20 px. Há uma decisão consistente de escala, não tamanhos aleatórios. O valor de 10–11 px deve permanecer reservado a metadados muito curtos, com verificação de leitura e contraste onde for essencial. [Fonte: theme.css](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/theme.css#L11) e [kit.css](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/kit.css#L86).

Não foi inspecionada a árvore de fontes carregadas do browser. A revisão de fonte e a aparência renderizada não provam por si só que toda fonte remota/local foi efetivamente usada. Também não houve medição universal de line-height/ascendentes por fonte ou sistema operacional.

### Cores e semântica

Os temas claro e escuro mantêm a mesma estrutura e diferenciam controles primários, estados positivos e negativos nos estados vistos. Textos e ícones não foram aprovados em bloco por impressão visual: legibilidade aparente não substitui contraste calculado.

Há dois desvios objetivos. **SYS-02** mede o campo Microsoft Team ID ativo e vazio: o limite visual fica em aproximadamente 1,31:1 no claro e 1,46:1 no escuro; o próprio preenchimento quase não se diferencia do fundo. **SYS-04** identifica referências ao token inexistente `--orchestra-warning`, embora o token nativo seja `--orchestra-warm`. Isso separa claramente uma questão de contraste essencial de uma questão de consistência semântica.

O achado de contraste não deve produzir um aumento indiscriminado de todas as bordas. Divisórias e contornos decorativos podem continuar discretos. O controle de entrada vazio precisa de uma indicação própria perceptível.

### Espaçamento, alinhamento, simetria e posicionamento

Os grids desktop inspecionados têm bordas e espaçamentos visualmente alinhados: Home usa quatro colunas, Providers e Skills usam cards coerentes dentro de suas linhas, e cabeçalhos/ações mantêm alinhamento com a área de conteúdo. As linhas de ações de Teams refluem em telas pequenas; botões de remoção ficam separados das ações de configuração, sem colisão visível nos checkpoints.

A geometria do kit também é deliberada: conteúdo até 1.020 px; no desktop, largura disponível menos 72 px e padding vertical de 52/72 px; abaixo de 640 px, margens laterais de 16 px e padding vertical de 28/40 px. Os controles nativos móveis recebem altura mínima de 44 px. São valores da implementação, não uma medição de todo componente particular. [Fonte: kit.css](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/kit.css#L74).

Há duas oportunidades de refinamento. A área de ausência no Home mantém espaços reservados de sparkline mesmo quando não existe série, produzindo tiles de aproximadamente 166px. Em Teams, a seleção pode repetir “Select a Team” em título, status e opção do seletor. No signed-out, esse mesmo título permanece enquanto a tarefa imediata é autenticar. Isso torna a hierarquia menos precisa, apesar de o layout caber.

Não há recomendação de “alinhar tudo” genericamente. Os ajustes devem ter um objetivo mensurável: restaurar a contenção do painel, dar espaço útil à conversa e remover repetição sem significado adicional.

### Responsividade e ergonomia

A amostra mostra reflow claro dos KPIs de quatro para duas e depois uma coluna; cards de Providers e Skills também empilham. Readers/diálogos móveis de Skills e a confirmação de descarte de Teams cabem nas larguras capturadas. As ações de Teams e Foundation móvel têm dimensões mais generosas que as variantes compactas de desktop. Não foi observado corte de texto nos checkpoints móveis examinados fora das regiões intencionalmente roladas.

Ainda assim, caber na tela não é refinamento suficiente. No chat administrativo 320, a primeira área de composição começa por volta de y780 em 900px de altura. Ao expandir o histórico, a pessoa vê contexto do Team, administração, busca, botão New chat, aba New chat e título New chat antes de escrever. O botão e a aba têm funções distintas e não foram classificados como duplicação funcional; a composição permanece visualmente pesada.

O composer está visível/reachable nos screenshots correspondentes. **Não há alegação de que esteja inacessível**, nem prova sobre comportamento com teclado virtual. A proposta é melhorar o espaço útil inicial por meio de hierarquia contextual, não remover acesso administrativo.

### Estados, feedback e flakiness

Os exemplos de Home diferenciam ausência, indisponibilidade e parcial; nos checkpoints de ausência, o lugar do valor apresenta a condição correspondente. O editor de Skills mostra erro e draft preservado no checkpoint de falha. Isso é evidência visual desses estados, não certificação completa dos controladores.

**SYS-03** é um sinal concreto de fragilidade no feedback: a captura de confirmação de desconexão contém `CancelledError` em um toast. O teste que gerou essa captura não foi reexecutado. Portanto há evidência de ocorrência, mas nenhuma taxa de flakiness medida. Capturas estáticas também não demonstram suavidade de animação ou ordem completa de foco.

## Achados priorizados

### SYS-01 — P2 — A superfície de Teams termina no meio da administração expandida em desktop

**Natureza da evidência:** rendered + source-confirmed.

Em chat desktop com administração expandida, a borda arredondada, o fundo e a sombra terminam antes do fim do conteúdo. As equipes restantes, histórico e chat passam a ser pintados sobre o fundo externo. A continuidade material e a hierarquia do painel se rompem durante a rolagem.

**Evidência:** Em1440×1000, o painel fecha a borda inferior perto de y976, entre Procurement e Coffee sourcing. As capturas tail mostram o restante da interface no material externo. Confirmado visualmente em claro e escuro.

**Fontes:**

- [packages/app-shell/src/pages/team-profile.css](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/pages/team-profile.css#L64), linhas 62–66, 148–159.
- [packages/app-shell/src/pages/team-profile.tsx](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/pages/team-profile.tsx#L445), linhas 445–448, 498–520.

**Mecanismo:** O mesmo main recebe sf-team-surface e sf-team-main-chat. A regra .sf-team-shell[data-sf-team-layout="chat"] .sf-team-surface (especificidade0,3,0) declara flex:1 e vence .sf-team-main-chat:has(.sf-team-administration) (0,2,0), cuja intenção é flex:none. A regra responsiva de mesma especificidade corrige o comportamento apenas até 980px ou altura 720px.

**Como reproduzir:** Usar Teams chat em 1440×1000, tema claro/escuro, administrador com 8 equipes; expandir Team administration e rolar até o fim da lista.

**Correção proposta:** Fazer o estado expandido governar o flex do próprio main com especificidade suficiente, mantendo rolagem do shell e superfície expandida até o último conteúdo. Preservar material, sombra e raios existentes.

**Critério de aceitação:** Em1440×1000 e 1280×800, o rect inferior do main deve conter os descendentes e padding inferior; nenhuma linha, ação ou região de chat pode aparecer abaixo da borda arredondada. Revalidar 320/390 para não regredir a correção responsiva.

**Sobreposição:** Arquivos Teams/UI67 da rodada#713. Não está entre os quatro assuntos informados para #716.

**Limites:** Nenhum build local ou reprodução interativa novo; screenshot real de Actions e análise de cascata do SHA auditado.


**Capturas diretamente associadas:**

- `artifact-extract/teams/packages/app-shell/e2e/test-results/orchestra-team-profile-vis-8b463-tration-and-stopped-updates-chromium/COMPONENT-VISUAL-Teams-chat-administration-expanded-dark-1440.png`
- `artifact-extract/teams/packages/app-shell/e2e/test-results/orchestra-team-profile-vis-8b463-tration-and-stopped-updates-chromium/COMPONENT-VISUAL-Teams-chat-administration-tail-dark-1440.png`
- `artifact-extract/teams/packages/app-shell/e2e/test-results/orchestra-team-profile-vis-aa118-tration-and-stopped-updates-chromium/COMPONENT-VISUAL-Teams-chat-administration-expanded-light-1440.png`
- `artifact-extract/teams/packages/app-shell/e2e/test-results/orchestra-team-profile-vis-aa118-tration-and-stopped-updates-chromium/COMPONENT-VISUAL-Teams-chat-administration-tail-light-1440.png`

### SYS-02 — P2 — Campo Microsoft Team ID ativo e vazio tem contorno essencial abaixo de 3:1

**Natureza da evidência:** measured rendered contrast + source.

Um usuário com baixa visão pode não distinguir a área de entrada vazia do fundo do formulário. O campo não possui placeholder, ícone interno ou outro indicador visual alternativo.

**Evidência:** Quatro screenshots originais mostram o campo Microsoft Team ID ativo, vazio e desfocado. A borda mede 1,31:1 no tema claro e 1,46:1 no escuro contra o fundo externo; o preenchimento mede, respectivamente, 1,07:1 e 1,09:1. Os valores RGB e os pontos de amostragem estão na tabela e no método abaixo.

**Fontes:**

- [packages/app-shell/src/pages/team-profile.css](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/pages/team-profile.css#L72), linhas 72–85.
- [packages/app-shell/src/orchestra/chapters/kit.css](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/kit.css#L8), linhas 8–10,34–36.
- [packages/app-shell/src/components/team-profile-administration.tsx](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/components/team-profile-administration.tsx#L170), linhas 170–176.

**Mecanismo:** O campo usa borda var(--mx-line) e preenchimento var(--mx-soft), tokens de baixa opacidade destinados também a superfícies sutis. Na composição renderizada, nem a borda nem o preenchimento fornecem a diferença de 3:1 para localizar a área vazia. O markup não fornece placeholder, ícone interno ou outro indicador alternativo da área editável.

**Como reproduzir:** Teams access > Team administration, sem configuração aberta e sem operação pendente. Deixar Microsoft Team ID vazio e desfocado; avaliar claro/escuro em 1440/320.

**Correção proposta:** Criar ou aplicar token específico de contorno de controles que alcance3:1 no material adjacente. Evitar alterar mx-line global e engrossar toda a decoração. Manter foco próprio e distinção do estado disabled.

**Critério de aceitação:** Calcular cores computadas/composição do campo ativo vazio em ambos os temas e nos fundos suportados; indicador essencial >= 3:1. Verificar visualmente default/hover/focus/error/disabled sem transformar sombras ou divisórias em alarmes.

**Sobreposição:** Área Teams/UI67 #713 e token compartilhado. Não é um item informado de #716.

**Limites:** Medição de quatro checkpoints de palette padrão; não representa todas as paletas, wallpapers ou todos os campos. Screenshot estabelece o estado observado; certificação geral exige auditoria mais ampla.

| Tema | RGB externo | RGB contorno | RGB interno | Contorno/externo | Interno/externo |
|---|---|---|---|---:|---:|
| light | 243,245,247 | 211,216,222 | 235,238,241 | 1.311880:1 | 1.065580:1 |
| dark | 13,20,28 | 40,52,62 | 21,29,38 | 1.455963:1 | 1.089666:1 |

**Método:** PNG original1×:1440 screenshots sample outer(500,570), top border(500,579), fill(500,600);320 screenshots outer(150,730),border(150,737),fill(150,760). RGB lidos por Pillow, luminância sRGB linearizada e razão(Lmax+.05)/(Lmin+.05). A linha reta inteira, sem borda arredondada/antialias, foi escolhida. CSS usa mx-line14% e mx-soft4.5%/5.5%; a composição explica os valores renderizados.

**Escopo normativo:** WCAG 2.2 SC 1.4.11 exige 3:1 para a informação visual necessária à identificação do controle; campo vazio depende desse limite/fundo. Não aplicar este achado às bordas decorativas de cards, botões com texto identificável ou controles desativados. [W3C, SC 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).

**Capturas diretamente associadas:**

- `artifact-extract/teams/packages/app-shell/e2e/test-results/orchestra-team-profile-vis-30015-istration-and-configuration-chromium/COMPONENT-VISUAL-Teams-administration-expanded-light-1440.png`
- `artifact-extract/teams/packages/app-shell/e2e/test-results/orchestra-team-profile-vis-726ab-istration-and-configuration-chromium/COMPONENT-VISUAL-Teams-administration-expanded-dark-1440.png`
- `artifact-extract/teams/packages/app-shell/e2e/test-results/orchestra-team-profile-vis-38bae-istration-and-configuration-chromium/COMPONENT-VISUAL-Teams-administration-expanded-light-320.png`
- `artifact-extract/teams/packages/app-shell/e2e/test-results/orchestra-team-profile-vis-3a3e4-istration-and-configuration-chromium/COMPONENT-VISUAL-Teams-administration-expanded-dark-320.png`

### SYS-03 — P2 — Fechar configuração de provider deixa alerta técnico CancelledError

**Natureza da evidência:** rendered observation; lifecycle cause partly inferred.

Um fluxo normal de navegação mostra Failed to reload providers / CancelledError enquanto a confirmação de desconexão está aberta, embora nenhuma desconexão ainda tenha ocorrido. O usuário recebe uma falha sem ação útil nem explicação compreensível.

**Evidência:** provider-disconnect-confirmation-light.png contém toast com título Failed to reload providers e corpo CancelledError, simultâneo ao modal Disconnect OpenAI?.

**Fontes:**

- [packages/app-shell/src/orchestra/chapters/providers-list.tsx](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/providers-list.tsx#L134), linhas 134–147,152–162.
- [packages/app-shell/src/orchestra/chapters/providers-data.ts](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/providers-data.ts#L148), linhas 148–159.
- [packages/app-shell/src/context/server-queries.ts](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/context/server-queries.ts#L107), linhas 107–122.
- [packages/app-shell/e2e/orchestra/chapter-providers.spec.ts](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/e2e/orchestra/chapter-providers.spec.ts#L98), linhas 72–107.

**Mecanismo:** O close callback do diálogo chama reload sempre; reload transforma qualquer rejeição em toast e errorMessage expõe Error.message. createProviderRefresher cancela explicitamente a consulta anterior. A emissão da mensagem está confirmada; a combinação exata de solicitações concorrentes que produziu a rejeição não foi reexecutada.

**Como reproduzir:** Seguir teste existente v2: error and retry, server route, confirmed credential removal, key and picker: recuperar a lista, abrir Configure em OpenAI(work), Escape e abrir Disconnect em OpenAI; observar toast antes de confirmar.

**Correção proposta:** Distinguir cancelamento/supersessão de falha real e coordenar refreshes por escopo. Evitar erro técnico por simples fechamento. Preservar a notificação de falha real de reload.

**Critério de aceitação:** Repetir close/reopen rápido e refresh concorrente com mesma/diferente conexão; não exibir CancelledError/erro falso. A prova existente de falha real após disconnect deve continuar exibindo erro acionável.

**Sobreposição:** Provider dialog está sendo alterado em #716; este achado é sobre feedback assíncrono, além da mudança de enquadramento. Coordenar no mesmo arquivo/superfície.

**Limites:** Não há alegação de perda de dados. A frequência/flakiness não foi medida; há uma ocorrência capturada no artefato real.


**Capturas diretamente associadas:**

- `artifact-extract/foundation/packages/app-shell/e2e/test-results/orchestra-chapter-provider-3d887-tial-removal-key-and-picker-chromium/provider-disconnect-confirmation-light.png`

### SYS-04 — P2 — Token de warning inexistente remove a semântica visual de três superfícies

**Natureza da evidência:** source-inferred, not visually re-rendered.

Security Moderate herda cor em vez da cor de alerta; o border-inline-start de warnings no Planner Overview fica inválido; o status warning compartilhado usa explicitamente a cor neutra de fallback. Alertas perdem a consistência com os tons success/danger.

**Evidência:** --orchestra-warning tem3 referências e zero declarações em 138 CSS não gerados de app-shell e 7 CSS gerados de paleta; tampouco aparece nas duas folhas de tema UI ou nas definições/contexto de paleta examinados. O token nativo declarado é --orchestra-warm, #cfbd95 escuro/#4d390f claro.

**Fontes:**

- [packages/app-shell/src/orchestra/chapters/sucafina/operations/security/security.css](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/operations/security/security.css#L53), linhas 51–54.
- [packages/app-shell/src/orchestra/chapters/sucafina/operations/security/index.tsx](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/operations/security/index.tsx#L781), linhas 781.
- [packages/app-shell/src/orchestra/chapters/sucafina/planner/overview/overview.css](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/planner/overview/overview.css#L43), linhas 43.
- [packages/app-shell/src/orchestra/chapters/sucafina/shared/detail/detail.css](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/shared/detail/detail.css#L128), linhas 126–129.
- [packages/app-shell/src/orchestra/theme.css](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/theme.css#L52), linhas 52,301.

**Mecanismo:** --orchestra-warning tem3 referências e zero declarações em 138 CSS não gerados de app-shell e 7 CSS gerados de paleta; tampouco aparece nas duas folhas de tema UI ou nas definições/contexto de paleta examinados. O token nativo declarado é --orchestra-warm, #cfbd95 escuro/#4d390f claro.

**Como reproduzir:** No estado Security com statusModerate, Planner Overview com warnings e qualquer SfDetail status tone=warning, inspecionar os estilos computados no SHA auditado.

**Correção proposta:** Substituir as referências pelo token semântico nativo existente ou definir um alias canônico único. Validar o significado e os contrastes nos temas; não trocar por uma cor amarela literal.

**Critério de aceitação:** getComputedStyle(...).getPropertyValue('--orchestra-warning') deve ser definido se o nome continuar. Moderate/warning deve usar tom semântico consistente; Planner warning deve ter border-inline-start-style solid e espessura pretendida. Texto do alerta continua explícito.

**Sobreposição:** Planner Overview pode ter conflito de arquivo com#716 (setas/selects); o defeito de token é distinto. Shared detail/Security fora dos assuntos informados para #716.

**Limites:** Não medido em execução para os 3 consumidores. Busca de código default branch retornou vazio e não foi usada como prova; conclusão delimitada às folhas e contexto de temas auditados.


**Capturas diretamente associadas:**

- Sem re-render específico neste subaudit; achado delimitado à fonte.


## Refinamentos e trabalho já em andamento

### REF-01 — P3 / design judgment — Estados terminais de ausência gastam altura de gráfico vazio no Home móvel

Tiles ausentes têm~166px de altura e continuam renderizando foot e home-bars vazios; oito tiles ocupam cerca de 1.400px. Avaliar compactar somente estados terminais sem dados, mantendo estabilidade de loading→valor. Este é julgamento de densidade, não overflow ou inacessibilidade demonstrada.

**Fonte:** `packages/app-shell/src/orchestra/chapters/kpis.tsx:505–537`; `packages/app-shell/src/orchestra/chapters/kpis.css:89–98,125–132,152–170,183–188,469–472`.

### REF-02 — P3 / design judgment — A hierarquia de Teams repete instruções e dedica pouco espaço inicial à conversa

Select a Team aparece como título, bloco de status e placeholder; signed-out ainda usa esse título antes do sign-in. No chat de administrador320, o composer começa perto de y780 em 900px; abrir histórico exibe o botão New chat, a aba New chat e o título New chat antes da conversa. A aba tem função de navegação e o botão tem função de iniciar, portanto não são tratados como bug duplicado. Refinar a densidade/objetivo por estado e compactar contexto administrativo sem remover acesso.

**Fonte:** `packages/app-shell/src/pages/team-profile.tsx:445–470`; `packages/app-shell/src/pages/team-session.tsx:117–171`; `packages/app-shell/src/pages/team-profile.css:156–173`.

### OVERLAP-716 — already in active work — Diálogos ProviderV2 quebram o vocabulário dos diálogos nativos

Capturas mostram picker/erro de provider com título pequeno, raio e framing diferentes do diálogo nativo de confirmação e Skills. Já informado como escopo de #716; não contar novamente como defeito novo nem afirmar resolvido sem screenshot da branch.

**Fonte:** `packages/ui/src/v2/components/dialog-v2.css`; `packages/app-shell/src/components/dialog-connect-provider.tsx`.


Não afirmar que #716 já resolve a aparência observada sem revisar a captura da própria branch e seu merge-base. A correção do feedback de cancelamento requer coordenação com essa área. A correção de warning no Planner pode compartilhar arquivo com seus selects, mas é um defeito diferente.

## Integridade da evidência

O JSON `system-audit-review.json` contém os 128 caminhos efetivamente vistos, hash/dimensões quando disponíveis, distinção entre observação, medida e inferência, critérios de aceitação e limites. Os arquivos originais não foram alterados. Nenhum resultado “PASS” universal foi fabricado.

Uma hipótese inicial de restauração de foco da tabela foi retirada após reavaliar a semântica reativa e **não integra os achados**. Da mesma forma, o efeito de glass, a escolha nativa de fonte e o vocabulário visual não foram tratados como defeitos só por preferência estética. A proposta é corrigir desvios comprovados e refinar a densidade preservando a identidade.

