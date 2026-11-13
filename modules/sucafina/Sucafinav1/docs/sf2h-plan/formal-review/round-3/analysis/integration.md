# Aceleração por contexto, reuso e integração — proposta

Fonte examinada: `0aa2405bb3668314f60d6a674d2bd53fd5003091`, cópia congelada `sf2h-final-0aa2405`. Esta proposta não implementa o produto, não mede duração de execução e não modifica o plano aprovado. Os 15 WPs, 74 tasks, cinco famílias de axiomas e gates completos permanecem obrigatórios.

## Diagnóstico concreto

O maior desperdício comprovado está na entrada dos executores. `tools/render_plan.py::prompt_markdown` manda **cada sessão ler integralmente 15 documentos**, entre eles a campanha e suas projeções, antes dos WPs. A lista soma **2.598.019 bytes por sessão**; cinco sessões repetem **12.990.095 bytes**. Isso mede bytes UTF-8, não tokens nem tempo. A fonte canônica representa 1.416.545 bytes e `proof-map.json`, 596.228. Vários trechos são reapresentados em contratos, manifesto, prova, WP e guia. O MCP raw já recusa o arquivo maior em algumas rotas.

Os prompts também mostram `### replace_section` e `### body`: chaves internas de `campaign.prompt_sections` viraram cabeçalhos. A instrução genérica e a especializada aparecem juntas. Isso é um defeito real de apresentação e cria leitura repetida; corrigir o gerador é melhor que remendar cinco documentos gerados.

O plano **já tem** writer exclusivo, 19 handoffs, integração incremental, projeções canônicas, quatro checkpoints de composição e fontes primárias verificadas. Não falta outra camada conceitual. Faltam artefatos curtos e inequívocos para usar essas regras sem redescobri-las em toda sessão.

Fontes: `prompts/S0.md` e `prompts/S1.md`, seções Leitura obrigatória/Sua orquestração; `campaign.execution`; `campaign.timebox.sessions`; `ownership.json`; `output-handoffs.json`; `consumption_map`; `source_receipts` e `resident_source_evidence`.

## 1. Uma supervisora e jobs já atribuídos

S0 continua sendo a supervisora e a única integradora, dentro do slot que já possui. Ela lança ou acompanha S1–S4, que recebem atribuição fixa e gerenciam seus builders reais. Não criar uma sexta coordenadora nem contar S0 escrevendo e supervisionando simultaneamente.

O preset de cinco sessões só admite vinte slots depois de observar a capacidade e o escopo do backend. `collaboration.spawn_agent` desta árvore oferece quatro slots **globais**, incluindo root; filhos não transformam esse teto em vinte. Uma conversa independente por sessão é uma capacidade distinta, a qual precisa ser realmente criada ou observada. N é parâmetro de roster validado, não multiplicador automático de capacidade.

Cada mensagem de lançamento deve conter campanha, SHA de planejamento, SHA de código, `job_id`, sessão/ator, WPs/tasks, branch, lease de arquivos, entradas obrigatórias, outputs/checkpoints, consumidores, provas e condição de término. Nenhum executor escolhe uma fatia. O job permanece o mesmo durante retomadas; a tentativa muda e recebe uma nova geração de lease depois de encerrar a anterior.

Transporte: usar eventos de threads nativas quando disponíveis. O GitHub continua sendo o ledger durável de commits e recibos, sem inventar barramento ou API. O ledger não cria sessões. Se o host não consegue lançar conversas independentes, isso precisa aparecer no GREADY; não declarar o preset iniciado só porque há quatro nomes no JSON.

## 2. Compilar contexto mínimo completo

Adicionar ao gerador existente saídas determinísticas, sem novo runtime de orquestração:

- `execution/COMMON.md`: missão, escopo, axiomas de campanha completos, invariantes transversais, distinção entre construção e aceite, limites de autoridade, estados e protocolo de recuperação.
- `execution/manifest.json`: índices de sessões/jobs, hashes, source selectors, dependências, branches, leases, responsáveis e transporte admitido.
- `execution/sessions/S0.md` a `S4.md`: prompts inequívocos, com os jobs atribuídos e responsabilidade real da coordenadora.
- `execution/jobs/<job-id>.json` e `.md`: pacote exato do ator, tarefas atribuídas, cinco famílias de axiomas completas nos WPs/tasks relevantes, contratos usados/providos, interfaces dos vizinhos, entradas/saídas, critérios/provas pertinentes e fontes de código.
- `execution/sources.json`: índices de fontes primárias por SHA/blob e dependentes. É referência/cache de descoberta, não autorização para pular a leitura do código que será alterado.

