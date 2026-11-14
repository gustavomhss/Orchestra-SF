# R2 — revisão independente do WP10 W17

**Parecer: HOLD.** O achado BI do R2 foi resolvido nos bytes publicados. Não há novo achado obrigatório próprio nesta revisão de fonte. O check hospedado terminou em failure, a rechecagem funcional continua pendente, o freeze está em 37/38 e R1 identificou um bloqueio C17 que exige sucessor. Não há aceite de produto, nativo ou global.

## Candidato e independência

| Item | Identidade |
| --- | --- |
| Revisor | `/root/independent_r2_w16`, R2 sem autoria de implementação |
| Produto W17 | `2ec17b2c8204d5e953eec3186b7e236c0faaad47` |
| Árvore | `526f67866223b8b73e1bcae16e45ec9377b1af2e` |
| Pai W16 | `f3b9f512fbcae66bc369ff7dbbe6fa433ae4c9d0` |
| Destino | PR29 → sf2-stack |

O R2 não editou produto, não executou testes/typecheck/build/browser locais e não fez mutação remota. Apenas novos relatórios foram escritos. Foram examinados os autores de composição WP10 e os produtores PR31/PR33/PR36; o R2 não participou dessas implementações. Auditorias de builders foram tratadas como contexto, sem substituir a leitura independente.

