# Fechamento focal — sistema visual, Teams e documentos

**Data:** 2026-11-23  
**Base:** `dev` em `e115b667d845822a1df5f523bbfd828ab57ca978`, com #713 e #716.  
**Último produto desta frente:** `b9c4fa518fe1620e6bcba7542db492883db7fc0e`.  
**Último helper desta frente:** `7155676474f17c72d017b4f6aea7ffa5a8762404`.  
**Método:** leitura e escrita de fonte pelo GitHub; execução do produto no workflow original `test-ci`; inspeção dos PNGs originais e dos recibos dos artifacts. O processamento local ficou restrito a extração, leitura, metadados e hashes.

Este registro corresponde à frente de sistema da [auditoria original](../reviewers/system.md) e do [suplemento](../reviewers/system-supplement.md). O fechamento focal passou nos cinco casos nativos de Files8, além dos lotes visuais/RAG/Teams descritos abaixo. O gate da composição integrada e o merge são registrados na consolidação da PR #717. Cada prova abaixo preserva seu commit de origem; o JSON companheiro contém os SHAs, os ZIPs, os caminhos dos PNGs realmente inspecionados e o mapa dos oráculos.

## Mudanças e critérios de fechamento

| Item | Mudança | Evidência focal |
|---|---|---|
| SYS-01 | Teams mantém o material por toda a administração expandida e pela sessão, corrigindo localmente flex/overflow. | Oito combinações de tema/largura, limites reais e PNGs de topo/cauda. |
| SYS-02 | O campo habilitado e vazio de Teams mantém borda de 1 px, com composição local do token de texto atenuado. | Contraste calculado acima de 3:1 contra interior e exterior em claro/escuro. |
| SYS-04 | Security e shared/detail passam a usar o token existente `--orchestra-warm`. A troca equivalente do Planner pertence à frente behavior. | Leitura dos consumidores e gate integrado; a decoração global permanece na receita original. |
| REF-01 | Home reserva barras/rodapés somente para estados que têm dados ou loading; estados terminais de ausência ficam compactos. | EN/pt-BR em 320/390 px, medidas de altura e ausência de overflow. |
| REF-02 | Teams concentra administração e ações no cabeçalho e remove o título redundante do chat ainda vazio. | Composer compacto alcançável e administração expandida preservada. |
| SUP-01 | Add server aplica `containerClass` ao nó correto do DialogV2, usando largura, título, padding e controles nativos. | Desktop de 480 px; inset de 16 px em 390/320; botões de 44 px. |
| SUP-02 | RAG agrupa falhas de Files/Pipeline e oferece recuperação local das leituras falhas. | Preservação de caminho/pergunta, foco, seleção e descarte de respostas tardias. |
| SUP-03 | Novo documento escolhe o registro pelo nome/referência do catálogo autorizado; CAS vem do produtor. | Catálogo CAP27, scanner/bytes/CAS/readback, preservação do File e seis capturas do checkpoint original. |
| SUP-R01 | UI55/56 traduz lacunas em linguagem legível e agrupa categorias vazias; implementação da frente behavior. | OP-IMPORT nativo, 12 checkpoints inspecionados por behavior; UI57 de #713 preservada. |
| SUP-R02 | Add server corrige a geometria local; Integrations adota os tokens compartilhados de scrim/blur. | Escopo delimitado por diálogo; Inbox Preferences conserva sua receita maior. |
| SUP-R03 | Inbox vazio/falho apresenta o estado correspondente; Flight Engineer informa o limite da plataforma e aponta para Home pelo link real. | Fluxos compartilhados originais, sem continuação inventada. |

SYS-03 já estava resolvido por #716 e não foi reimplementado. SUP-R01/UI55–56 é da frente behavior; UI57 já tinha a melhoria de #713. Controller de Teams e shared/change-review têm ownership separado. A colaboração dessas frentes aparece identificada quando sustenta uma prova conjunta.

## Teams: geometria e contraste

