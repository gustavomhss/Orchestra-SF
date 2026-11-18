# Missão 213 — terminal handoff: broker Sucafina no desktop

**Resultado:** código e testes comportamentais COMMITADOS REMOTAMENTE, PR [#194](https://github.com/gustavomhss/Orchestra-SF/pull/194) `sf-desktop-bootstrap` → `sf-closure-bundle`; patch INERTE completo publicado para 211. **NÃO** é D01 PASS ou GLOBAL_RELEASE.

## Autoridade, leitura e composição

- HEAD inicial reservado `5f604d6412823c004394a319285de9da581a835e`; árvore `51f32c95dcb7790c9fac1d74a0a1fac0b075c488`; fence `70c1d9dea0e825c1e0ccba4f70102f552ec0dfcd` conferidos antes da escrita. ACK `03e3936a1627e4834370951aca0de4c45c60e7b4`, modelo efetivo GPT-6; sessionID não exposto. Sem afirmação de predecessores, lifecycle ou autorização nova.
- Planejamento imutável `dbf9547211d9b0fade619790de7c19c0869b7c7d` e UX `cbac654784714f68779ae1434d30e6ea8970c4d1`; nenhum dos 15 WPs, 74 tasks, 17 contratos, 1610 critérios ou escopo UX foi modificado.
- Lidos AGENTS aplicáveis, 213 integral, D01 work order/host signatures, preimages reais do main/ipc/broker/connection/renderer/client, producer CLI e entrega terminal 199 `e624bb5765d322e386d4accd8dac8b15b908ced8`. 199: `sf-installed-host` `9b512eeffa9c437967b03d5af6dab11a1718f48b`; D01 original `2925ff518a78c2034f855561589f504b9ca7e48b`. PR191 inicial já compôs 15 paths e reparo AM03; **não** reaplicar.

## Ledger exato: paths próprios (pre → post)

| Path | Pre blob | Post blob | Operação |
|---|---|---|---|
| `apps/desktop/src/main/index.ts` | `51245e8469fa60decda9ed84efb3796fdf3fd510` | `b1af6ab8f867b3d2727270f7ba87b9f6f1f6ffcc` | main-owned sidecar key/origin credentials, Dock callback, after-health registry, server-stop revoke |
| `apps/desktop/src/main/ipc.ts` | `babb1249587caf085909ed6316bbd0b9f968ce3c` | `9d1c3715331f5793a94fbedadd8f52d4a4f94057` | construct original D01 broker with Electron real app/windows/ipc/net/session/dialog, 7 IPC handlers |
| `apps/desktop/src/main/sucafina/bootstrap.ts` | NEW | `432d29e6ee2a48f82e4ad70523268ef1fa3175f5` | public SfNativeOperationBindings and origin; bounded authenticated Dock enrollment request-reply correlation |
| `apps/desktop/test/sucafina-bootstrap213/enrollment-bridge.test.ts` | NEW | `b33bbab29041342727df5d9f9e9b33f45d77870c` | behavioral negative/positive protocol unit tests, NOT_RUN not installed evidence |
| `apps/desktop/test/sucafina-bootstrap213/d01-packaged-driver.ts` | NEW | `3c3d97c8e1d571ead0f663ef92400b4700d3e4b0` | real packaged Electron handler and preload gate for 199 existing D01 fixture, NOT_RUN |

O broker original `apps/desktop/src/main/sucafina/index.ts` em `a3f09c2a9006c016d51c660043d1189bb2df4c29` **não foi reimplementado**. IPC instala os sete handlers uma vez após `app.whenReady`, preservando `isMainWindow`, `isRendererOrigin` e a API original de preload. O main obtém `sidecar` como `ServerConnection.Key` real (`ipc-validate.ts`), com URL e credenciais exclusivamente do `startOwnedServe` já saudável, sem projeto/principal/location inventados. Na parada, invalida binding/partition do servidor antes de encerrar child, garantindo a parada mesmo se invalidação falhar.

O novo bridge usa SOMENTE o Dock WebSocket do child com bearer per-launch já existente; correlaciona `sf-native-local-ready` + request UUID + `launchId` + `projectId` + `installationId`; verifica geração do servidor, TTL e origem; pedidos concorrentes, ausência de produtor, reinício, troca de identidade e desconexão falham fechados. Enrollment `url` com code permanece em main, nunca é enviado ao renderer, agents, logs ou HTTP novo. A verificação final do URL/mount e credenciais é do broker original (`requireSfManagedEnrollment`). Login Microsoft e sessão da instalação seguem os contratos originais, sem política/grant relaxado.

## Patch INERTE fora da lease — 211

`modules/sucafina/Sucafinav1/docs/sf2h/receipts/closure213/INERT-211-CROSS-LEASE.patch` (blob `809c5b1eef50447001c5cc7b3e8c7ff92818230d`) e `INERT-211-CROSS-LEASE.json` (blob `2802e04fdbd0aacd3b3eeffb22daed8fe6135224`) têm diff COMPLETO e pre/post Git blobs para `apps/desktop/package.json`, `bun.lock`, `apps/desktop/electron.vite.config.ts`, e a spec D01 originalmente pertencente à 199. 211 deve conferir CAS/live preimage de cada arquivo no produto atual, incorporar `@orchestra/client` como dependência de runtime e excluir seu workspace TypeScript da externalização do main no Electron empacotado; só então aplicar a ligação do driver D01 ao original 199. Nenhum desses paths foi alterado nesta branch.

`attachSfNativeEnrollment` CLI está materialmente definido no blob `8ea7c0c87dc02165ca29be44bc947a6813f96832`; **não alegar que CLI já o anexou em execução**. O input mínimo verdadeiro é transporte `AppDockSocket.fromEnv` entregue pelo child, `launchId` UUID real, descriptor local-operator da instalação carregada e callback real `enrollNativeLocal()`. A falta de um deles bloqueia somente login local/qualificação dependente, nunca autoriza grant sintético.

## Casos, qualidade e requests

- **D01-AC01:** wired code; prova de read/action real em Electron empacotado **NOT_RUN**.
- **D01-AC02:** checks de owner/main frame/origin/operation existentes preservados; cenários novos de bridge com troca de launch/project/install e desconexão **COMMITTED_NOT_RUN**.
- **D01-AC03:** purge/invalidation original preservados e cleanup de server agregado; **NOT_RUN**.
- **D01-77-LOGIN:** Microsoft original/marker one-use/Session preservados; **NOT_RUN**, exige identidade externa original.
- 199 possui `packages/app-shell/e2e/sucafina/native/integrated-proofs/d01/packaged-electron.spec.ts`, hash real do executável, `_electron.launch`, contexto Microsoft e cookies isolados; web/component tests não substituem.
- Request214 exato em `REQUEST-214-190.json`: somente após C mesmo material aceito por 211, rodar seletor `apps/desktop/test/sucafina-bootstrap213/enrollment-bridge.test.ts`, regressão `apps/desktop/src/main/sucafina/broker.test.ts` e D01 spec de 199; atestação privada `SF_NATIVE_D01_PACKAGED_ATTESTATION`, binary SHA/buildRunId/actionsRunId e identidade Microsoft externa genuína são obrigatórios. **NÃO DISPARADO**.
- Request190: `bun typecheck` sob `apps/desktop` após aplicar os três patches de packaging e admissão de source; `apps/cli` somente se seu produtor for alterado por owner competente. **NÃO DISPARADO**.
- 211 compõe somente `sf-closure-bundle`/PR191, não `sf2-stack`; 199 fornece host/fixture; 214 sole CI dispatcher; 190 compiler; 207–209 revisão fria; 210 evidências. Sem CI paralelo, loops watchdog ou merge em dev.

**Validação real da missão:** comparações de HEAD/FENCE, códigos/blob preimages e commits via GitHub MCP com CAS `expected_sha`, `force:false`: **SIM**. Testes locais, typechecks, builds, validators, CI e provas live: **NOT_RUN**. Sem download/cópia de segredos, provisionamento Azure, restart de Orchestra, cliente falso, relaxar guards ou autorização.

**Handoff:** source code head `9e25cc70495d38aa62b2376be89cebe02e86761d`; PR194 para 211; requests para 214/190. Produto real, AM01–06, mesmo C, CI/gates/reviews, valid D, guards separados C/G7D/G8 e remote proof ainda necessários. **Goal native PAUSED; GLOBAL_RELEASE=false**.
