# W01/D01 — Handoff sucessora e2 (UX20-W01-R2)

**ACK real** em `ACK-W01-e2.json`, commit `2d40cb38f8d931c063b863b515cea906624b1d19`. O original foi preservado; e1 não autoriza nova entrega.
**Branch:** `sf-ux-w01` · **época:** `ux-native-w01-e2` · **produto:** `c3b87e397b17787d069ac6abd3be1ce0e4736efd`.
**Estado terminal da autoria:** `ARTIFACT_READY_PARTIAL_BLOCKED`. `INTEGRATED=false`, `QUALIFIED=false`, `GLOBAL_RELEASE=false`.

## Exclusivas entregues

Onze leaves D01 novos e um ACK, sem qualquer escrita nos arquivos shared:
- Main: `index.ts` exporta `createSfDesktopBroker` (7 IPC fechados); `connections.ts` isola aprovação, geração e credenciais; `auth.ts` Microsoft/local; `network.ts` usa Electron net e Session em memória; `protocol.ts` opera somente catálogo + codecs; `enrollment.ts` valida arquivo HTML local owner-only e code one-use; `copy.ts` textos congelados COPY-02; `broker.test.ts` escreve casos de regressão sem rodá-los.
- Preload e renderer: `createSfDesktopPreloadCapability` e `createSfDesktopCapability`, com invalidation atrelada ao handle/generation.
- CLI: `attachSfNativeEnrollment` pelo AppDockSocket privado de launch.
- Broker valida mainFrame/sender/owner após operações async, discovery com `select=ids`, isolação de partição por conexão+instalação, revogação de requests e Session, logout off-line e pull stream de até 64 KiB sem URL/header escolhidos pelo renderer.

**Contratos reconciliados** contra F01 `sf-ux-w02` (context blob `42305065...`) e F02 `sf-ux-w03` (client transport blob `ff509a7b...`; common `f486d0...`). Metadata 305 ops e codecs reais têm ownership I00/114. Não foi criado transporte ou backend paralelo.

## Bloqueios precisos

1. **BLOCKED_INTEGRATION — 114/I00:** conectar broker ao main e preload compartilhados, gerar registry/operation bindings e compor F01/F02 no mesmo C, resolver origem renderer trusted e main-owned connection, e conectar downloads à API existente. Os fragments inertes e preimages de shared estão em `SHARED-FRAGMENTS-e2.md`. Nunca fazer merge bruto do diff da branch de planejamento.
2. **BLOCKED_CONTRACT — retorno Microsoft:** falta forma explícita e congelada de input/output do `POST {mount}/api/ui/return-intents`. O leaf restrito de D01 requer `{resume}` e envia `{chapterId,routeId,encodedRef?,query}`; se não coincidir com a resposta real retorna `contract-mismatch`, sem URL livre e sem ampliar safeReturn. **Pergunta a 114:** quais são os campos/codec exatos de criação do return intent e qual resposta assinada o I00 publicará? Revisar `auth.ts` após resposta para declarar AC login.
3. **BLOCKED_QUALIFICATION:** login Microsoft com identidades autorizadas, live native desktop, I00 return marker, upload-picker provenance, download save-dialog, revisão de producers e acesso/versão do F01 são provas de integração ainda ausentes.

## Matriz de aceite e CI

`D01-AC01: NOT_RUN/BLOCKED_INTEGRATION`; `D01-AC02: NOT_RUN`; `D01-AC03: NOT_RUN`; `D01-77-LOGIN: NOT_RUN/BLOCKED_CONTRACT`.
- **120 / PR #106:** Actions cirúrgicas para `apps/desktop/src/main/sucafina/broker.test.ts` após I00 e testes do consumidor `packages/app-shell/test-browser/sucafina-native/w01-d01.test.ts` quando instalado; nenhum teste local nem suite total.
- **119 / PR #107:** `bun typecheck` em `apps/desktop` e `apps/cli` + guards apenas em Actions após composição F01/F02/I00.
- Código/fixture estão commitados, mas testes, typecheck, build, compiler e guards **NOT_RUN**. Sem merge, reset, force, deploy, Azure, acesso externo novo ou reativação da Goal.

A lease de autoria e2 é terminal após este handoff para 114; próximo editor precisa de novo fence/lease. Pre/postimages de todos os leaves no source manifest.