O spec `e2e/orchestra/system-refinement.spec.ts` executou claro/escuro em **1440×1000, 1280×800, 390×844 e 320×900**. Nas oito combinações, o overflow horizontal medido foi **0 px**, a borda do input habilitado/vazio ficou em **1 px**, a administração permaneceu dentro do material e o composer compacto ficou no viewport.

| Tema | Contorno × interior | Contorno × exterior |
|---|---:|---:|
| Escuro | 4,83357058:1 | 5,31285152:1 |
| Claro | 3,58466613:1 | 3,80396295:1 |

A superfície principal termina 33 px depois da sessão, incluindo padding inferior de 20 px. Em 320 px, o fundo principal termina em **y=3215,21875**, a administração em **y=2720,21875** e a sessão em **y=3182,21875**. Os originais de cauda mostram a continuidade do vidro no trecho que antes ficava sem material.

As razões compõem as camadas sólidas de CSS; os PNGs mantêm blur, grão e wallpaper para julgamento visual. Essa medida não certifica todos os fundos/imagens nem todos os controles. O attachment classifica a execução como **COMPONENT VISUAL / not Microsoft live**.

### Vínculo com as paletas regeneradas

Essas medidas foram obtidas no produto `f8a5dcd`. A equivalência relevante foi conferida contra `095ba9312984c40d6214e0d55bbe8bfe4becc866`, sem renomear o resultado antigo como uma nova medição. O fixture inicializa `orchestra-theme-id=oc-2`, `orchestra-palette=scheme` e `orchestra-color-scheme=scheme`: as paletas efetivamente medidas são as bases **dark/light**. As três linhas de inicialização permanecem idênticas.

| Fonte | Blob Git idêntico em f8a5dcd e 095ba931 |
|---|---|
| `pages/team-profile.css` | `eda702bbd201fcb923966033db3ac07401c57bb3` |
| `orchestra/chapters/kit.css` | `e0fa9a2b648265db85458e56369d57e73af9bbe5` |
| `orchestra/theme.css` | `5f557ab4917ba9a7c850cce8b265ac0900ca373d` |
| `orchestra/background.css` | `b1e0bfc96bf30b550d8c485f14de284a383edbd5` |
| `orchestra/shell.css` | `0dce077a44748c73d4096a202cd6b679628c4c65` |
| `e2e/orchestra/system-refinement.spec.ts` | `3adb926578ef1806ad2aa1795418b2fc053ee7c2` |

Nas cinco paletas regeneradas, a única seção alterada foi `orchestra/chapters/inbox/inbox.css`: o seletor da paleta para `.inbox-workspace[data-has-items="false"] .inbox-list-pane` recebe `border-inline-end: 0`. Todas as outras seções, inclusive theme/kit e os tokens de cor, são byte-idênticas. `pages/team-profile.css` não integra `PALETTE_SOURCES`. Portanto, a regeneração não altera contorno, interior ou exterior qualificados no SYS-02. As razões continuam restritas às bases dark/light; não qualificam numericamente as cinco paletas nomeadas.

## Add server e Home

| Viewport do modal | Largura | Margens laterais | Raio | Título | Botões |
|---|---:|---:|---:|---:|---:|
| 1440 px, claro/escuro | 480 px | 480 px | 16 px | 20 px | 44 px |
| 390 px, escuro | 358 px | 16 px | 16 px | 20 px | 44 px |
| 320 px, claro | 288 px | 16 px | 16 px | 20 px | 44 px |

Os estados de formulário e erro mantêm os componentes originais. A inspeção examinou distribuição dos campos/ações, inset, leitura das mensagens, foco e separação entre scrim e material. Essa matriz é a combinação efetivamente testada.

Home foi medido nas quatro combinações EN/pt-BR e 320/390 px. Os tiles de indisponibilidade ficaram com **77,5 px**; os de ausência com contexto/ação, **100,5 px**. A largura rolável de cada tile coincide com a largura disponível: **236 px** em 320 e **306 px** em 390. Rodapé e documento também ficam no viewport. Estados de dados e loading mantêm sua receita própria.

