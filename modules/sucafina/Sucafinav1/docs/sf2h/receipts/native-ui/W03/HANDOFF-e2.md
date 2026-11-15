# W03/F02 — handoff terminal de autoria e2

**Status `ARTIFACT_READY` (código exclusivo real); `NOT_INTEGRATED`, `NOT_QUALIFIED`, `NOT_RUN`.** É a continuação fiel do [handoff e1](./HANDOFF.md) e dos quatro textos em `proposed/`. Estes textos permanecem históricos; não se deve reaplicar `F02-PROPOSED.patch` sobre os arquivos reais.

## Autoridade e commit

- Nova sessão GPT-6 W03, epoch exclusivo `ux-native-w03-e2` sobre `sf-ux-w03`, PR [#122](https://github.com/gustavomhss/Orchestra-SF/pull/122), confirmado S0 `8852ed4a060f6eb3b49c142b894852d0af49740f`.
- HEAD inicial/fence e2 `b44099f05b470ea783bf0f5aa2e69862f78ea62e`. ACK real `ACK-e2.json` no commit `c873a5bddbbfa4ea0f089a9cf0bf13d86a523922`. Identificador da sessão browser não exposto; `session_id=null`. Auth GitHub `gustavomhss`, modelo GPT-6, não inventar ator/ID.
- **Commit único de produto** `7c1a365c01d5e9cc72554f3258117a33db9f59fe`; tree `a0a3d7cd2ce8b68362eccb15ef48fe78c7f32445`; CAS esperado `c873a5b...`, `force=false`; zero reset/rebase. Paths antes ausentes na HEAD do fence, portanto preimage **null**, não um blob fictício.
- Base material C58 `422f1ed7b549021d7c62c834c9d9041279112af4`. Catalog `31dbec1726fd8147156b01dc545726650ffd49e1`; CONTRACTS `94553a3119826ef1c44271966233dd58042ddd70`; host signatures `e99e094fc3ad5e74832a55aa2639c6bdb27f5255`; route signatures `ea99b96a7a7e0ee860ed2c0fac137f6fc4e42e81`. O produtor local identity C58 `473b9dbfe56092af26f0de2927767b8d64b79e1b` foi preservado (reforço durável de revogação), sem restauração da fonte histórica.
- Leitura: `AGENTS.md`, `packages/schema/AGENTS.md`, `COMMON.md`, `EXECUTION-PROTOCOL.md`, `manifest.json`, `host-signatures.ts`, `route-signatures.ts`, `CONTRACTS.md`, catálogo, locks/plan, F02 e predecessor e1. Canonical task refs `WP00.T02`, `WP10.T01`, `WP11.T04`, herdados por criteria-trace (não dispensam os axiomas WP/campanha).

## Produto materializado — target preimage (null) → postimage blob

| Arquivo e owner W03 | Preimage | Postimage blob |
|---|---|---|
| `packages/schema/src/sucafina/common.ts` | `null` | `f486d0bdb266935791059514c11c34372204623f` |
| `packages/client/src/sucafina/transport.ts` | `null` | `ff509a7b742b81939a15f0439ca7f4a3d4b858e9` |
| `apps/cli/src/sucafina-product/native-ui/router.ts` | `null` | `860d44eb7c215aafe05eba0df265a721c563c148` |
| `modules/sucafina/Sucafinav1/test/native-ui-contract/transport.test.ts` | `null` | `7fe06cad2bff509039e1a093bbd6224d2fd2c262` |

A tabela é a source manifest fechada [`SOURCE-MANIFEST-e2.json`](./SOURCE-MANIFEST-e2.json). Os quatro blobs confirmados por `fetch_file` no branch. Histórico dos arquivos propostos permanece imutado.

## Alterações desde a proposta anterior

- `common.ts`: 305 IDs fechados e tipos puros browser-safe; tipo `SfOperationId` único, nenhuma implementação de serviço.
- `transport.ts`: contexto exige tripla real da instalação, separa GET/POST-read key, impede reenvio de key pendente (same payload -> `outcome-unknown`, payload diferente -> `contract-mismatch`), digest SHA-256 cobre ID/rota/body, nunca faz retry automático. Separa `{surface}` de body/query legado, valida response mode e MIME (desktop/browser), status HTTP/DTO `ctx.context`, 5xx pós-escrita incerto, 401/403 purgam owner, logout web same-origin não resulta em falso sucesso.
- `router.ts`: table exata I00 injetada, método/query/Content-Length preflight, `Request` original preservado; não instancia backend, não envolve producer e não lê body fora da fonte. Non-admitted route não interceptada.
- `transport.test.ts`: quatro regressões antigas + três novas (status de contexto inválido, perda de resposta não reenvia key, preservação Request e query duplicada). **Arquivos de teste escritos, não executados.**

## Provas, gating e dependências

F02-AC01 (Idempotency-Key): autor implementou pinning em memória, nenhum automatic retry e detecção mismatch; dedupe/receipt e fence de produtor exigem prova real. F02-AC02 (outcomes): envelopes `response` e `transport-error`, 401/403, erro/indisponível e `outcome-unknown`; validação hospedada pendente. F02-AC03 (browser/desktop): types canônicos e metadata injetada, mesmo-origin web/broker por handle sem caller URL; D01 main real ainda necessário. F02-77-FENCE: header de expectativa, não grant; **a transação real `nativeCommandPrecondition` continua obrigatória na 114**; login Microsoft retorna closed pending I00.

Os bloqueios de **integração/qualificação** (não impedem autoria concluída) são: F01 Schema/context + `createSfContextHandler` com Context real; I00 `SfOperationRegistry` 305 metadata e bindings concretos (sem Any/stub); I00 exports maps e insertion no `local/entry.ts`; I00 return-intents/private bridge e `nativeCommandPrecondition` dentro da transação; D01/F04 streaming e broker para bytes/download; revisão Axx wire codecs efetivamente admitidos. `ctx.installations` é do SDK gerado original, não deve receber wrapper de F02. Sem essas fontes, JSON e navegação não são declarados instalados. Entrega separada ao integrador: [`SHARED-FRAGMENTS-e2.md`](./SHARED-FRAGMENTS-e2.md), com preimages e propostas; compartilhados não tocados pela W03.

**Nenhum teste local, lint/parser/typecheck/build, workflow Actions, CI, deploy, merge, Azure, update de generated, restart ou Goal resume foi executado.** Status testes/compilação/guards: `NOT_RUN`. A 120 solicita uma única seleção cirúrgica hospedada `modules/sucafina/Sucafinav1/test/native-ui-contract/transport.test.ts`, depois de material C com F01/I00 composições reais; dedup por árvore/seleção/fixtures. Casos adicionais essenciais: replay de mutação unknown após perda, ctx GET com headers/URL, 305 ids, MIME/HTTP/storage/abort, producer 401/403, router Request original, single-use return intent e desktop sender/partition em gates dos respectivos owners. A 119 executa `bun typecheck` nos diretórios `packages/schema`, `packages/client`, `apps/cli` mais guards sobre esse mesmo C após composição, sem `tsc` direto e sem geração manual.

## Handoff/lease

Recebedor `114/S0-C-e17-browser114`, PR #65, único compositor de `sf2-stack` e paths shared. Teste somente `120/PR106`, compiler `119/PR107`. Até ACK material do consumidor, este estado é `ARTIFACT_READY` **não** `INTEGRATED`/`QUALIFIED`/`DONE`; lease `ux-native-w03-e2` encerra autoria no handoff, novo writer precisa autorização/epoch própria. Nenhum release global: `GLOBAL_RELEASE=false`; Goal nativa pausada.
