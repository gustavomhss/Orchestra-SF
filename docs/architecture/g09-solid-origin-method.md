# Suplemento de origem AST dos cinco tokens Solid

## O que a opção `ast: true` realmente fornece

No Babel core 7.28.0, a transformação executa os plugins, gera o código e retorna `file.ast` quando `opts.ast === true`. O retorno não associa automaticamente cada nó às coordenadas do código gerado. Fonte: [transformation/index.ts no commit de 7.28.0](https://github.com/babel/babel/blob/ccc5fae96f5281ae1ee49fac74c7c275b9111ead/packages/babel-core/src/transformation/index.ts).

Metadados de origem podem sobreviver à transformação. No `cloneNode` de `@babel/types` 7.29.7, `loc` é preservado por padrão, mas os campos numéricos `start` e `end` não são copiados como propriedades genéricas. Portanto, o suplemento não exige sua presença, não os fabrica e verifica sua coerência quando existem. Fonte: [cloneNode.ts no commit de 7.29.7](https://github.com/babel/babel/blob/4fba7541180bf5f58256d8e358b544e3831ad090/packages/babel-types/src/clone/cloneNode.ts).

Essas versões são diferentes por motivo concreto: o [lockfile do candidato](https://github.com/gustavomhss/Orchestra-SF/blob/3ef84da65d6b8ad7cd3250412bbcabdf90924172/bun.lock) fixa o core aninhado de `@opentui/solid` em 7.28.0 e resolve parser/generator/types em 7.29.7. O suplemento resolve essas três dependências a partir do módulo efetivo de `@babel/core` e exige suas versões, o mesmo lockfile, o mesmo plugin e o mesmo transformador do harness existente.

Ler `loc.end` de um nó encontrado apenas pelo nome ou pela coordenada esperada repetiria a seleção que se deseja demonstrar. O benefício adicional só existe com uma ligação estrutural verificável ao token específico do intermediário.

## Ligação proposta e implementada

O script separado `g09-solid-origin.mjs` consome o recibo de recuperação do mesmo workflow, run, tentativa e job. Revalida ELF, ledger, lockfile, fixture e os três arquivos de fonte/intermediário envolvidos. Continua usando os cinco IDs exatos; não altera o conjunto de 33 IDs do harness original.

Para cada arquivo:

1. Executa a mesma transformação Babel, agora com `ast: true`. O código retornado precisa ser byte-idêntico ao intermediário cujo hash já coincide com o artefato original. O mapa retornado também precisa ter exatamente o hash do mapa suplementar existente.
2. Reparseia esse intermediário. Compara a árvore inteira com a árvore transformada por uma projeção de todos os campos declarados em `@babel/types.NODE_FIELDS`, aplicando os defaults declarados pelo schema e somente as compatibilidades de representação descritas abaixo. Tipos, nomes, operadores, flags semânticos, valores, ordem de arrays e campos estruturais permanecem na comparação. Valores numéricos distinguem `-0` de `0`.
3. Omite apenas posições, comentários, tokens de parser, metadados de formatação explicitamente enumerados e `_blockHoist` depois de comparar a ordem final dos statements. **Rejeita, antes da projeção, qualquer Identifier parenthesized que seja o lado esquerdo de AssignmentExpression ou AssignmentPattern.** Esse subconjunto exclui parênteses de lvalue capazes de alterar inferência de nome; conserva a comparação de parênteses comuns em rvalues. Campos de nó, tipos de nó ou campos `extra` desconhecidos rejeitam a comparação. Dados como `TemplateElement.value.raw` continuam semânticos e são comparados. Diretivas com `extra.expressionValue` ainda não auditado rejeitam, em vez de terem esse metadado descartado.
4. Localiza no AST reparseado o Identifier cujo intervalo exato já é conhecido pelo início Bun, pelos bytes e pelo parser do intermediário. Segue o mesmo caminho de campos e índices na árvore transformada integralmente equivalente. Não procura outro nó com nome semelhante.
5. Exige que `loc.start` e `loc.end` desse nó correspondam ao intervalo completo do token AST da fonte original. Confere o texto bruto, as coordenadas UTF-16, o filename quando fornecido, os índices de `loc` quando fornecidos e `start`/`end` quando fornecidos. Nenhuma posição do mapa é inferida.

Uma propriedade shorthand pode ter dois caminhos AST, `key` e `value`, para um único token impresso. O gerador imprime a chave e retorna sem repetir o valor quando ambos são identificadores iguais: [generators/types.ts](https://github.com/babel/babel/blob/4fba7541180bf5f58256d8e358b544e3831ad090/packages/babel-generator/src/generators/types.ts). O suplemento exige que **todos** os caminhos correspondentes indiquem o mesmo intervalo completo de origem. Uma origem divergente ou ausente rejeita o token.

A rejeição dos lvalues parenthesized tem fundamento concreto: o gerador fixado distingue `(fn) = function () {}` de `fn = function () {}` por inferência de nome, mesmo com os demais campos estruturais iguais. Fonte: [função Identifier em node/parentheses.ts](https://github.com/babel/babel/blob/4fba7541180bf5f58256d8e358b544e3831ad090/packages/babel-generator/src/node/parentheses.ts). A rejeição abrange todo AssignmentExpression/AssignmentPattern com esse lvalue; não depende de reconhecer apenas um tipo de RHS. Já `_blockHoist` é aplicado durante a transformação, antes do AST retornado e da geração; a ordem resultante não é descartada: [block-hoist-plugin.ts](https://github.com/babel/babel/blob/ccc5fae96f5281ae1ee49fac74c7c275b9111ead/packages/babel-core/src/transformation/block-hoist-plugin.ts).

## Compatibilidade estrita entre parser e schema de types

O run [44965863026, job 137034614585](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44965863026/job/137034614585) bloqueou os cinco IDs antes da comparação de árvores, com `G09_ORIGIN_UNREVIEWED_EXTRA: topLevelAwait`; os dez controles daquela versão também rejeitaram por esse campo. O recibo tem SHA-256 `df6c5d5efffd598ac6f9c4c620c33787ea627bf97ed883351bd3023d8aa611a0`. Isso demonstrou uma lacuna da projeção, sem produzir atribuição aceita.

A auditoria das fontes fixadas do parser e de `NODE_FIELDS` identificou campos reais adicionais que aparecem fora desse schema. A adaptação é por tipo, sem um descarte genérico de campos desconhecidos:

| Campo | Regra exata |
|---|---|
| `Program.extra.topLevelAwait` | Obrigatório como booleano em um Program de módulo e incluído na projeção semântica. Não se assume `false` quando ausente. Em outro nó ou Program de script, sua presença rejeita. `true` e `false` divergem. |
| `ObjectProperty.method` | Se presente, deve ser exatamente `false`; a forma ausente de um builder equivale somente a esse valor. O valor canônico é mantido na projeção. |
| `ObjectMethod.method` | Se presente, deve ser exatamente `true` para `kind: method`, ou `false` para `kind: get/set`. Ausência equivale somente ao valor determinado pelo tipo/kind que continuam integralmente comparados. Contradição, string ou `null` rejeitam. |
| `ObjectProperty.extra.shorthand` | Só é aceito como `true` quando o campo semântico `shorthand` do próprio ObjectProperty também é `true`. Esse campo semântico permanece na comparação. Presença falsa, outro tipo de valor ou outro contexto rejeitam. |
| `ArrowFunctionExpression.id` e `ObjectMethod.id` | O parser inicializa `null`; builders podem omitir. Somente ausência ou `null` são aceitos e projetados como `null`; qualquer identificador nomeado rejeita. |

Fundamentos: [parseProgram em statement.ts](https://github.com/babel/babel/blob/4fba7541180bf5f58256d8e358b544e3831ad090/packages/babel-parser/src/parser/statement.ts) registra o booleano de top-level await para módulos. [expression.ts](https://github.com/babel/babel/blob/4fba7541180bf5f58256d8e358b544e3831ad090/packages/babel-parser/src/parser/expression.ts) inicializa `method: false`, altera para `true` no ramo de método comum, acrescenta `extra.shorthand` no modo Babel 7 e inicializa `id: null` em funções/métodos. [definitions/core.ts](https://github.com/babel/babel/blob/4fba7541180bf5f58256d8e358b544e3831ad090/packages/babel-types/src/definitions/core.ts) mostra quais desses campos não pertencem a NODE_FIELDS. `cloneNode` copia os campos declarados, explicando representações com ausência desses marcadores em nós gerados ou clonados.

As três fontes reais contêm ObjectMethods comuns ou getters gerados por Solid; o suporte não foi limitado ao primeiro erro para deixar incompatibilidades já conhecidas para outra execução. Nenhuma regra nova foi adicionada para igualar árvores que realmente diferem. Campos como `importKind`, `exportKind`, operadores, tipos e ordem permanecem sujeitos à comparação estrita; diretivas com `extra.expressionValue` e quaisquer campos não auditados ainda rejeitam.

## Por que é evidência adicional, e qual é seu limite

O recibo existente demonstra limites lexicais por três parses e inícios mapeados. O suplemento acrescenta a declaração de origem do nó **pós-transformação**, ligada ao token do intermediário por igualdade estrutural integral. Isso evita selecionar um `loc` conveniente apenas porque seu nome ou início corresponde ao esperado.

Ainda é evidência produzida pelo mesmo transformador e pelo mesmo parser. Não é validação por outro compilador, prova de execução de ramo TUI ou substituto automático para uma obrigação que exige um endpoint de mapa. `loc` é metadado do transformador; a aceitação dessa nova regra de atribuição cabe à revisão de QA.

Os mapas Babel continuam tendo 28 endpoints exatos e cinco não exatos, salvo observação diferente explicitamente registrada por um novo run. O mapa Bun não ganha nenhum ponto. `endOfBunSpan` permanece `not-proven`, `tuiExecution` permanece `not-observed`, `formalG09Pass` permanece `false`, e a etapa existente continua exigindo 33 endpoints Babel exatos. O novo recibo só pode emitir candidatos de origem para revisão.

## Controles e integração

Os quinze controles separados cobrem: mudança de operador; ordem de argumentos; nome e tipo de nó; acesso computed versus não computed; conteúdo raw de template; parênteses em inferência de nome de função/classe/arrow; fronteira de optional chain; campos desconhecidos e diretivas não auditadas; concordância de origem em shorthand; uma origem shorthand divergente; origem ausente e intervalo parcial; booleano/tipo/contexto/ausência de topLevelAwait; os marcadores method/id/shorthand por tipo; e a precisão do diagnóstico de divergência. A comparação de código/mapa é requisito do processamento real, não apenas de um teste sintético.

Se as projeções completas divergirem, o erro inclui o primeiro caminho estrutural diferente e os dois valores, além dos hashes. As duas projeções canônicas completas são preservadas em `semantic-differences/`, com hashes no recibo. Esse material explica a rejeição e permite examinar outras diferenças no mesmo artefato; não constitui uma exceção à igualdade.

Com as dependências fixadas do candidato já instaladas, no runner:

```bash
cd "$RUNNER_TEMP"
bun test "$G09_HARNESS/.github/ci/g09-solid-origin.test.mjs"
bun "$G09_HARNESS/.github/ci/g09-solid-origin.mjs" \
  "$SF_G09_SOURCE_DIR" "$RUNNER_TEMP/g09-input" \
  "$RUNNER_TEMP/g09-out/solid" "$RUNNER_TEMP/g09-out/solid-origin"
```

O suplemento pode ser executado depois da falha esperada de `g09-recover-solid.mjs`, desde que o recibo do mesmo job já comprove os oito intermediários e os 33 tokens. Se as árvores divergirem, houver metadados não revisados ou uma origem não for inequívoca, o resultado permanece bloqueado. Nenhum teste, parser de produto, transformação ou binário foi executado localmente para produzir esta implementação.