O [run 45208327945](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45208327945), snapshot `ffe6cddea550b6953bbfcaf9b2bded3a1d72893a`, executou system-refinement, shared-visual e chapter-kpis sobre `f8a5dcd69269a2b8c489301b050b51a9a05a11f4`: **53 PASS, 0 failures e 0 retries**.

## Refinamentos suplementares e limites por superfície

### SUP-R01 — impacto da importação antes do detalhe técnico

A frente behavior humanizou as quatro lacunas originais `missing`, conservando a ambiguidade quando o contrato não permite nomear o item: **Source value / Before import**. Caminhos e `reason` completos permanecem acessíveis no detalhe técnico. **Added=4** e **Changed=5** aparecem como grupos com conteúdo; as quatro categorias com zero são resumidas em um único disclosure. A capitalização EN foi corrigida e a copy PT existente foi preservada.

Em Files6, OP-IMPORT passou em **153797 ms**. Behavior abriu os **12 checkpoints UI55/56**, com 11 hashes únicos, em EN escuro/claro desktop e escuro 320 px. O oráculo mantém zero Apply durante os previews/UI56; depois há um Apply, três campos alterados, revisão do registro afetado 1→2 e registro não relacionado 1→1. UI57, perda da entrega seguida de Refresh receipt, rota independente, revogação entre abas e recusa do viewer continuaram no fluxo verde de Import. Esse resultado focal não torna Files6 inteiro verde; DOC terminou por deadline. A validação composta final está na seção de Files.

Este fechamento não afirma renderização PT dos previews, precisão visual em zoom/touch ou reescrita universal de todos os paths/receipts. A implementação e os hashes próprios estão no [registro behavior](behavior.md).

### SUP-R02 — parentesco de material com geometria específica

Add server recebeu a correção do nó de escopo, 480 px máximos, inset lateral de 16 px no móvel, raio de 16 px, título de 20 px e ações de 44 px. Integrations alterou somente o backdrop para `--orchestra-scrim` e `--orchestra-scrim-filter`, incluindo a propriedade WebKit. Seu formulário, provider, campos e ações originais continuam presentes.

Foram abertos os originais de Connect account em escuro 390 px, claro 320 px e claro desktop, além de Preferences em escuro 390 e claro 320 para comparação. Preferences conserva o painel maior do DialogV2/mx-dialog, inclusive a largura total no viewport estreito; não recebeu a mesma geometria de Add server. ProviderV2 já vinha de #716. O resultado é uma aproximação local de material e escala nas superfícies alteradas, sem migração de todos os diálogos para um componente único nem declaração de identidade geométrica entre eles. O custo de blur/GPU e contraste global de todos os modais não foram medidos.

### SUP-R03 — próximo passo compatível com dados e autoridade

| Estado | Tratamento efetivo | Dependência preservada |
|---|---|---|
| Inbox sem itens | Uma região de estado, sem a coluna que manda selecionar algo inexistente. | Novos itens dependem das fontes e contas já autorizadas. |
| Inbox indisponível | A ação existente **Try again** fica no estado único de erro. | Refaz a leitura original; não adquire conta nem concede acesso. |
| Inbox sem resultado do filtro | **Clear filters** já existe na fonte e permanece. | Esse ramo não ganhou exercício novo no teste focal. |
| Flight Engineer no navegador | Mensagem desktop-only e link real **Back to Home**, com `href="/"`. | Meetings, gravação e consentimento continuam exigindo seat desktop disponível; nenhum bridge, instalador ou deep link foi inventado. |
| RAG indisponível | Recuperação local das leituras falhas, descrita em SUP-02. | Ask e qualidade do corpus não foram qualificados por esses testes. |
| Home sem dados/contexto | Compactação REF-01 preserva as ações contextuais existentes. | Configuração de tracking/repositório/conta mantém sua autoridade original. |