A fonte permanece `campaign.json`. Os packs são projeções com `source_commit`, `campaign_sha256`, versão do compilador, JSON pointers e digest. O modo `--check` compara conteúdo gerado com seleção exata. Nenhum resumo livre pode substituir critérios normativos. Não forçar limite de bytes truncando requisitos; se o pack ficar grande, fragmentar por fase/job com índice e hashes.

O builder lê COMMON, seu job pack e AGENTS/código de sua fronteira. Não precisa ler também todas as representações do mesmo conteúdo. A supervisora lê o mapa global, cobertura e as próprias tasks; revisores recebem o escopo de revisão completo e acesso a todas as fontes, incluindo as bordas fora do writer. Evidência relevante não pode ser filtrada só porque outra sessão a produziu.

Um ensaio de seleção de WP com axiomas, contratos e handoffs completos mede entre **92.415 e 186.628 bytes**. Faltam anexos específicos de runtime, provas e fontes nesse ensaio, portanto não é tamanho final nem previsão de ganho. O compilador deve publicar os tamanhos reais de seus packs. A medição está em `context-volume-measurement.json`.

## 3. Uma descoberta de APIs, inspeção local pelo dono

S0 já tem `source_receipts` e `resident_source_evidence`. Publicar seus índices e as conclusões vinculadas ao SHA evita cinco buscas pelo caminho de `AgentV2`, `SkillV2`, MCP, Atlas, scripts CI e regras. Cada writer continua lendo a implementação e as dependências que altera. Divergência entre conclusão e código deve ser reportada e resolvida; o recibo antigo não vence uma fonte atual diferente.

A chave de cache é repositório + commit + path + blob + questão respondida. Só atualizar descoberta quando a origem, o contrato ou a questão mudar. Checks de identidade, autorização, disponibilidade do modelo/scanner e capacidade atual **não** podem ser reaproveitados como se fossem fatos imutáveis do código.

## 4. Construir uma vez, consumir a mesma implementação

Materializar uma tabela curta de reuso no manifesto, extraída dos owners existentes:

| Elemento | Produtor | Consumidores usam |
| --- | --- | --- |
| Padrões UI e estados | WP01.T02/T03 | Componentes reais em `product/ui`, sem sistema paralelo de edição/conflito |
| Cálculo e simulação financeira | WP03 | As mesmas projeções e o mesmo motor em BI, importação, decisão, portfólio e IA |
| Geometria e apresentação dos oito gráficos | WP05 | Catálogo e modelos de apresentação em telas, reunião e exportação |
| Parse/normalização de arquivos | WP06.T01 | Mesmos parsers e comandos de domínio na prévia/Apply |
| Extração e evidência documental | WP06.T05 | A mesma evidenceRef em decisão, dossiê e memória |
| Carga de skills/ponte MCP | WP10.T06 + manifesto WP12 | Dispatch para handlers reais dos domínios; sem duplicar regra no wrapper |
| Persistência/host | WP10.T01/T07 | Portas existentes, transação e composição reais |

Essa tabela operacionaliza `consumption_map` e ownership; não cria novo framework. Dezoito skills são arquivos distintos com conteúdo próprio e podem compartilhar um template de estrutura. Trinta e nove operações podem compartilhar registro/serialização/autorização estrutural, mas preservam handlers, semântica e as 39 rotas positivas. Não criar gerador genérico de negócio para poupar algumas linhas.

Não há necessidade de esperar uma task inteira para consumir um output já aceito. Em particular, os incrementos AI-NATIVE, NATIVE-CASE, NATIVE-PLANNER e NATIVE-RUNTIME mantêm seus marcos 13/14/15/16. Os períodos de integração 25/40/55/75 são checkpoints de consolidação; não devem virar barreiras que deixem uma dependência pronta parada até a próxima reunião.

Um incremento adicional de kit UI só deve ser acrescentado após definir export/consumer/owner concreto dentro da janela existente de WP01.T02. Não prometer antecipação que comece antes do writer ou que entregue stubs como componente final.

## 5. Receber e integrar cada incremento uma vez

