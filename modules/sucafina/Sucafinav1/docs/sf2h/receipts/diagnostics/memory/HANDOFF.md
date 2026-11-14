# HANDOFF — Memory/Atlas para WP10

## Estado da entrega

**READY_FOR_OWNER_REVIEW — diagnóstico e proposta entregues; correção funcional pendente.**

- Patches compartilhados: **NOT_APPLIED**.
- Teste próprio e novas seleções Actions: **NOT_RUN**.
- Parcela dominante do custo interno: **NOT_PROVEN**.
- Causa terminal demonstrada: prazo cumulativo esgotado durante same-request-new-proof, após 207.690 ms já consumidos.
- Mecanismo adicional demonstrado por fonte + contagem: classificação de 7.580 chamadas aninhadas em prepare faz 22.740 cópias defensivas de snapshots. Não há duração atribuída a elas.
- Esta frente não declara WP10, Memory, Atlas nativo ou campanha aceitos.

## Identidades

Produto investigado W26: `a1434e7ea7340aa1d1c8ce6bb48958b724218170`, tree `a9398de38c9e684d28c27b0188ab653e75bf3305`.

Falha: run [43618475702](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43618475702), job `132518644009`, snapshot `dd53af531181d1b05e5081b765dbfecc2a6ba6a9`, tree `ab3895d693c0923a8e26aebe03654cce1854149d`. A única diferença W26→S é .ci-run.json; resultado 45 pass/1 fail, Memory 225.029,32 ms, stale.preserve não alcançado.

Owner observado: `astra-wp10@ab8fb4f29d078d179742a77679ef85e5c549b114`, tree `6b889a436fafe019580801edba3015d90fa75dfd`. W27 já contém a correção de escopo lexical de uma observação real Atlas. Sua autoria e suas branches permanecem intactas.

Branch desta entrega: `diagnose-memory`, parent esperado W26, PR destinada a `astra-wp10`. Head/tree finais da entrega estão na descrição da PR, calculados após criar o commit. O commit não tenta conter seu próprio hash.

## O que consumir

1. [README.md](README.md): caminho causal, arquivos/linhas, medidas e distinção entre observado, derivado e hipótese.
2. [evidence.json](evidence.json) e [excerto A26](evidence/A26-memory-excerpt.log): evidência existente, sem atribuí-la aos patches.
3. [patch-manifest.json](patch-manifest.json): preimages/postimages Git e SHA-256, quatro patches (duas etapas × duas bases), e hashes dos dois arquivos próprios.
4. `test/product/diagnostics/memory/persistence-observer.ts` e `persistence-observer.test.ts`: intake seletivo; não incorporar a árvore antiga de produto desta branch.
5. [VALIDATION.md](VALIDATION.md) e `requests/`: seleção mínima e critérios discriminantes.

O alvo compartilhado dos patches é exclusivamente `modules/sucafina/Sucafinav1/test/product/wp10/analysis-composition/historical-memory.test.ts`. A integração inicial troca apenas o wrapper de contagem por observador transparente e acrescenta log de tempos por fase. A contraprova muda somente `snapshots` para `callback-scope`. As fontes de produto não são alteradas por nenhum patch desta entrega.

## Próxima ação concreta

**O terminal A27 foi consumido antes da publicação:** [43624030665](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43624030665), snapshot `e336f3e945fc22ae737af9b2425186c25b46a43d`, job `132535810515`: 59 pass / 1 fail, Memory falhou aos 182.124,35 ms por assertion, sem timeout. Retry concluiu no decorrido 157.725 ms e stale.preserve em 159.119 ms. Cleanup `132537774635` success.

**Novo bloqueio concreto do owner:** após corrupção real da captura, Atlas recall devolveu unavailable, mas staleAccess.preflight devolveu ok, esperado denied, em historical-memory.test.ts:580:103. Os três probes finais de autoridade revogada não foram alcançados. O consumidor analysis-stale-commit.ts é o mesmo blob W26/W27; o novo resultado não prova regressão introduzida pelo W27. Corrigir essa divergência de integridade e preservar o positivo stale.preserve; esta frente não modifica esse consumidor. Não repetir o run sem delta. [publication-observation.json](publication-observation.json), [evidence.json](evidence.json) e [excerto A27](evidence/A27-memory-excerpt.log) registram o terminal.

Se a medição de custo continuar necessária, incorporá-la à próxima qualificação necessária do owner. Antes disso:

1. Confere novamente head/tree e o blob completo do teste histórico. O patch W27 exige `ee5c725ae78e0eba5c12600da80eb51b7173c2ed`; a divergência exige reconciliação delimitada.
2. Incorpora somente os dois arquivos próprios do observador e qualifica o teste curto via `request-observer.json`.
3. Aplica `01-w27-measure.patch`, publica candidato próprio e executa somente o arquivo histórico completo por `request-memory.json`, respeitando a fila.
4. Lê `scopeInspectionMs` e admissão/corpo/egress. A variante `02-w27-remove-classifier-copies.patch` é uma contraprova condicionada ao dado; mesmo produto, helper e fixture, mudando somente o modo.
5. Publica resultado real com W/tree/S/run/attempt/jobs/cleanup/logs, campos medidos e limites. Um resultado falho ou parcial não encerra o timeout.

Os patches W26 são alternativa para o diagnóstico imutável; não devem ser usados para reverter W27 nem encadeados com os patches W27.

## Preservação e verificações realizadas

Verificação estática, sem executar produto: hashes dos preimages; aplicação exata dos hunks em texto; postimages; linhas de assertions/expectSpawn em mesma ordem; budgets 225000/240000; cauda inteira a partir de interleave byte a byte; somente dois namespaces autorizados na publicação.

O helper foi submetido a uma segunda leitura estática sem autoria por `/root/owner_delta_review`, que não encontrou bloqueio concreto e pediu ressalvas sobre overhead/microtasks e necessidade ainda não demonstrada. As ressalvas foram incorporadas. Isso não é review FINAL de produto nem substitui typecheck/Actions.

A proposta mantém as observações independentes e todos os probes reais de C08/fontes/Request/período/lease, ancestry/replay, writers, assertions e prazos. O marcador não é autoridade nem cache. Os tempos inclusivos não são somados como wall time e o bucket de admissão não é chamado de lock wait.

Sem teste/typecheck/build local de produto, dispatch novo, merge, deploy, force push, alteração de permissão, restart ou mensagem a terceiro. Remoto somente GitHub MCP.