Os originais de Inbox vazio/falho e Flight Engineer foram inspecionados em escuro desktop e claro 320 px. O spec valida o destino do link Home; não demonstra instalação, transferência para desktop ou aquisição de fonte externa. O fechamento cobre os dois problemas concretos do suplemento — instrução sem item e falta de saída do limite web — com os próximos passos disponíveis no contrato.

## RAG: recuperação e respostas tardias

A falha das duas leituras iniciais aparece uma vez, nomeando Files e Pipeline. **Try again** repete apenas as leituras falhas, preserva caminho e pergunta e retorna o foco ao título de Files quando a ação ainda é dona do foco. Pipeline desconhecida permanece um estado desconhecido, em vez de ser apresentada como embedding desativado.

A revisão adversarial encontrou dois riscos adicionais de concorrência:

1. Seleção A seguida de B, com A terminando por último: B e seu texto devem permanecer.
2. Saída e retorno ao RAG: respostas da instância desmontada não podem escrever no roster global da instância nova.

Os reads passaram a ter fences independentes de seleção, diretório, geração e lifetime, invalidados em cleanup. Os testes usam componentes reais e respostas HTTP do fixture existente com atraso controlado. Ask, admission, delete e outras mutações não são executados para demonstrar essa recuperação.

A primeira execução de hardening teve 29 PASS e uma falha de navegação do helper: abrir Inbox fecha Extensions. O helper passou a reabrir o grupo pela UI nativa. A correção preservou timeouts e retries. O [run final 45215159876](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45215159876), snapshot `3d07fdbe011e6f67e00d4ed3402915bc5188a711`, teve **30 PASS, 0 failures e 0 retries**. Os dois originais de resposta tardia/unmount foram inspecionados e constam no manifesto. O guia `docs/guides/rag-studio.md` acompanha as mudanças.

## Teams: controller e apresentação na mesma composição

O [run 45218615206](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45218615206), snapshot `2758bf0651eb6765383795030c656d7bbe4fc25b`, executou somente o spec original `team-profile-visual.spec.ts` sobre `77f3104662e5ce4a7181403761a3b7e51c138704`. Resultado: **13 PASS, 0 failures e 0 retries**, combinando controller da frente behavior e CSS/apresentação desta frente.

O recibo registra rascunho esperado igual ao observado, mesma autoridade completa, quatro novas leituras GET e **nenhum write/prompt submetido**. A amostra registrou **1016,894516 ms** até pronto, **17,533565 ms** para preencher/verificar o input e **156,509704 ms** para o editor retornar após refresh. É uma única amostra Linux/Chromium, bundle production e fixture HTTP existente; não permite inferência estatística de performance ou taxa de flakiness.

Foram inspecionados oito originais: entrada em 320 px claro/escuro e 1440 px escuro, cauda da administração em 320 px nos dois temas e três estados de interrupção/recuperação. Os frames de entrada de 320 px são byte-idênticos aos do lote visual inicial.

### BA-02: controle OPEN e fechamento pela frente behavior

O primeiro frame pós-refresh estava **READY/CONNECTING**: rascunho restaurado, aviso ainda visível. Esse estado isolado não provava o comportamento após OPEN.

A frente behavior acrescentou um evento válido ao fixture HTTP original, mantendo o processamento no GET de lista disparado pelo evento. O [controle 45221722913](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45221722913), snapshot `52ec529d4bf72e400a02dd5a54067b0927c88128`, confirmou o aviso persistido em **READY/OPEN**: 12 PASS e uma falha específica, noticeCount=1.

O fix da frente behavior limpa somente `chatUpdatesStopped` quando o workspace atual está READY, o stream está OPEN e todos os threads atuais estão READY. A revisão fria desta frente conferiu que erro de transcript marca o thread unavailable antes de emitir o aviso; os demais avisos e falhas permanecem. O [pós-fix 45223658325](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45223658325), snapshot `534353b33a4aff338fda4f1da696c9768b9ed3cb`, teve **13 PASS/0 retries**, noticeCount=0, mesmo rascunho e writes=[].

