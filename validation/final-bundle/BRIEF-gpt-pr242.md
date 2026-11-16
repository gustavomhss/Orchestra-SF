# BRIEF — GPT review of PR #242 (lean Linux-only CI pilot, fail-closed Azure release)

**You have GitHub MCP access. Operate ONLY on repo `gustavomhss/Orchestra-SF`, branch `gpt-review-242`.**

## Tarefa
Revisar friamente, adversarialmente, o PR **#242** — `feat(sf): pilot lean Linux-only CI with fail-closed Azure release boundary` (head `sf-ci-lean` → base `close-final-candidate`, draft, 4 commits, 12 arquivos, +888/−117).
Anexado `pr242.diff` está disponível em `/tmp/pr242.diff` NO HOST de quem te despacha — não use esse caminho; use MCP: `get PR files 242` / `get diff`.

## Verdade de chão (não negocie)
- Release desta fase = **Azure VM + Web, Microsoft auth**. Windows/macOS/desktop **fora de escopo** — a remoção deles é INTENCIONAL, não um defeito.
- O release-alvo é fail-closed: nada vai para produção sem gate verde + prova explícita. Qualquer afrouxamento é defeito.
- Este repo nunca passou 100% de gate. O PR precisa PROVAR confiança, não narrá-la.

## O que caçar (cite file+line para cada achado)
1. Algum gate removido/enfraquecido que protegia typecheck, unit (linux), ou e2e Web (build/capture)? Qual exatamente, onde?
2. `sf-release.yml` / boundary de release: é realmente fail-closed? `continue-on-error`, `if: false`, allowlist, "optional" soft pass, step que engole falha?
3. Ações GitHub fixadas por SHA ou tags flutuantes? `permissions` mínimos? Nenhum `GITHUB_TOKEN` amplo?
4. `script/sf-ci/gate.mjs` + `gate.test.mjs`: o runner custom é sólido? Passa vacuamente (ex.: suite vazia = pass)? Distingue ausente/falho/pendente? Testa a si próprio de verdade?
5. `sf/suites.json` e `sf/release-target.json`: o que ficou FORA das suites vs. antes? Justificativa existe?
6. `test-ci.yml` (+10/−23): o que deixou de ser checado?
7. Gates Linux-only reduzem de verdade ou só somem? Suítes de produto (UI-*, Sucafina recipes) ainda cobrem o Web?
8. `AGENTS.md` mudança: o que diz?
9. Qualquer afrouxamento de teste (skip/ignore/assertion leve) escondido em `packages/core/test/...`.

## Entrega (contrato)
1. Commit criando **SOMENTE** `validation/final-bundle/gpt-review-pr242.md` no branch `gpt-review-242`. Nada mais de escrita: sem editar código, sem merges, sem PRs novos, sem labels.
2. Conteúdo do arquivo (autocontido, sem perguntas):
   - O que o PR faz, de fato, ≤10 bullets (sem linguagem de marketing).
   - Achados por severidade **BLOCKER / MAJOR / MINOR**, cada um com arquivos+linhas exatos.
   - O que precisa acontecer para este PR ser seguro de merge nesta branch.
   - As 3 perguntas mais desconfortáveis para o autor.
   - Cada afirmação com file+line do diff; quando não puder verificar, marque **UNVERIFIED** — não invente.
3. Commit message: `docs(review): GPT handoff for PR #242 lean Linux-only CI pilot`.
4. Responda no chat com EXATAMENTE: 5 linhas de veredicto + a URL do commit. Mais nada.
