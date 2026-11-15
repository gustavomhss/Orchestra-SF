# Missão 133 — terminal handoff e checkpoint (e3)

**Status:** `ARTIFACT_READY_UNINTEGRATED`, não `INTEGRATED`, `QUALIFIED` ou `DONE`. Epoch `ux-native-w15-e3` ACK real `96fdb2c4d317df651840c3f532c54244c1ed72f8`; S0 fence `375ebb6295bdd97d576cc37c263ac654571c4c2e`. Novo ator ChatGPT/GPT-6, session ID não exposto. Predecessor e2 future authority revogada; commits dos demais preservados.

## Causa concreta, source lock e alteração

O material C64 `8f933d3249f49e1234b745036672d7c7a6aabcd4` e a branch anterior tinham `packages/schema/src/sucafina/planner.ts` no blob `30cd40e03ffb3d557243e26f772bdb3c7d5ae50c`; o consumer `sf2-stack@fc8840207377a363d4e6844aab496b4f1521f83c` mostrou `30cd40e03ffb3d557243e26f772bdb3c7d5ae50c` no mesmo path (preimagem de consumer verificada separadamente). O job nativo `43738115971/132885115197` observou `Schema.isBetweenLength is not a function` na inicialização em linha 15. Conferido o pacote instalado `effect@4.0.0-beta.83`: implementação `Schema.ts` blob `74f338311ccd446ee12bb73941d35c04476547e7` contém `isMinLength` (linha 7539) e `isMaxLength` (linha 7596), sem `isBetweenLength`.

**Produto:** `304cbf337f15d9dff59fa25bd0c31f6ab62bc3cb` substituiu as quatro chamadas inexistentes por checks separados mínimo/máximo: duas listas `12..12` (Amount/NullableAmount), células `1..36`, rows `1..500`. Postblob Schema `8ecb147aacd13e089ee0a39824fc823e9801bd41`. **Specs:** `a202422d2d1a318ae3291165b75fa326b8d5f65f`, postblob `1630180b74a5775280e4c90038849f9df99b87ff`, sem alteração de testes/fixtures existentes; cobre zero versus null, tamanhos 0/11/12/13, payloads mensais host 1..12, CAP17/CAP20, limites 1..36/1..500.

A semântica de `NonNegativeInt`, Query/Page/CAS/roles, 39 operations source-locked, preview/apply, eventuais erros/respostas, partial commit e outcome-unknown está intacta. Não se introduziu engine de fórmula/FX, esquema permissivo, backend paralelo, cast perigoso, retry de mutação ou tratamento especial de autorização. A correção é apenas dos quatro filtros na leaf e regressões.

## Integração exigida a 132

Consumir **somente** os dois paths autorizados e os commits e3; comparar o HEAD atual do target a cada aplicação. Código/testes e full diff em `PATCH-132.md`. Compartilhados de A02 continuam os patches existentes em `receipts/native-ui/W15/PATCH-114-e2.md`: não foram editados. O consumidor/aceite real de 132 permanece pendente; não declarar integração por PR aberto.

## Provas e oráculos

- `A02-AC01`: cobertura escrita (12/nullable, CAP17/CAP20), **NOT_RUN**.
- `A02-AC02`: unknown action/campos extras continuam fechados; asserts preexistentes intactas, **NOT_RERUN**.
- `A02-AC03`: versões/CAS e envelope Request preservados, **NOT_RERUN**.
- `A02-TSV`: 0..11 → 1..12 exatamente uma vez no cliente, parcialidade/outcome-unknown mantidos sem mudança, **NOT_RERUN**.

**128**: após a integração coerente de 132, fazer typecheck/guards nos pacotes afetados (schema, client e consumidores), decidir geração SDK pelo contrato público real — nenhuma geração manual por 133. **129**: após ACK de consumo/árvore coerente, teste cirúrgico hospedado de `modules/sucafina/Sucafinav1/test/native-ui-contract/planner.test.ts` e suas dependências por dispatcher existente. Nenhum teste local, parser, typecheck ou CI próprio foi executado nesta sessão. O resultado antigo C64 **FAIL** não pode ser apresentado como verde e nenhuma nova qualificação foi inferida.

**Handoff terminal:** `AUTHORING_COMPLETE; ARTIFACT_READY_UNINTEGRATED`. Somente 132 faz shared/integração, 128 compiler/SDK e 129 testes. Lease e3 não concede segunda writer nem reativação da Goal. G7/G8, AM01–06, três FINAL, P03 e GLOBAL_RELEASE seguem abertos/false. Um futuro reparo requer nova autoridade/fence, sem reset ou force.
