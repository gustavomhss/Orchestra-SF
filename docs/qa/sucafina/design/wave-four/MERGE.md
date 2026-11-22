# Quarta rodada — merge confirmado

Status: **MERGED_VERIFIED**. O usuário aprovou as telas deste bloco com **“aprovado pra merge”**.

O [PR #588](https://github.com/gustavomhss/Orchestra-SF/pull/588) foi mesclado em **21/11/2026, às 23:21:24, horário de São Paulo**. O horário original da API é `2026-11-22T02:21:24Z`.

| Referência | Valor |
| --- | --- |
| HEAD aprovado | `b757d9ef1e8b2d266b5f8df3e5511c853fe48eb7` |
| Dev imediatamente anterior | `ad47c1b804452f3a7a943a7d4dad75d74a6367e5` |
| Commit de merge | [`f2a6c23551289ef8705baea03f8cec2425b8445a`](https://github.com/gustavomhss/Orchestra-SF/commit/f2a6c23551289ef8705baea03f8cec2425b8445a) |
| Árvore real e esperada | `bbcda60c9d11477d474e7c88a3a6f4258ae644dc` |
| Produto funcional do navegador | `e5494ff044ee46cdd80c1d754131c284538d4d31` |
| Produto técnico | `0550c4bb8fc3b4b4e68561777010ca03483e2391` |
| Áreas / rotas existentes | 20 / 49 |
| Capturas revisadas deste bloco | 146 |
| Campanha após o merge | **41 áreas mescladas de 70; 29 restantes** |

## Verificação da integração

A aprovação foi aplicada ao HEAD exato mostrado ao usuário. A API de merge recebeu esse SHA como precondição. Em seguida, a leitura independente da PR e do commit confirmou `merged:true`, estado fechado, os dois pais esperados e a árvore real.

Desde o produto técnico até o HEAD aprovado, os 60 caminhos alterados contêm somente documentação e evidências. O avanço final de dev desde a base qualificada contém dez commits e 13 caminhos exclusivos de `apps/desktop/src/main/`, sem sobreposição com os 296 caminhos deste bloco. São os PRs #607/#608/#609, de segurança e logging do desktop.

A árvore esperada foi construída com os blobs do HEAD aprovado mais os 13 blobs originais de dev. Seu hash coincide exatamente com o commit de merge. O código nativo qualificado e as mudanças upstream foram preservados.

## Evidência técnica preservada

- [Gate17](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44972927162): **15 checks e 89 casos**, incluindo dois testes de escopo com 81 asserções; tipos da aplicação, E2E e CLI aprovados.
- [Decisions14](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44972048219): jornada completa aprovada, 41 capturas, 56 leituras HTTP 200 e 21 leituras após cinco minutos.
- As demais jornadas e as 146 capturas continuam atribuídas aos runs e snapshots registrados em [VALIDATION.md](VALIDATION.md) e na [galeria](evidence/README.md).
- O HEAD aprovado tinha zero check-runs e zero contextos de status. O estado combinado `pending` indicava ausência de contextos; não havia execução pendente. Os runs de qualificação do test-ci estavam concluídos com sucesso.
- Não houve alteração de código nativo ou dos testes após a qualificação. Não foi iniciada nova suíte por mudanças disjuntas do desktop, e os resultados anteriores não são apresentados como execuções no SHA de merge.

A documentação deste fechamento registra um merge já observado. Não altera produto, testes, workflows, guards ou as capturas aprovadas. [Recibo estruturado](merge.json) · [Inventário](../inventory.json).
