# Cold review — execução, paralelismo e cobertura

**Parecer sobre `sf-sidebar-plan@2f143330a0a44d34eb764ebfb851804c504edb6d`: NÃO PRONTO PARA DESPACHO DE IMPLEMENTAÇÃO.**
Revisão independente, somente leitura remota. Nenhum teste de produto, CI, servidor ou deploy executado. Severidades medem risco do planejamento; não são vulnerabilidades confirmadas do produto.

## Evidência positiva verificada

- O índice `criteria-trace.json` tem exatamente 1.610 IDs únicos.
- Resolvi programaticamente todos os 1.610 JSON Pointers contra o blob canônico `71b56906f8bb190c4d568f60c7511ce1ff63d5f3` de `campaign.json@dbf9547211d9b0fade619790de7c19c0869b7c7d`. Todos resolvem para o mesmo ID; zero ausentes ou extras. Os 74 taskMappings existem.
- A falta não é contagem: o índice é deliberadamente um índice de retenção, não uma ordem de execução completa. Não recomendo copiar ou reescrever os 1.610 textos.
- O canônico já contém `execution.dependency_meaning`, `ci_plan.dispatch_policy.deduplication`, `incremental_validation` e `invalidation_matrix`. Reutilizá-los evita uma segunda fila e uma segunda política.

## EX01 — P1 — As decisões que liberam os executores foram adiadas para os executores

**Evidência:** DELIVERY-PLAN.md:9,19–21,43,49–63; API-AND-ISOLATION.md:89,141. O plano diz que N0/N1 ainda deverão fechar nomes, schemas de cada ação, DTOs, catálogo, rotas, montagem e erros. N1 é XL e cobre quinze famílias.

**Sequência causal:** autor de tela lê uma família de endpoints aproximada → escolhe um nome/campo/erro ou espera N1 tomar a decisão → outro consumidor escolhe forma diferente → integração exige refatoração. O documento não entrega o freeze que exige.

**Correção:** contrato versionado e congelado por família com nomes/métodos/shape/erro/efeito/versão e fonte real; contratos de componentes com exports/props/slots. Cada ordem consome IDs/digests específicos. Mudança desconhecida gera BLOCKED_CONTRACT, com pergunta e impacto; executor não escolhe alternativa.

**Fechamento:** 100% das famílias consumidas por ordens têm lock e fonte; nenhum endpoint/ação/campo/estado discricionário na ficha. Tipos públicos importados de um único produtor.

## EX02 — P1 — Pacotes XL obrigam serialização de áreas independentes

**Evidência:** DELIVERY-PLAN.md:22–28,67–71,97–106. N3 contém Hoje, Dashboard, Meu trabalho, Pessoas, Operações e Portfólio; N9 contém onze gráficos, colaboração, memória e rotinas. O documento reconhece a largura e deixa o eventual adendo para depois. Impõe até três autores sem ligá-los a uma capacidade atual observada.

**Sequência causal:** um autor recebe vários subtrees independentes → fila crítica cresce dentro da task → uma dependência de um domínio mantém capacidades não relacionadas esperando → coordenação posterior precisa alterar ownership.

**Correção:** decompor agora em 78 ordens operacionais com allowlists disjuntas: 1 integração, 4 fundamentos e 1 broker desktop, 5 componentes, 15 adapters finos, 47 fatias de UI, 2 provas transversais e 3 revisões finais independentes. O número é de entregas, não de sessões ou runners simultâneos. Capacidade real decide quantos itens READY se executam.

**Fechamento:** validador de propriedade normalizada não encontra interseção exata/ancestral entre writers; cada ordem tem produto coerente e pequeno, contrato de entrada, saída e prova. Nenhum futuro adendo é necessário apenas para dividir N3/N9.

## EX03 — P1 — Um único DAG mistura autoria, integração e aceite

**Evidência:** DELIVERY-PLAN.md:49–63 põe todo negócio depois do piloto; 39–41 admite dependências de BI/colaboração/anexos não desenhadas no DAG; API-AND-ISOLATION.md:143 permite composição contra contrato antes da prontidão real. O canônico `execution.dependency_meaning` já separa construção de conclusão.

**Sequência causal:** dispatcher obedece ao desenho → deixa autores ociosos até o piloto. Se obedece à prosa alternativa → lança consumidores antes de saber precisamente os outputs compartilhados necessários. A direção de dependência varia conforme o parágrafo escolhido.

**Correção:** três conjuntos distintos por ordem: `depends_authoring` (locks e decisões), `depends_integration` (implementações consumidas) e `depends_qualification` (serviços/identidades/gates reais). UI pode ser escrita contra assinatura congelada; só é integrada e qualificada quando os seus produtores específicos estão presentes. Piloto autoriza rollout, não é barreira global de autoria.

**Fechamento:** três grafos resolvem IDs, não têm ciclos e não contêm arestas fictícias para pacote inteiro. BI/colaboração/arquivos aparecem em todos os consumidores efetivos.

## EX04 — P1 — A infraestrutura de prova do piloto não tem entrega anterior ao piloto

**Evidência:** DELIVERY-PLAN.md:29 descreve N10 dependendo do piloto para começar; 51–52 exige N10 no piloto; ACCEPTANCE.md:59 reconhece que a configuração atual não monta a nova sub-API, exigindo fixture instalada por N0/N10.

**Sequência causal:** transporte e primeira tela terminam → tentativa de provar piloto → descobre-se que falta a instalação nativa no harness → nova rodada de integração, com risco de substituir serviços por fixtures de conveniência.

