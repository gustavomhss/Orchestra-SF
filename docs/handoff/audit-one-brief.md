# Briefing — fechar os vermelhos do PR #349 (`audit-one`)

> Você não tem terminal. Tudo é GitHub: contents API, branches, commits, workflows, logs e artefatos.
> Não rode CI antes de fechar todos os WPs. O erro mais caro da campanha foi exatamente esse.

## 1. Estado exato

- Repo: `gustavomhss/Orchestra-SF`. PR **#349**, base `close-final-candidate`.
- Branch de integração: `audit-one`.
- SHA que o GitHub testou por último: `7c7dc2fac55d40e744a99fdce3afd9b45168eccd` (run `44541428344`).
- Dois commits **não testados** foram publicados sem PR na branch **`audit-one-tip`**:
  - `04379887030` — `override` no `BridgeError.message` (`apps/cli/src/sucafina-product/routine-native-phase-bridge.ts:46`), fecha o TS4114 do `sf/static-and-contracts`.
  - `dcdaa904af5` — abre o único fornecedor filtrado (`modules/sucafina/Sucafinav1/runtime/procurement.ts:1445`), para o controle de upload renderizar.
- Comece levando esses dois para `audit-one` (fast-forward ou cherry-pick) antes de tudo.

## 2. O que já passou em `7c7dc2fac55`

`sf/preflight`, `sf/linux-native-omni`, `sf/test-CI-CLI`, `sf/test-CI-APP-BROWSER`,
`sf/test-CI-ATLAS-BUSINESS`, `sf/test-CI-APP-SRC`, `sf/procurement-queue-integration`,
e o pacote `linux-factory` (run `44541428351`, `success`).

Não reabra esses. Se um WP tocar `apps/cli/script/distribution-payload.ts`, rode o pacote de novo
(push em `sfa-factory-package`).

## 3. O que falta (WPs)

### WP1 — typecheck do pacote core/cli
Já corrigido em `04379887030`. Só entre na branch e confirme que `sf/static-and-contracts` fica verde.

### WP2 — UI-OPERATIONS `OP-DOC-01`
`packages/app-shell/e2e/sucafina/operations.spec.ts:33` → `documents.ts:67-71`.
Falhava em `waitForResponse` e em `click` de `form[data-private-upload="supplier"][data-record=…] button[Upload document]`.
Causa: o `<details id="supplier-…">` só abria com `?supplier=`; o teste chega por `q=<nome>` com um único resultado,
e o conteúdo de `<details>` fechado não entra na árvore de acessibilidade. `dcdaa904af5` abre o único resultado.
Aceite: o caso passa e os outros quatro de `operations.spec.ts` continuam verdes.

### WP3 — UI-DECISIONS
`packages/app-shell/e2e/sucafina/decisions.spec.ts:20-21` e `:26`.
`toBeEnabled` falha com `element(s) not found`. Leia o spec: o primeiro espera o controle de versão do Planner,
o segundo a proposta de Procurement. O controle não está no DOM.
Aceite: os dois testes passam com o controle real do produto, sem afrouxar o `toBeEnabled`.

### WP4 — UI-REPORTS
`packages/app-shell/e2e/sucafina/reports.spec.ts:29` e `:44`.
Erro: `The real installation must enter Workbench before Reports`, seguido de `element(s) not found`.
O setup do WP06 não chega ao Workbench. Conserte o caminho de entrada do fixture
(`reports-support/production-installation.ts`, `wp04/host.ts`), não o assert da tela.
Aceite: os dois testes passam.

### WP5 — CI-SF-2 (10 falhas)
Arquivos e linhas (job `135620958166`):
- `local-controls-browser.test.ts:23` — inbox, recibo de leitura, backups e logout no Chrome.
- `product/wp14/domain-outcome.test.ts:65` — `Expected "ok"`, `Received "unavailable"`.
- `product/wp13/handoff-c08-integration.test.ts:72` — `C08 scenario write: {"status":"denied","reason":"result-access-unavailable"}`.
- `product/wp12/native-execution-executive.test.ts:270` e `:432` — 145 s, timeout no reviewPhase.
- `product/wp08/thread-period-continuity.test.ts:51` — rollover de ano do projeto.
- `product/wp10/integration/bi-call-scope.test.ts:99/104` — quatro casos BI (prova/escopo).
- Componentes core: `consumed POST → narrowed parent → original core Task`, `case/job/provider epochs`,
  `Request revoke interrupts only its owned original runner`, `scoped Claude parent reports the missing
  genuine governed-load observer`.
