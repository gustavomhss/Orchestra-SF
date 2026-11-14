# Adendo independente — autoridade e continuidade C17, W10

## Resultado delimitado

O defeito F2 do **produtor próprio** foi corrigido: a ancestralidade agora pertence à cadeia assíncrona e não a todas as chamadas que compartilham o binding. A leitura estática confirma o isolamento; o recibo de Actions W4 registra 13 testes aprovados, exclusivamente em `calculation-evidence.test.ts`. Os bytes desse produtor e desse arquivo de teste são idênticos no snapshot W10.

A parte própria de F1 agora oferece APIs históricas explícitas com associação ao ledger persistido e autorização atual, sem transformar consultas públicas normais em consultas históricas. Não identifiquei uma nova ampliação de acesso nos deltas inspecionados. **F1 permanece aberto na composição completa:** o COMPOSE4 ainda encaminha as leituras ao caminho corrente, os hooks recebem o `caseRef` produtor antigo e o BCS recusa o estado histórico de cálculo. O wrapper de emissão COMPOSE4 também conserva o F2 de concorrência. Esses pontos externos estão reconhecidos na proposta e no patch não aplicado.

Este adendo não encerra F1/F2 globalmente e não emite aceite de produto, C, D ou prontidão global.

## Pins, independência e método

- Candidato: W10 `660db9a46e4c1d7ff87c23f6bb37f451cc703ccb`, árvore `bbc79890ba339e0fca0fb34f55bd4d1c69a7953e`.
- Snapshot imutável: `/workspace/scratch/a97ca4c53050/review-660db9a`; manifesto `/workspace/scratch/a97ca4c53050/review-660db9a-manifest.json`.
- Revisão anterior: W3 `66bbe152c145f04c16223a938589c63cedb3b716`, árvore `f727ae5bfcef26383ff47a2b06bb65b161295dd2`.
- Fonte aprovada: `dbf9547211d9b0fade619790de7c19c0869b7c7d`; campaign SHA-256 `703dd257274bed829a978705de548cd1383225bf7aac76445104c053e2bb5fba`.
- Composição externa somente leitura: `4306b310e4d6dac77f9beab461adad4e8e924849`, arquivos em `/workspace/scratch/a97ca4c53050/foreign-intake/COMPOSE4`.
- Foram lidos AGENTS, os deltas próprios, testes pertinentes, fontes atuais COMPOSE4 e as propostas WP11 `host-c17-proposal.md` e `compose4-calculation-ancestry.patch`.
- Nenhum produto/teste/typecheck foi executado localmente; nenhum CI foi criado ou disparado; nenhum arquivo de produto, host ou teste foi editado. As únicas escritas desta etapa são estes relatórios.
- A informação de que W11 alterará apenas uma fixture TS WP05 veio do coordenador. W11 não é um candidato inspecionado por este adendo e não recebe um parecer por antecipação.

## F2 próprio: correção confirmada no escopo examinado

`product/planner/calculation-evidence.ts:23–35,93–102` substitui os mapas globais de runs/checks por `AsyncLocalStorage`. Cada entrada cria um novo `Set`; nenhuma ramificação acrescenta IDs a um conjunto herdado. Assim, dois `issue(R, context)` independentes partem de conjuntos independentes, e 17 irmãos de profundidade um não gastam um limite global de 16.

Uma chamada realmente descendente herda os IDs de seu caminho. `issue` continua recusando repetição do run e profundidade acima do limite; `verifyCalculationSources` preserva o conjunto separado de verificações para distinguir a verificação do run já em emissão da reentrada cíclica nessa verificação. Os callbacks de replay, validações de closure, digests, cancelamento e reautorização permanecem ativos. Não há cache de respostas autorizadas, coalescência de permissões ou remoção dos negativos.

Os testes `test/product/wp03/calculation-evidence.test.ts:60–121` usam barreiras de promises que exigem a entrada simultânea de todos os trabalhos antes de liberá-los. Isso discrimina o defeito anterior, em vez de apenas executar várias chamadas em sequência. Há contraprovas para dois trabalhos do mesmo run, 17 runs distintos, limite de profundidade e recuperação após recusa; o restante do arquivo mantém casos de ciclo, replay divergente, origem, cancelamento e revogação.

### Evidência executada disponível

O recibo local `docs/sf2h/receipts/WP11/finance-20261114/product-tests.json`, seleção 2, registra:

