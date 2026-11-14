# R1 — Preflight independente de fontes W23

**HOLD. Há um blocker próprio de tipos confirmado no candidato. Este preflight tem `finalForCandidate: false` e não concede aceite funcional, nativo ou global.**

## Identidade e independência

- Candidato: `f7466375e268b70113312096b2a06ff2d75e4a53`.
- Árvore: `1fc3a38e95bbbbe2b60987bf6faf62c3e40a4359`.
- Parent W22: `4bc9c7220f04f113609393aaba38934a7e69878b`.
- PR29 contra `sf2-stack`; fonte imutável em `publication/frozen-W23/repo`.
- Corte: **14/11/2026, 16:11:53 UTC**.
- Revisor **R1**, `/root/independent_r1_w16`, `authoredProductChanges: false`. Não editei produto/testes, não executei produto local e não fiz mutação remota. Li os deltas e contexto, comparei árvores/hashes e consultei GitHub MCP somente leitura. A revisão dos autores não foi usada como aceite independente.

## Finding próprio obrigatório

### R1-W23-TEST-CALLBACK-01 — alto — aberto no W23

**Arquivo:** `modules/sucafina/Sucafinav1/test/product/wp10/integration/procurement-case-read-scope.test.ts`, linha **268**, coluna **83**. Blob: `67274bd100bbab1ddf4ba02bac9a4b17bcb5472e`, verificado remotamente e byte a byte contra o snapshot.

O wrapper usa `async (...args)` e chama `work(...args)`. A inferência desse callback fornece uma tupla de um argumento, enquanto `work` exige `snapshot` e `BlobTransaction`. O check exato confirma **TS2554: Expected 2 arguments, but got 1**, repetido nos typechecks Sucafina e consumidores de testes WP10.

Isso bloqueia o gate de tipos; não é uma observação de perda de dados ou falha funcional executada. A correção proposta deve encaminhar explicitamente `snapshot` e `blobs`, conservando o callback real. É necessário publicar/congelar o sucessor e reexaminar seu delta/check. **Não fecho o finding por uma correção anunciada ou por um W24 ainda não revisado.** Requisitos associados: `WP10.T04.CMP.10`, `WP10.T04.CHK.01` e `WP10.T04.CHK.41`.

## Revisão das mudanças de produto

### Procurement: dois helpers distintos, sem cache de autorização

O novo leitor de caso restringe o agrupamento a UI, seleção e reader atuais, casos com mudanças Procurement `planned` e sem receipts. Lê C08, membership e autoridade reais. A elegibilidade confirma closure record-only, identidade atual, campos/período/roles/canWrite/roleMap e o scope materializado. Conferi também que `projectProcurementScope` compara a moeda do selector com `formSettings` atuais: uma entrada antiga com moeda incompatível não basta para admitir uma leitura sem escrita.

O leitor canônico executa uma vez dentro da transação real; suas duas passagens BCS e a projeção pública das mudanças preparadas permanecem. Fences antes/depois abrangem C08 inteiro, fontes, principal, ambiente, Request/headers/binding e seleção. Um `unsupported` anterior ao produtor pode delegar fora desse root. Depois de iniciar trabalho canônico, recusa, mudança ou escrita aninhada não é repetida fora do lock.

O helper de evidência é separado. Ele executa o producer inteiro por chamada, sem memoizar resultado ou autoridade. A elegibilidade consulta `contextFor` atual e a entrada exata que `issueForActor` reemitiria sem mudança; o ref histórico continua original. `undefined` do producer permanece o fallthrough fresh. **C08 ausente ou falta de grant preferences não cria um grant e não impõe um novo pré-requisito ao caminho fresh canônico.** Native, outras evidências, approvalStageEntry temporal e scopes não materializados conservam seu caminho normal. O teste específico cobre cold, without-preferences, ready e tentativa real de nested writer sem retry/durable side effect; ainda falta executá-lo no candidato aplicável.

Não confirmei novo blocker de lógica nesses dois helpers. A fixture de caso que deve demonstrá-los, porém, tem o TS2554 aberto acima.

### Memory: writes de contraprova fora dos roots agrupados

O escopo one-use de W22 permanece inalterado. O delta mede transações raiz/aninhadas e exige que a testemunha do producer de evidência seja tomada dentro do seu root real. As probes Memory que alteram source/capture exigem que esses roots já tenham fechado. Permanecem os dois recalls Atlas canônicos em prepare e verify, as leituras de evidência originais e o deadline cooperativo de **225.000 ms**. Presença dessas assertions não demonstra conclusão funcional: nenhum test-ci W23 foi despachado ou observado até o corte.

### C17: seletor autenticado, leitores reais e egress

A nova seleção direta serve apenas para escolher o resultado armazenado e entrar no caso real. Ela lê **cases e preferences com autorizações separadas**, confrontando ator/accessRevision/policy, id/incarnation/version e membership, além da ligação result/request. Não entrega um resultado financeiro a partir desse selector.

Os dois loaders canônicos de request/result e os dois replays continuam no producer. O observer recebe seus outputs efetivos, clona-os, exige duas observações iguais de cada loader e recusa prova incompleta. A contagem esperada de **seis leitores de resultado** inclui quatro internos dos dois request readers e dois diretos. A nova projeção evita somente releituras redundantes quando já dispõe desses outputs observados; não compartilha Promise ou autorização entre invocações.