Aceite: as dez passam; nenhuma asserção removida.

### WP6 — CI-SF-8 (10 falhas)
Job `135620958748`:
- `local-entry.test.ts:132` — operador inscrito sem nome de conta do SO.
- `local-entry.test.ts:214` — sessões corporativa/local não cruzam perfis.
- `product/wp05/choice-history-bi.test.ts:85` — escolha humana + revisão de treinamento (~23 s).
- `product/wp11/promotion-coverage-proof.test.ts:56` — ordem 0-1 e 1-0 (dois testes).
- `product/wp11/renewal-choice-history.test.ts:42` — treinamento omitido + revisão de custo (~25 s).
- três componentes C11/native/human (`Maestro parent`, `human continuation`, `synthetic failure`).
- `product/review-fixes/finance-resume-performance/persisted-recertification.test.ts:25` (~12 s).
Aceite: as dez passam.

### WP7 — fecho
Os shards `SF-1`, `SF-3`, `SF-4`, `SF-5`, `SF-6` foram **cancelados** no último run; não há resultado.
Rode **um** `sf-ci` só no fim e leia os cinco.

## 4. Fatos de produto que não se inventam

- `GET /sucafina/dashboard|planner|procurement` **sem query** = `404` com body
  `legacy console decommissioned — use /`. `apps/cli/test/factory-distribution-linux.test.ts` assere isso e o
  `queue-view` também. **Não ressuscite o console.**
- `?page=<Page>` devolve o shell completo; `?asset=page` devolve fragmento; `?download` e
  `?projection=c02` são rotas de dados. `?sf=<mode>` na mesma rota são operações de produto
  (`document-*`, `import-*`, `bi-*`, `workbench-*`).
- O e2e de UI abre o app Orchestra (vite preview), mas o markup dos casos de operações vem dos renderers
  de `modules/sucafina/Sucafinav1/runtime/*` através de `packages/app-shell/e2e/sucafina/installed-console.ts`.

## 5. Mecânica de verificação (sem shell)

- Change-scoped: crie `ci-run-<nome>` no SHA do WP com `.ci-run.json` na raiz, ex.:
  `{"package":"app-shell","runner":"playwright","args":["e2e/sucafina/decisions.spec.ts"]}`.
  O workflow `test-ci` roda em push de `ci-run-*` e apaga a branch.
- Typecheck: `{"package":"core","runner":"bun","args":["typecheck"]}` (ajuste o pacote conforme o erro).
- Completo: `sf-ci` (`workflow_dispatch`) **uma vez**, no SHA final.
- Pacote: push em `sfa-factory-package`.
- Um `sf-ci` por ref: dois em paralelo cancelam o primeiro.

## 6. Regras

- Um writer por arquivo; branches por WP; merge sequencial em `audit-one`.
- Não abra PR novo; o PR é o #349.
- Não remova asserção para pasar. Se um teste só passa ressuscitando o console, é decisão do dono: pare e reporte.

## 7. Contrato de retorno

Ao terminar — concluído ou não — commite `docs/handoff/HANDOFF-audit-one.md` pelo template
(`docs/handoff/HANDOFF-TEMPLATE.md`), com SHA, feito, pendente, decisões, como retomar e gates
(ids de run + resultado). Nunca diga "verde" sem citar o run.

## 8. Decisão do dono — C12 (2026-11-19)

Opção **(b)**: o teste passa a seguir a ordem que o produto suporta. Não implementar capacidade nova.

- Em `packages/app-shell/e2e/sucafina/decisions-support/apply-recovery.ts`, aplicar primeiro a
  mudança revisada do rascunho e **depois** submeter/aprovar a requisição no Procurement.
- Em `decisions-support/procurement-source.ts`, `approveExactRequisition` continua existindo, mas
  roda **após** o Apply, não antes.
- A garantia continua: o valor aprovado tem que ser exatamente o valor revisado
  (`Estimated amount` igual a `operation.amount`) e a versão tem que avançar uma unidade.
  Não afrouxar essa igualdade.
- Continuam proibidos: fabricar aprovação, mexer em CAS, remover asserção, ou ressuscitar o
  console no GET nu.