Os PNGs OPEN antes/depois foram abertos nesta frente. Após a correção, o aviso desaparece e composer/ação voltam completos ao viewport 390×844. Esse PNG é byte-idêntico ao frame anterior à interrupção da primeira composição: SHA-256 `614a2c424601d0aeda4689d660d367656e3c0f37408438904904b0972786c946`. A igualdade vale para esse checkpoint. O controle é HTTP finito mantido num read original, e não uma sessão SSE persistente ou Microsoft live. Os detalhes de autoria e os testes unitários pertencem a `behavior.md`/`behavior-evidence.json`.

## SUP-03: catálogo autorizado e arquivo visível

O novo fluxo usa os clientes e produtores existentes:

| Classificação | Operação | Identidade | CAS explícito |
|---|---|---|---|
| Contract | `domain.page.CAP14` | `contracts[].id` | `versions["contracts:" + id]` |
| Supplier | `domain.page.CAP27` | `suppliers[].id` | `versions["suppliers:" + id].version` |
| Quote / Signed PO | `domain.page.CAP25` | `requests[].number` | `versions["requests:" + number].version` |

As opções apresentam nome/referência do negócio. CAS zero é válido; CAS ausente/inválido, IDs duplicados ou contexto divergente bloqueiam o formulário. A versão não é inferida de asset, hash ou seleção opaca.

A leitura é abortada/descartada quando owner, sessão, superfície ou classificação deixam de corresponder. A03 projeta o stamp técnico legado de seis campos, que são comparados; transporte e caller cercam o owner/Team completo. Quando A01 também projeta Team, esse vínculo é conferido.

Durante upload, o formulário permanece montado e desabilitado, com progresso visível. Um 409 limpa o alvo, nomeia o registro em conflito e orienta reler/rever a seleção. Erro na leitura do arquivo registra apenas o nome sanitizado do erro. Após atualização de fontes, o mesmo File selecionado pela pessoa é restaurado no input nativo via FileList. Se o navegador recusar a restauração, arquivo e nome são limpos juntos e a interface pede uma nova escolha. Não há upload automático de um arquivo que desapareceu do controle.

A copy EN/pt-BR orienta escolher um registro acessível e informa a verificação antes do anexo. O texto deixou de expor instalação, revisão ou detalhes de servidor que não ajudam essa escolha.

A grade desktop organiza classificação e destino/Refresh na primeira linha; arquivo e ação, na segunda. A pilha estreita permanece em uma coluna. As seis variantes são capturas do mesmo checkpoint autorizado: claro/escuro em 1440, 390 e 320 px. Elas executam no lane padrão, sem `SF_WORKFLOW_VISUAL_CAPTURE`, cenário adicional ou mutação para produzir imagem.

Nas capturas alinhadas e depois na copy final de Files6, a linha inferior de classificação, destino e Refresh ficou em **469,0625 px** nos dois temas, **delta 0 px**. Os controles têm 44 px; o seletor de destino mede 626,390625 px no desktop. Os seis originais da copy final foram inspecionados: a grade não sobrepõe controles, não gera overflow horizontal, e todo o formulário cabe em 320×900.

O guia de dashboard consolidado pela frente root documenta **Registro de destino**, **Atualizar registros**, progresso, arquivo preservado e seleção após aceitação. O conteúdo foi conferido no blob `9423c25b422790f50f3da8cb70ecb629d9f88fa0`.

## Diagnósticos de Files preservados no registro

