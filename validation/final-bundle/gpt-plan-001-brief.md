# BRIEF DE PLANEJAMENTO — 10 agentes para destravar o go-live do Sucafina (Azure VM + Web)

**Repositório:** `gustavomhss/Orchestra-SF` · **Branch deste brief:** `gpt-plan-001` (base = `sf-ci-lean` @ `2f94d74d50`, PR #242, draft)
**Operador com MCP:** você, planejador. O brief, o `PENDING-WORK` e as duas revisões adversariais estão neste mesmo branch.

## 0. Regra de ouro deste planejamento
Você produz APENAS um documento: `sf/ci/GPT-PLAN-10.md`, commitado na branch `gpt-plan-001` (mensagem: `docs(plan): 10-agent execution plan for SF go-live`). Sem mais nenhum arquivo novo, branch, PR, merge ou edição de código existente. Responda no chat com a URL do commit + 5 linhas. Qualquer outra ação = falha da tarefa.

## 0.1 Tripla revisão adversarial OBRIGATÓRIA antes do commit final
O plano só pode ser commitado depois de a SUA própria triplica revisão adversarial ser executada e registrada. Não são revisões decorativas para bater cota — são passes sobre o SEU próprio rascunho:

- **Pass 1 — Cobertura:** audite contra a lista COMPLETA do §3 deste brief: cada item de backlog (CI-01..15, PROD-01..08, AZ-01..08, B1/B2/B3/M1–M4, X/Y/Z, merge pendente, PR #243 pendente, U39/U40 F04, evidência/checklist) tem agente designado? Encontrou "todos os itens cobertos"? Procure ativamente itens ORFAOS (sem agente), DUPLICADOS (dois agentes para o mesmo objetivo) e VAZIOS (agente sem arquivo exclusivo ou sem DoD verificável). Toda descoberta vira mudança no plano.
- **Pass 2 — Obstrução:** audite como um oponente que quer impedir a entrega: dois agentes podem colidir no mesmo arquivo? Algum "paralelo" é serial com dependência escondida (ex.: Agente F depende do merge que Agente A não pode fazer)? Algum DoD só pode ser verificado por ordem de merge errada? Existe caminho bloqueado por branco-proteção/aprovação (ex.: paths protegidos) sem dono com direito de executar? Sobreposições de escopo devem ser descobertas HOJE, não depois de 10 agentes queimando.
- **Pass 3 — Prova de verdade:** audite se o plano permite avançar falsamente: algum DoD admite PASS por "não falhou" vazio? Algum agente pode marcar concluído sem suíte fresca, recibo, digest, ou run/artifact real? Há cont-RU que um agente resolve por sintoma enquanto a classe de falha permanece (ex.: Verde repetido sem a exceção raizada)? Há itens assinalados como prontos que dependem de ambiente Azure/F04/atores que ainda não existem — marcados honestamente como BLOQUEADOS-pelo-dono vs. anômalos?

Cada passa deve gerar **um apêndice auditável dentro do próprio plano**: `§Adversarial self-review`, com três subseções (Pass 1/2/3), cada achado com nome/severidade (BLOCKER/MAJOR/MINOR), o que foi mudado como efeito, e o estado final. **Sem BLOCKER resolvido no plano, não commitar.** Basicidade no apêndice: pelo menos 3 achados reais por passe ou justificativa explícita de porque não houve — silenciamento silencioso = falha. Revisão que não muda nada é falha declarada.

## 1. Entrega congelada — não reabrir escopo
- **Produto:** web app + runtime host Linux x86_64, em VM Azure, acesso por navegador (Web), **Microsoft auth (Entra/OIDC)**.
- **Fora da fase:** Windows/macOS/desktop/instaladores. Windows via navegador continua sendo Web e é escopo.
- **Invariantes absolutas:** Permission, Relay, Task, Omni Linux, sf-native admission, CAS/drafts/revogação/autorização de origem — nunca afrouxar, nunca criar identity forjada/aprovação simulada, nunca `continue-on-error`, nunca teste pulado como aprovado, nunca editar `script/godfile.ts`, `script/spawn-imports`, `script/guards` nem `godfile-waivers.json` sem aprovação explícita gravada no mesmo dia (protegidos por `[protected-paths]`; approver = pessoa com write access via label `guardrail-approved`; aprovação requer PR separado).
- **Nada de verde automático:** PENDING-WORK define: CI_HARNESS_VALIDATED ≠ PRODUCT_CI_GREEN ≠ AZURE_RELEASE_QUALIFIED. Nenhum item pode virar PASS por "deveria funcionar".
- **Verdade:** não existe `PRODUCT_CI_GREEN` hoje; o CI novo está em PARTIAL; o epic legado nunca fechou verde. Toda atividade em torno de "gatilhos" segue P0/P1 sem exceção.

## 2. Estado dos branches/PRs (verificado 2026-11-16)
| Branch | Ref | Nota |
|---|---|---|
| main delivery | `close-final-candidate @ 1cb77b8deb` | pushada; base do PR line |
| legacy epic | `sf2-epic-c @ 1cb77b8deb` | 47 jobs; último run vermelho c/ 14 erros typecheck app (já corrigidos em `524f6ed87e`) + e2e bun: (corrigido em `ae7850a7e3`) + godfile ENOBUFS (runner) |
| novo CI | `sf-ci-lean @ 2f94d74d50` | PR **#242 draft** → close-final-candidate; harness PARTIAL; **não contém `524f6ed87e` nem `1cb77b8deb`** |
| test fixes | `close-tests-fixes @ a2c49fc8` | PR **#240 draft** → CHANGES REQUIRED na revisão fria |
| waivers | `godfile-waivers @ 2e1cee39a1` | PR **#243 draft**, mergeable/CLEAN, **`guardrail-approved` aplicado** (2026-11-16), conteúdo rodo 20 godfiles >750 LOC; NÃO mergeado |
| handoffs | `gpt-review-242`, `gpt-review-240` | revisões adversariais dos dois PRs |
| local não-pushado | `6f3dcd7a20` (teste coverage para `GET /api/sucafina/installations` → httpapi gate), `0fca277369` (waivers, já em #243 via cherry-pick `2e1cee39a1`) | **Rebase/push ainda pendente; o plano pode assumir estes commits sendo publicados** |
| integração | `go-live-close` | branch de apresentação/release |

**Fatos de verificação:** `check:guards --base origin/dev` no HEAD `1cb77b8deb`: **0 gate / 169 warn**; com `GUARDRAIL_APPROVED=protected-paths`: 0/0 por conta da aprovação. `sf-ci-lean` contém `ae7850a7e3` mas **não** `524f6ed87e` (gate de typecheck do app falha lá por causa-código que EU já corrigi localmente, nunca rodou lá).

## 3. Consolidação de TUDO que está entre este momento e o go-live

### 3.1 Harness/CI (ver `sf/ci/PENDING-WORK.md` integral — mesmo documento, neste branch)
- CI-01..CI-15 como descritos no PENDING-WORK (run final no SHA congelado, preflight independente, `sf/verify` fail-closed real, revisão de equivalência CI-CLI/CI-ATLAS-BUSINESS, seleção manifest-governada, invariantes de recibos (SHA256/run/attempt/runner), bail/max-failures, Linux-only CI, guards no mesmo SM/SHA, classificação de REDs, custo/p50/p95, revisão fria final, branch protection/ruleset 403 + required check migration, doc final com SHA final).
- B2 do GPT (CI-05), B3 do GPT (CI-04), B1 do GPT **NOVO/descoberto neste brief**: a nova lane não porta a prova de inclusão do E2E (`--showConfig`/`--listFiles` + `script/sf2h/final-bundle/verify-e2e-typecheck.mjs`) — `bun run typecheck:sf-e2e` sozinha pode verdejar com arquivos críticos fora do grafo.
- M2: nova lane não faz `bun run generate` + `git diff --exit-code` (Epic fazia); M3: guards-base mudada; M4: bun report aceita suite quase vazia (não prova cobertura).
- Recebimento dos meus commits no merge: `sf-ci-lean` precisa conter `524f6ed87e`/`1cb77b8deb` (merge `close-final-candidate` → `sf-ci-lean`; arquivos disjuntos, sem conflito por construção; traria o fix do Planner typecheck e deixaria a lane de static capaz de ficar verde — se os fixes estiverem certos).

### 3.2 Produto/suítes (PROD-01..PROD-08 do PENDING-WORK)
- PROD-01 (typecheck app, Planner 331) — **já corrigido no close-final-candidate em `524f6ed87e`, nunca verificado** — precisa de lane fresca.
- PROD-02 (catálogo congelado Q01 vs registry/extensões; teste `packages/app-shell/test-browser/sucafina-native/transport-contract.test.ts`).
- PROD-03 (Procurement browser fixtures: review source mutation, CAS 409/422, quarantine).
- PROD-04 (CI-SF: Planner charts/CORES XLSX/OPEX, browser privado; `modules/sucafina/Sucafinav1/test/` — run 43956369500 bail=5, asserts reais).
- PROD-05 (`e2e/operations.spec.ts` — 2 falhas, HTTP 200 vs resposta divergente); PROD-06 (`e2e/decisions.spec.ts` — timeout/locator); PROD-07 (`e2e/reports.spec.ts` — locator.fill 180 s).
- PROD-08 (equivalência Linux de provas paralelas realocadas do prove local F04/mac; `parity-pitr.test.ts`/`transport-integration.test.ts`; 2 Q01 portável seguem ativos, 3 F04 live permanecem não-provados).

### 3.3 Testes/PRs abertos
- **PR #242** (draft): 0e4848847b@checkout; falhas da campainha em 43956369500: `sf/static-and-contracts` (TS2322 Planner 331 — corrigida por mim, não no head do PR), `sf/test-CI-SF`, `sf/test-CI-APP-BROWSER`, `sf/test-CI-UI-OPERATIONS`, `sf/test-CI-UI-DECISIONS` (2 casos; `sf/test-CI-UI-REPORTS` IN_PROGRESS à coleta), `sf/verify` não provado.
- **PR #240** (draft): revisão fria → **CHANGES REQUIRED** (`gpt-review-pr240.md`):
  - X — `u39.spec.ts:12` e `u40.spec.ts:12`: `as "CAP04" | "CAP05"` artificial; separar branches ou parametrizar de verdade, sem `as` de união impossível.
  - Y — `memory.test.ts:14-17`, `operations.test.ts:37-39`, `reviews.test.ts:21-23`: conversão direta `Schema.Schema<A>` → `Schema.Decoder<A>` sem prova de não-requisito de Context/serviços — restringir helper ao decoder real ou documentar/verificar requisitos.
  - Z — rodar gates completos + consumidores Web/Azure (não rodaram).
- **PR #243** (waivers): aprovado pelo dono com label; merge decidido pelo dono/ordem do refactor; nada depende dele.

### 3.4 Azure/release (AZ-01..AZ-08, do PENDING-WORK §6) — NENHUM está fechado
- Integração real da aplicação na VM (AZ-01), Entra/OIDC + segurança de origem/CSRF/sessão/binding/revogação/CAS (AZ-02), persistência Linux/backup/restore/rollback (AZ-03 — substituição do teste Litestream), F04 real com manifest privado `sf2h.native-installed-manifest.v1` + atores/diretórios privados 0700 + assinatura/witness (AZ-04), AM01–AM06 (POPULAR — 8 recipes) (AZ-05), revisão independente do candidato congelado (AZ-06), ligar `.github/workflows/sf-release.yml` a ambiente protegido + artefato imutável + smoke/rollback (AZ-07), migrar required checks → `sf/verify` e aposentar Epic legado (AZ-08).
- **Nada disso tem prova** — VM não atendida, Microsoft auth não exercitado, nenhum artefato promovido, nenhum F04 executado.

### 3.5 Jornadas F04 (U39/U40 — 1176 LOC cada no Ice) e outros pesos mortos
- u39/u40 specs — a prova de "ilegítimo usou o host?" — são F04, não CI de PR; migradas/realocadas; precisam de ambiente real (PRIVATE 0700, atores admitidos).
- GO-LIVE sem F04/AM01-06/rollback = não qualificado: este plano deve refletir isso explicitamente.

### 3.6 Evidências
- `validation/final-bundle/` reescrito: `evidence-template.md`, `installed-proof-checklist.md`, `ci-round-10-13-digest.md` — tudo Azure-Web, tudo honesto (não-provado listado). Atualizar quando fechar itens.

## 4. O que preciso do plano (GPT-PLAN-10.md)
1. **10 workstreams (Agentes 1..10), mutuamente disjuntos em arquivos** — montar um **mapa de propriedade de arquivos**: cada suite/área/presença só por um agente (ex.: Agente A: PRs/top docs; Agente B: harness `sf-ci.yml`+`gate.mjs`+`suites.json`+`test-ci*`+`script/test-ci-*`; Agente C: suítes PROD SF (SF/Planner/Budget/XLSX); Agente D: browser fixtures Procurement/Operations/Decisions/Reports; Agente E: PR #240 contraction (u39/u40/memory/operations/reviews); Agente F: integração/merge + B1/M2/M3 e2e-inclusion; Agente G: Azure AZ-01..AZ-03 (VM/host/backup); Agente H: identidade/segurança AZ-02 + guards/approvals; Agente I: F04 + AM01–AM06 + U39/U40+AM05; Agente J: evidência/bundle/digest + migração required checks + release gate).
2. Cada agente: **contexto (bullets ≤15), arquivos EXCLUSIVOS (paths), arquivos compartilhados, dependências entre agentes (grafo), DoD + comandos exatos de verificação (runs/artifacts/recibos), risco bloqueante/mitigador**.
3. **Integrar a pendência do merge** (close-final-candidate→sf-ci-lean, sem conflito — atribuições claras de quem faz e quando).
4. **Ordem de chegada**: qual agente primeiro (harness sólido), qual por último (release/evidence); marcar o que pode rodar em paralelo real.
5. **Verdade intocável**: nada verde por omissão; toda suíte tem `sf/verify` real; every completion requires fresh evidence; F04/Azure explicitamente marcados como ambiente-dependente (não fingir entrega sem VM/MS auth).
6. **Riscos & incógnitas** listados com dono + prova exigida.
7. **Uma única passada**, sem pedir instrução posterior; o que for irreversível/irreportável fica marcado "DECISÃO DO DONO" e NÃO é executado pelos agentes.

## 5. Fontes de leitura no repo (o GPT deve ler todas)
- `sf/ci/PENDING-WORK.md` (backlog oficial e aceite)
- `validation/final-bundle/gpt-review-pr242.md` (adversarial PR #242: B1/B2/B3/M1–M4)
- `validation/final-bundle/gpt-review-pr240.md` (adversarial PR #240: X/Y/Z)
- `.github/workflows/sf-ci.yml`, `.github/workflows/sf-release.yml`, `.github/workflows/test-ci.yml`
- `script/sf-ci/gate.mjs`, `script/sf-ci/gate.test.mjs`, `sf/ci/suites.json`, `sf/ci/README.md`, `sf/release-target.json`
- `sf2h-plan/ci-recipes.json` e cross-file comparison sugerida pela campanha (CI-04)
- doc de contexto: `validation/final-bundle/ci-round-10-13-digest.md`

Escreva o plano como se fosse mandar 10 engenheiros para uma sprint sem mais contato. Seja exaustivo; não economize contexto.
