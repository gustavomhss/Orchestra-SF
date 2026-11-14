# Auditoria estática da latência C12 — W18 A

## Identidade e limite desta entrega

- Produto observado: `8b1cc71d8ab2484055a0d055c8487d4579476b9b`; árvore `6bace347fcd4deec2018185aff7ec152d79eaec5`.
- CI: run `43591262845`, job `132436280987`; snapshot de CI `f84d2f41bb5755d350d524053c391fc8338e7bdd`.
- Log bruto: `evidence/W18/test-A-job-132436280987.raw.txt`; métricas H01–H08 e erro H05 entre as linhas 817 e 853.
- Fonte consultada: `publication/frozen-W18/repo`, não o staging concorrente de W19.
- Somente leitura de produto. Nenhuma execução local de produto, typecheck, teste, publicação, alteração de código, teste estrangeiro ou budget.
- `source-manifest.json` contém os hashes dos arquivos lidos e do log; `metrics.json` transcreve mecanicamente as métricas publicadas, com os números de linha.

## Conclusão

A multiplicação principal ocorre nas reaberturas de evidência dentro de `DecisionCasePort.read`, antes do comando de domínio. Review e primeiro apply percorrem três leituras completas do case: uma no `withCase` próprio e duas no produtor publicado de Review. No fixture H02/H03/H05/H06, cada leitura completa revalida a mesma fonte de Procurement dez vezes no nível BCS: duas na autorização geral e oito nas verificações separadas da alternativa e de sua escolha preservada. As chamadas internas de cada resolução acrescentam archive probe, reemissão da fonte, resolução atual, projeção do domínio e revalidações de autoridade.

Há uma redução estrutural possível em entradas de Procurement com `scenario` **e** `result` inteiros idênticos dentro de **uma única** invocação de `createSfScenarioOperationAccess`. Ela preservaria as duas leituras independentes de cada entrada única e todos os fences finais. Entretanto, **deduplicação simples não está recomendada nem autorizada para W19**: o fence atual exclui C08, e entradas iguais não provam que autoridade, captura ou ambiente permaneceram iguais entre os awaits. A contagem do grafo cairia de dez para seis resoluções BCS por leitura do case, acrescida do custo de um testemunho seguro ainda não implementado. Nenhuma economia de tempo ou aprovação de budget pode ser declarada a partir desta auditoria.

H05 contém também uma incompatibilidade funcional independente: o teste WP04 exige HTTP 409 após alterar apenas `objective`, enquanto o `apply.ts` publicado do WP11 reabre o case após o receipt e preserva edições não interferentes. W18 devolveu HTTP 200. Esse desacordo exige reconciliação entre os owners WP04/WP11, ou uma decisão explícita de S0 acompanhada de delta publicado; uma otimização própria não deve fabricar o 409.

## Evidência hospedada

| Caso | Tempo total | Budget preservado | Chamadas `transaction` | Chamadas `transactionAll` | Tempo acumulado do wrapper | Resultado observado |
|---|---:|---:|---:|---:|---:|---|
| H02 | 50.672 s | 45 s | 16,693 | 52 | 49.774 s | Timeout; review e apply retornaram 200 |
| H03 | 52.273 s | 35 s | 11,156 | 43 | 51.654 s | Timeout; review e apply retornaram 200 |
| H05 | 21.044 s | 15 s | 7,444 | 32 | 20.710 s | Timeout e assert 409/200 divergente |
| H06 | 39.203 s | 30 s | 13,226 | 44 | 38.491 s | Timeout; 503 injetado, retry posterior 200 |

O contador chamado `sqliteTransactions` não mede commits físicos: o `meteredStore` incrementa a cada chamada a `store.transaction`, antes de saber se houve commit. `transactionAll` tem contador separado. O contador HTTP é a diferença da **soma** dos dois contadores. O tempo acumulado mede a duração das chamadas do wrapper; não demonstra CPU, fsync ou número de transações SQLite físicas. Durações aninhadas podem se sobrepor.

