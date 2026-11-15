# W01/D01 — preflight antes de autoria (sem GO)

**Situação real:** ACK da sessão W01 publicado no commit [c0766378](https://github.com/gustavomhss/Orchestra-SF/commit/c076637814d738c1bb7df444364bd1376685280f). Solicitação de admissão por output feita à única integradora114 no [comentário 6896719110](https://github.com/gustavomhss/Orchestra-SF/pull/65#issuecomment-6896719110). O registro S0/COHORT19 observado ainda dizia `PREPARED/NOT_LAUNCHED_NO_GO`. Não há, nesta sessão, um ACK de admissão D01 verificado. A lease `ux-native-w01-e1` segue reservada, não ativa. Portanto **nenhuma escrita de produto** foi realizada e nenhum `ARTIFACT_READY` foi alegado.

## Delimitação e contratos

A escrita após admissão é estritamente `apps/desktop/src/main/sucafina/**`, `apps/desktop/src/preload/sucafina.ts`, `apps/desktop/src/renderer/sucafina.ts`, `apps/cli/src/sucafina-product/native-ui/desktop-enrollment.ts`, um teste W01 e recibos W01. Exports congelados: `createSfDesktopBroker`, `createSfDesktopPreloadCapability`, `createSfDesktopCapability`, `attachSfNativeEnrollment`. Construtores e DTOs vêm de `CONTRACTS.md §4/§6.1` e `host-signatures.ts`. D01 cobre `WP00.T04` e `WP10.T01`, **não** aceita ou dispensa nenhum de seus critérios canônicos.

`ctx.installations`: `select=ids` não importa `Location.directory` do caminho antigo; `select=location` preserva seu middleware. Descritores só podem surgir de discovery autenticado, verificado com origem/projeto/instalação, nunca de sidecar renderer.

## Evidência da árvore atual

Na base C58, os leaves W01 e as APIs públicas F01/F02/I00 ainda não existem. `local/entry.ts@04fa7d53` e `local-identity.ts@473b9dbf` evoluíram frente ao pin histórico; ler o código atual confirmou que `createConfiguredInstallation` conserva os fluxos reais de auth e que `createLocalIdentity` mantém revogação durável. `operator-identity.ts` conserva enrollment local single-use TTL10min. `local/enroll.ts` produz o template `open-local.html` 0600. `owned-serve.ts`, `dock-channel.ts`, `socket-transport.ts`, `response-download.ts` e `renderer-origin.ts` já têm mecanismos úteis de reuso. O JSON anexo registra todos os blobs e dependências.

## Composição que pertence exclusivamente à 114/C00

A114 deve instalar os imports em `main/index.ts`, `main/ipc.ts`, `preload/index.ts/types.ts`, `renderer/index.tsx`, `Platform.sucafina`, configuração privada `owned-serve` e export original `enrollNativeLocal` no factory. Precisa instalar schema/registry I00 e operações F01/F02, sem cópia privada nem `generated` manual. Essas alterações só podem ser entregues por W01 como patch completo proposto, com pre/postimage exato, **depois** da admissão do leaf; W01 não editará os shared paths.

## Segurança e aceitação pendentes

Broker: consentimento nativo obrigatório antes de discovery, `net.request` com Session isolada memória, allowlist fechada operationId, senderFrame/mainWindow/generation, rejeição de URLs/headers/cookies de renderer e abort de respostas tardias. Auth: janela dedicada sem preload, OAuth na mesma partition, marcador `dashboard?sf=native-return` one-use já permitido e validado por I00. Local: enrollment privado via Dock autenticado; chooser valida estritamente o HTML do produtor sem executar. Download: chooser existente com chunks de64KiB. Logout: invalidação primeiro e limpeza da partition mesmo em falha remota.

D01-AC01/02/03 e D01-77-LOGIN: `NOT_RUN`. Nenhum `bun test`, parser, typecheck ou Actions foi executado. A120 é o único executor de produto e a119 compiler/guards. C58 continua com falhas de outros WPs e nenhum green global.

**Próximo evento habilitador:** a114 publica admissão explícita para o output D01 + lease `ux-native-w01-e1` após re-pin semântico. Até isso ocorrer: `PREFLIGHT_ACK_ONLY`, não `SOURCE_READY`, não `ARTIFACT_READY`, não `GLOBAL_RELEASE`. Nenhum segundo integrador/dispatcher, merge/dev/deploy/Azure ou teste local.
