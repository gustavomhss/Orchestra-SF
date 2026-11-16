# BRIEF — GPT review of PR #240 (fix test and native E2E type contracts)

**You have GitHub MCP access. Operate ONLY on repo `gustavomhss/Orchestra-SF`, branch `gpt-review-240`.**

## Tarefa
Revisar friamente, adversarialmente, o PR **#240** — `fix(sucafina): repair test and native E2E type contracts` (head `close-tests-fixes` → base `close-final-candidate`, draft, 1 commit, 11 arquivos, +34/−25).
Use MCP: `get PR files 240`.

## Verdade de chão (não negocie)
- Release = **Azure VM + Web, Microsoft auth** — tipos dos contratos que alimentam o cliente web são o jogo inteiro.
- Correções de teste por afrouxamento de asserção, `as any`, skip silencioso ou undefined-tolerance são o modo de falha clássico desse tipo de "fix".

## O que caçar (cite file+line para cada achado)
1. Cada teste tocado: o fix é real (contrato corrigido, expectativa apertada ao tipo verdadeiro) ou é amolecimento (asserção afrouxada/removida, `as unknown as`, `as any`, `.skip`, aceitar `undefined`/`null` por conveniência)?
2. Algum teste removido/desabilitado? Por quê?
3. Compatibilidade com o resto do repo: o contrato type-level quebra consumidores? (considerar o Sucafinav1 workspace + app-shell.)
4. Nenhum gate foi silenciado para "passar".

## Entrega (contrato)
1. Commit criando **SOMENTE** `validation/final-bundle/gpt-review-pr240.md` no branch `gpt-review-240`. Nada mais de escrita.
2. Conteúdo do arquivo (autocontido):
   - O que o PR altera, ≤5 bullets.
   - Por arquivo tocado: real fix ou amolecimento — com file+line.
   - Achados por severidade (BLOCKER/MAJOR/MINOR).
   - Veredicto: merge as-is, ou mudanças X, Y, Z antes.
   - Toda afirmação com file+line; marque **UNVERIFIED** o que não der para checar.
3. Commit message: `docs(review): GPT handoff for PR #240 test type contracts`.
4. Responda no chat com EXATAMENTE: 5 linhas de veredicto + a URL do commit. Mais nada.
