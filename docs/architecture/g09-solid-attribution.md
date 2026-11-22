# G09 — apêndice factual da atribuição Solid

## Evidência observada

O [run 44963660156, job 137027757841](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44963660156/job/137027757841), workflow `45cf3d9d73e191fd0c1dd28bbf00688b7de614ba`, recuperou os **oito intermediários com os hashes exatos** e verificou os **33 tokens completos por AST nos três níveis**: fonte TSX, intermediário Solid e módulo JavaScript extraído da ELF preservada. Os 33 inícios Bun e os 33 inícios Babel suplementares coincidem. **28 endpoints Babel suplementares coincidem; cinco não coincidem.** A etapa continua corretamente com `G09_RECOVERY_INCOMPLETE` sob a exigência de 33 endpoints exatos.

Fonte do produto: `3ef84da65d6b8ad7cd3250412bbcabdf90924172`. ELF: `ff145b04dc0897b32b7cdd904cf3bba7d793cf4a391d3c02325d3c6125006a9f`. Recibo: `extracted/solid/solid-recovery-receipt.json`, SHA-256 `01b972679cdc662721141dba3317cb7860b40a051eb847e90e8c0eb8786e6bfb`. Harness executado: SHA-256 `c454af9091df64d6701ab5ba971eac205e12c8c1fdc7612a9256223346b77d7f`.

Estas verificações são candidatas à revisão de atribuição. Em todos os 33 IDs, o recibo preserva `endOfBunSpan: not-proven`, `tuiExecution: not-observed`, `formalG09Pass: false` e `reviewDisposition: not-assigned`. A análise Solid não executa a ELF. Evidência TUI de outra etapa tem seu próprio escopo e não é herdada por estes IDs.

## Cinco IDs ainda incompletos

Coordenadas abaixo são zero-based, em unidades UTF-16. Os arrays de origem têm formato `[sourceIndex, line, column]`. “Ausente” significa que não existe segmento na coordenada exata do fim do token; não autoriza interpolação. Um segmento com outra coordenada não é, por isso, um mapa inválido.

| ID | Arquivo relativo a `packages/tui/src/` | Fim no intermediário | Origem esperada | Entrada exata observada | Causa e regra que QA teria de avaliar |
|---|---|---|---|---|---|
| `18a091809496a9d5162a36c494b35ee590557c3729af4e738aa9cb214ad45b1a` | `context/data.tsx` | `[123,23]` | `[0,161,74]` | Ausente | `projectID` de propriedade shorthand. Atribuição por token completo e origem AST exigiria regra suplementar; o mapa não fornece o endpoint. |
| `98e5517da30a5e6b8a3ae98596e9ed9f4d079db4f84785e8d8b8060edc26ae43` | `component/dialog-move-session.tsx` | `[58,121]` | `[0,60,85]` | `[0,60,86]` | `projectID` em acesso a membro; a entrada aponta depois do parêntese removido na impressão. QA precisaria avaliar origem do nó exato; não arredondar a coluna. |
| `cac015cc219832e7b4ac54953d561a981962fc106781d788766660822726c568` | `component/dialog-move-session.tsx` | `[69,79]` | `[0,73,62]` | `[0,73,63]` | Mesmo desvio de uma coluna após parêntese, em outro token e outra expressão. Exige comprovação individual. |
| `1fc85caa720b5b14efca68ac644f48366a10c555d2f1d1a1ae503ab3d0313c11` | `component/dialog-move-session.tsx` | `[78,17]` | `[0,77,74]` | Ausente | `projectID` de propriedade shorthand. Não se presume endpoint a partir da próxima chave ou linha. |
| `376ceed62f07f09b65bf8a00538895654f87c95096cb2ca80bac2f59286f580b` | `component/prompt/move.tsx` | `[86,89]` | `[0,83,95]` | Ausente | `worktree` no fim de acesso a membro. Não se usa a vírgula ou o próximo segmento como fim do token. |

Os três mapas suplementares envolvidos têm hashes `72a6b2dc7c0896cf2daf281d4e63267210487d52ef50604b01cd82438ca529fe` (data), `baea4cc4087354756209821a8ae6a782789714e2e242325313f156fdea405199` (dialog) e `1e976a36b10c3d94f1823670b226cfe8f00aa1b0e51516ca8f3802190dbd2a40` (move). São os mesmos bytes diagnosticados no primeiro run; a correção de AST não alterou esses mapas.

