# Campanha integral de produto Orchestra SF em duas horas

**Status: PLANNED.** Plano completo de execução, sem alegação de implementação ou teste do produto já concluído. Repositório: `gustavomhss/Orchestra-SF`. Baseline verificada: `9e4f3d35833f9b2cea6abdf58f42331f3973d9bf` em `dev`.

## Resultado contratado

Entregar toda a campanha anterior de produto e toda a proposta aceita de decisões com IA. A renovação é uma jornada de aceitação; o produto entregue também precisa atender planejamento, compras, manutenção, documentos, portfólio, reuniões, exportação, colaboração e acompanhamento.

O prazo alvo é de 120 minutos. O desenho usa cinco conversas reais, 12 builders dedicados, uma frente parcial da coordenadora S4 e três auxiliares da integradora que depois assumem revisão. O pico é de 20 agentes contando as coordenadoras. Uma conversa com quatro slots não oferece essa capacidade.

Tokens abundantes permitem construção e revisão paralelas; não eliminam dependências, serviços indisponíveis ou fila de CI. Não há medição que garanta a campanha inteira em 120 minutos. O escopo permanece integral se o prazo for excedido; a conclusão depende de provas, não do relógio.

## Escopo integral

- 28 capacidades preservadas: Dashboard 16, Planner 7 e Procurement 5, com navegação, manutenção e estados completos.
- 41 requisitos anteriores preservados, incluindo edição em lote, versões, imports XLSX/XLS/JSON, prévia e recibos.
- Oito perguntas de BI originais e três de decisão: composição de custo, tempo e sensibilidade.
- Primeiro ciclo com responsáveis, Meu trabalho, perguntas, respostas, confirmações e Hot Topics canônicos.
- Revisões e reuniões com base financeira preservada, fechamento, ações e exportações PPTX/DOCX completas.
- Quatro rotinas de preparação, análise de decisão e recorrência pelo Relay/Schedule nativos.
- Casos persistentes, intenção, critérios, alternativas, premissas, escolha humana e mudanças por domínio.
- IA real para investigar, descobrir contradições, propor, criticar, perguntar e reformular a análise.
- Cenários de portfólio com combinações e restrições explícitas, conectados ao mesmo motor financeiro.
- PDF digital, DOCX e texto com extração, referência ao trecho e confirmação humana.
- Reavaliação material, recuperação autorizada de decisões semelhantes e previsto versus observado.
- Integração real entre módulo e host, com sessão, projeto, ator e serviços existentes.

Azure, deploy e novos acessos corporativos permanecem fora do trabalho. Reutilizar credenciais e permissões já configuradas. Não mudar alçadas, autoridade de aprovação ou política financeira para viabilizar a demonstração.

## Organização das cinco sessões

| Sessão | WPs | Missão | Slots |
| --- | --- | --- | --- |
| S0 | WP00 e WP10 | Contratos, host, integração contínua, CI e aceite | Integradora e 3 auxiliares que viram revisores |
| S1 | WP01, WP02, WP03 | Interface, Dashboard e Planner | Coordenadora e 3 builders |
| S2 | WP04, WP05, WP06 | Procurement, BI, imports e documentos | Coordenadora e 3 builders |
| S3 | WP07, WP08, WP09 | Reuniões/exportações, colaboração e rotinas | Coordenadora e 3 builders |
| S4 | WP11, WP12, WP13, WP14 | Decisões, IA, portfólio e memória | 3 builders; a coordenadora implementa WP14 |

Cada WP tem branch e caminhos exclusivos em ownership.json. S0 é a única escritora da branch integradora e dos arquivos compartilhados de composição. Um arquivo nunca tem dois escritores. Se outro trabalho de cloud tiver ownership do mesmo arquivo, trocar patch sobre um SHA combinado e manter um escritor único.

S4 reserva 45 minutos de implementação e 20 de coordenação. Se WP14 não publicar seu produtor até T+30, um slot central assume mediante transferência exclusiva. O novo autor não julga o próprio trabalho; outro coordenador cobre essa revisão.

## Relógio e caminho crítico

