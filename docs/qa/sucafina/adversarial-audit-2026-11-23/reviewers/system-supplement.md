# Auditoria adversarial — suplemento de shared components, Files e UI29/UI33

**Dev fixada:** `5b48dab52621037168ad4e3a6243c79a4fe5ad6e`  
**Data:** 2026-11-23  
**Método:** inspeção visual de **136 screenshots originais distintos por SHA-256**, seguida de leitura da fonte atual e comparação com o commit de cada artifact. Nenhum código de produto foi alterado; não foram executados builds ou testes locais.

Este suplemento complementa `system-audit-review.md`, que contém Foundation e Teams. O manifesto completo das imagens efetivamente abertas, com caminho, hash, resolução, run, artifact e source SHA, está em `system-audit-supplement.json`. A existência de um arquivo no inventário de 70 superfícies não foi tratada como aprovação visual.

## Resultado e prioridade

Há **três achados P2 adicionais**: um seletor de layout que não casa com o DOM do diálogo de servidor; ausência de recuperação local legível no RAG Studio; e um fluxo de upload que exige ID e versão CAS digitados pelo usuário. Há também refinamentos de hierarquia de informação em Files, consistência de material entre diálogos e estados vazios.

A identidade nativa é recuperável e merece ser preservada. Os pixels vistos mostram composição coerente de painel, material, cards e tipografia em boa parte de Home, Cases, Inbox e Board. A falta de acabamento concentra-se em decisões locais de escopo CSS, hierarquia, contexto e recuperação. Esses achados não justificam substituir o material de vidro por uma identidade genérica.

| Item | Prioridade | Natureza | Consequência |
|---|---|---|---|
| SUP-01 | P2 | Defeito de escopo CSS observado no modal | Add server perde o inset e a receita específica de layout |
| SUP-02 | P2 | Estado de erro observado e fonte atual | Quatro mensagens na falha de duas leituras, sem ação local para recuperar |
| SUP-03 | P2 | Fricção de tarefa observada e explícita no código | Upload exige descoberta manual de ID e versão CAS |
| SUP-R01 | P3 | Refinamento de informação | Paths/recibos técnicos e buckets vazios competem com o impacto da importação |
| SUP-R02 | P3 | Julgamento estético com fonte | Diálogos variam em raio, scrim, escala e ênfase sem uma receita comum evidente |
| SUP-R03 | P3 | Refinamento de próximo passo | Estado vazio mantém instrução sem objeto disponível ou sem continuação |

P2 significa problema que deve ser corrigido para atingir a qualidade de produção pretendida; P3 é refinamento significativo, sem evidência de corrupção de dados ou bloqueio universal. O julgamento de usabilidade em SUP-03 não é apresentado como defeito de backend.

## Cobertura real e limites de paridade

| Grupo | Imagens efetivamente abertas | Fonte histórica | Estados vistos |
|---|---:|---|---|
| native-dashboard | 16 | `e315777d9ae9631321c254455aef3961cb651d94` | UI29 desktop claro/escuro, 390 px, resume, pt-BR; UI33 lista, menu de acesso, editor, review inline, claro/escuro, 320 px e pt-BR |
| files-native | 42 | `faddf7019c186fb93c29ada3297c327765200463` | UI55 arquivo selecionado, preview, indisponibilidade; UI56 preview; UI57 receipt, denied/history; UI58 admissão, candidatos, upload; UI59 revisão e confirmação de evidência; UI60 pré-requisito e revogação |
| shared-components | 78 | `b8f76cc16fe40240e7d9e5739ecb8280142972e2` | Add server e falha; command palette e resultados; Inbox vazio/falha/item/preferências; Integrations vazio/deny/conectar; RAG pipeline/manutenção/compare/falha; Board overview/stages/drawer/empty/failure; Flight Engineer web-limit |

As três comparações têm menos de 300 arquivos alterados: 139, 118 e 125, respectivamente. As listas estão no JSON local e derivam de `extra-compare.json`.

- UI29/Home e UI33/Cases não tiveram alteração própria nesse intervalo. Entretanto, a comparação de e315 lista mudanças em shared/detail, shared/table e workflows; alguns patches estão ausentes naquela resposta. Esses pixels não aprovam a versão atual desses compartilhados.
- Em Files, `imports/index.tsx`, `imports.css`, `documents/index.tsx`, `documents.css` e a copy correspondente não mudaram de fadd até dev. Esses módulos usam shared/frame, shared/states e reviews/workflows; não usam diretamente shared/detail/table. As mudanças de detail/table foram lidas e não explicam os problemas de informação/formulário relatados.
- Em shared-components, os arquivos próprios de RAG, Inbox, Board, Add server, DialogV2 e kit não mudaram de b8 até dev. SF shared/detail/table e work/search mudaram. Os patches de detail reestruturam heading/ações/back button e o de table acrescenta dimensão de sort/ajusta padding: não se dá PASS a eles pelos screenshots anteriores.
- O toolbar do host Files aparece diferente do de UI29. Isso pode resultar do host de teste; não foi convertido em bug atual de chrome sem prova.
- A lista/hash dos arquivos garante rastreabilidade. Ela não prova novo runtime de dev. Relevância atual vem da comparação de código e do mecanismo confirmado para cada achado.

