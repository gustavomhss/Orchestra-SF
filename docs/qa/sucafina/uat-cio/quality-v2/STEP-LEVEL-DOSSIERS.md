# Dossiês de execução de alta fidelidade — UAT CIO / Sucafina

**Estado:** design de aceitação, **NENHUMA execução**. Estes oito casos são uma camada de profundidade adicional, não substituem as 185 histórias do v1. O executor deve vincular ator/role/grant ao tenant e produtor reais, nunca assumir que dados JSON equivalem a seed.

Contrato do executor: cada linha exige prova da ação, do **resultado esperado naquela etapa** e do **estado da fonte**, com recibo ou evidência explícita de no-commit. Saídas com `BLOCKED` não contam como PASS.

## QA2-001 — O orçamento que o CIO lê às 08h precisa ser o mesmo orçamento que Finance publicou

**Prioridade:** P0 · **Protagonista:** CIO · **Atores de apoio:** FINANCE, BUDGET_OWNER, AUDITOR · **Condição:** `BASELINE` · **Status:** NOT_RUN

**Produto / superfícies:** CAP01, CAP03, CAP17, CAP18, CAP22, CAP23, UI45, UI46, UI47 · **Jornadas:** J01, J02, J05, J08
**Fixtures:** `BUD-2026-IT`, `OPEX-LIC-01`, `FX-EURUSD-SEP26`

**Pré-condições que o QA deve comprovar**

- Fonte oficial publicada por produtor real com objeto/revisão estáveis; exportar estado BEFORE e registrar snapshot do permission set.
- Duas hipóteses independentes, não duas mutações sobre a mesma versão; um 3º ator apenas leitor.
- Não assumir implementação disponível apenas porque UI/CAP aparece no catálogo.

**Caminho de execução e testemunhos — prova por etapa**

| # | Ator | Ação | Resultado esperado | Evidência exigida |
|---:|---|---|---|---|
| 1 | FINANCE | Abrir budget/actual/forecast da versão oficial e competência 2026 | budget=USD 600000; actual Jan-Set=USD 400000; open=USD 190000; outlook=USD 590000 | captura com sourceRef, revision, currency, unit e período |
| 2 | BUDGET_OWNER | Criar hipótese A copiando a linha OPEX-LIC-01 de USD72000 e alterar para USD84000 | A=USD 602000; A vs base=+USD12000; A vs budget=-USD2000 | novo versionRef, diff da linha e recibo save |
| 3 | FINANCE | Criar hipótese B independente com licença USD78000 | B=USD 596000; B vs base=+USD6000; B vs budget=+USD4000 | revisão B distinta de A; comparação independente |
| 4 | CIO | Abrir dashboards e BI de A/B sem publicar a versão official | rótulos A/B explícitos; official preserva 590000, actual 400000 | reread do produtor original por terceiro |
| 5 | FINANCE | Retirar FX EUR/USD aplicável da hipótese de verificação, mantendo linha EUR | valor EUR fica INDETERMINADO/incompatível, nunca 0 USD | captura drilldown, versionRef e reason code |
| 6 | AUDITOR | Tentar sobrescrever linha official stale ou sem grant | negação/conflict antes do commit; official imutável | HTTP/status do produtor, audit do no-commit e hash BEFORE/AFTER |

**Oráculos independentes**

- 600000-(400000+190000)=10000 de folga na base
- 590000+(84000-72000)=602000
- 590000+(78000-72000)=596000

**Contraprovas/falhas obrigatórias:** `PERMISSION_REVOKE`, `SOURCE_REVISION_STALE`, `MISSING_FX`, `SECOND_SESSION`

**Release:** Nenhuma além das portas instaladas no candidato C

---

## QA2-002 — Uma cotação inelegível não vira PO por atalho entre Requester, Buyer e Holder

**Prioridade:** P0 · **Protagonista:** REQUESTER · **Atores de apoio:** BUYER, APPROVER, FINANCE, CIO, AUDITOR · **Condição:** `BASELINE` · **Status:** NOT_RUN

**Produto / superfícies:** CAP24, CAP25, CAP26, CAP27, UI33, UI35, UI38, UI39, UI40 · **Jornadas:** J04, J06, J08
**Fixtures:** `PR-32000`, `FX-EURUSD-SEP26`, `CASE-EDI-01`

