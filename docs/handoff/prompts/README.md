# Prompts — cinco sessões paralelas

Base para todas: `f7dd58e32bc834f1485df20b91adbf759b4c4ad0` (`sf-join-four`).
Todas trabalham só via GitHub (`gustavomhss/Orchestra-SF`), sem shell; verificação por Actions.

| # | Sessão | Branch | Escopo |
|---|---|---|---|
| 1 | UI | `sf-ui-c02` | anchors C02 na tabela de Requests, origem do host wp04, link "Reports and backup" |
| 2 | Shards SF 1–3 | `sf-shard-a` | `CI-SF` shards 1, 2, 3 |
| 3 | Shards SF 4–6 | `sf-shard-b` | `CI-SF` shards 4, 5, 6 |
| 4 | Shards SF 7–8 | `sf-shard-c` | `CI-SF` shards 7, 8 + mapa agregado |
| 5 | Continuação/Integração | `sf-continuation` | restos da sessão anterior, merges, guards, um `sf-ci`, pacote |

Arquivos:
- `SESSION-1-ui.md`
- `SESSION-2-shards-1-3.md`
- `SESSION-3-shards-4-6.md`
- `SESSION-4-shards-7-8.md`
- `SESSION-5-continuation.md`

## Regras comuns a todas

**Economia de CI**
- Um gate por causa corrigida, não por arquivo.
- Nunca repetir um gate idêntico sem mudança de código.
- Gate só depois de um fix concreto; não use gate para "ver como está".
- No máximo 2 gates simultâneos por sessão.
- Mesmo gate falhando 2x no mesmo ponto sem mudança: pare, registre `unbound` com `file:line`.
- `sf-ci` é exclusivo da Sessão 5, uma única vez.

**Proibido**
- Recriar console morto: `#content`, `data-surface`, heading `Decisions`, `sidebar`, `Homologação local`, `details/summary`, `section[id]-pr` com `form[data-command]`.
- Editar `modules/sucafina/Sucafinav1/runtime/application.ts`.
- Browser em `:4110`.
- Enfraquecer asserção (apagar, pular, timeout maior, check vazio).
- Forjar baseline/coverage/digest/GO. `reviews.export.docx/pptx` são `Schema.Never`.
- Push em `close-final-candidate`, `sf-red-clusters`, `go-live-close`, `sf-frontend-bundle`. PR #237 fica draft.

**Código compartilhado**
Mudança fora dos arquivos que a sessão possui vai em PR separado com título `shared:`.
Não rebaseie outros branches; informe a ordem de merge no handoff.

**Handoff**
Toda sessão termina com `docs/handoff/HANDOFF-<branch>.md` segundo `docs/handoff/HANDOFF-TEMPLATE.md`, mesmo incompleta.
