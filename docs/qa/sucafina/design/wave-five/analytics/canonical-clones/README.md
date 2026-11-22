# Canonicalização de clones nativos

**Verificação técnica: PASS nos oito gates selecionados. Jornada instalada: em andamento.** O [run 45048665481](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45048665481) testou o produto `d6bce5d81d0fd578a190b9bacac2a1a4250109a1` no snapshot `c18b97d8a316992b95abcbb57ef9b6c6754b1518`. A [receita técnica](technical-01/receipt.json) e a [verificação detalhada](technical-01/verification.json) preservam o resultado exato, sem logs brutos ou nonce.

| Gate | Resultado observado |
|---|---|
| Guardrails | 78 regras / 1.029 arquivos; zero erros e aprovações; 38 warnings discriminados no relatório |
| Tipos CLI, E2E e Sucafina | Três comandos concluídos com exit code zero |
| LocalStore / CurrentChoice / C17 / Finance | 54 pass, 2 skips preexistentes de UID, 0 fail, 990 assertions |
| Integridade UI | 7 pass, 0 fail, 100 assertions |
| Canonical original + clones | 15 pass, 0 fail, 301 assertions |
| Invocação Portfolio | 4 pass, 0 fail, 75 assertions |

O C17 retornou as sete fases, incluindo ciclo e revogação, em **95.715,75 ms**, dentro do prazo cooperativo original de 105.000 ms e do limite Bun de 120.000 ms. Finance concluiu em 44.994,67 ms. São observações de uma execução, sem afirmação de ganho causal ou margem estável. O controle Omni passou com oito testes declarados, dez spawns e zero delegated. O cleanup passou; o run não gerou artefatos nem executou um build web ou Playwright.

O produto seguinte, `9bb7eeff9ba5a5ed501514144b4fd629b46f5ee0`, apenas documenta dentro do catch por que uma falha do registro opcional conserva o clone já produzido. A inversão literal desse comentário/formatação recupera o helper testado. A mudança trata o único warning novo deste candidato; os outros 37 pertencem aos arquivos preexistentes da base. Um guard final do checkpoint documental ainda está pendente.

A jornada instalada original está no [run 45049647711](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45049647711), snapshot `cd68b7226780d58cca96e6a821071df3feb8517a`, produto `9bb7eeff…`. Os dois overlays são idênticos ao request e à primeira declaração completa da tentativa limpa anterior. Preservam preview de 60.000 ms, sensibilidade de 120.000 ms, fixtures, callbacks e workflow. Nenhum resultado instalado é antecipado neste checkpoint.

A [revisão independente de root](root-review.json) conferiu os 102 locators selecionados contra o log final, 39 payloads estruturados e os oito blobs de teste. O [registro estático de fonte](source-review.json) permanece como foi fechado antes da conclusão da CI; seu campo PENDING é histórico. Nenhuma qualificação de UI42–UI44, incremento de inventário, aceite visual ou merge é atribuído a esses gates.

## Revisão estática preservada

**Parecer estático: PASS no recorte descrito.** O texto abaixo preserva a revisão de fonte fechada antes da execução técnica; seus limites e premissas não equivalem a uma qualificação instalada.

O inventário de fontes, SHAs, premissas e limites está em [source-review.json](source-review.json).

## Candidato e composição