| Rota e caso | HTTP | Duração | Chamadas HTTP contabilizadas |
|---|---:|---:|---:|
| Review H02 | 200 | 9.734 s | 3,298 |
| Review H03 | 200 | 16.756 s | 3,298 |
| Review H05 | 200 | 9.926 s | 3,298 |
| Review H06 | 200 | 9.769 s | 3,298 |
| Primeiro apply H02 | 200 | 10.385 s | 3,404 |
| Primeiro apply H03 | 200 | 17.420 s | 3,404 |
| Primeiro apply H05 | 200 | 10.349 s | 3,406 |
| Apply sem Review observado H02 | 403 | 3.086 s | 1,042 |
| Retry aplicado H02 | 200 | 6.988 s | 2,157 |

A igualdade de contagem da rota Review entre os quatro casos é evidência contra um loop adicional no H03. O maior tempo por chamada pode envolver tamanho de estado, custo da persistência ou condições do runner; o log não permite escolher uma dessas causas. Também não se deve tratar os ~1,042 da rejeição sem Review como uma medição isolada e exata de `cases.read`, pois inclui a admissão e o restante da rota.

## Cadeia de chamadas e fator de repetição

Os caminhos abaixo são relativos à raiz. `P` significa `modules/sucafina/Sucafinav1/product`; `O` significa `apps/cli/src/sucafina-product`.

| Etapa | Fonte W18 | Trabalho relevante |
|---|---|---|
| HTTP | `P/procurement/decision-http.ts` | Admite intenção humana e envolve Review/apply em `runtime.withCase` |
| Seleção própria | `O/business-services.ts`, `withCase` | Faz uma leitura canônica de `cases.read` antes da ação; mantém Request, binding, seleção privada e lease no retorno |
| Produtor Review | `P/procurement/decision-host.ts`, `reviewChange` e `readReview` | Reabre prepared change antes/depois; usa `createDecisionPreparedReview` real |
| Review preparado | `P/decisions/prepared-review.ts` | `cases.read` → change → reviewDomain → `cases.read` → change → reviewDomain; compara conteúdo e autoridade antes de devolver digest |
| Primeiro apply | `P/procurement/decision-host.ts`, `revalidateProducer`; `P/decisions/apply.ts` | Reexecuta esse mesmo Review antes de reservar attempt e chamar o domínio; não toma o digest fornecido como prova suficiente |
| Case completo | `P/decisions/case-port.ts`, `read` | Duas passagens por `accessible` e `verifyScenarioOperations`, separadas por nova leitura C08; mantém ACL, identidade, versão e autoridade |
| Operações escondidas | `O/scenario-operation-access.ts` | Percorre alternativas **e** escolhas, resolve evidência duas vezes por entrada e compara material, contexto, período, moeda e fences |

O fixture `test/product/wp04/host-integration.test.ts`, `prepareChange`, persiste uma alternativa com um único `replace` sobre `PR-1`. `createChoiceSnapshot` em `P/decisions/choice.ts` copia `alternative.scenario` e `alternative.result` integralmente para a escolha. As duas entradas portanto exigem hoje a mesma observação Procurement.

Para essa configuração, antes do primeiro efeito:

1. `accessible`: 2 passagens × 1 ref única = 2 resoluções BCS.
2. `verifyScenarioOperations`: 2 passagens × 2 entradas (alternativa e escolha) × 2 leituras × 1 ref única = 8 resoluções BCS.
3. Total de uma leitura completa: 10 resoluções BCS.
4. Wrapper + produtor: 3 leituras completas = 30 resoluções BCS por Review ou primeiro apply, além de duas leituras diretas `reviewDomain` e dos controles de state/receipt.

As listas de refs já são deduplicadas em `case-port.evidenceReferences`, em `BusinessContextService.context` dentro de uma passagem, e no conjunto Procurement local de `scenario-operation-access`. O problema identificado é a repetição de **travessias completas**, não simplesmente refs duplicadas dentro de uma lista.

## Por que cada resolução BCS custa tantas chamadas

`P/host-binding/business-context.ts` tenta `procurementEvidence.resolveEvidence` antes do leitor atual de Procurement. O `decision-host` já arquivou a evidência original durante prepare. Mesmo enquanto a fonte continua fresh, `resolveHistoricalSource` lê o arquivo privado e chama `individual.issueForActor`; ao verificar que a ref atual é igual à original, devolve `undefined`, e a composição então executa `createSfProcurementSourceAccess` para resolver a fonte atual.