## Avaliação visual direta das dimensões pedidas

### Profundidade, material, sombra e volume

O shell de vidro conserva uma estratificação compreensível: fundo difuso, painel da aplicação, cards mais elevados e overlays modais. No Board claro, o plano de colunas e os cards internos se separam sem competir com o título ou com o progresso; o drawer reduz o contexto sem perder sua relação com o card. No Inbox selecionado, a leitura principal tem espaço e contraste visual próprios. Não há motivo para engrossar todas as linhas ou elevar todas as sombras.

Os maiores desvios são **mudanças de receita entre diálogos** e **empilhamento de recipientes em Files**. Add server fica compacto e sem margem móvel; Inbox Preferences usa uma caixa arredondada e scrim desfocado; Integrations escurece o contexto com overlay próprio. Em Files, section, card, details e conteúdo técnico produzem múltiplas camadas para pouca informação. Uma revisão de densidade e agrupamento melhora o volume percebido sem eliminar o material.

Desfoque e sombra foram julgados pelo resultado raster, não por medição física ou profiling de GPU. Não se afirma que toda composição de wallpaper, transparência ou plataforma foi validada.

### Fontes, tamanhos e hierarquia

Home e Cases preservam título, contexto, card e ação com pesos distinguíveis; o editor de Cases controla a largura de leitura. O drawer do Board exibe o título longo com português/árabe/hebraico/japonês sem corte no checkpoint desktop e no móvel visto anteriormente. O truncamento no card de Board tem continuação de título no drawer, por isso não é um defeito por si.

RAG diferencia rótulos de controle, help text e valores; inputs numéricos estreitos fazem sentido no desktop e o móvel empilha os campos. A copy técnica de pipeline pertence à função dessa tela. Não foi chamada de defeito apenas por ser técnica. O tamanho reduzido da ajuda monoespaçada merece verificação com zoom e fonte efetivamente carregada, ausentes nesta revisão.

Files perde hierarquia quando hashes, paths, timestamps e números sem rótulo se tornam o conteúdo dominante. No receipt de 320 px, o identificador ocupa várias linhas antes que o usuário entenda contagem e versão. Isso é uma deficiência de comunicação, não prova de que o valor esteja errado.

### Cores e semântica

Nos frames inspecionados, Board usa texto, contagem e marcadores junto da cor; não depende somente da cor para nomear Backlog/Ready/Building/Review/Shipped. A evidência confirmada de UI59 tem texto e faixa azul, tornando o estado visualmente distinto. Inputs de erro de Add server mantêm mensagem ligada ao campo, em vez de somente um contorno vermelho.

Nenhum contraste suplementar foi medido. O achado de contraste essencial de Teams pertence ao relatório principal, com seus próprios RGB e critérios. Não estender suas razões para todo input, card, modal ou paleta. As variações cinza/azul de ação primária entre modais são tratadas aqui como consistência de design, sem afirmar violação normativa.

### Espaçamento, alinhamento, simetria e posicionamento

UI29 mantém dois blocos de larguras distintas com uma função clara e alinhamento de bordas; assimetria deliberada não equivale a erro. Board distribui as colunas de estágio regularmente no desktop. Inbox mantém o painel de navegação e o de leitura alinhados. Cases alinha rótulos/inputs e as ações do editor; a tela de review móvel capturada estava rolada, e o título fora de viewport não foi relatado como corte.

Em Files, os seis buckets fechados repetem o mesmo volume mesmo quando quatro estão vazios. O código de `details` tem padding de 12 px e summary com mínimo de 36 px, além dos gaps da seção; o espaço não é acidental, mas sua distribuição coloca muito peso na ausência de informação. Campos do upload e cards de candidatos se contêm em 320 px; o problema principal é a ordem e o número de etapas antes da tarefa útil.

No modal Add server, a ausência de margem é um erro concreto de escopo CSS, descrito abaixo. É distinto da preferência estética por uma margem maior.

### Responsividade e flakiness

Os estados vistos de UI29/UI33, Files e Board refluem sem overflow de página evidente nas dimensões registradas. Isso não aprova todos os comprimentos, zoom, teclado virtual ou plataformas. A lista de abas cortada de Inbox e o próximo estágio parcialmente visível no Board podem ser scroll horizontal deliberado; sem DOM/interação não foram promovidos a bugs.