O candidato original [1bea7c4](https://github.com/gustavomhss/Orchestra-SF/commit/1bea7c484a6e46a12e515ad807bf31b0dc162ab8) contém quatro arquivos: o helper `canonical-clone.ts`, duas integrações pequenas em canonical/BCS e um arquivo com 13 testes. A revisão leu integralmente o helper e os testes. Remover as integrações recupera exatamente canonical `d52aca01250ccff4c3811cee95f8a341fa3335c8` e BCS `475988ccece7446332c7594da061a4f72318cebe`.

A composição [472633a](https://github.com/gustavomhss/Orchestra-SF/commit/472633abc5fc9113f9baa38cf55598a2aa3b1f8b) aplica os mesmos quatro blobs sobre `0a1247db9a16f9eead04788a76d25723672c7e6a`. Os dois arquivos originais nessa base são idênticos aos já revisados. O filho [d6bce5d](https://github.com/gustavomhss/Orchestra-SF/commit/d6bce5d81d0fd578a190b9bacac2a1a4250109a1) altera somente o helper do teste: duas linhas guardam/restauram `Array.prototype.length`, afetado pela instalação temporária do índice zero. Removê-las recupera integralmente o teste original; os 13 casos e suas assertions permanecem. O blob atual do teste é `cc29b57c10f0851827ecbefc66c5694890de199c`.

Essa conferência não representa revisão global das mudanças não relacionadas da base atual.

## O que sustenta a origem privada

O helper preserva o `map` original e uma chamada global de `structuredClone` por callback. A marca privada é emitida somente quando a chamada real e a alocação do array de resultado passam pelos intrinsics admitidos. Não existe API para registrar arbitrariamente um objeto fornecido pelo caller.

A prova nativa está restrita a **Bun 1.3.14, revisão `0d9b296af33f2b851fcbf4df3e9ec89751734ba4`**, com WebKit `5488984d20e0dbfe4be2c3ba8fb18eb81a5e0e8b`. Foram examinados o binding global, a entrada de clone, os caminhos normais/rápidos do serializer e os wrappers customizados. ObjectTag/ArrayTag produzem novas identidades e o pool do clone preserva aliases internos. Backings compartilhados de SAB/BlockList não tornam seus wrappers objetos ordinários admitidos. Os 30 arquivos de declarações de classes foram lidos com seus SHAs conferidos; Blob e BlockList são as duas declarações de clone customizado gerado encontradas.

O gate usa descriptors de dados próprios de Bun/version/revision. A cadeia nativa confirma que `Bun.revision` recebe o SHA integral; os campos curtos do banner são separados. As fontes pinned e seus trechos estão no JSON. A confiança nos intrinsics no carregamento é uma premissa explícita, não uma prova contra preload adulterado.

## Identidade de nascimento e dados atuais

A WeakSet privada guarda a identidade de nascimento. Cada canonicalização relê o grafo atual, começando pela consulta de origem antes de refletir sobre filhos. Exige dados próprios, protótipos admitidos, arrays densos, números finitos, ausência de ciclos e ambiente canônico preservado.

Mutações primitivas são lidas novamente. Filhos novos, proxies, accessors, wrappers reparentados, hooks ou valores não admitidos recusam a árvore. O fallback literal `JSON.stringify(canonical(value))` continua responsável pelo comportamento original, sem replay antecipado de getters ou traps opacos.

A WeakMap de memo existe somente durante uma caminhada e compartilha subárvores tagged de aliases. `JSON.stringify` nativo produz todos os bytes, incluindo escaping/Unicode; as distinções absent/null/-0 e a ordem de chaves são preservadas. O chain de hash continua literal: construção de CryptoHasher, lookup de update, canonicalização, chamada de update e lookup/chamada de digest. Callbacks, autorizações, providers e hashes de BCS não foram retirados.

## Limites e testes de fonte

A admissão limita 4.096 nós únicos, 32.768 propriedades, profundidade 64, 65.536 ocorrências expandidas e 4.194.304 unidades UTF-16 estimadas. O budget de expansão cobre aliases repetidos além da contagem de identidades. `ownKeys` produz a lista antes de comparar seu tamanho: esses limites não são um teto antecipado do custo/alocação nativa, do clone ou do fallback.

Os 13 casos exercitam bytes/SHA, clones independentes, aliases, mutação, getters/Proxy, arrays esparsos, constructor/species, hooks transitórios, setters herdados, hasher, valores não suportados e budgets. SAB/views comparam o outcome do clone nativo; falha do original exige comparação de erro, sem skip silencioso. Estes são achados da leitura das assertions; não são resultados de execução.

## Fronteira browser

O peer `/root/root_cost` examinou 282 fontes pinned em `e4cc03bb…`: 228 do capítulo Sucafina, 32 de schema e 22 de client. Não encontrou ligação runtime ao canonical de modules/Sucafinav1 no circuito entry → app → chapter-route → SfOwnerRuntime231 → client/schema. A ligação de `decision-create.ts` examinada é host, via `interface/http.ts`, que injeta strings em Response. Os locators e SHAs estão no JSON; esta revisão não repete a aquisição dos 282 arquivos.

O levantamento é limitado. `node:util` passa a ser dependência transitiva de canonical, e `types.isProxy` é lido antes do gate Bun. Um import browser incompatível não seria salvo pelo fallback. Não se afirma compatibilidade global ou build aprovado; a composição atual precisa dos gates instalados.

## Registro de CI no momento da revisão estática

O snapshot [c18b97d](https://github.com/gustavomhss/Orchestra-SF/commit/c18b97d8a316992b95abcbb57ef9b6c6754b1518), filho de `d6bce5d…`, pertence ao [run 45048665481](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45048665481). Este documento registra **PENDING**: na consulta de metadados, estava `in_progress`, sem conclusão. Nenhum log foi lido para produzir estes arquivos e nenhum resultado foi incorporado.

O custo do registro/preflight e o eventual efeito no preview ainda precisam ser medidos. Este arquivo não atualiza rollups, qualificação, aceite ou estado de merge.