O [commit publicado](https://github.com/gustavomhss/Orchestra-SF/commit/2ec17b2c8204d5e953eec3186b7e236c0faaad47), árvore e pai foram confirmados por GitHub MCP. Quatro blobs próprios e **todos os 18 novos blobs estrangeiros** foram lidos diretamente em seus respectivos commits.

## R2-W16-BI-QUERY-01 — resolvido em fonte

O [handler W17](https://github.com/gustavomhss/Orchestra-SF/blob/2ec17b2c8204d5e953eec3186b7e236c0faaad47/apps/cli/src/sucafina-product/extended-http.ts), blob `65ec2c948a1c83aa7ada84d5f0f806bd236038b5`, inclui `referenceDigest` na allowlist fechada de bi-source e no bootstrap usado pelo digest de admissão.

O delta mantém unicidade de parâmetros, validação hexadecimal, seleção restrita às origens da linha atual, escolha explícita entre múltiplas origens e nova leitura da projeção após resolver o link. O browser, a prova de escolha e as contraprovas de egress não foram removidos.

**Estado: RESOLVED_IN_PUBLISHED_SOURCE; rechecagem funcional hospedada pendente.** A revisão fecha o defeito de código anteriormente identificado, mas não afirma que a jornada do browser passou. O parecer W16 permanece inalterado.

## Nova reentrada de lifecycle

O [helper de produção](https://github.com/gustavomhss/Orchestra-SF/blob/2ec17b2c8204d5e953eec3186b7e236c0faaad47/apps/cli/src/sucafina-product/analysis-run-context.ts) captura a intenção humana e a versão original do caso. A reentrada admite analysis.start real e usa allowHistoricalRetry para alcançar a mesma encarnação atualmente autorizada. Isso não atualiza o seletor original: selectedCase e resolveCase continuam recusando operações frescas quando a versão avançou.

O helper recusa run diferente, Request abortado e host inativo; ao sair, confere novamente a ação humana, a identidade do Request e o vínculo do replay, e sempre limpa contexto e lease. O novo teste composto usa autoridade humana, case e C08 reais, cobre avanço de versão, membership removido, perda de acesso, host inativo, abort e substituição de encarnação. Não fabrica run/Task/sessão nativa para declarar execução.

As duas correções de tipos próprias do W16 estão presentes: dossier-consumers estreita reason; native-host-disposal fornece readLifecycle com recusa explícita not-exercised. As assertions permanecem. O resultado do typecheck exato ainda precisa ser avaliado nos logs.

## Deltas estrangeiros examinados

| Publicação | Arquivos | Avaliação de fonte |
| --- | ---: | --- |
| PR31 — `01633144c83fb1080e6d985ef226b8db2aa131cb` | 5 | Quatro consumidores passam a usar BusinessServices/BCS/case/scenario de produção e o novo helper compartilhado; assertions e cleanup são mantidos. |
| PR33 — `2784daafbb0d3b58b6019822288a07fa38e5c5b0` | 6 | Narrowing de continuidade/confirmação preserva condições; comparações de bytes/mensagens conservam ordem; schedule fixa identidade dos providers em cada await e no egress. |
| PR36 — `c21a990c57b714cd60bb7f915beb6be51acbafdb` | 7 | Settlement de unavailable/needs-input, digests antes de awaits, clones no staging C08 e contraprovas de aliases/cancelamento; composição Planner e restart usam produtores reais dentro de políticas de fixture declaradas. |

Os **18/18 blobs de origem** correspondem aos integrados. O problema anterior de fixture incompleta WP02 está corrigido em fonte pela composição real; isso não equivale a um run de UI aprovado.

A separação da fixture de sensibilidade conserva o cálculo positivo para seus consumidores, sem introduzir um novo verifier permissivo. O teste independente sensitivity-units-boundary continua sem alterações, incluindo seu segundo caso real. O leitor de restart usa replay de operações Planner e fences dos snapshots completos, ator e binding antes/depois. Políticas permissivas já presentes na fixture continuam sendo limites de prova, não autorização de produção nem execução nativa.

## Integridade e exclusões

- **1.115/1.115 arquivos hidratados** correspondem à árvore, com 16.093 blobs totais. Ausência na hidratação não significa exclusão.
- O delta contém exatamente **28 paths**: seis fontes/testes próprios, quatro novos recibos e 18 blobs estrangeiros. **Zero exclusões.**
- **393/393 pins** efetivos conferidos. Nenhum dos dez paths autorais viola o ownership/exclusões do pack.
- **96 recibos WP10 anteriores** permanecem idênticos.
- O mapa conserva **171 IDs únicos e todos os textos literais**, além das sete tasks. Nenhum status é promovido pela integridade textual.
- O índice original do handoff foi consultado remotamente: blob `22281097328a26be9d0dc17b98d4b19e08cd8eaf`, com **128 cópias estrangeiras e 131 inputs somente leitura**. O R2 não voltou a baixar individualmente todos esses blobs históricos; essa limitação está documentada.
- O manifesto estrangeiro do freeze9 e seu teste estrito permanecem intactos. A comparação estática resulta em **37/38**: host atual SHA-256 `6a608e24847fe730b645d5f51f86e47d83e803875162820038e0c05d18f96772`, esperado `4c654665a12aa02a6d5a851cdbe662f6f0fabdacf21e4b600f598e499a3a1922`. WP00 precisa publicar o binding final.

Inventários: `source-inventory-W17.json`, `remote-observation-W17.json` e `intake-audit-W17.json`. Hash do mapa de critérios: `95fc2fe3cdbebffa5aefe990991fb495c7d4f6c194395c27e01b7d8e2208a8e1`.

## CI e bloqueios

O [check W17 43587702180](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43587702180), snapshot `585831c5d9279a7b87f804bc3598ed66af1bb9e5`, foi observado diretamente pelo R2 como **completed/failure**, tentativa 1. Este parecer ainda não analisou os logs/artefatos desse run; não atribui contagens nem declara correção de typecheck. O run A do W16 não valida W17.

O root encaminhou um achado independente de R1: os consumidores de cálculo Planner ainda usam readers estritos e o caseRef armazenado, impedindo lifecycle após avanço de caso com C17 no ledger. **Atribuição: R1; não é uma redescoberta alegada pelo R2.** A correção requer sucessor publicado e nova revisão.

Permanecem abertos o adapter nativo C07, cinco descritores de rotina, paridade real das 39 operações, AM01–AM06, oito outputs, revisões finais e aceite global. O epic final deve aguardar o bundle completo, conforme o usuário.

A próxima rechecagem deve examinar o sucessor publicado, o delta C17 e resultados hospedados correspondentes de BI, lifecycle, consumidores alterados e driver. Não se transfere resultado W16/W17 para outro SHA.

