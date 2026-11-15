# Missão 205 — handoff S05 para 189, 190 e 200

**Source ARTIFACT_READY; produto e prova PENDING.** Modelo real GPT-6, sessão browser independente solicitada; identificador de sessão não exposto. Epoch `compiler-source-e1-browser205`. HEAD reservado `988d770ed29fa947ef20eb19ca94cd3379158c28`, fence `298e9e894fda018c895ed4be0f968563355e03e3` e ACK commit `ceb453a68920ca8ff82a8acb20ada34227c5fec9` por expected-head CAS. Nenhuma alegação de terminação do predecessor.

## Falha real

[Browser run43773852118](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43773852118) job132995508966: 7 PASS/1 FAIL em 4 arquivos; S05 4 PASS/1 FAIL em `s05.test.ts:170` na transição `denied → novo owner → ready`. `props.draft` da fixture tem CRLF; o DOM exige LF. O formatter Bun mostra Received e Expected visualmente iguais e 0 linhas divergentes, **sem capturar os bytes Received**; a diferença CRLF/LF é inferida a partir da fonte e da ausência de diff visível, não apresentada como leitura de bytes recebidos que o log não possui.

Raw fixture: `"  Next owner\r\nstill exact  "` bytes `20 20 4e 65 78 74 20 6f 77 6e 65 72 0d 0a 73 74 69 6c 6c 20 65 78 61 63 74 20 20`; DOM esperado `"  Next owner\nstill exact  "` bytes `20 20 4e 65 78 74 20 6f 77 6e 65 72 0a 73 74 69 6c 6c 20 65 78 61 63 74 20 20`. Fonte original fornecia CRLF cru ao `textarea.value` e ao efeito imperativo; a correção aplica `domDraft() = props.draft.replace(/\r\n?/g, "\n")` à **apresentação apenas**. Teste mantém `.toBe` e `.toEqual` originais e inspeciona bytes via `TextEncoder` tanto de textarea como do segundo payload onPost.

## Código/hashes

- Commit código [`dce549842`](https://github.com/gustavomhss/Orchestra-SF/commit/dce549842bb75de8edb6d1a8c317fa01edc8a96c), tree `d31f96591ec7cf964efe676e2f7687efd398c88c`.
- Commit assertions [`26fca4e3`](https://github.com/gustavomhss/Orchestra-SF/commit/26fca4e3a4f5fad0e83f853a0c0acb386b96bda3), tree `2084b75e903cb3e6ee5dbc6392747a1956655c2a`.
- `packages/app-shell/src/orchestra/chapters/sucafina/collaboration/index.tsx`: PRE `b528b13c89ee5f66c398e0c7fc2b6cf1aa996639` → POST `619402f411f6592cc7bfdcd9d2d97a834d36c26c`.
- `packages/app-shell/test-browser/sucafina-native/s05.test.ts`: PRE `5d02157e04299a299cd3c4fada3dd19913a59598` → POST `313372865426a047cc500d1dba891a75cb8fa047`.
- **PATCH.md** nesta pasta contém diffs completos dos dois commits, com pre/post verificáveis. **ARTIFACT.json** inclui o envelope, proveniência, critério e estados.

## Semântica preservada

`SfThread` mantém callback `onEditDraft`, payload do `onPost.text = props.draft` byte-exato (inclusive whitespace e CRLF), `postFence` por threadRef/incarnation/version, e `onReconcileRead` somente leitura. As transições `outcome-unknown/unavailable` não repostam; a ausência de receipt não vira sucesso ou falha. `denied/session-expired` não mostram conteúdo privado; novo owner não herda DOM draft, mensagens nem postFence. O verdadeiro consumidor U44 invalida projection/storageVersion/draft/pending em ownerKey/accessRevision/generation/route, aborta requests e recusa stale response. Não editamos U44 nem fake-grants, schemas, generated, fixtures, i18n, engine ou código das missões 193–199.

S05-AC01/AC02, WP08.T01/T02/T03/T06, UI51–53, contratos públicos e demais critérios congelados permanecem. Fonte corrigida não equivale a PASS hospedado nem prova nativa instalada.

## Ação de 189, único integrador

Consumer observado em `sf2-stack` HEAD `6130f682014662964a2f2fcd2c0c487a904ecd3e`, tree `6bef2964c3904aef5b92017c6e0e1aaa2d236a25`, com ambos blobs PRE exatos acima. Aplicar exclusivamente ambos blobs POST por expected-head/preimage CAS, `force:false`, sem merge da branch autora. Se houver drift desde esta observação, reconciliar somente esse delta. Publicar novo HEAD/tree/W integrado e ACK real para 190/200. Não marcar consumo com comentário.

## 200, único dispatcher de produto, PR106

**PENDING/NOT_DISPATCHED:** após ACK real de 189, deduplicar W/tree/runner/runtime/fixtures/seleção, executar apenas `test-ci` via runner existente com `package=app`, diretório `packages/app-shell`, runner `bun`, seleção exata `["./test-browser/sucafina-native/s05.test.ts"]` (incluindo `./`). Esperados 5 testes S05 e limites de bytes. Não repetir os outros 7 PASS do antigo run ou testar input idêntico. O run antigo não prova novo produto nem D01.

## 190, compiler/guards, PR107

**PENDING/NOT_DISPATCHED:** após o mesmo ACK de 189 com W/tree real, selecionar `packages/app-shell` / `bun typecheck` sob executor compiler existente, com guards causais conforme matriz e dedup. [Run43772959867](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43772959867) job132992733158/artifact14185067705 e `FINDINGS-190-W77e.md` são de um W antigo, **não** do produto atual; falhas externas não autorizam relaxar schema ou regenerar SDK manualmente.

**Validação feita por 205:** leitura/causal GitHub Actions, código e recibos; `local_tests=NOT_RUN`, `hosted_browser_after_patch=NOT_RUN`, `typecheck=NOT_RUN`, `build=NOT_RUN`, `guards=NOT_RUN`, `SDK=NOT_RUN`, `native_e2e=NOT_RUN`. F04/187 ainda não prova instalação/identidades reais, D01 não é PASS. `native_goal=paused`, `GLOBAL_RELEASE=false`. Comentários nas PRs são avisos passivos, não ACK/wake de outros chats.
