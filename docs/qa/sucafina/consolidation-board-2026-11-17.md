# Snapshot histórico do backlog — 2026-11-17

> **NÃO CANÔNICO PARA EXECUÇÃO.** Este arquivo preserva a visão do lead em um momento específico.  
> O plano atual está em `consolidation/README.md` e `consolidation/execution-plan.md`.

## Correções obrigatórias de leitura

1. Este arquivo **não** era o inventário completo de tudo que estava aberto; ele cobria um subconjunto numerado principalmente entre #205 e #331.
2. A fila viva possuía **242 PRs abertos** na consulta posterior de 2026-11-17.
3. A base avançou para `close-final-candidate@9c2a43e2ed63254a94ae698cac52c476a3fb2653` antes da elaboração do plano canônico.
4. Nenhum vermelho compartilhado é aceito depois de B0.
5. As palavras “Superseded”, “Crítico” e “Not-checked” abaixo são hipóteses históricas; exigem ledger e prova atual.
6. O PR `#237` não está superseded: é a rota de promoção de `close-final-candidate` para `go-live-close`.
7. O PR `#333` foi mergeado como documentação; o conteúdo abaixo não substitui inventário completo.
8. Nenhuma linha abaixo autoriza merge, close, deploy, VM ou GO.

---

## Registro original preservado


