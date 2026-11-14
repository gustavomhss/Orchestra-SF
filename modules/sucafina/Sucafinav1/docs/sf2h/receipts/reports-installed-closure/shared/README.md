# Handoff de assembly — missão25 / Reports

Estado: proposta inerte completa de código, ainda não aplicada nem testada. Consumidor autorizado: sessão23. O produtor mantém a PR27 e seus commits anteriores.

## Base e conteúdo

A auditoria partiu de `sf2-stack@d8ab1d3321a76870ed3092ba043fe1b5781a2c23` e repetiu as leituras pelo GitHub MCP em `0ce090d7d1d4399d77b435debd59eb7cc903c202`. Os seis arquivos existentes alterados possuem os mesmos blobs nos dois SHAs. Os dois módulos novos estavam ausentes no último SHA. `manifest.json` contém cada blob e SHA256, preimage/postimage integral e hash do patch unificado. O produtor Reports permanece `astra-wp07`/PR27, preservando W1 `567727670b4039c316a12718c84b43b57f4fa19d` e seu sucessor W2 `bc587cebc9f2e46e48a3e828b83fe15cfaf2fc45`. W2 é o head de código produtor a consumir; nenhum desses SHAs é apresentado como composição instalada aprovada.

A sessão raiz conferiu adicionalmente pelo GitHub MCP `sf2-stack@0d5bd54a109774d4e3296e00c276be341fe39b00`, árvore `c056602b26eb044fe5e2e18a5a05bd2bd2d5a83a`: as seis preimages permanecem idênticas, os dois helpers novos continuam ausentes e o blob de `review-services.ts` permanece igual. Esta conferência acrescenta evidência de compatibilidade; não substitui a baseline nem significa ACK de Reports pela sessão23.

Somente a sessão23 deve aplicar alterações reais em `apps/cli`. Antes de integrar, confira o blob de cada preimage no head de destino. Se divergir, reconcilie os hunks e mantenha todas as alterações concorrentes; não substitua um arquivo inteiro por uma postimage antiga. Os arquivos integrais são evidência e material de revisão. Neste recibo, todas as preimages e postimages integrais têm sufixo `.txt` e mantêm exatamente os bytes e hashes originais. Os campos `preimage`/`postimage` de [manifest.json](manifest.json) apontam para essas imagens inertes; os campos `path` e os caminhos internos de [mission25-reports-shared.patch](patches/mission25-reports-shared.patch) continuam sendo os paths reais do produto.

## Alterações propostas

| Caminho em `apps/cli/src/sucafina-product/` | Mudança |
| --- | --- |
| `business-services.ts` | Cria ponte estável e vincula os três callbacks C05 reais na construção de Collaboration; descarte invalida a ponte. |
| `extended-business-services.ts` | Após criar a aplicação real de Review, vincula seus produtores e registra ausência de autoridade de destinatário distinto. |
| `extended-http.ts` | O formulário Generate Report existente abre a preparação de todos os tópicos selecionados via `dashboardServices.discover`; conserva ano, ordem e origem. Inclui principal autenticado no bootstrap e aceita seletores de histórico C05 limitados. |
| `extended-browser.ts` | Monta a UI C05 da PR27 após leitura real da reunião; conserva seletores somente na mesma revisão; limpa reunião, discussão, pendências e navegação na revogação/logout ou redirect real ao login. |
| `extended-source-links.ts` | Em navegação de Review, aceita continuidade histórica somente com referência atual real novamente autorizada, mesma encarnação/campos/período, e deriva o link da origem. |
| `review-history.ts` | Produz `currentRef` pelo resolver canônico Dashboard, mantendo referência/projeção capturadas intactas e repetindo provas da captura/fonte antes do retorno. |
| `review-collaboration-binding.ts` | Novo adaptador de vinculação única; callbacks indisponíveis recusam e trocas de produtor invalidam operações em andamento. |
| `review-collaboration.ts` | Novo adaptador de autoridade que reutiliza ReviewApplication, C08 e `createReviewAnswerSource`; a lease de transação não concede acesso e não altera o fingerprint persistido C06. |

### Correção estática da agenda com múltiplos tópicos