A modalidade observada é UI com closure Planner record/ledger suportada. Native e closure mista mantêm as releituras anteriores. Request, método, URL, todos os headers e binding são pinados antes da seleção. O fence final inclui C08 completo, fontes, principal e ambiente e ocorre **depois do último await de `selectedCase`**, sob o retainer correto. ALS/cycle/ancestry/close permanecem. O histórico conserva ledger/capture e dois replays, retorna `historical` e não promove o seletor original a fresh.

As novas probes alteram request/result/capture ou headers/lease depois de seis leitores concluídos e exigem ausência de projection/currentRef, cleanup e recuperação. As falhas de assertions em hooks são propagadas para fora dos callbacks que os producers podem capturar; não contam como uma negativa bem-sucedida. A evidência atual desses comportamentos ainda é fonte, não terminal funcional.

### Fixtures Scenario e C07

Scenario passa a admitir e consumir um intent UI próprio para cada período, sem trocar a Request/lease da prova principal. C07 usa uma raiz de skills reservada distinta do catálogo ordinário, registra por API real e confere location/content. Essas correções não fabricam admission, Task governada, resultado de modelo ou conhecimento autenticado. Budgets e expectativas de produção permanecem.

## Limites estrangeiros mantidos abertos

**C12 H05:** a leitura estática confirma uma divergência entre o producer `decisions/apply.ts` e o teste WP04. O producer aceita uma versão posterior do caso quando a mudança preparada se mantém e reconcilia sobre `...fresh`; H05 exige HTTP 409 e `case-changed-after-application` após aquela edição. O 200/timeout W21B e as assertions posteriores não alcançadas continuam históricos. WP04/WP11/S0 precisam publicar uma dupla coerente producer/test; um wrapper próprio que fabricasse 409 ocultaria o desacordo. Não alterei nenhum desses arquivos.

**Fronteira histórica C17:** `business-context.ts`, `calculationProof` (348–365), inicia duas observações históricas separadas. Retém Request/binding e revalidação, mas não fixa todos os headers através de ambas. Cada frame próprio novo os fixa dentro de sua observação. Confirmo esse limite estático, **sem alegação de breach, vazamento ou bypass executado**. O owner/S0 deve avaliar uma contraprova específica; a mudança local não promete cobrir essa janela externa.

## Integridade e ownership

| Verificação | Resultado independente |
|---|---|
| Árvore completa | 16.491 blobs |
| Snapshot hidratado | 1.518 arquivos; hashes Git corretos |
| Deltas | 120 = 15 próprios de fonte/testes + 105 recibos |
| Alterações estrangeiras / deletes | 0 / 0 |
| Pins efetivos | 437, todos coincidentes com a árvore |
| Três pins sobrepostos | Caminhos próprios permitidos; pins originais retidos em superseded |
| Exclusions / ownership | Nenhuma violação identificada no delta |
| Arquivo histórico | 128 foreign copies e 131 readonly inputs preservados |
| Recibos anteriores | 333 blobs sem mudança ou exclusão |
| Reports anteriores | 20 arquivos selados preservados |
| Critérios | 171 literais completos e sete tasks; zero divergências |
| Freeze10 | 37/38; host-context ainda diverge |

O mapa `draft-W23-v1` contém os 171 IDs/textos/famílias/task/título corretos, mas continua com SHA/tree nulos e **zero critérios/tasks aceitos**. Precisa ser ligado ao candidato final e às provas reais. A divergência freeze10 continua entre esperado `6a608e24847fe730b645d5f51f86e47d83e803875162820038e0c05d18f96772` e host atual `42839b627194c59febff34052b813a6e4725414dcf84c8308397539b734b3893`.

## Check hospedado deste candidato

- Snapshot S: `690ddfe29105688519437dc523c69ed6bc46b726`, árvore `ffd505a70391b2d81a9b37f59710c4b3ea887c16`.
- Run **43613489123**, job **132503406799**, **FAILURE**.
- **1 diagnóstico próprio único + 13 estrangeiros; 15 ocorrências.** CLI/Atlas/guards passaram; Sucafina e consumidores de testes WP10 falharam.
- Artefato **14121127627**, ZIP de 4.340 bytes; SHA256 `f6df043d719f7dd4b95c101dbac733c8dd8606772c537a0e3c33e95f66a8bd72`; **11 membros** rechecados.
- Log remoto de 86.254 bytes idêntico ao raw arquivado; SHA256 `640c7c4815ef9407d3a18270faffa7823c0cac76ca677ce77840e9dc250de579`.
- Compare remoto W→S altera somente `.astra-wp10-check.json`.

Nenhum terminal funcional W23 foi observado. W22A 37/2, W21B 49/30 com erro adicional e D22 ainda em andamento são históricos e não foram transferidos. Gates nativo, Task, knowledge, MCP completo e global seguem bloqueados.

## Próximas provas necessárias

1. Corrigir/publicar o TS2554 próprio, revisar o novo delta e obter check hospedado exato.
2. Obter terminais completos de Procurement, Memory, C17, C12 e C07 que alcancem seus positivos e contraprovas sem enfraquecer budgets ou produtores.
3. Resolver os diagnósticos estrangeiros, H05 e binding freeze por outputs publicados dos donos.
4. Ligar os 171 critérios ao SHA final, resultados e **três pareceres independentes finais**. Este documento não substitui R1 final.

O JSON inclui finding com arquivo/linha/blob/requisitos, inventário de 15 deltas e 14 fontes de contexto, seis comparações remotas byte a byte, audit completo e selos. Suportes: `audit-W23-preflight.json`, `remote-blobs-W23-preflight.json` e `remote-observations-W23-preflight.json` em `reviews/R1/`. Não criei `review-W23.json` final. Resultados ou candidatos posteriores exigem novo adendo/parecer, preservando este corte.
