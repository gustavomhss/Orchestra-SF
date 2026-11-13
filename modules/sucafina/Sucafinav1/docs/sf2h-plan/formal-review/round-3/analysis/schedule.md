# Proposta de execução rápida — capacidade e caminho crítico

Fonte examinada: `sf2h-final-0aa2405`, correspondente ao commit `0aa2405bb3668314f60d6a674d2bd53fd5003091`. Produto não executado. Nenhuma duração desta proposta foi medida.

## Diagnóstico concreto

O plano reserva **20 slots físicos**, incluindo cinco coordenadoras e quinze auxiliares; essa capacidade precisa ser admitida por observação, não decorre dos limites das ferramentas desta conversa. Há **23 identidades ao longo da campanha**, pois três builders encerram e cedem seus slots a reviewers novos. Não existe capacidade adicional simplesmente por renomear um coordenador como supervisor. `timebox.slot_lifecycle`, `actor_allocations` e `review_assignments` comprovam essa distribuição.

As 74 tasks possuem 114 arestas `depends_on`; a maior parte das tarefas de um WP pertence ao mesmo escritor persistente. Transformar cada task ou critério numa sessão nova adicionaria leitura, contexto, handoff e risco de colisão sem aumentar capacidade. As tasks continuam como unidades de aceitação; a unidade de despacho deve ser o **conjunto contínuo de tasks do mesmo writer**, com checkpoints de saída.

Há uma ambiguidade operacional concreta: `execution.integration_cadence` enumera somente T+25/40/55/75, enquanto `NATIVE-COMPOSE` precisa estar integrado em T+18. As ondas devem ser checkpoints de consolidação, nunca a única permissão para integrar. S0 pode preparar a composição contra contratos e integrar o lote crítico quando runtime, caso e Planner estiverem prontos, em T+16–18, sem esperar T+25.

O encadeamento tardio mais apertado é WP14.T03 → T04 → `MEMORY-CONSUMPTION` em T+68 → seis consumidores até T+75. Restam somente sete minutos nominais. A segunda cauda é a revisão: reviewers iniciam T+72/75; primeiro parecer T+95; correções até T+103; sobra nominal de quinze minutos para nova CI e rechecks até T+118. Isso é orçamento, não prova de cabimento.

## Mudanças que recomendo integrar agora

### 1. Despachar por prontidão de saída, preservando ownership

S0 mantém uma fila única de incrementos por SHA e contrato. O produtor publica uma única vez ao ficar pronto; consumidor confirma a versão recebida. Saídas críticas de GNATIVE, Atlas e memória entram prioritariamente. As janelas existentes são reservas e checkpoints de diagnóstico, não sleeps obrigatórios: um próximo trecho do mesmo writer pode antecipar somente após conclusão comprovada de seus predecessores, disponibilidade dos inputs e atualização da alocação/lease pelo supervisor.

As verificações de capacidade e ownership continuam obrigatórias. Antecipar não permite sobrepor autoria e coordenação de um mesmo ator, passar na frente de um lease ainda vivo, consumir fixture como dado de produção ou presumir um slot livre. Se a antecipação depender de outro ator, os dois precisam confirmar a transferência por SHA.

Lotes críticos propostos:

| Lote | Inputs reais | Ação do supervisor |
| --- | --- | --- |
| Qualificação nativa | AI-NATIVE/13, NATIVE-CASE/14, NATIVE-PLANNER/15, NATIVE-RUNTIME/16 | Incorporar ao candidato de qualificação e compor até 18; S3 prova até 20. Não esperar onda 25. |
| Base Atlas | DOC-REF/20, ATLAS-MAP/20, ATLAS-PACKAGE/20; depois PROTECTED-STORE/25 | Integrar assim que os predecessores necessários estiverem prontos; distinguir o primeiro lote da chegada posterior do store. |
| Catálogo e operações | AI-FULL/42, MCP-FULL/45, ATLAS-ROUNDTRIP/45 | Atualizar os consumidores reais e iniciar provas disponíveis; não esperar ATLAS-FULL para testar operações que não dependem dele. |
| Memória completa | ATLAS-FULL/55, WP14-LEASE/43, MEMORY-CONSUMPTION/68 | Dar prioridade à cauda de WP14 e aos seis consumidores; antecipar somente se os recibos reais permitirem, sem mudar o deadline no papel. |

### 2. Preservar workers, agrupar raciocínio e publicação

