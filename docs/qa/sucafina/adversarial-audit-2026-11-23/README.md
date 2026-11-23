# Orchestra-SF — auditoria adversarial de frontend, UX e UI

**Referência auditada:** `dev` em `5b48dab52621037168ad4e3a6243c79a4fe5ad6e`.  
**Data:** 23 de novembro de 2026.  
**Veredito:** a experiência ainda não atende ao padrão de acabamento impecável pedido. Há uma base visual consistente e aproveitável, mas permanecem perda de trabalho, sinais de interação ambíguos, comparações difíceis de ler em telas estreitas, falhas de material e diferenças de composição entre famílias.

Esta auditoria entrega evidência e uma fila de correção. Não certifica todas as combinações de rota, dispositivo, permissão, produtor, idioma e estado. O inventário contém 70 áreas e 165 padrões de rota; esses números descrevem a extensão do produto, não uma contagem de jornadas executadas nesta rodada.

**Resultado consolidado:** 34 itens priorizados — **1 P1, 23 P2 e 10 P3** —, além de observações e refinamentos sem classificação. Foram examinados **757 PNGs originais distintos por SHA256**, registrados em 762 caminhos, em revisão paralela e consolidação independente. As evidências incluem estados associados às 70 áreas; em dez, somente o guard foi alcançado. O número de imagens não mede quantas jornadas completas foram aprovadas.

**Atualização no fechamento:** a dev avançou para `b71ecbcc` com a integração de #716. A ocorrência SYS-03 recebeu uma correção na fonte que a produzia; permanece no histórico, com resolução posterior registrada. As 34 classificações referem-se à base inicial. [DELTA.md](DELTA.md) descreve o que mudou, corrige a atribuição do toast e limita a transferência das capturas antigas para a nova dev.

## Como ler a entrega

- [Cobertura por área](COVERAGE.md): 70 IDs, estado efetivamente observado, quantidade de imagens distintas e limites.
- [Índice de achados](FINDINGS.md): prioridade e referências para evidência, reprodução e critérios de correção.
- [Registro estruturado](findings.json): achados originais, fontes, critérios de aceitação, sobreposições e ressalvas.
- [Proveniência](EVIDENCE.md): commits, runs, artefatos e hashes.
- [Sistema visual](reviewers/system.md), [produto](reviewers/product.md), [comportamento](reviewers/behavior.md) e suplementos em `reviewers/`: análise completa.
- [Probe de rascunho](probe.json): execução nova que expõe o P1, separada das capturas históricas.

## 1. O problema mais grave é perder trabalho do usuário

**BA-01 — P1: Teams apaga um rascunho nunca enviado quando o stream de eventos termina.**

Reprodução nova, usando Chromium, o bundle de produção e a fixture HTTP já existente:

1. Abrir o chat de uma Team autenticada.
2. Escrever um texto e não enviá-lo.
3. Encerrar somente as conexões de eventos existentes.
4. Acionar **Try again**.
5. Revalidar a mesma Team e autoridade.
6. Observar o editor de volta ao estado disponível, vazio.

O [run 45122542709](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45122542709) terminou com **12 casos originais aprovados e 1 caso novo reprovado**. A falha é a asserção final de preservação do texto. O probe registrou `writes: []`: nenhuma mensagem ou operação administrativa foi enviada. Não houve relaxamento de timeout, retry ou guard.