**O que é isto:** o inventário limpo de tudo que estava aberto no repo no fim do dia 2026-11-17, dividido em 4 blocos de ~20, com uma recomendação de disposição por item.
**O que NÃO é isto:** autorização para executar nada. Nenhuma linha deste documento autoriza merge, close, rebase, rodar deploy ou ligar a VM. Toda execução continua sob a régua do dono: cada PR só desembarca **verde exceto os jobs compartilhados** (`sf/static-and-contracts` = guards dev=1, `sf/test-CI-SF` = microsoft integration fixture + local-browser.ts + `presentation.test.ts` #b54a22, `sf/test-CI-UI-DECISIONS`/`sf/test-CI-UI-REPORTS` = console installed specs, `sf/verify` = agregador); review fria mínima quando toca comportamento de produto; merges em lote sempre deram por slice, nunca por contágio.
**Origem:** base `origin/close-final-candidate` = `c383a7e05c` (após 24 merges hoje). Estado verificado por leitura de git + gh, não de memória ou de narrativa de sessão.

## 0. O que já foi feito — 24 merges hoje (sha da base local current)
`#295` #286 #300 #303 #299 #320 #305 #306 #279 #304 #311 #315 #310 #313 #317 #322 #323 #325 #326 #296 #312 #316 #324 #309 #321 — detalhe:
- Unblock estático (#295): `focusable` SVG fora → `static-and-contracts` destravado genericamente
- Fence identity, import OPEX não zera estado, procurement queue vazia, UAT controller, Budget Planner import
- Drift da edição: enrollment → `/`; admission same-origin fail-closed (`checkServerHealth`); console como homologação rotulada
- Assembly single-SHA (recibo SF_ORCHESTRA_WEB_PACKAGE_VERIFIED RETIDO até gates 12/12)
- Quarentena dos 4 builds 1.18.27 + snapshot `orchsf-qa-freeze-20261117` + LFS
- White-label Sucafina (brand layer isolada, palette preservada)
- WS-2/3/5/6/7/8/9 + costes de merge: WS-6 skills aligned, WS-3 documentos, WS-5 agent UX proof, WS-7 attachments, WS-8 cross-links, WS-9 planner model
- T2 retarget, T2a map, T8 contract/docs, T6 sweep terminológico, single-edition consolidation plan merged (#321)
- Hidden-risk residual coverage (parser/import bounds) — parcialmente em voo

## 1. A regra de mesita de decisões
1. VM permanece inerte até: assembly candidato verde em SHA único **e** pacote `linux-x64` reconstruído **e** smoke SSO com TAP **e** rollback validado (snapshot `orchsf-qa-freeze-20261117`).
2. Antes da VM acender, OPEX permanece fora.
3. Marca da Sucafina: sign-off visual pelo dono em artefato instalado (gap aberto no #279).
4. O console legado `/sucafina/*` **deixa de existir como face do produto** (autorização do dono). Remoção gradual via Stage A (#327) e depois fase 2 pós-validação de equivalência.
5. Historiográfico intocável: `modules/sucafina/Sucafinav1/docs/sf2h/receipts/**`, `docs/qa/sucafina/uat-cio/research/**`.
6. `bun test` local proibido. CI só pelo repo (GitHub Actions x64 ubuntu-24.04).

## 2. Inventário — Bloco A (~20 itens) — 2026-11-16/17 (#205–#225)
Todos esses abertos via campanha histórica, nunca revisados contra a base de hoje. Disposição = **NÃO EXECUTAR AINDA**.

| PR | Ramo | 1 linha | Classe de disposição |
|---|---|---|---|
| #205 | sf-files-transport | transporte de arquivos SF | Superseded (#331 engloba) |
| #206 | sf-ci-closure | closure SF CI | Superseded (#304/#307/#326) |
| #207 | sf-c12-review | revisão C12 | Superseded (revisão fria em curso) |
| #208 | sf-integration-preview | preview integração SF | Needs-rebase / obsoleto |
| #209 | sf-home-binding | binding Home SF | Superseded (drift #320) |
| #210 | sf-release-proof | proof release SF | Superseded (#305 assembly + receipts) |
| #211 | sf-proof-first | proof SF primeiro | Superseded |
| #212 | sf-proof-last | proof SF por último | Superseded |
| #213 | sf-review-prep | preparação revisão SF | Superseded (#299 controller, #296) |
| #214 | sf-c12-contract | contrato C12 | Superseded ou NEEDS-OWNER |
| #215 | sf-shell-guard | guard shell SF | Superseded (drift + #320) |
| #216 | sf-origin-bridge | bridge origin SF | Superseded (T8 + #315) |
| #217 | sf-binding-preflight | binding preflight SF | Superseded |
| #218 | sf-context-admission | admission context | Superseded (drift + admission) |
| #219 | sf-planner-probe | planner probe | Superseded (#317 WS-9) |
| #220 | sf-cases-probe | cases probe | Superseded (#307/#326) |
| #221 | close-proof-inputs | inputs proof close | Superseded |
| #222 | close-ui-mount | UI close mount | Superseded — verificar contra #320/drift |
| #223 | close-talent-files | talent files | Superseded |
| #224 | close-readiness | readiness close | Superseded |
| #225 | go-live-close | go-live close | Superseded (esta consolidação) |

## 3. Inventário — Bloco B (#226–#250)
| PR | Ramo | 1 linha | Disposição |
|---|---|---|---|
| #226 | close-native-origin | native origin | Superseded (T8 + drift) |
| #227 | close-draft-scope | draft scope | Superseded |
| #228 | close-report-files | report files | Superseded (#299/#326) |
| #229 | close-resource-index | index recursos | Superseded |
| #230 | close-procurement-drafts | procurement drafts | Superseded (#307/#316) |
| #231 | close-request-title | título requisição | Superseded |
| #232 | close-prompt-observer | prompt observer | Superseded |
| #233 | close-skill-receipt | skill receipt | Superseded |
| #234 | close-procurement-races | procurement races | Superseded (#286/#315) |
| #235 | close-draft-financial | financial draft | Superseded |
| #236 | close-native-wiring | native wiring | Superseded |
| #237 | close-final-candidate | candidato close | Superseded (#262/#305) |
| #239 | close-docs | docs close | Superseded (#321/#323/#325) |
| #240 | close-tests-fixes | testes close | Superseded (#304/#296/#307/#312) |
| #244 | sfa-pr240 | PR240 SF | Superseded |
| #245 | sfa-identity | identity SF | Superseded (#294 envelopes) — verificar antes de cerrar |
| #246 | sfa-sf | SF generic | Not-checked — agente precisa julgar |
| #247 | sfa-release | release SF | NEEDS-OWNER-DECISION (release) |
| #248 | sfa-vm | VM SF | NEEDS-OWNER-DECISION (VM — autorizado pela régua atual; **VM continua inerte**) |
| #249 | sfa-f04 | F04 SF | Relevante ao gate visual — verificar com #276/WS-7 |
| #250 | sfa-coord | coordenação SF | Superseded |

## 4. Inventário — Bloco C (#251–#276)
| PR | Ramo | 1 linha | Disposição |
|---|---|---|---|
| #251 | sfa-ci-integration | integração CI SF | Superseded (assembly base) |
| #252 | sfa-browser | browser SF | Superseded |
| #253 | sfa-gate | gate SF | Superseded |
| #255 | sfa-fix-capex | fix CAPEX | NEEDS-OWNER-DECISION (CAPEX) — verificar contra #317/#326 |
| #256 | sfa-fix-jsx | fix jsx | Superseded |
| #257 | sfa-factory-package | factory package | Superseded (#262/#305/#306) |
| #259 | sfa-fix-svg | fix svg | Superseded (#295) |
| #262 | sfa-candidate-assembly | assembly candidato | **CRÍTICO — go-live gate** |
| #268 | sfa-demo-flamengo | demo Flamengo | NEEDS-OWNER-DECISION (dataset) |
| #270 | sfa-admin-surface | admin surface | Superseded |
| #272 | sfa-admin-surface | admin staged | Superseded/deferred |
| #274 | sfa-fix-403 | fix 403 | Superseded (#296 mutation?) — verificar |
| #276 | fix-svg-lead | fix svg lead | Superseded (#295) |

## 5. Inventário — Bloco D (#280–#331)
| PR | Ramo | 1 linha | Disposição |
|---|---|---|---|
| #280 | sfa-fix-capex2 | fix CAPEX 2 | NEEDS-OWNER-DECISION — verificar contra #317/#255 |
| #289 | sfa-fix-decisions-e2e | decisions e2e | Superseded (#307/#326) |
| #290 | fix-cisf | fix cisf | Superseded (#304) |
| #293 | fix-login403 | login403 | Not-checked — verificar |
| #294 | sfa-auth401-layer-probe | auth 401 probe | **Owner-gated**: auth — **precisa decisão ou review fria** |
| #297 | sfa-fix-sf-lane | CI_SF lane | **CRÍTICO — destrava CI-SF** |
| #301 | sfa-db-postgres-sqlite-adr-20261117 | ADR PG/SQLite | NEEDS-OWNER-DECISION (ADR futuro) |
| #307 | sfa-fix-e2e-shared | e2e shared fixture | **CRÍTICO — destrava UI-DECISIONS/REPORTS** |
| #314 | audit/hidden-risks-20261117 | risco oculto audit | Not-checked |
| #318 | sfa-qa-runtime-campaign-94-20261117 | QA runtime campaign | Not-checked (escopo QA) |
| #319 | sfa-qa-blocked-harness-21-20261117 | QA blocked harness | Not-checked (escopo QA) |
| #327 | sfa-decommission-console-20261117 | decommission console | **CRÍTICO — authorised pelo dono; lanes próprias vermelhas** |
| #328 | sfa-fix-hidden-risk-residual-20261117 | fix residual hidden risk | Not-checked |
| #329 | sfa-fix-import-intake-bounds-20261117 | import intake bounds | Not-checked |
| #331 | sfa-fix-parser-resource-budget-20261117 | parser resource budget | Not-checked |

## 6. Caminho do go-live (ordem exata)
1. **Destrancar CI-SF compartilhada** via #304 (merged), #297 (em rebase), #307 (em rebase), #327 (Stage A).
2. **Assembly verde**: #262 `sfa-candidate-assembly` em SHA único, todas as lanes obrigatórias GREEN, sem fallback.
3. **Rebuild linux-x64**: artefato único no candidato; marca da edição Sucafina (CANA_VERIFY).
4. **Package check + extração**: SF_ORCHESTRA_WEB_PACKAGE_VERIFIED (fail-closed mantido).
5. **VM relight** (autorizações em vigor) → Caddy + unit → install do artefato.
6. **Smoke SSO real**: login Entra via TAP com conta publicada; verificar 302/303 correto.
7. **Semear OPEX** pelo Budget Planner: Renewal=72000 · Fixed=518000 · validar recibo impresso pela UI.
8. **Suíte UAT 185 stories** em lotes A–G; evidência por story; P0 bloqueantes.
9. **Trio froid review** sobre o bundle completo antes do GO.
10. **GO/NO-GO do dono** — assinatura com data, sem burlas.

## 7. Decisões do dono — single-line each
1. **T2** (lanes legadas): retirar/desmanter/reter após equivalência comprovada? — esta proposta de consolidação mantém *retarget primeiro*; retire formal só após provas.
2. **T3** (política console legado): prazo e condição para remover totalmente `/sucafina/*` (sugestão: após UAT passar com evidência e pedido formal do dono).
3. **Brand sign-off**: aprovar a marca Sucafina em evidência capturada em host instalado (F04/Q02), nos 15 capítulos × 2 temas.
4. **Release/VM GO**: desprovida a prova de assembly 12/12, autorizar acender a VM para produção? — O dono já disse "pode religar tranquilo" — esta consolidação registra a autorização e não tira potência disto; ela só atesta o caminho correto antes disso.

## 8. O que NÃO tocar neste consolidado
- Receipts `modules/sucafina/Sucafinav1/docs/sf2h/receipts/**` — imutáveis.
- Research `docs/qa/sucafina/uat-cio/research/**` — imutável.
- Snapshot `orchsf-qa-freeze-20261117` — rollback.
- Guards/auth/gates — não relaxar. Nada de skip/cast/timeout inflado.
- Actions/workflows/suites/manifests — só depois de legenda explícita do dono.
- `docs/qa/sucafina/uat-cio/**` fora do research — esta consolidação não edita histórias.

## 9. Resultado desejado
Fim deste documento: o engenheiro sabe para onde cada PR apontar e o dono desbloqueia passo-7/8/10 sem abrir nova campanha. Nenhuma linha aqui reflete trabalho feito; cada linha é uma margem a percorrer.