| Campo | Valor |
| --- | --- |
| Actions | `43581387704`, job `132406661623` |
| Produto W4 | `ffe77b53f3c074f03fe6dc3ff7caa788778eca99` |
| Árvore W4 | `0cecbd7b7b034df4156d248f86be080f32ab764f` |
| Snapshot CI | `e63ae9f2a3b05c6adabb93f43057f58ab5185602` |
| Seleção | apenas `Sucafinav1/test/product/wp03/calculation-evidence.test.ts` |
| Resultado registrado | 13 pass, 0 fail, 92 expects |
| SHA-256 do log registrado | `ef70fc2c5bf1b8591c95851f0c9290d763850a7f840cf8e872f0da7f8f95475d` |
| Controle omni registrado | not applicable; nenhum spawn, nenhuma prova omni |

Link do recibo: https://github.com/gustavomhss/Orchestra-SF/actions/runs/43581387704

Esta revisão leu o recibo e conferiu a igualdade dos dois arquivos com o conteúdo capturado em `finance-W4-changes.json`; não reexecutou nem buscou novamente o job remoto. A igualdade desses arquivos não transforma o run W4 em CI de todo W10, de suas novas dependências, do wrapper CLI ou da jornada nativa.

## F1 próprio: limites das novas APIs

`product/decisions/calculation-history.ts:7–38` recebe a seleção corrente do caso, o ID do evento e a referência integral. O caller não fornece o evento. O helper procura exatamente um evento no ledger do caso lido do C08 e exige:

- Mesmo caso e encarnação; seleção corrente exata; versão produtora válida e não futura; versão do evento entre a produtora e a corrente.
- Tipo de evento admitido e referência integral presente na closure de suas evidências persistidas.
- Identidade C17 canônica: `refId`, cálculo, engine, run, digests de pedido e resultado, fontes, período e moeda vinculados ao resultado armazenado.
- Horizonte do resultado contido no horizonte corrente e moeda igual à do caso; origem installation/project correta em toda a closure.
- Integridade canônica do grafo antes de percorrê-lo.

`result-store.ts:51–79` clona a seleção antes dos awaits, verifica a associação histórica, mantém autorização de caso/participante/contexto e os verificadores de fontes, relê o estado e repete a associação. No caminho histórico, também exige igualdade integral do caso entre as observações. O retorno permanece uma cópia do resultado original. `read` e `readForCalculation` continuam passando `historical=false`; somente `readHistoricalCalculation` ativa a seleção de ledger.

`scenario-request-store.ts:29–66` mantém `requests.read` corrente e acrescenta `readHistorical`. A leitura histórica exige o resultado autorizado pela mesma seleção, o vínculo integral entre pedido e resultado, a engine da referência, a seleção corrente do caso, duas observações da preferência e do resultado, igualdade do caso e reautorização. Os callbacks de autorização/verificação recebem cópias e são conferidos contra mutação. Não há reescrita do `caseRef` produtor nem uso da versão histórica para ampliar o binding nativo.

O helper de associação é corretamente descrito como **associação**, não autenticação autônoma. A emissão de C17 continua dependendo do emissor/replayer canônico. A autorização atual é responsabilidade dos stores e da composição; conhecer um `eventId` ou possuir uma referência com digest válido não substitui esses controles.

### Alcance do teste W10

`test/product/wp11/calculation-history.test.ts` acrescenta uma contraprova com provider C08, armazenamento reaberto, autoridade UI de fixture, fonte Planner, Planner, stores, emissor C17, mutação `createAnalysisAcceptance` e case-port de produção. Ela conserva o cálculo após `v1 → v2`, recusa a consulta corrente e lê o histórico selecionado; verifica origem, caso/encarnação/versão, ausência de evento, mudança do ledger entre observações, horizonte, revogação e mudança da fonte.

Os limites estão declarados e foram considerados: o teste fornece uma cobertura de forecast controlada (`:33–35`), semeia contribuição/run e usa callbacks sintéticos de autorização de aceite (`:105–119`). Seu resolver histórico e `BusinessContextService` são locais à fixture (`:68–89`), sem o BCS COMPOSE4; o estado `historical` entregue diretamente ao case-port não demonstra os gates de projeção, continuidade ou Atlas desse BCS. Não há sessão nativa nesse teste.

Não havia execução de `calculation-history.test.ts` no recibo de produto lido neste adendo. Sua existência e sua lógica são evidência estática; o resultado executado deve ser anexado separadamente pelo coordenador quando disponível.

## Achados residuais na composição externa

### A1 / F1 — P1: continuidade histórica ainda não composta

**Fonte:** COMPOSE4 `apps/cli/src/sucafina-product/planner-calculation-services.ts:35–39,67–77,79–90,116–159`; `business-services.ts:236–277,280–286`; `product/host-binding/business-context.ts:74–78,145–150`.

O adapter atual usa `requests.read` e `results.readForCalculation`, não as novas APIs históricas. Seus dois hooks de verificação usam `withCalculationCase(call, stored.caseRef, ...)`; após o aceite, esse `caseRef` continua na versão produtora antiga, enquanto `selectedCase` exige a versão corrente exata. Portanto o cenário original F1 continua falhando no host pinado mesmo que as novas APIs próprias estejam disponíveis.

