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
2. Reparseia esse intermediário. Compara a árvore inteira com a árvore transformada pela projeção documentada `g09-solid-origin-projection-v2`: todos os campos declarados em `@babel/types.NODE_FIELDS`, os defaults declarados pelo schema e somente as compatibilidades e cinco equivalências contextuais descritas abaixo. Tipos, nomes, operadores, flags semânticos, valores, ordem de arrays e campos estruturais permanecem na comparação. Valores numéricos distinguem `-0` de `0`. Essa comparação não afirma identidade literal dos ASTs brutos.
3. Omite apenas posições, comentários, tokens de parser, metadados de formatação explicitamente enumerados e `_blockHoist` depois de comparar a ordem final dos statements. **Rejeita, antes da projeção, qualquer Identifier parenthesized que seja o lado esquerdo de AssignmentExpression ou AssignmentPattern.** Esse subconjunto exclui parênteses de lvalue capazes de alterar inferência de nome; conserva a comparação de parênteses comuns em rvalues. Campos de nó, tipos de nó ou campos `extra` desconhecidos rejeitam a comparação. Dados como `TemplateElement.value.raw` continuam semânticos e são comparados. Diretivas com `extra.expressionValue` ainda não auditado rejeitam, em vez de terem esse metadado descartado.
4. Localiza no AST reparseado o Identifier cujo intervalo exato já é conhecido pelo início Bun, pelos bytes e pelo parser do intermediário. Segue o mesmo caminho de campos e índices na árvore transformada somente depois da igualdade integral das projeções documentadas. Não procura outro nó com nome semelhante.
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

As três fontes reais contêm ObjectMethods comuns ou getters gerados por Solid; o suporte inclui esses casos comprovados pelas fontes. Operadores, tipos, ordem e todos os campos fora das cinco equivalências contextuais da seção seguinte permanecem sujeitos à comparação estrita. Diretivas com `extra.expressionValue` e quaisquer campos não auditados ainda rejeitam.

## Run 5: enumeração completa e cinco equivalências delimitadas

O [run 44967045960, job 137038306798](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44967045960/job/137038306798), head `f8cdd10626428f5c3ba8b1ea2cfd47dbceb1c71a`, aprovou os 15 controles daquela versão, com 43 asserções. A aplicação real permaneceu bloqueada em zero de três árvores e zero de cinco origens. O recibo tem SHA-256 `d3e05e373fa3f155b6d8f92e0cd678274e1715d21c2a99c9a0d6c3547e1ad341`; o ZIP do artefato `14732365657`, SHA-256 `b160afe2413ffc18ea3b836237b3b191f4c33cd187acb250a08c1297507138bd`.

Uma comparação estática de todas as projeções preservadas encontrou **101 diferenças em cinco grupos**. Verificou o hash do recibo, hashes/tamanhos dos três arquivos de projeção e os seis hashes canônicos internos. Manteve os mesmos caminhos e índices, sem executar parser ou produto e sem normalizar o material de entrada. Há 4.438 pares de nós do mesmo tipo, incluindo 1.890 pares de Identifier no mesmo caminho; não há diferença de tipo de nó, tamanho de array, conjunto/ordem de campos ou nome de Identifier.

| Tipo e campo | Transformado → reparseado | Data | Dialog | Move | Total |
|---|---|---:|---:|---:|---:|
| `ImportDeclaration.importKind` | `"value"` → `null` | 6 | 19 | 12 | 37 |
| `ImportSpecifier.importKind` | `"value"` → `null` | 9 | 22 | 14 | 45 |
| `ExportNamedDeclaration.exportKind` | `"value"` → `null` | 1 | 1 | 1 | 3 |
| `ImportDeclaration.attributes` | `null` → `[]` | 0 | 9 | 2 | 11 |
| `TemplateElement.tail` | `false` → `true` | 0 | 5 | 0 | 5 |
| **Total** | | **16** | **56** | **29** | **101** |

