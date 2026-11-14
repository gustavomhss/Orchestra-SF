# WP14 — auditoria congelada dos consumidores publicados

## Escopo e identidade

Leitura estática, sem teste de produto local, execução remota ou mutação remota. Pins:

| Origem | Commit publicado |
|---|---|
| WP10 | `417038d6b3cfd1817f40ffc60e56f42e505b50a5` |
| astra-compose | `5866bcb2ed610f80138aaabc261acac4acf709cd` |
| WP14 no início da solicitação | `19ad7557` (somente contexto; não candidato validado nesta auditoria) |

Os 120 arquivos de `apps/cli/src/sucafina-product` de WP10 foram lidos por GitHub MCP. As árvores completas de produto e testes dos dois pins foram examinadas. Foram verificados 659 snapshots contra o Git blob publicado; este receipt publica em `source-manifest.json` apenas as fontes citadas e os 120 arquivos da busca CLI completa. Na captura, pequenas quebras de linha inseridas pelo transporte foram removidas somente quando o hash passou a coincidir exatamente. Parte das fontes idênticas já existia no checkout e só foi copiada após verificação do blob. `findings.json` é o inventário processável com caminhos, linhas, blobs, owners, critérios e limites. Arquivos ausentes no checkout parcial não foram tratados como ausência no produto publicado.

## Resultado principal

Há composição real de memória, outcomes, revisão e histórico de portfólio. A alegação anterior de que os construtores existiam apenas em WP14/testes não se sustenta no host publicado. Permanecem lacunas concretas no C16/Meu Trabalho, na revisão de condições após alteração real de fonte, no consumo da política explícita de invalidação e no acesso nativo a precedentes distintos.

### Memória, outcomes e revisão já compostos

`apps/cli/src/sucafina-product/memory-services.ts` cria `createSfSignalRegistry` (114), `createSfAuthorizedSignalList` (128), `createSfOutcomeSelectionRegistry` (131), `createSfDomainOutcomeAccess` (137) e o adaptador de revisão (138). `host-context.ts` instala essa fábrica (266), liga o leitor de outcomes da revisão (260–275), entrega seleção material ao caminho de análise vivo (325–333) e inclui as rotas privadas no HTTP real (812). `memory-http.ts` usa a admissão humana, contexto do caso e reautorização na saída.

`review-services.ts` consome leitura/autorização de outcomes. `product/reviews/outcome-access.ts` preserva cutoff e compara duas leituras completas sob autoridade atual. Isso é composição real, mas não equivale a prova de que uma observação não vazia foi efetivamente salva e exibida numa revisão após reinício/revogação. O teste existente `wp07/composition.test.ts` autoriza apenas arrays vazios de outcomes.

### Portfólio e histórico de revisão já compostos

`review-portfolio-history.ts` instancia `createPortfolioHistory` e `createPortfolioHistoricalProvenance` com binding histórico protegido, contexto vinculado ao resultado e C08/BCS reais. `product/portfolio/history-provenance.ts` verifica binding/seleção originais, encarnação do caso e acesso atual em duas passagens. `portfolio-services.ts` usa o produto, resultados, bindings e evidências concretos. Esse consumo de histórico não deve ser descrito como ausência de consumidor, nem convertido automaticamente em prova de consumo direto de todo output de WP14.

### C16 / Meu Trabalho — owner WP10 com WP08

`product/collaboration/host.ts` aceita `workSignals` e o encaminha à composição. `collaboration/work-port.ts:78` retorna `work-signals-unavailable` para uma seleção real `sf:case-work-selection:` sem o callback. A chamada publicada a `createCollaborationHost` em `business-services.ts:170–179` não passa esse argumento. Nenhum dos 120 arquivos de composição CLI referencia `createSfWorkSignalList`, `createSfWorkRefIssuer` ou `workSignals`.

Existe um seletor genuíno: `collaboration/case-selection.ts:150–153` expõe `resolveCase`, que aplica o binding protegido de ator/acesso/política/período e releitura atual. A correção do owner deve compor esse seletor com `createSfWorkSignalList`, autorização/materialidade reais, emissão privada durável de referências opacas e destino concreto autorizado. Callback de fixture ou lista vazia não fecha C16. Os testes atuais de host/work/presentation de WP08 cobrem procurement, não sinais WP14.

### Planner recall e candidateAccess nativo — owner WP10/WP11

`business-services.ts:352–365` deriva tipos apenas de referências `record` e prepared changes. Evidência válida de cálculo Planner pode produzir `undefined`. O blob dessa implementação (`34a491f859f7b57b0883a122f816803df43c74c8`) é idêntico nos dois pins. O patch revisável `recall/0001-canonical-recall-features.patch`, produzido pelo agente de recall, troca essa duplicação pela derivação canônica de WP14 e mantém os fences de leitura/autoridade.

O caminho vivo é `host-context.ts:325` → `analysis-host-services.ts` → `business.caseRecall`. `analysis-domain-bindings.ts` possui outro construtor via `atlasRecall()` mas não tem importador nos 120 arquivos CLI; não deve ser confundido com o caminho ativo. O patch `0002-scoped-recall-consumer-seam.patch` contempla ambos.