| Run | Resultado observado | Diagnóstico e tratamento |
|---|---|---|
| [45212950301](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45212950301) | 3 PASS/1 falha | O teste tentou attachments na projeção CAP27 de lista, que não os expõe. POST/CAS já tinham passado. A prova passou ao detalhe original. |
| [45216741705](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45216741705) | 3 PASS/1 falha | Depois das três capturas escuras, o helper tentou o controle de tema oculto em 320 px. Passou a restaurar desktop antes da ação nativa. As imagens também revelaram o desalinhamento desktop, corrigido em `0d696b8`. |
| [45221239596](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45221239596) | 3 PASS/1 falha | Seis imagens, File, scanner, bytes e CAS 2→3 passaram. O assert buscava os nomes dentro de SfRecordDetail; SfBoundAssets é seu irmão no fornecedor. O DOM já continha ambos os anexos. O escopo foi corrigido em `767d02b`. |
| [45225118306](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45225118306) | 3 PASS/1 falha | A navegação do download descartou o corpo no cache Chromium antes de response.json. O observador passou a ler o APIResponse do mesmo forwardOnce, sem segunda GET/reemissão/replay. |
| [45227729177](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45227729177) | 3 PASS/1 timeout | Todos os checks de upload/captura/anexos passaram; a confirmação de delete chegou em aproximadamente 178 s e o limite de 180 s encerrou a espera do POST. Maior step individual: download de 9,9 s. A jornada agregava objetivos independentes. |
| [45231809766](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45231809766) | 4 PASS/1 falha | DOC de evidência/revogação passou em 146400 ms. O novo upload tentou consumir pela segunda vez o ticket único first/suppliers e recebeu 404 antes da UI. O tempo de 180075 ms da falha inclui o afterEach diagnóstico, não upload. |

As correções mantiveram os deadlines, retries, bytes, scanner e oráculos de autorização. Falhas do observador ou da preparação do teste não foram transformadas em falhas do produtor, nem em aceite da jornada que ainda não completou.

## Mapa dos oráculos após separar os casos

O commit `ad01060d4acdcffa5914691cc277426db1f68bd9` separou a jornada em dois testes do mesmo `operations.spec.ts`. Cada um faz login e cria seu próprio supplier, UUID e arquivo. Os casos mantêm **180 s no lane padrão e zero retries**. O modo visual opcional anterior conserva seu limite anterior e não foi usado nesse fechamento.

O commit `7155676474f17c72d017b4f6aea7ffa5a8762404` completa o isolamento de autenticação: `wp04/host.ts` emite o slot `suppliers-upload` pelo mesmo `account.identity.enroll()`; só o caso upload o consome. Principal, política, guards, exclusão one-shot após 303 e manifesto privado em modo 0600 permanecem iguais. Cookies/tickets não são compartilhados entre os testes.

| Oráculo anterior | Destino | Relação preservada |
|---|---|---|
| Supplier nativo, primeiro arquivo/scanner, CAP27 e asset | Ambos, com fontes próprias | Mesma resposta original e CAS inicial+1 de cada caso. |
| GET de link pela UI, query/HMAC/nome/bytes | OP-DOC-UPLOAD-01 | APIResponse da mesma requisição; token/query intactos. |
| Catálogo, seleção humana, File após refresh, segundo arquivo, seis PNGs | OP-DOC-UPLOAD-01 | Bytes distintos, mesmo registro/contexto e CAS inicial+2. |
| Primeira leitura e reload do catálogo em segunda aba | OP-DOC-UPLOAD-01 | Fonte encontrada pelo nome original; nenhuma dependência de outro teste. |
| Dois anexos, referência do supplier, delete CAS+2 e link 403 | OP-DOC-UPLOAD-01 | Mesmo URL assinado efetivamente baixado antes da exclusão; Access denied depois. |
| Admissão, schema inválido 400 sem efeito, schema válido, extração e confirmação | OP-DOC-01 | Bodies, lista, refs/digests, intervalo UTF-16, valor42USD e sequência dos quatro POSTs. |
| UI59, excerpt/ref confirmados, UI60 e discovery 403 restrito | OP-DOC-01 | Fonte legível, política original, nenhum grant adicional. |
| Delete em segunda aba com fonte aberta;403/409/503 e zero texto/candidatos/fonte | OP-DOC-01 | CAS+1 corresponde ao único upload desse caso; href original confrontado com origin/path/asset admitidos. |

