# UAT 360 CIO / Sucafina — painel do controller

**Corte:** 2026-11-17 · **base de desenho deste painel:** `close-final-candidate@3b3e86b2a8181dadecbfe94e5ad30619bf9ce069` (após #281) · **decisão:** `NO_ATTESTATION_PERFORMED / NO-GO`.

Este é um **controle de rastreabilidade**, não um executor de browser e não um novo conjunto de stories. Fontes: `EXECUTION-RUNBOOK.md`, `stories_70x2.jsonl`, `stories_e2e.jsonl`, `story-groups.json`, `MATRIX-70-SURFACES.csv`, `MATRIX-165-ROUTES.csv`, `ROUTE-TEST-CASES.csv/.jsonl`, `OPERATIONS-306-CONTRACT-MAP.csv`, `QA-TRACEABILITY.json`, `ACTORS-AND-DATA.md`, `EVIDENCE-RECORD.json`, `GO-NOGO-GATE.md` e `quality-v3/`. Os ZIPs V1/V2 são históricos. **Nunca** usar uma contagem de design, CI verde, TAP isolado, login ou URL aberta como execução completa.

## 1. Semáforo auditável

| Universo | Planejado | `NOT_RUN` registrado | `BLOCKED_CAPABILITY` registrado | `PASSED_WITH_EVIDENCE` | Observação |
| --- | ---: | ---: | ---: | ---: | --- |
| Stories de superfície (70 × P01/N01) | **140** | **140** | **0** | **0** | `stories_70x2.jsonl` continua `DESIGNED_NOT_EXECUTED`; matriz é o status de execução |
| Stories multiator | **45** | **45** | **0** | **0** | 39 P0, 6 P1; nenhuma executada |
| **Stories distintas** | **185** | **185** | **0** | **0** | `QA-TRACEABILITY.json.executed_tests = 0` |
| Probes de rota (165 × 5) | **825** | **825** | **0** | **0** | Independentes das 185 stories; não somar como stories |
| Operações do snapshot | **306** | **306** | **0** | **0** | 305 do catálogo + 1 extensão; não são testes E2E certificados |

`NOT_RUN` é estado observado da **matriz**, não uma conclusão de que a capability funciona. PR **#270** (Supreme Admin) continua **draft e não promovido**: 7 E2E condicionais (`016–022`); PR **#268** (demo Flamengo) continua **draft e não promovido**: 1 E2E (`031`). Há ainda 1 condicional de white label (`030`), 1 de capability da plataforma (`035`) e 1 de política do owner (`040`). As **8 dependências #270/#268** são *riscos de BLOCKED_CAPABILITY*, **não** oito testes executados/bloqueados: só registrar `BLOCKED_CAPABILITY` após preflight no SHA realmente instalado com recibo de ausência da porta. Não simular grants ou promover draft por suposição. Um P0 não ganha N/A sem decisão formal de escopo.

### Lotes A–G, interpretação **literal** do runbook

A coluna de stories corresponde à lista escrita no runbook; `UIxx`/`CAPxx` significa **P01 + N01**; as faixas E2E são inclusivas. Contagens **se sobrepõem** — F revisita 140 stories; uma story pode aparecer em dois lotes. `NOT_RUN` e `BLOCKED_CAPABILITY` abaixo são estados da matriz, não execução de um lote.

| Lote | Seleção literal | Stories (ocorrências) | NOT_RUN | BLOCKED_CAPABILITY | Cond. #270 | Cond. #268 | Probes separados |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| **A — Foundation** | E2E-016/017/018/022/036/043 + UI67 P/N | **8** | 8 | 0 | 4 | 0 | — |
| **B — Baseline** | CAP03/17/18/22/23/24/25/26/09/10 P/N | **20** | 20 | 0 | 0 | 0 | — |
| **C — Transações** | E2E-002/003/005/013/023/028/037/042 | **8** | 8 | 0 | 0 | 0 | — |
| **D — Conhecimento** | UI33–UI63 P/N + E2E-004/006/007/014/024 | **67** | 67 | 0 | 0 | 0 | — |
| **E — Agents/admin** | UI64–UI70 P/N + E2E-019–026/030–032/035 | **26** | 26 | 0 | 4 | 1 | — |
| **F — Matriz completa** | 70 × P01/N01 | **140** | 140 | 0 | 0 | 0 | **825** |
| **G — DR/release** | E2E-034/039/040/044/045 | **5** | 5 | 0 | 0 | 0 | — |
| **Total de participações** | **não somar como stories distintas** | **274** | 274 | 0 | 8¹ | 1 | 825 |

¹ E2E-022 pertence a A e E; **condicionais #270 distintas = 7**, não 8. A união de A–G cobre **173/185** stories; **12 E2E faltam na seleção literal do runbook**, apesar de existirem no atlas. Não maquiar a cobertura: `001,008,009,010,011,012,015,027,029,033,038,041`. Proposta de encaixe **sem reescrever o runbook**: A=`015`; B=`012,038`; C=`011,033`; D=`001,008,009,010,029,041`; E=`027`. Assim o plano complementar alcança **185/185** IDs distintos; os lotes continuam com sobreposições. **E2E-043** é nominalmente A, mas seu teste exige fault injection em Apply, import e Procurement; na fila aparece depois dos smokes e apenas com dataset/ambiente de falha isolados. `full` em `story-groups.json` **não** é sinônimo de lote F: é gate de owner (`034/040`).

### Pré-prova da Azure de 17/11 — **não** execução de story

Informação operacional comunicada pelo responsável: login Entra **TAP real**, PKCE, cookie de sessão, respostas **401 fail-closed** nos testes com os papéis Caio/Sofie e restart do serviço. **Nenhum EVIDENCE-RECORD completo, SHA do pacote instalado, before/after, teste negativo integral, screenshot/trace sanitizado ou recibo revisado foi entregue a este controller neste commit.** Logo os vínculos abaixo são marcados `PRE_PROVISIONED_EVIDENCE` **apenas no campo de pré-prova**, e o status da matriz permanece `NOT_RUN`.

| Story / lote | Pré-prova observada ou reportada | Cobertura faltante para PASS |
| --- | --- | --- |
| **SF-UI67-P01 (A/smoke)** — `PRE_PROVISIONED_EVIDENCE` | TAP login Entra, PKCE, cookie | Binding efetivo de tenant/owner e grants, seleção/troca de contexto, logout, deep link, snapshot de sessão sem segredos |
| **SF-E2E-015 (complemento A)** — `PRE_PROVISIONED_EVIDENCE` | Login corporativo e início de sessão | Replay OIDC, nonce/state/CSRF, token de outro tenant, remoção de grupo, cookie/HTML seguros, contraprovas por ator |
| **SF-E2E-036 (A)** — `PRE_PROVISIONED_EVIDENCE` | 401 fail-closed em acesso nos papéis indicados, **somente sinal de negação** | Matriz de rotas, refs malformadas/cross-owner, 404 vs 403, ausência de vazamento/mutação; 401 sozinho não prova guard de papel |
| **SF-E2E-039 (G)** — `PRE_PROVISIONED_EVIDENCE` | 401 observado com atores de teste | Casos **distintos** 403/422/503, Finance autorizado versus não autorizado, mesmo input, trace e logs sob SHA do deploy |
| **SF-E2E-033 (complemento C)** — `PRE_PROVISIONED_EVIDENCE` | Restart do processo/serviço | Prova de que **os mesmos** recibos de import, PR, review e report sobreviveram, idempotência, audit, backup/restore e rollback |

**Não pré-provisionados:** `SF-UI67-N01` (PKCE não prova por si só nonce/state replay/CSRF), `SF-E2E-014` (duas instalações), `SF-E2E-013` (revogação), e os sete `016–022` (#270). Resposta 401 por si só pode significar *sessão ausente*, e não 403 de sessão autenticada sem grant; capturar principal/policy com segurança antes de classificar. O SHA de *staging* não é automaticamente o SHA de `close-final-candidate`. Pre-prova não entra em `executed_tests`, não satisfaz P0 nem altera NO-GO.

## 2. Ordem de entrega das primeiras 20 stories (browser QA)

**Contrato comum:** VM/HTTPS QA autorizado, candidato C instalado com digest do pacote e tree pinados, browser com perfis de teste segregados, `sourceRef`/revision obtidos **pelo produtor**, snapshot BEFORE e acesso privado ao arquivo de evidência. Se fixture não puder ser semeado pela UI/porta admitida, `BLOCKED_CAPABILITY`; se falta ambiente/perfil, `BLOCKED_ENVIRONMENT`. Não substituir por APIs de escrita ou mocks; não modificar política Entra real para tentar um negativo. **O controller não executa estas stories**. A ordem respeita `smoke` (exatamente os 4 P01 de `story-groups.json`); casos `#270` ficam por último, com checkpoint de promoção.

| Ordem | Story | Superfície | Ator lógico | Dado / pré-requisito específico | Grupo |
| ---: | --- | --- | --- | --- | --- |
| **01** | `SF-UI67-P01` | UI67 · Home/context | CIO | Principal Entra QA autorizado; instalação/projeto e owner context válidos; login/logout, sessão e grants | **A + smoke** |
| **02** | `SF-E2E-015` | UI67/UI69 · identidade | CIO + Leader + Buyer | Sessões QA Entra separadas; callback HTTPS controlado; harness permitido para nonce/state/replay/CSRF, sem tokens nos arquivos | access/A complementar |
| **03** | `SF-UI67-N01` | UI67 · Home/context | CIO (negativo) | Sessão positiva da 01; tenant QA alternativo/fixture OIDC controlada para code replay, CSRF, nonce e assinatura errada | **A** |
| **04** | `SF-E2E-036` | CAP24/UI31/UI40/UI57 · router | CIO + Auditor | Refs canônicas **emitidas** para records QA; rota `/new`, `/:ref`, ref truncada, outro owner e sessão não autorizada | **A** |
| **05** | `SF-E2E-014` | UI67/CAP18/CAP25/UI58/UI68 · owner | CIO + Finance + Buyer | **Duas instalações QA isoladas** A/B e objetos homônimos distintos; não testar cross-tenant com dados de produção | access |
| **06** | `SF-E2E-039` | UI67/UI55/UI57/CAP25 · respostas | Auditor + Leader + Finance | Import de QA com versões/sourceRefs; principal negado; falhas controladas 422 e 503 em produtor separado | access/G |
| **07** | `SF-CAP17-P01` | CAP17 · Planner | Finance | `V-2026-OFFICIAL` locked + `WHATIF-A/B`, com versão origem e orçamento/actual semeados por produtor | **smoke** |
| **08** | `SF-CAP24-P01` | CAP24 · Procurement | CIO | `PR-32000` + fila de 3 pedidos com estados/holders/aging reais de QA | **smoke** |
| **09** | `SF-UI45-P01` | UI45 · BI | CIO | `BI-EXEC-01`: budget, risco, PR e backlog com autorização/revisão de cada fonte | **smoke** |
| **10** | `SF-CAP17-N01` | CAP17 · Planner | Finance (negativo) | 07 concluída; versão official bloqueada, segunda sessão e source snapshot para confirmar **no write** | smoke / negativa |
| **11** | `SF-CAP24-N01` | CAP24 · Procurement | CIO + Holder QA | 08 concluída; mudança concorrente de etapa em `PR-32000` e reread de fila/aging | smoke / negativa |
| **12** | `SF-UI45-N01` | UI45 · BI | CIO + Viewer negado | 09 concluída; dataset restrito de talentos, viewer QA sem grant e busca direta de view | smoke / negativa |
| **13** | `SF-E2E-013` | UI48/UI50/UI31/UI62/UI67 · revogação | CIO + Auditor + Leader | Revisão R1 + relatório/arquivo QA gerados; leitura previamente permitida; revogação autorizada de grant e segunda sessão | access |
| **14** | `SF-E2E-043` | CAP18/CAP25/UI57 · Apply/receipt | CIO + Finance + Buyer | Versões CAS OPEX, PR e import QA separados; harness isolado para *response lost*; tentativa e recibo originais consultáveis | **A** (dependência transacional) |
| **15** | `SF-UI68-P01` | UI68 · Exports | Buyer | `EXPORT-PR-32000`, `PO-EDI-01` e supplier grants QA; export real com checksum de arquivo | access / precondição |
| **16** | `SF-UI68-N01` | UI68 · Exports | Buyer (negativo) | 15 concluída; revogação autorizada do grant de fornecedor após export e tentativa de re-download | access / negativa |
| **17** | `SF-E2E-016` | UI67 + **/sucafina/admin/access** | CIO/Supreme + Leader + Buyer | **#270 promovido ao C**; Graph paginado de teste, manager/department/Teams, supreme allow/deny; sem Graph token no browser | **A · cond. #270** |
| **18** | `SF-E2E-017` | UI67/CAP25/CAP26 + admin | CIO/Supreme + ProcAdmin + Buyer | 17 concluída; grupos Graph QA válidos, bindings group→role e profile→grant distintos, audit from/to | **A · cond. #270** |
| **19** | `SF-E2E-018` | UI67 + admin | CIO/Supreme | 17/18 concluídas; principal supreme de teste e **segundo** admin QA; tentativas de autopermissão e reread sem commit | **A · cond. #270** |
| **20** | `SF-E2E-022` | CAP25/CAP26/UI67 + admin | CIO/Supreme + Buyer + Approver | 18 concluída; Buyer logado, grant sourcing QA revogável, policy/accessRevision e tentativa de mutation já preparada | **A · cond. #270** |

**Regra de avanço:** quando pré-condição não existir, registrar bloqueio com prova e avançar para a próxima story independente; não fabricar seed/grant. `SF-E2E-016–022` não são elegíveis a PASS enquanto #270 não fizer parte do **SHA instalado**. #268/`SF-E2E-031` pertence a lote E e não integra esta fila. `SF-E2E-043` só roda quando fault injection estiver autorizado; sem isso, `BLOCKED_ENVIRONMENT`, nunca retry cego.

## 3. Protocolo de atualização sincronizada (sem segunda planilha manual)

**Planilha consolidada:** `MATRIX-185-STORIES.csv` registra os 185 casos com `execution_status`, `evidence_ref`, `attempt_id` e `product_commit_sha`; é uma **projeção** do índice abaixo, não um segundo local de edição. Inicialmente, 185 × `NOT_RUN`. As 825 contraprovas de rota e 306 operações ficam em planilhas próprias.\n\n**Uma fonte de verdade para os resultados:** `QA-TRACEABILITY.json.execution_index`, introduzida **somente no primeiro recibo real** pelo reconciliador `scripts/reconcile_execution.py`. Cada `case_id` guarda tentativas append-only com último resultado, SHA do produto, hash SHA-256 do registro sanitizado, papel, executor **alias**, horário UTC, hash before/after, ponteiro opaco de evidência e revisão. Os arquivos `stories_*.jsonl` são **especificação histórica** e continuam `DESIGNED_NOT_EXECUTED`; a camada de execução é a matriz/ledger, não uma reescrita de oráculos.

1. **Executor/browser QA:** cria novo `run_id/attempt_id` por caso e salva um `EVIDENCE-RECORD.json` **fora do Git** com executor alias, UTC, `product_commit_sha`/tree e digest do pacote instalado, `actor_role`, instalação/tenant **aliases**, policy revision, autenticação comprovada, fixture version, BEFORE/AFTER (SHA-256), passos observados, status HTTP, receipt/attempt do produtor (ou prova de *no commit*), trace e hashes dos artefatos. O relatório privado contém o material íntegro; nunca tenant ID, oid, UPN, cookie, token, segredo, documentos privados ou request body bruto no Git.
2. **Controller + revisor independente:** confrontam oráculo e SHA do deployment, os papéis realmente concedidos, produtor e receipt/readback; **P0 exige revisão por alias distinto do executor**. `PRE_PROVISIONED_EVIDENCE` **não** é valor aceito por matriz: apenas anotação de preparação até conclusão da story. Classificação permitida: `PASSED_WITH_EVIDENCE`, `FAILED_PRODUCT`, `BLOCKED_ENVIRONMENT`, `BLOCKED_CAPABILITY`, `NOT_APPLICABLE_APPROVED` (última somente com aprovação do owner). Bloqueio exige `reason_code`; falha exige defeito e evidência; PASS de mutation exige receipt; negativa exige prova da **ausência** de commit.
3. **Transação de consolidação:** numa **única branch/PR de atualização**, controller passa o registro **sanitizado** por `python3 docs/qa/sucafina/uat-cio/scripts/reconcile_execution.py --record /private/sanitized-case.json --evidence-ref QA-RUN-ALIAS`. O script calcula o SHA-256 dos bytes exatos do registro, preserva tentativas (recusa reuso de attempt ID divergente) e reprojeta `MATRIX-185-STORIES.csv` (185 statuses individuais, inclusive os 45 E2E; evidence ref/attempt/SHA), `MATRIX-70-SURFACES.csv` (P/N), `ROUTE-TEST-CASES.csv` + `.jsonl` (probes individuais), `MATRIX-165-ROUTES.csv` (agregado **só PASS após cinco probes PASS**), `OPERATIONS-306-CONTRACT-MAP.csv` (apenas prova dedicada de operação) e `QA-TRACEABILITY.json` (ledger, contadores e hashes dos arquivos pinados). Uma story de superfície **não preenche automaticamente** as cinco negativas de rota nem as operações do registro.
   **Integridade histórica (FIX-FIRST #299):** o primeiro recibo cria `EXECUTION-LEDGER.jsonl`; cada novo recibo acrescenta **somente** um evento com sequência e SHA-256 encadeado. `QA-TRACEABILITY.json.execution_index` e as matrizes são projeções: `--check` compara as tentativas com a cadeia, pin de digest e prefixo de Git (`HEAD`/`HEAD^`, quando disponível); exclusão ou reordenação deve falhar mesmo se alguém reprojetar as planilhas. Não editar nem reconstruir o ledger manualmente; histórico já registrado exige revisão de auditoria para qualquer migração.
4. **Antes do commit único:** `python3 docs/qa/sucafina/uat-cio/scripts/reconcile_execution.py --check` + `python3 docs/qa/sucafina/uat-cio/scripts/validate_qa_pack.py`. Ambos são **read-only em --check** e devem falhar se houver status sem recibo, divergência CSV↔JSONL, contagem errada, checksum desatualizado ou SHA misturado. Commitar `EXECUTION-LEDGER.jsonl` (se houver recibos), `QA-TRACEABILITY.json` e matrizes **juntos**; não entregar planilha atualizada sem evidência revisável. Este mecanismo valida **rastreio**, não executa produto.
5. **Quando o usuário retornar evidências:** controller verifica privadamente o record completo e publica **somente resumo sanitizado e hash**, abre/atualiza PR com statuses correspondentes e reporta por ID o resultado literal; bloquear alteração de `GO-NOGO-GATE.md` até sign-off. Em mudança de SHA C, **não mesclar recibos de candidatos**: reconciliação de fontes e novo índice de campanha sob decisão do QA/owner.

**Campos do reconciliador (registro privado, extensão mínima do template):** além dos campos obrigatórios do `EVIDENCE-RECORD.json`, informar `effect_class` (`READ_ONLY`, `MUTATION`, `DENIAL` ou `COMPOSITE`) para um PASS; `COMPOSITE` sem escrita admitida exige prova `negative_no_commit_proof`, enquanto `MUTATION` exige `business_receipt_id_redacted` genuíno. `reviewed_by` e `signed_at_utc` são obrigatórios para PASS/N/A e o revisor deve ser distinto do executor. `owner_approval_ref` é obrigatório em N/A. `live_tenant_observed=true` só com `deployment_proof_sha256` **revisado** do mesmo candidato; não autoestimar a partir de `installation_alias`. O `--evidence-ref` é alias opaco da custódia privada (não caminho absoluto, URL, token nem UPN). Um caso de `ROUTE-TEST-CASES` usa seu `case_id` `SF-ROUTE-...`; uma operação somente muda de estado com `case_id` igual ao `operation_id` e seu **próprio** registro, jamais por inferência a partir de uma story. O JSONL da story continua oráculo de design; o JSONL de route probes acompanha os statuses da matriz.

**Semáforos separados:** `PRE_PROVISIONED_EVIDENCE` = *sinal parcial, fora do ledger de execução*; `NOT_RUN` = caso ainda não executado; `BLOCKED_*` = tentativa qualificada, não PASS; `PASSED_WITH_EVIDENCE` = execução completa + revisão; `go_live_approved=false` até G0–G4, 12 jobs no mesmo C e assinaturas. Nenhum passo deste controller altera Entra, Azure, produção, dados de fornecedor ou papéis.