`issueForActor`, em `P/procurement/sources.ts`, chama `issue`, reabre `resolveCurrent`, verifica a relação entre scopes e encarnação em transação de Procurement, depois chama `resolveCurrent` novamente. `issue` já havia chamado `resolveCurrent`. Esses passos protegem autorização atual, identidade física, material e escopo; suprimi-los por aparência de duplicação seria incorreto.

O leitor fresh em `P/decision-memory/source-access.ts` ainda faz `resolve` → `procurement.read` → `resolve`, com comparações de evidência/contexto e autoridade. `resolveCurrent` também abre contexto, scope e projeção e repete a observação atual. Depois do apply, o caminho histórico exige adicionalmente captura original, continuidade física e receipt quando aplicável. Por isso retry pode ser caro mesmo sem repetir o produtor Review.

Em cada nível, `host.revalidate` usa a autoridade UI real (`P/integration/ui-authority.ts`). Fora de uma observação C08 já ativa, `P/integration/product-authority.ts` resolve a autoridade por transação de Dashboard e autenticação das três superfícies. `P/host-binding/state-provider.ts` também autoriza as leituras antes/depois. Essas chamadas somadas explicam estruturalmente o multiplicador; o log não oferece perfil por função para atribuir cada uma das 3,298 chamadas individualmente.

## Proposta não aplicada e condições que impedem dedupe simples

O ponto mais estreito para uma proposta futura é o `for (const item of selected)` em `O/scenario-operation-access.ts`. Não foi produzido nem aplicado patch de produto. Um helper próprio eventual seria `O/scenario-procurement-proof-scope.ts`, consumido somente por esse ramo; `business-services.ts` permanece reservado ao agente C17. O escopo proposto limita a reutilização a entradas que:

- entram no ramo Procurement com base `procurement-request`;
- não têm operação externa `hot-topic-draft:` nem dependem do caminho Planner/histórico registrado;
- têm o par completo `{ scenario, result }` byte-idêntico segundo a canonicalização real, incluindo assumptions, cobertura, refs, versões, moeda e horizonte;
- pertencem ao mesmo case capturado, Request, binding e invocação do guard;
- têm duas observações reais concluídas com estado `fresh`, somente em contexto UI; histórico e native permanecem no caminho integral.

Cada grupo único ainda precisaria executar as **duas** resoluções reais, comparar material, revalidar autoridade e participar dos fences antes/depois; a segunda chamada completa ao guard feita pelo `case-port` continuaria independente. Nenhum cache persistente, TTL ou resultado de autorização entre requisições seria admissível.

**Risco comprovado na fonte:** `P/ai/run-store.ts`, `sfRunSourceFence`, remove explicitamente `snapshot.data.__sfProductV1` do digest, porque o seu consumidor original verifica produto separadamente por CAS. `O/business-services.ts`, `readSourceFences`, aplica precisamente esse helper às três superfícies. Logo um `Set` por `{scenario,result}` mais o fence existente pode reutilizar uma observação após corrupção de capture/receipt/preferences em C08 sem que o fence perceba. A igualdade de entradas não é prova da igualdade do mundo que elas referenciam.

Qualquer helper posterior deve observar o snapshot completo, incluindo C08, sob a transação real e com autoridade real atual; isso precisa ocorrer antes/depois da primeira prova e em cada hit. Request, binding e bytes do case devem continuar iguais. ACL/grants externos, seleção privada de período e sua validade, identidade dos readers e ambiente relevante (inclusive dia UTC) também precisam ser testemunhados: apenas adicionar `digestSfValue(snapshot)` não cobre automaticamente estado privado do host. Uma alteração de fonte, C08, ACL, período ou ambiente deve invalidar a reutilização. Materialização de metadados durante o primeiro reader deve impedir armazenar a prova; não justifica aceitar o snapshot posterior como se tivesse cercado a leitura. Ler fontes produtoras sob um lock C08 pode causar nested writes e não é solução.

Por essas dependências, esta auditoria não declara que um helper isolado possa ser ligado com segurança usando somente os parâmetros atuais do guard. O candidato exige desenho e contraprova próprios antes de decisão; W19 não amplia esse escopo.