**Correção:** F04 dedicado ao harness instalado inicia junto com transporte/contexto, a partir do contrato fixado. Dono publica fixture, corpus/identidades, armazenamento isolado, mount e parâmetros de execução. I00 aplica somente os hooks de configuração compartilhados. Web e desktop têm provas específicas; web verde não cobre `oc://renderer`.

**Fechamento:** piloto consome F04 integrado, seleção encontra casos reais e todos os componentes são os de produto. Sem mock de scanner, financeiro, autoridade ou recibos como prova integrada.

## EX05 — P1 — A allowlist textual e o handoff não bastam para impedir erro de autoria

**Evidência:** DELIVERY-PLAN.md:19 usa “registries i18n” e “arquivos centrais ... exports/build”, sem lista fechada; 31–43 limita writers; 75–82 enumera categorias de recibo. Nenhuma ficha por missão fixa arquivos, exports consumidos, imports permitidos, gates exatos, dono da correção e condições de parada.

**Sequência causal:** executor resolve um import faltante editando index/manifest fora da fronteira → outro autor depende de seu próprio export → conflito ou substituição aparece só ao integrar. Ou o integrador vira autor de todos os patches compartilhados, mudando contratos durante a montagem.

**Correção:** ordem machine-readable com owns/consumes, exact outputs, readonly producer paths, symbol contract, source pins, authoring/integration/qualification deps, gate refs, stop rules e receipt. I00 fica com lista finita de registries/entrypoints; autores fornecem pedaços exatos de registro, sem escrever agregadores. Transferências apenas com fechamento explícito de lease e novo owner.

**Fechamento:** todo arquivo alterado pertence a uma allowlist ativa; conflito é detectado antes do despacho, inclusive prefixo pai/filho e teste/i18n. Nenhum worker interpreta uma pasta global como autorização.

## EX06 — P2 — Rastreabilidade existente preserva escopo, mas não fecha a execução das superfícies

**Evidência:** TRACEABILITY.md:39–43,251; criteria-trace.json possui somente id/canonicalPointer/ownerScope/mappingRef nos critérios. taskMappings têm slices/chapters/grupos NUI, sem output, owner primário ou caso preciso. WP02.T01 não lista jornada; todas as demais têm pelo menos uma, mas isso não prova ação por ação.

**Sequência causal:** task compartilhada entre N1/N3/N5 recebe evidência geral → cada autor supõe que outro cobriu uma ação/estado → o total 1.610 continua íntegro apesar de uma obrigação concreta não ter implementação ou observação.

**Correção:** manter o índice original e acrescentar mapa de 70 superfícies com owner primário/contributors, field/action source, rotas, estados e work order. Cada ordem referencia tasks e casos de prova concretos. Registrar por output `adapt`, `reuse`, `requalify` ou `external_blocker`; não promover bloco inteiro por uma suite verde.

**Fechamento:** 70 superfícies têm owner único, nenhum contributor desconhecido e todo requisito de superfície resolve até caso de prova/observação. Os 1.610 pointers continuam imutáveis.

## EX07 — P2 — A política de validação eficiente já existe, mas não está materializada para cada entrega

**Evidência:** ACCEPTANCE.md:78 adia requests exatos para depois; 118–124 exige evidência e gates finais. O canônico `ci_plan.dispatch_policy` já define a chave de deduplicação, invalidação por mudança e seleção incremental.

**Sequência causal:** cada autor decide “o que testar” → repete suite por pacote ou envia request incompleto → consume runners sem fechar risco. Ou reusa verde de outro C indevidamente para economizar tempo.

**Correção:** referenciar a política canônica, não substituí-la. Cada ordem declara novas specs exatas, seleção incremental e consumidores atingidos. Um dispatcher adota run em curso/completo somente com a mesma chave canônica. Mudança documental evidencial não repete produto; alteração normativa de contrato/fixture é material. Gates finais do mesmo C continuam obrigatórios.

**Fechamento:** uma única chave por request efetivo; não há duplicata em voo; toda invalidação tem motivo/path/consumer; nenhum resultado antigo recebe SHA novo. Runners e autores têm limites observados separados.

## EX08 — P2 — Leitura obrigatória não foi reduzida a um contexto executável por missão

**Evidência:** README apresenta uma sequência de treze documentos; DELIVERY-PLAN.md não emite pacotes individuais. O canônico `execution.context_policy` já pede COMMON + JSON próprio e proíbe reler quinze espelhos.

**Sequência causal:** cada worker lê documentação global extensa e escolhe trechos → custo de contexto/reinterpretação repetido; ou reduz por conta própria e perde axiomas transversais.

**Correção:** cada ordem inclui read set mínimo pinado, tasks e axiomas herdados por pointers exatos, contratos/fields/actions apenas do seu escopo e lista de assuntos proibidos. Informações comuns têm uma fonte única e hash; não copiar grandes blocos e deixá-los divergir.

**Fechamento:** executar uma ordem exige um protocolo comum + uma ficha + contratos/superfícies específicas; nenhum documento global de implementação precisa ser redescoberto. Expandir leitura apenas para dependência real encontrada.

## Direção de correção

Os novos manifests e ordens são uma adaptação operacional do canônico, não substituem WPs, critérios, supervisão S0 ou gates. As regras fixam o que o modelo pode fazer; fatos de lançamento (SHA material, ator, branch/lease, runners disponíveis) são preenchidos pelo integrador a partir de evidência real, sem decisão de produto delegada.

Os artefatos de correção ficam em `draft/execution/`. A validade estrutural da documentação é uma checagem documental local; não é teste de produto nem autorização de execução.