T0 é o começo da integradora e inclui abertura das outras sessões, preflight e qualificação. Não reiniciar o relógio quando o ambiente estiver pronto.

| Marco | Saída exigida |
| --- | --- |
| T+0 | Integradora registra T0 e baseline e publica os cinco prompts. A abertura e confirmação das demais sessões entram no relógio. |
| T+5 | Cinco sessões confirmadas e ownership aceito. Se faltar capacidade, registrar efeito no prazo e iniciar as frentes já disponíveis, sem fingir paralelismo nem reduzir escopo. |
| T+10 | C01–C14, writers, exports e fixtures congelados; execução nativa continua em qualificação separada. |
| T+20 | Entrada real do produto chega ao modelo configurado e ao contexto correto de Maestro; acesso, proveniência e indisponibilidade explícitos. Não é gate de início de UI/BI/domínios. |
| T+25 | Primeiros providers no módulo real; contexto autorizado, persistência e uma rota composta. Primeira rodada de CI iniciada cedo. |
| T+40 | Projeções/ações dos três módulos e consumidores novos conectados; imports/BI/reunião já em integração. |
| T+55 | Inferência real, contradição com fontes, simulação canônica e execução/admissão Relay demonstráveis. Execução C12 completa por domínio é exigida em T+75. |
| T+75 | Escopo funcional integral conectado, com persistência real e consumidores presentes; candidato disponível para suites e revisões. |
| T+95 | Primeiro conjunto completo de provas e revisões; defeitos atribuídos e correções em andamento. |
| T+103 | Candidato corrigido congelado; verificação dos componentes afetados e cumulativa disparada. |
| T+118 | Checks exigidos concluídos, três revisões reconciliadas e nenhum achado obrigatório aberto. |
| T+120 | Recibo de entrega integral ou relatório de atraso com pendências concretas; o prazo não relaxa os critérios de conclusão. |

O caminho crítico é: contratos e binding do host → projeções e cálculo canônico → análise real e caso → consumidores integrados → provas e correções no candidato final. UI, BI, extração, relatórios e domínios constroem em paralelo por contratos; dependências reais continuam obrigatórias no aceite.

T+75 é o marco de produto completo. T+75–120 ficam reservados para verificação, correções e entrega. Revisores já começam a examinar incrementos estáveis em T+55. Duas janelas finais de aproximadamente 15 minutos para CI são orçamento a medir cedo; o timeout de 45 minutos do workflow não é estimativa de duração.

## Contratos e integração durante a execução

Os contratos C01–C14 estão detalhados em contracts.json. Congelar assinaturas, estados, export names, exemplos e consumidores até T+10. Fixtures servem para construir em paralelo; somente produtores reais fecham tasks.

WP03 concentra as regras financeiras. WP11 e WP13 usam esse motor. WP08 concentra contribuições humanas e vínculos. WP11 guarda escolhas e propostas; WP14 avalia condições e produz memória; WP09 conduz rotinas; WP10 injeta os serviços e encaminha os comandos aos domínios.

Integração ocorre em T+25, T+40, T+55 e T+75, além de incrementos menores já prontos. Não esperar todos os WPs acabarem. O estado READY_FOR_INTEGRATION significa que existe saída consumível, não que o produto passou na aceitação.

### Decisões técnicas já fechadas no plano

- Leituras de várias superfícies ocorrem fora da transaction externa; cada seção conserva sua versão e autorização.
- O caso pode preparar várias mudanças, mas os domínios confirmam resultados separadamente. O produto mostra estado parcial.
- Idempotência fica no commit do domínio: mutação e recibo local são atômicos. O caso reconcilia depois. Resposta perdida não pode repetir efeito financeiro.
- Importações não podem fabricar confirmações ou apagar silenciosamente a memória confiável. Substituições invalidam referências por encarnação.
- A IA recebe contexto e ferramentas autorizados pelo host. Ela não escolhe papel, não soma valores por conta própria e não recebe uma ferramenta genérica de mutação.
- Relay conserva admissão, publicação, versão e checks. Uma pergunta encerra a análise; a resposta humana permite nova execução admitida.
- Confirmar uma premissa de cenário é diferente de atualizar o registro oficial. A divergência permanece visível até a mudança autorizada.

