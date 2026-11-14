# Adendo independente — retorno de foco C1R no W12

**Conclusão: C1R corrigido por inspeção estática dos três blobs publicados.** Não identifiquei nova regressão concreta nesse delta. A execução do teste discriminante e a prova do percurso instalado continuam pendentes.

## Pin e integridade

- Produto: `217c9bcc75d499eff3884fb4afe662d5c0029935`.
- Árvore informada: `eeae1c748b3e1e73be8686c3f1df325e2fac3824`.
- Fonte da revisão: `/workspace/scratch/a97ca4c53050/finance-W12-changes.json`; não utilizei código do working tree em alteração.
- Comparação: conteúdo congelado W12 contra os caminhos do snapshot W10 previamente revisado. A tipagem de fixture W11 está incluída no delta do teste.

Recalculei as três identidades Git a partir do conteúdo capturado: todas correspondem ao `sha` informado.

| Caminho, sob `modules/sucafina/Sucafinav1/` | Blob verificado |
|---|---|
| `product/analytics/source-navigation.ts` | `c6f3d5cf5772b588cb0da9f0648ce69f8775f357` |
| `product/analytics/view.ts` | `9b279523da60f18eebdc270707d1b42c865e3dca` |
| `test/product/wp05/planner-origins.test.ts` | `bf92905dccfd01eaedc624841d808d5ce21b6f21` |

Essa verificação cobre os três blobs, não uma reconstrução independente de toda a árvore W12.

## Por que o defeito está corrigido

A causa original era um botão A/B retido dentro do chooser oculto, antes da marca visível, com o mesmo `data-bi-focus`. A busca parava nesse botão e informava sucesso sem devolver o foco à marca.

`product/analytics/source-navigation.ts:50–55` agora fecha o chooser por uma função que define `hidden=true` e remove seus filhos. Tanto a escolha de origem quanto o cancelamento utilizam esse caminho. O botão oculto que causava a interceptação deixa de existir.

`product/analytics/view.ts:421–433` também torna a restauração defensiva: percorre os candidatos com a `valueId` e depois os fallbacks; ignora elementos desconectados, sob ancestrais hidden/inert, sem retângulo de layout ou com visibility hidden; só devolve `true` quando `ownerDocument.activeElement` é realmente o alvo. Um candidato oculto ou sem foco efetivo não impede tentar o próximo.

O delta não altera o valor financeiro, a origem selecionada, os contratos ou as cercas do consumidor C17. Não identifiquei uma nova regressão concreta nas linhas alteradas.

## Discriminante escrito

`test/product/wp05/planner-origins.test.ts:87–98` acrescenta o caso que faltava: depois de escolher a origem, move o foco para “Aplicar filtro”, confirma que saiu da marca, chama o export real `restoreBiFocus` no mount original e verifica que a marca visível se tornou `document.activeElement`. Também exige que os choosers ocultos não conservem elementos com `data-bi-focus`.

Esse bloco está dentro dos laços de **BI02 e BI03**, das contribuições **zero e não zero** e das opções **A e B**. Assim, a assertion cobre o retorno da seleção, além do cancel/Escape já existente. A tipagem adicional no fim do teste estreita a referência para record e exige `originSource` antes de ler seu ID; não altera a identidade canônica que o teste compara.

## Limites e estado

| Item | Estado deste adendo |
|---|---|
| C1R, regressão própria de foco | Corrigida por revisão estática no pin W12 |
| Teste discriminante | Escrito com assertions relevantes; sem execução observada |
| S6 | Pendente segundo o coordenador |
| Percurso instalado HTTP/C17 e retorno do detalhe | Não demonstrado pelo callback capturado deste teste |
| G2, vantagem canônica | Fora do escopo; aguardará outro pin |

Nenhum produto, teste, navegador, build, typecheck ou CI foi executado; apenas este relatório e o JSON foram escritos. O revisor não é autor da correção.

**O fechamento é exclusivamente estático para C1R. Não constitui PASS de teste, aceite integral dos critérios, fechamento da integração externa ou veredicto global.**