Usar os recibos existentes e uma chave de consumo `(campaign, job_id, lease_generation, output_id, producer_sha, contract_digest)`. O produtor publica o commit e um recibo pequeno quando o incremento é consumível. O mesmo evento repetido não provoca nova integração ou nova análise.

S0 mantém uma única fila de integração dentro de sua alocação. Priorização: dependência do caminho nativo e de outputs bloqueantes; em seguida incrementos com mais consumidores; por fim ajustes independentes. O serviço continua sendo S0, sem agente de integração implícito.

O consumidor recebe o **commit do incremento**, sua versão contratual, export e prova disponível; não relê todo o histórico do WP. `depends_on` e `integrates_with` mantêm sua semântica atual: construir com fixture de contrato é permitido; aceitar exige produtor real. Fonte mudou: invalidar somente cache/artefatos de planejamento e provas atingidos por essa mudança segundo regras válidas. Nenhuma equivalência presumida entre código alterado e prova anterior.

Batch de commits deve seguir incremento consumível, e não linha de checklist ou arquivo individual. Não atrasar os quatro handoffs nativos para formar um batch maior. GitHub mutations continuam com lease/expected SHA; conflitos são reconciliados pelo owner, sem sobrescrever árvore concorrente.

## 6. Recuperação curta e sem duplicar writers

Checkpoint por mudança material: head, tasks concluídas/pendentes, outputs recebidos/produzidos, hashes dos contratos, lease/geração, provas com candidato, bloqueio e próximo passo. Evitar narração contínua ou cópias integrais do plano em cada recibo.

A supervisora distingue executor ocupado, executor sem resposta e executor encerrado. Silêncio não autoriza assumir que morreu. Reatribuição exige fechamento ou fencing realmente suportado do lease anterior. Sem isso, continuar trabalho disjunto; não iniciar dois writers do mesmo path. Novo executor lê o checkpoint e o delta desde o head recebido, retoma as tasks restantes e não reabre descoberta/implementação já aceita sem motivo concreto.

## Axiomas da otimização

**DoD:** prompts e packs gerados, hashados e conferidos; cada task tem um owner executável, cada output tem consumidor e recibo; supervisor/worker conhecem identidade, branch e regra de retomada sem escolher fatia; todos os critérios originais permanecem acessíveis e completos.

**Invariants:** fonte única; nenhuma redução de escopo/axiomas/provas; um writer por path; teto observado de capacidade; identidade e autorização atuais; runtime real no aceite; reviewers independentes; nenhuma prova herdada por mera semelhança de SHA.

**Quality standards:** texto direto, sem chaves de implementação renderizadas; contrato com produtor/consumidor/export; informação reutilizada é imutável e tem hash; comunicação contém mudança, impacto e próximo passo; códigos não ganham abstração desnecessária.

**Completeness criteria:** 74 tasks e cinco famílias de axiomas preservadas; todos os leases, 19 handoffs, 18 skills, 39 rotas e seis provas residentes incluídos na seleção pertinente; nenhum ator/reviewer perde seus invariantes transversais; sessão bloqueada possui trabalho disjunto/recovery conhecido.

**Success criteria:** medir volume inicial realmente lido, chamadas repetidas de descoberta, duplicatas descartadas, tempo ready→consumed, conflitos de writer e minutos de coordenação. Objetivo operacional: zero reimplementações do mesmo produtor, zero integrações duplicadas do mesmo recibo e zero colisões. Ganho em minutos só pode ser afirmado depois de observado.

## Alterações sugeridas no plano

1. Corrigir `tools/render_plan.py::prompt_markdown` para substituir a seção genérica pela seção específica, sem renderizar `replace_section`/`body` como headings.
2. Acrescentar definição declarativa de jobs/contexto em `campaign.execution` ou seção própria. Gerar artefatos de execução e validar cobertura, hashes e acesso aos critérios.
3. Trocar a leitura integral dos quinze documentos pelo COMMON + pack da sessão/job + fontes obrigatórias de seu escopo.
4. Explicitar lançamento atribuído, capacidade admitida, transporte observado e retomada no prompt supervisor. Preservar S0 como writer integrador e suas janelas.
5. Acrescentar índice de reuso e regra de deduplicação aos recibos, sem trocar os producers/contratos existentes.
6. Manter o cronograma como orçamento condicionado. Nenhuma mudança acima comprova que toda implementação cabe em duas horas.

Estado desta proposta: `PROPOSED`; implementação/provas de produto: `NOT_RUN`.
