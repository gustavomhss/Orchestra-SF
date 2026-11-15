# W03 / F02 — handoff de autoria tipada (não admitida)

**Estado:** `SOURCE_PROPOSED_ADMISSION_HOLD`. Este é o pacote de autoria independente
sobre os contratos congelados, não uma instalação pronta, aprovação de produto ou
prova de CI. O código está em `proposed/*.txt` e em
[`F02-PROPOSED.patch`](./F02-PROPOSED.patch); os arquivos executáveis na árvore
`packages/*`/`apps/cli/*` **não foram escritos** enquanto faltar a admissão de
output da 114.

## Autoridade e pins

- Repositório `gustavomhss/Orchestra-SF`; branch já existente `sf-ux-w03`,
  cohort base `f8e442616c96651f3b26013b34b8ce697860e3e2`, produto C58
  `422f1ed7b549021d7c62c834c9d9041279112af4`.
- Ordem F02; `COMMON.md` e `EXECUTION-PROTOCOL.md`, `CONTRACTS.md`
  (blob `94553a3119826ef1c44271966233dd58042ddd70`),
  `host-signatures.ts` (blob `e99e094fc3ad5e74832a55aa2639c6bdb27f5255`),
  `contract-catalog.json` (blob `31dbec1726fd8147156b01dc545726650ffd49e1`),
  `route-signatures.ts` (blob `ea99b96a7a7e0ee860ed2c0fac137f6fc4e42e81`).
- Current C58 `local-identity.ts` blob `473b9dbfe56092af26f0de2927767b8d64b79e1b`
  difere do histórico `9b501e6c0a4ee13764fd94be755077a3b1bb5844`:
  reforço de emissão/revogação durável, fence antes de responder e refresh atual.
  **Não restaurar** o source histórico.
