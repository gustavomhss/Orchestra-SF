# Orchestra-SF — Briefing de execução no GitHub (Astra / GPT Pro + GitHub MCP)

> Você não tem terminal nem acesso à máquina do dono. Todo trabalho é pelo GitHub: ler arquivos, criar branches, commitar, abrir PR, disparar workflows e ler logs/artefatos. Toda verificação acontece em GitHub Actions.

Você vai terminar a última milha do go-live do Orchestra-SF. O produto nativo já existe; falta fechar o contrato das jornadas E2E de UI, que em vários pontos ainda dirigem um console descomissionado.

---

## 1. Missão e definição de pronto

**Missão:** fazer as três jornadas de UI (Operations, Decisions, Reports) rodarem contra os capítulos nativos, com os fatos vindo do produtor — e entregar um handoff commitado, concluído ou não.

**Pronto quando:**
1. `packages/app-shell/e2e/sucafina/{operations,decisions,reports}.spec.ts` e seus helpers não dependem de markup do console morto — ou cada resto está listado como `unbound` com `file:line` e o motivo.
2. Os gates rodaram no GitHub e você reporta o resultado nominal de cada um.
3. Existe handoff commitado (seção 9), **mesmo incompleto**.

**Um `sf-ci` só no fim.** Antes disso, verificação change-scoped por `ci-run-*` (seção 4).

---

## 2. O produto, em uma página

**Orchestra** é app desktop + servidor local que hospeda "capítulos" em rotas `/orchestra/...`. **Sucafina** é o produto de negócio dentro dele.

| Face | O que é | Estado |
|---|---|---|
| Console legado | HTML server-rendered em `/sucafina/dashboard`, `/planner`, `/procurement` | **Descomissionado: 404** |
| Superfície nativa | Capítulos do Orchestra (`/orchestra/sf-*`) | **É o que vai ao ar** |

Regra central: **o produtor calcula, o capítulo renderiza.** Dinheiro, percentual, score e conversão FX nunca são calculados no componente.

Camadas:

```
packages/schema  →  core, protocol  →  server
                                   ↘  client  →  app-shell
apps/cli compõe produto + server + client
modules/sucafina/Sucafinav1 é o domínio
```

Peças:

- **Projeções** montadas em `apps/cli/src/sucafina-product/native-ui/*.ts`, calculadas em `modules/sucafina/Sucafinav1/product/**`.
- **Comandos**: `domain.page.CAPxx` (leitura) e `domain.command.CAPxx.*` (mutação) — ex.: `domain.command.CAP18.save` (linha OPEX), `domain.command.CAP25.*` (procurement), `domain.command.CAP03.save-month`.
- **Mutação = rascunho → review → confirmação com CAS**: `[data-component="sf-change-review"]`, heading `Review changes`, botões `Confirm action` / `Confirm once`, `data-version`.
- **Rotas do produtor** com `?sf=<modo>`: `review-agenda`, `review-download`, `review-read`.
- **E2E**: Playwright em `packages/app-shell/e2e/sucafina/`, browser em `http://127.0.0.1:3000`.

---

## 3. Estado exato

- Repo `gustavomhss/Orchestra-SF`; default `dev`.
- Branch de integração: **`sf-join-four`** @ `f590e80e7b4b5d6ae17ca753b40583019b50a998`.
- Typecheck 0 nos três pacotes nesse SHA (verificado antes do handoff).
- Guards: 0 errors, 183 warns, 2 GATE `protected-paths` herdados (`godfile-waivers.json`, `script/spawn-allowlist.json`).
- Resíduo de console morto em `e2e/sucafina`: **66 ocorrências** — wp04 (29), dashboard-installed (10), bi-installed (9), wp03 (3), wp10 (2), review-flow (2), e 1 em sourcing-controller, first-agenda, operations/runtime.ts, operations/procurement.ts.

Suítes (`sf/ci/suites.json`):

| Suite | Alvo | Baseline |
|---|---|---|
| `CI-UI-OPERATIONS` | `e2e/sucafina/operations.spec.ts` | historic |
| `CI-UI-DECISIONS` | `e2e/sucafina/decisions.spec.ts` | **PENDING_REAL_COMPLETE_RUN** |
| `CI-UI-REPORTS` | `e2e/sucafina/reports.spec.ts` | **PENDING_REAL_COMPLETE_RUN** |
| `CI-SF` | `modules/sucafina` | **PENDING_REAL_COMPLETE_RUN** |
| `CI-CLI`, `CI-APP-SRC`, `CI-APP-BROWSER`, `CI-ATLAS-BUSINESS` | pacotes | historic |

`PENDING_REAL_COMPLETE_RUN` falha por desenho: a primeira corrida Linux real produz o artefato que vira baseline. Não edite `sf/ci/suites.json`.

