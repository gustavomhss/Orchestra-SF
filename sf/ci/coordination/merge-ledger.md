# A1 — merge ledger / fila de integração (W0–W1, 2026-11-16)
**Controle:** apenas coordenação. Nenhum merge, cherry-pick, aprovação, alteração de branch alheio ou mudança de proteção foi executado pelo A1. Fonte: metadados/compare de GitHub MCP consultados em 2026-11-16. Este registro não é freeze C nem aceite de CI.

## Referências verificadas
| Ref | SHA observado | Fonte / situação |
|---|---|---|
| `sfa-coord` (pré-ledger) | `a824fd21f0ac1bc29c77bca611c60f85d023c41a` | branch A1; único branch com permissão de commit |
| `close-final-candidate` | `1cb77b8deb144e01a655c36987922338b1474003` | destino dos PRs; não atualizar pelo A1 |
| `sf-ci-lean` | `2f94d74d50dceee8a3c0562feac27a7335171ae8` | head PR #242; aguarda F0 e correções B1–B3/M2–M4 |
| `close-tests-fixes` | `a2c49fc8bfa329a47721135b7d9d3a39ab056769` | head PR #240, X/Y/Z não resolvidos |
| `godfile-waivers` | `2e1cee39a133400c41bfe3426f9a3927885cbff4` | head PR #243; label visível, merge humano |
| fix Planner | `524f6ed87e34c9c80c40993d7371eccfd41eaae4` | ancestral de `close-final-candidate` comprovado por compare (ahead 1) |

**Conflito crítico de ancestralidade:** `compare close-final-candidate...sfa-coord` retornou `diverged`, **ahead=18**, **behind=2**, merge-base `ae7850a7e397e8f0e60033ae4c5eca5e11b77c7f`. O branch A1 já herda 16 arquivos alterados do piloto CI e documentos adicionais, antes de qualquer edição A1; um PR deste branch não é diff puro de 5 ledgers. Nunca chamar esse PR de pronto para merge. A6/dono devem reconciliar proveniência/ordem sem A1 reescrever ou tocar outros leases. Nenhum path protegido foi alterado nesta entrega A1.

## PRs e fila — não autoriza merge
| Item | Estado verificado | Dono executivo / próxima ação | Gate |
|---|---|---|---|
| [#242](https://github.com/gustavomhss/Orchestra-SF/pull/242), `sf-ci-lean → close-final-candidate` | OPEN, DRAFT, mergeable=true, 16 arquivos; histórico de CI RED. Nenhum GitHub review formal encontrado. | A2 B2/M4, A6 B1/B3/M2/M3 + F0; A1 parecer frio em `sf/ci/reviews/final-cold-review.md` | **CHANGES_REQUIRED / NÃO MERGEAR** |
| [#240](https://github.com/gustavomhss/Orchestra-SF/pull/240), `close-tests-fixes → close-final-candidate` | OPEN, DRAFT, mergeable=false, base do PR antiga `7dafb6bf...` | A5 remover casts X, decoder Y, provar Z com consumidores; revisão independente depois | **CHANGES_REQUIRED** |
| [#243](https://github.com/gustavomhss/Orchestra-SF/pull/243), `godfile-waivers → close-final-candidate` | OPEN, DRAFT, mergeable=true; `guardrail-approved` presente no endpoint de labels (2026-11-16) | **Dono** verifica elegibilidade/mesma data/ordem e decide, sem A1 autoaprovar | **DECISÃO DO DONO; NÃO É DEPENDÊNCIA CI** |
| F0 `close-final-candidate → sf-ci-lean` | **NÃO EXECUTADO pelo A1**, integração/análise de ancestralidade pendente; não inferir que fix TS2322 foi provado no CI. | **A6 ÚNICO integrador**: reconsultar refs, integrar com audit trail, gerar head fresco; teste typecheck real após integração | **PENDING_A6** |
| Candidate freeze C / release | Não existe `PRODUCT_CI_GREEN`; histórico 12 jobs de 43958796792 terminou com 7 falhas (incluindo verify) | A10 freeze depois de A2–A6, três revisores, e owner | **BLOCKED** |

**Nota sobre TS2322:** o arquivo de Planner `overview/index.tsx:331` em `close-final-candidate` diverge do que aparece em `sf-ci-lean`/pré-ledger A1 (atributos SVG em expressões vs strings). A execução de merge ref `31955bc313fa3f5ca1e52689c0007560810f0e72` no run 43958796792 ainda falhou TS2322. Não presumir que existência do fix na base significa compilação verde. A3/A6 devem examinar a árvore **efetivamente** compilada e reexecutar após F0.

## Política de fila e segurança
1. A1 só inventaria/transfere pedidos; nenhum lease de escrita foi transferido. Leases de A2–A10 permanecem os do `sf/ci/GPT-PLAN-10.md`.
2. A6 aplica merges de integração controlados; dono aceita/rejeita PRs finais. Não fazer merge de #240/#242/#243 por inferência de `mergeable`.
3. Protected NO-TOUCH: `script/godfile.ts`, `script/spawn-imports/**`, `script/guards/**`, `godfile-waivers.json`. Label #243 não concede autorização genérica.
4. Qualquer novo SHA de workflow/código/config invalida prova prévia. `CI_HARNESS_VALIDATED=PARTIAL`, `PRODUCT_CI_GREEN=NO`, `AZURE_RELEASE_QUALIFIED=BLOCKED`; exigir evidência endereçável antes de mudar flags.