**Pré-condições que o QA deve comprovar**

- Sessões realmente separadas de Caio, Pedro, Gabriel e Sofie com papel/grant específicos e holder da etapa consultado no produtor, não inferido por nome.
- Cotação C está inelegível e o supplier status é verificado no momento da transição, não importado de texto.
- Snapshots BEFORE incluem PR, sourcing, PO, contador de receipts, suppliers e audit.

**Caminho de execução e testemunhos — prova por etapa**

| # | Ator | Ação | Resultado esperado | Evidência exigida |
|---:|---|---|---|---|
| 1 | REQUESTER | Criar PR-32000 com valor solicitado de USD32000 e submeter | somente PR em estado de submissão admitido; nenhuma PO emitida | requestRef, owner, version, receipt e status |
| 2 | APPROVER | Entrar na fila usando conta Gabriel e aprovar apenas quando holder atual | aprovação avança estado exato do produtor; audit de actor e stage | holder real antes/depois, decisionRef e receipt |
| 3 | BUYER | Registrar A=USD32400, B=EUR28000 e C=USD29000 tecnicamente inelegível | três ofertas preservam moeda, eligibility, supplierRef e sourceVersion | quoteRefs, FXRef, sourceRefs, offer comparisons |
| 4 | FINANCE | Reconciliar B com EUR/USD=1.08 efetivo na competência | B=USD30240, nunca converter sem FX temporal válido | cálculo independente 28000*1.08 e prova de versão FX |
| 5 | CIO | Registrar escolha justificada de B em CASE-EDI-01 sem executar mudança | choiceRef não é PO nem procurement approval | caseRef, choice, domain state unchanged |
| 6 | BUYER | Preparar sourcing e avançar por comando original autorizado | transição tem sourceVersion, holder e estado de negócio correto | receipt de prepare/review/apply e reread |
| 7 | APPROVER | Aprovar no estágio correspondente e emitir internamente apenas por porta original | exatamente um PO-issued interno; sem afirmar envio externo a ERP | PORef, stage, idempotency receipt e audit |
| 8 | BUYER | Usar URL/corpo de aprovação de Gabriel e repetir mesma tentativa com payload alterado | negação e no-commit; sem autoaprovacão nem duplicata | 403 se contrato assim definir; audit no-commit e contagem |
| 9 | FINANCE | Alterar FX/validade de fornecedor depois da comparação, antes da confirmação | nova seleção exige revisão de fonte/recálculo, ou falha fechada | diff sourceRevision, resultado e status sem commit |

**Oráculos independentes**

- EUR28000 * 1.08 = USD30240
- USD29000 inelegível não é a escolha válida apesar de menor preço
- um receipt de PO interna; 0 envio ERP não integrado

**Contraprovas/falhas obrigatórias:** `WRONG_HOLDER`, `INELIGIBLE_VENDOR`, `STALE_FX`, `DELIVERY_LOSS`, `REPLAY_PAYLOAD_DRIFT`

**Release:** A etapa exata PR→sourcing→PO deve ser relida do produtor instalado; nenhuma transição hipotética vira efeito

---

## QA2-003 — A importação com confirmação perdida não pode aplicar duas vezes

**Prioridade:** P0 · **Protagonista:** FINANCE · **Atores de apoio:** AUDITOR, SECOND_FINANCE · **Condição:** `BASELINE` · **Status:** NOT_RUN

**Produto / superfícies:** UI55, UI56, UI57, UI68, CAP18, CAP23 · **Jornadas:** J02, J03, J08
**Fixtures:** `OPEX-LIC-01`, `BUD-2026-IT`, `IMPORT-OPEX-VALID.xlsx`, `IMPORT-OPEX-ADVERSARIAL.xlsx`

**Pré-condições que o QA deve comprovar**

- Instalar versão Planner de QA com linha renewal USD72000 e linha unchanged USD518000, validando ids reais retornados pela aplicação.
- Validar o XLSX contra o parser do SHA C e a lista de destinos disponíveis; arquivo de exemplo não prova admissão.
- Capturar SHA256 do arquivo, versão e tokens de revisão de cada linha ANTES do preview.

**Caminho de execução e testemunhos — prova por etapa**