---

## 4. Como trabalhar e como verificar (sem shell)

**Editar/commitar:** crie branch a partir de `sf-join-four` (`refs/heads/<wp-branch>`), edite arquivos pelo contents API, commit com mensagem convencional (`type(scope): summary`). Um writer por arquivo; branches por WP.

**Typecheck e testes change-scoped** rodam em Actions. O workflow `test-ci` executa em push de branch `ci-run-*` e lê um `.ci-run.json` na raiz:

```json
{ "package": "app-shell", "runner": "playwright",
  "args": ["e2e/sucafina/operations.spec.ts"] }
```

Fluxo: crie `refs/heads/ci-run-<nome>` apontando para o SHA do seu WP, commit `.ci-run.json` nessa branch, e o workflow roda e apaga a branch. Use isso como gate por WP — é o equivalente remoto de `bun run test:ci`. Para testes `bun`, troque `runner` para `bun` e `args` para os arquivos.

**Guards:** precisam de checkout; rode-os dentro de um `ci-run-*` com `runner: "bun"` e args do script, ou aceite a leitura feita no SHA atual (0 errors) e reporte.

**`sf-ci` (completo, no fim):**

```bash
gh workflow run 420530405 --ref sf-join-four -R gustavomhss/Orchestra-SF
gh run list -R gustavomhss/Orchestra-SF --workflow sf-ci.yml --limit 3
```

Em `workflow_dispatch` o job estático falha nos dois `protected-paths` herdados (não há label de PR). Isso é esperado e declarado.

**Pacote (WP6):** o workflow `sf-factory-package` roda em push na branch `sfa-factory-package`. Crie essa branch apontando para o SHA congelado e registre o resultado/artefato. Sem GO, sem deploy.

---

## 5. Regras (com motivo em uma linha)

1. **Não recrie o console morto**: nada de `div#content`, `body[data-surface]`, heading `Decisions`, `aside.sidebar`, `Homologação local`, `details/summary`, `section[id="<id>-pr"] form[data-command]`. Fazer o capítulo imitar o console mente sobre qual produto está no ar.
2. **Não edite** `modules/sucafina/Sucafinav1/runtime/application.ts` nem HTML de console. A descomissão é decisão de produto.
3. **Não aponte browser para `:4110`**: é preview local; o e2e usa `:3000`.
4. **Não enfraqueça asserção** (apagar, pular, ampliar timeout, trocar por check vazio). Retarget só com controle real que prova o mesmo fato. Se o produtor não carrega o dado, remova e **registre a justificativa no handoff**.
5. **Não forje** baseline, coverage, digest de pacote ou recibo; `PENDING_REAL_COMPLETE_RUN` existe para isso.
6. **Não edite** `sf/release-target.json`; **não declare GO** nem `SF_ORCHESTRA_WEB_PACKAGE_VERIFIED`.
7. **Nada de push** em `close-final-candidate`, `sf-red-clusters`, `go-live-close`, `sf-frontend-bundle`; PR #237 fica draft.
8. **Um `sf-ci` só no fim**; duas corridas no mesmo ref se cancelam.

---

## 6. Fatos que não se inventa

- `reviews.export.docx` / `reviews.export.pptx`: `output: Schema.Never`, client devolve `unavailable()`. Não use, não "conserte". Bytes Office saem por `GET ?sf=review-download` (mime Office, `attachment; .docx/.pptx`, `artifactRef=report:<sha256>`) — provado em `e2e/sucafina/native/journeys/reports-issuer.spec.ts`.
- `reviews.report.prepare` aceita só `{ reviewRef, sectionRefs, format: "docx"|"pptx" }`. Sem year/title/pages livres.
- `reviews.review-thread-context` é quem emite o `reviewDigest`.
- `procurementMonetaryFacts` → `original`, `baseAmount`, `validRate`, `fxSource`, `monetaryState`; `quoteAssessment` → ranking, elegibilidade, score.
- Detalhe de request: `article[data-sf-request-ref]`, `dl` de fatos, seções por estágio, histórico `[data-stage="history"]`.
- Aprovação: `section.sf-u13-remaining-detail` com `Approval comment`, `Approve current step`, `Confirm once`.
- Fila: `tr[data-sf-row]`, coluna "Value basis" (`sourceRef`/`sourceDigest`/`monetaryState`), link `?request=<id>#<id>`.
- Planner: `#sf-u46-name`, `#sf-u46-year`, `tr[data-sf-row]`; linha OPEX por `domain.command.CAP18.save`.

---

## 7. Work packages

Um branch por WP a partir de `sf-join-four`. Ao final de cada um: `ci-run-*` com o spec afetado e retorno com SHA, arquivos, resultado e `unbound(file:line)`.