## Correção confirmada do sexto caso anterior

O ID `3ebe805b3229fde11e11062c4e426a15b9470059a0769d3c14cd7ae58ad7183f`, atributo `projectID={projectID}` de `component/prompt/move.tsx`, agora é verificado. A fonte contém `JSXIdentifier`; o intermediário e o módulo da ELF contêm `Identifier`. A correção reconhece o tipo lexical correto e mantém checagens exatas de nome, bytes, início e fim. No run atual, ambos os endpoints Babel suplementares coincidem. Os novos controles distinguem atributo de expressão e rejeitam prefixos e conteúdo de string.

## Estado por ID

Todos os IDs abaixo têm tokens AST e inícios Bun/Babel verificados. “Exato” refere-se exclusivamente ao endpoint do mapa Babel suplementar; não significa endpoint Bun, execução do ramo ou classificação G09.

| ID | Arquivo relativo a `packages/tui/src/` | Token | Fim Babel suplementar |
|---|---|---|---|
| `b389e07e3177b16ee3f591a61ce41f335a3ca85c41c985b5df002c8f9b84d980` | `context/project.tsx` | `worktree` | Exato — candidato à revisão |
| `e47a2fff09b5400a8366e35747ea9351c13afef18956cce51dcfa126ffaec5dc` | `context/project.tsx` | `worktree` | Exato — candidato à revisão |
| `b7442cfe477bff4c3744aae62d3cf3725c9951ae0a194233f8b4ca56673e8627` | `context/project.tsx` | `worktree` | Exato — candidato à revisão |
| `7b04b54ddf45be1c11fcf0aa53bb404b4316d326e5e4511453db61e31003526a` | `context/sync.tsx` | `worktree` | Exato — candidato à revisão |
| `18a091809496a9d5162a36c494b35ee590557c3729af4e738aa9cb214ad45b1a` | `context/data.tsx` | `projectID` | Não comprovado — ver tabela acima |
| `39f46ca26bd02c1e4f630e0391850960763a88b3d4514d90f803da75534b5428` | `component/dialog-move-session.tsx` | `projectID` | Exato — candidato à revisão |
| `98e5517da30a5e6b8a3ae98596e9ed9f4d079db4f84785e8d8b8060edc26ae43` | `component/dialog-move-session.tsx` | `projectID` | Não comprovado — ver tabela acima |
| `8a98900d55dd795a06eecaa1cbd903cbe5d35a083e6c32af5ca3f506027ab044` | `component/dialog-move-session.tsx` | `projectID` | Exato — candidato à revisão |
| `b548581219ae46e5a859d2a6e76783bbbd4d960a671e434693fd12535f712170` | `component/dialog-move-session.tsx` | `worktree` | Exato — candidato à revisão |
| `cac015cc219832e7b4ac54953d561a981962fc106781d788766660822726c568` | `component/dialog-move-session.tsx` | `projectID` | Não comprovado — ver tabela acima |
| `94a8ce249a72b0a25d6d0590019c7d7eb555eff6d5b0940be56de49abd6f7d42` | `component/dialog-move-session.tsx` | `projectID` | Exato — candidato à revisão |
| `1fc85caa720b5b14efca68ac644f48366a10c555d2f1d1a1ae503ab3d0313c11` | `component/dialog-move-session.tsx` | `projectID` | Não comprovado — ver tabela acima |
| `144c46b492c695d1ec4673779831a1c5c25411426cdd91fa42198dd7d009a3d6` | `component/dialog-move-session.tsx` | `projectID` | Exato — candidato à revisão |
| `2dd6cf9ea4d4ccaa2882b23255cb822459fd88fc04e84a9a02d3d229c5f205c1` | `component/dialog-move-session.tsx` | `projectID` | Exato — candidato à revisão |
| `5a1267d62fb58a6d5d55057e7b5d57aaebe4e31058ddd4d54af62cb94d8a123a` | `component/dialog-move-session.tsx` | `projectID` | Exato — candidato à revisão |
| `22f7af640da4c10d117e3b220454b1b9cc7e6ad910251ecccb7aab531c1c4e9f` | `component/dialog-move-session.tsx` | `projectID` | Exato — candidato à revisão |
| `87fc3e98f77c08cb199f3854c13f539e063db5fe1d0fdce5afe329aa650b5404` | `component/dialog-move-session.tsx` | `projectID` | Exato — candidato à revisão |
| `7fd6054792c7dd23a3a6fbb6ab29985008339430b421aa6bd2ada59df12556d5` | `component/dialog-move-session.tsx` | `projectID` | Exato — candidato à revisão |
| `c950e53099371f9de8a335af42c89156fbed5a70047484ce9862b28b24d2e374` | `component/prompt/move.tsx` | `projectID` | Exato — candidato à revisão |
| `797b3c12856e1cdfcab33a55687d5bd6241c83461f1ba2cb696774a851fe98b5` | `component/prompt/move.tsx` | `projectID` | Exato — candidato à revisão |
| `d4e2ce61ff498242a7679b013ab0b1c1460ec04d5f63c7ae62b5757f24e1e54d` | `component/prompt/move.tsx` | `projectID` | Exato — candidato à revisão |
| `96cca4e61e631e385c6ea66dc795ebd85ec13c8293cd3bffb380014a0817bd7e` | `component/prompt/move.tsx` | `worktree` | Exato — candidato à revisão |
| `711b0835f85fb8efef7b4105144569cf1a19d4f7a514767e6e8882e8651c2c5f` | `component/prompt/move.tsx` | `projectID` | Exato — candidato à revisão |
| `3ebe805b3229fde11e11062c4e426a15b9470059a0769d3c14cd7ae58ad7183f` | `component/prompt/move.tsx` | `projectID` | Exato — candidato à revisão |
| `376ceed62f07f09b65bf8a00538895654f87c95096cb2ca80bac2f59286f580b` | `component/prompt/move.tsx` | `worktree` | Não comprovado — ver tabela acima |
| `a1daff3528a3e93b25439879c57a923b8e49b59710dabd11137e916ae1c7a6db` | `component/prompt/index.tsx` | `projectID` | Exato — candidato à revisão |
| `429e7f87b65fd24d6786d1ee22f4cc4347f81cbca2c54a9aae29c2088601d0c0` | `component/prompt/index.tsx` | `worktree` | Exato — candidato à revisão |
| `10e65917a2eca00a098fc2b7dced7f2d84d37beb7df77a27f6226f005a75d10e` | `component/prompt/index.tsx` | `worktree` | Exato — candidato à revisão |
| `70ba9e22eac1305a7cefe1c9d7541185bc06b070d0c124e23870205fe5090931` | `routes/session/index.tsx` | `worktree` | Exato — candidato à revisão |
| `2b0db0bde4b9a563734073d0df7671d54ee19a06962e19ae90ebd67351c62cbe` | `routes/session/index.tsx` | `worktree` | Exato — candidato à revisão |
| `c654a5d81962de7f8ee438d7b0503772385126700b4f5519a3aa3e5110d822dc` | `routes/session/index.tsx` | `worktree` | Exato — candidato à revisão |
| `bc5a344dfb8f659764393dbdf7fe502b7c940539e5449a56276d5ce7eede2f25` | `routes/session/index.tsx` | `worktree` | Exato — candidato à revisão |
| `1aabcf443be1e6a50fc955b0a8bfaf0c0610664c38d638a94cb97038b2eee990` | `app.tsx` | `worktree` | Exato — candidato à revisão |

## Possível suplemento de origem AST — ainda não executado

`ast: true` pode expor a árvore transformada com metadados de origem. Sozinho, isso não associa cada nó a uma ocorrência gerada específica. Uma nova regra só seria candidata a avaliação se demonstrasse uma correspondência estrutural única entre essa árvore e o AST reparseado dos intermediários cujos bytes já coincidem, preservando tipos, campos semânticos, ordem, operadores e nomes. O caminho estrutural do token identificado no intermediário teria de levar a um nó transformado com `loc.start` e `loc.end` correspondentes ao token completo da fonte.

Essa evidência seria complementar, produzida pelo mesmo transformador, e não um novo ponto de source map. Divergência de árvore, nó sem origem, duplicação com origens diferentes, nome divergente ou intervalo parcial deve falhar fechada. A regra exigiria controles negativos próprios e decisão explícita de QA; os critérios atuais, os cinco estados incompletos e `endOfBunSpan` continuam intactos.
