### ASTRA-WP10-PROMOTION-PROOF-01 — promoção sem operações não prepara o proof de commit

**Observado no composto W7:** `a1e9eb62aa7fa862322622cc38474ef0ff5a7d09`, tree `2a61f73fc5bf404501d61f71f552861f5e1338e1`. [CI4 run 43584781236](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43584781236), job `132416826537`: 36 pass / 11 fail, 47 testes / 15 arquivos. Sete falhas BI param antes do consumidor: primeira `decision-promote` retorna HTTP409 em aproximadamente 1,8s; `bi-case.test.ts:91` e `bi-call-scope.test.ts:90`. O log não imprime body/reason: **`case-changed` abaixo é inferência do caminho de fonte, não mensagem observada do run**.

**Reconciliado agora no seu head** `fe13ee693bdcec1830190bcdb5cc7f2794942c1f`: `product/decisions/mutations.ts` blob `922358d17c470c16b43076510bdf04744e2306e4` ainda contém o ramo. `product/planner/scenario-port.ts` blob `fc15d2d9130e23d0a290f5a14f61423152d2c72c` conserva a observação sem operações/assumptions com `costCoverage: assessment`.

Caminho causal estático:

1. O Planner retorna o assessment original quando o cenário só observa a fonte.
2. `mutations.addAlternative` compara esse assessment com a cobertura registrada, obtém `reassessed=false` e pula `coverageEvidence.entries`.
3. O consumidor real `apps/cli/src/sucafina-product/portfolio-coverage.ts` prepara `proofs.set(call, ...)` exclusivamente em `entries`, após verificar classificação humana, fontes, C08, Request e autoridade.
4. `saveCase` sempre chama `coverageEvidence.verifySnapshot`. Sem o callback prévio não existe proof, então o commit é recusado; `preview` é mapeado a conflito/`case-changed`/409.

É anterior a `calculations.persist/issue`: a primeira promoção grava o scenario diretamente, sem atingir os novos readers C17 ou o guard ALS de cálculo.

**Patch delimitado proposto ao owner**, não aplicado por Astra:

```diff
--- a/modules/sucafina/Sucafinav1/product/decisions/mutations.ts
+++ b/modules/sucafina/Sucafinav1/product/decisions/mutations.ts
@@ -90,7 +90,9 @@
       const basis = coverage.value.basis
       const reassessed = digestSfValue(scenario.value.costCoverage) !== digestSfValue(coverage.value.assessment)
-      const entries = reassessed && input.coverageEvidence ? await callMutationPort(() => input.coverageEvidence!.entries(attributed, coverage.value.assessment, context)) : undefined
+      // Even unchanged coverage needs the current producer proof consumed by
+      // the synchronous source fence in saveCase; a matching assessment is not authorization.
+      const entries = input.coverageEvidence ? await callMutationPort(() => input.coverageEvidence!.entries(attributed, coverage.value.assessment, context)) : undefined
       if (entries && entries.status !== "ok") return entries
-      const result = !reassessed ? attributed : input.coverageEvidence && entries?.status === "ok" ? await reassessScenarioCoverage({ scenario: attributed, basis: coverage.value.basis, baseline: coverage.value.assessment, entries: entries.value, resolveEvidence: (refs) => input.coverageEvidence!.resolve(refs, context), supports: input.coverageEvidence.supports }) : undefined
+      const result = input.coverageEvidence && entries?.status === "ok" ? await reassessScenarioCoverage({ scenario: attributed, basis: coverage.value.basis, baseline: coverage.value.assessment, entries: entries.value, resolveEvidence: (refs) => input.coverageEvidence!.resolve(refs, context), supports: input.coverageEvidence.supports }) : !reassessed ? attributed : undefined
       if (!result) return { status: "unavailable", reason: "scenario-coverage-reassessment-unavailable" }
       if (result.comparisonStatus === "complete" && !input.coverageEvidence) return { status: "unavailable", reason: "scenario-source-fence-unavailable" }
```

O callback precisa rodar também para cobertura coincidente, e seu resultado precisa passar pela reavaliação real já existente. Apenas chamar `entries` mantendo `attributed` pode continuar falhando no segundo source: a ordem canônica de `evaluatedSourceRefs` da reavaliação começa pela basis, enquanto a classificação original começa pela fonte. O proof compara o resultado completo exatamente.

`reassessScenarioCoverage` conserva components, knownSubtotal, horizon e currency; usa a classificação/evidência atual, preserva complete apenas se o assessment revalidado é completo e não cria total completo a partir de dados parciais. O fallback atual sem provider e sem reassessment permanece. **Não remover `verifySnapshot`, não aceitar proof ausente, não inserir autorização fictícia nem alterar regra financeira.**

Provas afetadas exigidas no próximo SHA: promoção sem operações para os dois sources reais (ordem invertida), promoção alterada ainda reavaliada, revogação/mudança de fonte ou C08 entre callback e commit recusada; BI só pode começar depois dessas promoções reais. Os sete testes WP10 existentes já reproduzem o pré-requisito; acrescentaremos diagnóstico do body se necessário. O bloqueio alcança consumidores BI e Alternative que dependem dessa promoção e permanece registrado. Nenhum teste local, nova execução ou alteração na sua branch foi feito. Favor publicar incremento próprio com pins/runs para consumo.

Encaminhado: https://github.com/gustavomhss/Orchestra-SF/pull/35#issuecomment-6875919952