Cada builder recebe seu WP, os contratos que lê, seus paths e seus consumidores. Ele constrói o conjunto contínuo de tasks sob o mesmo lease; não termina/recria agent a cada task. Pode preparar mudanças relacionadas numa passagem e publicar incrementos coerentes por interface. Cada task conserva seus cinco grupos de axiomas, seu estado e sua evidência; um commit compartilhado não concede aceite automático a todas.

Os coordenadores recebem exceções e recibos compactos. Não reexplicam o plano inteiro a cada mensagem, nem obrigam cada worker a inventariar o repositório inteiro ou refazer a análise de APIs já fixadas no pacote de entrada. A retirada de releitura é preparação reutilizável, não retirada da verificação das precondições reais de execução.

### 3. Antecipar revisão somente com capacidade liberada

R1/R2/R3 podem iniciar antes dos checkpoints nominais de 72/75 **apenas se** o builder correspondente encerrou, entregou seus arquivos, a coordenadora aceitou o lease de correção, há um snapshot integrado revisável e a ferramenta confirmou o slot livre. O reviewer permanece novo, sem autoria. Não criar um vigésimo primeiro agente.

A primeira revisão pode examinar um incremento delimitado e gerar achados cedo; seu parecer declara exatamente o SHA e o escopo. O aceite final exige cobertura completa do candidato. Mudança posterior invalida as seções atingidas e suas dependências; a revisão não precisa reler seções comprovadamente inalteradas, mas tampouco herda PASS de um SHA arbitrário.

O supervisor deve preparar o pacote de leitura dos reviewers durante a construção. Isso usa o trabalho dos owners e a coleta existente, sem transformar um autor em juiz. Não é seguro prometer uma data antecipada sem liberação observada desses slots.

### 4. Fazer o congelamento final ser calculado

O minuto 103 só é compatível com o alvo se a cadeia crítica restante de CI, provas live e rechecks couber nos quinze minutos até 118. Calcular a cada mudança material: `último freeze viável = 118 − latência crítica restante observada`. Considerar dependências e disponibilidade reais dos runners, não somente o maior timeout ou a soma indiscriminada de todas as suites.

Dados desconhecidos mantêm o alvo CONDITIONAL/UNKNOWN. Em G2H, o supervisor decide quais bloqueadores e integrações têm prioridade pelo impacto na cauda, preservando escopo. A cada novo candidato, evitar refazer resultados com entradas idênticas somente quando a política de evidência permitir reaproveitamento por footprint/hash; a aceitação cumulativa exigida continua obrigatória.

### 5. Controlar a cauda, não a quantidade de agentes

Prioridades: produtor que libera vários consumidores; output na cadeia de GNATIVE/Atlas/memória; correção que bloqueia candidato/CI; demais incrementos prontos. Trabalho de um writer bloqueado pode continuar em tarefas independentes já pertencentes ao seu ownership. Ajuda de outro worker exige lease de arquivos disjuntos e nova alocação observada; não autoriza copiar a implementação ou criar um segundo escritor.

Não recomendo mover WP14 novamente nem presumir que S0-C consegue fazer CI e memória simultaneamente. O plano já reserva sua transferência em 43 e devolução do controle de CI em 75. Evitar mais mudanças de dono é uma otimização importante.

## Workflow: uma sessão supervisora, N sessões executoras

O perfil de planejamento é **N=4**: S0 supervisora/integradora com seus três auxiliares, mais S1–S4, cada qual com coordenadora e três auxiliares. Total desejado 20, admitido somente se o backend comprovar pools independentes e respeitar seu teto global. As ferramentas de colaboração observadas nesta conversa têm teto global de quatro, incluindo a raiz; não admitem automaticamente esse preset. S0 continua escrevendo composição e integrando; supervisão não é uma sexta coordenadora invisível.

O workflow deve ter um adapter de sessões que **observe capacidades reais**: criar/retomar sessão, enviar missão, obter estado/resultado e confirmar encerramento. A ausência de uma dessas APIs não pode ser representada como ação realizada. Sem API entre conversas, o modo é assistido: prompts S1–S4 são abertos por quem controla a UI, enquanto a troca verificável ocorre por checkpoints/recibos no GitHub MCP. Git é um ledger; não lança nem acorda sessões. Um arquivo YAML, por si só, não inicia conversas ChatGPT. Automação integral exige um backend que realmente crie ou acorde sessões independentes; cinco IDs de sessão não provam cinco pools de capacidade.

Para outro N, compilar nova alocação antes de começar: mapear todos os WPs/tasks/leases para capacidade efetiva, manter exatamente um owner de cada arquivo e revisar a projeção. Não manter o cronograma de 20 slots quando só existem quatro. Mesmo com N maior, runners e limite de modelo precisam ser observados separadamente.

