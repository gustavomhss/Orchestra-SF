# Missão 152 — A09 / correção causal e handoff para 132

**Estado:** ARTIFACT_READY, não integrado nem qualificado. **Goal:** pausada. **GLOBAL_RELEASE:** false.

- Repositório: `gustavomhss/Orchestra-SF`; branch de autoria: `sf-ux-a09`; PR existente: [#140](https://github.com/gustavomhss/Orchestra-SF/pull/140).
- Epoch: `ux-native-a09-e2-browser152`; ator: ChatGPT GPT-6 via GitHub MCP; ID de sessão não exposto.
- S0-FENCE confirmado: predecessor `ux-native-a09-e1` perdeu somente autoridade futura de escrita/dispatch; não há afirmação de encerramento de runtime.
- ACK publicado em `cf654ef4056b6dfd26e15a25416773902c64a571`.
- **Commit de código:** `fd466e39c02385f576eb67ad4d0bd5550886f0e9`; **tree de código:** `99c90b99f07ca70c1fa7fad474168d7ae7549901`.
- Pre-ACK: `8a9a252f44510f4b25e91387c7a5b8b1fd3dffb9`, tree `c9c0e8440a85c125586ee83485a53f122f170fbb`. Pós-ACK: `cf654ef4056b6dfd26e15a25416773902c64a571`, tree `1896fa0a44526d45fa8653a9ebee074f482b1c8e`.
- Consumidor observado: `sf2-stack@8094e599e3d18609e269548d24619a3246fbc735`, tree `b064e8c0ef63e9a3eb2bf6b699592fbdb184dee8`; reconferir HEAD e blobs antes de aplicar.

## Causa exata

O [run 43758731378 / job 132948475697](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43758731378), attempt 1 (Bun 1.3.14 / Effect 4.0.0-beta.83 / Linux), falhou ao carregar `routines.test.ts`: `Cannot find module '../../schema'` a partir de `packages/schema/src/sucafina/routines.ts:2`. [Finding da CI150](https://github.com/gustavomhss/Orchestra-SF/pull/140#issuecomment-6900999941). O caminho de dois níveis aponta fora de `packages/schema/src`. O helper canônico `packages/schema/src/schema.ts`, blob `d19a39b9708cfcaeedc1d7c62503afbadfee5dd7`, publica **NonNegativeInt** e **optional**. `packages/schema/package.json` também tem a entrada pública `"./schema"`; corrigiu-se a dependência interna para `../schema` (não alias, clone ou shim). `Schema.Json` existe no Effect pinado, portanto a validação JSON permanece inalterada.

## Blobs exatos

| Path | Pré-imagem fonte/consumidor | Pós-imagem A09 |
| --- | --- | --- |
| `packages/schema/src/sucafina/routines.ts` | `daaf552a1974b7120213b9636972ec3dda7ac6dc` | `9b6429dd66be4419e4f9d2b4f397a5485986170c` |
| `modules/sucafina/Sucafinav1/test/native-ui-contract/routines.test.ts` | `5c6ec7e24e89d9f0ff4333359493108f32d61ba7` | `f5e8046200167c6e224ac4d5ff85e8e9ed2725ee` |

Os dois consumidores em `sf2-stack@8094e599e3d18609e269548d24619a3246fbc735` tinham exatamente essas **pré-imagens**. `packages/client/src/sucafina/routines.ts` continua blob `c9ab1eca7c04994175c560e99985dc1b7c05a952`; `apps/cli/src/sucafina-product/native-ui/routines.ts` continua blob `f7fd5dece84a8374e0fd89c8c357e94b843ba1b6`. Nenhum arquivo compartilhado, engine, generated, package export ou wiring foi alterado por 152.

## Patch integral aplicável

O arquivo [PATCH.diff](./PATCH.diff) contém **todo o diff dos dois paths**, sem substituir outros conteúdos, obtido do commit de código via GitHub MCP e acompanhado dos blobs pré/pós. A132 deve comparar seu HEAD e esses blobs; aplicar **apenas** os dois patches no candidato integrado com sua própria autoridade/CAS, nunca mergear/cherry-pickar o histórico de `sf-ux-a09` inteiro. Caso uma pré-imagem tenha mudado, reconciliar semanticamente o delta antes de aplicar. O patch aumenta os testes com regressão para versão `-1` inválida, versão `0` válida e omissão real de campos opcionais em `SfRoutineResult`, mantendo todos os asserts antigos.

## Contratos e critérios preservados

Todos os 12 IDs permanecem fechados: `projection.routine`, `routines.catalog`, `routines.prepare-admission`, `routines.read-admission`, `routines.read-run`, `routines.run`, `schedules.create`, `schedules.list`, `schedules.pause`, `schedules.read`, `schedules.read-run`, `schedules.update`.

- **A09-AC01:** versionamento, `0/null/ausente`, fonte/field-set e `PortResult` originais preservados; nova regressão autoral **NOT_RUN**.
- **A09-AC02:** recusa de campos extras, ação desconhecida, falsa autoridade/snapshot, status e permissão preservados; assertions originais **não enfraquecidas**.
- **A09-AC03:** operationId, `expectedVersion`, CAS/withCase, contexto Request, idempotência/revogação mantidos; **não qualificado** até recheck hospedado.
- Tarefas canônicas herdadas `WP09.T01/T06/T07` e `WP10.T06/T07`, índices em `criteria-trace.json`; digests dos contratos frozen permanecem os originais (`contract-catalog.json` `31dbec1726fd8147156b01dc545726650ffd49e1`, `CONTRACTS.md` `94553a3119826ef1c44271966233dd58042ddd70`, `host-signatures.ts` `e99e094fc3ad5e74832a55aa2639c6bdb27f5255`).
- Origem da fonte: `host-context.ts` `6c85ddc7544ea8318cfc14b6c6142b1e8faca593`, `ports.ts` `88b6efb4840b8731f707862a8baf14683526c7a9`, `routine-services.ts` `4b455444cdeb560e85f6a17e6192c0420287d48a`, `product/interface/http.ts` C60 `9c666e7463b49a7c0cdeadb705b3266089d10bfb`. Nenhuma fonte produtora alterada.

## Validação e limites

**NOT_RUN:** teste da correção; typecheck de `packages/schema`, `packages/client`, `apps/cli`; geração SDK/guards; E2E; gates nativos. O resultado anterior do job é **RED**, não uma validação desta correção: 48 pass, 7 fail, 2 import errors no conjunto selecionado; as outras falhas pertencem a outros escopos. Não houve execução local, teste próprio, nova Action/dispatcher, merge, reset, force, deploy, Azure, modificação de engine ou Goal.

**Pendências compartilhadas/instaladas (não mexer por A09):** I00/132 compõe o binding e os exports de `@orchestra/schema/sucafina/routines` em package registry quando aplicável, `nativeUiProducts`, router, F01/F02 e grant explícito privado `schedules.read`; manter leitura Schedule indisponível até reader real e manter Native41/Relay/Schedule sob HOLD. `packages/schema/package.json` na fonte não declara `"./sucafina/routines"` ainda: essa possível exportação pública é trabalho de 132, não correção por shim do 152. PR #140 está em base de revisão `sf-ux-next30-dispatch-20261115` por herança de 164 paths; não retargetar/mergear história inteira só para exibir `sf2-stack`. A132 recebe o patch fechado.

## Próximas ações por autoridade

1. **A132 / PR65:** consumir somente os dois blobs com `PATCH.diff`, após checagem de preimage/CAS no HEAD de `sf2-stack`, publicar ACK consumidor e reconciliar shared wiring/public exports.
2. **A149 / PR107:** após composição causal nova, validar compilação/typechecks de schema/client/cli, geração de SDK e guards sob seu protocolo. Não reutilizar prova C64 inalterada.
3. **A150 / PR106:** apenas após uma nova árvore integrada coerente, despachar o teste específico `modules/sucafina/Sucafinav1/test/native-ui-contract/routines.test.ts` e consumidores diretos como seleção cirúrgica. Não repetir o W falho inalterado; registrar run, job, tree e resultado.
4. **S0:** manter Gate operacional Native41/Relay/Schedule e release global em HOLD; o recebimento deste artefato não prova serviço instalado.

O estado terminal da autoria 152 é **ARTIFACT_READY / HANDOFF_TO_132**, não **INTEGRATED**, **QUALIFIED** ou **GLOBAL_RELEASE**.
