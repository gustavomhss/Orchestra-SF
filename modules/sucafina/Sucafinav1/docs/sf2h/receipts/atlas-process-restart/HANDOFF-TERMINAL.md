# Missão35 — handoff terminal para a sessão33

**Estado: TERMINAL_DELIVERED_WITH_BLOCKERS.** A regressão de processo separado de M29-ATLAS-003 foi corrigida e a prova do componente passou. A seleção completa continua vermelha por uma negativa C17 preservada; o aceite final permanece com S0/sessão33.

## Entrega e autoridade

Branch `astra-wp14`, mesma PR38. Planejamento `dbf9547211d9b0fade619790de7c19c0869b7c7d`; missão35 no commit `970ae24e36cae47dfa7e0df327e409d9cc3fcea7`. Foram reconciliados o head original `f8031d7c54ec2fa06359156dc0b6462c3a248633`, seu handoff terminal, o composto observado pela missão e as autoridades posteriores. `AUTHORITY.json` registra a leitura de AGENTS, START, WORKFLOW, COMMON, pack S0-C completo e três anexos; o pack integral e anexos tiveram leitura auxiliar explícita, sem atribuir isso a uma aceitação independente.

Produto fonte final P2: `5fa1ef92608cfbd315f5d753bd27eee5bdec39bf`, tree `62fb11d740756893873babe4cc4d9a313176b601`. O commit que contém este handoff é seu filho direto apenas documental. A descrição da PR e a resposta terminal identificam o SHA desse commit; os resultados continuam atribuídos aos produtos efetivamente executados.

Os únicos arquivos de código alterados nesta missão são:

| Path sob test/product/wp14 | Preimage composto | Postimage final |
| --- | --- | --- |
| source-access-atlas.test.ts | d7d2a69837560f42438d470b83724c1a61939a73 | a7d5b4c8346c8f092b4497e7ae8c44aa5f8b53c9 |
| atlas-restart-reader.ts | 6194f415573636efd47751f977cd157c9396f17d | 65c5fd04f6af34a241e6cc0bd40cd968cdc6e353 |

O arquivo `0001-restore-atlas-process-proof.patch` é o patch completo contra esses preimages, SHA256 `88b469dfcde4b68fadcf09012cf9ecc186a41fd1e5385b2dca87a03b21327cfb`. `preimages/original/`, `preimages/composed/` e `postimages/` conservam os arquivos completos. A extensão `.txt` dos anexos evita sua inclusão no grafo TypeScript. `INPUTS-AND-PATCH.json` contém blobs, hashes, modos e input completo por commit/tree.

## Reconciliação do teste

O teste composto foi a base. O caso C17 inteiro permanece byte a byte idêntico: SHA256 `ba60a5d4d8ffd8bbc743d3030db473ad9350b03a001a5f0a9a07eb93e876cc1c`. O primeiro caso recupera o leitor isolado, conserva os checks integrados e adapta somente o harness às interfaces reais compostas: request estável por contexto e source access com state/authorizeCase/authorizeEvidence. Não foi transplantado o arquivo antigo inteiro.

O pai publica no Atlas real com scanner real, verifica committed e already-committed, lê o estado protegido e fecha SQLite. O filho usa AppProcess/ChildProcess, abre o mesmo estado e reconstrói os ports reais. O consumidor createSfCaseRecall chama o leitor canônico Atlas; o helper exige identidade, recibo, envelope, captura/projeção e digests consistentes.

A prova não depende de uma linha dizendo sucesso: o pai observa o PID no handle, compara-o ao PID retornado e ao próprio PID, exige exit 0 e um único recibo com challenge novo, rejeita truncamento e compara todo o envelope/capture ao estado protegido gravado antes do fechamento. Depois da saída do filho, reabre SQLite e verifica Atlas/outbox sem alteração.

Negativas executadas no primeiro caso: outsider e evidência revogada no filho; principal revogado, referência forjada e seleção vazia no pai; substituição real da encarnação C08 e recusa da referência antiga sem projeção/currentRef. As negativas não modificam Atlas/outbox.

## Identidades da execução hospedada

