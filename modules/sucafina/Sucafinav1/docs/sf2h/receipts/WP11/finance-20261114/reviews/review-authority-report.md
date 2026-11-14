# Revisão independente — autoridade, integridade e persistência

## Identidade e limites

- Candidato inspecionado: `66bbe152c145f04c16223a938589c63cedb3b716`, árvore `f727ae5bfcef26383ff47a2b06bb65b161295dd2` (W3), snapshot `review-66bbe15`.
- Plano aprovado informado pelo coordenador: `dbf9547211d9b0fade619790de7c19c0869b7c7d`, campaign SHA-256 `703dd257274bed829a978705de548cd1383225bf7aac76445104c053e2bb5fba`.
- Leitura de AGENTS, handoffs/packs WP03/WP05/WP11 e anexos pertinentes; nenhuma edição do produto, nenhum teste/typecheck local e nenhum dispatch CI.
- Composição externa lida separadamente: `foreign-intake/WP10` e `foreign-intake/COMPOSE3`; os arquivos atuais de `business-services`, `planner-calculation-services`, `ai/run-store`, `sf-mcp-bridge` e `host-binding/business-context` foram tratados como fontes fornecidas pelo coordenador, não como deltas já incluídos no W3. Os blobs efetivamente presentes estão registrados abaixo e no JSON; os prefixos de commit comunicados foram `417038d` e `5866`, sem expansão inventada para SHA completo.
- O erro de tipos conhecido em `cost-coverage.ts` não é repetido nesta revisão; a correção `Set<string>` anunciada não altera os cenários abaixo.
- Achados baseados em rastreamento estático de execução. As seleções de Actions abaixo são contraprovas recomendadas, não execuções realizadas.

## F1 — P1: avançar a versão do caso invalida o cálculo que o próprio ledger acabou de aceitar

### Localização principal

- `modules/sucafina/Sucafinav1/product/decisions/result-store.ts:73,128–129`
- `modules/sucafina/Sucafinav1/product/decisions/scenario-request-store.ts:36–44`

### Cadeia causal

`readForCalculation` chama `readResult(..., historical=false, calculation=true)`. Assim, `allowedCase` exige igualdade entre a versão atual do caso e `StoredDecisionResult.caseRef.version`. O request-store repete a exigência de igualdade em sua linha 39. Não existe a mesma tolerância histórica já fornecida por `readHistoricalScenario` para consumidores de cenários.

Sequência determinística permitida pelos tipos e pelas funções de produto:

1. Em um caso de versão `v`, o Planner persiste um cenário `R` e seu pedido canônico; a emissão C17 de `R` funciona e todas as fontes continuam autorizadas e inalteradas.
2. Uma contribuição pronta e autorizada cita a referência C17 de `R` em `output.evidenceRefs`.
3. `createAnalysisAcceptance` grava um evento `analysis-accepted` conservando `output.evidenceRefs` e avança o caso para `v+1` (`analysis-acceptance.ts:63–71`). A promoção de AlternativeDraft faz a mesma preservação/avanço (`analysis-promotion.ts:70–82`).
4. Na próxima `cases.read`, `evidenceReferences` inclui as evidências do ledger (`case-port.ts:142–144`), e a autorização de leitura exige que elas sejam `fresh` ou `historical` (`case-port.ts:79–85,132–136`).
5. O resolver real chama `requests.read` e `results.readForCalculation` (`apps/cli/src/sucafina-product/planner-calculation-services.ts:68–70,103–110` na composição pinada). Os stores recusam `R`, pois seu `caseRef.version` ainda é `v` e o caso agora é `v+1`. O resolver retorna `unavailable`.
6. O caso passa a retornar `case-evidence-unavailable`, apesar de a mutação anterior poder ter retornado sucesso e de nenhuma fonte de negócio ter mudado.

O BCS atual não fornece um escape histórico para esse caso: o router encaminha cálculos ao mesmo resolver; `sameHistoricalSource` não tem ramo de cálculo (`foreign-intake/COMPOSE3/.../host-binding/business-context.ts:145–150,173–182`). O próprio `withCalculationCase` exige a versão exata capturada, portanto a correção precisa considerar esse seam, sem relaxar indiscriminadamente o contexto atual.

### Impacto e alcance

É um bloqueio de continuidade e disponibilidade, não uma ampliação de acesso. Pode impedir reabertura, resolução do evento e consumo Atlas de uma análise aceita que cite um cálculo. A referência original é conservada corretamente; o problema é confundir a revisão histórica do caso produtor com a autorização atual para reabrir o cálculo. A consequência independe de ativar replay de cálculos aninhados: `R` pode ser estritamente record-only.

