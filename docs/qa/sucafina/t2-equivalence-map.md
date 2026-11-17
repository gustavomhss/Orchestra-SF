# T2 — mapa de equivalência do console legado para a edição nativa Orchestra Sucafina

**Tipo:** auditoria documental; nenhum gate é aposentado neste PR.  
**Base congelada inspecionada:** close-final-candidate @ d624e44db8e2f8f15825566277ced51cfac8b0c7 (17/11/2026).  
**Destino correto:** o **shell Orchestra**, com capítulos Sucafina nativos sob /orchestra/sf-* e identidade visual Orchestra; **não** um módulo/console Sucafina separado.  
**Ação sobre gates:** exclusivamente **DECISÃO DO DONO**, após evidência da cobertura substituta. Este mapa não recomenda apagar testes apenas porque a tela antiga será retirada.

## 0. Como interpretar o mapa — regra contra equivalência fabricada

- **Raízes:** L = packages/app-shell/e2e/sucafina/; N = packages/app-shell/src/orchestra/chapters/sucafina/; E = packages/app-shell/e2e/sucafina/native/; T = modules/sucafina/Sucafinav1/test/.
- **N/...** aponta para um destino **real encontrado no código**. **E/...** aponta para prova nativa localizada. A presença de componente, rota ou teste semelhante **não estabelece equivalência integral** de ator, operação, payload, CAS, resposta perdida, export, instalação e persistência.
- **Parcial** significa que há destino/cobertura para um **subcontrato**, não que o arquivo ou gate antigo possa ser desativado.
- **SEM EQUIVALENTE — DECISAO DO DONO** significa que **não foi comprovada cobertura nativa do contrato específico**; pode haver telas correlatas, indicadas após essa expressão. É resultado válido e bloqueia aposentadoria automática do gate.
- A própria N/route-registry.ts avisa que reconhecer pathname **não cria owner, grant, context ou operation**; E/navigation.spec.ts cobre a matriz de rotas, não todos os efeitos de negócio. E/fixture/corpus.ts se declara **DOMAIN_FIXTURE_NOT_INSTALLED**. Não contar esses artefatos como prova de paridade.
- O diretório T/ contém **1.091 arquivos** no tree consultado; **61 arquivos diretamente na raiz** e fixtures das famílias nomeadas foram inspecionados nesta auditoria. A menção de “~90 refs” é estimativa de referências, **não** contagem validada de 90 arquivos ou certificação de todo T/product/**. O índice completo da raiz, incluindo guardas de domínio sem HTML, está na seção 3. Não misturar testes de backend ainda necessários com dependências de tela antiga.
- Receipts históricos **não editados**: docs/sf2h/receipts/** e docs/qa/sucafina/uat-cio/research/**. Nenhum jobs/suites/workflows foi alterado ou validado localmente.

## 1. Matriz obrigatória — 43 arquivos E2E legados

### 1.1 BI installed (L/bi-installed)

| Arquivo | Domínio realmente exercitado | Equivalente nativo observado ou ausência | Risco de aposentadoria sem fechamento |
|---|---|---|---|
| browser.ts | Navegação BI09/BI10 no /sucafina/dashboard?sf=bi; seleção explícita, dados/tabela, chart e origem dos dados. | **Parcial:** N/bi/catalog/index.tsx, N/bi/decisions/index.tsx; E/journeys/u22.spec.ts. A URL, os controles de seleção e o oracle não são idênticos. | Visualização de seleção errada, dados de fonte/currency/period não admitidos. |
| installed-bi.spec.ts | BI09/BI10 instalados: citação literal de training, componentes conhecidos/pendentes, comparação, marcas/gráfico e fonte vigente. | **Parcial:** N/bi/decisions/index.tsx + E/journeys/u22.spec.ts (figuras e navegação de fonte). Sem prova 1:1 da citação, cálculo literal e continuidade do corpus instalado. | Falsa igualdade monetária, preenchimento indevido de lacunas e perda de fonte histórica. |
| installed-fixture.ts | Prepara Planner versions, forecasts e decisões reais como origem de BI; verifica identidade, revisões e escopo. | **SEM EQUIVALENTE — DECISAO DO DONO** para o preparo integrado idêntico; correlatos N/planner/versions/index.tsx, N/decisions/cases/index.tsx e E/fixture/corpus.ts (**domain-only**). | Fixture artificial ser confundida com produtor autorizado; BI sem proveniência real. |

### 1.2 Dashboard installed (L/dashboard-installed)

| Arquivo | Domínio realmente exercitado | Equivalente nativo observado ou ausência | Risco |
|---|---|---|---|
| records-signals-history.spec.ts | Hot Topics, registros isolados, conflitos entre atores, sinais, histórico autorizado e retenção de rascunho sob CAS. | **Parcial:** N/dashboard/hot-topics/index.tsx, N/dashboard/hot-topics/edit.tsx, N/reviews/agenda/index.tsx; E/journeys/u38.spec.ts verifica lista/detalhe/draft. Não há prova 1:1 do percurso completo. | Sobrescrita concorrente, história incorreta ou sinal sem origem. |
| support.ts | Helpers do console: /sucafina/dashboard, comandos, observação de requests, diagnóstico CSP/CORS/rede, login e agenda. | **SEM EQUIVALENTE — DECISAO DO DONO** para o helper/telemetria de transporte legados; E/fixture/ é infraestrutura nativa distinta. | Falha de transporte real silenciada por testes de rota pura. |
| transport-probe.spec.ts | Diagnóstico **não-gate de aceitação** Node vs browser, entrega de body, /sucafina/notifications e workbench-views. | **SEM EQUIVALENTE — DECISAO DO DONO**; E/isolation.spec.ts verifica isolamento, **não** o mesmo transporte. | Reaparecer travamento/erro de rede sem diagnóstico; NÃO alegar que este probe comprova Dashboard. |
| confirmation-access.spec.ts | Confirmação exata de alterações mensais, cancelamento, duas sessões e descarte de resposta tardia após logout. | **Parcial:** N/dashboard/opex/index.tsx, N/shared/change-review/index.tsx, E/isolation.spec.ts, E/journeys/u39.spec.ts (CAP04). Mesma sequência de confirmação+revogação **não demonstrada**. | Mutação inadvertida, ressuscitar dados privados e perder draft após cancelamento. |

### 1.3 Decisions support (L/decisions-support)

| Arquivo | Domínio realmente exercitado | Equivalente nativo observado ou ausência | Risco |
|---|---|---|---|
| alternative-response.ts | Injeta perda da resposta **já produzida** de decision-promote; verifica request real, não grant simulado. | **SEM EQUIVALENTE — DECISAO DO DONO** para fault injection de promoção; correlato N/decisions/alternatives/index.tsx. | Dupla promoção/replay cego de escolha cujo resultado é desconhecido. |
| choice-history.ts | Escolha versionada, comparação condicionada, critério desconhecido, fechamento/reabertura, resultado perdido e histórico. | **Parcial:** N/decisions/choice/index.tsx, N/decisions/receipts/index.tsx; E/journeys/u18.spec.ts e u37.spec.ts. Sem o mesmo oracle de regra condicionada+histórico. | Registrar escolha sem critério ou apagar distinção unknown vs zero. |
| initial-alternatives.ts | Criação de versões Planner reais, alternativas, múltiplas fontes, intenção/caseRef, revisão e perda de resposta. | **Parcial:** N/decisions/cases/create.tsx, N/decisions/alternatives/index.tsx, N/planner/versions/index.tsx; E/journeys/u16.spec.ts e u17.spec.ts. | Desvincular fontes canônicas, duplicar alternativa e aceitar versão stale. |
| journey.ts | Bootstrap de instalação, login e entrada no antigo workbench /sucafina/dashboard?sf=workbench; comando/response/caseRef. | **SEM EQUIVALENTE — DECISAO DO DONO** para login/URL/runner antigo; correlatos N/host/native-chapter-entry.ts e N/decisions/cases/index.tsx. | Provar o shell antigo em vez da edição nativa; sessão/identidade não reautorizada. |
| lost-response.ts | Perda da resposta HTTP de sf_case_draft após POST verdadeiro; resultado de criação permanece incerto. | **SEM EQUIVALENTE — DECISAO DO DONO**; N/decisions/cases/create.tsx é apenas candidato funcional. | Criar casos duplicados após network loss. |

### 1.4 Operations support — **todos os 9 arquivos** (L/operations-support)

| Arquivo | Domínio realmente exercitado | Equivalente nativo observado ou ausência | Risco |
|---|---|---|---|
| documents.ts | Bytes privados, admissão/scan, schema, evidência documental, vínculo e retirada; jornada associada a Supplier. | **Parcial:** N/documents/index.tsx, N/shared/attachments/index.tsx, N/procurement/suppliers/index.tsx; E/journeys/u24.spec.ts. Sem mesmo roundtrip scan/remoção. | Metadados sem bytes admitidos, vazamento e efeito de documento não confirmado. |
| imports.ts | XLSX, preview/import, relatório de origem, versão Planner e retorno a workbook exportado. | **Parcial:** N/imports/index.tsx, N/imports/history.ts, N/planner/versions/index.tsx; E/journeys/u23.spec.ts. Reimport exato e roundtrip de workbook não provados. | Importação parcial, revisão incorreta e perda de fonte/hash. |
| installation.ts | Monta aplicação de operações, Planner/Procurement, store, scanner, serviços reais e autorizações, sem mock de domínio. | **SEM EQUIVALENTE — DECISAO DO DONO** para esta composição; E/fixture/isolated-installation.ts e E/fixture/selected-installation.ts são candidatos de **outra** composição. | Provas deixarem de representar o host/produtor instalado. |
| procurement-comparison.ts | Comparação sourcing A/B/C, EUR→USD, ranking, exclusões, prêmio numérico, bloqueio de submit. | **Parcial:** N/procurement/sourcing/case-comparison.tsx; E/journeys/u12.spec.ts. Não equiparar automaticamente aos números literais deste oracle. | Escolher proposta incorreta ou aprovar sem a comparação elegível. |
| procurement-refusal.ts | FX ausente: recusa 422 com fieldErrors, invariância de estado e histórico da requisição. | **SEM EQUIVALENTE — DECISAO DO DONO** para a recusa com mesmo payload; correlatos N/procurement/sourcing/index.tsx e N/planner/fx/index.tsx. | Cotação incompleta aceita e valor financeiro ambíguo. |
| procurement-snapshot.ts | FX congelado no sourcing→PO; revisão, comparação e valor EUR/base USD persistidos sem recalcular retroativamente. | **SEM EQUIVALENTE — DECISAO DO DONO** para a sequência completa; correlatos N/procurement/requests/page.tsx, N/procurement/sourcing/index.tsx e E/journeys/u12.spec.ts. | PO reprecificado pela cotação posterior; aprovação monetária inconsistente. |
| procurement.ts | Helpers da sequência real PR, draft, queue, action, id/version e comandos do navegador. | **Parcial:** N/procurement/requests/page.tsx, N/procurement/approvals/pr/index.tsx; E/journeys/u12.spec.ts, u13.spec.ts. | Perder versionamento CAS/escopo entre etapas. |
| runtime.ts | Manifest wp04 real com três identidades distintas, origem loopback, seleção e autenticação; fail-closed se não montado. | **SEM EQUIVALENTE — DECISAO DO DONO** para o manifest wp04; E/fixture/installed-browser.ts exige contextos reais, mas não o mesmo contrato. | Testar usuário único, host incorreto ou actor forjado. |
| selection.check.ts | Guarda de seleção Playwright/Actions/OMNI, GITHUB_SHA, canal e runner para operations.spec.ts. | **SEM EQUIVALENTE — DECISAO DO DONO**; não é UI. | Suíte executada/selecionada na lane errada, com falso aceite. **Não alterar suite/workflow.** |

### 1.5 Reports support — **todos os 16 arquivos** (L/reports-support)

| Arquivo | Domínio realmente exercitado | Equivalente nativo observado ou ausência | Risco |
|---|---|---|---|
| agenda-transport.spec.ts | Diagnóstico de tráfego real ao abrir agenda de revisão; preserva dossier autorizado. | **SEM EQUIVALENTE — DECISAO DO DONO** para transporte; correlato N/reviews/agenda/index.tsx e E/journeys/u25.spec.ts. | Aceitar route mount sem entrega HTTP útil. |
| confirmation.ts | API de colaboração: criar/reply/edit/confirm question e answer; versão, pin de revisão, CAS e histórico. | **Parcial:** N/collaboration-pages/threads/index.tsx, N/collaboration-pages/confirmations/index.tsx; E/journeys/u44.spec.ts prova reply/confirmation restritos, não todo contrato. | Confirmação na revisão errada, reuso de answer sem autoridade. |
| corpus.ts | Fonte determinística **25 projetos**, 12 meses e nota longa; base para comparar DOCX/PPTX e revisão preservada. | **SEM EQUIVALENTE — DECISAO DO DONO** como corpus idêntico: E/fixture/corpus.ts usa **outro conjunto**, declara domain-only. | Falso 25/25, perda do último projeto/nota longa mascarada por amostra menor. |
| failed-edit-request.ts | Falha de request de edição antes de receipt, idempotency-key e CAS, sem apply otimista. | **SEM EQUIVALENTE — DECISAO DO DONO**; alvo N/collaboration-pages/threads/index.tsx. | Edit duplicado ou indicação falsa de salvo. |
| fixture.ts | Reports E2E: bundle production, um worker, zero retries, servidor real e corpus persistido. | **SEM EQUIVALENTE — DECISAO DO DONO** para as precondições exatas; E/fixture/ é diferente. | CI aparentemente verde com retry, servidor errado ou prova sintética. |
| human-answer-flow.ts | Pergunta humana, reply, confirmação, edição, reabertura, contexto e recuperação autorizada. | **Parcial:** N/collaboration-pages/threads/index.tsx, N/collaboration-pages/confirmations/index.tsx; E/journeys/u44.spec.ts. | Confirmação sem revalidar origem/versionamento. |
| lost-created-thread-read.ts | Create confirmado no servidor; falha **somente** do primeiro read autorizado do thread. | **SEM EQUIVALENTE — DECISAO DO DONO** para essa ordem de falhas. | Recriação indevida do thread após read loss. |
| lost-edit-response.ts | POST edit com efeito real; resposta perdida; retém CAS/payload/key antigo até reconciliação humana. | **SEM EQUIVALENTE — DECISAO DO DONO**. | Replay de edição após resultado desconhecido. |
| lost-reply-response.ts | POST reply com efeito real; resposta perdida; uma escrita e reconciliação explícita. | **SEM EQUIVALENTE — DECISAO DO DONO**. | Mensagens duplicadas e histórico contraditório. |
| model.ts | Decodificação de projeção e revisão preservada; resposta HTTP e URL sf do produto antigo. | **Parcial:** N/reviews/preserved/model.ts, N/reviews/reports/index.tsx. Não é contrato HTTP idêntico. | Decodificar vazio como sucesso ou perder revision/incarnation. |
| ooxml.ts | Inspeção **dos bytes** DOCX/PPTX, estrutura ZIP/XML, todas as 25 linhas e nota longa integral. | **SEM EQUIVALENTE — DECISAO DO DONO** para oracle byte-level. N/reviews/reports/index.tsx oferece seleção docx/pptx condicionada; E/journeys/u33.spec.ts **não** certifica a mesma integridade OOXML. | Arquivo truncado, vazamento de corpus, slide faltando, falsa prova por botão de download. |
| production-installation.ts | Real serve 4110 com local/entry.ts, sessão operator e host de Reports instalado. | **SEM EQUIVALENTE — DECISAO DO DONO** para o bootstrap legado; E/fixture/installed-browser.ts conecta um shell diferente. | Prova de instalação na edição errada; identidade transportada indevidamente. |
| production-state.ts | Seed privado SQLite com snapshot inicial fechado, versões de fonte e 25 projetos. | **SEM EQUIVALENTE — DECISAO DO DONO** para o mesmo seed/provenance. | Misturar fixtures e mascarar alteração de fonte histórica. |
| read-reconciliation.ts | Falha de leitura privada sem alteração de dados; mutações vedadas e drafts mantidos. | **SEM EQUIVALENTE — DECISAO DO DONO** para o mesmo failure mode. | Recuperação automática com efeito indevido ou draft perdido. |
| review-flow.ts | Criar/preservar revisão, mudança de forecast, export Word/PowerPoint e reabertura em meeting. | **Parcial:** N/reviews/agenda/index.tsx, N/reviews/preserved/index.tsx, N/reviews/reports/index.tsx; E/journeys/u25.spec.ts, u32.spec.ts, u33.spec.ts. | Relatório de versão antiga, notas truncadas, fonte/period errados. |
| revocation.ts | Revogar sessão real em meio à revisão; distinguir dados retidos autorizados e drafts locais pendentes. | **Parcial:** E/isolation.spec.ts (logout), N/host/owner-runtime231.tsx e N/reviews/preserved/index.tsx. Falta o mesmo fluxo de Reports. | Ressurgimento de material privado ou perda de alterações não enviadas. |

### 1.6 WP00 / WP03 / WP10 (6 arquivos)

| Arquivo | Domínio realmente exercitado | Equivalente nativo observado ou ausência | Risco |
|---|---|---|---|
| L/wp00/baseline-ui.spec.ts | **7 fluxos** sobre corpus real; zoom, tempo/medições e **30 repetições por configuração**, sob GITHUB_SHA/Actions. | **SEM EQUIVALENTE — DECISAO DO DONO** para o benchmark multidomínio repetido; E/navigation.spec.ts e E/visual.spec.ts não são esta medição. | Perda de benchmark/performance e aceitabilidade sem ruído medido. |
| L/wp00/flows.ts | Sete fluxos literais: budget-filter, PO-volume, scenario-compare, sourcing-rank, report-search-DOCX, report-search-PPTX, import-preview-exact-reimport. | **Parcial disperso** em N/dashboard/, N/procurement/, N/planner/, N/reviews/, N/imports/; **SEM EQUIVALENTE — DECISAO DO DONO** para a cadeia única e oracles do corpus. | Navegação entre capítulos quebra embora cada tela isolada funcione. |
| L/wp03/installation-fixture.ts | Local-operator enrollment no 4110; exige 303 Location: /sucafina/dashboard após /sucafina/auth/local. | **SEM EQUIVALENTE — DECISAO DO DONO**; E/fixture/installed-browser.ts é entrada nativa, não prova do redirect legado. **Este redirect deve ser conciliado com a edição Orchestra, não copiado.** | Admitir operador no console recusado, em vez do shell Orchestra. |
| L/wp03/planner-mounted.spec.ts | Planner montado: monthly edits, filtros, version create/official e estado de UI com sessão real. | **Parcial:** N/planner/versions/index.tsx, N/planner/opex/index.tsx, N/planner/compare/index.tsx; E/journeys/u46.spec.ts, u48.spec.ts. | Status official falsificado e célula mensal perdida/stale. |
| L/wp10/composition.spec.ts | Jornada conjunta Dashboard + Workbench Decisions persistido + Requests + BI na mesma instalação, incluindo provas de revogação. | **SEM EQUIVALENTE — DECISAO DO DONO** para o mesmo E2E unificado; destinos em N/dashboard/, N/decisions/, N/procurement/, N/bi/. | Integração/cross-link quebrado com testes isolados verdes. |
| L/wp10/extended-flows.ts | BI com seleção explícita de versões/coleção, no-default latest, distinção de fonte Planner e Procurement. | **Parcial:** N/bi/catalog/index.tsx, N/bi/operations/index.tsx, N/planner/versions/index.tsx; E/journeys/u20.spec.ts, u21.spec.ts, u22.spec.ts. | Seleção automática silenciosa e comparação de versões não autorizadas. |

**Subtotal obrigatório E2E:** 3 BI + 4 Dashboard + 5 Decisions + 9 Operations + 16 Reports + 2 WP00 + 2 WP03 + 2 WP10 = **43/43 arquivos nominados**, todos lidos na base congelada. Nenhuma equivalência integral foi certificada por simples correspondência de nomes.

## 2. Famílias de testes T/ ligadas ao console: **uma linha de domínio por arquivo**

| Família | Arquivo T/ | Domínio protegido, em uma linha | Destino nativo / lacuna e risco |
|---|---|---|---|
| local-entry | local-entry.test.ts | Admission/status, perfis corporate/local separados, origem, rotas privadas, backups e redirects do console. | **SEM EQUIVALENTE — DECISAO DO DONO** para 303/login antigo; correlatos N/host/ e N/local-administration/index.tsx. Risco de gravar no perfil errado ou apontar ao console. |
| microsoft-* | microsoft-composition.test.ts | Entra OIDC + Node/Effect + private entry, cookie, replay e role grants nas páginas antigas. | **SEM EQUIVALENTE — DECISAO DO DONO** para integração OIDC→shell nativo completa; risco bypass de autenticação. |
| microsoft-* | microsoft-configuration.test.ts | Tenant/client imutáveis, proxy pinned, credenciais privadas, config separada e falha fechada. | **SEM EQUIVALENTE — DECISAO DO DONO**; contrato de infraestrutura **continua válido** mesmo após a tela antiga. |
| microsoft-* | microsoft-entra-client.test.ts | Confidential web OIDC, guest resource tenant, scopes mínimos, Graph e identidade imutável. | **SEM EQUIVALENTE — DECISAO DO DONO** como gate UI; nunca substituir por página logada. |
| microsoft-* | microsoft-node.test.ts | Node ingress real, HTTPS ingress público, headers forwarded hostis e preflight de configuração. | **SEM EQUIVALENTE — DECISAO DO DONO**; risco host/proxy spoofing. |
| microsoft-* | microsoft-routes.test.ts | Guards nos HTTP routes reais, grant separado do grupo Entra, resource-tenant oid e revogação. | **Parcial:** E/isolation.spec.ts para ator/logout nativo; não cobre o OIDC/HTTP original em sua totalidade. |
| microsoft-* | microsoft-session.test.ts | Cookies opacos, criptografia, one-time callback, expiração e corridas logout/refresh no store. | **SEM EQUIVALENTE — DECISAO DO DONO** para garantias criptográficas/corridas; E/isolation.spec.ts é apenas UI instalada. |
| integration-fixture | microsoft-login/integration-fixture.ts | Importa código da entry real em isolamento de módulo para exercitar a composição Microsoft. | **SEM EQUIVALENTE — DECISAO DO DONO**; não trocar por stub. |
| integration-fixture | microsoft-login/oidc-fixture.ts | Provedor OIDC/JWKS de teste, PKCE, code exchange e claims controlados. | **SEM EQUIVALENTE — DECISAO DO DONO**; infraestrutura de prova, não UI. |
| integration-fixture | microsoft-login/private-fixture.ts | Config privada Azure HTTPS com origens/pins e credenciais de fixture. | **SEM EQUIVALENTE — DECISAO DO DONO**; risco de relaxar fronteira segura do host. |
| parity-procurement | parity-procurement.test.ts | Render/domínio legado: reset settings, endereços, deeplink PR/Supplier e filtragem de autorização. | **Parcial:** N/procurement/settings/index.tsx, N/procurement/requests/page.tsx, N/procurement/suppliers/index.tsx; sem mesma parity render. |
| screen | screen.test.ts | Navegação e HTML server-rendered Dashboard/Planner/Procurement, footer não é página, comando recusado não salva. | **SEM EQUIVALENTE — DECISAO DO DONO** para HTML antigo; E/navigation.spec.ts só registra rotas nativas. |
| s5 | s5.test.ts | Máquina de estados procurement: supplier IDs, versions, PR/PO, validação antes de act e CAS. | **SEM EQUIVALENTE — DECISAO DO DONO** como substituição de teste **de domínio**; N/procurement/ não elimina esta invariante. |
| local-identity | local-identity.test.ts | PKCE, state/nonce, cookie scoped, refresh explícito e logout same-origin em identidade local/OIDC. | **SEM EQUIVALENTE — DECISAO DO DONO** para protocolo; risco de sessão reutilizada/estranha. |
| operator-browser | operator-browser.test.ts | Chrome abre páginas antigas após enrollment privado em /sucafina/dashboard e faz screenshots. | **SEM EQUIVALENTE — DECISAO DO DONO** para a rota antiga; E/fixture/installed-browser.ts aponta a shell nativo diferente. |
| operator-enroll | operator-enroll.test.ts | Helper de enrollment file privado, UID real, redirect substitutivo sem credencial e ativação explícita. | **SEM EQUIVALENTE — DECISAO DO DONO** para entrega nativa do fluxo; risco de exposição de credential ou rota errada. |
| local-browser | fixture/local-browser.ts | Fixture local Bun.serve 4110, scanner de teste e browser com operador real no console. | **SEM EQUIVALENTE — DECISAO DO DONO**: E/fixture/isolated-installation.ts e E/fixture/installed-browser.ts não são drop-in. |
| guarda adjacente | operator-identity.test.ts | Encrypted single-use local enrollment, cookie TTL, logout race, mount/origin/OS UID e buyer policy. | **SEM EQUIVALENTE — DECISAO DO DONO** para guards de identidade; preservar independente da UI. |

**Observação estrutural:** os testes de protocolo, storage, CAS, segurança e configuração **não são “testes de tela desnecessários”**. Mesmo com os componentes N/ presentes, não há autorização para remover essas proteções; uma migração correta pode manter testes de domínio enquanto troca os E2E HTML antigos por E2E no shell.

### 2.1 Dois guardas adicionais com nome relacionado, dentro de T/product/ (não são testes HTML substitutos)

| Arquivo T/ | Domínio |
|---|---|
| product/decisions-composed-qualification/operator-session-cookie.test.ts | Transporte de cookie real do operador admitido no browser e recusa de atributos duplicados/mutados. |
| product/http-body-limit-fix/microsoft-bridge.test.ts | Limite de HTTP body e ponte Node/Effect preservando proxy, CSRF, login, cookie, logout e privacidade Microsoft. |

Esses guardas **não** são equivalentes UI; preservar o contrato backend, não aposentá-lo por ausência de console.

## 3. Censo complementar de T/ raiz: arquivos fora das famílias explicitadas

Para não transformar “~90 refs” em uma afirmação falsa, esta seção registra **os outros 47 arquivos de teste da raiz** encontrados no tree. Uma linha/arquivo com domínio observado nos títulos/asserts lidos; isso **não** implica que todos sejam E2E HTML nem que T/product/** foi exaurido. Estes testes **não recebem equivalência nativa automática**. As famílias da seção 2 completam **61 arquivos raiz (61/61)**, mais os quatro fixtures em subpastas nominalmente requeridas.

### 3.1 E2E/render/console antigos adjacentes

| Arquivo T/ | Domínio |
|---|---|
| business-browser.test.ts | Chrome: Supplier→PR→Sourcing→PO e duas abas contra save stale. |
| form-layout.test.ts | Largura/campos/seções dos formulários HTML antigos. |
| full-module.test.ts | Composição de telas legadas e submissão HTTP PR/sourcing/PO; separação de parâmetros. |
| io-browser.test.ts | XLSX Planner no browser, bytes documentais privados, Supplier CSV e Members XLSX. |
| local-controls-browser.test.ts | Inbox local, read receipt, backup e logout em Chrome real. |
| parity-polling-browser.test.ts | Poll entre duas sessões sem substituir draft nem sobrepor requests. |
| presentation.test.ts | Captions/tabelas, SVG monthly keyed colors e zeros/ausências no gráfico do Planner HTML. |
| runtime-http.test.ts | HTTP real, origin/actor/CSP e draft preservado em Chrome durante blur. |
| s1.test.ts | Ordens e limites de telas Dashboard/Planner/Procurement legados; footer não vira página. |
| visual-layout.test.ts | Métricas executivas e responsividade visual do console antigo. |

### 3.2 Contratos de domínio que sobrevivem à aposentadoria de HTML

| Arquivo T/ | Domínio |
|---|---|
| dashboard-budget-runtime.test.ts | OPEX mensal/anual, zero vs ausência, doze meses, ownership e CAS por registro. |
| dashboard-operations-runtime.test.ts | Serviço/segurança, heat, registros, import mensal atômico, escopo e conflitos. |
| dashboard-people-runtime.test.ts | Hot Topics, Talent/admin, members, leaders, versões e auditoria. |
| dashboard-portfolio-runtime.test.ts | Portfolio/marcos/riscos, milestone, campos derivados e acesso delegado. |
| planner-runtime.test.ts | Criação/versionamento Planner, cálculo mensal e revisão concorrente. |
| procurement-runtime.test.ts | Requisition/Sourcing/PO, supplier IDs, aprovação e campos congelados. |
| reports-runtime.test.ts | DOCX/PPTX reais com 25 projetos/notas longas, escopo, PO sem bank. |
| parity-planner.test.ts | Import XLS/XLSX e roster, lock de plan, recusa de stale e measures fiscais. |
| parity-reports.test.ts | KPI report de IT Operations/Security, mês correto, zero/ausência e YTD não inventado. |
| s3.test.ts | Regras de mensalidade, anual/12, zero, forecast e actual. |
| s4.test.ts | Distribuição de centavos, manual override, closed month e variance. |
| s6.test.ts | CAS por linha, privacidade de talent/rate card/IBAN e backup. |
| workbooks.test.ts | Workbook Planner/HR, fórmulas, fontes de custo, salário e escopo de export. |
| lido.test.ts | Heat/IT KPI, project import merges, capex e Word distinct de slide. |

### 3.3 Contratos de segurança, armazenamento, recuperação e instalação — **não são telas**

| Arquivo T/ | Domínio |
|---|---|
| admin-plug.test.ts | Mapeamento e isolamento de plugs/permissões de superfície. |
| admin-runtime.test.ts | Role maps, coleções, assignments e configuração atômica. |
| assets.test.ts | Upload/scan/versionamento de contrato, downloads expirados e privacidade de bytes. |
| dashboard-import.test.ts | Snapshot import preserva metadados correntes e nega índices forjados. |
| elo.test.ts | ELO: fronteiras de módulo, FX/anos e privacidade de workbook/Talent. |
| entra-client.test.ts | PKCE/nonce/token assinado, Graph e claims válidas para identidade. |
| http-assets.test.ts | HTTP asset upload, scan/CAS/audit e revogação antes de private bytes. |
| installation.test.ts | Composição de roles/rotas de superfície sem grant por outra superfície. |
| local-backups.test.ts | SQLite backup/restore atômico, blob íntegro e retenção. |
| local-bootstrap.test.ts | Provisionamento seguro idempotente, paths, roles e configuração local. |
| local-jobs.test.ts | Inbox/notificações com dedup e backup periódico por identidade. |
| local-scanner.test.ts | ClamAV INSTREAM real; scanner não configurado não admite bytes. |
| local-services.test.ts | Serviço/daemon local, plist, paths e argv sem injeção. |
| local-store.test.ts | SQLite transacional, snapshot isolado, codec e blobs persistentes. |
| migrate.test.ts | Migração preserva números, IBAN sealed e backup Talent. |
| operations-runtime.test.ts | Lease/dedup de mensagens, rollback/retry e retenção de backups. |
| papel.test.ts | RBAC server-side, Talent/salary e papéis não inferidos de labels. |
| parity-legacy-workbooks.test.ts | XLS BIFF8 e inspeção segura/bounded de sheets/hyperlinks. |
| parity-maintenance.test.ts | Arquivos mensais, scratch drills e progressos sem prova falsa de recovery. |
| parity-pitr.test.ts | WAL point-in-time recovery, credenciais correntes e SIGTERM bound. |
| parity-recovery-plan.test.ts | Plano de recuperação e LaunchAgent com escaping de paths/config. |
| parity-retention.test.ts | Retenção 14 dias Planner, arquivo mensal 7 anos e restore isolado. |
| plug.test.ts | Group maps e joins RBAC permanecem vazios sem grants explícitos. |

**Consequência:** uma alteração visual não autoriza exclusão de tests/protocol ou tests/domain. Os 1.030 arquivos aninhados restantes de T/ (1.091 menos 61 arquivos raiz) não foram recenseados individualmente aqui; **não alegar cobertura completa de T/product/**. Os quatro fixtures nomeados estão dentro desse universo aninhado, e foram mapeados na seção 2.

## 4. Lacunas transversais para decisão, **não plano de aposentadoria**

| ID | Lacuna comprovada pelo contraste de contratos | Condição mínima de comparação futura (somente evidência, não ação neste PR) | Quem decide |
|---|---|---|---|
| T2-01 | Entrada local/Entra ainda espera rotas/redirects /sucafina/dashboard em vários testes, enquanto edição válida é /orchestra/sf-*. | Prova instalada do redirect após enrollment e SSO, com source owner admitido, sem retorno ao console antigo; guards de cookie/OS UID/tenant permanecem. | **DONO** |
| T2-02 | BI/Decisions usam corpus e ciclos reais com request/response-loss que testes nativos de figura/rota não cobrem integralmente. | Equivalência de produtor, fonte, unknown/zero, versões, cenário e reconciliação após resposta perdida no shell. | **DONO** |
| T2-03 | Dashboard/Operations verificam conflitos, CAS, revogação, snapshot FX, scanner/document e imports de workbook em percursos antigos. | Mesmo oracle de request real, 409/422, estado persistido, segundo ator e idempotência sob autorização nativa. | **DONO** |
| T2-04 | Reports tem 25 projetos, longa nota e inspeção OOXML byte-level + falhas de colaboração; N/reviews/reports tem UI conditional, não certificado como substituto desse corpus. | Export DOCX/PPTX com estrutura e bytes reais, 25/25, notas, revisão, colaboração lost-response/read e revogação. | **DONO** |
| T2-05 | WP00 exige 7 jornadas e 30 repetições por configuração; WP10 exige uma instalação conjunta e navegação cross-chapter. | Evidência nativa multidomínio **na mesma instalação** e benchmark equivalente, não soma de specs isoladas. | **DONO** |
| T2-06 | selection.check.ts e fixtures de host/CI defendem runner, canal, GITHUB_SHA, isolamento e ausência de fallback. | Substituto de gate de seleção e de instalação qualificado via **GitHub Actions** sem trocar suite/workflow neste PR. | **DONO** |

### Resultado e limites do T2

- **Verificado:** os 43 arquivos E2E expressamente solicitados; os 18 arquivos/fixtures das famílias T/ nomeadas e operador adjacente; censo de 61/61 testes **da raiz** T/, mais dois guardas relacionados em T/product/; rotas N/ e testes E/ citados existem no snapshot d624e44db8.
- **Não provado:** paridade integral de qualquer gate antigo, execução de Actions neste PR, status verde, origem autenticada de todos os journeys, cobertura individual dos 1.030 testes aninhados.
- **Intocado:** código de produto, jobs/suites/workflows, receipts e pesquisa histórica.
- **Veredito documental:** **NENHUMA APOSENTADORIA AUTORIZADA.** Para cada célula **SEM EQUIVALENTE — DECISAO DO DONO**, ou equivalência **parcial**, resta evidência/deliberação formal antes de qualquer alteração de gate.
