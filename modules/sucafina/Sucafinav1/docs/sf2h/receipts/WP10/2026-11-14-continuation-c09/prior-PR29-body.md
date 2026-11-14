## WP10 — W27 publicado; Memory em qualificação hospedada

W27 compõe leituras canônicas de Memory e a participação privada de leitores no mesmo escopo C08. Mantém os produtores e suas observações reais, os valores financeiros, os asserts anteriores e os budgets. O teste de limiar exato recebeu instrumentação para localizar o custo observado em W26. **Esta PR permanece draft:** o CHECK continua bloqueado por 13 diagnósticos estrangeiros, o corte X27 terminou em failure e o corte A27 está em execução. Nenhum resultado abaixo representa aceite nativo ou global.

| Identidade | Pin / evidência |
| --- | --- |
| Produto W27 | [`ab8fb4f29d078d179742a77679ef85e5c549b114`](https://github.com/gustavomhss/Orchestra-SF/commit/ab8fb4f29d078d179742a77679ef85e5c549b114) |
| Tree W27 | `6b889a436fafe019580801edba3015d90fa75dfd` |
| Pai único W26 | `a1434e7ea7340aa1d1c8ce6bb48958b724218170` |
| Base da PR | `sf2-stack@6b8b4090cf3c3ec952986a7f4fc602f1266bf6e0` |
| CHECK27 | [run 43623374771](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43623374771), job 132533766371, S `26db95e4764bf80148543798aa594ac7921f3b22`: **FAIL; zero diagnósticos próprios / 13 estrangeiros** |
| X27 | [run 43623440133](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43623440133), job 132533968037, S `329a3b4547ec77c6b516ac1f28c732f0fc076902`: **FAIL: zero pass / um fail, um teste / um arquivo, três expects, 285,57s**; cleanup 132535684366 success |
| A27 | [run 43624030665](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43624030665), job 132535810515, S `e336f3e945fc22ae737af9b2425186c25b46a43d`: disparado às 17:59:02 UTC, **sem resultado terminal neste corte** |

### Composição própria em W27

- **Memory:** a observação externa de `sf-memory-case-fence` mantém o estado C08, os snapshots, fences de fontes e identidades reais. A leitura Atlas ocorre sob seu próprio grant `atlas`, inclui a partição inteira e compara a testemunha externa com uma nova leitura canônica dentro do escopo qualificado. A leitura do caso continua exigindo o grant `cases`. As duas observações Atlas permanecem independentes; writers e marcadores externos ficam fora do escopo. Mudança depois do início do trabalho recusa, sem retry ou recaptura da autoridade.
- **Participação de leitores:** um token privado existe somente dentro da transação real, para dependências, Request, lease, binding, headers e referências completas exatas. Cada participante mantém suas verificações reais de autenticação, ambiente e revalidação. Identidades diferentes seguem a qualificação completa. Os pins dos participantes permanecem vivos até depois do retorno de `await transaction`, inclusive para detectar alterações depois que um filho termina. Filhos pendentes, trabalho destacado, writer aninhado ou alteração de identidade recusam.
- **Provas próprias:** os três casos anteriores de record scope, seus 24 asserts e budgets de 120s foram preservados; há 14 casos adicionais. Os 84 asserts anteriores de Memory, sua cauda de lifecycle/cancelamento e os budgets de 225/240s permanecem; oito asserts medem as entradas e conclusões Atlas reais. O teste de limiar exato mantém os 40 asserts, a fixture numérica e 285/300s; wrappers transparentes medem chamadas dos produtores reais, sem cache, substituição de resultado ou alegação de melhora.

O escopo de armazenamento usa `LocalStore.operation(true)` / **`BEGIN IMMEDIATE`**: `commit:false` impede commit de domínio, mas não torna a transação SQLite fisicamente somente leitura ou não bloqueante. Há reserva de writer. A elegibilidade permanece estreita: um domínio de negócio Procurement, metadados C08/Atlas do mesmo caso, nenhum writer de domínio ou fechamento misto. Latência e concorrência continuam dependentes de medição hospedada.

R1 identificou a lacuna de egress da primeira proposta e emitiu HOLD. A versão selada v2 conserva os pins até o egress externo; o recheck independente registrou **`STATIC_COMPOSITION_ADMISSIBLE / HOLD_HOSTED_RECHECK_PENDING`** para os cinco paths Memory. O HOLD anterior e a proposta rejeitada estão preservados. Esse parecer focal não conta como revisão FINAL.

Incremento: **173 paths, sendo seis fontes/testes próprios e 167 recibos novos; zero inputs estrangeiros novos ou deleções**. Permanecem **439 pins efetivos, 16.878 blobs na árvore, 1.905 arquivos hidratados congelados, os 128 inputs estrangeiros arquivados e os 131 inputs somente leitura**.

[Preparação W27 com auditorias, pins, selos, pareceres e recibos históricos](https://github.com/gustavomhss/Orchestra-SF/tree/ab8fb4f29d078d179742a77679ef85e5c549b114/modules/sucafina/Sucafinav1/docs/sf2h/receipts/WP10/2026-11-14-recovery/preparation-W27)

### Evidência hospedada e limites

**CHECK27:** os 13 diagnósticos e seus blobs de origem são idênticos aos de W26: WP04=3, WP06=4, WP08=5, WP09=1; zero introduzidos ou resolvidos. CLI, consumidores de teste WP10, Atlas/typegen e guards passaram nos seus escopos. O run completo continua failure. Artifact **14125043272**, ZIP 4.363 bytes / 11 membros, SHA256 `2766c43771fc434a8a75ac5f2af3efd314ab22e7abe9d1a8e25bd4fb6fd73a1f`; raw SHA256 `e1b060ed492459ce682843c3d827d8c8bab600cb95006b88fb06adf5222b0ce5`; entry SHA256 `fb66e4e7d9e5dedd604c3e00d28130c491d7d303335bdcf957159bc459c9d925`; selo `2a71fc9650bfc42b45873f73f1ffe71896960f4b996efcdf01f8cc0fc1e92c54`.

| Terminal histórico no SHA original | Resultado e limite |
| --- | --- |
| [A26 — 43618475702](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43618475702) | 45 pass / 1 fail, 46 testes / oito arquivos, 1.904 expects, 391,43s. C07 corrigido e aprovado 5/5. Memory atingiu 225s durante `same-request-new-proof`; `stale.preserve` e a cauda posterior não foram alcançados. Raw SHA256 `b4b41f42838860c118967c8a08182f9f0cf2af01835bd2b1cf3ce8817c8f7f41`. |
| [X26 — 43619479808](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43619479808) | Zero pass / um fail, um teste / um arquivo, três expects, 285,82s. Fixture 9.640ms; `host.evaluate-and-store` 275.640ms. Deadline antes de persist/reload/retry/revogação; sem atribuição interna pelo log antigo. Raw SHA256 `11eda6cac42c499c5262a5f7ca5dea483bcf6e3b8eff52e8478e79050408a7bc`. |
| [B26 — 43620440087](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43620440087) | **38 pass / 2 fail, 40 testes / sete arquivos, 533 expects, 1.420,51s; próprios 28/1, estrangeiros 10/1.** Ancestry próprio: deadline cooperativo 105s em `produce-outer`, 373 leituras canônicas concluídas; reopen/cycle/revogação não alcançados. WP11 estrangeiro: caso nested/reopen atingiu budget Bun de 180s, 188.985,84ms observado. Essa fixture instancia produtores diretamente; não é comprovadamente a mesma causa da composição própria. Cleanup 132531826661 success, artifacts vazios; raw SHA256 `c1b4f91d069a9fc26305b1be2a89e7c285d6ab92666f0f09e56e9e7cf9edcbcd`. |
| [H25 — 43616586837](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43616586837) | 42 pass / 1 fail, 43 testes / três arquivos. Os 35 próprios passaram; WP04 H05 recebeu 200 onde o teste exige 409. O estado posterior não recebe crédito. |
| [D22 — 43610668152](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43610668152) | Cancelado/parcial; 27 pass / 2 fail nominalmente observados e um erro adicional, 9/18 headers, sem Bun summary. Os três arquivos próprios não foram alcançados; causa do cancelamento não identificada. |

**X27:** o prazo cooperativo de 285.000ms foi novamente atingido em `evaluate-and-store` (277.391ms). As 22 chamadas numéricas reais de `primary.planner.simulateScenario` retornaram `ok`, com 12.318ms inclusivos no total. A chamada final de `sensitivityBindings.bind` durou 75.247ms e contém `proof.verifySensitivity` de 73.060ms. As recusas observadas surgem somente junto ao abort, aos 285.162–285.163ms. Isso localiza trabalho relevante nas leituras e verificações ao redor do cálculo; não demonstra uma recusa funcional anterior ao deadline nem autoriza remover os verificadores canônicos. A curadoria do trace e seu selo completo seguem em andamento.

Contagens de chamadas de ambiente/C08/result reader são chamadas de API, não I/O físico ou resultados distintos. Os traces medem durações inclusivas e sobrepostas; não são somados como tempo de parede. Omni strict permanece separado de aceite nativo.

### Qualificação e revisão ainda necessárias

As 12 requests foram validadas contra W27 pelas regras publicadas de CI: **dez cortes required / 57 seleções de arquivos completos**, mais B7 e H3 condicionais a falha ou risco concreto. A27 verifica Memory/authority/lifecycle; Review/BI, browser, CLI, os três cortes D não alcançados e as provas financeiras P/Q permanecem pendentes. Cada test-ci aguarda terminal e cleanup do anterior; CHECK pode sobrepor. Não há name filters, testes locais de produto ou ampliação dos budgets. Resultados antigos conservam seus próprios W/S/run IDs.

Os **171 critérios literais, sete tasks e 80 obrigações** permanecem no mapa. Ainda são necessários os três pareceres FINAL de revisores independentes não autores sobre o candidato final e seus terminais exatos; preflights e auditorias de builders não os substituem. O pacote final D será somente de novos recibos, com guard hospedado próprio. O epic global será executado depois do bundle de TODO o trabalho, conforme instrução do usuário.

### Pendências de integração externas

- **CHECK:** os 13 erros estrangeiros acima exigem outputs publicados compatíveis dos owners; os arquivos excluídos de escrita continuam intactos.
- **H05 WP04/WP11:** teste e produtor publicados divergem sobre avanço não interferente da versão do caso. Necessária combinação publicada compatível dos owners/S0.
- **Freeze10:** 37/38; host SHA256 esperado `6a608e24847fe730b645d5f51f86e47d83e803875162820038e0c05d18f96772`, composto `42839b627194c59febff34052b813a6e4725414dcf84c8308397539b734b3893`. Nenhuma expectativa estrangeira foi reescrita.
- **CurrentChoice:** o finding de final lease refere-se ao cohort de quatro arquivos da PR35 que continua **retido**, e não a um defeito runtime instalado em W27. O preview instalado termina seu último await com `host.revalidate`; o blob retido acrescenta duas leituras C08 depois. A revisão não encontrou consumidor próprio nos 748 blobs de escopo explicitamente conferido. Não houve ampliação do intake sem dependência demonstrada; uma eventual composição futura exige contraprova de revogação durante o último await real.
- **Native/residente:** há captura legítima de `Tool.Context` para `sf_*`; ela não satisfaz a parte Task real com nome `task` e input gravado. As APIs públicas de Relay/governança não completam a cadeia C07. Para workflows com anchors faltam resolvedor canônico público e vínculo à Session Archie real; não é bloqueio universal do catálogo readonly. Watch carece tanto de incorporação dos descriptors quanto de admissão/schedule/ocorrência/owner reais; registrar descriptor sozinho mantém a recusa `native-watch-admission-port-unavailable`. Nove operações nativas, cinco callables, AM/GNATIVE, jornadas instaladas não vazias, 39 rotas/oito packs/cinco perfis/18 skills permanecem sem aceite integral.
- **C17:** o limite estrangeiro de headers entre observações externas permanece uma constatação estática, distinta de uma violação runtime observada. O timeout estrangeiro de WP11 em B26 também permanece identificado separadamente.

Handoff `a3d29d011ba3607a57914701300f09117a3e2de9`; plano `dbf9547211d9b0fade619790de7c19c0869b7c7d`; campanha SHA256 `703dd257274bed829a978705de548cd1383225bf7aac76445104c053e2bb5fba`.

**S0 revisa e integra. Sem merge em sf2-stack/dev, deploy ou mutação de branches alheias.**