As fixtures de `calculation-evidence.test.ts:118–149` mantêm resultado, evento e caso na mesma versão e usam loaders/resolvers controlados; não exercitam a transição durável `v → v+1`.

A contribuição que cita C17 é a precondição do cenário estático: esta revisão não observou uma execução nativa que a tenha produzido e aceitado. O encadeamento de funções demonstra a falha quando essa contribuição autorizada existe; não converte fixture ou callback sintético em prova GNATIVE.

### Correção delimitada

Manter as consultas públicas normais de cálculo restritas à versão atual. Adicionar uma via histórica explícita e restrita ao consumidor autorizado do ledger, preservando o `caseRef` original. Essa via precisa comprovar origem/pedido/resultado canônicos, autorização atual, mesmo caso e encarnação, horizonte histórico permitido e associação integral da referência a um evento do ledger persistido. A associação deve vir do snapshot autorizado, não de um objeto fornecido pelo caller. Revalidar fontes e continuidade sem reinterpretar conteúdo antigo como evidência atual. Recusar revogação, troca de encarnação, caso diferente, referência fora do ledger e horizonte futuro. Coordenar o ajuste do `withCalculationCase` com WP10/S0; não substituir simplesmente todos os `===` por `>=`, não reescrever referências antigas e não contornar o contrato de evidência. A autoria e sua revisão devem ocorrer em etapa separada.

### Contraprova recomendada em Actions

Usar stores C08 reais e o resolver C17 real: produzir `R`, capturar uma contribuição autorizada que o cite, aceitar a análise, avançar para `v+1`, reabrir o mesmo caso e resolver o evento após reload. Verificar separadamente fontes intactas, fonte alterada, revogação, troca de encarnação, tentativa de outro caso, referência ausente do ledger e horizonte futuro. A consulta pública normal deve continuar recusando a referência histórica. A execução deve demonstrar continuidade autorizada sem reduzir os negativos.

## F2 — P2: o guard global de replay confunde concorrência independente com ancestralidade

### Localização principal

- `modules/sucafina/Sucafinav1/product/planner/calculation-evidence.ts:22–35,98–107`
- Consumidor paralelo: `modules/sucafina/Sucafinav1/product/planner/scenario-port.ts:49–52,103–104`

### Raciocínio de execução

`active` é indexado por `digestSfValue(context.binding)`, não por uma cadeia de chamadas. `issue` devolve `calculation-replay-cycle` quando outro replay no mesmo binding já contém o `runId`, ou quando há 16 replays ativos. Isso funciona como um mutex/capacidade global do binding, mas não distingue um ancestral real de trabalho paralelo independente.

Há dois cenários discriminantes:

- Iniciar `issue(R, context)` e mantê-lo aguardando seu loader. Uma segunda leitura independente do mesmo `R`/contexto recebe `calculation-replay-cycle`, embora nenhuma chamada seja descendente da outra. Ao terminar a primeira, a segunda volta a funcionar.
- Resolver simultaneamente 17 cálculos record-only independentes, todos do mesmo caso/versão atual, com grafos de profundidade um. Com um interleaving que mantém os primeiros 16 em replay, o 17º falha pelo limite de ancestralidade. A profundidade real nunca excede um.

O host BCS pinado corrigiu o percurso interno para ancestry explícita e `mapSfEvidenceInOrder`; portanto **não** se atribui o problema ao antigo `Promise.all` daquele host. Entretanto o produtor Planner ainda chama `BusinessContextService.resolve` em paralelo para as evidências distintas de um cenário (`scenario-port.ts:50`). A deduplicação por `refDigest` evita duplicatas idênticas de nível superior, mas não limita o conjunto a 16 nem impede ancestrais compartilhados entre referências distintas. Um cenário com 17 cálculos válidos em suas premissas pode alcançar o limite global; um DAG com cálculo e evento que o cite apresenta a variante de ancestral compartilhado, quando houver continuidade válida de caso.

### Impacto e alcance

Falha de disponibilidade dependente de interleaving. Não há evidência de autenticação indevida, bypass de ACL ou deadlock; o guard recusa trabalho válido. A configuração nested do host ainda é um seam pendente, mas o limite por concorrência também afeta cálculos record-only independentes.

### Correção delimitada