### WP1 — `reports-support/review-flow.ts`
Parcialmente retargetado. Faltam:
- `:118` remover **um registro** (agenda só remove seção inteira, `agenda/index.tsx:308`)
- `:150`, `:152` **revisão nova** (UI48 só lê disponibilidade de sucessor, `preserved/index.tsx:129`)
- `:189` **editor de forecast** (não é o editor do capítulo, `dashboard/opex/surface.tsx:711`)
- `:311` **Open meeting** (região está em `preserved/index.tsx:286`)
- `:338`, `:340` linhas **`sf-source:`** (capítulo: `preserved/model.ts:77`)
- `:343` follow-source preso à região de preparação antiga

### WP2 — `dashboard-installed`
- `support.ts:117,122,131,150,163,170` — `form[data-page="Hot Topics"|"OPEX Detail"][data-command="save"|"save-entry"|"year-amount"]`
- `records-signals-history.spec.ts:119,147,150,153` — form IT Risks e `body[data-surface]`
- `confirmation-access.spec.ts:102` — `form[data-page="OPEX Detail"][data-command="year-amount"]`

### WP3 — `bi-installed`
- `installed-fixture.ts:208,212,230,303,310`
- `installed-planner-ingress.spec.ts:78,92,100,127`

### WP4 — leftovers
- `wp03/planner-mounted.spec.ts:17,84,194`
- `wp10/extended-flows.ts:76,96`
- `review-agenda-support/first-agenda.ts:15` (`#content` + heading `Decisions`)

### WP5 — wp04
- `wp04/procurement.spec.ts` (29 ocorrências) e `wp04/sourcing-controller.spec.ts` (1)
- Reuse o contrato já correto de `operations-support/procurement.ts` e `decisions-support/procurement-source.ts`.

### WP6 — pacote
Branch `sfa-factory-package` no SHA congelado → workflow `sf-factory-package` → registre artefato e sha256. Sem GO.

### WP7 — fechamento
Merge dos WPs em `sf-join-four` (um por vez) → guards → **um** `sf-ci` no SHA final → resultado por job.

---

## 8. Não patchar (recusas corretas) e commits já rejeitados

**Recusas corretas:** `action-create-identity-unavailable`; `result-access-unavailable` (C08); `SF_NATIVE_PHASE_UNAVAILABLE`; `analysis-authority-changed` (`analysis-http.ts:60,77`); `analysis-source-unavailable` (`input-producer-memory.ts:22`); fences de `outcome-selection.ts:35/51`; BI drilldown `null` quando `refs.length !== 1`; mission49 ENOENT; timeouts 30s/120s; finance threshold 55000; BI09/BI10 deadlines; Atlas `unavailable`; AM02 `selectionRef`; OPS `confirmed:false`; issuer dia fora de 2027; `estAmount` em `ok`; ordem de promoção invertida.

**Não repita:** `7f5de402` (injetou `#content`+`Decisions`), `692ae649` (HTML do runtime na rota + POST em `/procurement`), `2524c0a` (no-op), `f507c378` (ligou a jornada a `form.report-form` antes de existir), `e8dfeb4c` (apagava `coverageState`), `f0a351c90d`/`fbaaa47a6a` (console velho / `:4110`).

---

## 9. Handoff obrigatório (sempre, mesmo incompleto)

Antes de encerrar — concluído ou não — commite `docs/handoff/HANDOFF-<branch>.md` (template em `docs/handoff/HANDOFF-TEMPLATE.md`):

```md
# Handoff — <branch>
SHA: <sha>
Data: <ISO-8601>
Estado: complete | partial | blocked

## Feito
- <item> — <arquivos> — <evidência: workflow/run + resultado>

## Pendente
- <item> — file:line — motivo (controle inexistente | produtor não calcula | decisão do dono)

## Decisões e justificativas
- Asserções removidas: <quais e por quê>
- Controles inexistentes: <file:line>

## Como retomar
1. <branch/SHA>
2. <primeiro passo>
3. <próximo passo>

## Gates
- ci-run-<nome> (run id): <resultado>
- sf-ci (run id): <resultado | não rodado>
```

Escrito para outro engenheiro continuar sem perguntar nada. Se algo não rodou, diga "não rodado" e por quê.

---

## 10. Ordem

1. Confirme `sf-join-four` = `f590e80e7b4b5d6ae17ca753b40583019b50a998`.
2. WP1–WP5 em branches paralelas, arquivos disjuntos, cada um com `ci-run-*`.
3. Merge sequencial em `sf-join-four`.
4. WP6 (pacote) e WP7 (guards + um `sf-ci`).
5. Handoff final.

## 11. Retorno para o dono
Por WP: `SHA | arquivos | resumo | run id + resultado | unbound(file:line)`. Nunca "verde" sem citar o run. Nunca GO.