### Binding nativo como trabalho explícito

A factory inspecionada recebe origem e compõe persistência, autenticação, ambiente e anexos, mas não recebe serviços de IA/Relay. A adaptação de produto está atribuída a WP10, incluindo os entrypoints exatos do host e da factory. Isso não pressupõe falha do deploy paralelo.

BusinessPorts entrega identidade do binding, análise escopada, catálogo/admissão/run, Schedule e retorno autenticado ao caso. Usar serviços públicos de SessionV2 e Maestro. Uma chamada direta a LLM.generateObject pode gerar conteúdo tipado, mas não substitui um workflow admitido. O endpoint de leitura de relay-run não é um endpoint de start.

Em T+20 deve haver uma inferência real na entrada do produto, proveniência e preparação de admissão no projeto correto. Se faltar serviço configurado, registrar o impedimento e dedicar correção; continuar as demais frentes sem apresentar saída roteirizada como IA real.

## Axiomas da campanha

### Definition of Done

- **CAMP.DOD.01** — Todos os WPs e tasks da lista canônica em campaign.json estão implementados, integrados, verificados e com os cinco grupos de axiomas aplicáveis satisfeitos.
- **CAMP.DOD.02** — As jornadas J01–J13 funcionam nos entrypoints reais, com persistência, autorização, produtores e consumidores reais, incluindo IA, Relay, documentos, portfólio e memória.
- **CAMP.DOD.03** — Três revisões independentes reconciliadas; nenhum achado obrigatório aberto; checks requeridos válidos para o candidato final e evidência recuperável.
- **CAMP.DOD.04** — As verificações exigidas pelo repositório e a cobertura de paridade estão válidas para o candidato final; o guia por papel, a demonstração e os limites materiais estão entregues.
- **sf2h-integral-20261112.DOD.05** — As 28 capacidades, R01–R41 e todas as capacidades IA01–IA18 estão implementadas, conectadas a produtores reais e verificadas no candidato de produto. A renovação é uma jornada de aceite, não a fronteira do produto.
- **sf2h-integral-20261112.DOD.06** — T+120 é prazo alvo. Caso reste capacidade ou prova obrigatória, a campanha continua aberta com estado e causa concretos; não declarar MVP, DONE parcial ou feature pronta por estar atrás de flag desativada.

### Invariants

- **CAMP.INV.01** — Domínios continuam como fontes de verdade. UI, BI, relatórios, importação e IA consomem os mesmos contratos; não mantêm cálculos financeiros ou estados de compra paralelos.
- **CAMP.INV.02** — Papéis, escopo de dados, holders, locks, versões esperadas e transições legais são preservados. Tornar uma ação fácil de encontrar não amplia autoridade.
- **CAMP.INV.03** — Ausência, zero observado, valor herdado, estimativa, valor aprovado e emissão interna mantêm significados distintos; período, versão e moeda não mudam silenciosamente.
- **CAMP.INV.04** — Nenhum conteúdo restrito reaparece em busca, contagem, comparação, gráfico, comentário, snapshot, exportação, prompt ou resultado de rotina. Ler ou aplicar revalida acesso atual.
- **CAMP.INV.05** — Relações são explícitas por identidade; coincidência de nomes não cria vínculo, responsável, permissão ou lançamento financeiro.
- **CAMP.INV.06** — Revisão preservada permanece estável. Atualizar a origem não reescreve a reunião passada; acesso revogado não permite recuperar conteúdo privado por histórico.
- **CAMP.INV.07** — Um único WP pode escrever cada arquivo. Nenhuma execução usa a frente de cloud/deploy, acessos novos ou alterações no engine de Relay como atalho para cumprir este escopo.
- **sf2h-integral-20261112.INV.08** — A IA não escolhe ator/papel, não ganha acesso por relacionamento entre registros, não aprova compras nem altera arbitrariamente snapshots; totais e condições são calculados por motores determinísticos.
- **sf2h-integral-20261112.INV.09** — Contrato, orçamento, forecast e actual não são intercambiáveis. Valor desconhecido não é zero; simulação e premissa aceita não atualizam o domínio oficial silenciosamente.
- **sf2h-integral-20261112.INV.10** — Artefatos confiáveis de decisão e colaboração têm política explícita de importação: entrada não pode forjar autor/confirmação; substituição de registros invalida referências por encarnação, sem ressuscitá-las por ID textual reutilizado.
- **sf2h-integral-20261112.INV.11** — Leituras entre superfícies não ocorrem dentro de uma transaction já aberta. A coleta mantém autorização e versões por seção; a escrita em várias áreas produz recibos separados e estado parcial verdadeiro.