Separar a pilha ancestral de cada replay do registro de trabalhos em voo. Usar ancestry passada por uma via privada entre recursões, com profundidade máxima por caminho; para pedidos concorrentes idênticos, coalescer somente dentro da mesma passagem de autorização ou serializar o consumidor explícito. Não remover o guard nem compartilhar autorização cacheada entre chamadas. Como correção menor no produtor, serializar o lote de evidências pode evitar a falha desse consumidor, mas não corrige a API `issue` para outros callers concorrentes.

### Contraprova recomendada em Actions

Com barreiras explícitas de promises, testar duas leituras independentes do mesmo cálculo e 17 cálculos de profundidade um. Ambas devem completar sem falso ciclo. Manter negativos A→B→A, autorreferência e profundidade real acima do limite, verificando liberação dos guards após erro/cancelamento. Acrescentar um consumidor Planner que passe pelo `checkEvidence` real.

## Evidência positiva e limites de interpretação

- Os wrappers de `result-store` clonam o valor e as referências antes de callbacks de autorização, verificam mutação desses argumentos e repetem leitura/autorização. A revisão não encontrou um bypass concreto de alias nesses wrappers.
- A persistência Planner exige replay antes/depois da escrita, compara o caso selecionado e recusa resultado divergente. O digest sem relógios de observação preserva a identidade semântica do replay. Não se conclui prova de retry nativo completo a partir de fixtures que reutilizam o mesmo objeto de resultado.
- A leitura BI conserva snapshots entre callbacks, compara projeção/contexto e revalida C17 no destino. Nenhuma ampliação de acesso foi identificada nessa passagem; o finding de múltiplas origens do outro revisor é uma questão distinta de completude do consumidor.
- `ChoiceRecord` é um snapshot histórico. A via de aplicação exige contexto UI, intenção humana, digest da revisão, autorização atual e commit do domínio com recibo. Cobertura financeira `complete` de uma observação de fonte não equivale a escolha, preparação, aprovação ou aplicação.
- A captura de AlternativeDraft existe na composição real. O bridge compara a receipt com a receipt do registry antes de `onVerifiedCall`; o run-store reabre a captura privada, executa a verificação sob lock e persiste proveniência junto do output. O helper `verifyAlternativePublication` sozinho verifica integridade/publicação e não autentica captura; fixtures desse helper não são prova GNATIVE.
- Os callbacks de transação examinados em WP03/WP11 usam verificadores de snapshot e mutação síncrona, sem uma nova leitura de domínio aninhada demonstrada nesses callbacks. Nenhum deadlock concreto adicional foi estabelecido nesta revisão.

Nenhum estado global de prontidão/aceite é emitido por este relatório.

## Identidade das fontes externas efetivamente lidas

Os caminhos abaixo são relativos a `/workspace/scratch/a97ca4c53050/foreign-intake/`. Os blobs foram calculados apenas a partir dos bytes dos arquivos; isso não é execução do produto nem validação de CI. `business-services.ts` presente no fechamento possui blob `a48424f...`; a menção anterior a `34a491...` do coordenador não foi usada como identidade desses bytes.

| Fonte | Git blob |
| --- | --- |
| `COMPOSE3/apps/cli/src/sucafina-product/business-services.ts` | `a48424fcea0b39e20dfce2da079decc4afc04a9d` |
| `COMPOSE3/apps/cli/src/sucafina-product/planner-calculation-services.ts` | `6898b08eb4b018f5a83167555836ac876d288976` |
| `COMPOSE3/modules/sucafina/Sucafinav1/product/ai/run-store.ts` | `a48f853b99a0b640e0c146ae6060b6bbde4a9449` |
| `COMPOSE3/modules/sucafina/Sucafinav1/product/host-binding/sf-mcp-bridge.ts` | `bc00a2fe70bb37d6132369c3767388e544e18510` |
| `COMPOSE3/modules/sucafina/Sucafinav1/product/host-binding/business-context.ts` | `0ac4c11d4eddb6e4a67c2c41efe40a7ff34fa47e` |
| `WP10/apps/cli/src/sucafina-product/alternative-services.ts` | `7513a155293f6253998033bd1439b636e00a1c96` |
| `WP10/apps/cli/src/sucafina-product/alternative-captures.ts` | `9e2bc584c80844b213b026351d766bd6ae5eba09` |
| `WP10/apps/cli/src/sucafina-product/bi-services.ts` | `7d44c1982c3c62fdaf21f98945ded9e572fd359a` |
