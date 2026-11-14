# WP13 — Binding da persistência de comparações do Planner

**Estado: PROPOSED_NOT_APPLIED / BLOCKED_EXTERNAL.** Este delta pertence a WP13 e não foi aplicado ao produto por WP03. Nenhuma execução integrada ou CI é alegada neste documento.

## Problema concreto

`createPlannerResultPersistence` agora reexecuta a comparação, confere os dois cenários atuais e, quando `criteria` não está vazio, exige `comparisonBindings.proofs/bind/read` reais e `replay.compareScenarios`. Sem esses consumidores retorna `comparison-criterion-binding-unavailable` antes da gravação. Isso impede salvar uma comparação antiga após mudança/revogação da regra, ou aceitar resultado adulterado apenas porque os IDs dos cenários coincidem.

O factory em `product/portfolio/product.ts` ainda fornece somente store, scenarios e resolveCase. Por isso, uma avaliação Portfolio com constraints não vazias fica indisponível até aplicar o delta.

## Delta exato

Aplicar [wp13-comparison-persistence.patch](wp13-comparison-persistence.patch) exclusivamente ao arquivo `modules/sucafina/Sucafinav1/product/portfolio/product.ts`.

- Referência de origem: `73ee7fd812d233f898ef79a9378014d4339d9875`.
- Git blob do arquivo de origem examinado: `495169ccb0da1c775622907facf9b2ba13e0bb5c`.
- Adicionar ao factory: `comparisonBindings: input.comparisonBindings` e `replay: input.planner.planner`.
- O patch não muda fórmulas, contratos congelados, grants ou autoridade.
- Rebasear apenas se o conteúdo desse factory tiver mudado; não aplicar cegamente sobre outra composição.

A composição resultante é:

```ts
createPlannerResultPersistence({
  store: input.results,
  scenarios: input.planner.scenarios,
  comparisonBindings: input.comparisonBindings,
  replay: input.planner.planner,
  resolveCase: input.caseFor,
})
```

O `bindings.bind` já existente em `product/portfolio/analysis.ts` pode permanecer no delta mínimo. Para o mesmo operationIdentity e mesmo request/resultRef/expectedRules, o provider retorna o recibo idempotente existente antes de repetir o callback. Não remover esse trecho indiscriminadamente: o produtor de persistência não cria binding quando `criteria=[]`, mas o consumidor Portfolio ainda lê um binding também nesse caminho.

## Estado parcial C08 é real

A escrita do resultado em C08 e o binding da comparação são operações duráveis separadas. Se o resultado foi salvo e o binding posterior falhar, WP03 retorna falha (`comparison-persisted-but-binding-unavailable` ou outra recusa atual) e não publica `outputRef` como sucesso. O registro já gravado continua existindo; isso não é rollback global nem comparação aceita.

Todo consumidor que promove, exibe ou reutiliza uma comparação com critérios como **atual** deve exigir:

1. Leitura autorizada do resultado e igualdade do digest do pedido/resultado/caso.
2. `comparisonBindings.read({ caseRef, resultRef }, context)` com as regras e evidências atuais.
3. Replay da comparação pelo Planner com as mesmas referências/critério, ou a validação equivalente que o registry real executa, e revalidação no egress.
4. Recusa diante de revisão/incarnação/ACL/regra divergente, sem anunciar resultado concluído.

`createSfDecisionResultStore.read` isolado não confere o binding de regras. Um registro C08 parcial não pode ser promovido a prova atual por meio dessa leitura bruta. O consumidor não deve substituir `proofs/bind/read` por callbacks constantes em produção. O retry deve reutilizar a identidade durável da operação e o mesmo conteúdo; chaves novas não reconciliam uma gravação anterior incerta.

## Verificação mínima no consumidor

- Comparação válida com constraints não vazias através de `createPortfolioProduct`, Planner real, C08 e `createCriterionComparisonBindings`; consumidor lê o mesmo resultado após reabrir o store.
- Mesmo pedido/identidade repetido retorna o resultado existente; o segundo bind permanece idempotente e não duplica registros.
- Comparação adulterada com os mesmos scenarioRefs é recusada antes de write.
- Mudar/revogar regra após produzir a comparação e antes de persistir produz stale/unavailable.
- Mudar regra depois de C08 write e antes do binding deixa estado parcial auditável, nunca status ok/outputRef; provar a recusa também no caminho consumidor após reload.
- Sem `comparisonBindings` ou replay, constraints não vazias retornam unavailable sem write; cenário sem critérios continua funcionando e obtém o binding vazio exigido por Portfolio.
- Nenhuma leitura entre superfícies acontece dentro de transaction já aberta; não há mutação oficial de Planner/procurement/dashboard pela simulação.

Esses testes precisam de Actions ligado ao produto candidato. Fixtures de regra e contexto são úteis para unidade, mas não comprovam Session residente/GNATIVE nem consumidores empresariais. Os oito critérios C16/residentes continuam `NATIVE_UNPROVEN` até evidência real.