### Quality standards

- **CAMP.QLT.01** — As três atividades — revisar, editar e decidir — têm hierarquia própria, ação principal clara, contexto persistente e progressão previsível; interfaces de leitura não são dominadas por formulários.
- **CAMP.QLT.02** — Fluxos essenciais funcionam por teclado; foco é visível e recuperado; status não depende apenas de cor; tabelas e gráficos têm alternativa legível. Verificar 320, 768 e 1440 px e zoom de 200%, sem prometer conformidade normativa sem auditoria específica.
- **CAMP.QLT.03** — Salvar, cancelar, validar, recusar, carregar, ficar sem dados e conflitar possuem resposta compreensível. Falha ou conflito conserva a entrada local e oferece próximo passo útil.
- **CAMP.QLT.04** — Número relevante informa unidade, referência temporal, origem e limitações. Comparações reconciliam e distinguem descrição de hipótese; narrativa gerada não inventa causalidade.
- **CAMP.QLT.05** — Com corpus sintético e ambiente declarados em G0, medir navegação, edição e atualização de gráficos. A ação mostra resposta perceptível em até 200 ms, inclusive indicador de trabalho; comparar a conclusão com o baseline e investigar regressão superior a 20% no p95 antes do aceite.
- **CAMP.QLT.06** — Critérios e evidências são discriminantes: descrevem qual erro real seria detectado. Testar novamente apenas o que mudou ou o que um gate obrigatório exige.
- **sf2h-integral-20261112.QLT.07** — O produto continua utilizável se a análise de IA demorar, falhar ou for cancelada. Resposta rápida de cálculos, erro junto ao campo, foco preservado e confirmação de gravação efetiva.
- **sf2h-integral-20261112.QLT.08** — A contribuição real da IA é demonstrada em variante de caso não preenchida previamente; modelo deve encontrar fonte/condição relevante, produzir proposta tipada e reformulá-la após contribuição humana.

### Completeness criteria

- **CAMP.CMP.01** — Cobrir os contratos C01–C14, as 28 capacidades originais, R01–R41, IA01–IA18 e todas as jornadas da matriz, sem descartar comportamento de negócio aceito.
- **CAMP.CMP.02** — Cobrir leituras e escritas autorizadas/recusadas, dados completos/parciais/ausentes, concorrência, reenvio, referência removida, perda de acesso e retomada depois de falha.
- **CAMP.CMP.03** — O ciclo antes/durante/depois é coberto para executivo, contribuidor, Finance/HR e requester/buyer/approver, usando as permissões reais em vez de um usuário administrador único.
- **CAMP.CMP.04** — As contribuições novas são acessíveis pelos entrypoints reais, com estado compatível e assets/receitas incluídos na entrega do módulo; documentos ou receitas que só existem no repositório não contam como funcionalidade.
- **CAMP.CMP.05** — Cada requisito tem tasks responsáveis, jornadas e evidência esperada. Cada task tem owner, fronteira, entradas, saídas, dependências, checks e os cinco grupos de axiomas locais.
- **sf2h-integral-20261112.CMP.06** — Cobrir ciclos de uso antes/durante/depois: primeiro uso com responsáveis, manutenção, importação, planejamento, compra, análise IA, portfólio, reunião/exportação, recorrência e reavaliação.

### Success criteria

