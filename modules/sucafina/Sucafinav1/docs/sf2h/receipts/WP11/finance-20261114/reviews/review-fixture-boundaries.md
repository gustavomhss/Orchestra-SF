# Revisão independente dos limites de fixtures

**Resultado: nenhum bloqueio estático encontrado nos três blobs exatos. Validação de produto no Actions permanece pendente.**

Revisor: `fixture_boundary_review`. Leitura concluída em 2026-11-14 11:46:51 UTC. Não houve edição de código nem alteração dos relatórios de outros agentes.

## Pins revisados

| Arquivo relativo a Sucafinav1 | Blob anterior | Blob candidato |
| --- | --- | --- |
| `test/product/wp05/engine-fixture.ts` | `0ccf287ecd225ddcae99a1490f255b4c2b4358ed` | `608b1a95b491740041f8689a41b4a064c7254b24` |
| `test/product/wp11/composite-coverage.test.ts` | `3196d7885a6cecbc4afff9b3044857400753280a` | `27e0580d6c9ba7b4c549bc33e5d252a7ce74ae66` |
| `test/product/wp11/current-choice-lifecycle.test.ts` | `a8b72e8c30d6e365c77169e53d499dc163530318` | `2ad002beca9b3c6dab4e1d8841345c9250a6826d` |

## Factory de comparação e compatibilidade

A comparação independente dos bytes reconstruiu o corpo original da fixture, removendo somente a execução de `persistent.evaluateAndStore`, a propriedade `saved` do retorno intermediário e o nome anterior da função. Autenticação, admissão privada, C08/SQLite, fontes, cenários, resultados persistidos, comparação, provas e binding de critério, intervalos e solver permanecem nos mesmos produtores e na mesma ordem. Não foi introduzido cache ou fórmula financeira.

`createWp05SensitivityFixture` conserva o nome e as opções padrão usados pelos consumidores existentes. O wrapper aguarda a preparação da comparação, executa a mesma sensibilidade persistida com os mesmos request/caseRef/context e devolve `saved` obrigatório. Falha na preparação continua sendo limpa pela factory de base; como esse await está fora do try do wrapper, não há cleanup duplo nesse caminho. Falha na sensibilidade executa o cleanup do wrapper antes de relançar o erro, preservando a mensagem anterior.

O teste composto passa a usar a preparação que efetivamente consome. Suas cinco instâncias deixaram de solicitar cinco sensibilidades completas não utilizadas. Isso é trabalho evitado comprovado pelo fluxo estático; não é medição de ganho nem demonstração de que o timeout observado foi resolvido.

## Preservação dos oráculos compostos

O arquivo de teste é byte-idêntico ao anterior após substituir apenas o nome da factory. Foram preservados:

- Dois testes, 29 linhas de assertions e os dois limites de 180000 ms.
- As quatro variantes `omitted`, `null`, `zero` e `confirmed`, no mesmo loop.
- Os limiares canônicos 55000 e 15000, o intervalo 10000–70000 e a cotação confirmada 40000.
- Subtotais 210000/250000 e diferenças −30000/10000, produzidos pelo Planner.
- Distinção entre ausência, null e zero, classificação shared/N/A e prova de intervalo.
- `comparisonStatus: conditioned` e `total: null` enquanto a operação continuar simulada.
- Negativas por evidência revogada, classificação N/A retirada, duplicação e cobertura incompleta.

A tipagem de `renewalCoverage` seleciona somente campos comuns às duas factories; não exige `saved`. Os consumidores de sensibilidade continuam recebendo a factory completa. O JSON contém o inventário estático de importadores diretos.

## Diagnóstico de current-choice

O candidato `2ad002b` foi conferido separadamente. As 40 linhas de assertions, o timeout de 180000 ms e a chamada original à factory completa de sensibilidade permanecem iguais. O trace envolve os delegates reais de resimulação e de baseline: chama cada delegate uma vez com os mesmos argumentos, retorna seu valor e relança a mesma exception. A marca de entrada em `coverageEvidence.entries` precede os clones que já existiam, sem acrescentar leituras de fontes, admissões, autorizações ou replay.

O trace é diagnóstico. Ele não corrige o produto nem estabelece a causa da falha `choice-preview-unavailable` observada em S14. Pode estreitar o limite da exception no próximo run. Os produtores e callbacks de autorização continuam preservados.

## Validação exigida e limites

A seleção cirúrgica deve executar `composite-coverage.test.ts` e um consumidor real da factory completa; `current-choice-lifecycle.test.ts`, que já está na seleção proposta, continua sendo esse consumidor e também fornece a evidência diagnóstica. Não é necessário repetir toda a suite apenas pela extração da factory. Typecheck do package permanece a cargo do coordenador no Actions.

Esta revisão usou leitura de fontes, inspeção de diffs e verificações Python de hashes e igualdade textual. Não importou nem executou produto; não executou testes locais, Bun, typecheck, guards, browser, CI ou escrita remota. Não transfere resultados anteriores aos novos bytes e não declara READY, DONE, prova nativa ou aceitação dos critérios.
