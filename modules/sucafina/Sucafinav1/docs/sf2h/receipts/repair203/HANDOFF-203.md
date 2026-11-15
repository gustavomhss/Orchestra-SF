# Missão 203 — F02 Client transport e tipos públicos

**Estado: ARTIFACT_READY (source code + testes novos), não qualificado.** PR [#189](https://github.com/gustavomhss/Orchestra-SF/pull/189) de `sf-transport-types` para `sf2-stack`. `GLOBAL_RELEASE=false` e goal nativa pausada. A branch diverge da integradora: não fazer merge cego.

## Autoridade/ACK

- Epoch `compiler-source-e1-browser203`, HEAD reservado e confirmado `50acf465f573ff27255c97634d9b98f04985a281`; S0-FENCE blob `f2f443b8c7924f5f06b5f514ea7df4bede61fd63`. ACK commit `5573ba0b45e77f8d360244be8108853a948ac640`.
- Modelo efetivo GPT-6; nenhuma session ID exposta. Autoridade prévia revogada para escritas futuras; não há afirmação de encerramento do predecessor.
- Código commit `0b7947c8c09bda7fde63356af9271e461772f15a`; testes e patches `776d2a1ff98c2874f4ba09f50b63516c3eb7e805`; correções de recibos `71ab0517d6afd26e01f77713bccb11f2953f7d0f`, `4c4c3f4071e0efd8c212d93a3e6dde6e1cd95d3c`.
- Planejamento `dbf9547211d9b0fade619790de7c19c0869b7c7d` e UX normativo `cbac654784714f68779ae1434d30e6ea8970c4d1`.

## Blobs de consumo (origem → destino)

| Path | Preimage | Postimage | Situação |
| --- | --- | --- | --- |
| `packages/client/src/sucafina/transport.ts` | `c9fc831156c94f062f0493a14458f84f61f7dff3` | `f32f9bd221598fa1279108d12c96fa6b75a77f7c` | COMMITTED |
| `packages/client/src/sucafina/bindings.ts` | `e0d5d853b0f86537bc0f1a6f3cb28d85d561f0a5` | `aff16695246561bd2cfe154c1ac892084ce119a4` | COMMITTED |
| `packages/client/src/sucafina/people.ts` | `57278f55bb2b36a69c93653c54bb7b8129b1e41f` | `2b07a465d2208a57b192147e6bca229b76ec6b3d` | COMMITTED |
| `packages/client/src/sucafina/context.ts` | `a08206d7aa17379520f2372fd14e9e4e9d7916c3` | `aac93d7c9e34674db51a143b3638a4f626b6398a` | COMMITTED |
| `packages/client/test/sucafina/transport-type-repair/f02-transport.test.ts` | `NEW` | `6f470dcc23300873223ec2c01bb7d36c6a5c23ea` | COMMITTED_NEW_NOT_RUN |
| `apps/cli/src/sucafina-product/native-ui/router.ts` | `17db52d914ca49934953e1161461b03856eb29c5` | `2c718174ec9554689e1879425e525f0c9fd555ba` | INERT_NOT_APPLIED |
| `modules/sucafina/Sucafinav1/test/native-ui-contract/transport.test.ts` | `0789f34911cd97d82a870dcee2f17fa37c8b4578` | `1d0e5816d15865b2df8459c6535980b65d27f20c` | INERT_NOT_APPLIED |

**189-only inert:** ver [manifesto](inert-shared-patches.json) e `inert-router.ts.diff` / `inert-transport.test.ts.diff`. Não foram aplicados a paths compartilhados. `sf2-stack` HEAD de preflight `6130f682014662964a2f2fcd2c0c487a904ecd3e`; 189 deve conferir o HEAD vivo, owner e preimages exatas antes de CAS. O router rejeita `?q` na busca (POST), o teste legado GET vira prova POST/limite/Request. Contratos e assertions não foram relaxados.

## Correção causal

`transport.ts` diferencia `transport-error` da resposta HTTP, usa metadata `SfNativeOperationRoute` sem perder `responseMode/maxRequestBytes`, executa decoders com `Schema.toType` (Effect `4.0.0-beta.83`) e `onExcessProperty:"error"`, valida status/body/headers, contexto stamp não vazio e publica o tipo canônico `SfTransportResult`. `bindings.ts` e `people.ts` fazem decodificação de schemas reais, sem `any` ou cast para mascarar incompatibilidades. `context.ts` consome o re-export público.

NAV-01 conserva `projection.search` como **POST JSON** em `{mount}/api/ui/projections/search`, com `q` exclusivamente no corpo e teto de 4096 **bytes UTF-8**; nenhum GET privado e nenhum `q` na URI/log. Abort, late response, `outcome-unknown`, reenvio automático proibido, owner atual e Request original ficam intactos. O host, e não o Client, decide autorização.

## Critérios e provas

- `F02-AC01`: idempotência de POST, digest/key pendente após resposta perdida; código preservado; **NOT_RUN**.
- `F02-AC02`: erros tipados distintos e response HTTP real; regressões de conteúdo inválido; **NOT_RUN**.
- `F02-AC03`: web e desktop consomem apenas operações/bindings aprovados; regressões web/desktop; **NOT_RUN**.
- `NAV-01`: POST corpo-only, UTF-8 4096, input/output excess, HTML não vira JSON, GET legado rejeitado na correção inerte; **NOT_RUN**.
- `A10`: facade People rejeita campo desconhecido antes do transporte; **NOT_RUN**.
- `F02-77-FENCE`: identidade principal/policy/accessRevision atuais e zero commit sob owner inválido exigem prova instalada; **NOT_RUN**.

**Evidência histórica, não teste novo:** Actions run `43772959867`, job `132992733158`, artifact `14185067705` e `FINDINGS-190-W77e.md` identificaram 22 diagnósticos de F02. O HEAD W77e não é o produto atual. Browser run `43773852118` registrou 7 PASS/1 FAIL e **não prova** native positive. Nesta missão não houve teste, typecheck, build, validator local, dispatch CI, nem geração/edição de SDK.

## Requests cirúrgicos (avisos, não ACK/wake)

**189 — única integradora:** receber as quatro fontes e o teste novo por blobs exatos; aplicar patches inertes após CAS e owner release, corrigindo drift sem ampliar escopo. Fazer checkpoint do candidato e consumidor Work/A12; não reaplicar lote anterior nem alterar outras missões.

**190 — compiladora PR #107:** somente **após 189**, conferir blobs e tipar `packages/client` (consumidores `packages/schema`, `apps/cli` conforme invalidation matrix). Reproduzir ou encerrar individualmente os 22 diagnósticos do job antigo, incluindo `bindings.ts:36`, `people.ts:18` e `context.ts:9`. A12 `packages/schema/src/sucafina/work.ts` pertence a 201; não mascarar falhas remanescentes nem editar SDK gerado.

**200 — dispatcher único PR #106:** somente **após 189** integrar ambos os patches, selecionar `packages/client/test/sucafina/transport-type-repair/f02-transport.test.ts` + `modules/sucafina/Sucafinav1/test/native-ui-contract/transport.test.ts`; selecionar transitivos web/desktop F02 quando disponibilizados. Validar POST sem `q` em URL, original Request, cap real, decoders, 401/403, abort/no replay, atraso/uncertainty; nenhum full-suite dispatch por esta lane.

Nenhuma edição em paths de 193–199, Core/Server, SDK gerado, dev, cloud, engines ou guards. Handoff completa; release/ACK do consumidor ainda não ocorreu.