| # | Ator | Ação | Resultado esperado | Evidência exigida |
|---:|---|---|---|---|
| 1 | FINANCE | Upload do XLSX e seleção do destino da instalação com versão exata | admissão retorna fileRef real, formato aceito e identidade de origem | sourceDigest, admittedRef e resposta |
| 2 | FINANCE | Executar Preview e examinar as alterações célula/linha | renewal 72000→84000; unchanged 518000→518000; preview domainApplied=false | manifestRef, versão, digest, change diff, status |
| 3 | AUDITOR | Reabrir a fonte Planner antes de Apply | renovação continua 72000 e linha unchanged continua 518000 | reread com tokens iguais a BEFORE |
| 4 | SECOND_FINANCE | Alterar a base entre Preview e Apply em outra sessão | Apply do preview stale é negado; novo preview obrigatório | CAS stale, before/after e audit no-commit |
| 5 | FINANCE | Criar preview novo; executar Apply uma vez e perder apenas a resposta HTTP | o produtor aplica no máximo uma vez; não inferir falha do efeito pelo cliente | request timeline e idempotencyKey |
| 6 | FINANCE | Consultar o manifest/receipt pelo ID original sem repetir Apply | um receipt para um efeito; renewal=84000, unchanged=518000 | receiptRef, real source reread, version diff |
| 7 | AUDITOR | Reenviar mesmo attempt com payload divergente e testar XLSX adversarial | replay diferente falha; inválido não aplica parcialmente | response code conforme contrato; no-commit e hash |

**Oráculos independentes**

- preview é side-effect-free
- uma aplicação por identidade/revisão admitida
- linha unchanged preserva USD518000
- nenhum registro extra é criado por resposta perdida

**Contraprovas/falhas obrigatórias:** `LOST_RESPONSE_AFTER_COMMIT`, `STALE_PREVIEW`, `INVALID_XLSX`, `DUPLICATE_ID`, `REPLAY_DIFFERENT_PAYLOAD`

**Release:** Exige producer real de import e uma forma controlada de abortar só a entrega, não fabricar receipt

---

## QA2-004 — Reunião do CIO sobre 25 projetos permanece auditável após alterações e revogação

**Prioridade:** P0 · **Protagonista:** CIO · **Atores de apoio:** LEADER, AUDITOR, RESTRICTED_VIEWER · **Condição:** `BASELINE` · **Status:** NOT_RUN

**Produto / superfícies:** UI47, UI48, UI49, UI50, CAP09, CAP10 · **Jornadas:** J05, J06, J08
**Fixtures:** `REV-EXEC-NOV/R1`, `P-001`, `P-025`, `P-004`

**Pré-condições que o QA deve comprovar**

- O conjunto P-001…P-025 existe de fato no produtor (não apenas no JSON da fixture), com ordens e notas longas.
- CIO possui grants necessários para preservar/gerar relatório; leitor restrito tem acesso temporário e delimitado.
- Capturar snapshot dos 25 campos e lista de versões antes da reunião.

**Caminho de execução e testemunhos — prova por etapa**

| # | Ator | Ação | Resultado esperado | Evidência exigida |
|---:|---|---|---|---|
| 1 | CIO | Selecionar pauta multi-período e preservar R1 | todos os 25 projetos aparecem uma vez, com sourceRef, competência e ordem | R1 reference, digest, record_count=25 |
| 2 | LEADER | Alterar P-004 e uma nota longa na fonte após R1 | source version muda; R1 continua com dado antigo | reread source live e snapshot R1 |
| 3 | CIO | Preservar R2 e comparar R1↔R2 | comparação exibe só diferenças reais; null, zero e missing separados | diff R1/R2 e lineage |
| 4 | CIO | Gerar DOCX e PPTX de R1 e abrir bytes reais | conteúdo preservado R1, 25 itens, text overflow legível | sha256 DOCX/PPTX e inspeção do pacote |
| 5 | RESTRICTED_VIEWER | Abrir R1 com sessão/grant autorizado e fazer download | permite apenas dados realmente autorizados, reválidos no momento do download | requestId, grantRevision, hash do arquivo |
| 6 | CIO | Revogar grant de leitura antes de novo link/download | leitor anterior recebe negação em preview, URL salva, export e histórico | 403/404 conforme privacidade do contrato, nenhuma fuga de bytes |
| 7 | AUDITOR | Comparar R1 exportado ao snapshot preserve, não à fonte atual | sem recálculo histórico silencioso nem dados de outro período | source digest freeze, export digest, auditor witness |