O limite estrutural cai de 10 para 6 resoluções BCS por `cases.read`, e de 30 para 18 por Review/primeiro apply neste fixture. Isso é uma contagem do grafo, **não** uma previsão de 40% de economia total ou prova de que os budgets vão passar. O custo remanescente inclui consultas de autoridade, mudanças C08, archive/receipt e reconciliação.

Antes de aceitar uma implementação, a prova hospedada deve distinguir entradas iguais de entradas que diferem em operation/result/coverage/ref, manter segunda leitura e final fence sob revogação/mudança de fonte, recusar adulteração de captura/receipt sem bump de versão e mudança de período/dia/Request entre entradas iguais, e executar o arquivo H01–H08 inteiro sem filtro nem aumento dos limites. Não há patch nesta entrega, pois o escopo atual é somente leitura. A decisão recebida de root é não aplicar dedupe simples nem um novo cache C12 em W19.

Uma reutilização mais ampla de `DecisionCasePort.read` entre wrapper, Review e apply exige testemunho de C08, prepared change, receipt, fontes, Request, binding, período e autoridade atuais, com invalidação após qualquer efeito de domínio. Isso é maior que o candidato acima. O cache lexical CASE limitado a `caseRecall` em preparação pelo agente C17 não pode ser automaticamente creditado a essas chamadas: o produtor Procurement recebe `cases`, e a rota usa `withCase` fora daquele scope. Tampouco é seguro envolver toda a rota num lock de leitura: alguns leitores reemitem/materializam metadados de fonte.

## Pendência funcional H05 por owner

- Teste WP04: `test/product/wp04/host-integration.test.ts`, pin publicado PR34 `ba8a09e371ce8d93eb917eabb102caaee5affaf4`. O interleave após receipt altera `objective` e incrementa a versão do case; a linha 262 espera HTTP 409.
- Produtor WP11: `product/decisions/apply.ts`, pin publicado PR35 `92f6d97d2df5ebf53cd845f4cfe93355d10b0f6f`. O trecho de reconciliação reabre o case após o resultado do domínio, verifica a proposta/receipt atuais e faz CAS contra esse snapshot novo, preservando campos alheios à aplicação. HTTP 200 é coerente com esse código.
- O log H05 fornece uma divergência real, não apenas um timeout: `Expected: 409`, `Received: 200`. Reduzir latência não muda esse contrato.
- Responsabilidade: WP04/WP11 devem publicar o alinhamento de comportamento e contraprovas. WP10 deve preservar os dois inputs arquivados, registrar o desacordo e evitar introduzir rejeição artificial ou editar o teste para obter verde.

Os testes publicados de reconciliação WP11 e a prova própria Dashboard C12 passando não tornam o host Procurement aprovado. A pendência de host permanece medida e localizada, com os budgets e asserções preservados.

## Mapa de responsabilidade e próxima evidência

| Tema | Código ou prova | Responsabilidade |
|---|---|---|
| Multiplicação alternativa/escolha e montagem | `O/scenario-operation-access.ts`; `O/business-services.ts` | WP10; eventual otimização exige prova própria e não altera contrato estrangeiro |
| Leitura dupla do case e Review preparado | `P/decisions/case-port.ts`; `P/decisions/prepared-review.ts`; `P/decisions/apply.ts` | Produtores publicados de Decisions/WP11; consumir delta owner se o contrato precisar mudar |
| Archive probe, fonte Procurement, Review host | `P/procurement/decision-host.ts`; `P/procurement/sources.ts` | WP04; otimização dessas implementações depende de publicação owner |
| Roteamento/autoridade/persistência | `P/host-binding/business-context.ts`; `P/host-binding/state-provider.ts`; `P/integration/product-authority.ts` | Composição/contratos publicados WP00, integrados por WP10 sem remover revalidações |
| Divergência H05 | Teste WP04 exige 409; produtor WP11 preserva edição alheia e devolve 200 | WP04 + WP11, com arbitragem S0 se necessária; WP10 registra ambos os pins |
| Budgets H02/H03/H05/H06 | 45/35/15/30 s no arquivo publicado `wp04/host-integration.test.ts` | Prova do owner WP04 preservada; WP10 não aumenta os limites |

A próxima execução autorizada por root deve manter H02–H06 nas seleções completas, sem trocar expectativas. O novo resultado deve ser atribuído ao SHA W19 real e não presumido a partir desta análise ou dos fixes separados de Memory/Review/BI.
