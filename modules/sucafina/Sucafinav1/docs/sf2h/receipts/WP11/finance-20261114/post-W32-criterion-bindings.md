# Adendo de vínculos após W32

W33 `87e5164a1c87ac9f013d381d5e601ca5b4b6c677`, tree `052583ce35edbadd4b7ec68ffe021bb59e05a20f`. **Dois vínculos, dois critérios literais, um teste novo. Nenhum aceite integral.**

O grupo usa uma leitura consistente por invocação nas duas fixtures consumidoras. A próxima invocação lê novamente; a tentativa de write dentro da transação é recusada e envenena a raiz, mesmo se o callback engolir a exceção. Os testes diretos anteriores de duas observações independentes permanecem intactos.

| Critério | Texto literal | Ramo comprovável |
| --- | --- | --- |
| `WP11.T01.INV.01` | Ator e autorização vêm do host; versão e histórico não são escolhidos pelo modelo nem importados como confiança. | Admissão canônica somente de leitura, recusa de write/revogação e releitura após commit. |
| `WP03.T01.INV.01` | Toda projeção e simulação reutiliza o cálculo e a autorização do domínio; não existe fórmula financeira paralela. | Admissão canônica somente de leitura, recusa de write/revogação e releitura após commit. |

O JSON registra o blob `75a2cbcd0c3907fc2d14f18f2b35f131331ecfb2`, os quatro oráculos, os consumidores e a lacuna de cada critério. O teste não publica dinheiro/C10, não cria ChoiceRecord aplicado e não comprova identidade instalada. S25/S26 têm outcomes próprios em [product-tests.json](product-tests.json); este adendo foi escrito durante o despacho e não lhes atribui PASS.

[Falha S22 preservada](s22-findings.md) · [Diff delimitado](s22-grouped-scope.diff) · [Revisão independente](reviews/review-s22-grouped-read-scope.md). O mapa W21 e os adendos anteriores permanecem íntegros.