- **CAMP.SUC.01** — André identifica um assunto que exige atenção, vê a referência dos dados, abre sua origem, prepara uma revisão e retoma os encaminhamentos sem reconstruir o contexto em uma planilha auxiliar no roteiro coberto.
- **CAMP.SUC.02** — Um contribuidor atualiza três valores e uma justificativa, ou confirma a versão sem alteração, preservando contexto; uma segunda pessoa vê a projeção compartilhada correspondente.
- **CAMP.SUC.03** — Finance compara hipóteses de forecast e explica a diferença até os componentes; o exemplo 590000 → 602000/596000 reconcilia sem alterar budget, actual fechado ou versão oficial por efeito colateral.
- **CAMP.SUC.04** — Um aprovador identifica etapa, valor, diferença relevante, razão da escolha e próximo passo em até 30 segundos no roteiro controlado; decisões continuam explícitas e autorizadas.
- **CAMP.SUC.05** — Importar, exportar e preparar material não exige redigitação de valores já disponíveis. Prévia e resultado confirmado concordam; toda omissão, restrição ou pendência é explícita.
- **CAMP.SUC.06** — Rotinas reduzem preparação repetitiva e devolvem saídas verificáveis e ações propostas. Repetir uma execução não duplica ações e não concede aprovação de negócio.
- **CAMP.SUC.07** — O aceite interno observa os resultados acima. Adoção e satisfação reais de André/time permanecem hipóteses a medir quando o uso real estiver disponível, sem alegar pesquisa com pessoas que não participaram.
- **sf2h-integral-20261112.SUC.08** — Uma pergunta é respondida uma vez e reutilizada no escopo válido; uma mudança comercial repercute nas comparações sem duplicar contribuição financeira; a escolha original continua explicável após alteração.
- **sf2h-integral-20261112.SUC.09** — A avaliação controlada registra compreensão e retomada da decisão; metas de tempo são metas a medir, nunca promessa de pesquisa ou economia financeira já realizada.

## Axiomas de cada WP e task

Cada arquivo work-packages/WPxx.md contém objetivo, fronteira, janela, entradas, trabalho, saídas, consumos reais, verificações e os cinco grupos de axiomas em dois níveis: WP e cada task. Task e step são a mesma unidade. Subdividir uma task exige criar os cinco grupos para a nova unidade.

Os axiomas são critérios de comportamento. Não são uma ordem para executar um teste por frase. O índice axiom-index.json permite rastrear todos; 18 conjuntos de provas reutilizam evidência sem esconder lacunas.

## Verificação e revisão

| Conjunto | Escopo |
| --- | --- |
| E01 — Contratos montagem e integridade | Contratos compilados, exports registrados, ownership disjunto, entrypoint real e persistência após reload. |
| E02 — Navegação e estados | 28 entradas, navegação contextual, retorno, primeiro uso, teclado, 320/768/1440 px, rascunho, falha e conflito. |
| E03 — Dashboard completo | 16 capacidades do Dashboard, manutenção, projeções, sinais com fontes e Hot Topics sem duplicação. |
| E04 — Planner financeiro | 7 capacidades do Planner; edição mensal e em lote; FX, HR, locks, versões e separação budget/actual/forecast. |
| E05 — Procurement completo | 5 capacidades de Procurement; PR, sourcing e PO; ranking, alçadas, moedas, fornecedores e estados completos. |
| E06 — BI e tabelas | 8 perguntas analíticas originais e 3 novas; fontes, drilldown e tabela reconciliada com os valores dos gráficos. |
| E07 — Imports e confiança | XLSX, XLS e JSON; prévia, cancelamento, aplicação, recibo, roundtrip e proteção contra metadados forjados. |
| E08 — Reuniões e exportações | Pauta, revisão congelada, fechamento e ações; 25 registros e notas longas; PPTX e DOCX renderizados e conferidos. |
| E09 — Colaboração e primeiro ciclo | Primeiro ciclo, diretório autorizado, perguntas e respostas, confirmar sem alteração, escopo por período e Meu trabalho. |
| E10 — Decisão e execução | Caso persistente, alternativas, critérios, escolha, mudanças preparadas e recibos por domínio. |
| E11 — IA real e portfólio | IA real em variante não roteirizada; fontes, contradição, crítica, propostas tipadas e portfólio sob restrições. |
| E12 — Memória e reavaliação | Mudança material e irrelevante; escolha preservada; recuperação após commit e resposta perdida; memória e revogação. |
| E13 — Relay real | Quatro preparações originais e decisão por Relay; admissão, versão, run e checks reais; nenhuma espera humana inventada. |
| E14 — Schedule e retomada | Schedule nativo; timezone, recorrência, pausa, falha, revogação e deduplicação de execução/sinal. |
| E15 — Documentos e injeção | PDF digital, DOCX e texto; trecho de origem e confirmação; documento malicioso, inválido ou sem texto tratado corretamente. |
| E16 — Integração e regressão | Suites exigidas do epic e pacotes afetados, consumidores reais, compatibilidade, host binding e UI integrada. |
| E17 — Reviews independentes | Três pareceres independentes com achado, impacto, evidência, correção e reteste. |
| E18 — Entrega e proveniência | Candidato de produto, snapshot de CI, request, run, jobs e resultado; guias, demo e matriz completa. |