A falha de RAG mostra a necessidade de recuperação; não estabelece uma taxa de flakiness. O fixture usa respostas 503 explícitas. A falha CancelledError de Providers e a quebra de volume de Teams já estão no relatório principal. Não houve repetição de runs nem medição de race nesta etapa.

## Achados detalhados

### SUP-01 — P2 — Add server perde largura, margem e padding próprios porque o seletor procura a classe no nó errado

**Tipo de evidência:** rendered historical observation + pinned-current source mechanism.

**Observação:** No checkpoint de 390 px, o modal Add server ocupa x=0 até x=390, sem a margem lateral de 16 px pretendida. Inputs e botões preservam o formato compacto da implementação v2; o modal de Integrations no mesmo tamanho tem inset de 16 px. Não foi observado clipping de texto nesse checkpoint.

**Efeito no usuário:** A superfície de configuração perde o respiro lateral previsto e aparenta pertencer a outro sistema de diálogo. O mesmo seletor inválido impede os ajustes de raio, alinhamento e padding do servidor.

**Mecanismo na fonte:** DialogServerV2 passa class="settings-v2-server-dialog". DialogV2 coloca props.class em Kobalte.Content/data-slot="dialog-content", mas as regras CSS esperam essa classe junto de data-component="dialog-v2" no ancestral. Essas regras não podem casar com a árvore gerada. A caixa usa a receita v2 padrão e encolhe até a largura do viewport.

**Fontes na dev fixada:**