**Oráculos independentes**

- 25 projetos únicos em R1
- P-004 muda apenas em R2 e na fonte viva
- R1 e relatório carregam lineage de versão original
- autorização é verificada também no download

**Contraprovas/falhas obrigatórias:** `SOURCE_CHANGES_AFTER_FREEZE`, `REVOKE_DURING_REPORT`, `REPORT_TIMEOUT`, `DUPLICATE_PROJECT`, `LONG_NOTES`

**Release:** A exportação precisa ser comprovada com arquivos reais no SHA C; timeout anterior não pode ser tratado como sucesso

---

## QA2-005 — Admin supremo só atribui papéis e grants com Graph completo e auditoria atômica

**Prioridade:** P0 · **Protagonista:** SUPREME_ADMIN · **Atores de apoio:** NON_SUPREME, SECOND_SUPREME, AUDITOR · **Condição:** `PR270_NOT_PROMOTED` · **Status:** NOT_RUN

**Produto / superfícies:** UI67, CAP25, CAP26 · **Jornadas:** J08
**Fixtures:** `SYN-PRIV-ADMIN`, `SYN-IT-FINANCE`

**Pré-condições que o QA deve comprovar**

- Este caso não existe no baseline das 70 superfícies; usar somente se PR #270 tiver sido integrado e requalificado no SHA C.
- Daniel/André precisam ser membros reais do grupo supremo; conta sem grupo não pode usar login local-operator na nuvem.
- Criar diretório Graph sintético somente em mock/test tenant controlado; nunca inventar usuários no Entra do cliente.

**Caminho de execução e testemunhos — prova por etapa**

| # | Ator | Ação | Resultado esperado | Evidência exigida |
|---:|---|---|---|---|
| 1 | SUPREME_ADMIN | Autenticar e abrir /sucafina/admin/access | link aparece só se checkMemberGroups fresco permitir; route revalida | session tid/oid, Graph call summary sem bearer |
| 2 | AUDITOR | Prover 2 raízes, manager 404, grupos aninhados e paginação >999 no mock | árvore completa, sem duplicatas/ciclos; nenhuma identidade criada pelo produto | counts users/groups/pages e objectIDs sanitizados |
| 3 | SUPREME_ADMIN | Mapear grupo Graph existente a role Planner finance; dar grant direto exato a perfil | duas amarrações independentes; nenhuma altera Entra | roleMap before/after e grants before/after |
| 4 | SECOND_SUPREME | Tentar salvar mudança concorrente stale no mesmo record key | CAS=409 no contrato proposto; no-commit e versão preservada | sourceRevision e audit unchanged |
| 5 | SUPREME_ADMIN | Enviar role fora de ROWS, grant fora do catálogo e autoelevação | 422/403 conforme guard e categoria; nenhum commit | request redacted, policy before/after |
| 6 | NON_SUPREME | Tentar URL GET/POST com Caio, Pedro e Zico | sem link; GET/POST 403; nenhum HTML com perfil | role/group, HTTP and cache witness |
| 7 | AUDITOR | Simular Graph 429/403/partial pagination e grant órfão | 503 fail-closed para diretório incompleto; orphan só quando snapshot completo | Graph mock transcript, 503/no partial, orphan audit |
| 8 | SUPREME_ADMIN | Reiniciar host e rever roleMap, grants e audit from/to | durabilidade, actor oid, timestamp UTC e CAS mantidos | durable snapshot and audit history |

**Oráculos independentes**

- nenhum Graph-write
- um único CAS transacional por alteração
- group role não cria direct grant e vice-versa
- desconhecido do Graph falha fechado

**Contraprovas/falhas obrigatórias:** `GRAPH_PAGING_PARTIAL`, `GRAPH_THROTTLE`, `SELF_ESCALATION`, `STALE_CAS`, `ORPHAN_GRANT`

**Release:** PR #270 + aprovação do dono + Microsoft delegated scopes reais + prova VM antes do go-live

---