| Papel | SHA / identidade |
| --- | --- |
| Input composto | b19606b73f1ffc5a9e58702e939f1aa788dabfa1 |
| Tree integral do input | 561700c145767a16d42e8b2103bd0ea81d0b379f |
| W2: input + somente dois postimages | 32bcb308059283a0f2d80f70b5b06f75fba1f427 |
| Tree W2 | 4943a243d28c15e41b5b47ce1828e91898e0dc7d |
| S2: W2 + somente .ci-run.json | fd9cb75b89456798e48c1f8e84ca4f3e4c6e524c |
| Tree S2 | f38ae2f98e4c29434f078c13ce96c98ade0af987 |
| Request SHA256 | 3f35ec9118fcbebf663c87f9024c8dfcca1bad489eb7c029cb9ca1347a7dbfd9 |
| Run / job | 43645747336 / 132602998463 |

O compare MCP confirmou os dois arquivos entre input e W2, e somente `.ci-run.json` entre W2 e S2. Todos os demais blobs de runtime, engines, host, fixture, config e dependências são os da árvore integral pinada. Os dois postimages são também idênticos na PR38.

Request validado pelo dispatcher existente:

```json
{
  "package": "sucafina",
  "directory": "modules/sucafina",
  "runner": "bun",
  "args": [
    "Sucafinav1/test/product/wp14/source-access-atlas.test.ts",
    "--timeout",
    "120000"
  ],
  "env": {}
}
```

[Run 43645747336](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43645747336): **1 PASS / 1 FAIL, 89 expect calls, 44,97 s**. O primeiro caso passou em 34,716 s; o C17 falhou em 9,957 s. `runs/attempt-2.json` preserva seleção, etapas, erro, hashes dos logs lidos, metadados e atribuição. `runs/attempt-1.json` conserva a primeira execução falha e a correção do erro de declaração introduzido nesta missão; não houve repetição equivalente sem mudança material.

Omni positive control **PASS**, nonce `a5f763a7d6bed39d9b4897290ed14384`, dois testes declarados, cinco spawns, zero delegados. `expectSpawn(import.meta.path)` permaneceu ativo. Nenhum child_process direto, exceção de allowlist ou aumento de budget foi introduzido.

### Prova de processo e dados

| Evidência | Resultado |
| --- | --- |
| PID pai | 4089 |
| PID observado no handle / PID filho | 4140 / 4140 |
| Saída do filho | 0 |
| Consumidor real | ok, 1 match |
| Outsider / revogado / encarnação substituída | unavailable / unavailable / unavailable |
| Atlas/outbox após filho e negativas | sem alteração |
| nativeSessionWitness | false |

Evento `9ba87da71e9cd482e4d24e4768a793a1c2b72984fce838d5c30e92350e1e4ebe`; recordDigest `01a282dd6a3f15e82a577566a296d2e859a51273fcedd93a8036f811f6a887c8`; captureDigest `8aaf67cb6af2838c560b1a5d181077c7983fa0babaef025ad1561aabdc1cd7a8`.

Gitleaks real `8.30.1`; binário SHA256 `88f91962aa2f93ac6ab281d553b9e125f5197bbbce38f9f2437f7299c32e5509`. A captura completa, projeção e resultado do consumidor estão em `runs/attempt-2-process-proof.json`, SHA256 `19012e8e29d28ec0433062c4d900b1df0684cab2966db539857e0c685ef0e270`. O filho terminou em 15,226 s; observou 16 leituras de caso, 50 de evidência, 5 de Atlas, 72 de original e 2 rankings. Esses contadores são observações do harness, não simulação dos serviços.

O workflow test-ci existente não publicou artifacts para essa seleção; a API retornou lista vazia. O recibo formal preserva o payload completo. Não se afirma existência de ZIP/SQLite exportado.

## Falha C17 preservada e proposta ao owner

O teste substitui bytes reais do documento de `Price: 42` para `Price: 99`. A resolução canônica recusa a fonte, sem authorizedProjection/currentRef. A assertion seguinte, linha444, exige que `atlas.memory.readOriginal` também recuse, mas recebe a referência antiga. A falha ocorreu nas duas tentativas, com o caso C17 intacto.

A captura canônica de baixo nível foi projetada como primitive de ACL/integridade e serve às leituras históricas. A lacuna está no método exposto pela composição, que ainda devolve essa referência sem o gate atual da fonte. A observação não demonstra vazamento pela capability MCP, cuja resolução recusou corretamente.

