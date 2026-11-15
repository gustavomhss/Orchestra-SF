# Missão 173 / A04 — terminal de compatibilidade Effect beta.83

**Estado:** `ARTIFACT_READY_NOT_INTEGRATED_NOT_QUALIFIED`. Epoch `native-fix-e1-browser173`, modelo efetivo **GPT-6** (Astra solicitado; sessão ID não exposta). Branch `sf-ux-w16`, mesma [PR #135](https://github.com/gustavomhss/Orchestra-SF/pull/135). Predecessora e3 fenced para futuras escritas; nenhum reset/force/merge/dispatcher extra. Goal pausada; `GLOBAL_RELEASE=false`.

## Correção concreta e proveniência

ACK CAS: `e69586fb81d4458606110df5d73411cef10b9561`. Source commit: `b409b491a5faea7311c38a740a3f8bd6712d9f66`, tree `d45f98c23614058d2ecd0cc5dba538820010900a`. Dois schemas alterados, source pre→post:

- `packages/schema/src/sucafina/decisions/source-contracts.ts`: `17295d70e40abbf0b9f78b4009ca28ac3c171baf` → `1a77ff23bee415941916467d75c81304a4aab382`.
- `packages/schema/src/sucafina/decisions.ts`: `f648fe7011029920f7915ee9225b066da30be4c9` → `6c1d974d807e84c244b601ae03a1402ecf27e405`.

[PATCH-173.diff](./PATCH-173.diff) é o diff **integral e inerte** para consumo por 162, com pre/post linhas. [CHECKPOINT-173.json](./CHECKPOINT-173.json) documenta blobs fonte e consumidor, árvore, assinaturas Effect, mudanças e critérios. [HANDOFF-173.json](./HANDOFF-173.json) contém pedidos exatos.

Compatibilidade da **API real** instalada `effect@4.0.0-beta.83`: `Schema.check(Schema.isMinLength(...))`, `isMaxLength`, `isPattern`, `isGreaterThanOrEqualTo`, `Schema.Union([...])`, `Schema.Literals([...])`, `Schema.Tuple([...])`, `Schema.Schema<T>`/ `Schema.Top`. `Schema.suspend` mantém recursão; `Schema.Record(key,value)` exige duas entradas (sem invocação de Record nos dois arquivos). 21 operações de decisão, regras fechadas, limites, digest SHA-256 e estados opcionais/zero preservados. Nenhum `any`, cast, Unknown, stub, upgrade de Effect, alteração de oracle, fixture ou timeout.

`decisions.test.ts` permaneceu no blob `6183175ebce968280b61668085d27771697a4b64`, 11 specs incluindo regressão sintática/recursiva134; **NOT_RUN** para o novo código. Nenhum teste, parser, validador, typecheck ou build local.

## Evidência GitHub Actions (pré-correção)

- Compiler 163: W `690a34cdd81c12d7311f3717c19679b950276161`, tree `07133fe09922121f3cca3bffd6b4463053b48ece`, [run43766055614](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43766055614)/job132971280139: **FAIL**, incompatibilidades Effect em ambos schemas; outros erros e 66 gates/141 warnings externos permanecem.
- CI164 decisões: [run43765725305](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43765725305)/job132970248049: **0 testes de Decisões**, erro de importação `Schema.minLength is not a function`. Cinco outros specs somaram 40 PASS naquele W, **não transferíveis**.
- CI164 navegador: [run43766970018](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43766970018)/job132974180913: falhas F03/S01/S05, **não é prova das Decisões**.

## Consumidor e despacho autorizados

**162 / PR65, única integradora:** `sf2-stack` observado em `913b6b8f143e6c3e869eee293d02f04259c7cdd1`, tree `99d4788774ce548d4cd64a96c0f2481db1fb15eb`, ainda com ambos blobs **pré-correção**. Reconfirmar HEAD, preimages e CAS; consumir **somente os dois arquivos** de PATCH-173 e publicar W/tree/ACK com os blobs pós-imagem. Não fazer merge da PR135 histórica nem mexer em caminhos compartilhados dos demais autores.

**163 / PR107:** depois do ACK do C integrado, executar hosted compiler causalmente afetado `packages/schema` e consumidores `packages/client`, `apps/cli`, `modules/sucafina` conforme delta, SDK/guards somente quando invalidado; deduplicação W/tree/seletor/runtime/config/fixtures. Nenhum novo dispatcher.

**164 / PR106:** depois do mesmo ACK de 162, executar no runner existente seleção **decisions-only**: `modules/sucafina` / `Sucafinav1/test/native-ui-contract/decisions.test.ts`, `--timeout 120000`, Bun/Ubuntu. Preservar 11 specs/assertions, registrar S/run/job/attempt. Não repetir input inalterado nem cinco specs anteriormente verdes.

**A04-AC01/02/03:** fonte preparada, qualificação **NOT_RUN**. `ARTIFACT_READY` não significa integrada, qualificada ou release. Handoff terminal; lease 173 encerrada.
