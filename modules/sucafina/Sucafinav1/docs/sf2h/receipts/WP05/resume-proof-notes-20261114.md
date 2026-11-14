# WP05 — origem e limites dos novos discriminantes

Este complemento documenta a origem dos valores exercitados na retomada. Os testes usam persistência, produtores e dispatchers reais em harnesses; as identidades, dados de entrada e callbacks do host são controlados pelos testes.

## Resultado das execuções

Produto `8f8a1a72dec4065c4cfb798d6d48ca13ca6d5760`. Na [seleção dirigida de três arquivos](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534686609), todos os sete casos passaram, incluindo finance, viewer e abertura do pedido mais antigo. Na [seleção completa de35 arquivos](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43535162840), foram114 PASS e3 FAIL: marco sem data do Dashboard, finance durante importação/renderização/transporte e preparação da página do approver. Os dois últimos falharam antes de completar seus asserts relevantes; a descrição dos discriminantes abaixo não transforma esses failures em sucesso composto. Os critérios T02.DOD.02 e T03.SUC.02 permanecem parciais.

## Capacidade e contribuições

A capacidade vem do port real do Planner. Os papéis finance e viewer leem a mesma projeção autorizada usada pelo renderer. Os registros de entrada contêm sentinelas de nome e remuneração, e os testes verificam sua ausência na projeção, no HTML e nas seleções. FTE permanece agregado; o custo HC que o produtor retira permanece indisponível. Aplicar fev–mar conserva o contexto autorizado original e acrescenta o período visual, com duas marcas de FTE e as linhas de custo ausente correspondentes. Este recorte não prova dois painéis numéricos filtrados nem autoriza inferir salário a partir de FTE.

A documentação e os testes anteriores de Top N/outros continuam válidos no seu escopo: o agrupamento e a parcialidade são fornecidos pela apresentação do produtor. O consumidor não cria uma agregação financeira paralela nem transforma contribuições parciais em um total reconciliado. O novo discriminante de waterfall usa a comparação real do Planner; uma contribuição explicitamente zero conserva geometria, tooltip e ambas as tabelas com zero.

## Compras

O requester restrito recebe somente seus pedidos pelo registry/port real; o teste renderiza esse mesmo universo e compara todas as linhas, marcas e referências de estoque/aging. O lifecycle usa comandos reais e um único pedido através de draft, pr_pending, pr_rejected, sourcing, src_pending, src_rejected, po_draft, po_pending, po_rejected e po_approved. Rejeitar e reenviar não acumula coortes históricas. Os estados po_issued e cancelled saem do estoque aberto.

No teste de aprovador, dois pedidos têm submissões reais em 1 e 9 de janeiro, observadas em 11 de janeiro: o próprio port fornece 10 e 2 dias. Um terceiro registro legado não contém evento de entrada e conserva idade null. A tabela deve manter o denominador três, duas marcas conhecidas e uma ausência; o clique na marca de dez dias abre a referência original pelo port.read. Isto é prova de domínio e browser no harness, ainda sem a jornada instalada etapa→pedido→retorno.

## Cenários e sensibilidade

O Planner real fornece training explicitamente zero ou null. Os resultados persistidos preservam 0/confirmed e null/absent, respectivamente. Uma fonte pode ser revogada enquanto a sessão UI permanece válida; a cobertura e os leitores de resultado devem negar a evidência correspondente antes de reler a projeção financeira. As marcas, a tabela e as seleções de sensibilidade são comparadas ao mesmo resultado persistido.

A cobertura ainda fica pending por dependência canônica; knownSubtotal não é total completo. A sensibilidade integrada continua conditioned com threshold null. A prova de 55000 permanece do solver canônico sobre subtotal conhecido. A comparação anterior de training omitido/40000 usa stores distintos; a revisão persistida no mesmo caso, ChoiceRecord humano e histórico reaberto continuam por demonstrar.

## Fontes de implementação

- [Planner e browser](https://github.com/gustavomhss/Orchestra-SF/blob/8f8a1a72dec4065c4cfb798d6d48ca13ca6d5760/modules/sucafina/Sucafinav1/test/product/wp05/planner-integration.test.ts)
- [Procurement restrito](https://github.com/gustavomhss/Orchestra-SF/blob/8f8a1a72dec4065c4cfb798d6d48ca13ca6d5760/modules/sucafina/Sucafinav1/test/product/wp05/procurement-integration.test.ts)
- [Lifecycle e aging](https://github.com/gustavomhss/Orchestra-SF/blob/8f8a1a72dec4065c4cfb798d6d48ca13ca6d5760/modules/sucafina/Sucafinav1/test/product/wp05/procurement-stages.test.ts)
- [Cobertura e revogação](https://github.com/gustavomhss/Orchestra-SF/blob/8f8a1a72dec4065c4cfb798d6d48ca13ca6d5760/modules/sucafina/Sucafinav1/test/product/wp05/engine-coverage.test.ts)
- [Sensibilidade persistida](https://github.com/gustavomhss/Orchestra-SF/blob/8f8a1a72dec4065c4cfb798d6d48ca13ca6d5760/modules/sucafina/Sucafinav1/test/product/wp05/sensitivity-integration.test.ts)

## Browser e limite de aceitação

O helper próprio reutiliza a página autenticada do fixture compartilhado e preserva erro primário e erro de limpeza. O Full35 finance excedeu o prazo de60s na fase render, ainda abrangendo importação do bundle, renderer e transporte; a causa não foi isolada. O approver falhou em context.newPage antes do corpo. A estabilidade composta continua aberta; não se atribui a causa exclusivamente a infraestrutura externa. Provas de callbacks e port.read neste harness não equivalem a catálogo instalado, percurso de retorno completo, native/MCP ou artefato residente durável.