A causa está em [team-sessions.ts](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/context/team-sessions.ts#L167-L195): a quarentena do draft é preservada para `retire("refresh")`, mas não para `retire("stream")`; os mapas de draft e o prompt são limpos. A revalidação posterior não recupera o texto já descartado.

A revalidação alcança **READY/CONNECTING**, com o próximo GET de eventos pendente. Não prova recebimento de novos eventos nem conexão Microsoft real. Isso é suficiente para demonstrar a perda: o editor existiu e permaneceu vazio em 14 consultas da mesma asserção durante dez segundos. Essas consultas pertencem a uma única execução. O `error-context` posterior mostra indisponibilidade após a limpeza da fixture e não deve ser usado para redefinir essa sequência.

**Correção exigida:** preservar em memória o texto nunca enviado diante de falha de transporte, condicionado à mesma identidade e autoridade revalidadas. Logout, revogação e mudança de principal continuam apagando conteúdo. Não adicionar replay de POST nem enviar o rascunho automaticamente.

A observação **BA-02**, sobre o aviso de conexão ainda visível depois do refresh, foi retirada da contagem de defeitos confirmados: como o stream ainda estava CONNECTING, chamar esse aviso de obsoleto depois de uma recuperação completa excederia a prova. A fonte sustenta investigação adicional; o runtime atual não fecha essa conclusão.

## 2. Os problemas de informação comprometem a confiança na interface

### Revisões precisam mostrar o que realmente muda

**B1:** CAP03 tem o mês atual na tela, mas a revisão mostra “Not supplied in this version” para Original/Fonte atual. O editor recebeu o valor; a construção do snapshot exige também `recordId` e deixa de representar esse antes conhecido. A correção deve representar a origem escalar/coleção de modo verdadeiro, sem fabricar uma identidade de registro. O CAP01 fornece um controle útil: seu 128→129 aparece corretamente, portanto não há evidência de que todas as revisões estejam quebradas.

**B7:** CAP10 promete revisão de milestone, porém apresenta apenas a proposta. O valor anterior existe na seleção, mas não está associado ao resultado proposto. É necessário distinguir criação e edição, mostrar a diferença e manter notas completas, versão e autoria da fonte.

**B2:** UI48 usa o mesmo rótulo “Recorded value” para valores semanticamente distintos; IDs ficam em detalhes, mas faltam nome e tipo de negócio no contrato disponível. O ano 2026 também passa pela formatação genérica de número e aparece como 2,026. Acrescentar apenas um ícone ou trocar a fonte não resolve: a projeção precisa fornecer identidade semântica autorizada para distinguir ano, mês, valor e medida.

**B6:** Budget e Spent em CAP10 não mostram moeda nem indicam sua ausência. A extensão B6-S1 encontra o mesmo problema de contexto em CAP14: a projeção admite moeda opcional, mas detalhe e revisão não a apresentam. O dado conhecido deve ser exibido e a ausência deve ser explícita. Não é correto inferir USD ou BRL. A extensão integra o mesmo achado, sem duplicar a contagem.

### O controle visível deve corresponder ao efeito real

**B3:** UI50 renderiza dois seletores de formato e duas ações de geração. Um campo de título promete configuração, mas esse título não participa do payload de exportação. O patch inspecionado de #613 já remove o formulário legado; continua sendo um defeito da `dev` fixada enquanto esse trabalho não for integrado e verificado.

**BA-03:** CAP21 abre uma alocação existente por **Edit**, mas usa o título **Add allocation**. A chave de criação é aplicada sem distinguir a presença de ID. O título, a revisão e a ação final devem comunicar a mesma operação.

**B5:** UI48 pode falhar silenciosamente ao abrir a fonte e manter links de uma seleção anterior. A fonte mostra ausência de reset/loading/catch em caminhos relevantes e guardas que retornam sem feedback. A lógica foi inspecionada; a combinação de falha, seleção concorrente e resposta tardia ainda exige reprodução controlada.

**B9:** botões “Voltar para equipe/talentos” dependem de `navigate(-1)`. Em deep link, histórico externo ou aba nova, esse mecanismo não garante o destino anunciado. É um defeito potencial inferido da fonte, não um incidente de navegação reproduzido nesta rodada.

### O próximo passo precisa existir para o usuário

**B4:** preservar uma revisão termina em uma referência técnica e versão, sem continuidade direta no estado observado. #613 acrescenta uma abertura explícita do registro preservado e entrada por referência; a descoberta inicial ainda merece revisão. O vínculo deve vir da origem autorizada, sem inventar destinos.

**ROOT-03:** dez áreas chegaram apenas ao fallback nativo “Sucafina route not admitted”, uma linha literal em inglês sobre um painel quase vazio. O guard está correto em recusar acesso sem admissão; a mensagem é que não oferece contexto de tarefa ou recuperação útil. A melhoria deve preservar o guard e explicar o estado em linguagem localizada, com um retorno seguro e retry quando aplicável.

### Achados adicionais de componentes e operações

**SUP-01 — Add server:** a classe específica do diálogo está no nó de conteúdo, enquanto o CSS a procura no ancestral. As regras de largura máxima, margem, raio e padding não casam. O recorte de 390 px mostra o modal de uma borda à outra, embora a regra pretendida reserve 16 px de cada lado. Corrigir a relação entre classe e seletor é anterior a qualquer ajuste de gosto visual.

**SUP-02 — RAG Studio:** duas leituras que retornam HTTP 503 produzem dois painéis de indisponibilidade, um aviso e um toast. Falta uma recuperação local explícita no estado observado e na fonte examinada. Não se trata de quatro mensagens para uma única requisição. A correção deve coordenar o feedback das leituras e oferecer nova tentativa no contexto da falha.

**SUP-03 — Documentos/UI58:** o upload exige ID interno de registro e versão CAS digitados manualmente. Essa informação deveria ser obtida por descoberta/seleção autorizada do registro e mantida pelo fluxo. O requisito de concorrência deve continuar protegido; é a tarefa humana de descobrir e transcrever esses dados que está inadequada.

**B12 — CAP16:** a revisão mostra “Confirm weights exceeding total allocation” mesmo no exemplo de edição de uma nota, sem identificar peso, limite ou excesso. É uma confirmação de exceção sem contexto suficiente. Vincular o consentimento a uma condição real do produtor e explicar o que ele autoriza; não marcar a caixa automaticamente nem inventar cálculo de domínio no frontend.

**B13 — revisões de operações/contratos:** depois do antes/depois, a seção Effects repete integralmente os campos propostos. Há revisões com 22 campos de subitem e 15 de contrato. Destacar diferenças, recolher inspeção completa e fazer Effects acrescentar consequências úteis reduz a rolagem sem ocultar a verdade da origem.

Os suplementos sustentam esses itens com capturas históricas, fonte pinada e fronteiras explícitas de paridade. A observação sobre CAP05 Annual Entry continua sem classificação: os parâmetros do comando e o orçamento da lista têm semânticas diferentes, então não se pode preencher um antes presumido.

## 3. Julgamento visual, dimensão por dimensão

| Dimensão | O que sustenta o sistema | O que impede o acabamento pedido |
| --- | --- | --- |
| **Profundidade e volume** | O shell, o material translúcido e as superfícies internas têm identidade reconhecível. | SYS-01: o painel de Teams termina antes do próprio conteúdo expandido. A borda e o fundo deixam de conter a lista/chat, quebrando a percepção de um objeto único. |
| **Sombras e materiais** | A separação entre fundo, card, painel e modal é, em geral, legível nos temas padrão examinados. | Algumas famílias e diálogos adotam receitas diferentes de padding, raio, título e densidade. O enquadramento de ProviderV2 foi tratado pela #716, integrada no fechamento. As exceções precisam ser justificadas por função, não pelo componente que as implementou. |
| **Tipografia e tamanhos** | A fonte nativa e a escala básica funcionam; não encontrei motivo para substituí-las globalmente. | Textos de sistema e identificadores recebem peso/área demais. O problema principal é a hierarquia: número de negócio, ação e diferença devem aparecer antes de versão/hash/path. |
| **Cores** | As paletas dos temas examinados mantêm a identidade. | SYS-04: `--orchestra-warning` não é declarado nos estilos examinados; existe `--orchestra-warm`. Três consumidores perdem a intenção semântica. É uma constatação de fonte, sem novo render específico desses três estados. |
| **Contraste de controles** | Não há justificativa para engrossar toda borda decorativa do produto. | SYS-02: o input ativo e vazio Microsoft Team ID tem contorno essencial de cerca de 1,31:1 no claro e 1,46:1 no escuro contra o exterior. Precisa um token próprio de contorno de controle, preservando a delicadeza dos cards. |
| **Alinhamento e simetria** | Os principais títulos do shell seguem um eixo reconhecível. | B11: formulários equivalentes de 760 px alternam entre esquerda e centro; o título fica num eixo e a tarefa em outro. Simetria deve servir à tarefa e ser consistente entre páginas equivalentes. |
| **Ritmo e espaçamento** | Há bom espaço para leitura em várias telas de busca/decisões. | Estados terminais de ausência reservam áreas de gráfico/footer vazias; revisões repetem payload, título e confirmação. Espaço sem conteúdo útil vira esforço de rolagem, especialmente no celular. |
| **Posicionamento** | Várias ações se adaptam para largura total no mobile. | B8: **Edit review** de talento abre cadastro extenso; identidade e emprego precedem a avaliação que motivou a navegação. O foco da tarefa precisa vir primeiro. |
| **Responsividade** | As capturas demonstram adaptação do layout em viewports de navegador de 320/390 px em numerosas famílias. | ROOT-01/02 e BA-04: períodos, valores, antes/depois ou identidade de uma linha se separam durante o scroll. Caber no viewport não basta para continuar comparável. |
| **Microcopy e estados** | A aplicação explicita várias ausências e recusas sem falsificar dados. | Erros técnicos como CancelledError chegam ao usuário; criação/edição se confundem; motivos bloqueantes duplicam; algumas telas oferecem somente uma descrição técnica do problema. |

A medição de SYS-02 aplica-se ao limite essencial do input vazio ativo. As razões registradas vieram de amostras dos pixels de contorno, preenchimento e fundo em quatro PNGs originais dos temas padrão, com o método detalhado no relatório de sistema. Não foi generalizada para botões identificáveis por texto, bordas decorativas ou controles desativados. A referência é [WCAG 2.2, Understanding 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html): informação visual necessária para identificar um controle deve ter contraste de pelo menos 3:1 com as cores adjacentes. Não foi feita uma certificação completa de acessibilidade.

## 4. Mobile exige preservar relações, não só evitar overflow

**ROOT-01 — UI46:** o SVG mantém 700 px de largura mínima para preservar os rótulos. A 320 px, os períodos aparecem em um extremo e barras/valores no outro. O usuário precisa memorizar qual período pertence a qual medida. Deve existir uma leitura móvel em que período, valor e unidade permaneçam associados; pode ser uma composição específica ou uma tabela/lista complementar com o mesmo dado original.

**ROOT-02 — UI49:** a tabela de comparação usa 48 rem de largura mínima, com primeira coluna de 16 rem e valores de 12 rem. O primeiro recorte móvel é dominado por identidade/proveniência; antes e depois ficam fora. A região é focável e pode rolar, portanto não se alega inacessibilidade do scroll. A crítica é a eficácia da comparação. A apresentação móvel deve aproximar campo, antes, depois e qualificação, mantendo referências em camada secundária.

**BA-04 — CAP23:** no extremo direito, duas linhas mostram as mesmas ações Copy/Lock/Make official/Delete sem o nome ou estado da versão visível. A revisão posterior identifica corretamente o alvo; nenhuma mutação errada foi demonstrada. Mesmo assim, a escolha inicial depende da memória da linha. Identidade fixa, ação junto ao registro ou uma apresentação móvel por registro resolveriam a associação.

**B10 — CAP04:** o campo mensal PT-BR mostra “janeiro de 202” porque reutiliza uma largura de 112 px destinada ao ano. É um defeito pequeno, visível em duas capturas do artefato, com causa localizada. O conteúdo deve determinar a largura do campo de mês; aumentar todos os seletores de ano criaria ruído em outros lugares.

Os suplementos registram ainda baseline de KPI quando o rótulo quebra, largura de colunas de ação, scroll de cabeçalho mensal e detalhes de formulários. Cada recomendação está limitada à evidência observada.

## 5. Flakiness: o que foi demonstrado e o que continua desconhecido

Um teste verde é evidência sobre uma execução e suas asserções. Não é taxa de confiabilidade. A rodada anterior #715 registra 51 casos aprovados, sem retries, skips ou flaky nesse lote; isso não cobre todos os estados das 70 áreas.

Nesta auditoria, o probe novo acrescentou uma transição ausente do caso existente: havia texto nunca enviado quando o transporte falhou. Os 12 casos anteriores do mesmo spec passaram; a falha do novo caso mostra que aquelas asserções não detectavam essa transição. O novo caso falhou na propriedade relevante.

SYS-03 registrou um toast real de **Failed to reload providers / CancelledError** antes de confirmar desconexão. No fechamento, #716 corrigiu a origem dessa ocorrência: o observer de bootstrap notificava o cancelamento esperado da consulta substituída. A atribuição inicial ao catch de ProviderList era inferida e foi precisada em [DELTA.md](DELTA.md). O guard integrado reconhece a classe real CancelledError e preserva as falhas operacionais. A frequência histórica não foi medida; os novos resultados de CI pertencem à PR integrada e não foram somados à campanha desta auditoria.

As possibilidades de resposta tardia em UI42/UI44, openSource concorrente e aviso de conexão persistente têm níveis de prova diferentes. Não as agreguei como “flakiness confirmada”. Um falso positivo na auditoria desperdiçaria implementação e poderia enfraquecer guardas corretos.

## 6. Ordem de correção recomendada

1. **Integridade da interação:** BA-01; depois falhas silenciosas, atribuição de resposta e navegação sem destino garantido. O usuário precisa confiar que escrever, revisar, cancelar e recuperar preservam o contexto correto.
2. **Verdade e clareza da revisão:** antes/depois, identidade humana, unidade/ausência, título que corresponde ao efeito, exceções condicionadas e continuação após sucesso.
3. **Leitura móvel:** pares período/valor, registro/ação e antes/depois; ambos extremos do scroll, textos longos e PT-BR.
4. **Sistema visual:** continuidade do material, token de warning, contraste de inputs, eixos de formulários, variações de modal e baselines.
5. **Acabamento editorial:** repetição, áreas terminais vazias, linguagem de sistema, estados genéricos, nomes longos e instruções duplicadas.

Preservar o glass/blur/transparência, fontes e tokens nativos. Não há evidência que justifique substituir a identidade visual. O objetivo é torná-la coerente nos estados reais, inclusive erro, ausência, revisão, recuperação e autorização insuficiente.

## 7. Condições para encerrar cada item

Cada correção precisa de fonte, captura do estado alterado e evidência da propriedade que corrige. Não é necessário repetir toda a suíte para um ajuste tipográfico isolado; é necessário repetir o fluxo afetado quando a mudança toca draft, revisão, autoridade ou resposta assíncrona.

Para BA-01, provar preservação após falha de transporte com a mesma autoridade, limpeza após logout/revogação/troca, ausência de POST automático e sobrevivência da edição. Para comparações, provar que identidade, valores e unidades continuam relacionados em 320/390 px. Para revisão, verificar o antes real e a proposta exata, inclusive criação, ausência, versão obsoleta e cancelamento. Para o input de Teams, medir ambos os temas na superfície real e manter foco visível.

Não concluir “impecável” com folha recusada, dados vazios, pré-requisito ausente ou captura de outro commit cuja geometria relevante mudou. Não enfraquecer autorização ou inventar dado para obter uma captura aprovada.

## 8. Limites e sobreposição com trabalho em andamento

As capturas vieram de Actions, com fonte e hash do arquivo compactado conferidos. Os lotes mais antigos foram comparados com a base fixada. Mudanças posteriores no header de `shared/detail` e no alvo de ordenação de `shared/table` impedem tratar aqueles recortes antigos como prova da geometria atual nesses pontos. Não há paridade universal presumida.

A inspeção de origem abrange 66 componentes de entrada únicos do inventário e os estilos compartilhados investigados; nem toda linha de todo componente descendente foi executada. Os testes novos não rodaram localmente.

Continuam fora da qualificação: zoom real de navegador, screen reader, IME, teclado virtual em dispositivo físico, todos os temas alternativos, Safari/Firefox, Microsoft real, todas as transições de permissão e todos os 165 padrões de rota com dados completos. Algumas áreas chegaram apenas a estado vazio, produtor indisponível ou guard. O arquivo de cobertura explicita essas diferenças.

- **#613:** UI42–56, incluindo correções de UI47/UI50 já presentes no patch inspecionado. UI42–44 ainda têm qualificação instalada incompleta no estado informado pelo PR. A auditoria não substitui essa prova.
- **#713:** UI57–70; há compartilhamento de imports/documents e host. A auditoria é da `dev` fixada; alterações ainda abertas não são automaticamente tratadas como integradas.
- **#716 — integrada no fechamento:** Settings, ProviderV2, setas de select no Planner, rótulos/retorno de Decisions e correção da ocorrência SYS-03. O novo commit da dev e a fronteira de evidência estão em [DELTA.md](DELTA.md); não duplicar esse trabalho.

A branch de auditoria contém documentação e evidência estruturada. A reprodução de BA-01 está isolada em `sf-audit-behavior`, commit `e82d41143cc8041a970e9a5081ebb88df2349b4e`. Nenhuma correção de produto está sendo apresentada como concluída por este relatório.