## QA2-006 — Rotina com agente produz recomendação verificável e nunca aprovação invisível

**Prioridade:** P0 · **Protagonista:** CIO · **Atores de apoio:** FINANCE, BUYER, AUDITOR · **Condição:** `PLATFORM_CAPABILITY_DEPENDENT` · **Status:** NOT_RUN

**Produto / superfícies:** UI64, UI65, UI66, UI70, UI41, UI33 · **Jornadas:** J07, J04, J08
**Fixtures:** `CASE-EDI-01`, `PR-32000`

**Pré-condições que o QA deve comprovar**

- Há uma receita instalada, versionada por digest e autorizada para caso/sourceRefs atuais; nenhuma skill é presumida.
- O ambiente expõe provider/model/skill/session e verifier real, com job/recur scheduler disponíveis ou explicitamente BLOCKED.
- Processar apenas fixtures não sensíveis; separar admissibilidade do prompt de execução e conclusão.

**Caminho de execução e testemunhos — prova por etapa**

| # | Ator | Ação | Resultado esperado | Evidência exigida |
|---:|---|---|---|---|
| 1 | CIO | Selecionar receita fixada e sourceRefs admitidos | versão/digest/owner da receita visíveis; scope do usuário validado | recipeRef,digest,sourceRefs,accessRevision |
| 2 | CIO | Preparar e iniciar run nativo | queued/running expostos sem alegação de completed; inputRef real | runRef, admission receipt, tool/skill identity |
| 3 | AUDITOR | Introduzir output com schema inválido ou fonte revogada | verifier bloqueia contribuição e não executa nenhuma escolha/aprovação | verifier outcome e no-domain-commit |
| 4 | CIO | Executar novamente com output válido e conferir proveniência | result=completed somente após host+verifier; distingue recommendation vs action | runRef, verifierRef, model/skill/source digest |
| 5 | BUYER | Consultar casos/PR com parecer, sem confirmar | Procurement continua no estado anterior; parecer não vira PO | source reread e diff=zero |
| 6 | CIO | Cancelar um run permitido e solicitar recorrência quando scheduler instalado | terminal state coerente; schedule started ≠ completed | run states and scheduleDetails.read |
| 7 | AUDITOR | Provocar provider indisponível, retry, duplicata de runRef e restart | falha determinística, sem resultado forjado e sem duplicata aplicada | failure receipt, restart state, idempotency |

**Oráculos independentes**

- run completion exige host e verifier
- contribution não é approval
- cancelamento não apaga histórico
- recorrência não edita cron sem scheduleDetails.read

**Contraprovas/falhas obrigatórias:** `MODEL_UNAVAILABLE`, `SCHEMA_INVALID`, `REVOKED_SOURCE`, `CANCEL_RACE`, `RESTART`

**Release:** Scheduler e residente exigem prova do runtime instalado; não basta presença de botão

---

## QA2-007 — Identidade visual Sucafina mantém a sofisticação e a acessibilidade do Orchestra

**Prioridade:** P1 · **Protagonista:** CIO · **Atores de apoio:** QA_ACCESSIBILITY, BRAND_OWNER · **Condição:** `WHITE_LABEL_RELEASE_FEATURE_UNVERIFIED` · **Status:** NOT_RUN

**Produto / superfícies:** CAP01, UI29, UI47 · **Jornadas:** J08
**Fixtures:** `BUD-2026-IT`, `REV-EXEC-NOV/R1`

**Pré-condições que o QA deve comprovar**

- Tema Sucafina incluído no SHA C e assets oficiais aprovados; temas Orchestra originais permanecem inalterados.
- Capturar screenshot-padrão de glass/blur/shadow/geometria/layout nos mesmos breakpoints e dados, sem tolerar mock substitutivo.
- Identidade Sucafina (logos/naming/favicon) deve sobreviver a alternância de tema sem vazar branding Orchestra.

**Caminho de execução e testemunhos — prova por etapa**