- [packages/app-shell/src/components/settings-v2/dialog-server-v2.tsx](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/components/settings-v2/dialog-server-v2.tsx#L57), linhas 57–62.
- [packages/ui/src/v2/components/dialog-v2.tsx](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/ui/src/v2/components/dialog-v2.tsx#L84), linhas 84–111.
- [packages/app-shell/src/components/settings-v2/settings-v2.css](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/components/settings-v2/settings-v2.css#L479), linhas 479–507.
- [packages/ui/src/v2/components/dialog-v2.css](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/ui/src/v2/components/dialog-v2.css#L10), linhas 10–29.

**Reprodução:** Settings > Servers > Add server, viewport 390×844, claro/escuro. Inspecionar o DOM e as regras específicas do servidor. Não é necessário enviar uma conexão.

**Direção de correção:** Alinhar o escopo CSS com o nó que recebe a classe, ou fornecer um wrapper/prop de escopo explícito; aplicar a largura máxima pretendida e a receita nativa de diálogo. Rever raio, padding e tamanhos de controle como conjunto, sem trocar a identidade de material.

**Critério de aceitação:** Em 320 e 390 px, o modal mantém inset lateral de 16 px, nenhum overflow horizontal e foco visível. No desktop, preserva a largura pretendida de 480 px. As regras específicas devem casar no DOM real. Conferir campos normais/erro, teclado e conteúdo longo. Não declarar conformidade WCAG só porque um alvo foi aumentado.

**Paridade e limite:** Arquivos próprios de servidor, DialogV2 e settings-v2.css não aparecem na comparação completa b8f76cc→dev.

**Sobreposição:** Configuração/Settings; possível encontro com #716, mas não se deve presumir que o polimento de provider dialog/Settings resolva este seletor. Root verifica o head atual.

**Screenshots efetivamente vistos:**

- `error-recovery-server-connection-form-dark-wide.png` — `artifact-extract/additional/shared-components/packages/app-shell/e2e/test-results/orchestra-shared-visual-da-076d9-ves-a-linked-recovery-error-chromium/error-recovery-server-connection-form-dark-wide.png`
- `error-recovery-server-connection-form-dark-narrow.png` — `artifact-extract/additional/shared-components/packages/app-shell/e2e/test-results/orchestra-shared-visual-da-2fc9f-ves-a-linked-recovery-error-chromium/error-recovery-server-connection-form-dark-narrow.png`
- `error-recovery-server-health-failure-dark-narrow.png` — `artifact-extract/additional/shared-components/packages/app-shell/e2e/test-results/orchestra-shared-visual-da-2fc9f-ves-a-linked-recovery-error-chromium/error-recovery-server-health-failure-dark-narrow.png`
- `test-finished-1.png` — `artifact-extract/additional/shared-components/packages/app-shell/e2e/test-results/orchestra-shared-visual-da-2fc9f-ves-a-linked-recovery-error-chromium/test-finished-1.png`
- `error-recovery-server-connection-form-light-wide.png` — `artifact-extract/additional/shared-components/packages/app-shell/e2e/test-results/orchestra-shared-visual-li-087a2-ves-a-linked-recovery-error-chromium/error-recovery-server-connection-form-light-wide.png`
- `error-recovery-server-health-failure-light-wide.png` — `artifact-extract/additional/shared-components/packages/app-shell/e2e/test-results/orchestra-shared-visual-li-087a2-ves-a-linked-recovery-error-chromium/error-recovery-server-health-failure-light-wide.png`
- `test-finished-1.png` — `artifact-extract/additional/shared-components/packages/app-shell/e2e/test-results/orchestra-shared-visual-li-087a2-ves-a-linked-recovery-error-chromium/test-finished-1.png`
- `integrations-connect-account-dialog-dark-narrow.png` — `artifact-extract/additional/shared-components/packages/app-shell/e2e/test-results/orchestra-shared-visual-da-5af28-nect-dialog-and-denied-read-chromium/integrations-connect-account-dialog-dark-narrow.png`

### SUP-02 — P2 — RAG Studio repete mensagens de indisponibilidade e não oferece nova tentativa local

**Tipo de evidência:** rendered historical observation + pinned-current source.

**Observação:** Nos checkpoints de erro de fontes e pipeline, a página exibe dois painéis 'Could not load Rag Studio.', um 'Request failed' junto de Question e um toast 'Request failed'. Nenhum botão de Retry/Refresh da leitura aparece. O fixture força duas leituras HTTP 503: não são quatro mensagens para uma única requisição.

**Efeito no usuário:** Um erro transitório deixa uma interface ruidosa, pouco específica e sem caminho local explícito para recuperar as leituras. Adicionar um arquivo ou tentar uma pergunta não substitui uma ação de recuperação da carga inicial.

**Mecanismo na fonte:** Files.load coloca roster.status='error' e limpa sources; o estado de erro só renderiza texto. Maintain replica o erro da lista e reportPipeline emite toast; Question também mostra pipelineFailed. As releituras observadas no código são efeitos de contexto/revision e ações, sem botão de reconsulta das duas cargas.

**Fontes na dev fixada:**

- [packages/app-shell/src/orchestra/chapters/rag-studio/files.tsx](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/rag-studio/files.tsx#L38), linhas 38–62.
- [packages/app-shell/src/orchestra/chapters/rag-studio/files.tsx](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/rag-studio/files.tsx#L125), linhas 125–129.
- [packages/app-shell/src/orchestra/chapters/rag-studio/maintain.tsx](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/rag-studio/maintain.tsx#L71), linhas 71–75.
- [packages/app-shell/src/orchestra/chapters/rag-studio/maintain.tsx](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/rag-studio/maintain.tsx#L142), linhas 142–155.
- [packages/app-shell/src/orchestra/chapters/rag-studio/maintain.tsx](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/rag-studio/maintain.tsx#L177), linhas 177–195.
- [packages/app-shell/src/orchestra/chapters/rag-studio/question.tsx](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/rag-studio/question.tsx#L59), linhas 59–80.
- [packages/app-shell/e2e/orchestra/shared-visual.spec.ts](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/e2e/orchestra/shared-visual.spec.ts#L200), linhas 200–206.

**Reprodução:** Fazer sources e pipeline responderem 503 na entrada em RAG Studio; depois permitir sucesso e tentar recuperar pela própria página, sem reload de browser.

**Direção de correção:** Mostrar um estado de indisponibilidade com causas agrupadas e ação 'Tentar novamente' que refaça só as leituras necessárias. Manter os painéis dependentes em estado desconhecido explícito. Evitar toast duplicando uma mensagem persistente já visível.

**Critério de aceitação:** Depois de 503→sucesso, o usuário recupera lista e pipeline com uma ação local; nenhum erro é convertido em embedding off; foco volta a um ponto previsível e o anúncio de erro é único por evento/escopo relevante. Medir a sequência real, sem alegar frequência de flakiness com screenshots.

**Paridade e limite:** RAG files/maintain/question/studio/kit não aparecem no diff b8f76cc→dev; o checkpoint histórico é compatível com o mecanismo atual. SDK/network recovery geral não foi executado nesta auditoria.

**Sobreposição:** RAG/shared; sem correção informada no escopo original de #716. Revisão de #713/#613 pertence ao root.

**Screenshots efetivamente vistos:**

- `rag-studio-source-and-pipeline-unavailable-dark-wide.png` — `artifact-extract/additional/shared-components/packages/app-shell/e2e/test-results/orchestra-shared-visual-da-ba5f8-peline-and-unavailable-read-chromium/rag-studio-source-and-pipeline-unavailable-dark-wide.png`
- `rag-studio-source-and-pipeline-unavailable-dark-narrow.png` — `artifact-extract/additional/shared-components/packages/app-shell/e2e/test-results/orchestra-shared-visual-da-ded3d-peline-and-unavailable-read-chromium/rag-studio-source-and-pipeline-unavailable-dark-narrow.png`
- `rag-studio-source-and-pipeline-unavailable-light-wide.png` — `artifact-extract/additional/shared-components/packages/app-shell/e2e/test-results/orchestra-shared-visual-li-b17ef-peline-and-unavailable-read-chromium/rag-studio-source-and-pipeline-unavailable-light-wide.png`

### SUP-03 — P2 — Registro de documento exige que o usuário descubra e digite ID interno e versão CAS

**Tipo de evidência:** rendered historical observation + pinned-current source; usability judgment about business workflow.

**Observação:** UI58 apresenta 'Existing record ID' e 'Current record version (CAS)' como campos obrigatórios vazios. Em 320 px, esse formulário domina o primeiro viewport antes dos seletores de documentos já existentes. O texto pede conhecimento de versão e scanning do servidor.

**Efeito no usuário:** Para anexar um documento, o usuário precisa obter um identificador e uma versão técnica fora do próprio fluxo. A versão exige precisão e pode ficar obsoleta; a interface transfere o controle de concorrência para uma tarefa manual sem descoberta contextual.

**Mecanismo na fonte:** uploadRecord e uploadVersion são inputs livres; upload() valida o ID e o inteiro e os envia diretamente como record/recordVersion. O botão permanece desabilitado sem os dois. O catálogo de registros/documentos exibido abaixo não preenche esses campos. A proteção CAS é legítima; a fricção é como a UI exige seus valores.

**Fontes na dev fixada:**

- [packages/app-shell/src/orchestra/chapters/sucafina/documents/index.tsx](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/documents/index.tsx#L237), linhas 237–269.
- [packages/app-shell/src/orchestra/chapters/sucafina/documents/index.tsx](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/documents/index.tsx#L579), linhas 579–617.
- [packages/app-shell/src/orchestra/chapters/sucafina/documents/index.tsx](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/documents/index.tsx#L619), linhas 619–648.
- [packages/app-shell/src/i18n/orchestra-chapters/sf-u24.ts](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/i18n/orchestra-chapters/sf-u24.ts#L67), linhas 67–77.
- [packages/app-shell/src/i18n/orchestra-chapters/sf-u24.ts](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/i18n/orchestra-chapters/sf-u24.ts#L159), linhas 159–169.

**Reprodução:** Documents/UI58 > Register and upload document. Escolher uma classificação e um arquivo válido sem conhecer o ID/versão do registro. Avaliar a descoberta e o preenchimento em 320 px e desktop.

**Direção de correção:** Iniciar o upload a partir de um registro autorizado ou oferecer escolha por nome/referência de negócio, transportando ID e versão obtidos por leitura autorizada. Manter o CAS e tratar conflito como atualização/revisão do registro. Se o contrato atual não oferece descoberta, registrar explicitamente a lacuna de produto/API e a dependência, sem inventar um destino nem remover proteção.

**Critério de aceitação:** Uma pessoa com acesso ao registro consegue anexar o arquivo sem copiar UUID/versão interna; conflitos reais mostram o registro e a ação para revisar/atualizar. Em 320 px, selecionar documento existente e iniciar upload têm hierarquia explícita, com controles contidos. Nunca validar isso removendo autorização, versão ou scanner.

**Paridade e limite:** documents/index.tsx, documents.css, sf-u24.ts e dependências visuais frame/states não mudaram no diff faddf701→dev. Não se afirma equivalência de todo o host de teste.

**Sobreposição:** UI58 está em #713 (UI57–70): coordenar com essa branch. É débito de tarefa, não demonstra bug de backend ou autorização.

**Screenshots efetivamente vistos:**

- `UI58-admitted-empty-evidence-dark-320.png` — `artifact-extract/additional/files-native/packages/app-shell/e2e/test-results/sucafina-operations-CI-UI--baa3d-e-through-source-revocation-chromium/UI58-admitted-empty-evidence-dark-320.png`
- `UI58-admitted-empty-evidence-dark-desktop.png` — `artifact-extract/additional/files-native/packages/app-shell/e2e/test-results/sucafina-operations-CI-UI--baa3d-e-through-source-revocation-chromium/UI58-admitted-empty-evidence-dark-desktop.png`
- `UI58-authorized-extraction-fields-dark-320.png` — `artifact-extract/additional/files-native/packages/app-shell/e2e/test-results/sucafina-operations-CI-UI--baa3d-e-through-source-revocation-chromium/UI58-authorized-extraction-fields-dark-320.png`
- `UI58-admitted-empty-evidence-light-desktop.png` — `artifact-extract/additional/files-native/packages/app-shell/e2e/test-results/sucafina-operations-CI-UI--baa3d-e-through-source-revocation-chromium/UI58-admitted-empty-evidence-light-desktop.png`
- `UI58-authorized-extraction-fields-dark-desktop.png` — `artifact-extract/additional/files-native/packages/app-shell/e2e/test-results/sucafina-operations-CI-UI--baa3d-e-through-source-revocation-chromium/UI58-authorized-extraction-fields-dark-desktop.png`
- `UI58-authorized-extraction-fields-light-desktop.png` — `artifact-extract/additional/files-native/packages/app-shell/e2e/test-results/sucafina-operations-CI-UI--baa3d-e-through-source-revocation-chromium/UI58-authorized-extraction-fields-light-desktop.png`
- `UI58-original-extracted-candidate-dark-320.png` — `artifact-extract/additional/files-native/packages/app-shell/e2e/test-results/sucafina-operations-CI-UI--baa3d-e-through-source-revocation-chromium/UI58-original-extracted-candidate-dark-320.png`
- `UI58-original-extracted-candidate-dark-desktop.png` — `artifact-extract/additional/files-native/packages/app-shell/e2e/test-results/sucafina-operations-CI-UI--baa3d-e-through-source-revocation-chromium/UI58-original-extracted-candidate-dark-desktop.png`
- `UI58-original-extracted-candidate-light-desktop.png` — `artifact-extract/additional/files-native/packages/app-shell/e2e/test-results/sucafina-operations-CI-UI--baa3d-e-through-source-revocation-chromium/UI58-original-extracted-candidate-light-desktop.png`

## Refinamentos sem inflar severidade

### SUP-R01 — P3 — Import preview e receipt precisam traduzir payload técnico em hierarquia de revisão

**Evidência:** rendered + current source + design judgment.

UI55/56 mostra caminhos /versions/@id=.../lines/@id=.../desc:before e o motivo bruto missing na lista de lacunas do resultado. UI57 repete o hash completo de recibo em duas linhas, timestamp ISO e números sem rótulo. A apresentação desloca o foco de impacto para identificadores. Seis buckets fechados ocupam grande altura, inclusive quatro vazios no fixture.

**Direção:** Nomear os campos e itens por referências de negócio quando admitidas pelo contrato; manter paths e hashes completos num detalhe técnico copiável. Dar rótulos a quantidade alterada e versão; formatar timestamp para a localidade. Agrupar buckets vazios num resumo compacto preservando acesso. entry.path já está em details: não promover a hipótese errada de que todo diff cru está aberto.

**Critério de aceitação:** Um revisor distingue impacto, lacunas e resultado sem decodificar paths/UUIDs; detalhe técnico continua íntegro e acessível; datas/contagens não perdem precisão; buckets vazios não tomam a maior parte do viewport.

**Sobreposição/contrato:** UI55/56 em #613; UI57 em #713. Fonte sf-u23.ts:1–2 preserva copy legada intencionalmente: textos demandam revisão do contrato/copy, não tradução improvisada.

**Fontes:**

- [packages/app-shell/src/orchestra/chapters/sucafina/imports/index.tsx](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/imports/index.tsx#L715), linhas 715–732.
- [packages/app-shell/src/orchestra/chapters/sucafina/imports/index.tsx](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/imports/index.tsx#L735), linhas 735–768.
- [packages/app-shell/src/orchestra/chapters/sucafina/imports/imports.css](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/sucafina/imports/imports.css#L90), linhas 90–95.

**Screenshots:**

- `UI55-original-preview-dark-320.png` — `artifact-extract/additional/files-native/packages/app-shell/e2e/test-results/sucafina-operations-CI-UI--a3b16-t-without-duplicate-effects-chromium/UI55-original-preview-dark-320.png`
- `UI55-original-preview-dark-desktop.png` — `artifact-extract/additional/files-native/packages/app-shell/e2e/test-results/sucafina-operations-CI-UI--a3b16-t-without-duplicate-effects-chromium/UI55-original-preview-dark-desktop.png`
- `UI55-original-preview-light-desktop.png` — `artifact-extract/additional/files-native/packages/app-shell/e2e/test-results/sucafina-operations-CI-UI--a3b16-t-without-duplicate-effects-chromium/UI55-original-preview-light-desktop.png`
- `UI56-original-manifest-preview-dark-320.png` — `artifact-extract/additional/files-native/packages/app-shell/e2e/test-results/sucafina-operations-CI-UI--a3b16-t-without-duplicate-effects-chromium/UI56-original-manifest-preview-dark-320.png`
- `UI56-original-manifest-preview-dark-desktop.png` — `artifact-extract/additional/files-native/packages/app-shell/e2e/test-results/sucafina-operations-CI-UI--a3b16-t-without-duplicate-effects-chromium/UI56-original-manifest-preview-dark-desktop.png`
- `UI56-original-manifest-preview-light-desktop.png` — `artifact-extract/additional/files-native/packages/app-shell/e2e/test-results/sucafina-operations-CI-UI--a3b16-t-without-duplicate-effects-chromium/UI56-original-manifest-preview-light-desktop.png`
- `UI57-original-confirmed-receipt-dark-desktop.png` — `artifact-extract/additional/files-native/packages/app-shell/e2e/test-results/sucafina-operations-CI-UI--a3b16-t-without-duplicate-effects-chromium/UI57-original-confirmed-receipt-dark-desktop.png`
- `UI57-original-confirmed-receipt-dark-320.png` — `artifact-extract/additional/files-native/packages/app-shell/e2e/test-results/sucafina-operations-CI-UI--a3b16-t-without-duplicate-effects-chromium/UI57-original-confirmed-receipt-dark-320.png`
- `UI57-original-confirmed-receipt-light-desktop.png` — `artifact-extract/additional/files-native/packages/app-shell/e2e/test-results/sucafina-operations-CI-UI--a3b16-t-without-duplicate-effects-chromium/UI57-original-confirmed-receipt-light-desktop.png`

### SUP-R02 — P3 — Unificar material e escala dos diálogos preservando sua função

**Evidência:** rendered observation + current source + aesthetic judgment.

Inbox Preferences usa o shared DialogV2 com mx-dialog e fundo desfocado; Integrations usa overlay próprio somente escurecido; Add server usa controles e títulos compactos e primário cinza/contraste, enquanto os outros usam azul. O tamanho e a função podem variar, mas raio, respiro e profundidade hoje não parecem parentes em todos os estados.

**Direção:** Após SUP-01, definir receitas explícitas para diálogo compacto, formulário e painel lateral com tokens compartilhados de borda/raio/sombra/scrim e alinhamentos. O desfoque pode variar por contexto, mas deve ter uma razão funcional. Não aplicar brilho ou sombra mais pesada em todos os cards.

**Limite:** Juízo estético; não houve medição física de blur/shadow nem prova de falha de contraste em todos esses modais. Botão de 30 px não é automaticamente falha WCAG.

**Fontes:**

- [packages/app-shell/src/orchestra/chapters/inbox/controls.tsx](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/inbox/controls.tsx#L22), linhas 22–29.
- [packages/app-shell/src/orchestra/chapters/integrations-dialogs.tsx](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/integrations-dialogs.tsx#L125), linhas 125–135.
- [packages/app-shell/src/orchestra/chapters/integrations.css](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/integrations.css#L131), linhas 131–150.
- [packages/app-shell/src/orchestra/chapters/kit.css](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/orchestra/chapters/kit.css#L464), linhas 464–476.
- [packages/app-shell/src/components/settings-v2/dialog-server-v2.tsx](https://github.com/gustavomhss/Orchestra-SF/blob/5b48dab52621037168ad4e3a6243c79a4fe5ad6e/packages/app-shell/src/components/settings-v2/dialog-server-v2.tsx#L141), linhas 141–149.

**Screenshots:**

- `error-recovery-server-connection-form-dark-narrow.png` — `artifact-extract/additional/shared-components/packages/app-shell/e2e/test-results/orchestra-shared-visual-da-2fc9f-ves-a-linked-recovery-error-chromium/error-recovery-server-connection-form-dark-narrow.png`
- `inbox-preferences-dark-narrow.png` — `artifact-extract/additional/shared-components/packages/app-shell/e2e/test-results/orchestra-shared-visual-da-39374-ences-empty-and-failed-read-chromium/inbox-preferences-dark-narrow.png`
- `integrations-connect-account-dialog-dark-narrow.png` — `artifact-extract/additional/shared-components/packages/app-shell/e2e/test-results/orchestra-shared-visual-da-5af28-nect-dialog-and-denied-read-chromium/integrations-connect-account-dialog-dark-narrow.png`
- `inbox-preferences-dark-wide.png` — `artifact-extract/additional/shared-components/packages/app-shell/e2e/test-results/orchestra-shared-visual-da-b9ec3-ences-empty-and-failed-read-chromium/inbox-preferences-dark-wide.png`
- `integrations-connect-account-dialog-dark-wide.png` — `artifact-extract/additional/shared-components/packages/app-shell/e2e/test-results/orchestra-shared-visual-da-ca6ca-nect-dialog-and-denied-read-chromium/integrations-connect-account-dialog-dark-wide.png`
- `error-recovery-server-connection-form-light-wide.png` — `artifact-extract/additional/shared-components/packages/app-shell/e2e/test-results/orchestra-shared-visual-li-087a2-ves-a-linked-recovery-error-chromium/error-recovery-server-connection-form-light-wide.png`
- `inbox-preferences-light-wide.png` — `artifact-extract/additional/shared-components/packages/app-shell/e2e/test-results/orchestra-shared-visual-li-9766d-ences-empty-and-failed-read-chromium/inbox-preferences-light-wide.png`
- `integrations-connect-account-dialog-light-wide.png` — `artifact-extract/additional/shared-components/packages/app-shell/e2e/test-results/orchestra-shared-visual-li-a2df3-nect-dialog-and-denied-read-chromium/integrations-connect-account-dialog-light-wide.png`

### SUP-R03 — P3 — Estados vazios devem oferecer a próxima ação disponível no contexto

**Evidência:** rendered observation and aesthetic/task judgment; current source parity only.

Inbox vazio/indisponível mantém a instrução na coluna direita para selecionar um item inexistente. Flight Engineer explica a limitação web/desktop mas não fornece ação de continuação naquela tela. Nenhum deles foi classificado como bloqueio funcional pelos screenshots.

**Direção:** No Inbox, adaptar a coluna de leitura ao estado do feed; no Flight Engineer, quando houver destino suportado, oferecer instrução/ação concreta para continuar no desktop. Evitar dupla ilustração vazia para um único estado.

**Limite:** Não foram exercitados deep links ou instalador; não inventar ação se plataforma/contrato não oferecer.

**Screenshots:**

- `flight-engineer-web-unavailable-dark-wide.png` — `artifact-extract/additional/shared-components/packages/app-shell/e2e/test-results/orchestra-shared-visual-da-2dc76-the-real-web-platform-limit-chromium/flight-engineer-web-unavailable-dark-wide.png`
- `flight-engineer-web-unavailable-dark-narrow.png` — `artifact-extract/additional/shared-components/packages/app-shell/e2e/test-results/orchestra-shared-visual-da-acb38-the-real-web-platform-limit-chromium/flight-engineer-web-unavailable-dark-narrow.png`
- `inbox-empty-dark-wide.png` — `artifact-extract/additional/shared-components/packages/app-shell/e2e/test-results/orchestra-shared-visual-da-b9ec3-ences-empty-and-failed-read-chromium/inbox-empty-dark-wide.png`
- `test-finished-1.png` — `artifact-extract/additional/shared-components/packages/app-shell/e2e/test-results/orchestra-shared-visual-da-b9ec3-ences-empty-and-failed-read-chromium/test-finished-1.png`
- `inbox-empty-light-wide.png` — `artifact-extract/additional/shared-components/packages/app-shell/e2e/test-results/orchestra-shared-visual-li-9766d-ences-empty-and-failed-read-chromium/inbox-empty-light-wide.png`
- `inbox-read-unavailable-light-wide.png` — `artifact-extract/additional/shared-components/packages/app-shell/e2e/test-results/orchestra-shared-visual-li-9766d-ences-empty-and-failed-read-chromium/inbox-read-unavailable-light-wide.png`
- `test-finished-1.png` — `artifact-extract/additional/shared-components/packages/app-shell/e2e/test-results/orchestra-shared-visual-li-b8f18-the-real-web-platform-limit-chromium/test-finished-1.png`

## Alegações deliberadamente não feitas

- UI60 não mostrou cenário aplicado com sucesso: os frames mostram pré-requisito confirmado, ausência de destino compatível/autorizado e fonte revogada.
- RAG não mostrou corpus preenchido, qualidade de resposta ou resultado bem-sucedido de Ask; a cobertura é de controles/estado vazio/falha.
- UUID.txt em documentos vem dos dados de teste; o select usa `source.label`. Não foi inventado um bug de substituição de nome por ID.
- `entry.path` do diff de importação já está sob `details`. O problema de path exposto refere-se a `command.preview.missing[].field`, renderizado diretamente.
- O arquivo de copy `sf-u23.ts` declara source-locked copy preservada. Traduções restantes são uma questão de produto/contrato; esta auditoria não as reescreveu.
- Capturas não atestam contraste universal, screen readers, teclado virtual, zoom de 200–400%, fonte carregada, frequência de flakiness ou performance do blur.
- Não houve PASS de superfície por status no manifesto, por nome de teste ou por ter screenshot.
- Heads dos PRs #716, #713 e #613 são integrados pelo root. Este suplemento corresponde à dev fixada; um item em branch de trabalho não é correção incorporada a dev.

## Manifesto e verificações locais do relatório

O JSON contém 136 registros com `viewed: true`, 136 SHA-256 distintos, as três origens, dimensões e paths completos. Os grupos têm exatamente 16 + 42 + 78 registros. Notas de inspeção por lote registram também julgamentos retirados e limites. A validação do artefato verifica existência/hash dos PNGs e ausência de placeholders no texto; não executa testes do produto.