A comparação indireta entre o asset de duas URLs passou a confrontar diretamente o asset admitido com o URL da apresentação original, exigindo também a mesma origem e o mesmo caminho. As demais relações continuam presentes. A revisão fria independente da frente behavior conferiu variáveis e observers; Files7 expôs a cardinalidade adicional do host, fora daqueles dois paths. O novo slot corrige essa preparação, preservando a inscrição única.

Files7 confirmou Import em 159058 ms, DOC em 146400 ms, Export em 34947 ms e Scenario em 292865 ms, todos passed/retry0. Esses tempos descrevem uma execução nativa e não são um benchmark populacional. O aceite conjunto após o slot independente é registrado a seguir.

## Qualificação nativa final

O [run 45236527715](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45236527715) encerrou com **5 PASS, 0 failures e 0 retries**. Job `137909593899` e cleanup `137918995064` concluíram com sucesso. Snapshot: `43cd2ac8684d97ea776fa8150be08f1d14d16fa2`; fonte composta: `a4fb57789f438385cadcb978d1f00754e63002af`; árvore da fonte: `a01b789995bec65a5669ecdc6d56377dd551c41c`.

O snapshot altera somente `.ci-run.json`, com `runner=playwright`, `e2e/playwright.production.config.ts` e argumento único `e2e/sucafina/operations.spec.ts`. O ambiente usa strict/prod. O workflow qualificou o ClamD de loopback original. Não houve novo limite, retry, produtor substituto ou flag extra de captura.

| Caso original | Resultado | Duração observada |
|---|---|---:|
| OP-IMPORT-01 | PASS, retry 0 | 150905 ms |
| OP-DOC-01 — evidência e revogação | PASS, retry 0 | 138265 ms |
| OP-DOC-UPLOAD-01 — catálogo, bytes e entrega | PASS, retry 0 | 126039 ms |
| OP-EXPORT-01 | PASS, retry 0 | 30355 ms |
| OP-SCENARIO-01 | PASS, retry 0 | 288227 ms |

O caso upload entrou com seu próprio enrollment `first/suppliers-upload`, emitido e consumido uma vez pelo host original. O principal e a política continuam os mesmos. O receipt nativo do catálogo registra o fornecedor **SUP-00003**, CAS explícito **2→3**, HTTP 200, scanner configurado, seleção do File preservada após a leitura, `manualRecordId=false`, `manualVersion=false`, `responseSubstituted=false` e `automaticRetries=0`.

O receipt final de entrega registra os dois nomes de arquivo e o asset admitido, bytes exatos do download assinado e **403** após exclusão para o mesmo acesso. `schemaOrConfirmationCommands=[]` mantém esse caso isolado da jornada de evidência. OP-DOC-01, com fornecedor/arquivo próprios e CAS inicial+1, conserva schema, candidato e confirmação com valor **42 USD**, intervalo UTF-16 **7–9** e refs/digests originais. Após a revogação, o recibo registra **asset 403, evidence 409, candidates 503 e discoveryCount=0**. UI60 restrita nesse caso permanece uma negativa; o preview positivo é qualificado pelo caso OP-SCENARIO-01 separado.

As **seis capturas SUP-03 finais** foram abertas em seus pixels originais: claro/escuro em 1440, 390 e 320 px. Classificação, destino e Refresh terminam em **y=469,0625** no desktop dos dois temas, delta **0 px**; os controles têm 44 px. Em 320×900, o formulário inteiro permanece visível e em uma coluna. Não houve sobreposição ou overflow horizontal nos checkpoints. O label longo do fixture continua no select nativo; o teste não afirma que todo comprimento é inteiramente visível com o seletor fechado.

**Artifact:** `14851385585`, `playwright-ubuntu-24.04-1`, **33268762 bytes**, SHA-256 **`ee520812652c5bdf7fc3e19853857b0064bfb29a1687089421c96f3811a415ab`**. O hash do ZIP baixado coincidiu com o digest anunciado pelo GitHub. Casos, recibos e seis hashes/dimensões estão em `system-evidence.json`. Os tempos são observações desta execução, sem alegação de benchmark estatístico.