A missão35 não tem autoridade para editar esse runtime. `owner-proposal/` contém patch completo de dois arquivos, preimages/postimages e manifesto, estado **PROPOSED_NOT_APPLIED_NOT_RUN**, para avaliação pelo owner vigente e composição da sessão33. A proposta acrescenta autorização atual ao readOriginal público e reautorização canônica ao replay settled. O problema do replay foi inferido por leitura estática: as assertions posteriores à linha444 não foram alcançadas.

Não se coloca context.resolve dentro de readOriginalCapture, pois o histórico já precisa desse primitive e tal mudança criaria recursão. A proposta precisa de typecheck e regressões históricas/negativas no Actions pelo owner, sob os budgets existentes; nenhum resultado deste handoff a valida.

## Compiler e guards

[Run 43645751452](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43645751452), job132603011172, envelope `31b49d7bc9ee59feb4407d4229a155f81fd330d1`, examinou exatamente **P2**, após passar a validação e o checkout. Dev fixado para guards: `a1d37698a7bb097c1578f827eba6a19b9917ef07`.

- Typecheck **FAIL**, 152 diagnósticos: 139 fora de WP14, idênticos aos da primeira tentativa; 13 de WP14 por APIs/fixture compostas ausentes no parent antigo e erros de inferência decorrentes. Os erros de declaração e matcher introduzidos nesta missão desapareceram.
- Guards **FAIL**: 78 regras, 661 paths, dois gates, 11 avisos, zero erros de execução. Os gates são os dois arquivos .log antigos em `receipts/WP14/owner-findings/consumer-audit/0cf10879/`, com blobs iguais ao head original f803. Foram preservados fora do escopo; nenhum ignore ou aprovação foi fabricado.
- Artefato `14133912318`, `astra-wp14-check-1`, digest informado pelo GitHub `sha256:c7b8ad82deff3f6f74a00d453a31c91fff2c6869b558731f5c4de3dc6a4314a0`. Logs lidos; ZIP não baixado/inspecionado.

Compiler/guards **de W2 são NOT_RUN**. W2 não contém astra-wp14-check.yml; o workflow existente exige somente o envelope sobre o produto. Usá-lo para outra árvore exigiria mudança fora da autoridade35. O check da árvore fonte não é atribuído à composição.

## Autoridade posterior e consumo

Na conferência terminal, sf2-control avançou para `acd92cb0cb6a931bfb2a6d33ef13ae572334a209` somente acrescentando missões36/37; missão35 e COMMON permaneceram iguais. A reconciliação33 confirma a mesma autoridade delimitada e exige este handoff antes do intake.

sf2-stack avançou para `2c44f5d63b6f1a09bd81610be6fe3a1087f6daa0` durante a execução. Os preimages dos dois testes/helpers ainda são exatos, mas há mudanças de host/rotinas/qualificação em outros paths. **Essa nova árvore não foi testada por esta missão.** A prova pertence exclusivamente a W2. Detalhes em `TERMINAL-RECONCILIATION.json`.

Sessão33 deve reconciliar o head atual, consumir o patch delimitado por preimages/postimages e obter validação da árvore realmente integrada. O owner deve reconciliar e qualificar a proposta C17 antes de sua aplicação; a seleção não pode ser declarada verde removendo a negativa.

## Fronteira nativa e encerramento

`nativeSessionWitness:false` continua falso. O harness usa identidades/pertença UI sintéticas declaradas e um challenge novo; isso não constitui admissão SessionV2. AM05 ainda exige sessão nativa real, binding confiável novo, provider/Task/SkillLoadReceipt e consumidor real vinculados, com reload/readback e egress autorizado no ambiente nativo.

As assertions originais de seleção nativa sintética que dependiam do seam opcional authorizeRecallCase ausente no source access composto estão arquivadas nos preimages originais; não se afirma execução dessa suíte original. Nenhuma concessão artificial foi acrescentada para fabricá-la.

Encerramento da autoridade35: entrega terminal de código e evidência com bloqueios explícitos. Sem runtime de persistência34, Memory/Atlas engines ou host alterados; sem restart desktop/server, testes de produto locais, epic/full suite, merge em dev, deploy, Azure, credenciais, mensagens a terceiros, force ou escrita em sf2-stack.