- ACK real `4020e11169bee00769d7468d60893d3747514959`,
  [solicitação explícita à 114](https://github.com/gustavomhss/Orchestra-SF/pull/65#issuecomment-6896671576).
  Esta solicitação **não equivale** a um receipt de admissão/GO. Writer epoch
  reservado `ux-native-w03-e1` sem transferir titularidade do stack.

## Quatro outputs preparados

Ver [`SOURCE-MANIFEST.json`](./SOURCE-MANIFEST.json) para paths, source blobs,
null preimages e número de linhas. Patch unificado adiciona:

1. `packages/schema/src/sucafina/common.ts` — 305 IDs exatos do catálogo,
   `SfOperationId` value/type, famílias/resources e tipos browser-safe; sem
   inventar serviço ou importar folhas incompletas.
2. `packages/client/src/sucafina/transport.ts` — interfaces e DTOs desktop
   congelados, facade tipada, origem e mount fixos, `fetch` same-origin/no-store/
   redirect error, codecs admitidos injetados, validação Schema de entrada/saída,
   POST-read com key independente, digest SHA-256 por intenção de mutação, geração/
   abort fence, whitelist de response headers e owner expectation derivado do
   `ctx.context` real. Nenhum import Core/Server nem armazenamento persistente.
3. `apps/cli/src/sucafina-product/native-ui/router.ts` — assinatura server-only
   `SfNativeHostDependencies`, handlers tipados por operationId, despacho apenas
   dos handlers explícitos injetados pela composição; repassa o MESMO `Request`
   sem URL rewrite, SDK duplicado ou captura de papéis/autoridade no client.
4. `modules/sucafina/Sucafinav1/test/native-ui-contract/transport.test.ts`
   — quatro regressões focadas de fail-closed (ausência de codec, generation
   obsoleta, troca de projeto e abort). Testes ainda não executados.

**Importante:** textos propostos são revisão de fonte, não compilação:
`SOURCE_PATCH_READY_FOR_ADMISSION_REVIEW`, **não** `ARTIFACT_READY`,
`INTEGRATED`, `PASS` ou `GLOBAL_RELEASE`.

## Dependências que não podem ser forjadas

- **I00/114:** materializar `SfOperationRegistry` readonly de todos 305 IDs com
  metadata literal, `SfNativeOperationBindings` só para os codecs REALMENTE
  admitidos e publicar export maps explícitos de Schema e Client. Não gerar
  `generated` nem `generated-effect` manualmente. Não enviar operação sem
  codec; `{surface}` exige binding legitimamente validado no schema da operação.
- **F01/W02:** publicar os tipos únicos Schema/context, `createSfContextHandler`
  server-side e contexto real. F02 consome apenas types/client e não cria fake
  `SfContextStamp`. Composição de `ctx.context` após ingress/identity/bootstrap
  fica com 114 em `local/entry.ts`.
- **I00/return-intents:** a forma exata da **resposta** de
  `POST {mount}/api/ui/return-intents` e o codec para
  `SfResolvedRoute`/resume não estão publicados como produtor. Browser login
  proposto permanece fail-closed `SF_NATIVE_RETURN_INTENT_CONTRACT_UNAVAILABLE`
  (não pula safeReturn); **não integrar esse ramo como pronto**. Desktop login
  chama a capability main D01 e exige contexto autenticado do mesmo owner.
- **D01/W01 e F04:** broker Electron com Session isolada e download chunked
  autorizado. O transporte candidato recusa `bytes`/`navigation` como
  `contract-unavailable`, em vez de bufferizar arquivo inteiro ou decodificar
  redirect HTML. Requer ligação de stream real e revisão independente.
- **114/produtores:** `nativeCommandPrecondition` dentro da transação real
  após autenticação, port fences de `views`/`planner.monthly` e admissões
  originais. O header `X-SF-Native-Owner` é expectativa, jamais grant; sem
  fence, produtor deve retornar 503 e a UI não pode declarar commit confirmado.
- **Operações com `X-SF-Review-Binding`:** owner/produtor deve definir o
  binding typed exato do `accessRevision` corrente; não criar header livre.
  A equivalência dos wire payloads dos 305 schemas/famílias precisa ser revista
  por 114/Axx antes de admitir as operações individualmente.
- **119/120:** somente 119 conduz compiler/guards, somente 120 executa seleção
  Actions hospedada. W03 não executou Bun, typecheck, build, CI, smoke,
  merge, deploy, Azure ou chamadas privadas de produtor.

## Intake e testes exigidos

114 deve emitir **admissão expressa por F02/output**, conferir pins/preimages
contra a árvore C corrente e reconhecer o lease exclusivo da W03 antes de
instalar `F02-PROPOSED.patch` ou devolver revisão de contrato. O patch
não contém arquivos shared de I00; nenhuma fila/branch foi mergeada.

Seleção para 120 após composição: teste do corpus de operação ID set=305;
URL inválida/same-origin e GET ctx 3-tupla; body/header/query duplicados;
POST-read unique UUID; mutação sem key e sem stamp não entra na rede;
mesma key+payload passa só com dedupe source, key+payload diferente bloqueia;
logout e 401/403 purgam owner; response HTML/redirect/oversize não produz
DTO; byte export sem stream real permanece unavailable; geração antiga e
abort tardios não republicam dados; router guarda identidade do Request;
main Electron valida sender/mainFrame, partition, login Microsoft real e
revogação. Testes de unidade sintéticos **não substituem** essas provas.

Para o piloto, admitir somente `ctx` + A03 cujos produtores/codecs e testes
estiverem efetivamente instalados no candidato. Nenhum HOLD externo
Native41/Relay/Schedule foi convertido em READY.

## Handoff

- Autor W03 mantém branch `sf-ux-w03`, sem editar `sf2-stack`.
- Recebedor `114 / S0-C-e17-browser114 / PR #65` valida conteúdo e decide
  admissão. `119` compila, `120` executa Actions; nenhuma sessão W03
  despacha seu próprio workflow.
- Prerequisitos externos não publicados devem gerar
  `BLOCKED_DEPENDENCY` e **nunca** binding `Schema.Any`, producer
  always-allow, login simulado, Client Core/Server, ou source auto-generated
  editado à mão.

`GLOBAL_RELEASE=false`. Estado do PR da W03: `DRAFT_ADMISSION_HOLD`.
