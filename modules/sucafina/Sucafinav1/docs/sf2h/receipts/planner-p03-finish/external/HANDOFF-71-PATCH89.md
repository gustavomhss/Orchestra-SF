# Missão89 → owner Portfolio/71: patch externo *não aplicado*

**Motivo:** o original P03 da76 terminou no orçamento de 180s com 24/72 expectativas; a cadeia `portfolio/analysis.ts → criterion-comparison.ts → rules.evaluate → Planner → C08` executa múltiplos replays, com 12.026 leituras C08 (~48.596ms inclusivos) e 4.678 verificações de operações (~56.642ms inclusivos) no trace de prazo. O clone de retorno em stored-scenarios (~135ms) não pode explicar o prazo.

**Proposta concreta e mínima ao owner**: aproveitar `readHistoricalScenarios` já implementado e testado em C08 para o par de cenários de cada `inspect()` em `product/portfolio/analysis.ts` (dois `inspect` independentes continuam). O helper recebe os dois refs e retorna um clone privado por ocorrência; suas admissões, revalidação de fontes, snapshots inicial/intermediário/final, checks de case/ref, revogação e detecção de troca de facade permanecem. O parâmetro `"parallel"` mantém o agendamento de fallbacks escalares quando o host não expõe a batch canônica. A variante com batch executa callbacks em ordem serial para os siblings e deve ser confrontada com interleavings adversariais. Não memoriza entre phases e não toca políticas nem engines.

**Limite de evidência:** este patch não foi executado nem revisado independentemente na89; poupa observações de namespace por grupo quando o store real fornece batch, mas não elimina callbacks por ocorrência nem replays de verifier; não é legítimo estimar segundos/fechamento antes do CI controlado. O principal fan-out de `criterion-comparison` e `operation-verifier` permanece, de modo que o owner deve continuar a identificar e corrigir o custo dominante sem retirar as leituras independentes.

## Arquivos de entrega

- `PORTFOLIO-ANALYSIS89.patch`: patch Git completo sobre preimage exata `03576f1ec52d3d3c1f022c91d6c85257fa0491b8`
- `portfolio-analysis.ts.preimage.txt`: original completo no `sf2-stack` HEAD `c3e9bd367fe04cab3f9e19e8bcb77fe951632839`
- `portfolio-analysis.ts.postimage.txt`: candidato completo; não está aplicado no branch89
- handoff aberto para71, não um ACK de aceitação.

## Qualificação obrigatória antes de integrar

1. Comparar os blobs do target e rejeitar preimage divergente; usar CAS, não `git apply` cego.
2. Negativos de `historical-batch-fences`: drift na fonte Planner/versão/case/C08, alteração de header, lease e facade, revogação, duplicatas e erro de clone/getters; confirmar por ocorrência o mesmo número de callbacks e ordem por fase.
3. Exercitar `portfolio-p03-performance/read-before-bind.test.ts` e os controles `calculation-sources`; medir `state.read`, `verifyOperation`, `compareScenarios`, walls por phase, com a mesma fixture e sem reduzir verificações.
4. O P03 original, 72 linhas de assertions, `--timeout 180000`, apenas depois de melhoria causal material qualificada; não aceitar FAIL como PASS. CI45 responde com run/job/SHA.
5. Se o ganho for insuficiente, a correção precisa alcançar o replayer/operation-verifier e C08/state-provider com seus **writers reais**; não autorizar a89 a editar esses caminhos.

State: `PROPOSED_UNTESTED_OUTSIDE_89_AUTHORITY`. No `GLOBAL_RELEASE`.
