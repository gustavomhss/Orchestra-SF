# Missão52 — revisão independente P6 dos escopos de leitura

## Parecer

**STATIC_PASS / NOT_RUN.** Não identifiquei bloqueio estático nos dois adaptadores revisados. A proposta permanece **HOLD** para composição e qualificação nominal no W isolado52. Este parecer não concede release de runtime59, aceitação da missão52 ou ganho de desempenho.

Revisor: `/root/pack_criteria`. Nenhum teste, typecheck, build, dispatch ou edição remota foi executado. Foram feitas leituras de fonte e verificações de integridade dos artefatos.

## Identidade

- [Material completo](sandbox:/workspace/scratch/fec39c0682b3/m52-work/p6-read-scope-material.json): SHA-256 `0c19eae3584e47f895aad62d332fa38112c50b1211c7a287c2994995fccd4570`.
- [Patch completo](sandbox:/workspace/scratch/fec39c0682b3/m52-work/p6-read-scope-complete.patch): SHA-256 `5a3d9a416edafc70d7e94ae71702d2a207fa2cff725816b3912ec653148d9c9c`.
- Base declarada: C28 `d088708276b48f896ad4e0ecd2a95cb73dc413b1`, tree `8b07ebf53f492a20ce3381a8b4ec50bd21ec1c6d`.
- As duas pré-imagens vêm da composição de produção W `78f2362bd09fcbf606505d7833860f1af07b8e6f`; decision-case-http inclui o P4 ainda não integrado.

| Caminho | Preimage | Postimage |
|---|---|---|
| `apps/cli/src/sucafina-product/decision-case-http.ts` | `13188a92ace68e6730bd22f8ee87872af2c1dea1` | `1c0fabda68c92b3d7a14b569c2c3e960ff39476c` |
| `apps/cli/src/sucafina-product/portfolio-services.ts` | `881ce4672d9d0e641d1cc849663c0980c118774d` | `9d17760c418ee9b48b97443d90a994c31cc415f5` |

Os quatro hashes Git e o hash do patch efetivo foram conferidos. São exatamente dois paths e três novas chamadas ao helper.

## Fronteiras verificadas

| Entrada | Dentro do escopo | Preservado fora dele |
|---|---|---|
| HTTP decision-compare | A chamada original `portfolio.compare(request, call)` | Validação HTTP, admissão humana, contexto de caso e encerramento da admissão; list/edit/catalog permanecem como estavam |
| Comparação de recordChoice | Somente `composed.mutationPlanner.compareScenarios` | Admissão, replay, loadCase, verificações de resultado, leitura de resultados persistidos e saveCase |
| Valores de recordChoice | O corpo original de `composed.resolveChoiceValues`, com suas leituras ordenadas de regras/métricas e verificações finais | createChoiceSnapshot, saveCase e qualquer preparação/gravação posterior |

Quando uma dessas entradas abre sua própria raiz, ela fecha antes de o await do chamador prosseguir. Um leitor que compartilhe uma raiz legítima conserva a duração da raiz externa; qualquer escrita posterior ainda seria recusada e invalidaria essa raiz. A mutação inteira não foi envolvida. Não há reutilização de comparação entre as três entradas, deduplicação de callbacks, reordenação de regras/métricas ou substituição dos produtores.

Quando `input.preparation` é fornecido, permanecem exatamente `registries.planner` e `preparation.resolveChoiceValues`, sem novos wrappers. Os demais métodos do planner conservam as referências originais.

## Helper, tipos e recusa

Foi lido o helper runtime59 em `26f7af7efcc143d558df51eeb35e4a7011f456fe`, blob `3cf82bd82b2716ee689b4c48bd9551540b058287`, junto dos contratos, SourcePersistence e LocalStore correspondentes.

Os três callbacks retornam `PortResult`, compatível com `T extends boolean | { status: string }`. As funções contextualmente tipadas preservam os retornos de comparação e `ChoiceRecord["values"]`; os valores de recusa são erros desse mesmo contrato. `MutationHost.resolveChoiceValues` é obrigatório, portanto o ramo composto não chama um callback opcional/undefined.

A capability opcional é `persistence.readSnapshotRoot`. Se estiver ausente, o helper mantém sua transação canônica. A transação `dashboard` continua dentro da capability quando ela existe, preservando as fachadas SourcePersistence/CurrentChoice. O adaptador não chama a primitiva diretamente.

Um snapshot externo só pode ser compartilhado quando pertence a um escopo aberto criado pelo mesmo helper, com a mesma persistência, Request e autoridade. Raízes externas desconhecidas são recusadas; não há fallback para executar o trabalho diretamente após recusa. O helper também fixa métodos, sinal, fingerprint do Request e digest do payload, e verifica a saída.

Os callbacks escolhidos não solicitam gravação de negócio. Uma leitura de fonte que tente manutenção de identidade com commit, uma escrita de blob ou outro write aninhado invalida a raiz do LocalStore, inclusive se o erro for capturado internamente. A proposta não promove essa tentativa a sucesso nem a repete fora do escopo. Leituras remotas continuam executando sua própria autorização; o snapshot local não lhes concede atomicidade.

## Limites

O patch não altera CurrentChoice46, Procurement/C12, Reports48, workflows45, testes, identidades, assertions, políticas ou deadlines. Seus imports usam o helper canônico; não reimplementam a primitiva runtime59.

Os nove postimages imutáveis59 são uma dependência separada da composição proposta. O resultado R2 do produtor não constitui execução UI da missão52 e não é transferido para ela. O uso declarado é somente no W isolado52; este parecer não aprova aplicação ao stack.

**Typecheck, testes e runtime do candidato: NOT_RUN. Desempenho: NOT_MEASURED. Integração e aceitação: NOT_GRANTED.** A qualificação exige manifest concreto, composição exata sem instrumentação diagnóstica e os resultados individuais das cinco jornadas originais.

