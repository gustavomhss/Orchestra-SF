# Missão 193 / A04 — fecho do decoder Decisions em Effect 4 beta.83

**Estado:** `ARTIFACT_READY_NOT_INTEGRATED_NOT_QUALIFIED`. Epoch `source-closure-e1-browser193`, modelo efetivo GPT-6 (sessão/browser ID não exposto). Branch **existente** `sf-ux-w16`, PR [#135](https://github.com/gustavomhss/Orchestra-SF/pull/135); autoridade inicial `13c27e4bd41ad277c18c5585d941feed04727b78`. A 173 está **fenced apenas para novas escritas**; seus dois schemas foram preservados e não reaplicados. Nenhum merge, reset, force, gerador, engine, CI concorrente ou Azure.

## ACK, origem e pre/postimage do código

- S0-FENCE: `S0-FENCE.json` blob `b3035607202d49ec6cafd776e8df5353f5c5cebb`, predecessor 173 `1710bfd33d0db91be4eee3158e25da995f6d87e3`, sem alegar encerramento de runtime alheio.
- Autor ACK: [`ACK-193.json`](./ACK-193.json), commit `5ea7f6a99f022d07a8c28f7418f90b367868ce24`, tree `4a146c09db70c1641a6a0b091095d3e726390419`, blob `061ad834db0c630b8179f268bbcbad6a34dd3575`.
- **Commit do patch:** [`460ddcaf6cf013bc42a100132c5d7478df4138f0`](https://github.com/gustavomhss/Orchestra-SF/commit/460ddcaf6cf013bc42a100132c5d7478df4138f0); tree `5cfdd48f309dbdb23471bf4b3250881d32b3d24c`, parent `5ea7f6a99f022d07a8c28f7418f90b367868ce24`. CAS via GitHub MCP `expected_sha`+ `force:false` confirmou sucesso; arquivo relido com o blob pós-imagem.
- **Único arquivo de produto alterado:** `modules/sucafina/Sucafinav1/test/native-ui-contract/decisions.test.ts`
  - pre: `6183175ebce968280b61668085d27771697a4b64`
  - post: `d5d4d12874d7afa9cd32f0724d9967e9f3a2d481`
  - Diff integral: [`PATCH-193.diff`](./PATCH-193.diff), blob `a966c51022fa992b37a3690706c9c1028e1866a7`, `+4/-2` linhas.
- `packages/schema/src/sucafina/decisions.ts` preservado blob `6c1d974d807e84c244b601ae03a1402ecf27e405`.
- `packages/schema/src/sucafina/decisions/source-contracts.ts` preservado blob `1a77ff23bee415941916467d75c81304a4aab382`. São os dois postblobs da 173, já observados no C da 189.

## Causa, mudança e garantias

A falha observada no [run 43772149086](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43772149086) / job `132990216337`, snapshot `36ba918ea9128a724754ac9bace02cef8409adbe`, foi **3 pass / 8 fail**, em 11 specs; as oito falhas davam `Schema.decodeUnknownEither is not a function` antes de executar suas asserções.

A fonte **exata** `effect@4.0.0-beta.83`, `Effect-TS/effect/packages/effect/src/Schema.ts` blob `74f338311ccd446ee12bb73941d35c04476547e7` e `SchemaParser.ts` blob `ac029e68d28640a346ba392b5c2b85f56ece17ce`, exporta `Schema.decodeUnknownExit<S extends Schema.Decoder<unknown>>`, que retorna `Exit` com `_tag:"Success"|"Failure"`, recebendo `onExcessProperty:"error"` em `ParseOptions`.

O helper `accepts` usa agora `S extends Schema.Top` e `Schema.decodeUnknownExit(Schema.toType(schema), { onExcessProperty: "error" })(value)._tag === "Success"`. A conversão `toType` é intencional: os schemas A04 aqui são validação estrutural sem transformações ou serviços e a fonte recursiva declarou `Schema.Schema<SfEvidenceRef>`, apagando a garantia estática de `DecodingServices=never`; `toType` conserva os `Schema.check`/objetos/uniões/recursão do lado type, fornece decoder síncrono tipado sem `any` ou casts. Não se recodificou produtor, não se inventou grant nem se omitiu verificação.

**As 11 specs permanecem sem alteração**, incluindo: catálogo de 21 operações fechadas, CAS `caseRef`/versão positiva/incarnation, discriminadores, evidências e digests recursivos, fake receipts, digest de review, recovery exclusiva, zero vs null, extras no root e aninhados, negação de grants, três efeitos, chamada única sem retry, auth/stale/conflict distinguíveis. Nenhuma assertion foi removida ou enfraquecida.

## Evidência real e limites

- **Anterior:** run `43772149086`/job `132990216337` = FAIL, 3/11 passaram com o helper antigo.
- **Novo commit `460ddcaf6cf013bc42a100132c5d7478df4138f0`:** tests **NOT_RUN**, typecheck **NOT_RUN**, build **NOT_RUN**, parser/validator **NOT_RUN**, guard **NOT_RUN**, web/desktop/instalação **NOT_RUN**. Nenhum run/job novo e nenhum PASS alegado.
- 189 precisa consumir o postblob `d5d4d12874d7afa9cd32f0724d9967e9f3a2d481` no mesmo candidato C. 191 só pode validar depois de conferir C/tree, preimage e seletor, sem despacho duplicado. 190 é o único compiler/guards em PR107, fora da autoridade desta missão.
- O spec de schema não exige identidade instalada para ser executado. A **qualificação funcional A04-AC01/02/03** permanece pendente de F01/F02/contexto e F04 no mesmo C; quando a prova instalada exigir sessão, falta **manifesto privado `SF_NATIVE_INSTALLED_MANIFEST` 0600 em raiz 0700 com `SF_NATIVE_CANDIDATE_SHA=C`, host real, identidade Microsoft aprovada pelo `serverKey`, contextos/owners com grants atuais e original Request**, nunca mock, token ou auth presumido. Não bloquear o reparo do helper por essa falta.

## Entrega cirúrgica e responsáveis atualizados

**189 (PR #65, `sf2-stack`)** — HEAD observado `4426445c05823ed4932b8a8e35391df024bf74f3`, `modules/sucafina/Sucafinav1/test/native-ui-contract/decisions.test.ts` ainda em `6183175ebce968280b61668085d27771697a4b64`. Antes de aplicar, reler HEAD/preimage atuais. Consumir **somente** a mudança deste único arquivo usando o diff integral e blob `d5d4d12874d7afa9cd32f0724d9967e9f3a2d481`, commit/atualização da *própria* branch por CAS esperado e `force:false`; preservar ambos schemas 173 e os demais lotes. Publicar C/tree novo e ACK efetivo de integração; comentário de aviso **não** é ACK.

**191 (PR #106, `sf-ci-validation`)** — fonte imutável [`VALIDATION-REQUEST-191.json`](./VALIDATION-REQUEST-191.json), blob `e40886713dc5eddfc4767065ca912bc864501cb8`, status **REQUEST_RECORDED_NOT_DISPATCHED**. Após ACK real 189, usar wrapper existente `test:ci` com seletor **exato**:
```text
package: sucafina
package_directory: modules/sucafina
test_file: Sucafinav1/test/native-ui-contract/decisions.test.ts
runner: Bun / Ubuntu Linux
timeout: 120000 ms
selector: 11 tests in one file, no other cases
source SHA: 460ddcaf6cf013bc42a100132c5d7478df4138f0
source postblob: d5d4d12874d7afa9cd32f0724d9967e9f3a2d481
```
Deduplicar por C/tree/selector/runtime/config/fixtures e não repetir o snapshot antigo inalterado. Registrar W/S/run/job/attempt e **resultado real por cada uma das 11 provas**. Pedido não executa workflow nem acorda ator encerrado.

**190 (PR #107)** — a mudança é isolada no teste; caso o compiler selecione o contrato, não tocar SDK generated, nem repetir geração 173. Guard/typecheck após C integrado na própria autoridade 190.

## Cânones, fechamento e próximo passo

Planejamento imutável `dbf9547211d9b0fade619790de7c19c0869b7c7d`; normativo UX `cbac654784714f68779ae1434d30e6ea8970c4d1`; `A04` WP11.T01–T04, `ctx/decisions/transport` congelados. 193 é continuação de implementação, não planejamento. Nenhuma alteração fora de `decisions.test.ts` e `closure193/`.

**Status terminal autor:** `ARTIFACT_READY / SOURCE_AUTHOR_HANDOFF`. Integração `PENDING_189_ACK`, qualificação `NOT_RUN_PENDING_191`, `GLOBAL_RELEASE=false`, goal nativa pausada. Próximo passo executável: 189 CAS-consome `d5d4d12874d7afa9cd32f0724d9967e9f3a2d481` no C e publica ACK real; 191 dedup+executa só a seleção indicada em C; 190 reconcilia guards/typecheck se invalidado. Não confundir aviso em PR com ACK, execução ou PASS.
