# Dependência externa — caller WP14 do BusinessServices

## Estado e escopo

**STATIC_INHERITED / OWNER_PATCH_ALREADY_PUBLISHED / NOT_APPLIED.** Esta nota identifica uma incompatibilidade já presente na base `ba8a09e371ce8d93eb917eabb102caaee5affaf4`. Não é resultado de typecheck do novo candidato procurement-apply; o check próprio deve registrar seu resultado separadamente. Não foi executado teste local, disparado CI ou aplicado patch pelo auditor desta nota.

O consumidor é o segundo cenário de `test/product/wp14/source-access-atlas.test.ts`: Documents WP06 → BusinessContext → Atlas C17, com confirmação documental, commit, replay e revogação. Owner da correção: **Compose / owner do teste consumidor WP14**, preservando os dois cenários já publicados. O alvo está fora dos paths de escrita de procurement-apply.

## Identidade conferida pelo GitHub MCP

| Referência | Identidade |
| --- | --- |
| Base procurement-apply | `ba8a09e371ce8d93eb917eabb102caaee5affaf4` |
| Arquivo alvo | `modules/sucafina/Sucafinav1/test/product/wp14/source-access-atlas.test.ts` |
| Preimage do alvo na base | `fbe627ffde443ff7e2d3b1204bbcf67523404f41` |
| Mesmo preimage no snapshot de Operations Fixes | `5b47c0dd3c553c3d6c7e7986113b6f6f778a0ea6` |
| Mesmo preimage no head Operations Fixes observado | `32a73ae7995eb193eaf9a78527736cb2df176a00` |
| BusinessServices na base | `apps/cli/src/sucafina-product/business-services.ts`, blob `9aee116a091c684ba467f81316d2fb915b3f8758` |
| ProductAuthority na base | `product/integration/product-authority.ts`, blob `6e6338ca557304774051864b47900640e216c031` |

O caller de BusinessServices omite o argumento obrigatório `procurementEvidenceWrites`. A autoridade também precisa receber a **mesma instância** para que o binding de escrita autorizada tenha identidade comum. Acrescentar apenas uma WeakSet desconectada no caller corrige a forma do tipo sem recompor essa ligação.

## Reutilizar a proposta existente

A própria base já contém a proposta mínima; não foi criada uma cópia nem uma segunda correção:

- [OPS-CONSUMER-02.patch](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/modules/sucafina/Sucafinav1/docs/sf2h/receipts/WP06/operations-20261114/OPS-CONSUMER-02.patch), blob `2ab9a6b6f18709d5bad95f58247c70ba286a00aa`.
- [Handoff original](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/modules/sucafina/Sucafinav1/docs/sf2h/receipts/WP06/operations-20261114/OPS-CONSUMER-02.md), blob `7f70bfda1bd9331097bb25cea3c8feb5f1d62601`.
- [Preimages e evidência original](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/modules/sucafina/Sucafinav1/docs/sf2h/receipts/WP06/operations-20261114/OPS-CONSUMER-02.json), blob `6d6ba616938821f4820855c8006006f028191bec`.

A proposta contém dois hunks: declara uma `new WeakSet<object>()` no cenário documental e passa a variável tanto para `createSfProductAuthority` quanto para `createSfBusinessServices`. Preimage registrado: `fbe627ffde443ff7e2d3b1204bbcf67523404f41`; postimage proposto: `d7d2a69837560f42438d470b83724c1a61939a73`. O preimage continua idêntico nos três pontos conferidos acima. Produto, grants, assertions, scanner, casos e deadlines não são alterados pela proposta.

A [PR #52](https://github.com/gustavomhss/Orchestra-SF/pull/52) continua registrando a pendência e mantém o mesmo arquivo. Seus recibos publicados não incluem uma aplicação desta proposta. A [PR #34](https://github.com/gustavomhss/Orchestra-SF/pull/34) já encaminha o caller ao owner; não substituir o arquivo inteiro por uma versão de outro branch que omita o cenário documental.

## Evidência anterior e próxima ação do owner

[Run 43625644846](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43625644846) foi consultado via MCP: snapshot `5b47c0dd3c553c3d6c7e7986113b6f6f778a0ea6`, estado `completed`, conclusão `failure`. A PR #52 registra o único diagnóstico Sucafina como `TS2741`, em `source-access-atlas.test.ts(167,41)`, pela ausência de `procurementEvidenceWrites`; CLI typecheck e guards são registrados separadamente como PASS. Esse resultado pertence a Operations Fixes, não ao novo candidato desta missão.

O owner deve conferir seu head/preimage e conciliar deltas concorrentes, consumir os dois hunks já publicados e executar `bun typecheck` de Sucafina mais a seleção cirúrgica do arquivo existente com **ambos** os casos. A prova Atlas exige scanner e Omni reais conforme o teste; o desaparecimento do erro TypeScript sozinho não qualifica o cenário. Registrar W/S, seleção, jobs, scanner/Omni e resultado verdadeiro. Esta missão conserva o teste externo sem edição e não duplica o CI do owner.