A revisão do helper E2E encontrou que `dashboardServices.discover` emite o ID local `dashboard` para cada página. Reunir três tópicos com esse mesmo ID produziria uma seleção rejeitada por IDs duplicados antes da preservação. O bootstrap de Generate Report agora atribui somente o ID estável `report:<page>` a cada tópico autorizado. A lista de páginas normalizadas já rejeita duplicatas. Seletores de fonte, tópicos, períodos, `recordRefs`, ordem e conteúdo continuam idênticos; os títulos canônicos continuam `Budget`, `Projects` e `Hot Topics`, conforme o produtor da seleção. A preparação de sucessora reutiliza o `section.id` capturado, preservando essa identidade. Este ajuste substitui o patch anterior de SHA256 `d401f15b192d6a51f5e9e91fd50840a350f4c6715b2d3854f9448e88efa9d308`; o hash vigente está no manifesto. A correção foi conferida por leitura estática do shape e ainda não foi executada.

## Autoridade e limites

O diagnóstico antigo de aplicação/agenda ausentes não se aplica. `host-context.ts` já compõe `createSfExtendedBusinessServices`, `createSfReviewServices` e `createReviewApplication`, além de encadear o HTTP e HTML de produto. O defeito encontrado é concreto: Collaboration era criado sem `authorizeReviewThreadContext`, `reviewAnswerSource` ou `reviewRecipientAuthority`; o formulário legado de Reports continuava direcionando para exportação corrente. A proposta modifica esses pontos, sem tocar em Memory, Decisions, identidade, grants, captura ou conteúdo dos registros.

A lease local cobre C05 simples de registros Dashboard: lê a revisão pela porta real, confere o recibo C08 da revisão imutável, autentica o Request original nos snapshots e compara fontes/ACLs/encarnações protegidas. Nenhuma coleta ou emissão de fonte ocorre no fence. A inclusão de dados/identidades na lease é temporária, durante uma chamada; não transforma revisões globais ou dados irrelevantes em dependências persistidas da confirmação C06. Edições de threads e confirmações continuam nos produtores de Colaboração, com seus próprios CAS, idempotência e histórico.

Um destinatário diferente do principal real exige `ReviewThreadRecipientAuthority.authorize` e `checkAtCommit` próprios do host, ligados ao destinatário, caller, pin imutável e todas as fontes/campos/períodos atuais. A lista do diretório não satisfaz essa interface. O perfil instalado `local-operator` autentica uma única pessoa; novo enrollment produz outra credencial para a mesma identidade. Este bundle não inventa um segundo usuário e não amplia alçadas. Por isso, a parte de destinatários distintos dos E2Es continua bloqueada até composição legítima do provedor de identidade/ACL por seu owner.

C05 contendo comentários capturados, decisões, outcomes externos, sensibilidade, documentos/cálculos ou fontes não Dashboard é recusado pela lease local. Esses casos exigem lease protegida do respectivo produtor; não recebem autorização positiva por ausência de callback. Esta limitação é um gap explícito, e não aceite de todos os critérios WP07.

O title/format do formulário legado fica como metadata do bootstrap. O request C05 de geração não possui campo title; nenhum título customizado é declarado incorporado aos bytes DOCX/PPTX. Os limites de ano 2024–2027 já existem no formulário e em `runtime/reports.ts`.

## Contrato HTTP consumido pela UI

As operações abaixo reutilizam o POST autenticado existente em `/sucafina/dashboard?sf=<operação>`, com Origin/same-origin e a admissão humana atual. Nenhuma URL ou principal informado pelo browser concede autoridade.

| Operação | Payload essencial |
| --- | --- |
| `review-thread-context` | `{reviewRef, sectionId, basis}` → pin C05 exato |
| `collaboration-recipients` | `{}` → diretório filtrado; não é prova de ACL das fontes |
| `collaboration-storage-version` | `{namespace: "threads" ou "confirmations"}` → CAS corrente |
| `collaboration-thread-create` | `{draft: {kind: "clarification", sourceRef, sourceIncarnation, observedVersion, period, evidenceRefs, reviewContext, recipientRef, body}, mutation}` |
| `collaboration-thread-read` | `{id}` |
| `collaboration-thread-reply` | `{id, body, mutation}` |
| `collaboration-thread-edit` | `{id, messageId, expectedVersion, body, mutation}` |
| `collaboration-thread-history` | `{id, messageId, incarnation, version}` |
| `collaboration-answer-prepare-message` | `{questionId, messageId, incarnation, version}` → observação, escopo e answerRef |
| `collaboration-answer-confirm` | `{questionId, answerRef, mutation: {expectedStorageVersion, idempotencyKey, observationRef, observedSourceVersion, expectedScopeFingerprint}}` |
| `collaboration-answer-read` | `{questionId}` → resposta confirmada reautorizada |