### Estado mínimo do supervisor

`PREPARE → STARTING → ACTIVE → FINAL_VERIFY → DELIVERED`.

Em ACTIVE coexistem construção, qualificação nativa, integração, provas e revisão. Não serializar essas atividades em cinco fases globais. `FIXING` é uma fila dentro de ACTIVE, com novo SHA e invalidação proporcional; `CONTINUING_LATE` conserva o mesmo trabalho após T+120 se necessário. `CAPACITY_HOLD` descreve falta de executor real, sem impedir trabalho independente autorizado.

Cada lane: `PLANNED → LEASED → RUNNING → OUTPUT_READY → INTEGRATED → VERIFIED → DONE`, com `BLOCKED` e retomada. `OUTPUT_READY` não encerra a lane; DONE exige todos os critérios de sua fatia, integração e recibos pertinentes. Cada sessão: `REQUESTED → ACKNOWLEDGED → ACTIVE → CLOSED`; ausência de heartbeat gera `STATUS_UNKNOWN`, não diagnóstico automático de morte.

### Eventos e retomada

Eventos mínimos: `SESSION_ACK`, `OUTPUT_READY`, `INTEGRATION_RESULT`, `BLOCKED`, `FINDING`, `PROOF_RESULT`, `LEASE_RELEASED`, `SESSION_CLOSED`. Chave idempotente: campanha + lane/saída + epoch + SHA. Intra-sessão, usar callbacks/mensagens de colaboração reais. Entre sessões, usar o adapter comprovado; quando só houver Git, coordenadoras consultam um índice compactado de checkpoints e somente frentes relevantes. Não prometer push/event bus que não existe; polling limitado é fallback, sem cada builder fazer seu próprio loop.

Se uma sessão deixar de responder, o supervisor primeiro consulta o estado disponível e o último checkpoint/branch head. Não cria duplicata da mesma autoria. Retomada usa o último SHA, outputs já integrados, achados e critérios pendentes. Takeover exige que o executor anterior tenha encerrado ou que sua autorização de escrita tenha sido efetivamente revogada, lease fechado, novo epoch e compare-and-swap no head; uma mensagem de timeout não cerca um escritor antigo.

O supervisor só termina em DELIVERED quando o candidato final contém o escopo completo, todas as seleções e provas obrigatórias satisfazem seus critérios, três revisores independentes concluíram e não restam achados obrigatórios abertos. Timeout de sessão, fim do orçamento de uma fase ou T+120 não são equivalentes a entrega.

## Axiomas da aceleração

- **DoD:** o workflow possui roster observado, missão por lane, fonte/pacote versionado, saídas consumidas, recibos e candidato final completo.
- **Invariants:** 20 slots no perfil N=4; um writer por arquivo; três reviewers novos; nenhum corte de escopo, gate ou teste obrigatório; nenhuma duração desconhecida vira zero.
- **Quality standards:** comunicação curta baseada em IDs/SHA; prioridades pelo caminho crítico; afirmações de conclusão ligadas à evidência real; nenhum retry cego de trabalho mutável.
- **Completeness criteria:** as 74 tasks, 15 WPs, 17 contratos, 19 handoffs e todas as provas permanecem mapeados; nenhum proprietário de correção fica ausente após liberação do builder.
- **Success criteria:** menos releituras, espera de fila e tarefas duplicadas observadas; entrega cumulativa completa até 120 somente se o relógio real comprovar.

## Métricas que demonstram ganho

Medir T0 real; tempo entre OUTPUT_READY e integração; tempo bloqueado por dependência e por coordenação; reloads/restarts de agentes; tasks despachadas duas vezes; alterações concorrentes recusadas; custo de leitura por pacote; último output crítico; término de CI/provas/revisão; ETA residual. Meta operacional sugerida, ainda não medida: priorizar imediatamente outputs críticos e manter espera de incrementos comuns abaixo de dois minutos quando S0 estiver disponível. Não somar estimativas de economia sobrepostas nem publicar uma porcentagem de ganho sem observação.

## Aplicação segura

A proposta altera política de despacho e supervisão, não comprime arbitrariamente `build_window`, leases, slots ou deadlines. A integradora pode incorporar os campos aditivos fornecidos em `schedule-proposal.json` e a correção explícita de `execution.integration_cadence`, depois cruzar com integração/validação. Novos starts reais antecipados exigem registros e verificação de alocação na execução. O candidato aprovado original permanece intacto.
