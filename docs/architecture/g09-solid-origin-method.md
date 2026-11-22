# Suplemento de origem AST dos cinco tokens Solid

## O que a opção `ast: true` realmente fornece

No Babel core 7.28.0, a transformação executa os plugins, gera o código e retorna `file.ast` quando `opts.ast === true`. O retorno não associa automaticamente cada nó às coordenadas do código gerado. Fonte: [transformation/index.ts no commit de 7.28.0](https://github.com/babel/babel/blob/ccc5fae96f5281ae1ee49fac74c7c275b9111ead/packages/babel-core/src/transformation/index.ts).

Metadados de origem podem sobreviver à transformação. No `cloneNode` de `@babel/types` 7.29.7, `loc` é preservado por padrão, mas os campos numéricos `start` e `end` não são copiados como propriedades genéricas. Portanto, o suplemento não exige sua presença, não os fabrica e verifica sua coerência quando existem. Fonte: [cloneNode.ts no commit de 7.29.7](https://github.com/babel/babel/blob/4fba7541180bf5f58256d8e358b544e3831ad090/packages/babel-types/src/clone/cloneNode.ts).

Essas versões são diferentes por motivo concreto: o [lockfile do candidato](https://github.com/gustavomhss/Orchestra-SF/blob/3ef84da65d6b8ad7cd3250412bbcabdf90924172/bun.lock) fixa o core aninhado de `@opentui/solid` em 7.28.0 e resolve generator/types em 7.29.7. O suplemento exige essas versões, o mesmo lockfile, o mesmo plugin e o mesmo transformador do harness existente.

Ler `loc.end` de um nó encontrado apenas pelo nome ou pela coordenada esperada repetiria a seleção que se deseja demonstrar. O benefício adicional só existe com uma ligação estrutural verificável ao token específico do intermediário.

## Ligação proposta e implementada

O script separado `g09-solid-origin.mjs` consome o recibo de recuperação do mesmo workflow, run, tentativa e job. Revalida ELF, ledger, lockfile, fixture e os três arquivos de fonte/intermediário envolvidos. Continua usando os cinco IDs exatos; não altera o conjunto de 33 IDs do harness original.

Para cada arquivo:

1. Executa a mesma transformação Babel, agora com `ast: true`. O código retornado precisa ser byte-idêntico ao intermediário cujo hash já coincide com o artefato original. O mapa retornado também precisa ter exatamente o hash do mapa suplementar existente.
2. Reparseia esse intermediário. Compara a árvore inteira com a árvore transformada por uma projeção de todos os campos declarados em `@babel/types.NODE_FIELDS`, aplicando somente os defaults declarados pelo schema. Tipos, nomes, operadores, flags semânticos, valores, ordem de arrays e campos estruturais permanecem na comparação. Valores numéricos distinguem `-0` de `0`.
3. Omite apenas posições, comentários, tokens de parser, metadados de formatação explicitamente enumerados e `_blockHoist` depois de comparar a ordem final dos statements. **Rejeita, antes da projeção, qualquer Identifier parenthesized que seja o lado esquerdo de AssignmentExpression ou AssignmentPattern.** Esse subconjunto exclui parênteses de lvalue capazes de alterar inferência de nome; conserva a comparação de parênteses comuns em rvalues. Campos de nó, tipos de nó ou campos `extra` desconhecidos rejeitam a comparação. Dados como `TemplateElement.value.raw` continuam semânticos e são comparados. Diretivas com `extra.expressionValue` ainda não auditado rejeitam, em vez de terem esse metadado descartado.
4. Localiza no AST reparseado o Identifier cujo intervalo exato já é conhecido pelo início Bun, pelos bytes e pelo parser do intermediário. Segue o mesmo caminho de campos e índices na árvore transformada integralmente equivalente. Não procura outro nó com nome semelhante.
5. Exige que `loc.start` e `loc.end` desse nó correspondam ao intervalo completo do token AST da fonte original. Confere o texto bruto, as coordenadas UTF-16, o filename quando fornecido, os índices de `loc` quando fornecidos e `start`/`end` quando fornecidos. Nenhuma posição do mapa é inferida.

Uma propriedade shorthand pode ter dois caminhos AST, `key` e `value`, para um único token impresso. O gerador imprime a chave e retorna sem repetir o valor quando ambos são identificadores iguais: [generators/types.ts](https://github.com/babel/babel/blob/4fba7541180bf5f58256d8e358b544e3831ad090/packages/babel-generator/src/generators/types.ts). O suplemento exige que **todos** os caminhos correspondentes indiquem o mesmo intervalo completo de origem. Uma origem divergente ou ausente rejeita o token.

A rejeição dos lvalues parenthesized tem fundamento concreto: o gerador fixado distingue `(fn) = function () {}` de `fn = function () {}` por inferência de nome, mesmo com os demais campos estruturais iguais. Fonte: [função Identifier em node/parentheses.ts](https://github.com/babel/babel/blob/4fba7541180bf5f58256d8e358b544e3831ad090/packages/babel-generator/src/node/parentheses.ts). A rejeição abrange todo AssignmentExpression/AssignmentPattern com esse lvalue; não depende de reconhecer apenas um tipo de RHS. Já `_blockHoist` é aplicado durante a transformação, antes do AST retornado e da geração; a ordem resultante não é descartada: [block-hoist-plugin.ts](https://github.com/babel/babel/blob/ccc5fae96f5281ae1ee49fac74c7c275b9111ead/packages/babel-core/src/transformation/block-hoist-plugin.ts).

## Por que é evidência adicional, e qual é seu limite

O recibo existente demonstra limites lexicais por três parses e inícios mapeados. O suplemento acrescenta a declaração de origem do nó **pós-transformação**, ligada ao token do intermediário por igualdade estrutural integral. Isso evita selecionar um `loc` conveniente apenas porque seu nome ou início corresponde ao esperado.

Ainda é evidência produzida pelo mesmo transformador e pelo mesmo parser. Não é validação por outro compilador, prova de execução de ramo TUI ou substituto automático para uma obrigação que exige um endpoint de mapa. `loc` é metadado do transformador; a aceitação dessa nova regra de atribuição cabe à revisão de QA.

Os mapas Babel continuam tendo 28 endpoints exatos e cinco não exatos, salvo observação diferente explicitamente registrada por um novo run. O mapa Bun não ganha nenhum ponto. `endOfBunSpan` permanece `not-proven`, `tuiExecution` permanece `not-observed`, `formalG09Pass` permanece `false`, e a etapa existente continua exigindo 33 endpoints Babel exatos. O novo recibo só pode emitir candidatos de origem para revisão.

## Controles e integração

Os controles separados cobrem: mudança de operador; ordem de argumentos; nome e tipo de nó; acesso computed versus não computed; conteúdo raw de template; parênteses em inferência de nome de função/classe/arrow; fronteira de optional chain; campos desconhecidos e diretivas não auditadas; concordância de origem em shorthand; uma origem shorthand divergente; origem ausente e intervalo parcial. A comparação de código/mapa é requisito do processamento real, não apenas de um teste sintético.

Com as dependências fixadas do candidato já instaladas, no runner:

```bash
cd "$RUNNER_TEMP"
bun test "$G09_HARNESS/.github/ci/g09-solid-origin.test.mjs"
bun "$G09_HARNESS/.github/ci/g09-solid-origin.mjs" \
  "$SF_G09_SOURCE_DIR" "$RUNNER_TEMP/g09-input" \
  "$RUNNER_TEMP/g09-out/solid" "$RUNNER_TEMP/g09-out/solid-origin"
```

O suplemento pode ser executado depois da falha esperada de `g09-recover-solid.mjs`, desde que o recibo do mesmo job já comprove os oito intermediários e os 33 tokens. Se as árvores divergirem, houver metadados não revisados ou uma origem não for inequívoca, o resultado permanece bloqueado. Nenhum teste, parser de produto, transformação ou binário foi executado localmente para produzir esta implementação.