Três revisores independentes cobrem produto/UX, finanças/permissões/persistência e IA/Relay/integração. Cada achado tem impacto, entrada reproduzível, evidência, owner, correção e reteste. Participar da construção não autoriza aprovar a própria mudança.

Todos os registros de implementação começam NOT_RUN. Evidência precisa indicar candidato, ator, entrada, ação, esperado, observado e origem. Screenshot isolado não prova cálculo, acesso ou durabilidade. Compilar não prova integração.

## CI e pacote de entrega

ci-recipes.json contém requests concretas para suites Sucafina/CLI/app e três seleções Playwright disjuntas. O runner Playwright permite a configuração e2e/playwright.production.config.ts; specs novas ficam no namespace e2e/sucafina. Não alterar o validator para fazê-las passar.

O workflow existente test-ci.yml dispara por push em ci-run-*. Usar GitData MCP: candidato C → snapshot S com request validada → branch temporária → run selecionado pelo SHA. Registrar request, seleção, jobs, resultado e controle Omni. Rerun de job antigo não testa código novo. O inventário completo exigido pelo epic e por AGENTS é fechado em T+10, antes do primeiro disparo; suites adicionais exigidas continuam obrigatórias.

Provas de IA/Relay reais usam o host já configurado e ficam ligadas ao mesmo candidato, sem introduzir segredos em .ci-run.json. Testes do repositório rodam no GitHub Actions; typecheck usa o script do pacote e guards seguem AGENTS.

A entrega é o commit integrado, checks válidos, três reviews reconciliados, matriz de escopo completa e guias de uso/demonstração. Merge em dev e deploy seguem o processo de release existente; não são uma dependência escondida deste planejamento.

## Como iniciar

Abrir cinco conversas e enviar o prompt correspondente em prompts/S0.md a prompts/S4.md. A integradora registra T0; as outras quatro confirmam a identidade atribuída e iniciam os três subagentes. Cada prompt aponta os documentos e WPs versionados neste diretório. START.md contém os cinco pontos de entrada; AGENTS-ATLAS-MCP.md complementa a especificação e deve ser reconciliado pela revisão formal.

Os dados de exemplo são sintéticos. A implementação e a IA da entrega precisam ser reais. A demonstração de renovação não substitui as jornadas de portfólio, documentos, operação, reunião e memória.

## Fontes

- [Baseline](https://github.com/gustavomhss/Orchestra-SF/commit/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf)
- [AGENTS](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/AGENTS.md)
- [Workflow de CI](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/.github/workflows/test-ci.yml)
- [Validação de requests](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/script/test-ci-request.ts)
- [Factory do módulo](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/sucafina/Sucafinav1/local/entry.ts)
- [Relay](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/docs/guides/relay.md)
- [Proposta de produto aceita](https://chatgpt.com/space/page_4d04c7a77bc88191ab676452be388958)