`mutation` de thread contém `expectedStorageVersion` e `idempotencyKey`. Toda seleção de mensagem/encarnação/versão no URL é somente seletor e passa pelos produtores de histórico e reuso. A atualização da fonte 1320→1400 pode oferecer um link atual e uma revisão sucessora explícita; não reescreve C05, notas longas, 25 projetos nem mensagens antigas.

## Aceite solicitado à sessão23

1. Consumir os commits de Reports da PR27, preservando o histórico, e os hunks compartilhados revisados sobre o head real; a alteração de label em `meeting.ts` deve ser reconciliada como hunk mínimo com a versão composta atual.
2. A sessão23 publica somente W/tree da composição real, blobs/postimages efetivamente aplicados e ACK com dependências indisponíveis e critérios impactados. A sessão23 não recebe autorização para dispatcher ou CI.
3. Após esse ACK, o dispatcher WP07 já autorizado produz S exclusivamente de request e executa somente `packages/app-shell/e2e/sucafina/reports.spec.ts`, seus quatro casos nominais. Deduplicar por candidato e manter W como a composição efetiva comprovada.
4. O executor WP07 registra cada job/run/result e falha/gap de typecheck/grafo sem alterar configuração compartilhada silenciosamente. Enquanto a composição e os quatro fluxos não forem observados, manter `NOT_RUN`/`BLOCKED`.

Foi feita apenas leitura remota via GitHub MCP, construção de arquivos, reconciliação de hashes e inspeção textual do patch. Não houve teste local, servidor, browser, Actions, fixture positiva, skip, redução de assertions, prova nativa, renderização visual ou publicação remota por este subtask. Inspeção OOXML eventual não comprova renderização visual.

## Imagens integrais deste recibo

Cada link abaixo é relativo a este diretório `shared/`. O patch de inclusão no grafo E2E fica no bundle irmão [shared-typecheck/MANIFEST.json](../shared-typecheck/MANIFEST.json); sua configuração também permanece inerte em `.json.txt`.

| Path real do produto | Preimage inerte | Postimage inerte |
| --- | --- | --- |
| `apps/cli/src/sucafina-product/business-services.ts` | [business-services.ts.txt](preimages/apps/cli/src/sucafina-product/business-services.ts.txt) | [business-services.ts.txt](postimages/apps/cli/src/sucafina-product/business-services.ts.txt) |
| `apps/cli/src/sucafina-product/extended-business-services.ts` | [extended-business-services.ts.txt](preimages/apps/cli/src/sucafina-product/extended-business-services.ts.txt) | [extended-business-services.ts.txt](postimages/apps/cli/src/sucafina-product/extended-business-services.ts.txt) |
| `apps/cli/src/sucafina-product/extended-http.ts` | [extended-http.ts.txt](preimages/apps/cli/src/sucafina-product/extended-http.ts.txt) | [extended-http.ts.txt](postimages/apps/cli/src/sucafina-product/extended-http.ts.txt) |
| `apps/cli/src/sucafina-product/extended-browser.ts` | [extended-browser.ts.txt](preimages/apps/cli/src/sucafina-product/extended-browser.ts.txt) | [extended-browser.ts.txt](postimages/apps/cli/src/sucafina-product/extended-browser.ts.txt) |
| `apps/cli/src/sucafina-product/extended-source-links.ts` | [extended-source-links.ts.txt](preimages/apps/cli/src/sucafina-product/extended-source-links.ts.txt) | [extended-source-links.ts.txt](postimages/apps/cli/src/sucafina-product/extended-source-links.ts.txt) |
| `apps/cli/src/sucafina-product/review-history.ts` | [review-history.ts.txt](preimages/apps/cli/src/sucafina-product/review-history.ts.txt) | [review-history.ts.txt](postimages/apps/cli/src/sucafina-product/review-history.ts.txt) |
| `apps/cli/src/sucafina-product/review-collaboration-binding.ts` | Ausente (arquivo novo) | [review-collaboration-binding.ts.txt](postimages/apps/cli/src/sucafina-product/review-collaboration-binding.ts.txt) |
| `apps/cli/src/sucafina-product/review-collaboration.ts` | Ausente (arquivo novo) | [review-collaboration.ts.txt](postimages/apps/cli/src/sucafina-product/review-collaboration.ts.txt) |
