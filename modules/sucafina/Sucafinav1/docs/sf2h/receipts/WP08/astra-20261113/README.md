# WP08 — colaboração, vínculos e Meu trabalho

## Estado de entrega

**DRAFT / BLOCKED.** PR [#28](https://github.com/gustavomhss/Orchestra-SF/pull/28), de `astra-wp08` para `sf2-stack`. A implementação e os consumidores próprios foram publicados e corrigidos por CI hospedado; a aceitação integral das seis tasks e dos 132 critérios não foi obtida. S0 deve revisar e integrar somente após os bloqueios e as provas restantes serem resolvidos. Não houve merge em dev nem deploy.

Matriz literal: **27 PROVEN, 52 PARTIAL e 53 BLOCKED**. PROVEN significa cláusulas próprias demonstradas por asserts exatos, dentro dos limites registrados, sem atestar integração residente, UI ou qualificação global. Os outros **105 critérios não estão concluídos**.

| Task | Escopo | Critérios | PROVEN | PARTIAL | BLOCKED | Aceitação |
|---|---|---:|---:|---:|---:|---|
| WP08.T01 | Implementar relações explícitas entre referências | 19 | 6 | 3 | 10 | NOT_COMPLETE |
| WP08.T02 | Entregar comentários e pedidos contextuais de esclarecimento | 19 | 3 | 6 | 10 | NOT_COMPLETE |
| WP08.T03 | Confirmar sem alteração no escopo material revisado | 16 | 2 | 13 | 1 | NOT_COMPLETE |
| WP08.T04 | Projetar Meu trabalho a partir das fontes canônicas | 22 | 5 | 10 | 7 | NOT_COMPLETE |
| WP08.T05 | Encaminhar contexto para a ação Hot Topic existente | 19 | 7 | 5 | 7 | NOT_COMPLETE |
| WP08.T06 | Inicializar ciclos e direcionar perguntas decisivas | 14 | 1 | 4 | 9 | NOT_COMPLETE |
| WP08 | Critérios do pacote | 23 | 3 | 11 | 9 | NOT_COMPLETE |

## Código e comportamento verificado

- Vínculos usam identidades explícitas; fornecedores homônimos não são unidos automaticamente. Criar e remover vínculos PMO/CAPEX preserva os snapshots dos três domínios.
- Conversas retêm origem, encarnação, versão observada, período e autoria; responder ou resolver não aprova compras nem conclui Hot Topics. Revogação de acesso retira payloads.
- Confirmação de janeiro em v7 permanece válida após alteração isolada de fevereiro/global v8. Alteração material de janeiro produz uma única revisão de trabalho, mantendo o registro original. Atualização de referência para trabalho exige identidade física C17, ACL atual e a mesma autoridade canônica do caso.
- Resposta confirmada válida elimina a pendência de Meu trabalho; alteração material reabre uma única linha `answer-stale` sem copiar o corpo histórico. Essa linha não prova navegação ou nova resposta após o histórico ficar indisponível.
- Handoff usa o Hot Topic canônico. Perda do retorno depois do commit real e repetição da correlação recuperam uma ação; Meu trabalho acompanha sua conclusão na origem.
- O consumidor de perguntas cria a thread a partir da proposta realmente preparada, preservando versão/digest do caso e proveniência. Revalida escopo, período exato, horizonte, fonte e destinatário; retry após recomposição recupera a mesma thread. As leituras comuns não expõem metadata privada do caso. O caminho C11 exige reader canônico e ainda não tem prova positiva residente.
- Adaptadores próprios HTTP/host/dispatch incluem rotas POST, fechamento do grant humano e vínculo do payload. O mount externo, grants residentes e paridade native/MCP continuam pendentes.

## Validação hospedada exata

| Objeto | SHA / tree |
|---|---|
| Seed recuperado | `7991850fc338edde3091131902273b63ffa7992a` / `c39deb9d4c5033b445bdcaab8c71843abdfe20d7` |
| Produto W07 | `156f074d15c9787a9fc1b6430e632504ee3a69e6` / `548d9e07d5e2fe189adbaa11f931fbbbedf114d2` |
| Snapshot S06 | `b55254b4da225f3ad874b27885d4792c69f047ac` / `32ed1ae4e1cf3eae03c2b0c6fe64740e7bbdbcf6` |
| Request | blob `59a06c32fbe8c3157828a3f74ceccf3ca670c7bc`; SHA-256 `23ce64a53d923c581663869acc786799bfdea3566a4bebcfa28f5e0368433538` |

O [compare W07→S06](https://github.com/gustavomhss/Orchestra-SF/compare/156f074d15c9787a9fc1b6430e632504ee3a69e6...b55254b4da225f3ad874b27885d4792c69f047ac) contém somente `.ci-run.json`: todos os blobs de produto, testes, configuração e fixtures são idênticos. O head final da PR acrescenta estes recibos; seu SHA/tree e o compare de documentação são registrados na PR, evitando uma referência recursiva no próprio commit.

| Gate | Run / job | Resultado |
|---|---|---|
| Testes `test-ci` | [43533574980](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43533574980) / `132256977328` | **FAIL**: 64 PASS, 2 FAIL; 66 testes em 34 arquivos, 640 expects |
| `bun typecheck`, `modules/sucafina` | [43533577577](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43533577577) / `132256985545` | **FAIL**: 128 diagnósticos, 0 em WP08; 128 em 41 caminhos fora do escopo |
| `bun run check:guards --base origin/dev` | mesmo run de checks | **PASS**: 78 regras, 590 paths, 0 gates, 11 avisos, 0 erros |

Os dois FAIL são `selection.test.ts` (`individual capture failed`) e `work-presentation.test.ts` (`procurement-work-source-unavailable`), ambos antes das respectivas asserções individuais de Procurement. O `approvalStage` publicado pelo seletor não está na lista exata esperada pelo projector canônico desta árvore. Não se alteraram os asserts para ocultar essa divergência.

Artefato de checks: [14087843500](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43533577577/artifacts/14087843500), SHA-256 `5484acb917040125ce8034c807e3a7906ac63fee0db2f2aee0c7e21bb3ad4269`, retenção até 2026-11-28. O run Bun não exige artefato adicional; os logs e [test-results.json](test-results.json) registram os casos exatos. Omni positive control: **not applicable**, nonce `7bf29e67413c037a7f297974b89b40f4`; não houve prova de execução omni/native.

Os diagnósticos de typecheck estão **localizados** fora de WP08. Não houve execução isolada do seed para demonstrar que todos eram preexistentes ou causalmente independentes. [validation.json](validation.json) conserva os 7 commits de correção e todos os resultados anteriores, inclusive as falhas próprias corrigidas.

Não se executaram testes locais de produto, typecheck local, suíte epic ou full-suite. A validação local se limitou a metadados canônicos do request, leitura de fontes, hashes e integridade documental. A qualificação C/G7, D/G8, AM01–AM06 e as oito seleções integradas finais não foram executadas.

## Bloqueios e delta para os owners

1. **WP00/WP04/WP10 — B01:** admitir um único schema publicado de campos de `procurement-request`, incluindo `approvalStage`, e alinhar a projeção e o issuer individual. Rerodar os dois casos falhos e demonstrar alçadas/transferência de holder reais.
2. **WP01/WP10:** montar os consumidores próprios; registrar as quatro ações humanas adicionais, grants, autoridade atual de destinatário com lease síncrono e `workCaseAuthority` idêntico ao autorizador canônico do caso. Fornecer o leitor C11 canônico de propostas e a admissão de leitura de `question-output`. Reforçar C08 contra escrita direta de histórico/seleção.
3. **WP02/WP03/WP04/WP10:** admitir os observadores/manifests publicados dos três domínios e demonstrar dependências materiais reais. Os pins foram inspecionados; não foram incorporados como versões canônicas deste candidato.
4. **WP07 e produtores:** provar C05 preservado, navegação histórica e nova resposta após alteração material. Preservar metadata não estabelece que a conversa histórica possa ser aberta.
5. **WP09/WP11/WP00:** executar a rotina sem recobrança indevida e fechar os campos de motivo, efeito e prioridade decisiva de `QuestionProposal`, além do consumo de respostas/correção oficial/hipótese explícita.
6. **S0 e owners dos diagnósticos:** resolver o typecheck e executar UI/native/MCP e a campanha integrada aplicável antes de aceite. Zero erro próprio e guards verdes não tornam o pacote aprovado.

O [delta de integração](integration-delta.md) contém os pontos de ligação, contratos, restrições, pins publicados e condições de execução. Nenhum arquivo estrangeiro foi corrigido silenciosamente.

## Preservação e ownership

O [compare seed→W07](https://github.com/gustavomhss/Orchestra-SF/compare/7991850fc338edde3091131902273b63ffa7992a...156f074d15c9787a9fc1b6430e632504ee3a69e6) contém 56 caminhos: 29 de produto collaboration, 26 de testes/helpers WP08 e o workflow mínimo autorizado por CI.md. [input-preservation.json](input-preservation.json) conserva os hashes dos 11 inputs estrangeiros arquivados: nenhum foi sobrescrito, restaurado sobre fonte atual ou admitido como versão canônica. [producer-pins.json](producer-pins.json) identifica fontes publicadas inspecionadas somente para o delta dos owners.

## Critérios ainda não concluídos

Cada ID abaixo está detalhado com texto canônico, consumidores e lacunas no [índice de critérios](criteria-index.md) e na [matriz JSON](criteria-132.json).

- **WP08**: WP08.DOD.01, WP08.DOD.03, WP08.DOD.20, WP08.DOD.10, WP08.INV.01, WP08.INV.20, WP08.QLT.01, WP08.QLT.02, WP08.QLT.20, WP08.QLT.10, WP08.CMP.01, WP08.CMP.02, WP08.CMP.03, WP08.CMP.04, WP08.CMP.20, WP08.CMP.10, WP08.SUC.01, WP08.SUC.02, WP08.SUC.20, WP08.SUC.10
- **WP08.T01**: WP08.T01.CHK.18, WP08.T01.DOD.02, WP08.T01.DOD.18, WP08.T01.INV.01, WP08.T01.INV.02, WP08.T01.INV.18, WP08.T01.QLT.01, WP08.T01.QLT.02, WP08.T01.QLT.18, WP08.T01.CMP.01, WP08.T01.CMP.18, WP08.T01.SUC.01, WP08.T01.SUC.18
- **WP08.T02**: WP08.T02.CHK.01, WP08.T02.CHK.02, WP08.T02.CHK.18, WP08.T02.DOD.02, WP08.T02.DOD.18, WP08.T02.INV.02, WP08.T02.INV.18, WP08.T02.QLT.01, WP08.T02.QLT.02, WP08.T02.QLT.18, WP08.T02.CMP.01, WP08.T02.CMP.02, WP08.T02.CMP.18, WP08.T02.SUC.01, WP08.T02.SUC.02, WP08.T02.SUC.18
- **WP08.T03**: WP08.T03.CHK.01, WP08.T03.CHK.02, WP08.T03.CHK.03, WP08.T03.CHK.04, WP08.T03.CHK.05, WP08.T03.DOD.01, WP08.T03.INV.01, WP08.T03.INV.03, WP08.T03.QLT.01, WP08.T03.QLT.02, WP08.T03.CMP.01, WP08.T03.CMP.02, WP08.T03.SUC.01, WP08.T03.SUC.02
- **WP08.T04**: WP08.T04.CHK.01, WP08.T04.CHK.03, WP08.T04.CHK.04, WP08.T04.CHK.18, WP08.T04.DOD.01, WP08.T04.DOD.18, WP08.T04.INV.02, WP08.T04.INV.18, WP08.T04.QLT.01, WP08.T04.QLT.02, WP08.T04.QLT.18, WP08.T04.CMP.01, WP08.T04.CMP.03, WP08.T04.CMP.18, WP08.T04.SUC.01, WP08.T04.SUC.02, WP08.T04.SUC.18
- **WP08.T05**: WP08.T05.CHK.01, WP08.T05.CHK.03, WP08.T05.CHK.18, WP08.T05.DOD.18, WP08.T05.INV.18, WP08.T05.QLT.01, WP08.T05.QLT.02, WP08.T05.QLT.18, WP08.T05.CMP.02, WP08.T05.CMP.18, WP08.T05.SUC.02, WP08.T05.SUC.18
- **WP08.T06**: WP08.T06.CHK.02, WP08.T06.CHK.03, WP08.T06.CHK.18, WP08.T06.DOD.01, WP08.T06.DOD.18, WP08.T06.INV.01, WP08.T06.INV.18, WP08.T06.QLT.01, WP08.T06.QLT.18, WP08.T06.CMP.01, WP08.T06.CMP.18, WP08.T06.SUC.01, WP08.T06.SUC.18

## Arquivos de evidência

- [criteria-132.json](criteria-132.json) e [criteria-index.md](criteria-index.md): 132 IDs/textos, classificação literal e lacunas.
- [evidence-catalog.json](evidence-catalog.json): asserts, nomes exatos, blobs, resultados e limites.
- [validation.json](validation.json), [ci-request.json](ci-request.json), [test-results.json](test-results.json), [typecheck-diagnostics.json](typecheck-diagnostics.json): runs, árvores, request e diagnóstico.
- [task-status.json](task-status.json): aceite das seis tasks, todas NOT_COMPLETE.
- [change-manifest.json](change-manifest.json), [input-preservation.json](input-preservation.json), [producer-pins.json](producer-pins.json), [integration-delta.md](integration-delta.md): ownership, proveniência e próximos deltas admitidos.