Um contexto nativo limitado ao caso corrente não autoriza sozinho outro caso. O owner deve emitir o pacote completo `candidateAccess` (leitor de casos, memória/captura, continuidade e features), com escopo próprio e autorização atual. Alterar somente o ranker, clonar o contexto ou trocar o ID não supre essa autoridade. O produtor permanece bloqueado no owner; a seam de WP14 apenas permite consumir o pacote legítimo.

### Invalidação — consumo explícito ainda não demonstrado

`host-binding/atlas-memory.ts` já relembra a autoridade atual e continuidade a cada leitura e usa realmente `createMemoryRead`; `business-context.ts` evita cache entre chamadas. Não foi encontrada utilização de `decideSfRecallInvalidation` na composição CLI completa nem nos arquivos auditados de Atlas/BCS. Isso não prova vazamento: a verificação atual pode negar acesso corretamente. Falta demonstrar como a política pura alcança qualquer projeção/lease/índice retido, ou explicitar a ausência desses caches e provar revogação no consumidor concreto. A identidade histórica não deve ser apagada para simular invalidação.

### Mudança real de fonte/materialidade — lacuna de composição

`memory-services.ts:43–50` exige que referências originais continuem fresh e idênticas. Sua autorização de sinal também exige correspondência exata com o resultado de cenário escolhido. Assim, uma alteração real de Planner torna o binding indisponível; não foi encontrado caminho ativo que derive/admite a revisão antes/depois preservando a escolha original. `decision-materiality-services.ts` cria outra instância da mesma registry protegida e expõe `revise`, mas não foi localizado consumidor de revisão entre as rotas CLI. As duas instâncias compartilham namespace; isto não foi classificado como duplicação de store.

O owner precisa compor a revisão genuína do material/coverage e manter período, critério, encarnação, decisão original e autoridade atual. O teste `wp10/integration/memory-services.test.ts` já demonstra que a edição real leva a indisponível; seus sinais materiais iniciais usam critérios/cenários explícitos de fixture e não provam esse fluxo completo.

### Atlas durável e watch

O host executa `probeSfAtlasScanner` e `initializeAtlas` com versões pinadas (768–770). `host-binding/atlas-memory.ts` usa os imports públicos `createMemoryEmit`/`createMemoryRead`, persiste envelope/capturas/outbox via transação protegida e relê fontes/continuidade/store. Há memória real na implementação; catálogo de operações não é sua prova.

`wp10/atlas-business/atlas-recovery.test.ts` cobre store dispose/reopen no mesmo processo. `wp10/analysis-composition/historical-memory.test.ts` usa boundary/scanner/arquivos de fonte reais, mas declara não usar modelo, Session, SkillLoadReceipt ou publicação nativa. Não ampliar essas garantias para fresh process/GNATIVE.

`memory-services.ts:218–232` sempre retorna `native-watch-admission-port-unavailable` após validações reais. `host-context.ts:294` registra a ausência de portas públicas C07. Essa dependência pertence a WP10/WP09; WP14 não deve introduzir scheduler ou mensagens.

## Seleção cirúrgica de testes

`findings.json` lista 16 arquivos exatos e suas limitações, todos com estado `SOURCE_INSPECTED_NOT_EXECUTED`. São candidatos à seleção pelo owner após a composição real e somente em GitHub Actions. Os testes mais próximos são:

| Área | Caminho relativo a `modules/sucafina/Sucafinav1/test/product/` | Limite atual |
|---|---|---|
| Registry/outcome/rotas | `wp10/integration/memory-services.test.ts` | Cenários/critérios explícitos de fixture; edição real dá indisponível |
| Recall Planner/Atlas | `wp10/analysis-composition/historical-memory.test.ts` | Mesmo caso UI; sem Session/SkillLoadReceipt/model/publicação |
| Persistência Atlas | `wp10/atlas-business/atlas-recovery.test.ts` | Dispose/reopen no mesmo processo |
| BCS/ancestry | `wp10/atlas-business/business-context.test.ts` | Callbacks de fonte fixture |
| Outcomes de revisão | `wp07/outcome.test.ts`, `wp07/composition.test.ts` | A composição existente não salva outcomes não vazios |
| C16 seleção/work | `wp08/case-selection.test.ts`, `wp08/host-work.test.ts`, `wp08/work-presentation.test.ts` | Seleção/helper ou procurement; falta workSignals real |
| Portfólio histórico | `wp13/history-provenance.test.ts`, `wp13/campaign.test.ts` | Contratos históricos/campanha, não recall nativo completo |
| Revisão histórica | `wp10/integration/review-history-composition.test.ts` | Histórico financeiro real, não outcome WP14 não vazio |

Novas provas precisam atravessar o host real para: revisão material após edição Planner; sinal C16 por seleção protegida com IDs duráveis/revogação; outcome selecionado não vazio salvo em revisão com cutoff após reopen/revoke; invalidação concreta; e precedente nativo distinto com candidateAccess legítimo. Nenhum resultado de CI anterior é reaproveitado para um candidato de outra identidade.
