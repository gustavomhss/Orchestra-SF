# Sessão 5 — continuar o que a sessão anterior deixou e integrar

Branch a criar: `sf-continuation`
Base: `f7dd58e32bc834f1485df20b91adbf759b4c4ad0` (sf-join-four)
Acesso: apenas GitHub (`gustavomhss/Orchestra-SF`). Sem shell. Verificação por Actions.

Esta sessão **não** refaz o trabalho das sessões 1–4 (UI e shards). Ela fecha o que ficou solto e atua como integradora.

## Parte A — fechar os restos da sessão anterior

1. Leia, na `sf-join-four`, os handoffs recentes em `docs/handoff/`:
   `HANDOFF-lastmile-wp1..wp5`, `HANDOFF-finish-ingress-*`, `HANDOFF-finish-operations-*`, `HANDOFF-finish-ci-*`, `HANDOFF-finish-units-*`.
2. Inspecione o run **44631696084** (`ci-run-linux-reports15`, failure em 23:04Z). Identifique a primeira asserção que falhou, com `file:line`. Se a causa já estiver coberta pela Sessão 1 (link "Reports and backup"), registre e siga.
3. PRs abertos:
   - **#393** (`merge-filecodecs`): rode `gh pr checks 393`. Se todos os checks estiverem `success`, `gh pr merge 393 --merge`. Se algum falhar, deixe aberto e registre o check.
   - **#392** (`finish-proposals-native`): está **draft**. Não mergeie, não marque ready.
4. Branches não integradas com trabalho recente:
   - `finish-operations-20261119` (último push 21:26Z)
   - `finish-ingress-20261119` (21:19Z)
   Para cada uma: diff contra `sf-join-four`, veja se há trabalho qualificado por um handoff `complete`. Se sim, abra PR e faça o gate do spec afetado via `ci-run-*`. Merge só com conclusão `success` e handoff correspondente. Se não houver qualificação, deixe como está e registre.

## Parte B — integração

Ordem de merge em `sf-join-four` (um por vez, gate antes de cada merge):

1. PRs `shared:` (código compartilhado) das sessões 1–4.
2. `sf-ui-c02` (Sessão 1).
3. `sf-shard-a`, `sf-shard-b`, `sf-shard-c` (Sessões 2–4).
4. Restos qualificados da Parte A.

Depois do último merge:

```bash
bun run check:guards --base origin/dev   # esperado: 0 errors; 2 GATE protected-paths herdados
```

E **um único** `sf-ci`:

```bash
gh workflow run 420530405 --ref sf-join-four -R gustavomhss/Orchestra-SF
gh run list -R gustavomhss/Orchestra-SF --workflow sf-ci.yml --limit 1
```

`CI-UI-REPORTS`, `CI-UI-DECISIONS` e `CI-SF` têm baseline `PENDING_REAL_COMPLETE_RUN`: **falham por desenho** nesta primeira corrida completa. Não edite `sf/ci/suites.json`, não invente hash. Registre o artefato produzido — ele é o insumo do baseline.

Em `workflow_dispatch` o job estático falha nos dois `protected-paths` herdados (não há label de PR). Esperado.

## Parte C — pacote

Crie a branch `sfa-factory-package` apontando para o SHA congelado. O workflow `sf-factory-package` roda no push. Registre run id, artefato e `sha256`. Sem GO, sem deploy, sem `SF_ORCHESTRA_WEB_PACKAGE_VERIFIED`.

## Economia de CI (obrigatório)
- Um gate por causa corrigida; nunca repita gate idêntico sem mudança de código.
- Gate só depois de um fix concreto.
- No máximo 2 gates simultâneos.
- `sf-ci` uma única vez, no fim, com todos os merges já feitos.
- Mesmo gate falhando 2x no mesmo ponto sem mudança: pare e registre `unbound`.

## Regras
- Não recrie console morto; não edite `modules/sucafina/Sucafinav1/runtime/application.ts`; não use `:4110`.
- Não enfraqueça asserção; não forje baseline/coverage/digest/GO.
- Nada de push em `close-final-candidate`, `sf-red-clusters`, `go-live-close`, `sf-frontend-bundle`. PR #237 fica draft.
- `reviews.export.docx/pptx` são `Schema.Never`; bytes reais só por `GET ?sf=review-download`.

## Handoff (obrigatório, mesmo parcial)
`docs/handoff/HANDOFF-sf-continuation.md` no template: SHA, estado, o que foi mergeado e em que ordem, o que ficou aberto e por quê, resultado do `sf-ci` por job, artefato/baseline, pacote com `sha256`, como retomar.

## Retorno
`SHA final | ordem de merges | guards | sf-ci run id + resultado por job | pacote sha256 | unbound(file:line)`.