Há um terceiro gate independente: se um resolver passar a retornar `historical`, o BCS exige projeção autorizada, referência corrente, diferenças, `sameHistoricalSource` e prova de continuidade. `sameHistoricalSource` não admite cálculo. Ligar somente os dois stores não faz a jornada funcionar.

**Correção delimitada:** a proposta descreve corretamente uma passagem privada de ledger, vinculada ao contexto e à cadeia assíncrona, que seleciona o caso corrente sem recursão em `cases.read`, transporta a associação persistida de cada descendente e mantém as consultas públicas correntes. Ela também reconhece a necessidade de integrar explicitamente o gate do BCS e as provas Atlas. Não substituir igualdade por `>=`, não reinterpretar um cálculo antigo como resultado corrente e não fabricar uma diferença financeira para satisfazer o contrato. Essa proposta ainda não é implementação nem prova de integração.

**Validação pendente:** composição real com aceite `v → v+1`, reload, leitura de caso/evento pelo BCS, referência histórica idêntica e consulta corrente negada; negativos de revogação, origem, caso/encarnação, ausência no ledger, horizonte, alteração do ledger e fonte. Prova nativa separada das fixtures.

### A2 / F2 — P2: o wrapper do host conserva o contador compartilhado

**Fonte:** COMPOSE4 `apps/cli/src/sucafina-product/planner-calculation-services.ts:34,79–92`.

O `Map<binding, Set<runId>>` do wrapper antecede a emissão do produtor. Manter a primeira leitura de pedido pendente faz uma segunda leitura independente do mesmo run retornar `calculation-replay-cycle`; 16 folhas pendentes provocam a mesma recusa na 17ª. O isolamento do produtor próprio não remove esse guard anterior. O impacto demonstrável por rastreamento é indisponibilidade, sem bypass de autorização ou deadlock estabelecido.

**Proposta examinada:** `compose4-calculation-ancestry.patch` troca somente esse estado por `AsyncLocalStorage` com conjuntos novos por cadeia, conservando limite 16, repetição do run, reads de store, `withCalculationCase`, tratamento de erro e revalidações. A alteração é coerente com a correção própria e não cria cache de autoridade. O patch está não aplicado; não possui prova executada nesta revisão.

**Validação pendente:** repetir as barreiras de 2/17 trabalhos no adapter CLI real e manter negativos de ciclo/profundidade e recuperação. O CI do produtor não cobre esse wrapper.

## Identidade dos bytes revisados

Os seis arquivos próprios abaixo foram conferidos contra o manifesto W10. Os caminhos próprios são relativos a `modules/sucafina/Sucafinav1/`.

| Arquivo próprio | Git blob |
| --- | --- |
| `product/planner/calculation-evidence.ts` | `aaacc8bf7df9fa67870c4067154fe67a58c34a22` |
| `product/decisions/calculation-history.ts` | `4e92219aae9046891f167502139412bf9c509529` |
| `product/decisions/result-store.ts` | `d7d8eb3ca267551797b191ccfb1d037149757898` |
| `product/decisions/scenario-request-store.ts` | `0d677d2d0b3a9df7127f13b25fe3968757f0dceb` |
| `test/product/wp03/calculation-evidence.test.ts` | `a0a67918c69a636120daa66877669020803c108e` |
| `test/product/wp11/calculation-history.test.ts` | `714f6a55cb3ed7f32a457259341ea68704bfad7e` |

| Fonte externa COMPOSE4 | Git blob |
| --- | --- |
| `apps/cli/src/sucafina-product/planner-calculation-services.ts` | `48a9cdd2d38fad855d8a338f8dc119c64f81057f` |
| `apps/cli/src/sucafina-product/business-services.ts` | `611831c32ddbf58296b33e1930806185564189b9` |
| `modules/sucafina/Sucafinav1/product/host-binding/business-context.ts` | `0ac4c11d4eddb6e4a67c2c41efe40a7ff34fa47e` |

SHA-256 da proposta lida: `fc89b97cac32f8c7f6da3a7eede427927d0ed09d2324f78cf5ec70b3a7b10511`. SHA-256 do patch não aplicado: `8b2522ba2935c6c8485ceed50184daf12341cf6d70e2a39b8150c0406f36088e`.

COMPOSE4 já possui `nested: { replayScenario, evidence }` e os hooks canônicos de W2. A conclusão antiga de host somente record-only não se aplica a esse pin. Cobertura financeira `complete`, ChoiceRecord, aplicação/receipt e prova GNATIVE continuam sendo afirmações distintas; este adendo não promove uma à outra.