Os cinco casos de `tail` pertencem a `dialog-move-session.tsx`. Cada um é o único quasi, no índice zero, de um TemplateLiteral com zero expressões; raw/cooked são idênticos dos dois lados. Os textos são `Press `, ` again to confirm`, `Deleting `, `Move session` e `Could not load project directories`.

A enumeração reprodutível foi preservada em `inspect-solid-semantic-differences.py` (SHA-256 `7e361862e3f11ab0d4e25d84d2204d8252067fca7ef90d6d665e5f3adf562468`) e `solid-semantic-differences.json` (SHA-256 `7f464ed89837d19aa741f6a5ca0e8cb56434e7baf34d6ad3df42676e1653c7e1`). O JSON contém cada caminho e ambos os valores tipados. A revisão das fontes fixadas sustenta somente estas cinco equivalências adicionais:

| Tipo/campo/contexto | Projeção v2 | Diferenças que continuam preservadas ou rejeitadas |
|---|---|---|
| `ImportDeclaration.importKind` | `null` e `"value"` projetam `"value"`. Ausência passa pelo default `null` do schema. | `"type"` e `"typeof"` permanecem distintos; valores fora desse conjunto rejeitam. |
| `ImportSpecifier.importKind` | Mesma equivalência limitada a este tipo. | Tipo de nó, nomes importados/locais e ordem dos specifiers continuam integrais; `"type"` e `"typeof"` não se tornam `"value"`. |
| `ExportNamedDeclaration.exportKind` | `null` e `"value"` projetam `"value"`. | `"type"` permanece distinto; outros valores rejeitam. A regra não se estende a ExportAllDeclaration ou ExportSpecifier. |
| `ImportDeclaration.attributes` | `null` e lista vazia projetam lista vazia. | Listas não vazias conservam conteúdo e ordem; valores não array rejeitam. Assertions, phase/module e atributos de outros tipos não são normalizados por esta regra. |
| `TemplateElement.tail`, exclusivamente quando é o único quasi de TemplateLiteral com zero expressões | Booleanos explícitos `false` e `true` projetam `true`; exige aridade 1/0, campo `quasis` e identidade do único nó nesse campo. | Raw/cooked e todos os demais campos permanecem integrais. Tail não booleano ou ausente rejeita. Tail de nó órfão ou template interpolado é comparado exatamente; aridade inválida rejeita. |

Nenhuma regra move, remove ou reordena nós. A projeção é construída em valores novos, sem modificar os ASTs que fornecem `loc`. A associação continua exigindo igualdade integral da projeção inteira e o mesmo caminho de cada Identifier. O run 5 parou antes de inspecionar a origem dos cinco tokens; seus `loc` não constam das projeções preservadas. Portanto, esses dados não antecipam se a nova execução produzirá cinco origens completas.

### Fundamentos fixados das equivalências

Todos os links abaixo apontam ao commit Babel `4fba7541180bf5f58256d8e358b544e3831ad090` da versão 7.29.7:

- O [parser TypeScript](https://github.com/babel/babel/blob/4fba7541180bf5f58256d8e358b544e3831ad090/packages/babel-parser/src/plugins/typescript/index.ts), blob `f55b65f8dac4a6cee913909a041a21e4920f4fb4`, grava `"value"` em importações/exportações comuns e ImportSpecifier. O [gerador de módulos](https://github.com/babel/babel/blob/4fba7541180bf5f58256d8e358b544e3831ad090/packages/babel-generator/src/generators/modules.ts), blob `7cfe462c52c749c083d77cf9c132eda2597b8b8a`, distingue `type`/`typeof` das importações comuns e `type` das exportações comuns; `"value"` e ausência percorrem a mesma emissão.
- [maybeParseImportAttributes em statement.ts](https://github.com/babel/babel/blob/4fba7541180bf5f58256d8e358b544e3831ad090/packages/babel-parser/src/parser/statement.ts), blob `89a80e554e0e9148febcbd244fd9b7e33b8f409f`, atribui lista vazia sem cláusula. O gerador de módulos só imprime atributos quando a lista tem elementos. [definitions/core.ts](https://github.com/babel/babel/blob/4fba7541180bf5f58256d8e358b544e3831ad090/packages/babel-types/src/definitions/core.ts), blob `836cc3607999d9783ed01a764d8c786a01f301c4`, declara esses campos opcionais; [definitions/utils.ts](https://github.com/babel/babel/blob/4fba7541180bf5f58256d8e358b544e3831ad090/packages/babel-types/src/definitions/utils.ts), blob `feadf51e229493f1eaab2954abf5ced64a1627f5`, estabelece seu default `null`.
- O [builder templateElement](https://github.com/babel/babel/blob/4fba7541180bf5f58256d8e358b544e3831ad090/packages/babel-types/src/builders/generated/lowercase.ts), blob `aa68ce95e0aed73116c14c2feb3d2051884c3916`, tem default `tail = false`. O [gerador de templates](https://github.com/babel/babel/blob/4fba7541180bf5f58256d8e358b544e3831ad090/packages/babel-generator/src/generators/template-literals.ts), blob `08961645b4daa968798dd63c802490b53d29a219`, imprime quasis/expressões pelos índices e pelo texto raw; não lê `tail`. A regra adotada continua restrita aos cinco contextos singleton observados, sem extrapolar para templates interpolados ou elementos isolados.

A fonte de release do plugin explica chamadas de builder sem `tail`; o tarball npm/SRI não foi verificado separadamente nesta revisão. Essa explicação não é prova de identidade entre o checkout de release e os bytes do pacote instalado. A equivalência acima se sustenta nos dados efetivamente preservados e no gerador Babel fixado.

O próprio recibo identifica a comparação como `g09-solid-origin-projection-v2`, enumera os tipos/campos/contextos em `semanticProjection.equivalences` e registra fontes e hashes da revisão em `semanticProjection.sourceReview`. A contagem passa a se chamar `equalProjectedTrees`; `literalAstIdentityClaimed` é `false`. O campo antigo `omittedMetadataOnly` não é emitido: além das omissões explícitas, existem agora essas canonicalizações de representação documentadas.

## Por que é evidência adicional, e qual é seu limite

O recibo existente demonstra limites lexicais por três parses e inícios mapeados. O suplemento acrescenta a declaração de origem do nó **pós-transformação**, ligada ao token do intermediário pela igualdade integral da projeção semântica documentada e pelo caminho estrutural exato. Isso evita selecionar um `loc` conveniente apenas porque seu nome ou início corresponde ao esperado.

Ainda é evidência produzida pelo mesmo transformador e pelo mesmo parser. Não é validação por outro compilador, prova de execução de ramo TUI ou substituto automático para uma obrigação que exige um endpoint de mapa. `loc` é metadado do transformador; a aceitação dessa nova regra de atribuição cabe à revisão de QA.

Os mapas Babel continuam tendo 28 endpoints exatos e cinco não exatos, salvo observação diferente explicitamente registrada por um novo run. O mapa Bun não ganha nenhum ponto. `endOfBunSpan` permanece `not-proven`, `tuiExecution` permanece `not-observed`, `formalG09Pass` permanece `false`, e a etapa existente continua exigindo 33 endpoints Babel exatos. O novo recibo só pode emitir candidatos de origem para revisão.

## Controles e integração

Os 21 controles separados preservam os 15 casos anteriores: mudança de operador; ordem de argumentos; nome e tipo de nó; acesso computed versus não computed; conteúdo raw de template; parênteses em inferência de nome de função/classe/arrow; fronteira de optional chain; campos desconhecidos e diretivas não auditadas; concordância de origem em shorthand; uma origem shorthand divergente; origem ausente e intervalo parcial; booleano/tipo/contexto/ausência de topLevelAwait; os marcadores method/id/shorthand por tipo; e precisão do diagnóstico de divergência. Os seis controles novos abrangem os positivos das cinco equivalências e negativos para `type`/`typeof`, valores inválidos, tipos/campos fora do escopo, atributos não vazios, mudanças de source/alias/ordem, raw/cooked divergentes, tail ausente/não booleano, templates interpolados, nó órfão e aridade inválida. A comparação de código/mapa é requisito do processamento real, não apenas de um teste sintético.

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