## Paletas produzidas pelo writer original

O gate composto em `139f42eac48bfb525d42be666556e00b4475f09e` detectou cinco gerados defasados. O [run 45215146648](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45215146648), snapshot `75ae7c7a4cca4d9e5edd292287c8f298dcb262ad`, executou `packages/app-shell/script/orchestra-palettes.ts` pelo AppProcess/omni no workflow original. O wrapper existiu apenas no snapshot de CI.

Foram cinco arquivos alterados, com `first-paint.css` e `swatches.css` preservados. A segunda execução comprovou **paridade byte a byte dos sete arquivos**. Os 104 chunks base64 do log foram recompostos e enviados ao GitHub como blobs; cada SHA Git retornado coincidiu com o recibo do runner. A geração e os arquivos não foram refeitos manualmente ou executados localmente.

| Arquivo | Blob Git | Bytes | SHA-256 |
|---|---|---:|---|
| palette-amoled.css | `4abeadd5ba188479905c5dde9a7a9ecbe759f349` | 123818 | `cd0660d10132067892bcb7569eb1177b690db4e1a4d5f53cd5e4aac5fa2edf93` |
| palette-github.css | `667e70cd4706282d28d24b352a3cc7ebc68b5679` | 124988 | `a94302c2577a4bf2c3a161043ad822e87a5e70a927eddeb72f6b8cc39ea42b15` |
| palette-graphite.css | `b73060334f21e17c1bd3e53e620830f4174194b2` | 125192 | `bf9c96aff3bd91969a2e823903eb1cc6a1d5d148e7b13664bca03a0477c7025f` |
| palette-gruvbox.css | `fbcee956ce378baaf9addb645723a5b61d27301b` | 124641 | `9eb595d86ac68639905d1a088c1fc3b44ee670620fa61e3675b8e6d83ce75543` |
| palette-nord.css | `8f72a795f0d72eb8f275baf6d050dae1d8fc8664` | 122436 | `921a36216a89c782d3b7cd99af6c194d44ed0a6101abe21c25335f9abb4714fc` |

O recibo do writer e a equivalência de SYS-02 têm escopos específicos. O gate do head integrado, registrado pela frente root, continua sendo a qualificação da composição entregue.

## Originais inspecionados e limites

`system-evidence.json` registra os **55 registros de imagens realmente abertas**, com possíveis pixels repetidos entre runs: origem, caminho dentro do artifact, dimensões, SHA-256 e estado diagnóstico/qualificado. Inclui os estados anteriores ao alinhamento SUP-03 e à correção BA-02. Marcar uma imagem como vista não a transforma em PASS. Nenhuma imagem foi recortada, redesenhada, sintetizada ou recolorida.

A revisão conferiu continuidade do vidro, inset/padding, baseline de campos/ações, reflow, compactação de estados vazios, mensagens de recuperação e foco. Os checkpoints aceitos não apresentaram novo bloqueio de clipping, sobreposição ou overflow horizontal. Os artifacts e suas somas completas estão no manifesto; links de execução preservam a origem de cada resultado.

A cobertura não inclui todos os wallpapers, todas as paletas, zoom de 200–400%, leitores de tela, teclado virtual, todos os papéis de autorização, plataformas nativas ou todos os comprimentos de nomes. Teams/RAG usam UI de produção e HTTP fixtures; Files usa produtores nativos e scanner qualificado. Atrasos controlados provam descarte de resposta obsoleta, não uma taxa de flakiness. RAG não qualifica Ask ou qualidade de recuperação semântica. O caso SUP-03 exercita Supplier/TXT; Contract/Quote/SignedPO, PDF/DOCX, 409 e recusa da restauração pelo navegador ficaram em revisão de fonte, sem um caso nativo forçado correspondente. A paridade das paletas comprova consistência dos gerados, não inspeção visual de todas elas.
