# Revisão financeira independente — W3

**Candidato:** `66bbe152c145f04c16223a938589c63cedb3b716`  
**Tree:** `f727ae5bfcef26383ff47a2b06bb65b161295dd2`  
**PR:** 35, branch `astra-finance`, base `sf2-stack`  
**Planejamento:** `dbf9547211d9b0fade619790de7c19c0869b7c7d`  
**Campaign SHA-256 conferido:** `703dd257274bed829a978705de548cd1383225bf7aac76445104c053e2bb5fba`

Revisor independente, não autor. Revisão estática e somente leitura do produto. Há **um blocker próprio de correctness financeiro** e **duas lacunas de prova discriminante**. Este parecer não atribui READY/DONE nem decisão C/D global.

## F1 — Alta / blocker próprio WP03

**Arquivo:** `modules/sucafina/Sucafinav1/product/planner/scenario-port.ts`, linhas 86–105, especialmente 92–93.

O resultado da simulação conserva `amount: null` sempre que o componente anterior era nulo. Isso ignora um forecast explícito que o comando real acabou de calcular. O valor fornecido desaparece do subtotal conhecido, embora o resultado continue corretamente marcado como condicionado.

**Contraprova estática precisa:** ator Finance, versão 2027 com `closed=9`, linha OPEX USD existente `missing`, `b=Array(12).fill(null)`, `a=[]`, `f=[]`; outra contribuição conhecida vale 2000. Com fonte atual e cobertura pending válida, simular `replace missing:11 amount=1000 currency=USD`.

1. `planner/port.ts:152–174` qualifica a célula original como `null/absent`.
2. `planner/scenario.ts:19–24,42–54` aceita a linha existente, o mês aberto e o valor finito e chama o `domain.execute` real com `f10=1000`.
3. `runtime/planner.ts:706–712,757–799` grava o forecast na cópia. `runtime/planner.ts:262–271` e `src/planner-accounts.ts:57–61` produzem `outlook[10]=1000`.
4. `scenario-port.ts:92` descarta esse valor porque `component.amount` anterior era nulo. A linha 93 mantém `absent`; a linha 105 retorna subtotal 2000, quando deveria ser 3000, com a parcela 1000 marcada como hipotética.

`include` na mesma célula existente e vazia tem o mesmo problema. Também ocorre com HR sem rate quando um forecast independente resolve o outlook: `headcount-months.ts:49–54` separa explicitamente AF e rate do budget; `port-hr.test.ts:33–39` documenta essa semântica existente. Não depende de criar nova linha: `scenario.ts:19–20` exige alvo já existente.

**Critérios afetados:** WP03.T01.CHK.02, WP03.T01.INV.01, WP03.T01.QLT.01, WP11.T02.QLT.01 e a definição C10 de subtotal dos componentes quantificados pelo motor.

**Correção delimitada:** qualificar a cópia pós-comando com `projectPlannerSource` e `buildPlannerFinancialProjection`, aproveitando o qualificador canônico para as células afetadas. Manter `hypothetical`, `total=null` e `conditioned`. Preservar ausência intocada e FX ainda não resolvido. Remover apenas o guard de nulo seria incorreto porque o cálculo legado retorna zero quando falta FX.

**Regressões necessárias em Actions:** replace/include em USD ausente; zero hipotético explícito; célula ausente intocada; moeda sem FX; HR sem rate com forecast explícito; snapshot/request originais imutáveis e replay idêntico.

## G1 — Lacuna de prova do fallback IEEE

`planner/exact-threshold.ts:35–79` mantém ordenação por bits, busca binária e testemunhas adjacentes. Não há contraprova de defeito no algoritmo. Porém os testes compostos inspecionados limitam chamadas a 18 e exercitam a vizinhança curta do anchor; não foi localizada uma fixture discriminante que obrigue o fallback longo das linhas 67–73.

**Prova sugerida pelo domínio real:** componentes ordenados `[2**53, x]`, baseline `2**53`, `x` entre 0 e 16, critério diferença `<= 0`. O anchor é 0, exigindo bisseção; o maior valor que satisfaz é 1 e `nextUp(1)` deve falhar. A igualdade de fonte/request e a adjacência devem continuar verificadas. Isto é uma lacuna de prova, não um segundo defeito inferido.

## G2 — Lacuna do oráculo implantação 70000

O requisito WP11.T02.CHK.01 exige fonte confirmada de implantação 70000, total 235000 e vantagem 5000. Nos testes `wp03`, `wp05` e `wp11` pesquisados, 70000 aparece como bound de sensibilidade; não foi localizado assert específico de 235000/5000 nem testemunho da revisão da cotação com os mesmos subescopos.

A soma canônica é coerente estaticamente, mas testar o endpoint do solver não demonstra esse oráculo. A prova precisa atualizar a fonte 45000→70000 preservando categorias compartilhadas e N/A suportadas, obter observação completa de 235000, demonstrar falha da vantagem mínima e conservar a ChoiceRecord e a fonte originais.

## O que a inspeção sustenta

- Observação sem operações/premissas é separada de hipótese; a completude exige cobertura atual. Operação explícita, mesmo sem alteração numérica, continua hipotética.
- A execução de cenário chama o Planner real sobre cópia. A classificação de cobertura não soma linhas: a mesma parcela pode sustentar várias categorias, sem duplicar contribuição; IDs duplicados e N/A sem suporte possuem recusas.
- A derivação de parâmetro de uma fonte é separada em `parameterOperation`; não reescreve o request persistido. O digest vincula request/result anteriores, fontes, unidades, regra e revisões.
- O solver conserva as operações fixas e usa o preview canônico; não foi encontrada fórmula concorrente nos consumidores analytics inspecionados.
- A reprodução C17 confronta o request persistido e seu digest e reproduz a simulação original.
- Há asserts com produtores reais para 210000→250000, vantagem 30000→−10000, treinamento zero/nulo/omitido e preservação da escolha histórica. A revisão leu esses testes; não os executou nem afirma que passaram.

## Escopo e limites

Foram lidos AGENTS e regras de execução pertinentes; os três packs JSON foram carregados, com leitura dos WPs canônicos, critérios financeiros, contratos C01–C14 e oráculos numéricos. A lista exata de módulos e testes inspecionados está no JSON acompanhante. O trabalho se concentrou em `product/planner`, cobertura/classificação/intervalos de decisões e consumidores de cenário do analytics, seguindo os cálculos pertinentes de runtime e `planner-accounts.ts`.

A conferência independente de 37 paths publicados contra hashes Git blob não encontrou divergências; o hash de `campaign.json` coincide. A afirmação de 724 blobs existentes conferidos é proveniência do manifesto fornecido, não uma segunda medição deste revisor.

Não foram executados produto, testes locais, typecheck ou novo CI. Não foi feita aceitação integral dos 303 critérios, dos anexos residentes completos, nem do host/artifact store/UI. Os limites de composição são distintos do F1, que pertence ao próprio Planner.

O parent informou W3 typecheck run `43579943285` com 132 diagnósticos: 131 externos e um próprio em `cost-coverage.ts:77` (union.includes/string→never), já em correção; guards 78/759, 13 warnings, zero errors. Esse dado não foi recuperado independentemente e não equivale a um gate verde. O relatório é fixado exclusivamente em W3; a correção e os novos testes requerem addendum.