| # | Ator | Ação | Resultado esperado | Evidência exigida |
|---:|---|---|---|---|
| 1 | CIO | Abrir home e briefing nos temas claros e escuros do Orchestra | estruturas e estados coerentes com originais; branding corporativo é Sucafina | screenshot comparativo 1440 px com mesmo conteúdo |
| 2 | QA_ACCESSIBILITY | Verificar 320/768/1440 px, zoom 200% e 400% quando aplicável | sem perda de ação ou conteúdo relevante; foco visível e sem trap | vídeo teclado, reflow + state screenshot |
| 3 | QA_ACCESSIBILITY | Navegar via teclado e leitor de tela em alertas, formularios, modais | label, ordem, estado de erro e anúncio correto | a11y tree, foco e leitura observada |
| 4 | BRAND_OWNER | Alternar tema e verificar logos, iconografia, favicon, animação e densidade | brand Sucafina invariável; tema Orchestra não foi reescrito | asset hashes e comparativos pixel/estruturais |
| 5 | CIO | Abrir erro 403/503 e um loading lento | loading não oculta negação; UI sofisticada não inventa estados | screenshot dos estados error/slow/empty |

**Oráculos independentes**

- nenhuma regressão estrutural dos temas originais
- nenhum brilho/neon excessivo que altere identidade existente
- acessibilidade WCAG 2.2 AA como meta de aceitação explicitada pelo dono, não conformidade presumida

**Contraprovas/falhas obrigatórias:** `DARK_LIGHT_SWITCH`, `LOW_WIDTH`, `ZOOM_REFLOW`, `ERROR_STATE`, `SLOW_NETWORK`

**Release:** Sinalização condicional até merge da implementação visual e aprovação de branding

---

## QA2-008 — O recibo continua íntegro após reinício e rollback sem falsa recuperação

**Prioridade:** P0 · **Protagonista:** RELEASE_OWNER · **Atores de apoio:** QA_LEAD, FINANCE, AUDITOR · **Condição:** `RELEASE_POLICY_OWNER_APPROVAL` · **Status:** NOT_RUN

**Produto / superfícies:** UI57, UI40, UI48, UI67 · **Jornadas:** J03, J04, J05, J08
**Fixtures:** `OPEX-LIC-01`, `PR-32000`, `REV-EXEC-NOV/R1`

**Pré-condições que o QA deve comprovar**

- VM/tenant de QA isolados, backup íntegro e restore testado; operador possui permissão para reiniciar o ambiente de prova.
- Versionar SHA C, pacote, banco WAL, snapshot de política, versões de schema e recibos de efeitos.
- Nunca rodar o experimento em dados de produção, nem capturar secrets nos artefatos.

**Caminho de execução e testemunhos — prova por etapa**

| # | Ator | Ação | Resultado esperado | Evidência exigida |
|---:|---|---|---|---|
| 1 | FINANCE | Aplicar uma mutação admitida e obter receiptRef original | um efeito persistente, com before/after, sourceVersion e audit | receipt e hash do estado |
| 2 | QA_LEAD | Interromper entrega/cliente depois do commit, sem reexecutar chamada | reread do receipt encontra o mesmo outcome; 0 duplicatas | network timeline e query read-only |
| 3 | RELEASE_OWNER | Reiniciar processo/VM controladamente | recibo e objeto permanecem; sessão obsoleta reautentica sem bypass | boot log sanitizado, receipt hash após restart |
| 4 | RELEASE_OWNER | Executar restore em instalação isolada documentando o ponto de recuperação | snapshot restaurado é internamente coerente; RPO/RTO medidos, não inventados | restore SHA, timeline, backup hash, DB integrity |
| 5 | AUDITOR | Comparar versões, políticas, recibos e entradas posteriores ao snapshot | eventos após restore devem ter tratamento explícito: replay/reconciliação, nunca "desapareceram" | diff e reconciliação |
| 6 | QA_LEAD | Testar rollback de pacote/feature com schema compatível e política autorizada | origem, nonce e grants permanecem seguros; sem permissão implícita | integration probe, health, role/projection audit |

**Oráculos independentes**

- um commit não vira dois após resposta perdida
- restore não prova sozinho integridade de transações posteriores
- segredos não aparecem no log/artefato
- RPO/RTO não são números imaginados

**Contraprovas/falhas obrigatórias:** `PROCESS_RESTART`, `BACKUP_ROLLBACK`, `STALE_SESSION`, `LOST_DELIVERY`, `POLICY_REVISION`

**Release:** Exige janela autorizada de release e aprovação explícita do owner

---
